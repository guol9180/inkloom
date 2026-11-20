import { expect, test, type Page } from "@playwright/test";

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
  await editor.click();
  await page.keyboard.type("真实保存验收");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.keyboard.type("刷新后仍然存在。");
  await expect(editor).toContainText("刷新后仍然存在。");
  const save = page.waitForResponse(
    (response) =>
      response.request().method() === "PUT" &&
      /\/api\/workspaces\/[^/]+\/documents\/[^/]+$/.test(
        new URL(response.url()).pathname
      ) &&
      response.ok()
  );
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await save;

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
