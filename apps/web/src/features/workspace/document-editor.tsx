import {
  lazy,
  Suspense,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode
} from "react";
import {
  Bold,
  Code2,
  HardDrive,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Network,
  Plus,
  Quote,
  Redo2,
  Strikethrough,
  Table2,
  Tag,
  Undo2
} from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { countWords, extractHeadings } from "@inkloom/editor";
import type { CanvasScene } from "@inkloom/diagrams";
import type { Note } from "../../data";
import { AppDialog } from "../../components/ui/app-dialog";
import { Button } from "../../components/ui/button";
import { FieldLabel, TextInput } from "../../components/ui/field";
import type { MarkdownBlockType } from "./markdown-block-type";
import { formatTime } from "./note-utils";
import type {
  RichMarkdownEditorHandle,
  RichToolbarAction
} from "./rich-markdown-editor";

const RichMarkdownEditor = lazy(() =>
  import("./rich-markdown-editor").then((module) => ({
    default: module.RichMarkdownEditor
  }))
);

export function DocumentEditor({
  note,
  onContentChange,
  onManageTags,
  onOpenCanvas,
  onCanvasChange,
  onOutline
}: {
  note: Note;
  onContentChange: (content: string) => void;
  onManageTags: () => void;
  onOpenCanvas: () => void;
  onCanvasChange: (canvas: CanvasScene) => void;
  onOutline: (headings: ReturnType<typeof extractHeadings>) => void;
}) {
  const [content, setContent] = useState(note.content);
  const [blockType, setBlockType] = useState<MarkdownBlockType>("paragraph");
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("https://");
  const [linkError, setLinkError] = useState("");
  const deferredContent = useDeferredValue(content);
  const richRef = useRef<RichMarkdownEditorHandle>(null);

  useEffect(() => {
    setContent(note.content);
  }, [note.id, note.content]);

  const outline = useMemo(
    () => extractHeadings(deferredContent),
    [deferredContent]
  );

  useEffect(() => {
    onOutline(outline);
  }, [outline, onOutline]);

  function updateContent(next: string) {
    setContent(next);
    onContentChange(next);
  }

  function updateBlockType(next: MarkdownBlockType) {
    setBlockType((current) => (current === next ? current : next));
  }

  function applyHeading(level: 1 | 2 | 3 | null) {
    richRef.current?.setHeading(level);
  }

  function runRich(action: RichToolbarAction) {
    richRef.current?.run(action);
  }

  function openLinkDialog() {
    setLinkUrl("https://");
    setLinkError("");
    setLinkOpen(true);
  }

  function submitLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const href = linkUrl.trim();
    if (!href || href === "https://") {
      setLinkError("请输入链接地址。");
      return;
    }
    richRef.current?.setLink(href);
    setLinkOpen(false);
  }

  function insertCanvas() {
    const scene = note.canvas ?? { title: "自由画布", elements: [] };
    onCanvasChange(scene);
    if (!content.includes("```excalidraw")) {
      richRef.current?.insertBlock("canvas");
    }
  }

  function requestCanvasEditor() {
    const scene = note.canvas ?? { title: "自由画布", elements: [] };
    onCanvasChange(scene);
    onOpenCanvas();
  }

  function insertMermaid() {
    richRef.current?.insertBlock("mermaid");
  }

  return (
    <div className="document-canvas flex min-h-0 flex-1 flex-col">
      <div className="document-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <article className="document-paper relative mx-auto my-0 w-full max-w-[92rem] bg-paper shadow-[0_1px_0_rgb(255_255_255_/_0.9),0_26px_70px_rgb(33_65_52_/_0.07)] lg:my-5 lg:rounded-[1.35rem]">
          <div className="block-style-bar sticky top-0 z-30 flex min-h-12 flex-nowrap items-center gap-2 overflow-x-auto border-b border-line-soft bg-paper/96 px-[clamp(.75rem,2vw,1.2rem)] py-1.5 backdrop-blur-md">
            <div
              className="flex min-w-max items-center gap-1"
              role="toolbar"
              aria-label="文档格式"
            >
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button
                    className="grid size-8 place-items-center rounded-lg bg-brand-700 text-white shadow-sm transition hover:bg-brand-800 focus-visible:ring-4 focus-visible:ring-brand-200/60 focus-visible:outline-none"
                    type="button"
                    aria-label="插入内容"
                    title="在正文中添加内容"
                  >
                    <Plus size={16} />
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    align="start"
                    sideOffset={8}
                    className="z-50 w-60 rounded-2xl border border-line bg-paper p-2 shadow-[0_20px_55px_rgb(24_53_42_/_0.2)]"
                  >
                    <MenuLabel>图表</MenuLabel>
                    <InsertMenuItem
                      icon={<Network size={16} />}
                      label="Mermaid 流程图"
                      hint="可编辑源码"
                      onSelect={insertMermaid}
                    />
                    <InsertMenuItem
                      icon={<ImagePlus size={16} />}
                      label="Excalidraw 画板"
                      hint="自由绘制"
                      onSelect={insertCanvas}
                    />
                    <DropdownMenu.Separator className="my-1.5 h-px bg-line-soft" />
                    <MenuLabel>内容</MenuLabel>
                    <InsertMenuItem
                      icon={<Code2 size={16} />}
                      label="代码块"
                      hint="/code"
                      onSelect={() => runRich("code-block")}
                    />
                    <InsertMenuItem
                      icon={<Table2 size={16} />}
                      label="表格"
                      hint="3 × 3"
                      onSelect={() => runRich("table")}
                    />
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
              <ToolbarButton label="撤销" onClick={() => runRich("undo")}>
                <Undo2 size={15} />
              </ToolbarButton>
              <ToolbarButton label="重做" onClick={() => runRich("redo")}>
                <Redo2 size={15} />
              </ToolbarButton>
              <span className="mx-1 h-5 w-px bg-line" />
              <select
                className="h-8 min-w-[4.4rem] rounded-lg border border-line bg-white px-2 text-xs font-semibold text-ink-700 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                aria-label="段落类型"
                value={
                  blockType.startsWith("heading-")
                    ? `heading-${blockType.at(-1)}`
                    : "paragraph"
                }
                onChange={(event) =>
                  applyHeading(
                    event.target.value === "paragraph"
                      ? null
                      : (Number(event.target.value.at(-1)) as 1 | 2 | 3)
                  )
                }
              >
                <option value="paragraph">正文</option>
                <option value="heading-1">H1 标题</option>
                <option value="heading-2">H2 标题</option>
                <option value="heading-3">H3 标题</option>
              </select>
              <span className="mx-1 h-5 w-px bg-line" />
              <ToolbarButton label="加粗" onClick={() => runRich("bold")}>
                <Bold size={15} />
              </ToolbarButton>
              <ToolbarButton label="斜体" onClick={() => runRich("italic")}>
                <Italic size={15} />
              </ToolbarButton>
              <ToolbarButton label="删除线" onClick={() => runRich("strike")}>
                <Strikethrough size={15} />
              </ToolbarButton>
              <ToolbarButton label="行内代码" onClick={() => runRich("inline-code")}>
                <Code2 size={15} />
              </ToolbarButton>
              <span className="mx-1 h-5 w-px bg-line" />
              <ToolbarButton label="无序列表" onClick={() => runRich("bullet-list")}>
                <List size={15} />
              </ToolbarButton>
              <ToolbarButton label="有序列表" onClick={() => runRich("ordered-list")}>
                <ListOrdered size={15} />
              </ToolbarButton>
              <ToolbarButton label="任务列表" onClick={() => runRich("task-list")}>
                <ListChecks size={15} />
              </ToolbarButton>
              <ToolbarButton label="链接" onClick={openLinkDialog}>
                <Link2 size={15} />
              </ToolbarButton>
              <ToolbarButton label="引用" onClick={() => runRich("quote")}>
                <Quote size={15} />
              </ToolbarButton>
              <ToolbarButton label="分隔线" onClick={() => runRich("divider")}>
                <Minus size={15} />
              </ToolbarButton>
              <ToolbarButton label="代码块" onClick={() => runRich("code-block")}>
                <Code2 size={16} />
              </ToolbarButton>
              <ToolbarButton label="表格" onClick={() => runRich("table")}>
                <Table2 size={15} />
              </ToolbarButton>
              <span className="mx-1 h-5 w-px bg-line" />
              <ToolbarButton label="管理标签" onClick={onManageTags}>
                <Tag size={15} />
              </ToolbarButton>
            </div>
          </div>

          <Suspense fallback={<EditorLoading />}>
            <RichMarkdownEditor
              ref={richRef}
              value={content}
              title={note.title}
              mermaidSnippet={MERMAID_SNIPPET}
              canvasSnippet={`id: ${note.id}\ntitle: ${
                note.canvas?.title ?? "自由画布"
              }\nsrc: ./assets/${note.id}.excalidraw`}
              onChange={updateContent}
              onBlockTypeChange={updateBlockType}
              onRequestCanvas={requestCanvasEditor}
              className="min-h-[68dvh]"
            />
          </Suspense>

          <footer className="document-footer flex flex-wrap items-center justify-between gap-2 border-t border-line-soft px-[clamp(1rem,3vw,2.5rem)] py-3 text-[0.68rem] font-medium text-ink-400">
            <span className="flex min-w-0 items-center gap-1.5">
              <HardDrive size={12} className="shrink-0" />
              <span className="truncate">{note.filePath}</span>
            </span>
            <span>{note.folder}</span>
            <span>{formatTime(note.updatedAt)}</span>
            <span>{countWords(content).toLocaleString("zh-CN")} 字</span>
          </footer>
        </article>
      </div>
      <AppDialog
        open={linkOpen}
        title="添加链接"
        description="先选中文字，再填写链接地址。"
        onClose={() => setLinkOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setLinkOpen(false)}>
              取消
            </Button>
            <Button
              variant="primary"
              type="submit"
              form="document-link-form"
            >
              添加链接
            </Button>
          </>
        }
      >
        <form
          id="document-link-form"
          className="grid gap-4"
          onSubmit={submitLink}
        >
          <FieldLabel>
            链接地址
            <TextInput
              value={linkUrl}
              onChange={(event) => {
                setLinkUrl(event.target.value);
                setLinkError("");
              }}
              type="url"
              placeholder="https://example.com"
              aria-invalid={Boolean(linkError)}
              autoFocus
            />
          </FieldLabel>
          {linkError && (
            <p className="rounded-lg bg-danger-50 px-3 py-2 text-xs text-danger-700" role="alert">
              {linkError}
            </p>
          )}
        </form>
      </AppDialog>
    </div>
  );
}

function ToolbarButton({
  label,
  onClick,
  children
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      className="grid size-8 place-items-center rounded-lg text-ink-500 transition hover:bg-brand-50 hover:text-brand-700 focus-visible:ring-4 focus-visible:ring-brand-200/60 focus-visible:outline-none"
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <DropdownMenu.Label className="px-2 py-1.5 text-[0.62rem] font-bold tracking-[0.08em] text-ink-300 uppercase">
      {children}
    </DropdownMenu.Label>
  );
}

function InsertMenuItem({
  icon,
  label,
  hint,
  onSelect
}: {
  icon: ReactNode;
  label: string;
  hint: string;
  onSelect: () => void;
}) {
  return (
    <DropdownMenu.Item
      className="flex min-h-11 cursor-default items-center gap-2.5 rounded-lg px-2 outline-none data-[highlighted]:bg-brand-50"
      onSelect={onSelect}
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <strong className="block text-xs font-semibold text-ink-800">
          {label}
        </strong>
        <small className="mt-0.5 block text-[0.62rem] text-ink-400">
          {hint}
        </small>
      </span>
    </DropdownMenu.Item>
  );
}

function EditorLoading() {
  return (
    <div className="grid min-h-[58dvh] place-items-center text-xs font-medium text-ink-400">
      正在准备文档编辑区…
    </div>
  );
}

const MERMAID_SNIPPET =
  "flowchart LR\n  A[输入] --> B{判断}\n  B -->|是| C[完成]\n  B -->|否| D[调整]";
