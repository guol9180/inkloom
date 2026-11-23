import { describe, expect, it } from "vitest";
import { MARKDOWN_GOLDEN_CORPUS } from "./markdown-golden-corpus";
import {
  findMarkdownSourceBlock,
  isMarkdownSourceLossless,
  parseMarkdownSource,
  reconcileMarkdownSource,
  replaceMarkdownSourceBlock,
  serializeMarkdownSource
} from "./markdown-source";

describe("Markdown source-slice model", () => {
  it.each(MARKDOWN_GOLDEN_CORPUS)(
    "preserves the golden corpus exactly: $name",
    ({ source, requiredFragments }) => {
      const document = parseMarkdownSource(source);

      expect(document.diagnostics).toEqual([]);
      expect(isMarkdownSourceLossless(document)).toBe(true);
      expect(serializeMarkdownSource(document)).toBe(source);
      for (const fragment of requiredFragments) {
        expect(source).toContain(fragment);
        expect(serializeMarkdownSource(document)).toContain(fragment);
      }
      for (const block of document.blocks) {
        expect(source.slice(block.startOffset, block.endOffset)).toBe(
          block.source
        );
      }
    }
  );

  it("uses original source slices for untouched blocks", () => {
    const source = [
      "# 标题",
      "",
      "第一段。",
      "",
      '[reference]: https://example.com "保留定义"',
      "",
      "第二段 [引用][reference]。",
      ""
    ].join("\n");
    const document = parseMarkdownSource(source);
    const paragraph = document.blocks.find(
      (block) => block.type === "paragraph" && block.source.includes("第一段")
    );
    expect(paragraph).toBeDefined();

    const edited = replaceMarkdownSourceBlock(
      document,
      paragraph!.id,
      "修改后的第一段。"
    );
    expect(serializeMarkdownSource(edited)).toBe(
      source.replace("第一段。\n", "修改后的第一段。\n")
    );
  });

  it("marks frontmatter, unknown fences, HTML and definitions as protected", () => {
    const source = [
      "---",
      "title: 保留",
      "---",
      "",
      "```unknown",
      "raw",
      "```",
      "",
      "<!-- comment -->",
      "",
      "[ref]: https://example.com",
      "",
      "脚注[^a]。",
      "",
      "[^a]: 定义",
      ""
    ].join("\n");
    const document = parseMarkdownSource(source);
    expect(
      document.blocks.find((block) => block.type === "frontmatter")
    ).toMatchObject({
      protected: true,
      source: "---\ntitle: 保留\n---\n"
    });
    expect(
      document.blocks.find((block) => block.type === "code")?.protected
    ).toBe(true);
    expect(
      document.blocks.find((block) => block.type === "html")?.protected
    ).toBe(true);
    expect(
      document.blocks.find((block) => block.type === "definition")?.protected
    ).toBe(true);
    expect(
      document.blocks.find((block) => block.type === "footnoteDefinition")
        ?.protected
    ).toBe(true);
  });

  it("finds blocks by source offset and survives a fresh parse", () => {
    const source = "# 标题\n\n正文 **粗体**。\n";
    const first = parseMarkdownSource(source);
    const persisted = serializeMarkdownSource(first);
    const refreshed = parseMarkdownSource(persisted);
    const block = findMarkdownSourceBlock(refreshed, source.indexOf("正文"));

    expect(block).toMatchObject({
      type: "paragraph",
      source: "正文 **粗体**。"
    });
    expect(serializeMarkdownSource(refreshed)).toBe(source);
  });

  it("keeps block order for headings, whitespace and paragraphs", () => {
    const source = "# 标题\n\n正常内容";
    const document = parseMarkdownSource(source);
    expect(document.diagnostics).toEqual([]);
    expect(document.blocks.map((block) => block.type)).toEqual([
      "heading",
      "whitespace",
      "paragraph"
    ]);
  });

  it("preserves untouched frontmatter and definitions while applying edits", () => {
    const original = [
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
    const baseline = [
      "***",
      "",
      "title: Keep this frontmatter",
      "unknown_field: keep",
      "-------------------",
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
      ""
    ].join("\n");
    const next = baseline.replace("普通段落。", "修改后的段落。");

    const reconciled = reconcileMarkdownSource(original, baseline, next);

    expect(reconciled).toContain("---\ntitle: Keep this frontmatter");
    expect(reconciled).toContain("[ref]: https://example.com");
    expect(reconciled).toContain("修改后的段落。");
    expect(
      reconciled.match(/title: Keep this frontmatter/gu) ?? []
    ).toHaveLength(1);
  });

  it("applies inserted and removed canonical blocks without replaying source-only changes", () => {
    const original = "# 标题\n\n正文\n";
    const baseline = "# 标题\n\n正文\n";
    const withInsertion = "# 标题\n\n正文\n\n新增段落。\n";

    expect(reconcileMarkdownSource(original, baseline, withInsertion)).toBe(
      withInsertion
    );
    expect(reconcileMarkdownSource(original, baseline, "")).toBe("");
  });
});
