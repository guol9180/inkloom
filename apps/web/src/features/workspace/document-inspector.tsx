import {
  ArrowUpRight,
  BookOpen,
  GitBranch,
  History,
  ImagePlus,
  Network,
  X
} from "lucide-react";
import type { ReactNode } from "react";
import type { CloudDocumentRevision } from "@inkloom/storage";
import type { MarkdownHeading } from "@inkloom/editor";
import type { Note } from "../../data";
import { cn } from "../../lib/utils";
import { formatTime } from "./note-utils";

export function DocumentInspector({
  open,
  note,
  notes,
  outline,
  revisions,
  onClose,
  onSelect,
  onOpenCanvas,
  onRestore
}: {
  open: boolean;
  note: Note;
  notes: Note[];
  outline: MarkdownHeading[];
  revisions: CloudDocumentRevision[];
  onClose: () => void;
  onSelect: (id: string) => void;
  onOpenCanvas: () => void;
  onRestore: (revision: CloudDocumentRevision) => void;
}) {
  const backlinks = notes.filter(
    (item) =>
      item.id !== note.id &&
      (item.content.includes(note.title) || item.content.includes(note.filePath))
  );

  return (
    <aside
      className={cn(
        "inspector absolute inset-y-0 right-0 z-40 flex w-[min(88vw,19rem)] flex-col border-l border-line bg-paper/96 shadow-[-18px_0_50px_rgb(28_61_47_/_0.08)] backdrop-blur-xl transition-transform duration-200 ease-out",
        "lg:relative lg:z-10 lg:w-[18rem] lg:translate-x-0 lg:shadow-none xl:w-[19.5rem]",
        open ? "translate-x-0" : "translate-x-full lg:hidden"
      )}
    >
      <div className="inspector-head flex min-h-[4.65rem] items-center justify-between border-b border-line-soft px-4">
        <div>
          <span className="block text-[0.63rem] font-bold tracking-[0.15em] text-ink-400 uppercase">
            document
          </span>
          <strong className="mt-0.5 block text-sm font-semibold text-ink-900">
            文档信息
          </strong>
        </div>
        <button
          className="grid size-9 place-items-center rounded-xl text-ink-400 hover:bg-canvas hover:text-ink-800 focus-visible:ring-4 focus-visible:ring-brand-200/60 focus-visible:outline-none"
          type="button"
          aria-label="关闭信息栏"
          onClick={onClose}
        >
          <X size={16} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-2">
        <InspectorSection icon={<BookOpen size={14} />} title="大纲">
          <nav className="outline-list grid gap-0.5">
            {outline.map((item, index) => (
              <button
                key={`${item.id}-${index}`}
                type="button"
                className={cn(
                  "rounded-lg py-2 pr-2 text-left text-xs font-medium text-ink-500 hover:bg-canvas hover:text-ink-900",
                  item.depth === 1 && "font-semibold text-ink-800",
                  item.depth === 2 && "pl-5",
                  item.depth >= 3 && "pl-8 text-[0.69rem]"
                )}
                onClick={() =>
                  document
                    .querySelector(`.markdown-preview #${CSS.escape(item.id)}`)
                    ?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
              >
                {item.text}
              </button>
            ))}
            {outline.length === 0 && <p className="px-2 py-2 text-xs text-ink-400">添加标题后会生成大纲。</p>}
          </nav>
        </InspectorSection>

        <InspectorSection
          icon={<GitBranch size={14} />}
          title="反向链接"
          count={backlinks.length}
        >
          {backlinks.length > 0 ? (
            <div className="backlink-list grid gap-1">
              {backlinks.map((item) => (
                <button
                  className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 text-left text-xs font-medium text-ink-600 hover:bg-canvas hover:text-ink-900"
                  type="button"
                  key={item.id}
                  onClick={() => onSelect(item.id)}
                >
                  <span className="truncate">{item.title}</span>
                  <ArrowUpRight size={13} className="shrink-0 text-ink-300" />
                </button>
              ))}
            </div>
          ) : (
            <p className="empty-note px-2 py-2 text-xs leading-5 text-ink-400">
              暂时没有其他文档引用此页。
            </p>
          )}
        </InspectorSection>

        <InspectorSection icon={<ImagePlus size={14} />} title="图表资产">
          <div className="asset-list grid gap-1.5">
            <button
              className="flex items-center gap-2.5 rounded-xl border border-line bg-white p-2.5 text-left hover:border-brand-300 hover:bg-brand-50"
              type="button"
              onClick={onOpenCanvas}
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-sun-100 text-sun-700">
                <ImagePlus size={15} />
              </span>
              <span className="min-w-0">
                <strong className="block truncate text-xs font-semibold text-ink-800">
                  {note.canvas?.title ?? "自由画布"}
                </strong>
                <small className="mt-0.5 block text-[0.64rem] text-ink-400">
                  {note.canvas?.elements.length ?? 0} 个图元 · 可编辑
                </small>
              </span>
            </button>
            <div className="asset-row flex items-center gap-2.5 rounded-xl px-2.5 py-2">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600">
                <Network size={15} />
              </span>
              <span className="min-w-0">
                <strong className="block text-xs font-semibold text-ink-800">
                  Mermaid 文本图
                </strong>
                <small className="mt-0.5 block text-[0.64rem] text-ink-400">
                  内嵌在 Markdown
                </small>
              </span>
            </div>
          </div>
        </InspectorSection>

        <InspectorSection icon={<History size={14} />} title="最近版本">
          <div className="version-list grid gap-0.5">
            <div className="flex items-start gap-2 rounded-lg px-2 py-2">
              <span className="version-dot is-current mt-1.5 size-2 shrink-0 rounded-full bg-brand-600 ring-4 ring-brand-100" />
              <span>
                <strong className="block text-xs font-semibold text-ink-800">
                  当前版本
                </strong>
                <small className="mt-0.5 block text-[0.64rem] text-ink-400">
                  revision {note.revision} · {formatTime(note.updatedAt)}
                </small>
              </span>
            </div>
            {revisions.slice(0, 4).map((revision) => (
              <button
                className="flex items-start gap-2 rounded-lg px-2 py-2 text-left hover:bg-canvas"
                type="button"
                key={revision.revisionId}
                onClick={() => onRestore(revision)}
                title="恢复为这个历史版本"
              >
                <span className="version-dot mt-1.5 size-2 shrink-0 rounded-full border border-ink-300 bg-white" />
                <span>
                  <strong className="block text-xs font-semibold text-ink-700">
                    revision {revision.meta.revision}
                  </strong>
                  <small className="mt-0.5 block text-[0.64rem] text-ink-400">
                    {formatTime(revision.recordedAt)} · 点击恢复
                  </small>
                </span>
              </button>
            ))}
            {revisions.length === 0 && (
              <p className="empty-note px-2 py-2 text-xs leading-5 text-ink-400">
                首次修改后会在这里生成历史版本。
              </p>
            )}
          </div>
        </InspectorSection>
      </div>
    </aside>
  );
}

function InspectorSection({
  icon,
  title,
  count,
  children
}: {
  icon: ReactNode;
  title: string;
  count?: number;
  children: ReactNode;
}) {
  return (
    <section className="inspector-section border-b border-line-soft py-3 last:border-0">
      <div className="inspector-title mb-2 flex items-center gap-2 px-2 text-[0.68rem] font-bold tracking-[0.05em] text-ink-500 uppercase">
        {icon}
        {title}
        {count !== undefined && (
          <span className="count-badge ml-auto grid min-w-5 place-items-center rounded-full bg-brand-100 px-1.5 py-0.5 text-[0.58rem] text-brand-700">
            {count}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}
