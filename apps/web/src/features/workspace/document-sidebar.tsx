import { useMemo, useRef, type RefObject } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  Check,
  ChevronDown,
  ChevronRight,
  CirclePlus,
  Cloud,
  FileText,
  FolderClosed,
  FolderOpen,
  History,
  Search,
  Settings,
  SquarePen
} from "lucide-react";
import type { CloudWorkspace } from "@inkloom/storage";
import type { Note } from "../../data";
import { cn } from "../../lib/utils";
import { IconButton } from "../../components/ui/button";
import { formatTime } from "./note-utils";

type TreeRow =
  | { kind: "folder"; folder: string; depth: number; count: number }
  | { kind: "document"; note: Note; depth: number }
  | { kind: "create"; folder: string; depth: number };

export function DocumentSidebar({
  workspace,
  open,
  notes,
  activeId,
  query,
  onQuery,
  expandedFolders,
  onToggleFolder,
  onSelect,
  onCreate,
  onOpenWorkspace,
  onOpenInspector,
  onOpenSettings,
  onClose,
  searchRef
}: {
  workspace: CloudWorkspace;
  open: boolean;
  notes: Note[];
  activeId: string;
  query: string;
  onQuery: (value: string) => void;
  expandedFolders: Set<string>;
  onToggleFolder: (folder: string) => void;
  onSelect: (id: string) => void;
  onCreate: (folder?: string) => void;
  onOpenWorkspace: () => void;
  onOpenInspector: () => void;
  onOpenSettings: () => void;
  onClose: () => void;
  searchRef: RefObject<HTMLInputElement | null>;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const filteredNotes = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return notes;
    return notes.filter(
      (note) =>
        note.title.toLowerCase().includes(normalized) ||
        note.content.toLowerCase().includes(normalized) ||
        note.tags.some((tag) => tag.toLowerCase().includes(normalized))
    );
  }, [notes, query]);
  const folders = useMemo(() => {
    const values = new Set(["个人", "工作", "学习", "项目"]);
    for (const note of notes) {
      const segments = note.folder.split("/").filter(Boolean);
      for (let index = 1; index <= segments.length; index += 1) {
        values.add(segments.slice(0, index).join("/"));
      }
    }
    return [...values].sort((left, right) => {
      const depth = left.split("/").length - right.split("/").length;
      return depth || left.localeCompare(right, "zh-CN");
    });
  }, [notes]);
  const rows = useMemo(
    () => buildRows(folders, filteredNotes, expandedFolders, Boolean(query)),
    [folders, filteredNotes, expandedFolders, query]
  );
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 38,
    overscan: 10
  });

  return (
    <aside
      className={cn(
        "sidebar absolute inset-y-0 left-0 z-40 flex w-[min(88vw,19rem)] flex-col border-r border-line bg-brand-50/88 shadow-[18px_0_50px_rgb(28_61_47_/_0.08)] backdrop-blur-xl transition-transform duration-200 ease-out",
        "lg:relative lg:z-10 lg:w-[17.5rem] lg:translate-x-0 lg:bg-brand-50/64 lg:shadow-none xl:w-[19rem]",
        open ? "is-open translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}
      data-open={open ? "true" : "false"}
    >
      <div className="sidebar-head flex min-h-[4.65rem] items-center justify-between border-b border-line/70 px-4">
        <div>
          <span className="block text-[0.63rem] font-bold tracking-[0.15em] text-ink-400 uppercase">
            library
          </span>
          <strong className="mt-0.5 block text-sm font-semibold text-ink-900">
            {notes.length} 篇文档
          </strong>
        </div>
        <IconButton
          aria-label="新建文档"
          title="新建文档"
          onClick={() => onCreate()}
          className="bg-white"
        >
          <SquarePen size={17} />
        </IconButton>
      </div>

      <div className="grid gap-3 px-3.5 pt-3.5">
        <button
          className="sidebar-workspace-switcher flex min-h-12 w-full items-center gap-2.5 rounded-xl border border-brand-200/70 bg-white/72 px-3 text-left transition hover:border-brand-300 hover:bg-white"
          type="button"
          onClick={onOpenWorkspace}
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-100 text-brand-700">
            <Cloud size={15} />
          </span>
          <span className="min-w-0 flex-1">
            <small className="block text-[0.61rem] font-semibold tracking-[0.08em] text-ink-400 uppercase">
              当前工作区
            </small>
            <strong className="mt-0.5 block truncate text-sm font-semibold text-ink-900">
              {workspace.name}
            </strong>
          </span>
          <ChevronDown size={14} className="text-ink-400" />
        </button>

        <label className="search-box flex h-10 items-center gap-2 rounded-xl border border-line bg-white/82 px-3 text-ink-400 transition focus-within:border-brand-400 focus-within:ring-4 focus-within:ring-brand-100">
          <Search size={15} />
          <input
            ref={searchRef}
            className="min-w-0 flex-1 border-0 bg-transparent text-xs text-ink-900 outline-none placeholder:text-ink-300"
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="搜索标题、正文或标签"
          />
          <kbd className="hidden rounded border border-line bg-paper px-1.5 py-0.5 font-sans text-[0.58rem] text-ink-300 sm:block">
            Ctrl K
          </kbd>
        </label>
      </div>

      <div ref={scrollRef} className="file-tree mt-3 min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
          {virtualizer.getVirtualItems().map((item) => {
            const row = rows[item.index];
            return (
              <div
                key={`${row.kind}-${"folder" in row ? row.folder : "note" in row ? row.note.id : "create"}-${item.index}`}
                style={{
                  position: "absolute",
                  inset: "0 0 auto",
                  transform: `translateY(${item.start}px)`
                }}
              >
                <TreeRow
                  row={row}
                  activeId={activeId}
                  expanded={row.kind === "folder" && expandedFolders.has(row.folder)}
                  onToggle={onToggleFolder}
                  onSelect={onSelect}
                  onCreate={onCreate}
                />
              </div>
            );
          })}
        </div>
        {rows.length === 0 && (
          <div className="px-4 py-10 text-center text-xs leading-5 text-ink-400">
            没有找到匹配的文档。
          </div>
        )}
      </div>

      <div className="sidebar-foot border-t border-line/70 p-3.5">
        <div className="storage-card flex items-center gap-2.5 rounded-xl bg-brand-800 p-3 text-white shadow-[0_10px_24px_rgb(31_77_57_/_0.16)]">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/10">
            <Check size={15} />
          </span>
          <span className="min-w-0 flex-1">
            <strong className="block text-xs font-semibold">云端工作区</strong>
            <span className="mt-0.5 block truncate text-[0.65rem] text-brand-100/72">
              SQLite · revision history
            </span>
          </span>
        </div>
        <div className="sidebar-links mt-2 grid grid-cols-2 gap-1">
          <button
            className="flex min-h-9 items-center justify-center gap-1.5 rounded-lg text-[0.7rem] font-semibold text-ink-500 hover:bg-white/70 hover:text-ink-900"
            type="button"
            onClick={onOpenInspector}
          >
            <History size={14} /> 版本历史
          </button>
          <button
            className="flex min-h-9 items-center justify-center gap-1.5 rounded-lg text-[0.7rem] font-semibold text-ink-500 hover:bg-white/70 hover:text-ink-900"
            type="button"
            onClick={onOpenSettings}
          >
            <Settings size={14} /> 工作区设置
          </button>
        </div>
      </div>

      <button
        className="absolute -right-10 top-4 grid size-9 place-items-center rounded-r-xl bg-brand-800 text-white lg:hidden"
        type="button"
        aria-label="关闭文件栏"
        onClick={onClose}
      >
        <ChevronRight size={16} className="rotate-180" />
      </button>
    </aside>
  );
}

function TreeRow({
  row,
  activeId,
  expanded,
  onToggle,
  onSelect,
  onCreate
}: {
  row: TreeRow;
  activeId: string;
  expanded: boolean;
  onToggle: (folder: string) => void;
  onSelect: (id: string) => void;
  onCreate: (folder?: string) => void;
}) {
  if (row.kind === "folder") {
    const name = row.folder.split("/").at(-1) ?? row.folder;
    return (
      <button
        className="folder-row flex h-[36px] w-full items-center gap-1.5 rounded-lg pr-2 text-left text-xs font-semibold text-ink-600 hover:bg-white/66 hover:text-ink-900"
        style={{ paddingLeft: 7 + row.depth * 13 }}
        type="button"
        onClick={() => onToggle(row.folder)}
      >
        {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        {expanded ? (
          <FolderOpen size={15} className="text-brand-600" />
        ) : (
          <FolderClosed size={15} className="text-ink-400" />
        )}
        <span className="min-w-0 flex-1 truncate">{name}</span>
        <em className="text-[0.62rem] font-medium not-italic text-ink-300">
          {row.count}
        </em>
      </button>
    );
  }
  if (row.kind === "create") {
    return (
      <button
        className="add-file-row flex h-[34px] w-full items-center gap-1.5 rounded-lg text-[0.69rem] font-medium text-ink-400 hover:bg-white/70 hover:text-brand-700"
        style={{ paddingLeft: 26 + row.depth * 13 }}
        type="button"
        onClick={() => onCreate(row.folder)}
      >
        <CirclePlus size={13} />
        新建文档
      </button>
    );
  }

  return (
    <button
      className={cn(
        "file-row flex h-[38px] w-full items-center gap-2 rounded-lg pr-2 text-left transition",
        "hover:bg-white/72",
        activeId === row.note.id &&
          "bg-white text-brand-800 shadow-[0_1px_0_rgb(255_255_255_/_0.9),0_5px_14px_rgb(31_75_57_/_0.07)] ring-1 ring-brand-200/70"
      )}
      style={{ paddingLeft: 22 + row.depth * 13 }}
      type="button"
      aria-current={activeId === row.note.id ? "page" : undefined}
      onClick={() => onSelect(row.note.id)}
    >
      <FileText
        size={14}
        className={activeId === row.note.id ? "text-brand-600" : "text-ink-300"}
      />
      <span className="min-w-0 flex-1">
        <strong className="block truncate text-xs font-semibold">{row.note.title}</strong>
        <small className="mt-0.5 block truncate text-[0.58rem] font-medium text-ink-300">
          {formatTime(row.note.updatedAt)}
        </small>
      </span>
    </button>
  );
}

function buildRows(
  folders: string[],
  notes: Note[],
  expandedFolders: Set<string>,
  searching: boolean
): TreeRow[] {
  const rows: TreeRow[] = [];
  for (const folder of folders) {
    const segments = folder.split("/");
    const parent = segments.slice(0, -1).join("/");
    if (parent && !expandedFolders.has(parent)) continue;
    const matching = notes.filter(
      (note) => note.folder === folder || note.folder.startsWith(`${folder}/`)
    );
    if (searching && matching.length === 0) continue;
    rows.push({
      kind: "folder",
      folder,
      depth: segments.length - 1,
      count: matching.length
    });
    if (!expandedFolders.has(folder)) continue;
    for (const note of notes.filter((item) => item.folder === folder)) {
      rows.push({ kind: "document", note, depth: segments.length });
    }
    if (!searching) {
      rows.push({ kind: "create", folder, depth: segments.length });
    }
  }
  return rows;
}
