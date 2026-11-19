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
  addBlockTypeCommand,
  blockquoteSchema,
  bulletListSchema,
  codeBlockSchema,
  headingSchema,
  hrSchema,
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
import {
  createTable,
  toggleStrikethroughCommand
} from "@milkdown/kit/preset/gfm";
import { redo, undo } from "@milkdown/kit/prose/history";
import { TextSelection } from "@milkdown/kit/prose/state";
import { replaceAll } from "@milkdown/kit/utils";
import type { MarkdownBlockType } from "./markdown-block-type";
import { cn } from "../../lib/utils";
import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/classic.css";

export type RichMarkdownEditorHandle = {
  focus: () => void;
  setHeading: (level: 1 | 2 | 3 | null) => void;
  run: (action: RichToolbarAction) => void;
  setLink: (href: string) => void;
  insertBlock: (kind: "mermaid" | "canvas") => void;
  getMarkdown: () => string;
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
  | "table";

export const RichMarkdownEditor = forwardRef<
  RichMarkdownEditorHandle,
  {
    value: string;
    title: string;
    mermaidSnippet: string;
    canvasSnippet: string;
    onChange: (value: string) => void;
    onBlockTypeChange: (type: MarkdownBlockType) => void;
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
  const onRequestCanvasRef = useRef(onRequestCanvas);
  const mermaidSnippetRef = useRef(mermaidSnippet);
  const canvasSnippetRef = useRef(canvasSnippet);
  const [loading, setLoading] = useState(true);

  onChangeRef.current = onChange;
  onBlockTypeChangeRef.current = onBlockTypeChange;
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
              nodeType: listItemSchema.type(ctx),
              attrs: { checked: false }
            });
          } else if (action === "link") {
            commands.call(toggleLinkCommand.key, {});
          } else if (action === "quote") {
            commands.call(wrapInBlockTypeCommand.key, {
              nodeType: blockquoteSchema.type(ctx)
            });
          } else if (action === "divider") {
            commands.call(addBlockTypeCommand.key, {
              nodeType: hrSchema.type(ctx)
            });
          } else if (action === "code-block") {
            commands.call(addBlockTypeCommand.key, {
              nodeType: codeBlockSchema.type(ctx)
            });
          } else if (action === "table") {
            commands.call(addBlockTypeCommand.key, {
              nodeType: createTable(ctx, 3, 3)
            });
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
        return crepeRef.current?.getMarkdown() ?? lastValueRef.current;
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
        [CrepeFeature.CodeMirror]: false,
        [CrepeFeature.ListItem]: true,
        [CrepeFeature.LinkTooltip]: false,
        [CrepeFeature.Cursor]: true,
        [CrepeFeature.ImageBlock]: true,
        [CrepeFeature.BlockEdit]: false,
        [CrepeFeature.Toolbar]: false,
        [CrepeFeature.Placeholder]: true,
        [CrepeFeature.Table]: true,
        [CrepeFeature.Latex]: false,
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
    crepeRef.current = crepe;
    crepe.on((listener) => {
      listener.updated((ctx) => {
        if (!readyRef.current || suppressChangeRef.current) return;
        const markdown = crepe.getMarkdown();
        lastValueRef.current = markdown;
        onChangeRef.current(markdown);
        syncTitleHeading(host, titleRef.current);
        const selection = ctx.get(editorViewCtx).state.selection;
        onBlockTypeChangeRef.current(blockTypeFromNode(selection.$from.parent));
      });
      listener.selectionUpdated((_ctx, selection) => {
        onBlockTypeChangeRef.current(
          blockTypeFromNode(selection.$from.parent)
        );
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
        const markdown = crepe.getMarkdown();
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

function blockTypeFromNode(node: {
  type: { name: string };
  attrs: Record<string, unknown>;
}): MarkdownBlockType {
  return node.type.name === "heading"
    ? (`heading-${String(node.attrs.level)}` as MarkdownBlockType)
    : "paragraph";
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
