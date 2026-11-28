import { describe, expect, it } from "vitest";
import {
  INLINE_FORMAT_PLUGINS,
  INLINE_MARKDOWN_EXTENSIONS,
  highlightMarkSchema,
  parseInlineMarkOpening,
  safeColor,
  textColorMarkSchema,
  transformInlineMarks,
  underlineMarkSchema
} from "./inline-format-marks";

describe("inline format markdown", () => {
  it("recognizes supported mark tags and rejects unsafe colors", () => {
    expect(parseInlineMarkOpening("<u>")).toEqual({
      closing: "</u>",
      nodeType: "inkloomUnderline"
    });
    expect(
      parseInlineMarkOpening('<span data-inkloom-color="#D64242">')
    ).toEqual({
      closing: "</span>",
      nodeType: "inkloomTextColor",
      color: "#d64242"
    });
    expect(
      parseInlineMarkOpening('<mark data-inkloom-highlight="#FFF0A8">')
    ).toEqual({
      closing: "</mark>",
      nodeType: "inkloomHighlight",
      color: "#fff0a8"
    });
    expect(parseInlineMarkOpening("<strong>")).toBeUndefined();
    expect(safeColor("red;display:none", "#262626")).toBe("#262626");
    expect(safeColor("#ABCDEF", "#262626")).toBe("#abcdef");
  });

  it("nests inline marks from flat HTML markers", () => {
    const tree = {
      children: [
        { type: "text", value: "前" },
        { type: "html", value: "<u>" },
        { type: "html", value: '<span data-inkloom-color="#d64242">' },
        { type: "text", value: "彩色" },
        { type: "html", value: "</span>" },
        { type: "html", value: "</u>" },
        { type: "html", value: '<mark data-inkloom-highlight="#fff0a8">' },
        { type: "text", value: "重点" },
        { type: "html", value: "</mark>" },
        { type: "text", value: "后" }
      ]
    };

    transformInlineMarks(tree);

    expect(tree.children[1]).toMatchObject({
      type: "inkloomUnderline",
      children: [
        {
          type: "inkloomTextColor",
          color: "#d64242",
          children: [{ type: "text", value: "彩色" }]
        }
      ]
    });
    expect(tree.children[2]).toMatchObject({
      type: "inkloomHighlight",
      color: "#fff0a8",
      children: [{ type: "text", value: "重点" }]
    });
  });

  it("serializes custom mark nodes as stable inline HTML", () => {
    const state = {
      containerPhrasing(node: {
        children?: { type: string; value?: string; children?: unknown[] }[];
      }): string {
        return (
          node.children
            ?.map((child) =>
              child.type === "text"
                ? (child.value ?? "")
                : state.containerPhrasing(child as never)
            )
            .join("") ?? ""
        );
      }
    };
    const text = { type: "text", value: "内容" };

    expect(
      INLINE_MARKDOWN_EXTENSIONS.handlers.inkloomUnderline(
        { type: "inkloomUnderline", children: [text] },
        undefined,
        state,
        undefined
      )
    ).toBe("<u>内容</u>");
    expect(
      INLINE_MARKDOWN_EXTENSIONS.handlers.inkloomTextColor(
        { type: "inkloomTextColor", color: "#d64242", children: [text] },
        undefined,
        state,
        undefined
      )
    ).toBe('<span data-inkloom-color="#d64242">内容</span>');
    expect(
      INLINE_MARKDOWN_EXTENSIONS.handlers.inkloomHighlight(
        { type: "inkloomHighlight", color: "#fff0a8", children: [text] },
        undefined,
        state,
        undefined
      )
    ).toBe('<mark data-inkloom-highlight="#fff0a8">内容</mark>');
    expect(INLINE_FORMAT_PLUGINS.length).toBeGreaterThan(0);
  });

  it("exposes parse and ProseMirror serialization behavior for every mark", () => {
    const cases = [
      {
        schema: underlineMarkSchema(),
        nodeType: "inkloomUnderline",
        markName: "inkloom_underline",
        attrs: {},
        expectedTag: "u"
      },
      {
        schema: textColorMarkSchema(),
        nodeType: "inkloomTextColor",
        markName: "inkloom_text_color",
        attrs: { color: "#d64242" },
        expectedTag: "span"
      },
      {
        schema: highlightMarkSchema(),
        nodeType: "inkloomHighlight",
        markName: "inkloom_highlight",
        attrs: { color: "#fff0a8" },
        expectedTag: "mark"
      }
    ] as const;

    for (const item of cases) {
      const markSchema = item.schema;
      const parserCalls: string[] = [];
      const parser = {
        openMark() {
          parserCalls.push("open");
          return parser;
        },
        next() {
          parserCalls.push("next");
          return parser;
        },
        closeMark() {
          parserCalls.push("close");
          return parser;
        }
      };
      const serializerCalls: string[] = [];
      const serializer = {
        withMark() {
          serializerCalls.push("with");
          return serializer;
        }
      };

      expect(
        markSchema.parseMarkdown.match({ type: item.nodeType } as never)
      ).toBe(true);
      markSchema.parseMarkdown.runner(
        parser as never,
        {
          type: item.nodeType,
          children: [],
          color: "color" in item.attrs ? item.attrs.color : undefined
        } as never,
        { name: item.markName } as never
      );
      expect(parserCalls).toEqual(["open", "next", "close"]);

      const mark = {
        type: { name: item.markName },
        attrs: item.attrs
      } as never;
      expect(markSchema.toMarkdown.match(mark)).toBe(true);
      markSchema.toMarkdown.runner(serializer as never, mark, {} as never);
      expect(serializerCalls).toEqual(["with"]);

      const toDOM = markSchema.toDOM;
      const output = typeof toDOM === "function" ? toDOM(mark, false) : toDOM;
      expect(Array.isArray(output) ? output[0] : "").toBe(item.expectedTag);
    }
  });
});
