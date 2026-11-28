import { useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  ExternalLink,
  FileText,
  GitBranch,
  History,
  Image,
  Info,
  Paperclip,
  X
} from "lucide-react";
import { extractHeadings, type MarkdownHeading } from "@inkloom/editor";
import type { DocumentSnapshot, WorkspaceId } from "@inkloom/core";
import type { CloudDocumentContext, CloudDocumentLink } from "@inkloom/storage";
import { cloudClient } from "../../cloud-workspace";
import { AppSheet, IconButton, Skeleton, useMediaQuery } from "@inkloom/ui";

export function DocumentContextPanel({
  open,
  document,
  workspaceId,
  markdown,
  onClose,
  onNavigate,
  onOpenHistory
}: {
  open: boolean;
  document: DocumentSnapshot;
  workspaceId: string;
  markdown: string;
  onClose: () => void;
  onNavigate: (link: CloudDocumentLink) => void;
  onOpenHistory: () => void;
}) {
  const mobile = useMediaQuery("(max-width: 1023px)");
  const context = useQuery({
    queryKey: [
      "document-context",
      workspaceId,
      document.meta.id,
      document.meta.revision
    ],
    queryFn: () =>
      cloudClient.getDocumentContext(
        workspaceId as WorkspaceId,
        document.meta.id
      ),
    enabled: open,
    staleTime: 10_000
  });
  const outline = useMemo(() => extractHeadings(markdown), [markdown]);

  const header = (
    <div className="flex min-h-14 items-center justify-between border-b border-line-soft px-4">
      <div>
        <span className="block text-[0.75rem] font-semibold tracking-[0.08em] text-ink-500">
          文档
        </span>
        <strong className="mt-0.5 block text-sm font-semibold text-ink-900">
          文档信息
        </strong>
      </div>
      <IconButton aria-label="关闭信息栏" onClick={onClose}>
        <X size={16} />
      </IconButton>
    </div>
  );

  const body = (
    <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
      <ContextSection icon={<BookOpen size={14} />} title="大纲">
        <Outline
          headings={outline}
          onSelect={(index) => scrollToHeading(index)}
        />
      </ContextSection>

      {context.isPending ? (
        <div className="grid gap-2 py-3">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-10 w-full rounded-xl" />
          ))}
        </div>
      ) : context.isError ? (
        <div className="m-2 rounded-xl bg-danger-50 px-3 py-3 text-xs leading-5 text-danger-700">
          文档上下文暂时无法加载，正文仍可正常阅读和编辑。
        </div>
      ) : (
        <ContextContent
          context={context.data}
          onNavigate={onNavigate}
          onOpenHistory={onOpenHistory}
        />
      )}
    </div>
  );

  if (mobile) {
    return (
      <AppSheet
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) onClose();
        }}
        title="文档信息"
        side="right"
        showHeader={false}
        bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        {header}
        {body}
      </AppSheet>
    );
  }

  return (
    <div
      role="complementary"
      aria-label="文档信息栏"
      aria-hidden={!open}
      data-state={open ? "open" : "closed"}
      inert={!open}
      className={`relative z-10 flex shrink-0 flex-col overflow-hidden bg-white/97 backdrop-blur-xl transition-[width,opacity,border-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[width,opacity] ${
        open
          ? "w-[19rem] border-l border-line-soft opacity-100 xl:w-[20rem]"
          : "pointer-events-none w-0 border-transparent opacity-0"
      }`}
    >
      {header}
      {body}
    </div>
  );
}

function ContextContent({
  context,
  onNavigate,
  onOpenHistory
}: {
  context: CloudDocumentContext;
  onNavigate: (link: CloudDocumentLink) => void;
  onOpenHistory: () => void;
}) {
  return (
    <>
      <ContextSection
        icon={<GitBranch size={14} />}
        title="反向链接"
        count={context.backlinks.length}
      >
        <LinkList
          links={context.backlinks}
          empty="暂时没有其他文档引用此页。"
          onNavigate={onNavigate}
        />
      </ContextSection>

      <ContextSection
        icon={<ExternalLink size={14} />}
        title="出链"
        count={context.outgoingLinks.length}
      >
        <LinkList
          links={context.outgoingLinks}
          empty="这篇文档还没有内部链接。"
          onNavigate={onNavigate}
        />
      </ContextSection>

      <ContextSection
        icon={<Image size={14} />}
        title="资产"
        count={context.assets.length}
      >
        <div className="grid gap-1">
          {context.assets.slice(0, 8).map((asset) => (
            <div
              key={asset.id}
              className="flex items-center gap-2 rounded-lg px-2 py-2 text-xs text-ink-600"
            >
              <span className="grid size-7 place-items-center rounded-lg bg-brand-50 text-brand-700">
                {asset.kind === "attachment" ? (
                  <Paperclip size={13} />
                ) : (
                  <Image size={13} />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block truncate text-[0.75rem] font-semibold text-ink-700">
                  {asset.kind === "excalidraw"
                    ? "Excalidraw 场景"
                    : asset.kind === "svg"
                      ? "SVG 预览"
                      : asset.mime}
                </strong>
                <small className="text-[0.68rem] text-ink-500">
                  {formatBytes(asset.size)}
                </small>
              </span>
            </div>
          ))}
          {context.assets.length === 0 && <EmptyLine>尚未引用资产。</EmptyLine>}
        </div>
      </ContextSection>

      <ContextSection
        icon={<History size={14} />}
        title="最近版本"
        count={context.revisions.length}
      >
        <div className="grid gap-1">
          {context.revisions.slice(0, 5).map((revision) => (
            <button
              type="button"
              key={revision.revisionId}
              className="flex items-center gap-2 rounded-lg px-2 py-2 text-left text-xs text-ink-600 transition hover:bg-canvas hover:text-ink-900"
              onClick={onOpenHistory}
            >
              <span className="size-1.5 rounded-full bg-brand-500" />
              <span className="flex-1">revision {revision.meta.revision}</span>
              <time className="text-[0.68rem] text-ink-500">
                {formatDateTime(revision.recordedAt)}
              </time>
            </button>
          ))}
          {context.revisions.length === 0 && (
            <EmptyLine>首次修改后会生成历史版本。</EmptyLine>
          )}
        </div>
      </ContextSection>

      <ContextSection icon={<Info size={14} />} title="属性">
        <dl className="grid gap-2 px-2 text-[0.75rem]">
          <Property label="路径" value={context.document.path} />
          <Property
            label="revision"
            value={String(context.document.revision)}
          />
          <Property
            label="更新时间"
            value={formatDateTime(context.document.updatedAt)}
          />
          <Property
            label="内容哈希"
            value={String(context.document.contentHash).slice(0, 12)}
          />
        </dl>
      </ContextSection>
    </>
  );
}

function Outline({
  headings,
  onSelect
}: {
  headings: readonly MarkdownHeading[];
  onSelect: (index: number) => void;
}) {
  if (headings.length === 0)
    return <EmptyLine>添加标题后会生成大纲。</EmptyLine>;
  return (
    <nav className="grid gap-0.5">
      {headings.map((heading, index) => (
        <button
          key={`${heading.id}-${index}`}
          type="button"
          className={`rounded-lg py-2 pr-2 text-left text-xs font-medium text-ink-500 transition hover:bg-canvas hover:text-ink-900 ${
            heading.depth === 1
              ? "pl-2 font-semibold text-ink-800"
              : heading.depth === 2
                ? "pl-5"
                : heading.depth === 3
                  ? "pl-8 text-[0.75rem]"
                  : "pl-10 text-[0.75rem]"
          }`}
          onClick={() => onSelect(index)}
        >
          {heading.text}
        </button>
      ))}
    </nav>
  );
}

function LinkList({
  links,
  empty,
  onNavigate
}: {
  links: readonly CloudDocumentLink[];
  empty: string;
  onNavigate: (link: CloudDocumentLink) => void;
}) {
  if (links.length === 0) return <EmptyLine>{empty}</EmptyLine>;
  return (
    <div className="grid gap-1">
      {links.slice(0, 12).map((link, index) => (
        <button
          key={`${link.documentId}-${link.targetPath}-${index}`}
          type="button"
          className={`rounded-xl px-2 py-2 text-left transition ${
            link.broken
              ? "bg-danger-50 text-danger-700"
              : "text-ink-600 hover:bg-canvas hover:text-ink-900"
          }`}
          disabled={link.broken || !link.documentId}
          onClick={() => onNavigate(link)}
        >
          <span className="flex items-center gap-2">
            <FileText size={13} className="shrink-0" />
            <strong className="min-w-0 flex-1 truncate text-[0.75rem] font-semibold">
              {link.title}
            </strong>
            {link.broken && (
              <span className="text-[0.75rem] font-semibold text-danger-700">
                断链
              </span>
            )}
          </span>
          <small className="mt-0.5 line-clamp-2 block text-[0.68rem] leading-4 text-ink-500">
            {link.snippet}
          </small>
        </button>
      ))}
    </div>
  );
}

function ContextSection({
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
    <section className="border-b border-line-soft py-3 last:border-0">
      <h3 className="mb-2 flex items-center gap-2 px-2 text-[0.75rem] font-semibold text-ink-500">
        {icon}
        {title}
        {count !== undefined && (
          <span className="ml-auto grid min-w-5 place-items-center rounded-full bg-brand-100 px-1.5 py-0.5 text-[0.75rem] text-brand-700">
            {count}
          </span>
        )}
      </h3>
      {children}
    </section>
  );
}

function Property({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2">
      <dt className="text-ink-400">{label}</dt>
      <dd
        className="truncate text-right font-medium text-ink-600"
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}

function EmptyLine({ children }: { children: ReactNode }) {
  return <p className="px-2 py-2 text-xs leading-5 text-ink-400">{children}</p>;
}

function scrollToHeading(index: number) {
  const headings = document.querySelectorAll<HTMLElement>(
    ".product-markdown-editor .ProseMirror > h1, " +
      ".product-markdown-editor .ProseMirror > h2, " +
      ".product-markdown-editor .ProseMirror > h3, " +
      ".product-markdown-editor .ProseMirror > h4, " +
      ".product-markdown-editor .ProseMirror > h5, " +
      ".product-markdown-editor .ProseMirror > h6"
  );
  headings[index]?.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(value));
}
