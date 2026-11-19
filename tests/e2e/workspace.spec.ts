import {
  expect,
  test,
  type APIRequestContext,
  type Page
} from "@playwright/test";

const apiBaseUrl = "http://127.0.0.1:3001";

test("manages workspaces, tags, imports, moves and restores cloud documents", async ({
  page
}) => {
  const account = await registerUser(page, "工作区作者");
  const marker = `E2E_RELIABLE_${Date.now()}`;

  await expect(page.getByLabel("文档标题")).toHaveValue("欢迎使用 InkLoom");
  const firstSave = page.waitForResponse(isSuccessfulDocumentSave);
  await page
    .getByLabel("Markdown 源码")
    .fill(`# 欢迎使用 InkLoom\n\n${marker}\n\n刷新后仍然存在。\n`);
  await firstSave;
  await expectSaved(page);

  await page.getByRole("button", { name: "切换工作区" }).click();
  await page.getByRole("button", { name: "重命名当前工作区" }).click();
  await page
    .getByRole("dialog")
    .getByLabel("工作区名称")
    .fill("长期写作");
  await page.getByRole("button", { name: "保存名称" }).click();
  await expect(
    page.getByRole("button", { name: "切换工作区" })
  ).toContainText("长期写作");

  await page
    .getByRole("dialog")
    .getByRole("button", { name: "新建工作区" })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("工作区名称")
    .fill("项目验收");
  await page.getByRole("button", { name: "创建并切换" }).click();
  await expect(
    page.getByRole("button", { name: "切换工作区" })
  ).toContainText("项目验收");
  await expect(page.getByLabel("文档标题")).toHaveValue("欢迎使用 InkLoom");

  await page.getByRole("button", { name: "新建文档" }).first().click();
  await expect(page.getByLabel("文档标题")).toHaveValue("未命名文档");
  const titleSave = page.waitForResponse(isSuccessfulDocumentSave);
  await page.getByLabel("文档标题").fill("工作台验收");
  await titleSave;

  await page.getByRole("button", { name: "添加标签" }).click();
  await page.getByRole("dialog").getByLabel("新标签").fill("验收");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "添加", exact: true })
    .click();
  await page.getByRole("button", { name: "移除标签 验收" }).click();
  await page.getByRole("dialog").getByLabel("新标签").fill("验收");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "添加", exact: true })
    .click();
  await page.getByRole("button", { name: "完成" }).click();
  await expect(page.locator(".document-header .tag-pill")).toContainText(
    "验收"
  );

  await page.getByRole("button", { name: "移动或重命名文档路径" }).click();
  await page
    .getByRole("dialog")
    .getByLabel("工作区路径")
    .fill("项目/工作台/验收.md");
  await page.getByRole("button", { name: "保存路径" }).click();
  await expect(page.locator(".document-footer")).toContainText(
    "项目/工作台/验收.md"
  );

  await page.locator('input[type="file"]').setInputFiles({
    name: "导入样例.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("# 导入样例\n\n从本地进入云端。\n", "utf8")
  });
  await expect(page.getByLabel("文档标题")).toHaveValue("导入样例");

  await page.getByRole("button", { name: "切换工作区" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /长期写作/ })
    .click();
  await expect(page.getByLabel("Markdown 源码")).toHaveValue(
    new RegExp(marker)
  );

  await page.reload();
  await expect(page.getByLabel("Markdown 源码")).toHaveValue(
    new RegExp(marker)
  );

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.md$/);

  await page.getByRole("button", { name: /revision 1/ }).first().click();
  await page.getByRole("button", { name: "恢复此版本" }).click();
  await expect(page.getByLabel("Markdown 源码")).not.toHaveValue(
    new RegExp(marker)
  );
  await expectSaved(page);

  await page.getByRole("button", { name: "账号设置" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "退出登录" })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "退出登录" })
    .click();
  await expect(page.getByRole("tab", { name: "登录" })).toBeVisible();
  await page.getByLabel("邮箱").fill(account.email);
  await page.getByLabel("密码").fill(account.password);
  await page.getByRole("button", { name: "进入工作区" }).click();
  await expect(page.getByRole("button", { name: "切换工作区" })).toContainText(
    "长期写作"
  );
});

test("isolates revision conflicts and deletes the local conflict copy", async ({
  page,
  request
}) => {
  await registerUser(page, "冲突作者");
  await page.getByRole("button", { name: "新建文档" }).first().click();
  await expect(page.getByLabel("文档标题")).toHaveValue("未命名文档");
  const titleSave = page.waitForResponse(isSuccessfulDocumentSave);
  await page.getByLabel("文档标题").fill("冲突基线");
  await titleSave;
  await expectSaved(page);

  const workspace = await getActiveWorkspace(page, request);
  const serverWrite = await request.put(
    `${apiBaseUrl}/api/workspaces/${workspace.id}/documents/${workspace.documentId}`,
    {
      headers: { Cookie: workspace.cookie },
      data: {
        baseRevision: workspace.revision,
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

  await page.getByRole("button", { name: "更多操作" }).click();
  await page.getByRole("menuitem", { name: "删除文档" }).click();
  await page.getByRole("button", { name: "确认删除" }).click();
  await expect(
    page.getByRole("button", { name: /^冲突基线 / })
  ).toHaveCount(0);
});

async function registerUser(page: Page, displayName: string) {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@inkloom.local`;
  const password = "e2e-test-password";
  await page.goto("/");
  await page.getByRole("tab", { name: "创建账号" }).click();
  await page.getByLabel("称呼").fill(displayName);
  await page.getByLabel("邮箱").fill(email);
  await page.getByLabel("密码").fill(password);
  await page.getByRole("button", { name: "创建并进入" }).click();
  return { email, password };
}

async function expectSaved(page: Page) {
  await expect(page.locator(".save-indicator")).toContainText("已保存到云端");
}

async function getActiveWorkspace(
  page: Page,
  request: APIRequestContext
) {
  const cookies = await page.context().cookies();
  const session = cookies.find((cookie) => cookie.name.includes("inkloom_session"));
  if (!session) throw new Error("Session cookie was not found.");
  const cookie = `${session.name}=${session.value}`;
  const headers = { Cookie: cookie };
  const workspaceResponse = await request.get(`${apiBaseUrl}/api/workspaces`, {
    headers
  });
  const workspacePayload = (await workspaceResponse.json()) as {
    workspaces: Array<{ id: string }>;
  };
  const workspaceId = workspacePayload.workspaces[0].id;
  const treeResponse = await request.get(
    `${apiBaseUrl}/api/workspaces/${workspaceId}/tree`,
    { headers }
  );
  const treePayload = (await treeResponse.json()) as {
    tree: WorkspaceNodePayload;
  };
  const document = findDocument(treePayload.tree, "冲突基线");
  if (!document) throw new Error("Created document was not found in the API tree.");
  return {
    id: workspaceId,
    cookie,
    documentId: document.id,
    revision: document.meta.revision
  };
}

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
