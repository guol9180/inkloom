import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const reviewDirectory = resolve("artifacts", "ui-review");
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

    test("captures responsive workspace states without overflow", async ({
      page
    }) => {
      await mkdir(reviewDirectory, { recursive: true });
      const size = `${viewport.width}x${viewport.height}`;
      await page.goto("/");
      await expect(page.getByRole("tab", { name: "登录" })).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await page.screenshot({
        path: resolve(reviewDirectory, `auth-${size}.png`)
      });

      await registerUser(page);
      await expect(page.getByLabel("文档标题")).toHaveValue("欢迎使用墨织");
      await expectNoHorizontalOverflow(page);
      await page.screenshot({
        path: resolve(reviewDirectory, `workspace-${size}.png`)
      });

      if (viewport.width <= 940) {
        await page.getByRole("button", { name: "打开文件栏" }).click();
        await expect(page.locator(".sidebar")).toHaveClass(/is-open/);
        await waitForDrawer(page, ".sidebar", true);
        await expectNoHorizontalOverflow(page);
        await page.screenshot({
          path: resolve(reviewDirectory, `sidebar-${size}.png`)
        });
        if (viewport.width <= 480) {
          await page.getByRole("button", { name: "版本历史" }).click();
        } else {
          await page.locator(".drawer-scrim.is-sidebar").click();
        }
        await waitForDrawer(page, ".sidebar", false);
      }

      if (viewport.width <= 1240) {
        if (viewport.width > 480) {
          await page.getByRole("button", { name: "切换信息栏" }).click();
        }
        await expect(page.locator(".inspector")).toBeVisible();
        await expectNoHorizontalOverflow(page);
        await page.screenshot({
          path: resolve(reviewDirectory, `inspector-${size}.png`)
        });
        await page
          .locator(".inspector-head")
          .getByRole("button", { name: "关闭信息栏" })
          .click();
      }

      if (viewport.width <= 480) {
        await page.getByRole("button", { name: "更多操作" }).click();
        await expect(page.locator(".document-menu-popover")).toBeVisible();
        await page.screenshot({
          path: resolve(reviewDirectory, `document-menu-${size}.png`)
        });
        await page.getByRole("button", { name: "更多操作" }).click();
      }

      if (viewport.width === 768) {
        await page.getByRole("button", { name: "切换工作区" }).click();
        await page.screenshot({
          path: resolve(reviewDirectory, `workspace-dialog-${size}.png`)
        });
        await page.getByRole("button", { name: "关闭弹窗" }).click();
        await page
          .getByRole("button", { name: /(管理|添加)标签/ })
          .click();
        await page.screenshot({
          path: resolve(reviewDirectory, `tag-dialog-${size}.png`)
        });
        await page.getByRole("button", { name: "关闭弹窗" }).click();
      }

      if (viewport.width === 1024) {
        await page.getByRole("button", { name: "账号设置" }).click();
        await page.screenshot({
          path: resolve(reviewDirectory, `settings-dialog-${size}.png`)
        });
        await page.getByRole("button", { name: "关闭弹窗" }).click();
      }

      if (viewport.width === 1440) {
        await page.getByTitle("阅读模式").click();
        await page.screenshot({
          path: resolve(reviewDirectory, `read-mode-${size}.png`)
        });
        await page.getByTitle("分栏模式").click();
        await page
          .getByRole("button", { name: "画布", exact: true })
          .click();
        await expect(
          page.getByRole("dialog", { name: "Excalidraw 画布" })
        ).toBeVisible();
        await expect(page.locator(".excalidraw")).toBeVisible({
          timeout: 30_000
        });
        await page.screenshot({
          path: resolve(reviewDirectory, `canvas-${size}.png`)
        });
      }
    });
  });
}

async function registerUser(page: Page) {
  const email = `review-${Date.now()}-${Math.random().toString(36).slice(2)}@inkloom.local`;
  await page.getByRole("tab", { name: "创建账号" }).click();
  await page.getByLabel("称呼").fill("界面验收");
  await page.getByLabel("邮箱").fill(email);
  await page.getByLabel("密码").fill("review-password");
  await page.getByRole("button", { name: "创建并进入" }).click();
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth
  }));
  expect(overflow.content, "page should not overflow horizontally").toBeLessThanOrEqual(
    overflow.viewport
  );
}

async function waitForDrawer(
  page: Page,
  selector: string,
  open: boolean
) {
  await page.waitForFunction(
    ({ selector, open }) => {
      const drawer = document.querySelector<HTMLElement>(selector);
      if (!drawer) return false;
      const bounds = drawer.getBoundingClientRect();
      return open ? Math.abs(bounds.left) < 1 : bounds.right <= 1;
    },
    { selector, open }
  );
}
