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

test("edits structured blocks and restores them after saving", async ({
  page
}) => {
  await openScratchNote(page);
  const editor = page.getByLabel("Markdown 正文");
  await editor.click();
  await page.keyboard.type("发布说明");
  await page.getByRole("button", { name: "四级标题", exact: true }).click();
  await expect(
    page.locator(".ProseMirror h4").filter({ hasText: "发布说明" })
  ).toBeVisible();

  await page.keyboard.press("Control+End");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "表格", exact: true }).click();
  const table = page.locator(".milkdown-table-block").last();
  await expect(table).toBeVisible();
  const tableContent = table.locator("table.children");
  await expect(tableContent.locator("th")).toHaveCount(3);
  await tableContent.locator("th").first().click();
  await page.keyboard.type("能力");
  await page.keyboard.press("Tab");
  await page.keyboard.type("状态");
  const rowCount = await tableContent.locator("tr").count();
  const columnCount = await tableContent.locator("th").count();
  await page.getByRole("button", { name: "增加行" }).click();
  await expect(tableContent.locator("tr")).toHaveCount(rowCount + 1);
  await tableContent.locator("tr").nth(1).locator("td").first().click();
  await page.getByRole("button", { name: "删除行" }).click();
  await expect(tableContent.locator("tr")).toHaveCount(rowCount);
  await tableContent.locator("tr").nth(1).locator("td").last().click();
  await page.getByRole("button", { name: "增加列" }).click();
  await expect(tableContent.locator("th")).toHaveCount(columnCount + 1);
  await tableContent.locator("tr").nth(1).locator("td").last().click();
  await page.getByRole("button", { name: "删除列" }).click();
  await expect(tableContent.locator("th")).toHaveCount(columnCount);
  await tableContent.locator("th").first().click();
  await page.getByRole("button", { name: "居中对齐" }).click();
  await expect(tableContent.locator("th").first()).toHaveCSS(
    "text-align",
    "center"
  );

  await page.keyboard.press("Control+End");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "公式", exact: true }).click();
  await expect(page.locator(".milkdown-code-block").last()).toBeVisible();

  await page.keyboard.press("Control+End");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "提示块", exact: true }).click();
  const callout = page.locator('blockquote[data-callout="note"]').last();
  await expect(callout).toBeVisible();
  await page.keyboard.type("发布前请先完成备份。");
  await expect(callout).toContainText("发布前请先完成备份。");

  await page.keyboard.press("Control+End");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "折叠块", exact: true }).click();
  const toggle = page.locator("details[data-inkloom-toggle]").last();
  await expect(toggle).toBeVisible();
  await expect(toggle.locator("summary")).toHaveText("折叠内容");
  await page.keyboard.type("部署步骤保留在这里。");

  const blockHandles = page.locator('[aria-label^="块 "]');
  await blockHandles.nth((await blockHandles.count()) - 2).click();
  await page.getByRole("menuitem", { name: "重命名折叠标题" }).click();
  await page
    .getByRole("dialog", { name: "折叠标题" })
    .getByRole("textbox", { name: "标题" })
    .fill("部署说明");
  await page.getByRole("button", { name: "保存标题" }).click();
  await expect(toggle.locator("summary")).toHaveText("部署说明");
  await toggle.locator("summary").click();
  await expect(toggle).not.toHaveAttribute("open", "");

  const saveRequest = page.waitForRequest(
    (request) =>
      request.method() === "PUT" &&
      /\/api\/workspaces\/[^/]+\/documents\/[^/]+$/.test(
        new URL(request.url()).pathname
      )
  );
  await page.getByRole("button", { name: "保存", exact: true }).click();
  const request = await saveRequest;
  const markdown = String(
    (request.postDataJSON() as { markdown?: unknown }).markdown ?? ""
  );
  expect(markdown).toContain("#### 发布说明");
  expect(markdown).toMatch(/\|\s+能力\s+\|\s+状态\s+\|/);
  expect(markdown).toContain("$$");
  expect(markdown).toContain("> [!NOTE]");
  expect(markdown).toContain("<details>");
  expect(markdown).toContain("<summary>部署说明</summary>");
  expect(markdown).toContain("</details>");

  await page.reload();
  await expect(page.locator(".ProseMirror h4")).toContainText("发布说明");
  await expect(
    page.locator(".milkdown-table-block table.children th").first()
  ).toContainText("能力");
  await expect(
    page.locator('blockquote[data-callout="note"]')
  ).toContainText("发布前请先完成备份。");
  await expect(
    page.locator("details[data-inkloom-toggle] summary")
  ).toHaveText("部署说明");
  await page.waitForTimeout(500);
  await expect(
    page.locator(".milkdown-table-block table.children th").first()
  ).toContainText("能力");
  await page.locator(".milkdown-table-block table.children th").first().click();
  await page.mouse.move(1380, 930);
  await page.waitForTimeout(220);
  await page.screenshot({
    path: "test-results/ui-review/t30-blocks-1440x960.png"
  });
  await page.setViewportSize({ width: 320, height: 720 });
  await page.waitForTimeout(250);
  await page
    .getByRole("button", { name: "关闭导航" })
    .dispatchEvent("click");
  const overflow = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth
  }));
  expect(overflow.content).toBeLessThanOrEqual(overflow.viewport);
  await page.screenshot({
    path: "test-results/ui-review/t30-blocks-320x720.png"
  });
});

test("pastes spreadsheet data into the current table", async ({ page }) => {
  await openScratchNote(page);
  const editor = page.getByLabel("Markdown 正文");
  await editor.click();
  await page.getByRole("button", { name: "表格", exact: true }).click();
  const table = page.locator(".milkdown-table-block").last();
  const tableContent = table.locator("table.children");
  await expect(tableContent).toBeVisible();
  await tableContent.locator("th").first().click();
  await page.locator(".ProseMirror").evaluate((root) => {
    const clipboard = new DataTransfer();
    clipboard.setData("text/plain", "名称\t状态\nAPI\t完成\n草稿\t进行中");
    root.dispatchEvent(
      new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData: clipboard
      })
    );
  });
  await expect(tableContent.locator("th").first()).toContainText("名称");
  await expect(tableContent.locator("th").nth(1)).toContainText("状态");
  await expect(tableContent.locator("tr")).toHaveCount(3);
  await expect(tableContent.locator("tr").nth(1)).toContainText("API");
  await expect(tableContent.locator("tr").nth(2)).toContainText("草稿");

  await tableContent.locator("th").first().click();
  await page.locator(".ProseMirror").evaluate((root) => {
    const clipboard = new DataTransfer();
    clipboard.setData(
      "text/html",
      "<table><tr><th>模块</th><th>负责人</th></tr><tr><td>编辑器</td><td>小林</td></tr></table>"
    );
    root.dispatchEvent(
      new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData: clipboard
      })
    );
  });
  await expect(tableContent.locator("th").first()).toContainText("模块");
  await expect(tableContent.locator("th").nth(1)).toContainText("负责人");
  await expect(tableContent.locator("tr").nth(1)).toContainText("编辑器");
});

test("round-trips quote, task and code blocks", async ({ page }) => {
  await openScratchNote(page);
  const editor = page.getByLabel("Markdown 正文");
  await editor.click();
  await page.keyboard.type("引用第一行");
  await page.getByRole("button", { name: "引用", exact: true }).click();
  await expect(
    page.locator(".ProseMirror blockquote").filter({ hasText: "引用第一行" })
  ).toBeVisible();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.keyboard.type("任务项");
  await page.keyboard.press("Control+Shift+9");
  const task = page
    .locator(".milkdown-list-item-block li")
    .filter({ hasText: "任务项" });
  await expect(task).toContainText("任务项");
  await expect(task.locator(".label.unchecked")).toBeVisible();

  await page.keyboard.press("Control+End");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "代码块", exact: true }).click();
  const code = page.locator(".milkdown-code-block .cm-content").last();
  await expect(code).toBeVisible();
  await code.click();
  await page.keyboard.type("const ready = true;");

  const saveRequest = page.waitForRequest(
    (request) =>
      request.method() === "PUT" &&
      /\/api\/workspaces\/[^/]+\/documents\/[^/]+$/.test(
        new URL(request.url()).pathname
      )
  );
  await page.getByRole("button", { name: "保存", exact: true }).click();
  const markdown = String(
    ((await saveRequest).postDataJSON() as { markdown?: unknown }).markdown ??
      ""
  );
  expect(markdown).toContain("> 引用第一行");
  expect(markdown).toMatch(/^[*-] \[ \] 任务项$/m);
  expect(markdown).toContain("```");
  expect(markdown).toContain("const ready = true;");

  await page.reload();
  await expect(page.locator(".ProseMirror blockquote")).toContainText(
    "引用第一行"
  );
  await expect(
    page
      .locator(".milkdown-list-item-block li")
      .filter({ hasText: "任务项" })
      .locator(".label.unchecked")
  ).toBeVisible();
  await expect(page.locator(".milkdown-code-block .cm-content")).toContainText(
    "const ready = true;"
  );
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
