import type { Ctx, MilkdownPlugin } from "@milkdown/kit/ctx";
import {
  blockquoteSchema,
  codeBlockSchema,
  hrSchema,
  paragraphSchema
} from "@milkdown/kit/preset/commonmark";
import {
  createTable,
  tableCellSchema,
  tableHeaderRowSchema,
  tableHeaderSchema,
  tableRowSchema,
  tableSchema
} from "@milkdown/kit/preset/gfm";
import { editorViewCtx, schemaCtx } from "@milkdown/kit/core";
import { imageBlockSchema } from "@milkdown/kit/component/image-block";
import type {
  Attrs,
  Node as ProseNode
} from "@milkdown/kit/prose/model";
import { Plugin, PluginKey, TextSelection } from "@milkdown/kit/prose/state";
import { findTable, isInTable, type FindNodeResult } from "@milkdown/kit/prose/tables";
import { Decoration, DecorationSet } from "@milkdown/kit/prose/view";
import type { EditorView } from "@milkdown/kit/prose/view";
import { $nodeSchema, $prose, $remark } from "@milkdown/kit/utils";
import {
  CALLOUT_LABELS,
  type CalloutKind
} from "./editor-block-meta";

const CALLOUT_PATTERN =
  /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?:\r?\n)?/i;

type MarkdownTreeNode = {
  type: string;
  value?: string;
  children?: MarkdownTreeNode[];
  summary?: string;
  open?: boolean;
  url?: string;
  fileAttrs?: FileBlockAttrs;
};

type MarkdownRoot = {
  children?: MarkdownTreeNode[];
};

export type FileBlockAttrs = {
  id: string;
  hash: string;
  mime: string;
  size: number;
  name: string;
  url: string;
};

const inkloomBlocksRemark = $remark("inkloomBlocksRemark", () => () => (tree) => {
  transformToggles(tree as MarkdownRoot);
  transformFiles(tree as MarkdownRoot);
});

const toggleSchema = $nodeSchema("inkloom_toggle", () => ({
  content: "block+",
  group: "block",
  defining: true,
  attrs: {
    summary: { default: "折叠内容" },
    open: { default: false }
  },
  parseDOM: [
    {
      tag: "details[data-inkloom-toggle]",
      getAttrs: (dom) => {
        if (!(dom instanceof HTMLElement)) return false;
        return {
          summary:
            dom.querySelector("summary")?.textContent?.trim() || "折叠内容",
          open: dom.hasAttribute("open")
        };
      }
    }
  ],
  toDOM: (node) => [
    "details",
    {
      "data-inkloom-toggle": "true",
      class: "inkloom-toggle",
      ...(node.attrs.open ? { open: "" } : {})
    },
    [
      "summary",
      {
        class: "inkloom-toggle-summary",
        contenteditable: "false"
      },
      String(node.attrs.summary)
    ],
    ["div", { class: "inkloom-toggle-body" }, 0]
  ],
  parseMarkdown: {
    match: (node) => node.type === "inkloom_toggle",
    runner: (state, node, type) => {
      state
        .openNode(type, {
          summary:
            typeof node.summary === "string" ? node.summary : "折叠内容",
          open: node.open === true
        })
        .next(node.children)
        .closeNode();
    }
  },
  toMarkdown: {
    match: (node) => node.type.name === "inkloom_toggle",
    runner: (state, node) => {
      state.addNode(
        "html",
        undefined,
        `<details${node.attrs.open ? " open" : ""}>\n<summary>${escapeHtml(
          String(node.attrs.summary)
        )}</summary>`
      );
      state.next(node.content);
      state.addNode("html", undefined, "</details>");
    }
  }
}));

const fileSchema = $nodeSchema("inkloom_file", () => ({
  atom: true,
  group: "block",
  selectable: true,
  draggable: true,
  attrs: {
    id: { default: "" },
    hash: { default: "" },
    mime: { default: "application/octet-stream" },
    size: { default: 0 },
    name: { default: "附件" },
    url: { default: "" }
  },
  parseDOM: [
    {
      tag: "div[data-type='inkloom-file']",
      getAttrs: (dom) => {
        if (!(dom instanceof HTMLElement)) return false;
        return {
          id: dom.dataset.id ?? "",
          hash: dom.dataset.hash ?? "",
          mime: dom.dataset.mime ?? "application/octet-stream",
          size: Number(dom.dataset.size ?? 0),
          name: dom.dataset.name ?? "附件",
          url: dom.dataset.url ?? ""
        };
      }
    }
  ],
  toDOM: (node) => [
    "div",
    {
      class: "inkloom-file-block",
      "data-type": "inkloom-file",
      "data-id": node.attrs.id,
      "data-hash": node.attrs.hash,
      "data-mime": node.attrs.mime,
      "data-size": String(node.attrs.size),
      "data-name": node.attrs.name,
      "data-url": node.attrs.url
    },
    [
      "a",
      {
        href: node.attrs.url,
        download: node.attrs.name,
        target: "_blank",
        rel: "noreferrer"
      },
      String(node.attrs.name)
    ],
    ["span", { class: "inkloom-file-meta" }, formatAssetSize(node.attrs.size)]
  ],
  parseMarkdown: {
    match: (node) => node.type === "inkloom_file",
    runner: (state, node, type) => {
      state.addNode(type, node.fileAttrs as Attrs);
    }
  },
  toMarkdown: {
    match: (node) => node.type.name === "inkloom_file",
    runner: (state, node) => {
      state.addNode(
        "html",
        undefined,
        fileBlockMarkdown(node.attrs as FileBlockAttrs)
      );
    }
  }
}));

const toggleBehavior = $prose(
  () =>
    new Plugin({
      key: new PluginKey("INKLOOM_TOGGLE_BEHAVIOR"),
      props: {
        handleDOMEvents: {
          click(view, event) {
            const target = event.target;
            if (!(target instanceof HTMLElement)) return false;
            const details = target.closest<HTMLDetailsElement>(
              "details[data-inkloom-toggle]"
            );
            if (!details || !target.closest("summary")) return false;
            event.preventDefault();
            const nextOpen = !details.open;
            details.open = nextOpen;
            updateToggleOpenFromDom(view, details, nextOpen);
            return true;
          },
          toggle(view, event) {
            const target = event.target;
            if (!(target instanceof HTMLElement)) return false;
            const details = target.closest<HTMLDetailsElement>(
              "details[data-inkloom-toggle]"
            );
            if (!details || !view.dom.contains(details)) return false;
            const open = details.open;
            window.setTimeout(() => {
              if (!details.isConnected) return;
              updateToggleOpenFromDom(view, details, open);
            });
            return false;
          }
        }
      }
    })
);

const calloutDecorations = $prose(
  () =>
    new Plugin({
      key: new PluginKey("INKLOOM_CALLOUT_DECORATIONS"),
      props: {
        decorations(state) {
          const decorations: Decoration[] = [];
          state.doc.descendants((node, position) => {
            if (node.type.name !== "blockquote") return true;
            const firstParagraph = node.firstChild;
            if (firstParagraph?.type.name !== "paragraph") return false;
            const marker = firstParagraph.textContent.match(CALLOUT_PATTERN);
            if (!marker) return false;
            const kind = marker[1].toLowerCase() as CalloutKind;
            decorations.push(
              Decoration.node(position, position + node.nodeSize, {
                class: "inkloom-callout",
                "data-callout": kind,
                "data-callout-label": CALLOUT_LABELS[kind]
              })
            );
            const markerStart = position + 2;
            decorations.push(
              Decoration.inline(
                markerStart,
                markerStart + marker[0].replace(/\r?\n$/, "").length,
                { class: "inkloom-callout-marker" }
              )
            );
            return false;
          });
          return DecorationSet.create(state.doc, decorations);
        }
      }
    })
);

const tablePaste = $prose(
  (ctx) =>
    new Plugin({
      key: new PluginKey("INKLOOM_TABLE_PASTE"),
      props: {
        handleDOMEvents: {
          paste(view, event) {
            if (!isInTable(view.state)) return false;
            const matrix = readClipboardTable(event.clipboardData);
            if (!matrix) return false;
            const found = findTable(view.state.selection.$from);
            if (!found) return false;
            event.preventDefault();
            const table = createPastedTable(ctx, matrix, found);
            view.dispatch(
              view.state.tr
                .replaceWith(
                  found.pos,
                  found.pos + found.node.nodeSize,
                  table
                )
                .scrollIntoView()
            );
            return true;
          }
        }
      }
    })
);

export const PRODUCT_BLOCK_PLUGINS = [
  ...inkloomBlocksRemark,
  ...toggleSchema,
  ...fileSchema,
  toggleBehavior,
  calloutDecorations,
  tablePaste
] satisfies MilkdownPlugin[];

export function insertCallout(ctx: Ctx, kind: CalloutKind) {
  const schema = ctx.get(schemaCtx);
  const marker = paragraphSchema
    .type(ctx)
    .create(null, schema.text(`[!${kind.toUpperCase()}]`));
  const body = paragraphSchema.type(ctx).create();
  const blockquote = blockquoteSchema.type(ctx).create(null, [marker, body]);
  replaceOrInsertTopLevelBlock(ctx, blockquote);
}

export function insertToggle(ctx: Ctx) {
  const type = toggleSchema.type(ctx);
  const body = paragraphSchema.type(ctx).create();
  replaceOrInsertTopLevelBlock(
    ctx,
    type.create({ summary: "折叠内容", open: true }, [body])
  );
}

export function insertFormula(ctx: Ctx) {
  const schema = ctx.get(schemaCtx);
  replaceOrInsertTopLevelBlock(
    ctx,
    codeBlockSchema
      .type(ctx)
      .create({ language: "latex" }, schema.text("E = mc^2"))
  );
}

export function insertCodeBlock(ctx: Ctx) {
  replaceOrInsertTopLevelBlock(
    ctx,
    codeBlockSchema.type(ctx).create({ language: "" })
  );
}

export function insertDivider(ctx: Ctx) {
  replaceOrInsertTopLevelBlock(ctx, hrSchema.type(ctx).create());
}

export function insertTable(ctx: Ctx) {
  replaceOrInsertTopLevelBlock(ctx, createTable(ctx, 3, 3));
}

export function insertFile(ctx: Ctx, attrs: FileBlockAttrs) {
  replaceOrInsertTopLevelBlock(
    ctx,
    fileSchema.type(ctx).create({ ...attrs } as Attrs)
  );
}

export function insertImageBlock(
  ctx: Ctx,
  input: { src: string; caption: string }
) {
  replaceOrInsertTopLevelBlock(
    ctx,
    imageBlockSchema.type(ctx).create({
      src: imageUrlWithAlignment(input.src, "center"),
      caption: input.caption,
      ratio: 1
    })
  );
}

export function setImageAlignment(
  ctx: Ctx,
  blockIndex: number,
  alignment: "left" | "center" | "right"
) {
  const view = ctx.get(editorViewCtx);
  const block = topLevelNode(view.state.doc, blockIndex);
  if (!block || block.node.type.name !== "image-block") return;
  view.dispatch(
    view.state.tr.setNodeMarkup(block.position, undefined, {
      ...block.node.attrs,
      src: imageUrlWithAlignment(String(block.node.attrs.src), alignment)
    })
  );
  view.focus();
}

export function replaceImageBlock(
  ctx: Ctx,
  blockIndex: number,
  input: { src: string; caption: string }
) {
  const view = ctx.get(editorViewCtx);
  const block = topLevelNode(view.state.doc, blockIndex);
  if (!block || block.node.type.name !== "image-block") return;
  view.dispatch(
    view.state.tr.setNodeMarkup(
      block.position,
      undefined,
      {
        ...block.node.attrs,
        src: imageUrlWithAlignment(input.src, "center"),
        caption: input.caption
      }
    )
  );
  view.focus();
}

export function setCalloutKind(
  ctx: Ctx,
  blockIndex: number,
  kind: CalloutKind
) {
  const view = ctx.get(editorViewCtx);
  const block = topLevelNode(view.state.doc, blockIndex);
  if (!block || block.node.type.name !== "blockquote") return;
  const firstParagraph = block.node.firstChild;
  if (!firstParagraph) return;
  const marker = firstParagraph.textContent.match(CALLOUT_PATTERN);
  if (!marker) return;
  const replacement = ctx
    .get(schemaCtx)
    .text(`[!${kind.toUpperCase()}]`);
  const markerStart = block.position + 2;
  view.dispatch(
    view.state.tr
      .replaceWith(
        markerStart,
        markerStart + marker[0].replace(/\r?\n$/, "").length,
        replacement
      )
      .scrollIntoView()
  );
  view.focus();
}

export function setToggleSummary(
  ctx: Ctx,
  blockIndex: number,
  summary: string
) {
  updateToggle(ctx, blockIndex, (node) => ({
    ...node.attrs,
    summary: summary.trim() || "折叠内容"
  }));
}

export function toggleToggleOpen(ctx: Ctx, blockIndex: number) {
  updateToggle(ctx, blockIndex, (node) => ({
    ...node.attrs,
    open: !node.attrs.open
  }));
}

function updateToggle(
  ctx: Ctx,
  blockIndex: number,
  updateAttrs: (node: ProseNode) => Record<string, unknown>
) {
  const view = ctx.get(editorViewCtx);
  const block = topLevelNode(view.state.doc, blockIndex);
  if (!block || block.node.type.name !== "inkloom_toggle") return;
  view.dispatch(
    view.state.tr
      .setNodeMarkup(block.position, undefined, updateAttrs(block.node))
      .scrollIntoView()
  );
  view.focus();
}

function replaceOrInsertTopLevelBlock(ctx: Ctx, node: ProseNode) {
  const view = ctx.get(editorViewCtx);
  const { $from } = view.state.selection;
  const topLevel = topLevelNodes(view.state.doc);
  const currentIndex = topLevel.findIndex(
    (entry) =>
      $from.pos >= entry.position &&
      $from.pos <= entry.position + entry.node.nodeSize
  );
  const current = currentIndex === -1 ? undefined : topLevel[currentIndex];
  const shouldReplace =
    current !== undefined && isEmptyParagraph(current.node);
  let start = current
    ? shouldReplace
      ? current.position
      : current.position + current.node.nodeSize
    : view.state.doc.content.size;
  let end = current
    ? shouldReplace
      ? current.position + current.node.nodeSize
      : start
    : start;
  if (shouldReplace && currentIndex > 0) {
    let previous = currentIndex - 1;
    while (previous >= 0 && isEmptyParagraph(topLevel[previous].node)) {
      start = topLevel[previous].position;
      previous -= 1;
    }
  }
  if (current) {
    let next = currentIndex + 1;
    while (next < topLevel.length && isEmptyParagraph(topLevel[next].node)) {
      end = topLevel[next].position + topLevel[next].node.nodeSize;
      next += 1;
    }
  }
  const transaction = view.state.tr.replaceWith(start, end, node);
  const cursor = TextSelection.near(
    transaction.doc.resolve(Math.max(start + 1, start + node.nodeSize - 2))
  );
  transaction.setSelection(cursor).scrollIntoView();
  view.dispatch(transaction);
  view.focus();
}

function topLevelNodes(doc: ProseNode) {
  const nodes: Array<{ position: number; node: ProseNode }> = [];
  let position = 0;
  doc.forEach((node) => {
    nodes.push({ position, node });
    position += node.nodeSize;
  });
  return nodes;
}

function isEmptyParagraph(node: ProseNode) {
  if (node.type.name !== "paragraph" || node.textContent.trim().length > 0) {
    return false;
  }
  return (
    node.content.size === 0 ||
    (node.childCount === 1 && node.firstChild?.type.name === "html")
  );
}

function topLevelNode(doc: ProseNode, index: number) {
  let position = 0;
  for (let current = 0; current < doc.childCount; current += 1) {
    const node = doc.child(current);
    if (current === index) return { position, node };
    position += node.nodeSize;
  }
  return undefined;
}

function updateToggleOpenFromDom(
  view: EditorView,
  details: HTMLDetailsElement,
  open: boolean
) {
  let position = -1;
  view.state.doc.descendants((node, candidatePosition) => {
    if (
      node.type.name === "inkloom_toggle" &&
      view.nodeDOM(candidatePosition) === details
    ) {
      position = candidatePosition;
      return false;
    }
    return true;
  });
  if (position < 0) return;
  const node = view.state.doc.nodeAt(position);
  if (!node || node.attrs.open === open) return;
  view.dispatch(
    view.state.tr.setNodeMarkup(position, undefined, {
      ...node.attrs,
      open
    })
  );
}

function readClipboardTable(data: DataTransfer | null) {
  if (!data) return undefined;
  const html = data.getData("text/html");
  if (html) {
    const document = new DOMParser().parseFromString(html, "text/html");
    const table = document.querySelector("table");
    if (table) {
      const rows = [...table.rows]
        .map((row) =>
          [...row.cells].map((cell) => cell.textContent?.trim() ?? "")
        )
        .filter((row) => row.length > 0);
      if (rows.length > 0) return normalizeTableMatrix(rows);
    }
  }
  const plain = data.getData("text/plain");
  if (!plain.includes("\t") && !plain.includes("\n")) return undefined;
  const rows = plain
    .replace(/\r\n?/g, "\n")
    .trimEnd()
    .split("\n")
    .map((row) => row.split("\t"));
  return normalizeTableMatrix(rows);
}

function normalizeTableMatrix(rows: string[][]) {
  const columns = Math.max(1, ...rows.map((row) => row.length));
  return rows.map((row) => [
    ...row,
    ...Array.from({ length: columns - row.length }, () => "")
  ]);
}

function createPastedTable(
  ctx: Ctx,
  matrix: string[][],
  existing: FindNodeResult
) {
  const schema = ctx.get(schemaCtx);
  const alignment = matrix[0].map((_, index) => {
    const cell = existing.node.firstChild?.child(index);
    return typeof cell?.attrs.alignment === "string"
      ? cell.attrs.alignment
      : "left";
  });
  const header = tableHeaderRowSchema.type(ctx).create(
    null,
    matrix[0].map((value, index) =>
      tableHeaderSchema
        .type(ctx)
        .create({ alignment: alignment[index] }, [
          paragraphSchema
            .type(ctx)
            .create(null, value ? schema.text(value) : undefined)
        ])
    )
  );
  const bodyRows = (matrix.slice(1).length > 0
    ? matrix.slice(1)
    : [matrix[0].map(() => "")]
  ).map((row) =>
    tableRowSchema.type(ctx).create(
      null,
      row.map((value) =>
        tableCellSchema
          .type(ctx)
          .create(null, [
            paragraphSchema
              .type(ctx)
              .create(null, value ? schema.text(value) : undefined)
          ])
      )
    )
  );
  return tableSchema.type(ctx).create(null, [header, ...bodyRows]);
}

function transformToggles(root: MarkdownRoot) {
  const children = root.children;
  if (!children?.length) return;
  const next: MarkdownTreeNode[] = [];
  for (let index = 0; index < children.length; index += 1) {
    const node = children[index];
    const opening = parseToggleOpening(node);
    if (!opening) {
      next.push(node);
      continue;
    }
    const closingIndex = findToggleClosing(children, index + 1);
    if (closingIndex === -1) {
      next.push(node);
      continue;
    }
    const body = children.slice(index + 1, closingIndex);
    if (body.some((child) => parseToggleOpening(child))) {
      next.push(node);
      continue;
    }
    next.push({
      type: "inkloom_toggle",
      summary: opening.summary,
      open: opening.open,
      children: body
    });
    index = closingIndex;
  }
  root.children = next;
}

function transformFiles(root: MarkdownRoot) {
  const children = root.children;
  if (!children?.length) return;
  const next: MarkdownTreeNode[] = [];
  for (let index = 0; index < children.length; index += 1) {
    const metadata = parseFileOpening(children[index]);
    if (!metadata) {
      next.push(children[index]);
      continue;
    }
    const closingIndex = findFileClosing(children, index + 1);
    if (closingIndex === -1) {
      next.push(children[index]);
      continue;
    }
    const url = findFirstLink(children.slice(index + 1, closingIndex));
    if (!url) {
      next.push(children[index]);
      continue;
    }
    next.push({
      type: "inkloom_file",
      fileAttrs: {
        ...metadata,
        url
      }
    });
    index = closingIndex;
  }
  root.children = next;
}

function parseFileOpening(node: MarkdownTreeNode) {
  if (node.type !== "html" && node.type !== "paragraph") return undefined;
  const match = markdownNodeText(node)
    .trim()
    .match(/^<!--\s*inkloom:file\s*\n([\s\S]*?)-->$/i);
  if (!match) return undefined;
  const values = new Map<string, string>();
  for (const line of match[1].split(/\r?\n/)) {
    const entry = line.match(/^\s*([a-z][a-z0-9_-]*):\s*(.*?)\s*$/i);
    if (entry) values.set(entry[1].toLowerCase(), entry[2]);
  }
  const id = values.get("id");
  const hash = values.get("hash");
  const mime = values.get("mime");
  const name = values.get("name");
  const size = Number(values.get("size") ?? 0);
  if (!id || !hash || !mime || !name) return undefined;
  return {
    id,
    hash,
    mime,
    size: Number.isFinite(size) && size >= 0 ? size : 0,
    name
  };
}

function findFileClosing(children: MarkdownTreeNode[], start: number) {
  for (let index = start; index < children.length; index += 1) {
    if (/^\s*<!--\s*\/inkloom:file\s*-->\s*$/i.test(markdownNodeText(children[index]))) {
      return index;
    }
  }
  return -1;
}

function findFirstLink(nodes: MarkdownTreeNode[]): string | undefined {
  for (const node of nodes) {
    if (node.type === "link" && typeof node.url === "string") return node.url;
    const nested = findFirstLink(node.children ?? []);
    if (nested) return nested;
  }
  return undefined;
}

function parseToggleOpening(node: MarkdownTreeNode) {
  if (node.type !== "html" && node.type !== "paragraph") return undefined;
  const match = markdownNodeText(node).match(
    /^<details(?<open>\s+open)?[^>]*>\s*<summary>(?<summary>[\s\S]*?)<\/summary>\s*$/i
  );
  if (!match?.groups) return undefined;
  return {
    open: Boolean(match.groups.open),
    summary: decodeSummary(match.groups.summary)
  };
}

function findToggleClosing(children: MarkdownTreeNode[], start: number) {
  for (let index = start; index < children.length; index += 1) {
    const node = children[index];
    if (/^\s*<\/details>\s*$/i.test(markdownNodeText(node))) {
      return index;
    }
  }
  return -1;
}

function markdownNodeText(node: MarkdownTreeNode): string {
  if (typeof node.value === "string") return node.value;
  return (
    node.children
      ?.map((child) => markdownNodeText(child))
      .join("") ?? ""
  );
}

function decodeSummary(summary: string) {
  return summary
    .replace(/<[^>]*>/g, "")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&")
    .trim();
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function fileBlockMarkdown(attrs: FileBlockAttrs) {
  const name = String(attrs.name).replace(/[\[\]\r\n]/g, " ");
  return `<!-- inkloom:file
id: ${attrs.id}
hash: ${attrs.hash}
mime: ${attrs.mime}
size: ${attrs.size}
name: ${name}
-->
[${name}](<${attrs.url}>)
<!-- /inkloom:file -->`;
}

function formatAssetSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function imageUrlWithAlignment(
  src: string,
  alignment: "left" | "center" | "right"
) {
  return `${src.replace(/#align=(?:left|center|right)$/i, "")}#align=${alignment}`;
}
