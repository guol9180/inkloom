import { expect, test } from "@playwright/test";

test("registers, persists, exports, deletes, isolates conflicts, and logs out", async ({
  page,
  request
}) => {
  const apiBaseUrl = "http://127.0.0.1:3001";
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@inkloom.local`;
  const password = "e2e-test-password";
  const firstMarker = `E2E_PERSIST_${Date.now()}`;

  await page.goto("/");
  await page.getByRole("tab", { name: "创建账号" }).click();
  await page.getByLabel("称呼").fill("端到端作者");
  await page.getByLabel("邮箱").fill(email);
  await page.getByLabel("密码").fill(password);
  await page.getByRole("button", { name: "创建并进入" }).click();

  await expect(page.getByLabel("文档标题")).toHaveValue("欢迎使用墨织");
  const initialSave = page.waitForResponse(isSuccessfulDocumentSave);
  await page
    .getByLabel("Markdown 源码")
    .fill(`# 欢迎使用墨织\n\n${firstMarker}\n\n刷新后仍然存在。\n`);
  await initialSave;
  await expect(page.getByText("已保存到云端")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Markdown 源码")).toHaveValue(
    new RegExp(firstMarker)
  );

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.md$/);

  await page
    .locator(".sidebar-head")
    .getByRole("button", { name: "新建文档" })
    .click();
  await expect(page.getByLabel("文档标题")).toHaveValue("未命名文档");
  const titleSave = page.waitForResponse(isSuccessfulDocumentSave);
  await page.getByLabel("文档标题").fill("冲突基线");
  await titleSave;
  await expect(page.getByText("已保存到云端")).toBeVisible();

  const login = await request.post(`${apiBaseUrl}/api/auth/login`, {
    data: { email, password }
  });
  expect(login.ok()).toBeTruthy();
  const workspaceResponse = await request.get(`${apiBaseUrl}/api/workspaces`);
  const workspacePayload = (await workspaceResponse.json()) as {
    workspaces: Array<{ id: string }>;
  };
  const workspaceId = workspacePayload.workspaces[0].id;
  const treeResponse = await request.get(
    `${apiBaseUrl}/api/workspaces/${workspaceId}/tree`
  );
  const treePayload = (await treeResponse.json()) as {
    tree: WorkspaceNodePayload;
  };
  const document = findDocument(treePayload.tree, "冲突基线");
  if (!document) throw new Error("Created document was not found in the API tree.");

  const serverWrite = await request.put(
    `${apiBaseUrl}/api/workspaces/${workspaceId}/documents/${document.id}`,
    {
      data: {
        baseRevision: document.meta.revision,
        title: "冲突基线",
        markdown: "# 冲突基线\n\nSERVER_E2E_CONFLICT\n"
      }
    }
  );
  expect(serverWrite.ok()).toBeTruthy();

  await page
    .getByLabel("Markdown 源码")
    .fill("# 冲突基线\n\nLOCAL_E2E_CONFLICT\n");
  await expect(page.getByText("云端版本与本地修改均已保留")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /冲突基线（本地冲突副本）/ })
  ).toBeVisible();
  await expect(page.getByLabel("Markdown 源码")).toHaveValue(
    /LOCAL_E2E_CONFLICT/
  );

  await page.getByRole("button", { name: /^冲突基线 / }).first().click();
  await expect(page.getByLabel("Markdown 源码")).toHaveValue(
    /SERVER_E2E_CONFLICT/
  );

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "更多操作" }).click();
  await expect(
    page.getByRole("button", { name: /^冲突基线 / })
  ).toHaveCount(0);

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "退出登录" }).click();
  await expect(page.getByRole("tab", { name: "登录" })).toBeVisible();
});

type WorkspaceNodePayload =
  | {
      kind: "folder";
      children: WorkspaceNodePayload[];
    }
  | {
      kind: "document";
      id: string;
      name: string;
      meta: { revision: number; title: string };
    };

function findDocument(
  node: WorkspaceNodePayload,
  name: string
): Extract<WorkspaceNodePayload, { kind: "document" }> | undefined {
  if (node.kind === "document") return node.meta.title === name ? node : undefined;
  for (const child of node.children) {
    const match = findDocument(child, name);
    if (match) return match;
  }
  return undefined;
}

function isSuccessfulDocumentSave(response: {
  request(): { method(): string };
  url(): string;
  ok(): boolean;
}): boolean {
  return (
    response.request().method() === "PUT" &&
    response.url().includes("/api/workspaces/") &&
    response.url().includes("/documents/") &&
    response.ok()
  );
}
