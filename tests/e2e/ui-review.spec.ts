import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";
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
      await expect(page.getByRole("radio", { name: "登录" })).toBeVisible();
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
        const navigation = page.getByRole("dialog", { name: "工作区导航" });
        await expect(navigation).toBeVisible();
        await page.waitForTimeout(600);
        const navigationBox = await navigation.boundingBox();
        expect(navigationBox).not.toBeNull();
        expect(navigationBox!.x).toBeGreaterThanOrEqual(-1);
        const expectedWidth = Math.min(viewport.width * 0.88, 19 * 16);
        expect(navigationBox!.width).toBeGreaterThanOrEqual(expectedWidth - 1);
        await expectNoHorizontalOverflow(page);
        await page.screenshot({
          path: resolve(reviewDirectory, `navigation-${size}.png`)
        });
      }

      await page.getByRole("radio", { name: "知识库" }).click();
      if (viewport.width < 1024) {
        await expect(
          page.getByRole("dialog", { name: "工作区导航" })
        ).toBeHidden();
      }
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

test.describe("mobile sheets", () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true });

  test("uses accessible navigation and bottom-sheet dialogs", async ({
    page
  }) => {
    await page.goto("/login");
    await registerUser(page);
    await page
      .getByRole("main")
      .getByRole("button", { name: "新建随记" })
      .tap();
    await expect(
      page.getByRole("status", { name: /已保存|保存中|待保存/ }).first()
    ).toBeVisible();
    await expectNoSeriousAxeViolations(page);

    const navigationTrigger = page.getByRole("button", { name: "打开导航" });
    await navigationTrigger.tap();
    await expect(
      page.getByRole("dialog", { name: "工作区导航" })
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "工作区导航" })).toBeHidden();
    await expect(navigationTrigger).toBeFocused();

    await page.getByRole("button", { name: "文档操作" }).tap();
    await page.getByRole("menuitem", { name: "管理标签" }).tap();
    const dialog = page.getByRole("dialog", { name: "管理标签" });
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThan(200);
    expect(box!.width).toBeLessThanOrEqual(375);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });
});

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
    await page
      .getByRole("dialog", { name: "工作区导航" })
      .getByRole("button", { name: "关闭导航" })
      .tap();

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

test.describe("automated accessibility", () => {
  test.use({ viewport: { width: 1440, height: 960 } });

  test("has no serious WCAG violations in the core workspace", async ({
    page
  }) => {
    await page.goto("/login");
    await expect(page.getByRole("radio", { name: "登录" })).toBeVisible();
    const password = page.getByLabel("密码", { exact: true });
    await password.fill("preview-password");
    await page.getByRole("button", { name: "显示密码" }).click();
    await expect(password).toHaveAttribute("type", "text");
    await page.getByRole("button", { name: "隐藏密码" }).click();
    await expect(password).toHaveAttribute("type", "password");
    await expectNoSeriousAxeViolations(page);

    await registerUser(page);
    await expect(
      page.getByRole("heading", { name: "从一个清晰的想法开始" })
    ).toBeVisible();
    await expectNoSeriousAxeViolations(page);
    await page
      .getByRole("main")
      .getByRole("button", { name: "新建随记" })
      .click();
    await expect(page.getByLabel("Markdown 正文")).toBeVisible();
    await expectNoSeriousAxeViolations(page);
  });
});

test.describe("coarse pointer affordances", () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true });

  test("keeps Mermaid actions visible without hover", async ({ page }) => {
    await page.goto("/login");
    await registerUser(page);
    await page
      .getByRole("main")
      .getByRole("button", { name: "新建随记" })
      .tap();
    await page.getByLabel("Markdown 正文").tap();
    const toolbar = page.getByRole("toolbar", { name: "文档格式" });
    await toolbar.getByRole("button", { name: "更多格式" }).tap();
    await page.getByRole("menuitem", { name: "Mermaid 图表" }).tap();
    const diagram = page.locator(".inkloom-mermaid-view").last();
    const fullscreen = diagram.getByRole("button", {
      name: "全屏编辑图表"
    });
    await expect(fullscreen).toBeVisible();
    await expect(fullscreen).toHaveCSS("opacity", "1");
  });
});

async function registerUser(page: Page) {
  const email = `review-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}@inkloom.local`;
  await page.getByRole("radio", { name: "创建账号" }).click();
  await page.getByLabel("称呼").fill("界面验收");
  await page.getByLabel("邮箱").fill(email);
  await page.getByLabel("密码", { exact: true }).fill("review-password");
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

async function expectNoSeriousAxeViolations(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  const serious = result.violations.filter(
    (violation) =>
      violation.impact === "serious" || violation.impact === "critical"
  );
  expect(
    serious.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      nodes: violation.nodes.map((node) => ({
        target: node.target,
        html: node.html,
        failureSummary: node.failureSummary
      }))
    }))
  ).toEqual([]);
}
