import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZbS8AAAAASUVORK5CYII=",
  "base64"
);

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
  await page.keyboard.press("Control+Home");
  await editor.evaluate((root) => {
    root.closest<HTMLElement>(".overflow-y-auto")?.scrollTo({ top: 0 });
  });
  await page.waitForTimeout(100);

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
  const saveRequest = page.waitForRequest(
    (request) => {
      if (
        request.method() !== "PUT" ||
        !/\/api\/workspaces\/[^/]+\/documents\/[^/]+$/.test(
          new URL(request.url()).pathname
        )
      ) {
        return false;
      }
      const markdown = String(
        (request.postDataJSON() as { markdown?: unknown }).markdown ?? ""
      );
      return markdown.includes("部署说明") && markdown.includes("部署步骤");
    }
  );
  await toggle.locator("summary").click();
  await expect(toggle).not.toHaveAttribute("open", "");

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

test("edits Mermaid source beside a live preview and restores it", async ({
  page
}) => {
  await openScratchNote(page);
  await page.getByLabel("Markdown 正文").click();

  await page.getByRole("button", { name: "Mermaid 图表" }).click();
  const diagram = page.locator(".inkloom-mermaid-view").last();
  await expect(diagram).toBeVisible();
  await expect(
    diagram.locator(".inkloom-mermaid-svg svg").first()
  ).toBeVisible({ timeout: 15_000 });
  const source = diagram.getByLabel("Mermaid 源码");
  await expect(source).toContainText("A[开始]");

  const desktopColumns = await diagram
    .locator(".inkloom-mermaid-workspace")
    .evaluate((element) =>
      getComputedStyle(element).gridTemplateColumns.split(" ").filter(Boolean)
        .length
    );
  expect(desktopColumns).toBe(2);

  await source.click();
  await page.keyboard.press("Control+A");
  await page.keyboard.type("flowchart LR\n  A[开始] -->");
  await expect(diagram.getByRole("status")).toBeVisible({ timeout: 15_000 });
  await expect(source).toContainText("flowchart LR");

  const saveRequest = page.waitForRequest((request) => {
    if (
      request.method() !== "PUT" ||
      !/\/api\/workspaces\/[^/]+\/documents\/[^/]+$/.test(
        new URL(request.url()).pathname
      )
    ) {
      return false;
    }
    const markdown = String(
      (request.postDataJSON() as { markdown?: unknown }).markdown ?? ""
    );
    return (
      markdown.includes("```mermaid") &&
      markdown.includes("A[开始] --> B[审核]")
    );
  });

  await page.keyboard.press("Control+A");
  await page.keyboard.type("flowchart LR\n  A[开始] --> B[审核]");
  await expect(diagram.locator(".inkloom-mermaid-svg")).toContainText("审核", {
    timeout: 15_000
  });

  await diagram.getByRole("button", { name: "全屏编辑图表" }).click();
  await expect(
    page.locator(".inkloom-mermaid-panel.is-fullscreen")
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(diagram.locator(".inkloom-mermaid-panel")).not.toHaveClass(
    /is-fullscreen/
  );

  const request = await saveRequest;
  const markdown = String(
    (request.postDataJSON() as { markdown?: unknown }).markdown ?? ""
  );
  expect(markdown).toContain("```mermaid");
  expect(markdown).not.toContain("inkloom_mermaid");

  await page.reload();
  const restored = page.locator(".inkloom-mermaid-view").last();
  await expect(restored.getByLabel("Mermaid 源码")).toContainText(
    "A[开始] --> B[审核]"
  );
  await expect(
    restored.locator(".inkloom-mermaid-svg svg").first()
  ).toBeVisible({ timeout: 15_000 });

  await page.setViewportSize({ width: 320, height: 720 });
  await page.waitForTimeout(250);
  const mobileColumns = await restored
    .locator(".inkloom-mermaid-workspace")
    .evaluate((element) =>
      getComputedStyle(element).gridTemplateColumns.split(" ").filter(Boolean)
        .length
    );
  expect(mobileColumns).toBe(1);
  const overflow = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth
  }));
  expect(overflow.content).toBeLessThanOrEqual(overflow.viewport);
});

test("draws an Excalidraw scene, saves assets and recovers a snapshot", async ({
  page
}) => {
  await openScratchNote(page);
  await page.getByLabel("Markdown 正文").click();
  await page.getByRole("button", { name: "Excalidraw 画布" }).click();

  const dialog = page.getByRole("dialog", { name: "Excalidraw 画布" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".excalidraw")).toBeVisible({
    timeout: 20_000
  });
  await drawExcalidrawRectangle(page);

  const markdownSave = page.waitForRequest((request) => {
    if (
      request.method() !== "PUT" ||
      !/\/api\/workspaces\/[^/]+\/documents\/[^/]+$/.test(
        new URL(request.url()).pathname
      )
    ) {
      return false;
    }
    const markdown = String(
      (request.postDataJSON() as { markdown?: unknown }).markdown ?? ""
    );
    return (
      markdown.includes("<!-- inkloom:canvas") &&
      markdown.includes(".excalidraw") &&
      markdown.includes(".svg")
    );
  });
  await page.getByRole("button", { name: "保存并关闭" }).click();
  await expect(
    page.getByRole("dialog", { name: "Excalidraw 画布" })
  ).toBeHidden();

  const request = await markdownSave;
  const markdown = String(
    (request.postDataJSON() as { markdown?: unknown }).markdown ?? ""
  );
  expect(markdown).toContain("<!-- inkloom:canvas");
  expect(markdown).toMatch(/scene: assets\/[a-f0-9]{64}\.excalidraw/);
  expect(markdown).toMatch(/!\[.*\]\(assets\/[a-f0-9]{64}\.svg\)/);
  expect(markdown).not.toContain('"elements"');

  const canvasCard = page.locator(".inkloom-canvas-view").last();
  await expect(canvasCard.locator("img")).toBeVisible({ timeout: 15_000 });
  await expect(canvasCard.locator("img")).toHaveAttribute(
    "src",
    /\/assets\/[a-f0-9]{64}$/
  );

  await canvasCard.getByRole("button", { name: "编辑画布" }).click();
  await expect(dialog.locator(".excalidraw")).toBeVisible({
    timeout: 20_000
  });
  await drawExcalidrawRectangle(page);
  await page.waitForTimeout(2_300);
  await dialog.getByRole("button", { name: "稍后继续" }).click();
  await expect(dialog).toBeHidden();
  await canvasCard.getByRole("button", { name: "编辑画布" }).click();
  await expect(dialog.getByText(/已恢复本机临时快照/)).toBeVisible({
    timeout: 20_000
  });
  const snapshotSave = page.waitForRequest((request) => {
    if (
      request.method() !== "PUT" ||
      !/\/api\/workspaces\/[^/]+\/documents\/[^/]+$/.test(
        new URL(request.url()).pathname
      )
    ) {
      return false;
    }
    return String(
      (request.postDataJSON() as { markdown?: unknown }).markdown ?? ""
    ).includes("<!-- inkloom:canvas");
  });
  await dialog.getByRole("button", { name: "保存并关闭" }).click();
  await snapshotSave;
  await expect(dialog).toBeHidden();

  await page.reload();
  const restored = page.locator(".inkloom-canvas-view").last();
  await expect(restored).toBeVisible();
  await expect(restored.locator("img")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".excalidraw")).toHaveCount(0);

  await page.setViewportSize({ width: 320, height: 720 });
  await page.waitForTimeout(250);
  const overflow = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth
  }));
  expect(overflow.content).toBeLessThanOrEqual(overflow.viewport);
});

test("migrates legacy canvas extensions without deleting the source data", async ({
  page
}) => {
  const currentUrl = await openScratchNote(page);
  const workspaceId = decodeURIComponent(
    new URL(currentUrl).pathname.split("/")[2]
  );
  const created = await page.evaluate(
    async ({ workspaceId }) => {
      const response = await fetch(
        `http://127.0.0.1:3001/api/workspaces/${encodeURIComponent(
          workspaceId
        )}/documents`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path: "旧画布迁移.md",
            title: "旧画布迁移",
            markdown: "# 旧画布迁移\n",
            extensions: {
              canvas: {
                title: "旧系统边界",
                elements: [
                  {
                    id: "legacy-rectangle",
                    type: "rectangle",
                    x: 80,
                    y: 80,
                    width: 220,
                    height: 120,
                    strokeColor: "#26332d",
                    backgroundColor: "#edf3ef"
                  }
                ]
              }
            }
          })
        }
      );
      if (!response.ok) throw new Error(await response.text());
      return (await response.json()) as {
        document: { meta: { id: string } };
      };
    },
    { workspaceId }
  );

  const migratedSave = page.waitForRequest((request) => {
    if (
      request.method() !== "PUT" ||
      !/\/api\/workspaces\/[^/]+\/documents\/[^/]+$/.test(
        new URL(request.url()).pathname
      )
    ) {
      return false;
    }
    const markdown = String(
      (request.postDataJSON() as { markdown?: unknown }).markdown ?? ""
    );
    return (
      markdown.includes("<!-- inkloom:canvas") &&
      markdown.includes("旧系统边界")
    );
  });
  await page.goto(
    `/workspaces/${encodeURIComponent(workspaceId)}/notes/${encodeURIComponent(
      created.document.meta.id
    )}`
  );
  await expect(page.locator(".inkloom-canvas-view").last()).toBeVisible({
    timeout: 30_000
  });
  await migratedSave;

  const persisted = await page.evaluate(
    async ({ workspaceId, documentId }) => {
      const response = await fetch(
        `http://127.0.0.1:3001/api/workspaces/${encodeURIComponent(
          workspaceId
        )}/documents/${encodeURIComponent(documentId)}`,
        { credentials: "include" }
      );
      if (!response.ok) throw new Error(await response.text());
      return (await response.json()) as {
        document: {
          markdown: string;
          extensions?: { canvas?: { elements?: unknown[] } };
        };
      };
    },
    { workspaceId, documentId: created.document.meta.id }
  );
  expect(persisted.document.markdown).toContain("<!-- inkloom:canvas");
  expect(persisted.document.extensions?.canvas?.elements).toHaveLength(1);
});

test("uploads images and attachments and exports a portable zip", async ({
  page
}) => {
  await openScratchNote(page);
  const editor = page.getByLabel("Markdown 正文");
  await expect(editor).toBeVisible();
  let failedUploads = 0;
  const assetRoute = /\/api\/workspaces\/[^/]+\/assets$/;
  await page.route(assetRoute, async (route) => {
    if (failedUploads === 0) {
      failedUploads += 1;
      await route.abort("failed");
      return;
    }
    await route.continue();
  });

  const imageInput = page
    .locator('.product-markdown-editor input[type="file"]')
    .first();
  await imageInput.setInputFiles({
    name: "diagram.png",
    mimeType: "image/png",
    buffer: ONE_PIXEL_PNG
  });
  await expect(page.getByText("网络连接中断，资产上传失败。")).toBeVisible();
  await page.unroute(assetRoute);
  await page.getByRole("button", { name: "重试上传" }).click();
  const imageBlock = page.locator(".milkdown-image-block").last();
  await expect(imageBlock).toBeVisible();
  await expect(imageBlock.locator("img")).toHaveAttribute(
    "src",
    /#align=center/
  );
  await expect(page.getByText("已插入文档")).toBeHidden({ timeout: 4_000 });

  await page.locator('[aria-label^="块 "]').first().click();
  await page.getByRole("menuitem", { name: "图片左对齐" }).click();
  await expect(imageBlock.locator("img")).toHaveAttribute(
    "src",
    /#align=left/
  );
  const originalImageSource = await imageBlock.locator("img").getAttribute("src");
  await page.locator('[aria-label^="块 "]').first().click();
  await page.getByRole("menuitem", { name: "替换图片" }).click();
  await imageInput.setInputFiles({
    name: "diagram-2.png",
    mimeType: "image/png",
    buffer: Buffer.concat([ONE_PIXEL_PNG, Buffer.from([0])])
  });
  await expect
    .poll(async () => imageBlock.locator("img").getAttribute("src"))
    .not.toBe(originalImageSource);
  await expect(imageBlock.locator("img")).toHaveAttribute("alt", "diagram-2");
  await page.locator('[aria-label^="块 "]').first().click();
  await page.getByRole("menuitem", { name: "图片左对齐" }).click();

  const attachmentInput = page
    .locator('.product-markdown-editor input[type="file"]')
    .nth(1);
  await attachmentInput.setInputFiles({
    name: "说明.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("attachment content")
  });
  const attachment = page.locator(".inkloom-file-block").last();
  await expect(attachment).toContainText("说明.txt");
  await expect(attachment.locator("a")).toHaveAttribute("download", "说明.txt");

  const autosave = page.waitForRequest((request) => {
    if (
      request.method() !== "PUT" ||
      !/\/api\/workspaces\/[^/]+\/documents\/[^/]+$/.test(
        new URL(request.url()).pathname
      )
    ) {
      return false;
    }
    const markdown = String(
      (request.postDataJSON() as { markdown?: unknown }).markdown ?? ""
    );
    return (
      markdown.includes("inkloom:file") && markdown.includes("#align=left")
    );
  });
  await autosave;

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("编辑器验收.zip");
  const archive = readFileSync(await download.path());
  expect(archive.includes(Buffer.from("编辑器验收.md"))).toBe(true);
  expect(archive.includes(Buffer.from("assets/"))).toBe(true);
  expect(archive.includes(Buffer.from("inkloom:file"))).toBe(true);

  await page.reload();
  await expect(page.locator(".milkdown-image-block img")).toHaveAttribute(
    "src",
    /#align=left/
  );
  await expect(page.locator(".inkloom-file-block")).toContainText("说明.txt");
  await page
    .locator(".milkdown-image-block img")
    .dblclick();
  await expect(
    page.getByRole("dialog", { name: "图片预览" })
  ).toBeVisible();
});

test("pastes and drops image and attachment files", async ({ page }) => {
  await openScratchNote(page);
  await expect(page.getByLabel("Markdown 正文")).toBeVisible();
  await page.locator(".product-markdown-editor").evaluate(
    (root, base64) => {
      const bytes = Uint8Array.from(atob(base64), (char) =>
        char.charCodeAt(0)
      );
      const transfer = new DataTransfer();
      transfer.items.add(
        new File([bytes], "pasted.png", { type: "image/png" })
      );
      root.dispatchEvent(
        new ClipboardEvent("paste", {
          bubbles: true,
          cancelable: true,
          clipboardData: transfer
        })
      );
    },
    ONE_PIXEL_PNG.toString("base64")
  );
  await expect(page.locator(".milkdown-image-block").last()).toBeVisible();

  await page.locator(".product-markdown-editor").evaluate((root) => {
    const transfer = new DataTransfer();
    transfer.items.add(
      new File(["dropped attachment"], "dropped.txt", {
        type: "text/plain"
      })
    );
    root.dispatchEvent(
      new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer: transfer
      })
    );
  });
  await expect(page.locator(".inkloom-file-block").last()).toContainText(
    "dropped.txt"
  );
});

test("shows upload progress and supports cancellation", async ({ page }) => {
  await openScratchNote(page);
  const assetRoute = /\/api\/workspaces\/[^/]+\/assets$/;
  await page.route(assetRoute, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    await route.continue().catch(() => undefined);
  });
  const imageInput = page
    .locator('.product-markdown-editor input[type="file"]')
    .first();
  await imageInput.setInputFiles({
    name: "cancel-me.png",
    mimeType: "image/png",
    buffer: ONE_PIXEL_PNG
  });
  await expect(page.getByText(/正在上传 · \d+%/)).toBeVisible();
  await page.getByRole("button", { name: "取消上传" }).click();
  await expect(page.getByText("已取消")).toBeVisible();
  await expect(page.locator(".milkdown-image-block")).toHaveCount(0);
  await page.unroute(assetRoute);
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
  const saveRequest = page.waitForRequest((request) => {
    if (
      request.method() !== "PUT" ||
      !/\/api\/workspaces\/[^/]+\/documents\/[^/]+$/.test(
        new URL(request.url()).pathname
      )
    ) {
      return false;
    }
    return String(
      (request.postDataJSON() as { markdown?: unknown }).markdown ?? ""
    ).includes("const ready = true;");
  });
  await code.click();
  await page.keyboard.type("const ready = true;");

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

async function openScratchNote(page: Page): Promise<string> {
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
  return page.url();
}

async function drawExcalidrawRectangle(page: Page) {
  const canvas = page.locator(".excalidraw__canvas.interactive").last();
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.click(
    box!.x + box!.width * 0.72,
    box!.y + box!.height * 0.72
  );
  await page.keyboard.press("r");
  const startX = box!.x + Math.max(120, box!.width * 0.32);
  const startY = box!.y + Math.max(120, box!.height * 0.32);
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 180, startY + 110, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(250);
}
