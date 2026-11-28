import type { Ctx, MilkdownPlugin } from "@milkdown/kit/ctx";
import { editorViewCtx, schemaCtx } from "@milkdown/kit/core";
import { toggleMark } from "@milkdown/kit/prose/commands";
import { $markSchema, $remark } from "@milkdown/kit/utils";

type MarkdownTreeNode = {
  type: string;
  value?: string;
  children?: MarkdownTreeNode[];
  color?: string;
};

type MarkdownRoot = {
  children?: MarkdownTreeNode[];
};

type MarkdownExtensionState = {
  containerPhrasing: (node: MarkdownTreeNode, info: unknown) => string;
};

type InlineMarkOpening = {
  closing: string;
  nodeType: "inkloomUnderline" | "inkloomTextColor" | "inkloomHighlight";
  color?: string;
};

const DEFAULT_TEXT_COLOR = "#262626";
const DEFAULT_HIGHLIGHT_COLOR = "#fff0a8";
const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

const inlineMarksRemark = $remark(
  "inkloomInlineMarksRemark",
  () =>
    function (this: {
      data: ((key: string) => unknown) &
        ((key: string, value: unknown) => unknown);
    }) {
      const inlineExtensions = {
        handlers: {
          inkloomUnderline(
            node: MarkdownTreeNode,
            _parent: unknown,
            state: MarkdownExtensionState,
            info: unknown
          ) {
            return `<u>${state.containerPhrasing(node, info)}</u>`;
          },
          inkloomTextColor(
            node: MarkdownTreeNode,
            _parent: unknown,
            state: MarkdownExtensionState,
            info: unknown
          ) {
            const color = safeColor(node.color, DEFAULT_TEXT_COLOR);
            return `<span data-inkloom-color="${color}">${state.containerPhrasing(
              node,
              info
            )}</span>`;
          },
          inkloomHighlight(
            node: MarkdownTreeNode,
            _parent: unknown,
            state: MarkdownExtensionState,
            info: unknown
          ) {
            const color = safeColor(node.color, DEFAULT_HIGHLIGHT_COLOR);
            return `<mark data-inkloom-highlight="${color}">${state.containerPhrasing(
              node,
              info
            )}</mark>`;
          }
        }
      };
      const existingExtensions = this.data("toMarkdownExtensions");
      this.data("toMarkdownExtensions", [
        ...(Array.isArray(existingExtensions) ? existingExtensions : []),
        inlineExtensions
      ]);

      return (tree) => {
        transformInlineMarks(tree as MarkdownRoot);
      };
    }
);

const underlineSchema = $markSchema("inkloom_underline", () => ({
  parseDOM: [{ tag: "u" }],
  toDOM: () => ["u", 0],
  parseMarkdown: {
    match: (node) => node.type === "inkloomUnderline",
    runner: (state, node, type) => {
      state.openMark(type).next(node.children).closeMark(type);
    }
  },
  toMarkdown: {
    match: (mark) => mark.type.name === "inkloom_underline",
    runner: (state, mark) => {
      state.withMark(mark, "inkloomUnderline");
    }
  }
}));

const textColorSchema = $markSchema("inkloom_text_color", () => ({
  attrs: {
    color: { default: DEFAULT_TEXT_COLOR }
  },
  parseDOM: [
    {
      tag: "span[data-inkloom-color]",
      getAttrs: (dom) => {
        if (!(dom instanceof HTMLElement)) return false;
        return {
          color: safeColor(dom.dataset.inkloomColor, DEFAULT_TEXT_COLOR)
        };
      }
    }
  ],
  toDOM: (mark) => [
    "span",
    {
      "data-inkloom-color": String(mark.attrs.color),
      style: `color: ${String(mark.attrs.color)}`
    },
    0
  ],
  parseMarkdown: {
    match: (node) => node.type === "inkloomTextColor",
    runner: (state, node, type) => {
      state
        .openMark(type, {
          color: safeColor(node.color, DEFAULT_TEXT_COLOR)
        })
        .next(node.children)
        .closeMark(type);
    }
  },
  toMarkdown: {
    match: (mark) => mark.type.name === "inkloom_text_color",
    runner: (state, mark) => {
      state.withMark(mark, "inkloomTextColor", undefined, {
        color: safeColor(String(mark.attrs.color), DEFAULT_TEXT_COLOR)
      });
    }
  }
}));

const highlightSchema = $markSchema("inkloom_highlight", () => ({
  attrs: {
    color: { default: DEFAULT_HIGHLIGHT_COLOR }
  },
  parseDOM: [
    {
      tag: "mark[data-inkloom-highlight]",
      getAttrs: (dom) => {
        if (!(dom instanceof HTMLElement)) return false;
        return {
          color: safeColor(
            dom.dataset.inkloomHighlight,
            DEFAULT_HIGHLIGHT_COLOR
          )
        };
      }
    }
  ],
  toDOM: (mark) => [
    "mark",
    {
      "data-inkloom-highlight": String(mark.attrs.color),
      style: `background-color: ${String(mark.attrs.color)}`
    },
    0
  ],
  parseMarkdown: {
    match: (node) => node.type === "inkloomHighlight",
    runner: (state, node, type) => {
      state
        .openMark(type, {
          color: safeColor(node.color, DEFAULT_HIGHLIGHT_COLOR)
        })
        .next(node.children)
        .closeMark(type);
    }
  },
  toMarkdown: {
    match: (mark) => mark.type.name === "inkloom_highlight",
    runner: (state, mark) => {
      state.withMark(mark, "inkloomHighlight", undefined, {
        color: safeColor(String(mark.attrs.color), DEFAULT_HIGHLIGHT_COLOR)
      });
    }
  }
}));

export const INLINE_FORMAT_PLUGINS = [
  ...inlineMarksRemark,
  ...underlineSchema,
  ...textColorSchema,
  ...highlightSchema
] satisfies MilkdownPlugin[];

export function toggleUnderline(ctx: Ctx) {
  const view = ctx.get(editorViewCtx);
  const markType = ctx.get(schemaCtx).marks.inkloom_underline;
  if (!markType) return;
  toggleMark(markType)(view.state, view.dispatch);
  view.focus();
}

export function setTextColor(ctx: Ctx, color: string) {
  setExclusiveMark(ctx, "inkloom_text_color", {
    color: safeColor(color, DEFAULT_TEXT_COLOR)
  });
}

export function setHighlight(ctx: Ctx, color: string) {
  setExclusiveMark(ctx, "inkloom_highlight", {
    color: safeColor(color, DEFAULT_HIGHLIGHT_COLOR)
  });
}

export function clearFormatting(ctx: Ctx) {
  const view = ctx.get(editorViewCtx);
  const { from, to, empty } = view.state.selection;
  const transaction = empty
    ? view.state.tr.setStoredMarks([])
    : view.state.tr.removeMark(from, to);
  view.dispatch(transaction.scrollIntoView());
  view.focus();
}

function setExclusiveMark(
  ctx: Ctx,
  markName: "inkloom_text_color" | "inkloom_highlight",
  attrs: { color: string }
) {
  const view = ctx.get(editorViewCtx);
  const markType = ctx.get(schemaCtx).marks[markName];
  if (!markType) return;
  const { from, to, empty } = view.state.selection;
  if (empty) {
    toggleMark(markType, attrs)(view.state, view.dispatch);
  } else {
    view.dispatch(
      view.state.tr
        .removeMark(from, to, markType)
        .addMark(from, to, markType.create(attrs))
        .scrollIntoView()
    );
  }
  view.focus();
}

function transformInlineMarks(root: MarkdownRoot) {
  if (!root.children) return;
  root.children = convertChildren(root.children);
}

function convertChildren(children: MarkdownTreeNode[]): MarkdownTreeNode[] {
  const converted: MarkdownTreeNode[] = [];
  for (let index = 0; index < children.length; index += 1) {
    const child = children[index]!;
    const opening =
      child.type === "html" ? parseOpening(child.value) : undefined;
    if (opening) {
      const closingIndex = findClosing(
        children,
        index + 1,
        opening.nodeType,
        opening.closing
      );
      if (closingIndex >= 0) {
        converted.push({
          type: opening.nodeType,
          ...(opening.color ? { color: opening.color } : {}),
          children: convertChildren(children.slice(index + 1, closingIndex))
        });
        index = closingIndex;
        continue;
      }
    }
    converted.push(
      child.children
        ? { ...child, children: convertChildren(child.children) }
        : child
    );
  }
  return converted;
}

function findClosing(
  children: MarkdownTreeNode[],
  start: number,
  nodeType: InlineMarkOpening["nodeType"],
  closing: string
) {
  let depth = 0;
  for (let index = start; index < children.length; index += 1) {
    const child = children[index]!;
    if (child.type !== "html") continue;
    const value = child.value?.trim().toLowerCase();
    if (parseOpening(child.value)?.nodeType === nodeType) {
      depth += 1;
    } else if (value === closing) {
      if (depth === 0) return index;
      depth -= 1;
    }
  }
  return -1;
}

function parseOpening(value?: string): InlineMarkOpening | undefined {
  const normalized = value?.trim();
  if (!normalized) return undefined;
  if (/^<u(?:\s[^>]*)?>$/i.test(normalized)) {
    return {
      closing: "</u>",
      nodeType: "inkloomUnderline"
    };
  }
  const color = normalized.match(
    /^<span\b[^>]*\bdata-inkloom-color=["'](#[0-9a-f]{6})["'][^>]*>$/i
  );
  if (color) {
    return {
      closing: "</span>",
      nodeType: "inkloomTextColor",
      color: safeColor(color[1], DEFAULT_TEXT_COLOR)
    };
  }
  const highlight = normalized.match(
    /^<mark\b[^>]*\bdata-inkloom-highlight=["'](#[0-9a-f]{6})["'][^>]*>$/i
  );
  if (highlight) {
    return {
      closing: "</mark>",
      nodeType: "inkloomHighlight",
      color: safeColor(highlight[1], DEFAULT_HIGHLIGHT_COLOR)
    };
  }
  return undefined;
}

function safeColor(value: unknown, fallback: string) {
  return typeof value === "string" && COLOR_PATTERN.test(value)
    ? value.toLowerCase()
    : fallback;
}
