import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock3, FileClock, RotateCcw, TriangleAlert, X } from "lucide-react";
import { diffMarkdownBlocks } from "@inkloom/editor";
import type { DocumentSnapshot, WorkspaceId } from "@inkloom/core";
import type { CloudDocumentRevision } from "@inkloom/storage";
import { cloudClient } from "../../cloud-workspace";
import {
  AppDialog,
  AppSheet,
  Button,
  IconButton,
  SegmentedControl,
  Skeleton
} from "@inkloom/ui";

const ProductMarkdownEditor = lazy(() =>
  import("../editor/product-markdown-editor").then((module) => ({
    default: module.ProductMarkdownEditor
  }))
);

export function RevisionHistoryDrawer({
  open,
  document,
  workspaceId,
  currentMarkdown,
  onClose,
  onRestore
}: {
  open: boolean;
  document: DocumentSnapshot;
  workspaceId: string;
  currentMarkdown: string;
  onClose: () => void;
  onRestore: (revision: CloudDocumentRevision) => Promise<void>;
}) {
  const [selectedRevisionId, setSelectedRevisionId] = useState<string>();
  const [mode, setMode] = useState<"preview" | "diff">("preview");
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState("");
  const revisions = useQuery({
    queryKey: ["revisions", workspaceId, document.meta.id],
    queryFn: () =>
      cloudClient.listRevisions(workspaceId as WorkspaceId, document.meta.id),
    enabled: open,
    staleTime: 10_000
  });

  useEffect(() => {
    if (!open) return;
    const first = revisions.data?.[0];
    if (
      first &&
      (!selectedRevisionId ||
        !revisions.data?.some(
          (revision) => revision.revisionId === selectedRevisionId
        ))
    ) {
      setSelectedRevisionId(first.revisionId);
    }
  }, [open, revisions.data, selectedRevisionId]);

  const selected = revisions.data?.find(
    (revision) => revision.revisionId === selectedRevisionId
  );
  const diff = useMemo(
    () =>
      selected ? diffMarkdownBlocks(selected.markdown, currentMarkdown) : [],
    [currentMarkdown, selected]
  );
  if (!open) return null;

  async function restore() {
    if (!selected) return;
    setRestoring(true);
    setError("");
    try {
      await onRestore(selected);
      setRestoreOpen(false);
      onClose();
    } catch (restoreError) {
      setError(
        restoreError instanceof Error
          ? restoreError.message
          : "版本恢复失败，请稍后重试。"
      );
    } finally {
      setRestoring(false);
    }
  }

  return (
    <>
      <AppSheet
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) onClose();
        }}
        title="版本历史"
        description={`查看和恢复“${document.meta.title}”的历史版本。`}
        side="right"
        showHeader={false}
        bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <header className="flex min-h-14 items-center gap-3 border-b border-line-soft px-4">
          <span className="grid size-8 place-items-center rounded-xl bg-brand-50 text-brand-700">
            <FileClock size={15} />
          </span>
          <div className="min-w-0 flex-1">
            <strong className="block truncate text-sm font-semibold text-ink-900">
              版本历史
            </strong>
            <p className="truncate text-[0.75rem] text-ink-400">
              {document.meta.title}
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            disabled={!selected || restoring}
            onClick={() => setRestoreOpen(true)}
          >
            <RotateCcw size={13} />
            恢复此版本
          </Button>
          <IconButton aria-label="关闭版本历史" onClick={onClose}>
            <X size={16} />
          </IconButton>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[14rem_minmax(0,1fr)]">
          <div className="max-h-44 overflow-y-auto border-b border-line-soft bg-paper-warm p-2 md:max-h-none md:border-r md:border-b-0">
            {revisions.isPending ? (
              <div className="grid gap-2">
                {Array.from({ length: 5 }, (_, index) => (
                  <Skeleton key={index} className="h-12 rounded-xl" />
                ))}
              </div>
            ) : revisions.isError ? (
              <p className="rounded-xl bg-danger-50 px-3 py-3 text-xs text-danger-700">
                历史版本加载失败。
              </p>
            ) : revisions.data?.length ? (
              <RevisionList
                revisions={revisions.data}
                selectedId={selectedRevisionId}
                onSelect={(revision) => {
                  setSelectedRevisionId(revision.revisionId);
                  setMode("preview");
                }}
              />
            ) : (
              <p className="px-3 py-8 text-center text-xs leading-5 text-ink-400">
                还没有历史检查点。
              </p>
            )}
          </div>

          <div className="flex min-h-0 min-w-0 flex-col">
            <div className="border-b border-line-soft px-3 py-2">
              <SegmentedControl
                value={mode}
                ariaLabel="版本比较方式"
                className="w-fit grid-cols-2"
                onValueChange={setMode}
                options={[
                  { value: "preview", label: "内容预览" },
                  { value: "diff", label: "块差异" }
                ]}
              />
            </div>
            {error && (
              <p className="m-3 rounded-xl bg-danger-50 px-3 py-2 text-xs text-danger-700">
                {error}
              </p>
            )}
            {selected ? (
              mode === "preview" ? (
                <div className="min-h-0 flex-1 overflow-y-auto">
                  {/assets\//.test(selected.markdown) && (
                    <div className="mx-4 mt-3 flex items-start gap-2 rounded-xl bg-sun-50 px-3 py-2 text-[0.75rem] leading-5 text-sun-700">
                      <TriangleAlert size={13} className="mt-0.5 shrink-0" />
                      历史版本中的资产若已被清理，会保留引用并显示缺失占位，不会自动移除。
                    </div>
                  )}
                  <Suspense
                    fallback={
                      <div className="grid gap-2 p-4">
                        {Array.from({ length: 8 }, (_, index) => (
                          <Skeleton
                            key={index}
                            className="h-4 w-full rounded-md"
                          />
                        ))}
                      </div>
                    }
                  >
                    <ProductMarkdownEditor
                      value={selected.markdown}
                      title={selected.meta.title}
                      documentId={selected.meta.id}
                      workspaceId={workspaceId}
                      readOnly
                      onChange={() => undefined}
                      onFocusSearch={() => undefined}
                    />
                  </Suspense>
                </div>
              ) : (
                <BlockDiff diff={diff} />
              )
            ) : (
              <div className="grid flex-1 place-items-center px-6 text-center text-xs text-ink-400">
                选择一个历史版本查看内容。
              </div>
            )}
          </div>
        </div>
      </AppSheet>

      <AppDialog
        open={restoreOpen}
        title="恢复历史版本"
        description={
          selected
            ? `将 revision ${selected.meta.revision} 恢复为新的当前版本。当前内容会先保存为历史检查点。`
            : ""
        }
        onClose={() => setRestoreOpen(false)}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setRestoreOpen(false)}
              disabled={restoring}
            >
              取消
            </Button>
            <Button
              variant="primary"
              onClick={() => void restore()}
              disabled={restoring}
            >
              {restoring ? "正在恢复…" : "确认恢复"}
            </Button>
          </>
        }
      >
        <p className="rounded-xl bg-brand-50 px-3 py-2 text-xs leading-5 text-brand-800">
          恢复不会删除任何历史版本，只会追加一个新 revision。
        </p>
      </AppDialog>
    </>
  );
}

function RevisionList({
  revisions,
  selectedId,
  onSelect
}: {
  revisions: readonly CloudDocumentRevision[];
  selectedId?: string;
  onSelect: (revision: CloudDocumentRevision) => void;
}) {
  let previousDate = "";
  return (
    <div className="grid gap-0.5">
      {revisions.map((revision) => {
        const date = new Intl.DateTimeFormat("zh-CN", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit"
        }).format(new Date(revision.recordedAt));
        const showDate = date !== previousDate;
        previousDate = date;
        return (
          <div key={revision.revisionId}>
            {showDate && (
              <div className="px-2 pt-3 pb-1 text-[0.75rem] font-semibold text-ink-500">
                {date}
              </div>
            )}
            <button
              type="button"
              className={`flex w-full items-start gap-2 rounded-xl px-2 py-2 text-left transition ${
                revision.revisionId === selectedId
                  ? "bg-white text-ink-900 shadow-sm ring-1 ring-brand-200"
                  : "text-ink-500 hover:bg-white/70 hover:text-ink-800"
              }`}
              onClick={() => onSelect(revision)}
            >
              <Clock3 size={13} className="mt-0.5 shrink-0" />
              <span>
                <strong className="block text-[0.75rem] font-semibold">
                  revision {revision.meta.revision}
                </strong>
                <small className="mt-0.5 block text-[0.68rem] text-ink-500">
                  自动检查点 ·{" "}
                  {new Intl.DateTimeFormat("zh-CN", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                    hour12: false
                  }).format(new Date(revision.recordedAt))}
                </small>
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}

function BlockDiff({ diff }: { diff: ReturnType<typeof diffMarkdownBlocks> }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
      <p className="mb-3 text-[0.75rem] text-ink-400">
        以历史版本为基准，比较当前内容中的新增与移除块。
      </p>
      <div className="grid gap-2">
        {diff.map((row, index) => (
          <article
            key={`${row.kind}-${index}-${row.source}`}
            className={`rounded-xl border px-3 py-2 ${
              row.kind === "added"
                ? "border-brand-200 bg-brand-50"
                : row.kind === "removed"
                  ? "border-danger-200 bg-danger-50"
                  : "border-line-soft bg-paper-warm"
            }`}
          >
            <div
              className={`mb-1 text-[0.75rem] font-semibold ${
                row.kind === "added"
                  ? "text-brand-700"
                  : row.kind === "removed"
                    ? "text-danger-700"
                    : "text-ink-500"
              }`}
            >
              {row.kind === "added"
                ? "新增"
                : row.kind === "removed"
                  ? "移除"
                  : "未变"}
            </div>
            <pre className="line-clamp-6 whitespace-pre-wrap break-words font-mono text-[0.75rem] leading-5 text-ink-700">
              {row.source}
            </pre>
          </article>
        ))}
      </div>
    </div>
  );
}
