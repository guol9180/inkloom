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
    Object.keys(localStorage).filter((key) => key.startsWith("inkloom.draft."))
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
  await expect(page.getByLabel("Markdown 正文")).toContainText("真实保存验收");
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

test("preserves untouched Markdown source slices while editing", async ({
  page
}) => {
  await registerUser(page);
  const workspaceId = workspaceIdFromUrl(page);
  const source = [
    "---",
    "title: Keep this frontmatter",
    "unknown_field: keep",
    "---",
    "",
    "# 源片段测试",
    "",
    "普通段落。",
    "",
    "```unknown-language",
    "raw syntax that must survive",
    "```",
    "",
    "<!-- comment that must survive -->",
    "",
    "[ref]: https://example.com",
    ""
  ].join("\n");
  const createResponse = await page.request.post(
    `${API_ORIGIN}/api/workspaces/${workspaceId}/documents`,
    {
      data: {
        path: "source-slice.md",
        title: "源片段测试",
        markdown: source
      }
    }
  );
  expect(createResponse.ok()).toBe(true);
  const created = (await createResponse.json()) as {
    document: { meta: { id: string } };
  };
  await page.goto(
    `/workspaces/${workspaceId}/notes/${created.document.meta.id}`
  );

  const editor = page.getByLabel("Markdown 正文");
  await expect(editor).toBeVisible();
  const save = page.waitForResponse(
    (response) =>
      response.url().includes(`/documents/${created.document.meta.id}`) &&
      response.request().method() === "PUT"
  );
  await editor.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type(" CHANGED");
  const saved = (await (await save).json()) as {
    document: { markdown: string };
  };

  expect(saved.document.markdown).toContain(
    "---\ntitle: Keep this frontmatter\nunknown_field: keep\n---"
  );
  expect(saved.document.markdown).toContain(
    "```unknown-language\nraw syntax that must survive\n```"
  );
  expect(saved.document.markdown).toContain("[ref]: https://example.com");
  expect(saved.document.markdown).toContain("CHANGED");
});

test("records recent documents without changing content revisions", async ({
  page
}) => {
  await registerUser(page);
  const workspaceId = workspaceIdFromUrl(page);
  const create = async (title: string) => {
    const response = await page.request.post(
      `${API_ORIGIN}/api/workspaces/${workspaceId}/documents`,
      {
        data: {
          path: `${title}.md`,
          title,
          markdown: `# ${title}\n`
        }
      }
    );
    expect(response.ok()).toBe(true);
    return (await response.json()) as {
      document: { meta: { id: string; revision: number } };
    };
  };
  const first = await create("最近甲");
  const second = await create("最近乙");

  const firstOpen = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/documents/${first.document.meta.id}/open`) &&
      response.request().method() === "POST"
  );
  await page.goto(`/workspaces/${workspaceId}/notes/${first.document.meta.id}`);
  await firstOpen;

  const secondOpen = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/documents/${second.document.meta.id}/open`) &&
      response.request().method() === "POST"
  );
  await page.goto(
    `/workspaces/${workspaceId}/notes/${second.document.meta.id}`
  );
  await secondOpen;

  const recentResponse = await page.request.get(
    `${API_ORIGIN}/api/workspaces/${workspaceId}/notes/recent`
  );
  expect(recentResponse.ok()).toBe(true);
  const recent = (await recentResponse.json()) as {
    documents: Array<{ title: string }>;
  };
  expect(recent.documents.map((item) => item.title)).toEqual([
    "最近乙",
    "最近甲"
  ]);
  const firstReloaded = await page.request.get(
    `${API_ORIGIN}/api/workspaces/${workspaceId}/documents/${first.document.meta.id}`
  );
  const firstSnapshot = (await firstReloaded.json()) as {
    document: { meta: { revision: number } };
  };
  expect(firstSnapshot.document.meta.revision).toBe(
    first.document.meta.revision
  );
});

test("recovers an IndexedDB draft after a failed autosave", async ({
  page
}) => {
  await registerUser(page);
  await createScratchNote(page);
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
  await createScratchNote(page);
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
  await expect(page.getByLabel("Markdown 正文")).toContainText("本地冲突内容");
});

test("allows only one tab to edit the same document", async ({ page }) => {
  await registerUser(page);
  await createScratchNote(page);
  const secondPage = await page.context().newPage();
  await secondPage.goto(page.url());
  await expect(
    secondPage.getByText("此文档正在另一个标签页编辑")
  ).toBeVisible();
  await expect(secondPage.getByLabel("Markdown 正文")).toHaveAttribute(
    "aria-readonly",
    "true"
  );
  await expect(
    secondPage.getByRole("toolbar", { name: "文档格式" })
  ).toHaveCount(0);

  await page.close();
  await secondPage.bringToFront();
  await expect(secondPage.getByLabel("Markdown 正文")).toHaveAttribute(
    "aria-readonly",
    "false",
    { timeout: 8_000 }
  );
  await secondPage.close();
});

test("skips autosave when content returns to the persisted hash", async ({
  page
}) => {
  await registerUser(page);
  await createScratchNote(page);
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

test("keeps edits made while a successful autosave is in flight", async ({
  page
}) => {
  await registerUser(page);
  await createScratchNote(page);

  const routePattern = /\/api\/workspaces\/[^/]+\/documents\/[^/]+$/;
  let putCount = 0;
  let signalFirstResponseFetched = () => {};
  let releaseFirstResponse = () => {};
  const firstResponseFetched = new Promise<void>((resolve) => {
    signalFirstResponseFetched = resolve;
  });
  const firstResponseGate = new Promise<void>((resolve) => {
    releaseFirstResponse = resolve;
  });
  await page.route(routePattern, async (route) => {
    if (route.request().method() !== "PUT") {
      await route.continue();
      return;
    }
    putCount += 1;
    if (putCount > 1) {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    signalFirstResponseFetched();
    await firstResponseGate;
    await route.fulfill({ response });
  });

  const editor = page.getByLabel("Markdown 正文");
  await editor.click();
  await page.keyboard.type("第一次自动保存");
  await firstResponseFetched;

  await page.keyboard.type("，保存期间继续输入");
  const secondSave = page.waitForRequest(
    (request) =>
      request.method() === "PUT" &&
      routePattern.test(new URL(request.url()).pathname)
  );
  releaseFirstResponse();
  await secondSave;
  await expect(page.getByText(/已保存/).first()).toBeVisible({
    timeout: 15_000
  });

  await page.reload();
  await expect(page.getByLabel("Markdown 正文")).toContainText(
    "第一次自动保存，保存期间继续输入"
  );
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
  await page.getByRole("dialog").getByLabel("知识库名称").fill("产品资料");
  await page.getByRole("button", { name: "创建" }).click();
  await expect(page).toHaveURL(/\/knowledge\/[^/]+$/);
  await expect(page.getByRole("heading", { name: "产品资料" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "产品资料" })).toBeVisible();
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

async function createScratchNote(page: Page) {
  await page
    .getByRole("main")
    .getByRole("button", { name: "新建随记" })
    .click();
  await expect(page).toHaveURL(/\/notes\/[^/]+$/);
}

function workspaceIdFromUrl(page: Page) {
  return /\/workspaces\/([^/]+)/.exec(new URL(page.url()).pathname)?.[1] ?? "";
}

function documentIdFromUrl(page: Page) {
  return /\/notes\/([^/]+)$/.exec(new URL(page.url()).pathname)?.[1] ?? "";
}

function testEmail(page: Page): Promise<string> {
  return page.evaluate(() => sessionStorage.getItem("inkloom-e2e-email") ?? "");
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth
  }));
  expect(overflow.content).toBeLessThanOrEqual(overflow.viewport);
}
