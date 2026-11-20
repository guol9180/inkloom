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
  Columns3,
  Copy,
  ChevronsDownUp,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,
  Image,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  MessageSquareText,
  Minus,
  Paperclip,
  Pilcrow,
  Quote,
  Redo2,
  RotateCcw,
  Rows3,
  Sigma,
  Strikethrough,
  Table2,
  TextAlignCenter,
  TextAlignEnd,
  TextAlignStart,
  Trash2,
  Undo2,
  X
} from "lucide-react";
import { AppDialog } from "../../components/ui/app-dialog";
import { Button, IconButton } from "../../components/ui/button";
import { FieldLabel, TextInput } from "../../components/ui/field";
import type {
  RichMarkdownEditorHandle,
  RichToolbarAction,
  TableAction
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
import {
  CALLOUT_KINDS,
  CALLOUT_LABELS,
  type CalloutKind
} from "./editor-block-meta";
import {
  classifyAssetFile,
  uploadAssetWithProgress,
  type AssetUploadTask
} from "./asset-upload";
import { cloudClient } from "../../cloud-workspace";
import type { CloudAsset } from "@inkloom/storage";
import type { WorkspaceId } from "@inkloom/core";

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
  kind: MarkdownBlockType;
  calloutKind?: CalloutKind;
  toggleOpen?: boolean;
};

type FloatingPosition = {
  top: number;
  left: number;
};

type ProductUploadTask = AssetUploadTask & {
  replaceBlockIndex?: number;
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
    workspaceId: string;
  onChange: (value: string) => void;
  onFocusSearch: () => void;
  }
>(function ProductMarkdownEditor(
  { value, title, workspaceId, onChange, onFocusSearch },
  ref
) {
  const rootRef = useRef<HTMLDivElement>(null);
  const handleLayerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<RichMarkdownEditorHandle>(null);
  const [blockType, setBlockType] = useState<MarkdownBlockType>("paragraph");
  const [tableHeader, setTableHeader] = useState(false);
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
  const [toggleEdit, setToggleEdit] = useState<{
    index: number;
    summary: string;
  }>();
  const [toggleSummaryError, setToggleSummaryError] = useState("");
  const [uploads, setUploads] = useState<ProductUploadTask[]>([]);
  const [imagePreview, setImagePreview] = useState<string>();
  const [replaceImageIndex, setReplaceImageIndex] = useState<number>();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const uploadControllersRef = useRef(new Map<string, AbortController>());

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
      (element) => !element.classList.contains("prosemirror-virtual-cursor")
    );
    const next = blocks.map((element, index) => {
      const blockElement = element as HTMLElement;
      const rect = blockElement.getBoundingClientRect();
      const firstLine =
        blockElement.querySelector<HTMLElement>(
          "h1, h2, h3, h4, h5, h6, p, li, summary, th, td, pre, .cm-content"
        ) ?? blockElement;
      const lineRect = firstLine.getBoundingClientRect();
      const computed = window.getComputedStyle(firstLine);
      const parsedLineHeight = Number.parseFloat(computed.lineHeight);
      const calloutElement = blockElement.matches(
        "blockquote[data-callout]"
      )
        ? blockElement
        : blockElement.querySelector<HTMLElement>(
            "blockquote[data-callout]"
          );
      const toggleElement =
        blockElement instanceof HTMLDetailsElement &&
        blockElement.matches("details[data-inkloom-toggle]")
          ? blockElement
          : blockElement.querySelector<HTMLDetailsElement>(
              "details[data-inkloom-toggle]"
            );
      return {
        index,
        top: lineRect.top - layerRect.top,
        height: rect.height,
        lineHeight:
          Number.isFinite(parsedLineHeight) && parsedLineHeight > 0
            ? parsedLineHeight
            : Math.min(lineRect.height, 32),
        kind: blockKindFromElement(blockElement),
        calloutKind: calloutElement?.dataset.callout as
          | CalloutKind
          | undefined,
        toggleOpen: toggleElement?.open
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
      const anchorElement =
        activeSelection?.anchorNode instanceof Element
          ? activeSelection.anchorNode
          : activeSelection?.anchorNode?.parentElement;
      if (
        !root ||
        !editor ||
        !activeSelection ||
        activeSelection.isCollapsed ||
        !activeSelection.rangeCount ||
        !editor.contains(activeSelection.anchorNode) ||
        anchorElement?.closest(".milkdown-table-block")
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
    if (command === "image") {
      setReplaceImageIndex(undefined);
      imageInputRef.current?.click();
      return;
    }
    if (command === "attachment") {
      attachmentInputRef.current?.click();
      return;
    }
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
      command === "heading-3" ||
      command === "heading-4" ||
      command === "heading-5" ||
      command === "heading-6"
    ) {
      editorRef.current?.setHeading(
        Number(command.at(-1)) as 1 | 2 | 3 | 4 | 5 | 6
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

  function submitToggleSummary(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!toggleEdit) return;
    const summary = toggleEdit.summary.trim();
    if (!summary) {
      setToggleSummaryError("折叠标题不能为空。");
      return;
    }
    editorRef.current?.setToggleSummary(toggleEdit.index, summary);
    setToggleEdit(undefined);
    setToggleSummaryError("");
    window.requestAnimationFrame(syncHandles);
  }

  function enqueueFiles(
    files: readonly File[],
    requestedKind?: "image" | "attachment",
    replacementIndex?: number
  ) {
    for (const file of files) {
      const classification = classifyAssetFile(file);
      const kind =
        requestedKind === "image"
          ? classification.kind === "image" ||
            classification.kind === "svg"
            ? classification.kind
            : undefined
          : requestedKind === "attachment"
            ? "attachment"
            : classification.kind;
      if (!kind) continue;
      const task: ProductUploadTask = {
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `upload-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        kind,
        progress: 0,
        state: "uploading",
        replaceBlockIndex: replacementIndex
      };
      setUploads((current) => [...current, task]);
      void runUpload(task);
    }
  }

  async function runUpload(task: ProductUploadTask) {
    const controller = new AbortController();
    uploadControllersRef.current.set(task.id, controller);
    setUploads((current) =>
      current.map((item) =>
        item.id === task.id
          ? { ...item, state: "uploading", progress: 0, error: undefined }
          : item
      )
    );
    try {
      const { asset } = await uploadAssetWithProgress({
        workspaceId,
        file: task.file,
        kind: task.kind,
        signal: controller.signal,
        onProgress: (progress) =>
          setUploads((current) =>
            current.map((item) =>
              item.id === task.id ? { ...item, progress } : item
            )
          )
      });
      insertUploadedAsset(task, asset);
      setUploads((current) =>
        current.map((item) =>
          item.id === task.id
            ? { ...item, state: "complete", progress: 100, asset }
            : item
        )
      );
      window.setTimeout(() => {
        setUploads((current) =>
          current.filter((item) => item.id !== task.id)
        );
      }, 1_500);
    } catch (uploadError) {
      const cancelled =
        uploadError instanceof DOMException &&
        uploadError.name === "AbortError";
      setUploads((current) =>
        current.map((item) =>
          item.id === task.id
            ? {
                ...item,
                state: cancelled ? "cancelled" : "failed",
                error: cancelled
                  ? undefined
                  : uploadError instanceof Error
                    ? uploadError.message
                    : "上传失败，请重试。"
              }
            : item
        )
      );
    } finally {
      uploadControllersRef.current.delete(task.id);
    }
  }

  function insertUploadedAsset(task: ProductUploadTask, asset: CloudAsset) {
    const src = cloudClient.assetUrl(
      workspaceId as WorkspaceId,
      asset.hash
    );
    const caption = task.file.name.replace(/\.[^.]+$/, "") || task.file.name;
    if (task.kind === "image" || task.kind === "svg") {
      if (task.replaceBlockIndex !== undefined) {
        editorRef.current?.replaceImage(task.replaceBlockIndex, {
          src,
          caption
        });
      } else {
        editorRef.current?.insertImage({ src, caption });
      }
      return;
    }
    editorRef.current?.insertFile({
      id: asset.id,
      hash: asset.hash,
      mime: asset.mime,
      size: asset.size,
      name: task.file.name,
      url: src
    });
  }

  function cancelUpload(taskId: string) {
    uploadControllersRef.current.get(taskId)?.abort();
  }

  function removeUpload(taskId: string) {
    uploadControllersRef.current.get(taskId)?.abort();
    setUploads((current) => current.filter((task) => task.id !== taskId));
  }

  return (
    <div
      ref={rootRef}
      className="product-markdown-editor relative min-h-0"
      onKeyDownCapture={handleKeyDown}
      onPaste={(event) => {
        const files = [...event.clipboardData.files];
        if (files.length === 0) return;
        event.preventDefault();
        enqueueFiles(files);
      }}
      onDragOver={(event) => {
        if ([...event.dataTransfer.types].includes("Files")) {
          event.preventDefault();
        }
      }}
      onDrop={(event) => {
        const files = [...event.dataTransfer.files];
        if (files.length === 0) return;
        event.preventDefault();
        enqueueFiles(files);
      }}
      onDoubleClick={(event) => {
        const image = (event.target as Element | null)?.closest("img");
        if (image instanceof HTMLImageElement && image.src) {
          setImagePreview(image.src);
        }
      }}
    >
      <div
        className="sticky top-14 z-30 flex min-h-12 items-center gap-1 overflow-x-auto border-b border-line-soft bg-white/96 px-3 py-1.5 backdrop-blur-md"
        role="toolbar"
        aria-label="文档格式"
      >
        {blockType === "table" ? (
          <>
            <span className="mx-1 shrink-0 text-[0.62rem] font-bold tracking-[0.08em] text-ink-400 uppercase">
              表格
            </span>
            <TableToolbarButton
              label="增加行"
              icon={<Rows3 size={15} />}
              onAction={(action) => editorRef.current?.tableAction(action)}
              action="add-row"
            />
            <TableToolbarButton
              label="删除行"
              icon={<Rows3 size={15} />}
              onAction={(action) => editorRef.current?.tableAction(action)}
              action="delete-row"
              disabled={tableHeader}
            />
            <span className="mx-1 h-5 w-px shrink-0 bg-line" />
            <TableToolbarButton
              label="增加列"
              icon={<Columns3 size={15} />}
              onAction={(action) => editorRef.current?.tableAction(action)}
              action="add-column"
            />
            <TableToolbarButton
              label="删除列"
              icon={<Columns3 size={15} />}
              onAction={(action) => editorRef.current?.tableAction(action)}
              action="delete-column"
              disabled={tableHeader}
            />
            <span className="mx-1 h-5 w-px shrink-0 bg-line" />
            <TableToolbarButton
              label="左对齐"
              icon={<TextAlignStart size={15} />}
              onAction={(action) => editorRef.current?.tableAction(action)}
              action="align-left"
            />
            <TableToolbarButton
              label="居中对齐"
              icon={<TextAlignCenter size={15} />}
              onAction={(action) => editorRef.current?.tableAction(action)}
              action="align-center"
            />
            <TableToolbarButton
              label="右对齐"
              icon={<TextAlignEnd size={15} />}
              onAction={(action) => editorRef.current?.tableAction(action)}
              action="align-right"
            />
          </>
        ) : (
          TOOLBAR_COMMANDS.map((command, index) => {
            const previous = TOOLBAR_COMMANDS[index - 1];
            const separator = previous && previous.group !== command.group;
            return (
              <span className="contents" key={command.id}>
                {separator && (
                  <span className="mx-1 h-5 w-px shrink-0 bg-line" />
                )}
                <button
                  type="button"
                  className={`grid h-8 min-w-8 shrink-0 place-items-center rounded-lg px-1.5 text-[0.68rem] font-semibold transition hover:bg-[#f2f5f2] hover:text-brand-800 focus-visible:ring-4 focus-visible:ring-brand-100 ${
                    commandIdMatchesBlockType(command.id, blockType)
                      ? "bg-[#eef3ef] text-brand-800"
                      : "text-ink-500"
                  }`}
                  title={
                    command.hint
                      ? `${command.label} · ${command.hint}`
                      : command.label
                  }
                  aria-label={command.label}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => executeCommand(command.id)}
                >
                  <CommandIcon command={command} />
                </button>
              </span>
            );
          })
        )}
      </div>

      <div ref={handleLayerRef} className="relative min-h-[calc(100dvh-7rem)]">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-20 w-12">
          {handles.map((handle) => (
            <DropdownMenu.Root
              key={handle.index}
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
                  <BlockMenuItem
                    icon={<Heading3 size={14} />}
                    label="转为三级标题"
                    onSelect={() => editorRef.current?.setHeading(3)}
                  />
                  <BlockMenuItem
                    icon={<Heading4 size={14} />}
                    label="转为四级标题"
                    onSelect={() => editorRef.current?.setHeading(4)}
                  />
                  <BlockMenuItem
                    icon={<Heading5 size={14} />}
                    label="转为五级标题"
                    onSelect={() => editorRef.current?.setHeading(5)}
                  />
                  <BlockMenuItem
                    icon={<Heading6 size={14} />}
                    label="转为六级标题"
                    onSelect={() => editorRef.current?.setHeading(6)}
                  />
                  <DropdownMenu.Sub>
                    <DropdownMenu.SubTrigger className="flex min-h-9 cursor-default items-center gap-2 rounded-lg px-2.5 text-xs font-medium text-ink-700 outline-none data-[highlighted]:bg-[#f4f6f3]">
                      <MessageSquareText size={14} />
                      <span className="flex-1">提示块类型</span>
                      <span className="text-ink-300">›</span>
                    </DropdownMenu.SubTrigger>
                    <DropdownMenu.Portal>
                      <DropdownMenu.SubContent
                        sideOffset={6}
                        className="z-[80] w-36 rounded-xl border border-line-soft bg-white p-1.5 shadow-[0_18px_50px_rgb(20_36_28_/_0.14)]"
                      >
                        {CALLOUT_KINDS.map((kind) => (
                          <BlockMenuItem
                            key={kind}
                            icon={
                              <span
                                className={`size-1.5 rounded-full callout-dot-${kind}`}
                              />
                            }
                            label={CALLOUT_LABELS[kind]}
                            onSelect={() =>
                              editorRef.current?.setCalloutKind(
                                handle.index,
                                kind
                              )
                            }
                          />
                        ))}
                      </DropdownMenu.SubContent>
                    </DropdownMenu.Portal>
                  </DropdownMenu.Sub>
                  <DropdownMenu.Separator className="my-1 h-px bg-line-soft" />
                  {handle.kind === "image" && (
                    <>
                      <BlockMenuItem
                        icon={<Image size={14} />}
                        label="替换图片"
                        onSelect={() => {
                          setReplaceImageIndex(handle.index);
                          imageInputRef.current?.click();
                        }}
                      />
                      <BlockMenuItem
                        icon={<Image size={14} />}
                        label="图片左对齐"
                        onSelect={() =>
                          editorRef.current?.setImageAlignment(
                            handle.index,
                            "left"
                          )
                        }
                      />
                      <BlockMenuItem
                        icon={<Image size={14} />}
                        label="图片居中"
                        onSelect={() =>
                          editorRef.current?.setImageAlignment(
                            handle.index,
                            "center"
                          )
                        }
                      />
                      <BlockMenuItem
                        icon={<Image size={14} />}
                        label="图片右对齐"
                        onSelect={() =>
                          editorRef.current?.setImageAlignment(
                            handle.index,
                            "right"
                          )
                        }
                      />
                      <DropdownMenu.Separator className="my-1 h-px bg-line-soft" />
                    </>
                  )}
                  {handle.kind === "toggle" && (
                    <>
                      <BlockMenuItem
                        icon={<ChevronsDownUp size={14} />}
                        label="重命名折叠标题"
                        onSelect={() => {
                          const details = rootRef.current
                            ?.querySelectorAll<HTMLDetailsElement>(
                              "details[data-inkloom-toggle]"
                            )
                            .item(handle.index);
                          setToggleSummaryError("");
                          setToggleEdit({
                            index: handle.index,
                            summary:
                              details?.querySelector("summary")?.textContent ??
                              "折叠内容"
                          });
                        }}
                      />
                      <BlockMenuItem
                        icon={<ChevronsDownUp size={14} />}
                        label={handle.toggleOpen ? "收起折叠块" : "展开折叠块"}
                        onSelect={() =>
                          editorRef.current?.toggleToggleOpen(handle.index)
                        }
                      />
                      <DropdownMenu.Separator className="my-1 h-px bg-line-soft" />
                    </>
                  )}
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
            onTableHeaderChange={setTableHeader}
            onRequestCanvas={() => undefined}
            className="min-h-[calc(100dvh-7rem)]"
          />
        </Suspense>
      </div>

      <input
        ref={imageInputRef}
        className="hidden"
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp,image/avif,image/svg+xml"
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          event.target.value = "";
          if (files.length > 0) {
            enqueueFiles(files, "image", replaceImageIndex);
          }
          setReplaceImageIndex(undefined);
        }}
      />
      <input
        ref={attachmentInputRef}
        className="hidden"
        type="file"
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          event.target.value = "";
          if (files.length > 0) enqueueFiles(files, "attachment");
        }}
      />

      {uploads.length > 0 && (
        <div className="fixed right-4 bottom-4 z-[85] grid w-[min(calc(100vw-2rem),21rem)] gap-2">
          {uploads.map((task) => (
            <div
              key={task.id}
              className="rounded-2xl border border-line-soft bg-white p-3 shadow-[0_18px_50px_rgb(20_36_28_/_0.16)]"
            >
              <div className="flex items-start gap-2">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
                  {task.kind === "attachment" ? (
                    <Paperclip size={15} />
                  ) : (
                    <Image size={15} />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-xs font-semibold text-ink-800">
                    {task.file.name}
                  </strong>
                  <span className="mt-0.5 block text-[0.64rem] text-ink-400">
                    {task.state === "uploading"
                      ? `正在上传 · ${task.progress}%`
                      : task.state === "complete"
                        ? "已插入文档"
                        : task.state === "cancelled"
                          ? "已取消"
                          : task.error}
                  </span>
                </span>
                {task.state === "uploading" ? (
                  <IconButton
                    aria-label="取消上传"
                    onClick={() => cancelUpload(task.id)}
                  >
                    <X size={14} />
                  </IconButton>
                ) : (
                  <div className="flex">
                    {task.state === "failed" && (
                      <IconButton
                        aria-label="重试上传"
                        onClick={() => void runUpload(task)}
                      >
                        <RotateCcw size={14} />
                      </IconButton>
                    )}
                    <IconButton
                      aria-label="移除上传任务"
                      onClick={() => removeUpload(task.id)}
                    >
                      <X size={14} />
                    </IconButton>
                  </div>
                )}
              </div>
              {task.state === "uploading" && (
                <span className="mt-2 block h-1 overflow-hidden rounded-full bg-line-soft">
                  <span
                    className="block h-full rounded-full bg-brand-500 transition-[width] duration-200"
                    style={{ width: `${task.progress}%` }}
                  />
                </span>
              )}
            </div>
          ))}
        </div>
      )}

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

      <AppDialog
        open={toggleEdit !== undefined}
        title="折叠标题"
        description="使用一行简短文字概括折叠块中的内容。"
        onClose={() => {
          setToggleEdit(undefined);
          setToggleSummaryError("");
        }}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setToggleEdit(undefined);
                setToggleSummaryError("");
              }}
            >
              取消
            </Button>
            <Button
              variant="primary"
              type="submit"
              form="product-toggle-summary-form"
            >
              保存标题
            </Button>
          </>
        }
      >
        <form
          id="product-toggle-summary-form"
          className="grid gap-4"
          onSubmit={submitToggleSummary}
        >
          <FieldLabel>
            标题
            <TextInput
              autoFocus
              maxLength={120}
              value={toggleEdit?.summary ?? ""}
              onChange={(event) => {
                setToggleEdit((current) =>
                  current
                    ? { ...current, summary: event.target.value }
                    : current
                );
                setToggleSummaryError("");
              }}
              placeholder="折叠内容"
            />
          </FieldLabel>
          {toggleSummaryError && (
            <p className="rounded-lg bg-danger-50 px-3 py-2 text-xs text-danger-700">
              {toggleSummaryError}
            </p>
          )}
        </form>
      </AppDialog>

      <AppDialog
        open={imagePreview !== undefined}
        title="图片预览"
        description="双击图片可再次打开大图。"
        onClose={() => setImagePreview(undefined)}
        footer={
          <Button variant="secondary" onClick={() => setImagePreview(undefined)}>
            关闭
          </Button>
        }
      >
        {imagePreview && (
          <img
            className="max-h-[68dvh] w-full rounded-xl bg-[#f7f9f7] object-contain"
            src={imagePreview}
            alt="图片预览"
          />
        )}
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
    case "heading-4":
      return <Heading4 size={16} />;
    case "heading-5":
      return <Heading5 size={16} />;
    case "heading-6":
      return <Heading6 size={16} />;
    case "bold":
      return <Bold size={15} />;
    case "italic":
      return <Italic size={15} />;
    case "strike":
      return <Strikethrough size={15} />;
    case "inline-code":
    case "code-block":
      return <Code2 size={15} />;
    case "formula":
      return <Sigma size={15} />;
    case "callout":
      return <MessageSquareText size={15} />;
    case "toggle":
      return <ChevronsDownUp size={15} />;
    case "bullet-list":
      return <List size={15} />;
    case "ordered-list":
      return <ListOrdered size={15} />;
    case "task-list":
      return <ListChecks size={15} />;
    case "link":
      return <Link2 size={15} />;
    case "image":
      return <Image size={15} />;
    case "attachment":
      return <Paperclip size={15} />;
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

function TableToolbarButton({
  action,
  disabled = false,
  icon,
  label,
  onAction
}: {
  action: TableAction;
  disabled?: boolean;
  icon: ReactNode;
  label: string;
  onAction: (action: TableAction) => void;
}) {
  return (
    <button
      type="button"
      className="grid h-8 min-w-8 shrink-0 place-items-center rounded-lg px-1.5 text-ink-500 transition hover:bg-[#f2f5f2] hover:text-brand-800 focus-visible:ring-4 focus-visible:ring-brand-100 disabled:pointer-events-none disabled:opacity-35"
      title={label}
      aria-label={label}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => onAction(action)}
    >
      {icon}
    </button>
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

function blockKindFromElement(element: HTMLElement): MarkdownBlockType {
  if (element.matches("blockquote[data-callout]")) return "callout";
  if (element.matches("blockquote")) return "quote";
  if (element.matches("details[data-inkloom-toggle]")) return "toggle";
  if (element.matches(".milkdown-image-block")) return "image";
  if (element.matches(".inkloom-file-block")) return "attachment";
  if (element.matches(".milkdown-table-block, table")) return "table";
  if (element.matches(".milkdown-code-block, pre")) {
    return element.closest<HTMLElement>("[data-language='latex']")
      ? "formula"
      : "code-block";
  }
  if (element.matches("hr")) return "divider";
  if (element.matches("h1, h2, h3, h4, h5, h6")) {
    return `heading-${element.tagName.slice(1)}` as MarkdownBlockType;
  }
  const list = element.querySelector<HTMLElement>("ul, ol");
  if (list) return list.matches("ol") ? "ordered-list" : "bullet-list";
  return "paragraph";
}
