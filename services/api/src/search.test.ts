import { describe, expect, it } from "vitest";
import {
  buildFtsQuery,
  filenameFromPath,
  highlightSearchSnippet,
  searchIndexTerms
} from "./search";

describe("Chinese-friendly FTS terms", () => {
  it("indexes Chinese characters and adjacent bigrams", () => {
    expect(searchIndexTerms("数据库设计")).toEqual([
      "数",
      "据",
      "库",
      "设",
      "计",
      "数据",
      "据库",
      "库设",
      "设计"
    ]);
  });

  it("supports one-character, multi-character and English queries", () => {
    expect(buildFtsQuery("库")).toBe('"库"');
    expect(buildFtsQuery("数据库")).toContain('"数据"');
    expect(buildFtsQuery("数据库")).toContain('"据库"');
    expect(buildFtsQuery("InkLoom API")).toBe('"inkloom" AND "api"');
  });

  it("normalizes full-width input and extracts filenames", () => {
    expect(searchIndexTerms("ＡＰＩ")).toEqual(["api"]);
    expect(filenameFromPath("产品/需求说明.md")).toBe("需求说明.md");
  });

  it("creates a safe highlighted snippet around the original query", () => {
    expect(highlightSearchSnippet("数据库设计包含 API 文档。", "据库设")).toBe(
      "数<mark>据库设</mark>计包含 API 文档。"
    );
  });
});
