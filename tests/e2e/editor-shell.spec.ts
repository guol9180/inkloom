import { expect, test, type Page } from "@playwright/test";

test("uses one command registry for toolbar, slash menu and shortcuts", async ({
  page
}) => {
  await openScratchNote(page);
  const editor = page.getByLabel("Markdown 正文");
  await expect(editor).toBeVisible();

  await editor.click();
  await page.keyboard.type("快捷标题");
  await page.getByRole("button", { name: "一级标题" }).click();
  await expect(
    page.locator(".ProseMirror h1").filter({ hasText: "快捷标题" })
  ).toBeVisible();

  await page.keyboard.press("Control+End");
  await page.keyboard.press("Enter");
  await page.keyboard.press("/");
  await expect(page.getByText("插入内容")).toBeVisible();
  await expect(page.getByRole("button", { name: "表格" }).last()).toBeVisible();
  await page.getByRole("button", { name: "引用" }).last().click();
  await expect(page.locator(".ProseMirror blockquote")).toBeVisible();

  await page.keyboard.press("Control+j");
  await expect(page.getByPlaceholder("搜索")).toBeFocused();

  const handles = page.locator('[aria-label^="块 "]');
  await expect(handles.first()).toHaveText("⠿");
  expect(await handles.count()).toBeGreaterThanOrEqual(2);
});

test("shows selection tools and opens the link command with Ctrl+K", async ({
  page
}) => {
  await openScratchNote(page);
  const editor = page.getByLabel("Markdown 正文");
  await editor.click();
  await page.keyboard.type("选择这段文字");

  await page.locator(".ProseMirror").evaluate((root) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const node = walker.nextNode();
    if (!node) return;
    const range = document.createRange();
    range.selectNodeContents(node);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  });
  await expect(page.getByRole("toolbar", { name: "选区格式" })).toBeVisible();

  await page.keyboard.press("Control+k");
  await expect(page.getByRole("dialog")).toContainText("添加链接");
  await page.getByLabel("链接地址").fill("https://example.com");
  await page.getByRole("button", { name: "添加链接" }).click();
  await expect(
    page.locator('.ProseMirror a[href="https://example.com"]')
  ).toContainText("选择这段文字");
});

test("reorders blocks from the single-character gutter handle", async ({
  page
}) => {
  await openScratchNote(page);
  const editor = page.getByLabel("Markdown 正文");
  await editor.click();
  await page.keyboard.type("第一块");
  await page.keyboard.press("Enter");
  await page.keyboard.type("第二块");

  const handles = page.locator('[aria-label^="块 "]');
  expect(await handles.count()).toBeGreaterThanOrEqual(2);
  const firstHandle = await handles.nth(0).boundingBox();
  const secondHandle = await handles.nth(1).boundingBox();
  expect(firstHandle).not.toBeNull();
  expect(secondHandle).not.toBeNull();
  await page.mouse.move(
    firstHandle!.x + firstHandle!.width / 2,
    firstHandle!.y + firstHandle!.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    secondHandle!.x + secondHandle!.width / 2,
    secondHandle!.y + secondHandle!.height / 2,
    { steps: 8 }
  );
  await page.mouse.up();
  await expect
    .poll(() => page.locator(".ProseMirror").innerText())
    .toMatch(/^第二块\s+第一块/);

  await handles.first().click();
  await expect(page.getByRole("menuitem", { name: "复制此块" })).toBeVisible();
});

async function openScratchNote(page: Page) {
  const email = `editor-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}@inkloom.local`;
  await page.goto("/register");
  await page.getByLabel("称呼").fill("编辑器验收");
  await page.getByLabel("邮箱").fill(email);
  await page.getByLabel("密码").fill("review-password");
  await page.getByRole("button", { name: "创建并进入" }).click();
  await expect(page).toHaveURL(/\/workspaces\/[^/]+\/notes$/);
  await page
    .getByRole("main")
    .getByRole("button", { name: "新建随记" })
    .click();
  await page.getByRole("dialog").getByLabel("文档标题").fill("编辑器验收");
  await page.getByRole("button", { name: "创建" }).click();
  await expect(page).toHaveURL(/\/notes\/[^/]+$/);
}
