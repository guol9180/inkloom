import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, RotateCcw, Trash2 } from "lucide-react";
import type { CloudDocumentSummary } from "@inkloom/storage";
import type { WorkspaceId } from "@inkloom/core";
import { AppDialog, Button, Skeleton, toast as showToast } from "@inkloom/ui";
import { cloudClient } from "../../cloud-workspace";

export function TrashDialog({
  open,
  workspaceId,
  onClose,
  onRestored
}: {
  open: boolean;
  workspaceId: string;
  onClose: () => void;
  onRestored: (document: CloudDocumentSummary) => void;
}) {
  const queryClient = useQueryClient();
  const [permanentTarget, setPermanentTarget] =
    useState<CloudDocumentSummary>();
  const trash = useQuery({
    queryKey: ["trash", workspaceId],
    queryFn: () => cloudClient.listDeletedDocuments(workspaceId as WorkspaceId),
    enabled: open
  });

  async function invalidateDocumentLists() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["trash", workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["notes", workspaceId] }),
      queryClient.invalidateQueries({
        queryKey: ["notes", workspaceId, "recent"]
      }),
      queryClient.invalidateQueries({
        queryKey: ["knowledge-documents", workspaceId]
      })
    ]);
  }

  const restore = useMutation({
    mutationFn: (document: CloudDocumentSummary) =>
      cloudClient.restoreDeletedDocument(
        workspaceId as WorkspaceId,
        document.id,
        document.revision
      ),
    async onSuccess(document) {
      await invalidateDocumentLists();
      showToast("文档已恢复到原位置");
      onRestored({
        ...document.meta,
        excerpt: document.markdown.slice(0, 180)
      });
    },
    onError(error) {
      showToast(error instanceof Error ? error.message : "恢复失败，请重试。");
    }
  });

  const remove = useMutation({
    mutationFn: (document: CloudDocumentSummary) =>
      cloudClient.permanentlyDeleteDocument(
        workspaceId as WorkspaceId,
        document.id,
        document.revision
      ),
    async onSuccess() {
      setPermanentTarget(undefined);
      await invalidateDocumentLists();
      showToast("文档已彻底删除");
    },
    onError(error) {
      showToast(error instanceof Error ? error.message : "删除失败，请重试。");
    }
  });

  return (
    <>
      <AppDialog
        open={open}
        title="回收站"
        description="删除的文档会保留在这里，可恢复到原随记或知识库。"
        onClose={onClose}
        footer={
          <Button variant="secondary" onClick={onClose}>
            关闭
          </Button>
        }
      >
        {trash.isPending ? (
          <div className="grid gap-2">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton className="h-16 w-full rounded-xl" key={index} />
            ))}
          </div>
        ) : trash.isError ? (
          <div className="rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
            回收站暂时无法加载。
            <Button
              variant="secondary"
              size="sm"
              className="ml-3"
              onClick={() => void trash.refetch()}
            >
              重试
            </Button>
          </div>
        ) : (trash.data?.length ?? 0) === 0 ? (
          <div className="grid justify-items-center gap-2 py-12 text-center text-ink-500">
            <Trash2 size={22} aria-hidden="true" />
            <strong className="text-sm font-semibold text-ink-800">
              回收站是空的
            </strong>
            <span className="text-xs">删除的文档会暂时出现在这里。</span>
          </div>
        ) : (
          <div className="grid gap-2">
            {trash.data?.map((document) => (
              <div
                key={document.id}
                className="flex items-center gap-3 rounded-xl border border-line-soft bg-paper-warm px-3 py-3"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white text-ink-500 shadow-xs">
                  <FileText size={16} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-sm font-semibold text-ink-800">
                    {document.title}
                  </strong>
                  <span className="mt-0.5 block text-xs text-ink-500">
                    {formatTrashTime(document.updatedAt)} · {document.path}
                  </span>
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={restore.isPending}
                  onClick={() => restore.mutate(document)}
                >
                  <RotateCcw size={13} />
                  恢复
                </Button>
                <Button
                  variant="danger-quiet"
                  size="sm"
                  aria-label={`彻底删除 ${document.title}`}
                  disabled={remove.isPending}
                  onClick={() => setPermanentTarget(document)}
                >
                  <Trash2 size={13} />
                </Button>
              </div>
            ))}
          </div>
        )}
      </AppDialog>

      <AppDialog
        open={Boolean(permanentTarget)}
        title="彻底删除文档"
        description={
          permanentTarget
            ? `“${permanentTarget.title}”的正文、标签和历史版本都会永久删除。`
            : ""
        }
        onClose={() => setPermanentTarget(undefined)}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setPermanentTarget(undefined)}
              disabled={remove.isPending}
            >
              取消
            </Button>
            <Button
              variant="danger"
              disabled={!permanentTarget || remove.isPending}
              onClick={() => {
                if (permanentTarget) remove.mutate(permanentTarget);
              }}
            >
              {remove.isPending ? "正在删除…" : "彻底删除"}
            </Button>
          </>
        }
      >
        <p className="rounded-xl bg-danger-50 px-3 py-2 text-xs leading-5 text-danger-700">
          此操作不能撤销。若仍可能继续使用，请先恢复文档。
        </p>
      </AppDialog>
    </>
  );
}

function formatTrashTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(value));
}
