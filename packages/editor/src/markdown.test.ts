import { describe, expect, it } from "vitest";
import { countWords, extractHeadings, slugifyHeading } from "./index";

describe("Markdown view helpers", () => {
  it("extracts the visible outline without Markdown decoration", () => {
    expect(extractHeadings("# 产品\n\n## **同步** 与离线 ### ignored")).toEqual([
      { depth: 1, text: "产品", id: "产品" },
      { depth: 2, text: "同步 与离线 ### ignored", id: "同步-与离线-ignored" }
    ]);
  });

  it("counts CJK characters and Latin words outside fenced code", () => {
    expect(countWords("你好 InkLoom\n\n```ts\nconst hidden = true\n```")).toBe(3);
  });

  it("creates stable heading ids", () => {
    expect(slugifyHeading("Markdown 文件模型")).toBe("markdown-文件模型");
  });
});
