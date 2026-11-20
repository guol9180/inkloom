import {
  lazy,
  forwardRef,
  Suspense,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode
} from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Bold,
  Code2,
  Copy,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Pilcrow,
  Quote,
  Redo2,
  Strikethrough,
  Table2,
  Trash2,
  Undo2
} from "lucide-react";
import { AppDialog } from "../../components/ui/app-dialog";
import { Button } from "../../components/ui/button";
import { FieldLabel, TextInput } from "../../components/ui/field";
import type {
  RichMarkdownEditorHandle,
  RichToolbarAction
} from "../workspace/rich-markdown-editor";
import type { MarkdownBlockType } from "../workspace/markdown-block-type";
import {
  commandShortcutMatches,
  EDITOR_COMMANDS,
  filterSlashCommands,
  TOOLBAR_COMMANDS,
  type EditorCommandDefinition,
  type EditorCommandId
} from "./command-registry";

const RichMarkdownEditor = lazy(() =>
  import("../workspace/rich-markdown-editor").then((module) => ({
    default: module.RichMarkdownEditor
  }))
);

type BlockHandle = {
  index: number;
  top: number;
  height: number;
  lineHeight: number;
};

type FloatingPosition = {
  top: number;
  left: number;
};

export type ProductMarkdownEditorHandle = {
  getMarkdown: () => string;
  focus: () => void;
};

export const ProductMarkdownEditor = forwardRef<
  ProductMarkdownEditorHandle,
  {
  value: string;
  title: string;
  onChange: (value: string) => void;
  onFocusSearch: () => void;
  }
>(function ProductMarkdownEditor(
  { value, title, onChange, onFocusSearch },
  ref
) {
  const rootRef = useRef<HTMLDivElement>(null);
  const handleLayerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<RichMarkdownEditorHandle>(null);
  const [blockType, setBlockType] = useState<MarkdownBlockType>("paragraph");
  const [handles, setHandles] = useState<BlockHandle[]>([]);
  const [draggingIndex, setDraggingIndex] = useState<number>();
  const [dropIndex, setDropIndex] = useState<number>();
  const [openMenuIndex, setOpenMenuIndex] = useState<number>();
  const pointerDragRef = useRef<{
    from: number;
    pointerId: number;
    startY: number;
    moved: boolean;
  } | undefined>(undefined);
  const [selection, setSelection] = useState<FloatingPosition>();
  const [slash, setSlash] = useState<{
    position: FloatingPosition;
    query: string;
    activeIndex: number;
  }>();
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("https://");
  const [linkError, setLinkError] = useState("");

  useImperativeHandle(
    ref,
    () => ({
      getMarkdown: () =>
        editorRef.current?.getMarkdown() ?? value,
      focus: () => editorRef.current?.focus()
    }),
    [value]
  );

  const syncHandles = useCallback(() => {
    const root = rootRef.current;
    const handleLayer = handleLayerRef.current;
    const editor = root?.querySelector<HTMLElement>(".ProseMirror");
    if (!root || !handleLayer || !editor) return;
    const layerRect = handleLayer.getBoundingClientRect();
    const blocks = [...editor.children].filter(
      (element) =>
        !element.classList.contains("prosemirror-virtual-cursor") &&
        element.getAttribute("contenteditable") !== "false"
    );
    const next = blocks.map((element, index) => {
      const rect = (element as HTMLElement).getBoundingClientRect();
      const computed = window.getComputedStyle(element);
      const parsedLineHeight = Number.parseFloat(computed.lineHeight);
      return {
        index,
        top: rect.top - layerRect.top,
        height: rect.height,
        lineHeight:
          Number.isFinite(parsedLineHeight) && parsedLineHeight > 0
            ? parsedLineHeight
            : Math.min(rect.height, 28)
      };
    });
    setHandles(next);
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const observer = new MutationObserver(() => {
      window.requestAnimationFrame(syncHandles);
    });
    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true
    });
    const resize = new ResizeObserver(syncHandles);
    resize.observe(root);
    const sync = () => window.requestAnimationFrame(syncHandles);
    window.addEventListener("resize", sync);
    sync();
    return () => {
      observer.disconnect();
      resize.disconnect();
      window.removeEventListener("resize", sync);
    };
  }, [syncHandles]);

  useEffect(() => {
    function syncSelection() {
      const root = rootRef.current;
      const editor = root?.querySelector<HTMLElement>(".ProseMirror");
      const activeSelection = window.getSelection();
      if (
        !root ||
        !editor ||
        !activeSelection ||
        activeSelection.isCollapsed ||
        !activeSelection.rangeCount ||
        !editor.contains(activeSelection.anchorNode)
      ) {
        setSelection(undefined);
        return;
      }
      const rect = activeSelection.getRangeAt(0).getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        setSelection(undefined);
        return;
      }
      setSelection({
        top: Math.max(8, rect.top - 48),
        left: Math.max(8, rect.left + rect.width / 2)
      });
    }
    document.addEventListener("selectionchange", syncSelection);
    return () => document.removeEventListener("selectionchange", syncSelection);
  }, []);

  useEffect(() => {
    if (!slash) return;
    function close(event: PointerEvent) {
      if (!(event.target as Element | null)?.closest("[data-slash-menu]")) {
        setSlash(undefined);
      }
    }
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [slash]);

  const slashCommands = useMemo(
    () => filterSlashCommands(slash?.query ?? ""),
    [slash?.query]
  );

  function targetBlockAt(clientY: number): number | undefined {
    const handleLayer = handleLayerRef.current;
    if (!handleLayer || handles.length === 0) return undefined;
    const layerTop = handleLayer.getBoundingClientRect().top;
    let nearest = handles[0];
    let distance = Number.POSITIVE_INFINITY;
    for (const handle of handles) {
      const center = layerTop + handle.top + handle.lineHeight / 2;
      const nextDistance = Math.abs(clientY - center);
      if (nextDistance < distance) {
        nearest = handle;
        distance = nextDistance;
      }
    }
    return nearest.index;
  }

  function executeCommand(command: EditorCommandId) {
    if (command === "link") {
      setLinkUrl("https://");
      setLinkError("");
      setLinkOpen(true);
      return;
    }
    if (command === "paragraph") {
      editorRef.current?.setHeading(null);
    } else if (
      command === "heading-1" ||
      command === "heading-2" ||
      command === "heading-3"
    ) {
      editorRef.current?.setHeading(
        Number(command.at(-1)) as 1 | 2 | 3
      );
    } else {
      editorRef.current?.run(command as RichToolbarAction);
    }
    window.requestAnimationFrame(syncHandles);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "j") {
      event.preventDefault();
      onFocusSearch();
      return;
    }
    if (slash) {
      if (event.key === "Escape") {
        event.preventDefault();
        setSlash(undefined);
        return;
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const direction = event.key === "ArrowDown" ? 1 : -1;
        setSlash((current) =>
          current
            ? {
                ...current,
                activeIndex:
                  (current.activeIndex + direction + slashCommands.length) %
                  Math.max(1, slashCommands.length)
              }
            : current
        );
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        const command = slashCommands[slash.activeIndex];
        if (command) executeCommand(command.id);
        setSlash(undefined);
        return;
      }
      if (event.key === "Backspace" && slash.query.length > 0) {
        event.preventDefault();
        setSlash((current) =>
          current
            ? { ...current, query: current.query.slice(0, -1), activeIndex: 0 }
            : current
        );
        return;
      }
      if (
        event.key.length === 1 &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        event.preventDefault();
        setSlash((current) =>
          current
            ? {
                ...current,
                query: `${current.query}${event.key}`,
                activeIndex: 0
              }
            : current
        );
        return;
      }
    }
    for (const command of EDITOR_COMMANDS) {
      if (!commandShortcutMatches(command.id, event.nativeEvent)) continue;
      event.preventDefault();
      executeCommand(command.id);
      return;
    }
    if (event.key === "/" && editorRef.current?.isCurrentBlockEmpty()) {
      event.preventDefault();
      const position = currentCaretPosition();
      setSlash({
        position,
        query: "",
        activeIndex: 0
      });
    }
  }

  function submitLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const href = linkUrl.trim();
    if (!href || href === "https://") {
      setLinkError("请输入链接地址。");
      return;
    }
    editorRef.current?.setLink(href);
    setLinkOpen(false);
  }

  return (
    <div
      ref={rootRef}
      className="product-markdown-editor relative min-h-0"
      onKeyDownCapture={handleKeyDown}
    >
      <div
        className="sticky top-0 z-30 flex min-h-12 items-center gap-1 overflow-x-auto border-b border-line-soft bg-white/96 px-3 py-1.5 backdrop-blur-md"
        role="toolbar"
        aria-label="文档格式"
      >
        {TOOLBAR_COMMANDS.map((command, index) => {
          const previous = TOOLBAR_COMMANDS[index - 1];
          const separator = previous && previous.group !== command.group;
          return (
            <span className="contents" key={command.id}>
              {separator && <span className="mx-1 h-5 w-px shrink-0 bg-line" />}
              <button
                type="button"
                className={`grid h-8 min-w-8 shrink-0 place-items-center rounded-lg px-1.5 text-[0.68rem] font-semibold transition hover:bg-[#f2f5f2] hover:text-brand-800 focus-visible:ring-4 focus-visible:ring-brand-100 ${
                  commandIdMatchesBlockType(command.id, blockType)
                    ? "bg-[#eef3ef] text-brand-800"
                    : "text-ink-500"
                }`}
                title={
                  command.hint ? `${command.label} · ${command.hint}` : command.label
                }
                aria-label={command.label}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => executeCommand(command.id)}
              >
                <CommandIcon command={command} />
              </button>
            </span>
          );
        })}
      </div>

      <div ref={handleLayerRef} className="relative min-h-[calc(100dvh-7rem)]">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-20 w-12">
          {handles.map((handle) => (
            <DropdownMenu.Root
              key={`${handle.index}-${handle.top}`}
              open={openMenuIndex === handle.index}
              onOpenChange={(open) =>
                setOpenMenuIndex(open ? handle.index : undefined)
              }
            >
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  className={`pm-block-handle pointer-events-auto absolute grid h-7 w-7 place-items-center rounded-lg text-[1rem] leading-none text-ink-300 outline-none transition hover:bg-[#f2f5f2] hover:text-ink-700 data-[dragging=true]:bg-brand-50 data-[drop=true]:bg-brand-100 ${
                    dropIndex === handle.index ? "bg-brand-100 text-brand-800" : ""
                  }`}
                  style={{
                    top:
                      handle.top +
                      Math.max(0, (handle.lineHeight - 28) / 2)
                  }}
                  aria-label={`块 ${handle.index + 1} 操作`}
                  data-dragging={draggingIndex === handle.index}
                  data-drop={dropIndex === handle.index}
                  onPointerDown={(event) => {
                    if (event.button !== 0) return;
                    event.currentTarget.setPointerCapture(event.pointerId);
                    pointerDragRef.current = {
                      from: handle.index,
                      pointerId: event.pointerId,
                      startY: event.clientY,
                      moved: false
                    };
                  }}
                  onPointerMove={(event) => {
                    const drag = pointerDragRef.current;
                    if (!drag || drag.pointerId !== event.pointerId) return;
                    if (
                      !drag.moved &&
                      Math.abs(event.clientY - drag.startY) < 6
                    ) {
                      return;
                    }
                    drag.moved = true;
                    setOpenMenuIndex(undefined);
                    setDraggingIndex(drag.from);
                    setDropIndex(targetBlockAt(event.clientY));
                  }}
                  onPointerUp={(event) => {
                    const drag = pointerDragRef.current;
                    pointerDragRef.current = undefined;
                    if (!drag || drag.pointerId !== event.pointerId) return;
                    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                      event.currentTarget.releasePointerCapture(event.pointerId);
                    }
                    if (drag.moved) {
                      event.preventDefault();
                      event.stopPropagation();
                      const target = targetBlockAt(event.clientY);
                      if (target !== undefined && target !== drag.from) {
                        editorRef.current?.moveTopLevelBlock(drag.from, target);
                      }
                    }
                    setDraggingIndex(undefined);
                    setDropIndex(undefined);
                    window.requestAnimationFrame(syncHandles);
                  }}
                >
                  ⠿
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  side="right"
                  align="start"
                  sideOffset={4}
                  className="z-[70] w-44 rounded-xl border border-line-soft bg-white p-1.5 shadow-[0_18px_50px_rgb(20_36_28_/_0.14)]"
                >
                  <BlockMenuItem
                    icon={<Pilcrow size={14} />}
                    label="转为正文"
                    onSelect={() => editorRef.current?.setHeading(null)}
                  />
                  <BlockMenuItem
                    icon={<Heading1 size={14} />}
                    label="转为一级标题"
                    onSelect={() => editorRef.current?.setHeading(1)}
                  />
                  <BlockMenuItem
                    icon={<Heading2 size={14} />}
                    label="转为二级标题"
                    onSelect={() => editorRef.current?.setHeading(2)}
                  />
                  <DropdownMenu.Separator className="my-1 h-px bg-line-soft" />
                  <BlockMenuItem
                    icon={<Copy size={14} />}
                    label="复制此块"
                    onSelect={() =>
                      editorRef.current?.duplicateTopLevelBlock(handle.index)
                    }
                  />
                  <BlockMenuItem
                    danger
                    icon={<Trash2 size={14} />}
                    label="删除此块"
                    onSelect={() =>
                      editorRef.current?.deleteTopLevelBlock(handle.index)
                    }
                  />
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          ))}
        </div>

        <Suspense fallback={<EditorSkeleton />}>
          <RichMarkdownEditor
            ref={editorRef}
            value={value}
            title={title}
            mermaidSnippet={"flowchart LR\n  A[开始] --> B[完成]"}
            canvasSnippet={""}
            onChange={(next) => {
              onChange(next);
              window.requestAnimationFrame(syncHandles);
            }}
            onBlockTypeChange={(next) => {
              setBlockType(next);
              window.requestAnimationFrame(syncHandles);
            }}
            onRequestCanvas={() => undefined}
            className="min-h-[calc(100dvh-7rem)]"
          />
        </Suspense>
      </div>

      {selection && (
        <div
          className="fixed z-[80] -translate-x-1/2 rounded-xl border border-line-soft bg-white p-1 shadow-[0_14px_40px_rgb(20_36_28_/_0.16)]"
          style={{ top: selection.top, left: selection.left }}
          role="toolbar"
          aria-label="选区格式"
          onMouseDown={(event) => event.preventDefault()}
        >
          {(["bold", "italic", "strike", "inline-code", "link"] as const).map(
            (command) => (
              <button
                type="button"
                className="grid size-8 place-items-center rounded-lg text-ink-500 hover:bg-[#f2f5f2] hover:text-ink-900"
                key={command}
                aria-label={editorCommandLabel(command)}
                onClick={() => executeCommand(command)}
              >
                <SelectionCommandIcon command={command} />
              </button>
            )
          )}
        </div>
      )}

      {slash && (
        <div
          data-slash-menu
          className="fixed z-[90] w-[min(88vw,19rem)] rounded-2xl border border-line-soft bg-white p-2 shadow-[0_22px_65px_rgb(20_36_28_/_0.18)]"
          style={{
            top: Math.max(
              8,
              Math.min(window.innerHeight - 420, slash.position.top + 28)
            ),
            left: Math.max(
              8,
              Math.min(window.innerWidth - 320, slash.position.left)
            )
          }}
        >
          <div className="px-2 py-1.5 text-[0.62rem] font-bold tracking-[0.1em] text-ink-300 uppercase">
            {slash.query ? `/${slash.query}` : "插入内容"}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {slashCommands.map((command, index) => (
              <button
                type="button"
                key={command.id}
                className={`flex min-h-10 w-full items-center gap-2 rounded-xl px-2.5 text-left text-xs ${
                  index === slash.activeIndex
                    ? "bg-[#eef3ef] text-ink-950"
                    : "text-ink-600 hover:bg-[#f7f8f6]"
                }`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  executeCommand(command.id);
                  setSlash(undefined);
                }}
              >
                <span className="grid size-7 place-items-center rounded-lg bg-brand-50 text-brand-700">
                  <CommandIcon command={command} />
                </span>
                <span className="min-w-0 flex-1 truncate font-semibold">
                  {command.label}
                </span>
                {index === slash.activeIndex && (
                  <span className="text-[0.6rem] text-ink-300">Enter</span>
                )}
              </button>
            ))}
            {slashCommands.length === 0 && (
              <p className="px-3 py-8 text-center text-xs text-ink-400">
                没有匹配的命令
              </p>
            )}
          </div>
        </div>
      )}

      <AppDialog
        open={linkOpen}
        title="添加链接"
        description="为当前选区添加链接地址。"
        onClose={() => setLinkOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setLinkOpen(false)}>
              取消
            </Button>
            <Button variant="primary" type="submit" form="product-link-form">
              添加链接
            </Button>
          </>
        }
      >
        <form id="product-link-form" className="grid gap-4" onSubmit={submitLink}>
          <FieldLabel>
            链接地址
            <TextInput
              autoFocus
              type="url"
              value={linkUrl}
              onChange={(event) => {
                setLinkUrl(event.target.value);
                setLinkError("");
              }}
              placeholder="https://example.com"
            />
          </FieldLabel>
          {linkError && (
            <p className="rounded-lg bg-danger-50 px-3 py-2 text-xs text-danger-700">
              {linkError}
            </p>
          )}
        </form>
      </AppDialog>
    </div>
  );
});

function CommandIcon({ command }: { command: EditorCommandDefinition }) {
  switch (command.id) {
    case "undo":
      return <Undo2 size={15} />;
    case "redo":
      return <Redo2 size={15} />;
    case "paragraph":
      return <Pilcrow size={15} />;
    case "heading-1":
      return <Heading1 size={16} />;
    case "heading-2":
      return <Heading2 size={16} />;
    case "heading-3":
      return <Heading3 size={16} />;
    case "bold":
      return <Bold size={15} />;
    case "italic":
      return <Italic size={15} />;
    case "strike":
      return <Strikethrough size={15} />;
    case "inline-code":
    case "code-block":
      return <Code2 size={15} />;
    case "bullet-list":
      return <List size={15} />;
    case "ordered-list":
      return <ListOrdered size={15} />;
    case "task-list":
      return <ListChecks size={15} />;
    case "link":
      return <Link2 size={15} />;
    case "quote":
      return <Quote size={15} />;
    case "divider":
      return <Minus size={15} />;
    case "table":
      return <Table2 size={15} />;
  }
}

function SelectionCommandIcon({
  command
}: {
  command: "bold" | "italic" | "strike" | "inline-code" | "link";
}) {
  if (command === "bold") return <Bold size={14} />;
  if (command === "italic") return <Italic size={14} />;
  if (command === "strike") return <Strikethrough size={14} />;
  if (command === "inline-code") return <Code2 size={14} />;
  return <Link2 size={14} />;
}

function BlockMenuItem({
  icon,
  label,
  danger = false,
  onSelect
}: {
  icon: ReactNode;
  label: string;
  danger?: boolean;
  onSelect: () => void;
}) {
  return (
    <DropdownMenu.Item
      className={`flex min-h-9 cursor-default items-center gap-2 rounded-lg px-2.5 text-xs font-medium outline-none ${
        danger
          ? "text-danger-700 data-[highlighted]:bg-danger-50"
          : "text-ink-700 data-[highlighted]:bg-[#f4f6f3]"
      }`}
      onSelect={onSelect}
    >
      {icon}
      {label}
    </DropdownMenu.Item>
  );
}

function EditorSkeleton() {
  return (
    <div className="px-[clamp(1.25rem,5vw,4.5rem)] py-10">
      <span className="skeleton-shimmer block h-8 w-1/2 rounded-xl bg-[linear-gradient(90deg,#eef1ed_25%,#f8faf7_50%,#eef1ed_75%)] bg-[length:200%_100%]" />
      <div className="mt-8 grid gap-3">
        {Array.from({ length: 7 }, (_, index) => (
          <span
            className="skeleton-shimmer block h-4 rounded-md bg-[linear-gradient(90deg,#eef1ed_25%,#f8faf7_50%,#eef1ed_75%)] bg-[length:200%_100%]"
            key={String(index)}
            style={{ width: `${index % 3 === 2 ? 70 : 100}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function currentCaretPosition(): FloatingPosition {
  const selection = window.getSelection();
  if (selection?.rangeCount) {
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    return {
      top: rect.bottom,
      left: Math.max(8, rect.left)
    };
  }
  return { top: 96, left: 32 };
}

function commandIdMatchesBlockType(
  command: EditorCommandId,
  blockType: MarkdownBlockType
) {
  return command === blockType || (blockType === "paragraph" && command === "paragraph");
}

function editorCommandLabel(command: EditorCommandId) {
  return EDITOR_COMMANDS.find((item) => item.id === command)?.label ?? command;
}
