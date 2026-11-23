import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const reviewDirectory = resolve("test-results", "ui-review");
const viewports = [
  { width: 320, height: 720 },
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 960 },
  { width: 2560, height: 1440 }
] as const;

for (const viewport of viewports) {
  test.describe(`${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });

    test("captures the white application shell without overflow", async ({
      page
    }) => {
      await mkdir(reviewDirectory, { recursive: true });
      const size = `${viewport.width}x${viewport.height}`;
      await page.goto("/login");
      await expect(page.getByRole("tab", { name: "登录" })).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await page.screenshot({
        path: resolve(reviewDirectory, `auth-${size}.png`)
      });

      await registerUser(page);
      await expect(
        page.getByRole("heading", { name: "从一个清晰的想法开始" })
      ).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await page.screenshot({
        path: resolve(reviewDirectory, `empty-notes-${size}.png`)
      });

      await page
        .getByRole("main")
        .getByRole("button", { name: "新建随记" })
        .click();
      const editor = page.getByLabel("Markdown 正文");
      await expect(editor).toBeVisible();
      await editor.click();
      await page.keyboard.type("清晰的内容");
      await page.getByRole("button", { name: "一级标题" }).click();
      await page.keyboard.press("Control+End");
      await page.keyboard.press("Enter");
      await page.keyboard.type("在同一区域继续编辑，格式与内容始终可见。");
      await expectNoHorizontalOverflow(page);
      await page.screenshot({
        path: resolve(reviewDirectory, `editor-${size}.png`)
      });

      if (viewport.width < 1024) {
        await page.getByRole("button", { name: "打开导航" }).click();
        await page.waitForFunction(() => {
          const sidebar = document.querySelector<HTMLElement>("aside");
          return sidebar
            ? Math.abs(sidebar.getBoundingClientRect().left) < 1
            : false;
        });
        await expectNoHorizontalOverflow(page);
        await page.screenshot({
          path: resolve(reviewDirectory, `navigation-${size}.png`)
        });
      }

      await page.getByRole("button", { name: "知识库" }).click();
      await expect(
        page.getByRole("heading", { name: "选择或创建一个知识库" })
      ).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await page.screenshot({
        path: resolve(reviewDirectory, `empty-knowledge-${size}.png`)
      });
    });
  });
}

test.describe("interaction accessibility", () => {
  test.use({
    viewport: { width: 720, height: 480 },
    hasTouch: true
  });

  test("supports touch, keyboard, 200% zoom and reduced motion", async ({
    page
  }) => {
    await page.goto("/login");
    await registerUser(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page
      .getByRole("main")
      .getByRole("button", { name: "新建随记" })
      .tap();
    await expect(page.getByLabel("Markdown 正文")).toBeVisible();

    await page.keyboard.press("Control+j");
    await expect(page.getByPlaceholder("搜索")).toBeFocused();
    await page.locator("aside").getByRole("button", { name: "关闭导航" }).tap();

    const reducedMotion = await page.evaluate(() => {
      const skeleton = document.createElement("span");
      skeleton.className = "skeleton-shimmer";
      document.body.append(skeleton);
      const duration = getComputedStyle(skeleton).animationDuration;
      skeleton.remove();
      return duration;
    });
    expect(Number.parseFloat(reducedMotion)).toBeLessThanOrEqual(0.01);

    await page.getByRole("button", { name: "文档操作" }).tap();
    await page.getByRole("menuitem", { name: "管理标签" }).tap();
    const dialog = page.getByRole("dialog", { name: "管理标签" });
    await expect(dialog).toBeVisible();
    const dialogAnimation = await dialog.evaluate(
      (element) => getComputedStyle(element).animationDuration
    );
    expect(Number.parseFloat(dialogAnimation)).toBeLessThanOrEqual(0.01);
    await dialog.getByRole("button", { name: "取消" }).tap();

    await page.evaluate(() => {
      document.documentElement.style.zoom = "200%";
    });
    await expectNoHorizontalOverflow(page);
  });
});

async function registerUser(page: Page) {
  const email = `review-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}@inkloom.local`;
  await page.getByRole("tab", { name: "创建账号" }).click();
  await page.getByLabel("称呼").fill("界面验收");
  await page.getByLabel("邮箱").fill(email);
  await page.getByLabel("密码").fill("review-password");
  await page.getByRole("button", { name: "创建并进入" }).click();
  await expect(page).toHaveURL(/\/workspaces\/[^/]+\/notes$/);
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth
  }));
  expect(overflow.content).toBeLessThanOrEqual(overflow.viewport);
}
