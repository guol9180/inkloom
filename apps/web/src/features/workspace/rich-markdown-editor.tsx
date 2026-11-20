import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState
} from "react";
import { Crepe, CrepeFeature } from "@milkdown/crepe";
import type { Ctx } from "@milkdown/kit/ctx";
import {
  commandsCtx,
  editorViewCtx,
  schemaCtx
} from "@milkdown/kit/core";
import {
  blockquoteSchema,
  bulletListSchema,
  codeBlockSchema,
  headingSchema,
  listItemSchema,
  orderedListSchema,
  paragraphSchema,
  setBlockTypeCommand,
  toggleEmphasisCommand,
  toggleInlineCodeCommand,
  toggleLinkCommand,
  toggleStrongCommand,
  wrapInBlockTypeCommand
} from "@milkdown/kit/preset/commonmark";
import { toggleStrikethroughCommand } from "@milkdown/kit/preset/gfm";
import { redo, undo } from "@milkdown/kit/prose/history";
import { Fragment, type Node as ProseNode } from "@milkdown/kit/prose/model";
import { TextSelection, type Selection } from "@milkdown/kit/prose/state";
import {
  addColumnAfter,
  addRowAfter,
  deleteColumn,
  deleteRow,
  setCellAttr
} from "@milkdown/kit/prose/tables";
import { replaceAll } from "@milkdown/kit/utils";
import type { MarkdownBlockType } from "./markdown-block-type";
import { cn } from "../../lib/utils";
import {
  insertCallout,
  insertCodeBlock,
  insertDivider,
  insertFormula,
  insertTable,
  insertToggle,
  PRODUCT_BLOCK_PLUGINS,
  setCalloutKind,
  setToggleSummary,
  toggleToggleOpen
} from "../editor/editor-blocks";
import type { CalloutKind } from "../editor/editor-block-meta";
import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/classic.css";

export type RichMarkdownEditorHandle = {
  focus: () => void;
  setHeading: (level: 1 | 2 | 3 | 4 | 5 | 6 | null) => void;
  run: (action: RichToolbarAction) => void;
  setLink: (href: string) => void;
  insertBlock: (kind: "mermaid" | "canvas") => void;
  getMarkdown: () => string;
  isCurrentBlockEmpty: () => boolean;
  setCalloutKind: (blockIndex: number, kind: CalloutKind) => void;
  setToggleSummary: (blockIndex: number, summary: string) => void;
  toggleToggleOpen: (blockIndex: number) => void;
  tableAction: (action: TableAction) => void;
  moveTopLevelBlock: (fromIndex: number, toIndex: number) => void;
  duplicateTopLevelBlock: (index: number) => void;
  deleteTopLevelBlock: (index: number) => void;
};

export type RichToolbarAction =
  | "undo"
  | "redo"
  | "bold"
  | "italic"
  | "strike"
  | "inline-code"
  | "bullet-list"
  | "ordered-list"
  | "task-list"
  | "link"
  | "quote"
  | "divider"
  | "code-block"
  | "table"
  | "formula"
  | "callout"
  | "toggle";

export type TableAction =
  | "add-row"
  | "delete-row"
  | "add-column"
  | "delete-column"
  | "align-left"
  | "align-center"
  | "align-right";

export const RichMarkdownEditor = forwardRef<
  RichMarkdownEditorHandle,
  {
    value: string;
    title: string;
    mermaidSnippet: string;
    canvasSnippet: string;
    onChange: (value: string) => void;
    onBlockTypeChange: (type: MarkdownBlockType) => void;
    onTableHeaderChange?: (isHeader: boolean) => void;
    onRequestCanvas: () => void;
    className?: string;
  }
>(function RichMarkdownEditor(
  {
    value,
    title,
    mermaidSnippet,
    canvasSnippet,
    onChange,
    onBlockTypeChange,
    onTableHeaderChange,
    onRequestCanvas,
    className
  },
  ref
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const crepeRef = useRef<Crepe | undefined>(undefined);
  const readyRef = useRef(false);
  const suppressChangeRef = useRef(false);
  const lastValueRef = useRef(value);
  const titleRef = useRef(title);
  const onChangeRef = useRef(onChange);
  const onBlockTypeChangeRef = useRef(onBlockTypeChange);
  const onTableHeaderChangeRef = useRef(onTableHeaderChange);
  const onRequestCanvasRef = useRef(onRequestCanvas);
  const mermaidSnippetRef = useRef(mermaidSnippet);
  const canvasSnippetRef = useRef(canvasSnippet);
  const [loading, setLoading] = useState(true);

  onChangeRef.current = onChange;
  onBlockTypeChangeRef.current = onBlockTypeChange;
  onTableHeaderChangeRef.current = onTableHeaderChange;
  onRequestCanvasRef.current = onRequestCanvas;
  mermaidSnippetRef.current = mermaidSnippet;
  canvasSnippetRef.current = canvasSnippet;
  titleRef.current = title;

  useImperativeHandle(
    ref,
    () => ({
      focus() {
        hostRef.current?.querySelector<HTMLElement>(".ProseMirror")?.focus();
      },
      setHeading(level) {
        const crepe = crepeRef.current;
        if (!crepe || !readyRef.current) return;
        crepe.editor.action((ctx) => {
          const commands = ctx.get(commandsCtx);
          commands.call(setBlockTypeCommand.key, {
            nodeType:
              level === null
                ? paragraphSchema.type(ctx)
                : headingSchema.type(ctx),
            ...(level === null ? {} : { attrs: { level } })
          });
        });
        this.focus();
      },
      run(action) {
        const crepe = crepeRef.current;
        if (!crepe || !readyRef.current) return;
        crepe.editor.action((ctx) => {
          const view = ctx.get(editorViewCtx);
          const commands = ctx.get(commandsCtx);
          if (action === "undo") {
            undo(view.state, view.dispatch);
          } else if (action === "redo") {
            redo(view.state, view.dispatch);
          } else if (action === "bold") {
            commands.call(toggleStrongCommand.key);
          } else if (action === "italic") {
            commands.call(toggleEmphasisCommand.key);
          } else if (action === "strike") {
            commands.call(toggleStrikethroughCommand.key);
          } else if (action === "inline-code") {
            commands.call(toggleInlineCodeCommand.key);
          } else if (action === "bullet-list") {
            commands.call(wrapInBlockTypeCommand.key, {
              nodeType: bulletListSchema.type(ctx)
            });
          } else if (action === "ordered-list") {
            commands.call(wrapInBlockTypeCommand.key, {
              nodeType: orderedListSchema.type(ctx)
            });
          } else if (action === "task-list") {
            commands.call(wrapInBlockTypeCommand.key, {
              nodeType: bulletListSchema.type(ctx)
            });
            const { $from } = view.state.selection;
            const listItemType = listItemSchema.type(ctx);
            for (let depth = $from.depth; depth > 0; depth -= 1) {
              const node = $from.node(depth);
              if (node.type !== listItemType || node.attrs.checked != null) {
                continue;
              }
              view.dispatch(
                view.state.tr.setNodeMarkup($from.before(depth), undefined, {
                  ...node.attrs,
                  checked: false
                })
              );
              break;
            }
          } else if (action === "link") {
            commands.call(toggleLinkCommand.key, {});
          } else if (action === "quote") {
            commands.call(wrapInBlockTypeCommand.key, {
              nodeType: blockquoteSchema.type(ctx)
            });
          } else if (action === "divider") {
            insertDivider(ctx);
          } else if (action === "code-block") {
            insertCodeBlock(ctx);
          } else if (action === "table") {
            insertTable(ctx);
          } else if (action === "formula") {
            insertFormula(ctx);
          } else if (action === "callout") {
            insertCallout(ctx, "note");
          } else if (action === "toggle") {
            insertToggle(ctx);
          }
          view.focus();
        });
      },
      setLink(href) {
        const crepe = crepeRef.current;
        if (!crepe || !readyRef.current) return;
        crepe.editor.action((ctx) => {
          const commands = ctx.get(commandsCtx);
          commands.call(toggleLinkCommand.key, { href });
          ctx.get(editorViewCtx).focus();
        });
      },
      insertBlock(kind) {
        const crepe = crepeRef.current;
        if (!crepe || !readyRef.current) return;
        crepe.editor.action((ctx) => {
          insertDiagramBlock(
            ctx,
            kind === "mermaid"
              ? mermaidSnippetRef.current
              : canvasSnippetRef.current,
            kind
          );
        });
        if (kind === "canvas") onRequestCanvasRef.current();
      },
      getMarkdown() {
        return crepeRef.current
          ? normalizeProductMarkdown(crepeRef.current.getMarkdown())
          : lastValueRef.current;
      },
      isCurrentBlockEmpty() {
        const crepe = crepeRef.current;
        if (!crepe || !readyRef.current) return false;
        let empty = false;
        crepe.editor.action((ctx) => {
          const selection = ctx.get(editorViewCtx).state.selection;
          empty =
            selection.empty &&
            selection.$from.depth > 0 &&
            selection.$from.parent.content.size === 0;
        });
        return empty;
      },
      setCalloutKind(blockIndex, kind) {
        const crepe = crepeRef.current;
        if (!crepe || !readyRef.current) return;
        crepe.editor.action((ctx) => setCalloutKind(ctx, blockIndex, kind));
      },
      setToggleSummary(blockIndex, summary) {
        const crepe = crepeRef.current;
        if (!crepe || !readyRef.current) return;
        crepe.editor.action((ctx) =>
          setToggleSummary(ctx, blockIndex, summary)
        );
      },
      toggleToggleOpen(blockIndex) {
        const crepe = crepeRef.current;
        if (!crepe || !readyRef.current) return;
        crepe.editor.action((ctx) => toggleToggleOpen(ctx, blockIndex));
      },
      tableAction(action) {
        const crepe = crepeRef.current;
        if (!crepe || !readyRef.current) return;
        crepe.editor.action((ctx) => {
          const view = ctx.get(editorViewCtx);
          if (action === "add-row") {
            addRowAfter(view.state, view.dispatch);
          } else if (action === "delete-row") {
            deleteRow(view.state, view.dispatch);
          } else if (action === "add-column") {
            addColumnAfter(view.state, view.dispatch);
          } else if (action === "delete-column") {
            deleteColumn(view.state, view.dispatch);
          } else {
            setCellAttr(
              "alignment",
              action === "align-center"
                ? "center"
                : action === "align-right"
                  ? "right"
                  : "left"
            )(view.state, view.dispatch);
          }
          view.focus();
        });
      },
      moveTopLevelBlock(fromIndex, toIndex) {
        const crepe = crepeRef.current;
        if (!crepe || !readyRef.current) return;
        crepe.editor.action((ctx) => {
          const view = ctx.get(editorViewCtx);
          const nodes: ProseNode[] = [];
          view.state.doc.forEach((node) => nodes.push(node));
          if (
            fromIndex < 0 ||
            fromIndex >= nodes.length ||
            toIndex < 0 ||
            toIndex >= nodes.length ||
            fromIndex === toIndex
          ) {
            return;
          }
          const [moved] = nodes.splice(fromIndex, 1);
          nodes.splice(toIndex, 0, moved);
          const transaction = view.state.tr.replaceWith(
            0,
            view.state.doc.content.size,
            Fragment.fromArray(nodes)
          );
          view.dispatch(transaction.scrollIntoView());
          view.focus();
        });
      },
      duplicateTopLevelBlock(index) {
        const crepe = crepeRef.current;
        if (!crepe || !readyRef.current) return;
        crepe.editor.action((ctx) => {
          const view = ctx.get(editorViewCtx);
          const nodes: ProseNode[] = [];
          view.state.doc.forEach((node) => nodes.push(node));
          const node = nodes[index];
          if (!node) return;
          const position = topLevelBoundary(view.state.doc, index + 1);
          view.dispatch(view.state.tr.insert(position, node).scrollIntoView());
          view.focus();
        });
      },
      deleteTopLevelBlock(index) {
        const crepe = crepeRef.current;
        if (!crepe || !readyRef.current) return;
        crepe.editor.action((ctx) => {
          const view = ctx.get(editorViewCtx);
          const nodes: ProseNode[] = [];
          view.state.doc.forEach((node) => nodes.push(node));
          if (index < 0 || index >= nodes.length) return;
          if (nodes.length === 1) {
            const paragraph = paragraphSchema.type(ctx).create();
            view.dispatch(
              view.state.tr
                .replaceWith(0, view.state.doc.content.size, paragraph)
                .scrollIntoView()
            );
            view.focus();
            return;
          }
          const start = topLevelBoundary(view.state.doc, index);
          const end = topLevelBoundary(view.state.doc, index + 1);
          view.dispatch(view.state.tr.delete(start, end).scrollIntoView());
          view.focus();
        });
      }
    }),
    []
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    const crepe = new Crepe({
      root: host,
      defaultValue: value,
      features: {
        [CrepeFeature.CodeMirror]: true,
        [CrepeFeature.ListItem]: true,
        [CrepeFeature.LinkTooltip]: false,
        [CrepeFeature.Cursor]: false,
        [CrepeFeature.ImageBlock]: true,
        [CrepeFeature.BlockEdit]: false,
        [CrepeFeature.Toolbar]: false,
        [CrepeFeature.Placeholder]: true,
        [CrepeFeature.Table]: true,
        [CrepeFeature.Latex]: true,
        [CrepeFeature.TopBar]: false,
        [CrepeFeature.AI]: false
      },
      featureConfigs: {
        [CrepeFeature.Placeholder]: {
          text: "开始写作…",
          mode: "doc"
        }
      }
    });
    crepe.editor.use(PRODUCT_BLOCK_PLUGINS);
    crepeRef.current = crepe;
    crepe.on((listener) => {
      listener.updated((ctx) => {
        if (!readyRef.current || suppressChangeRef.current) return;
        const markdown = normalizeProductMarkdown(crepe.getMarkdown());
        lastValueRef.current = markdown;
        onChangeRef.current(markdown);
        syncTitleHeading(host, titleRef.current);
        const selection = ctx.get(editorViewCtx).state.selection;
        onBlockTypeChangeRef.current(blockTypeFromSelection(selection));
        onTableHeaderChangeRef.current?.(isTableHeaderSelection(selection));
      });
      listener.selectionUpdated((_ctx, selection) => {
        onBlockTypeChangeRef.current(blockTypeFromSelection(selection));
        onTableHeaderChangeRef.current?.(isTableHeaderSelection(selection));
      });
    });

    void crepe
      .create()
      .then(() => {
        if (disposed) {
          void crepe.destroy();
          return;
        }
        readyRef.current = true;
        const editor = host.querySelector<HTMLElement>(".ProseMirror");
        editor?.setAttribute("aria-label", "Markdown 正文");
        editor?.setAttribute("role", "textbox");
        editor?.setAttribute("aria-multiline", "true");
        syncTitleHeading(host, titleRef.current);
        setLoading(false);
      })
      .catch(() => {
        if (!disposed) setLoading(false);
      });

    return () => {
      disposed = true;
      if (readyRef.current) {
        const markdown = normalizeProductMarkdown(crepe.getMarkdown());
        if (markdown !== lastValueRef.current) {
          lastValueRef.current = markdown;
          onChangeRef.current(markdown);
        }
      }
      readyRef.current = false;
      crepeRef.current = undefined;
      void crepe.destroy();
    };
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !readyRef.current) return;
    syncTitleHeading(host, title);
  }, [title]);

  useEffect(() => {
    const crepe = crepeRef.current;
    if (!crepe || !readyRef.current || value === lastValueRef.current) return;
    suppressChangeRef.current = true;
    lastValueRef.current = value;
    crepe.editor.action(replaceAll(value, true));
    suppressChangeRef.current = false;
  }, [value]);

  return (
    <div className={cn("rich-markdown-shell relative min-h-0", className)}>
      <div ref={hostRef} className="milkdown-host h-full" />
      {loading && (
        <div className="absolute inset-0 grid place-items-center bg-paper text-xs font-medium text-ink-400">
          正在准备所见即所得编辑区…
        </div>
      )}
    </div>
  );
});

function syncTitleHeading(host: HTMLElement, title: string) {
  const firstHeading = host.querySelector<HTMLElement>(
    ".ProseMirror > h1:first-of-type"
  );
  if (!firstHeading) return;
  const isDocumentTitle =
    firstHeading.textContent?.trim() === title.trim() && title.trim().length > 0;
  firstHeading.toggleAttribute("data-document-title", isDocumentTitle);
}

function blockTypeFromSelection(selection: Selection): MarkdownBlockType {
  const { $from } = selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (node.type.name === "table") return "table";
    if (node.type.name === "inkloom_toggle") return "toggle";
    if (node.type.name === "blockquote") {
      return /^\[!(?:NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i.test(
        node.firstChild?.textContent ?? ""
      )
        ? "callout"
        : "quote";
    }
    if (node.type.name === "bullet_list") {
      const listItem = $from.node(Math.max(1, depth - 1));
      return listItem.attrs.checked == null ? "bullet-list" : "task-list";
    }
    if (node.type.name === "ordered_list") return "ordered-list";
    if (node.type.name === "code_block") {
      return String(node.attrs.language).toLowerCase() === "latex"
        ? "formula"
        : "code-block";
    }
    if (node.type.name === "heading") {
      return `heading-${String(node.attrs.level)}` as MarkdownBlockType;
    }
  }
  return "paragraph";
}

function normalizeProductMarkdown(markdown: string) {
  return markdown.replace(
    /^(>\s*)\\\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?=\s|$)/gm,
    "$1[!$2]"
  );
}

function isTableHeaderSelection(selection: Selection) {
  const { $from } = selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === "table_header") return true;
  }
  return false;
}

function topLevelBoundary(
  doc: { childCount: number; child(index: number): ProseNode },
  boundaryIndex: number
): number {
  let position = 0;
  const count = Math.min(boundaryIndex, doc.childCount);
  for (let index = 0; index < count; index += 1) {
    position += doc.child(index).nodeSize;
  }
  return position;
}

function insertDiagramBlock(
  ctx: Ctx,
  source: string,
  language: "mermaid" | "canvas"
) {
  const view = ctx.get(editorViewCtx);
  const schema = ctx.get(schemaCtx);
  const codeBlock = codeBlockSchema.type(ctx);
  const node = codeBlock.create(
    { language: language === "canvas" ? "excalidraw" : "mermaid" },
    schema.text(source)
  );
  const { $from } = view.state.selection;
  const position =
    $from.depth > 0 ? $from.after(1) : view.state.doc.content.size;
  const transaction = view.state.tr.insert(position, node);
  transaction.setSelection(
    TextSelection.near(transaction.doc.resolve(position + 1))
  );
  view.dispatch(transaction.scrollIntoView());
  view.focus();
}
