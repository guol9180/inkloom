import { expect, test, type Page } from "@playwright/test";

const API_ORIGIN = "http://127.0.0.1:3001";

test("creates a scratch note, saves it, refreshes and protects routes", async ({
  page
}) => {
  await registerUser(page);
  await expect(
    page.getByRole("heading", { name: "从一个清晰的想法开始" })
  ).toBeVisible();

  await page
    .getByRole("main")
    .getByRole("button", { name: "新建随记" })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("文档标题")
    .fill("真实保存验收");
  await page.getByRole("button", { name: "创建" }).click();
  await expect(page).toHaveURL(/\/notes\/[^/]+$/);

  const editor = page.getByLabel("Markdown 正文");
  await expect(editor).toBeVisible();
  await expect(
    page.getByRole("button", { name: "保存", exact: true })
  ).toHaveCount(0);
  const autosave = page.waitForRequest(
    (request) =>
      request.method() === "PUT" &&
      /\/api\/workspaces\/[^/]+\/documents\/[^/]+$/.test(
        new URL(request.url()).pathname
      ) &&
      (request.postDataJSON() as { checkpoint?: unknown }).checkpoint === false
  );
  await editor.click();
  await page.keyboard.type("真实保存验收");
  await page.keyboard.press("Enter");
  await page.keyboard.type("刷新后仍然存在。");
  await expect(editor).toContainText("刷新后仍然存在。");
  await autosave;
  await expect(page.getByText(/已保存/).first()).toBeVisible();
  const checkpoint = page.waitForRequest(
    (request) =>
      request.method() === "PUT" &&
      /\/api\/workspaces\/[^/]+\/documents\/[^/]+$/.test(
        new URL(request.url()).pathname
      ) &&
      (request.postDataJSON() as { checkpoint?: unknown }).checkpoint === true
  );
  await checkpoint;
  const draftKeys = await page.evaluate(() =>
    Object.keys(localStorage).filter((key) =>
      key.startsWith("inkloom.draft.")
    )
  );
  expect(draftKeys).toEqual([]);
  const workspaceId = workspaceIdFromUrl(page);
  const documentId = documentIdFromUrl(page);
  const revisionResponse = await page.request.get(
    `${API_ORIGIN}/api/workspaces/${workspaceId}/documents/${documentId}/revisions`
  );
  expect(revisionResponse.ok()).toBe(true);
  const revisions = (await revisionResponse.json()) as {
    revisions: Array<{ meta: { revision: number } }>;
  };
  expect(revisions.revisions.length).toBeGreaterThan(0);
  await page.keyboard.press("Control+Home");
  await editor.evaluate((root) => {
    root.closest<HTMLElement>(".overflow-y-auto")?.scrollTo({ top: 0 });
  });
  await page.screenshot({
    path: "test-results/ui-review/t31-autosave-1440x960.png"
  });

  await page.reload();
  await expect(page.getByLabel("Markdown 正文")).toContainText(
    "真实保存验收"
  );
  await expect(page.getByLabel("Markdown 正文")).toContainText(
    "刷新后仍然存在。"
  );

  const protectedPath = new URL(page.url()).pathname;
  await page.getByRole("button", { name: "账号设置" }).click();
  await page.getByRole("menuitem", { name: "退出登录" }).click();
  await expect(page.getByRole("tab", { name: "登录" })).toBeVisible();

  await page.goto(protectedPath);
  await expect(page.getByRole("tab", { name: "登录" })).toBeVisible();
  await expect(page).toHaveURL(/\/login\?next=/);
  await page.getByLabel("邮箱").fill(await testEmail(page));
  await page.getByLabel("密码").fill("review-password");
  await page.getByRole("button", { name: "进入工作区" }).click();
  await expect(page.getByLabel("Markdown 正文")).toContainText(
    "刷新后仍然存在。"
  );
});

test("recovers an IndexedDB draft after a failed autosave", async ({
  page
}) => {
  await registerUser(page);
  await createScratchNote(page, "离线草稿验收");
  const editor = page.getByLabel("Markdown 正文");
  const routePattern = /\/api\/workspaces\/[^/]+\/documents\/[^/]+$/;
  let failedAutosaves = 0;
  await page.route(routePattern, async (route) => {
    if (route.request().method() === "PUT") {
      failedAutosaves += 1;
      await route.abort("failed");
      return;
    }
    await route.continue();
  });

  await editor.click();
  await page.keyboard.type("没有网络时写下的内容");
  await expect.poll(() => failedAutosaves).toBeGreaterThan(0);

  await page.reload();
  await expect(page.getByLabel("Markdown 正文")).toContainText(
    "没有网络时写下的内容"
  );
  await expect(page.getByText("已恢复本机草稿")).toBeVisible();
  await page.unroute(routePattern);

  const retrySaved = page.waitForResponse(
    (response) =>
      response.request().method() === "PUT" &&
      routePattern.test(new URL(response.url()).pathname) &&
      response.status() === 200
  );
  await retrySaved;
  await expect(page.getByText(/已保存/).first()).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Markdown 正文")).toContainText(
    "没有网络时写下的内容"
  );
});

test("preserves a local conflict copy and reloads the cloud version", async ({
  page
}) => {
  await registerUser(page);
  await createScratchNote(page, "冲突验收");
  const workspaceId = workspaceIdFromUrl(page);
  const documentId = documentIdFromUrl(page);
  const editor = page.getByLabel("Markdown 正文");
  await expect(editor).toBeVisible();
  const externalWrite = await page.request.put(
    `${API_ORIGIN}/api/workspaces/${workspaceId}/documents/${documentId}`,
    {
      data: {
        baseRevision: 1,
        checkpoint: true,
        markdown: "# 云端更新\n"
      }
    }
  );
  expect(externalWrite.ok()).toBe(true);

  await editor.click();
  await page.keyboard.type("本地冲突内容");
  await expect(page.getByText("发现版本冲突")).toBeVisible({
    timeout: 15_000
  });
  await expect(editor).toContainText("云端更新");
  await page.getByRole("button", { name: "打开本地副本" }).click();
  await expect(page).toHaveURL(/\/notes\/[^/]+$/);
  expect(documentIdFromUrl(page)).not.toBe(documentId);
  await expect(page.getByLabel("Markdown 正文")).toContainText(
    "本地冲突内容"
  );
});

test("allows only one tab to edit the same document", async ({ page }) => {
  await registerUser(page);
  await createScratchNote(page, "单编辑所有者");
  const secondPage = await page.context().newPage();
  await secondPage.goto(page.url());
  await expect(
    secondPage.getByText("此文档正在另一个标签页编辑")
  ).toBeVisible();
  await expect(secondPage.getByLabel("Markdown 正文")).toHaveCount(0);

  await page.close();
  await secondPage.bringToFront();
  await expect(secondPage.getByLabel("Markdown 正文")).toBeVisible({
    timeout: 8_000
  });
  await secondPage.close();
});

test("skips autosave when content returns to the persisted hash", async ({
  page
}) => {
  await registerUser(page);
  await createScratchNote(page, "内容哈希跳过");
  let writes = 0;
  page.on("request", (request) => {
    if (
      request.method() === "PUT" &&
      /\/api\/workspaces\/[^/]+\/documents\/[^/]+$/.test(
        new URL(request.url()).pathname
      )
    ) {
      writes += 1;
    }
  });

  const editor = page.getByLabel("Markdown 正文");
  await editor.click();
  await page.keyboard.type("临时内容");
  await page.keyboard.press("Control+z");
  await expect(editor).not.toContainText("临时内容");
  await page.waitForTimeout(1_200);
  expect(writes).toBe(0);
});

test("creates and refreshes a flat knowledge base route", async ({ page }) => {
  await registerUser(page);
  await page.getByRole("button", { name: "知识库", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "选择或创建一个知识库" })
  ).toBeVisible();

  await page
    .getByRole("main")
    .getByRole("button", { name: "新建知识库" })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("知识库名称")
    .fill("产品资料");
  await page.getByRole("button", { name: "创建" }).click();
  await expect(page).toHaveURL(/\/knowledge\/[^/]+$/);
  await expect(
    page.getByRole("heading", { name: "产品资料" })
  ).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole("heading", { name: "产品资料" })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "知识库", exact: true })
  ).toHaveAttribute("class", /bg-ink-950/);
});

test("keeps the near-white shell within the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/login");
  await expect(page.getByRole("tab", { name: "登录" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await registerUser(page);
  await expectNoHorizontalOverflow(page);
  await page.getByRole("button", { name: "打开导航" }).click();
  await expectNoHorizontalOverflow(page);
});

async function registerUser(page: Page) {
  const email = `workspace-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}@inkloom.local`;
  await page.goto("/register");
  await page.getByLabel("称呼").fill("工作区验收");
  await page.getByLabel("邮箱").fill(email);
  await page.getByLabel("密码").fill("review-password");
  await page.getByRole("button", { name: "创建并进入" }).click();
  await expect(page).toHaveURL(/\/workspaces\/[^/]+\/notes$/);
  await page.evaluate((value) => {
    sessionStorage.setItem("inkloom-e2e-email", value);
  }, email);
}

async function createScratchNote(page: Page, title: string) {
  await page
    .getByRole("main")
    .getByRole("button", { name: "新建随记" })
    .click();
  await page.getByRole("dialog").getByLabel("文档标题").fill(title);
  await page.getByRole("button", { name: "创建" }).click();
  await expect(page).toHaveURL(/\/notes\/[^/]+$/);
}

function workspaceIdFromUrl(page: Page) {
  return /\/workspaces\/([^/]+)/.exec(new URL(page.url()).pathname)?.[1] ?? "";
}

function documentIdFromUrl(page: Page) {
  return /\/notes\/([^/]+)$/.exec(new URL(page.url()).pathname)?.[1] ?? "";
}

function testEmail(page: Page): Promise<string> {
  return page.evaluate(
    () => sessionStorage.getItem("inkloom-e2e-email") ?? ""
  );
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth
  }));
  expect(overflow.content).toBeLessThanOrEqual(overflow.viewport);
}
