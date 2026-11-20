import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
  type RefObject
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Archive,
  BookOpen,
  Check,
  ChevronDown,
  Clock3,
  CloudOff,
  Download,
  FileText,
  FolderPlus,
  Import,
  LoaderCircle,
  LogOut,
  Menu,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  Tag,
  Trash2,
  X
} from "lucide-react";
import {
  useNavigate,
  useParams
} from "react-router";
import {
  workspacePath,
  type DocumentSnapshot,
  type WorkspaceId
} from "@inkloom/core";
import type {
  CloudDocumentSummary,
  CloudKnowledgeBase,
  CloudWorkspace
} from "@inkloom/storage";
import type { CanvasScene } from "@inkloom/diagrams";
import { BrandLockup, BrandMark } from "../components/brand-mark";
import { AppDialog } from "../components/ui/app-dialog";
import { Button, IconButton } from "../components/ui/button";
import { FieldLabel, TextInput } from "../components/ui/field";
import { Skeleton, WorkspaceSkeleton } from "../components/ui/skeleton";
import { cloudClient } from "../cloud-workspace";
import {
  useDocumentAutosave,
  type AutosaveStatus
} from "../features/editor/use-document-autosave";
import { exportDocumentZip } from "../features/editor/document-export";
import { useEditorOwnership } from "../features/editor/use-editor-ownership";
import {
  ProductMarkdownEditor
} from "../features/editor/product-markdown-editor";
import { sessionQuery, workspacesQuery } from "../queries";
import { useToastStore } from "../stores/toast-store";

export type WorkspaceMode = "notes" | "knowledge";

export function ProductWorkspacePage({ mode }: { mode: WorkspaceMode }) {
  const {
    workspaceId = "",
    knowledgeBaseId,
    documentId
  } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const showToast = useToastStore((state) => state.show);
  const session = useQuery(sessionQuery);
  const workspaces = useQuery(workspacesQuery);
  const workspace = workspaces.data?.workspaces.find(
    (item) => item.id === workspaceId
  );
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [createDialog, setCreateDialog] = useState<"note" | "knowledge" | null>(
    null
  );
  const [draftName, setDraftName] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [knowledgeDialog, setKnowledgeDialog] = useState<
    { mode: "rename"; knowledgeBase: CloudKnowledgeBase } |
    { mode: "delete"; knowledgeBase: CloudKnowledgeBase } |
    null
  >(null);
  const [knowledgeNameDraft, setKnowledgeNameDraft] = useState("");
  const [knowledgeActionPending, setKnowledgeActionPending] = useState(false);
  const importMarkdownRef = useRef<HTMLInputElement>(null);
  const importFolderRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const notes = useQuery({
    queryKey: ["notes", workspaceId],
    queryFn: () => cloudClient.listNotes(workspaceId as WorkspaceId),
    enabled: Boolean(workspace)
  });
  const recent = useQuery({
    queryKey: ["notes", workspaceId, "recent"],
    queryFn: () => cloudClient.listRecentDocuments(workspaceId as WorkspaceId),
    enabled: Boolean(workspace)
  });
  const knowledgeBases = useQuery({
    queryKey: ["knowledge-bases", workspaceId],
    queryFn: () => cloudClient.listKnowledgeBases(workspaceId as WorkspaceId),
    enabled: Boolean(workspace)
  });
  const knowledgeDocuments = useQuery({
    queryKey: ["knowledge-documents", workspaceId, knowledgeBaseId],
    queryFn: () =>
      cloudClient.listKnowledgeBaseDocuments(
        workspaceId as WorkspaceId,
        knowledgeBaseId!
      ),
    enabled: Boolean(workspace && knowledgeBaseId)
  });
  const document = useQuery({
    queryKey: ["document", workspaceId, documentId],
    queryFn: () =>
      cloudClient
        .workspace(workspaceId as WorkspaceId)
        .readDocument(documentId!),
    enabled: Boolean(workspace && documentId)
  });

  const createNote = useMutation({
    mutationFn: async (input: { title: string; markdown?: string; tags?: string[] }) => {
      const title = input.title.trim() || "未命名文档";
      const existingPaths = new Set(
        (notes.data ?? []).map((item) => item.path.toLowerCase())
      );
      const path = uniqueMarkdownPath(title, existingPaths);
      return cloudClient.workspace(workspaceId as WorkspaceId).createDocument({
        workspaceId: workspaceId as WorkspaceId,
        path,
        title,
        markdown: input.markdown ?? "",
        tags: input.tags
      });
    },
    async onSuccess(created) {
      await queryClient.invalidateQueries({ queryKey: ["notes", workspaceId] });
      setCreateDialog(null);
      setDraftName("");
      navigate(
        `/workspaces/${encodeURIComponent(
          workspaceId
        )}/notes/${encodeURIComponent(created.meta.id)}`
      );
      setSidebarOpen(false);
    }
  });

  const createKnowledgeBase = useMutation({
    mutationFn: (name: string) =>
      cloudClient.createKnowledgeBase(workspaceId as WorkspaceId, name),
    async onSuccess(created) {
      await queryClient.invalidateQueries({
        queryKey: ["knowledge-bases", workspaceId]
      });
      setCreateDialog(null);
      setDraftName("");
      navigate(
        `/workspaces/${encodeURIComponent(
          workspaceId
        )}/knowledge/${encodeURIComponent(created.id)}`
      );
      setSidebarOpen(false);
    }
  });

  async function renameKnowledgeBase() {
    if (knowledgeDialog?.mode !== "rename") return;
    const name = knowledgeNameDraft.trim();
    if (!name) return;
    setKnowledgeActionPending(true);
    try {
      await cloudClient.renameKnowledgeBase(
        workspaceId as WorkspaceId,
        knowledgeDialog.knowledgeBase.id,
        {
          name,
          baseRevision: knowledgeDialog.knowledgeBase.revision
        }
      );
      await queryClient.invalidateQueries({
        queryKey: ["knowledge-bases", workspaceId]
      });
      setKnowledgeDialog(null);
      showToast("知识库名称已更新");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "重命名失败，请重试。");
    } finally {
      setKnowledgeActionPending(false);
    }
  }

  async function deleteKnowledgeBase() {
    if (knowledgeDialog?.mode !== "delete") return;
    setKnowledgeActionPending(true);
    try {
      await cloudClient.deleteKnowledgeBase(
        workspaceId as WorkspaceId,
        knowledgeDialog.knowledgeBase.id,
        knowledgeDialog.knowledgeBase.revision
      );
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["knowledge-bases", workspaceId]
        }),
        queryClient.invalidateQueries({
          queryKey: ["knowledge-documents", workspaceId]
        }),
        queryClient.invalidateQueries({ queryKey: ["notes", workspaceId] }),
        queryClient.invalidateQueries({
          queryKey: ["notes", workspaceId, "recent"]
        })
      ]);
      const deletedId = knowledgeDialog.knowledgeBase.id;
      setKnowledgeDialog(null);
      showToast("知识库已删除，文档已移回随记");
      if (knowledgeBaseId === deletedId) {
        navigate(`/workspaces/${encodeURIComponent(workspaceId)}/notes`);
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : "删除失败，请重试。");
    } finally {
      setKnowledgeActionPending(false);
    }
  }

  async function moveKnowledgeBase(
    knowledgeBase: CloudKnowledgeBase,
    direction: "up" | "down"
  ) {
    const ordered = knowledgeBases.data ?? [];
    const index = ordered.findIndex((item) => item.id === knowledgeBase.id);
    const target = ordered[direction === "up" ? index - 1 : index + 1];
    if (index < 0 || !target) return;
    setKnowledgeActionPending(true);
    try {
      await cloudClient.renameKnowledgeBase(
        workspaceId as WorkspaceId,
        knowledgeBase.id,
        {
          name: knowledgeBase.name,
          baseRevision: knowledgeBase.revision,
          sortOrder: target.sortOrder
        }
      );
      await cloudClient.renameKnowledgeBase(
        workspaceId as WorkspaceId,
        target.id,
        {
          name: target.name,
          baseRevision: target.revision,
          sortOrder: knowledgeBase.sortOrder
        }
      );
      await queryClient.invalidateQueries({
        queryKey: ["knowledge-bases", workspaceId]
      });
    } catch (error) {
      await queryClient.invalidateQueries({
        queryKey: ["knowledge-bases", workspaceId]
      });
      showToast(
        error instanceof Error ? error.message : "知识库排序失败，请重试。"
      );
    } finally {
      setKnowledgeActionPending(false);
    }
  }

  useEffect(() => {
    if (mode === "knowledge" && !knowledgeBaseId && knowledgeBases.data?.length === 1) {
      navigate(
        `/workspaces/${encodeURIComponent(
          workspaceId
        )}/knowledge/${encodeURIComponent(knowledgeBases.data[0].id)}`,
        { replace: true }
      );
    }
  }, [knowledgeBaseId, knowledgeBases.data, mode, navigate, workspaceId]);

  useEffect(() => {
    function focusDocumentSearch(event: KeyboardEvent) {
      if (
        !(event.ctrlKey || event.metaKey) ||
        event.key.toLowerCase() !== "j"
      ) {
        return;
      }
      event.preventDefault();
      setSidebarOpen(true);
      window.setTimeout(() => searchRef.current?.focus(), 30);
    }
    window.addEventListener("keydown", focusDocumentSearch);
    return () => window.removeEventListener("keydown", focusDocumentSearch);
  }, []);

  if (session.isPending || workspaces.isPending) return <WorkspaceSkeleton />;
  if (workspaces.isError) {
    return (
      <RouteError
        title="工作区暂时无法打开"
        message={
          workspaces.error instanceof Error
            ? workspaces.error.message
            : "请检查网络后重试。"
        }
        onRetry={() => void workspaces.refetch()}
      />
    );
  }
  if (!workspace) {
    return (
      <RouteError
        title="找不到这个工作区"
        message="它可能已经被删除，或不属于当前账号。"
        onRetry={() => navigate("/", { replace: true })}
      />
    );
  }

  const selectedKnowledgeBase = knowledgeBases.data?.find(
    (item) => item.id === knowledgeBaseId
  );
  const currentSummaries =
    mode === "knowledge"
      ? knowledgeDocuments.data ?? []
      : notes.data ?? [];
  const normalizedQuery = query.trim().toLowerCase();
  const visibleSummaries = currentSummaries.filter(
    (item) =>
      (mode !== "notes" ||
        !tagFilter ||
        item.tags.some(
          (tag) => tag.toLowerCase() === tagFilter.toLowerCase()
        )) &&
      (!normalizedQuery ||
        item.title.toLowerCase().includes(normalizedQuery) ||
        item.excerpt.toLowerCase().includes(normalizedQuery) ||
        item.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery)))
  );

  async function submitCreate() {
    const name = draftName.trim();
    if (!name) {
      setDialogError("知识库名称不能为空。");
      return;
    }
    setDialogError("");
    await createKnowledgeBase.mutateAsync(name);
  }

  function createBlankNote() {
    setDialogError("");
    void createNote
      .mutateAsync({ title: "未命名文档", markdown: "" })
      .catch((error: unknown) => {
        showToast(
          error instanceof Error ? error.message : "随记创建失败，请重试。"
        );
      });
  }

  async function importFiles(
    event: ChangeEvent<HTMLInputElement>,
    source: "file" | "folder"
  ) {
    const files = [...(event.target.files ?? [])].filter((file) =>
      /\.md$/i.test(file.name)
    );
    event.target.value = "";
    if (files.length === 0) {
      showToast("没有找到 Markdown 文件");
      return;
    }
    try {
      const usedPaths = new Set(
        (notes.data ?? []).map((item) => item.path.toLowerCase())
      );
      let first: DocumentSnapshot | undefined;
      for (const file of files) {
        const markdown = await file.text();
        const heading = /^#\s+(.+)$/m.exec(markdown)?.[1]?.trim();
        const title = heading || file.name.replace(/\.md$/i, "");
        const path = uniqueMarkdownPath(title, usedPaths);
        const created = await cloudClient
          .workspace(workspaceId as WorkspaceId)
          .createDocument({
            workspaceId: workspaceId as WorkspaceId,
            path,
            title,
            markdown,
            tags: [source === "folder" ? "文件夹导入" : "导入"]
          });
        first ??= created;
      }
      await queryClient.invalidateQueries({ queryKey: ["notes", workspaceId] });
      if (first) {
        navigate(
          `/workspaces/${encodeURIComponent(
            workspaceId
          )}/notes/${encodeURIComponent(first.meta.id)}`
        );
      }
      showToast(`已导入 ${files.length} 篇 Markdown`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "导入失败。");
    }
  }

  async function logout() {
    try {
      await cloudClient.logout();
      queryClient.clear();
      navigate("/login", { replace: true });
    } catch (error) {
      showToast(error instanceof Error ? error.message : "退出失败。");
    }
  }

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-[#fafbf9] text-ink-900">
      <header className="flex h-16 shrink-0 items-center border-b border-line-soft bg-white/95 px-3 backdrop-blur-xl sm:px-4">
        <IconButton
          className="mr-1 lg:hidden"
          aria-label="打开导航"
          onClick={() => setSidebarOpen(true)}
        >
          <Menu size={18} />
        </IconButton>
        <BrandLockup />
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              className="ml-1.5 grid size-8 place-items-center rounded-lg text-ink-400 transition hover:bg-[#f3f5f2] hover:text-ink-800"
              type="button"
              aria-label="切换工作区"
            >
              <ChevronDown size={15} />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="start"
              sideOffset={8}
              className="z-50 w-64 rounded-2xl border border-line-soft bg-white p-2 shadow-[0_20px_60px_rgb(20_36_28_/_0.16)]"
            >
              <DropdownMenu.Label className="px-2 py-1.5 text-[0.62rem] font-bold tracking-[0.1em] text-ink-300 uppercase">
                Workspace
              </DropdownMenu.Label>
              {workspaces.data?.workspaces.map((item) => (
                <DropdownMenu.Item
                  key={item.id}
                  className="flex min-h-10 cursor-default items-center gap-2 rounded-lg px-2.5 text-xs font-medium text-ink-700 outline-none data-[highlighted]:bg-[#f4f6f3]"
                  onSelect={() =>
                    navigate(
                      `/workspaces/${encodeURIComponent(item.id)}/notes`
                    )
                  }
                >
                  <span className="grid size-7 place-items-center rounded-lg bg-brand-50 text-brand-700">
                    <BookOpen size={13} />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{item.name}</span>
                  {item.id === workspace.id && (
                    <Check size={14} className="text-brand-600" />
                  )}
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        <div className="ml-auto flex items-center gap-1">
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                className="flex min-h-9 items-center gap-2 rounded-xl px-2 text-xs font-semibold text-ink-500 transition hover:bg-[#f4f6f3] hover:text-ink-900"
                type="button"
                aria-label="账号设置"
              >
                <span className="grid size-7 place-items-center rounded-full bg-ink-950 text-white">
                  <BrandMark className="size-7 border-0 bg-transparent text-white shadow-none" />
                </span>
                <span className="hidden sm:inline">Account</span>
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={8}
                className="z-50 w-44 rounded-xl border border-line-soft bg-white p-1.5 shadow-[0_18px_50px_rgb(20_36_28_/_0.14)]"
              >
                <DropdownMenu.Item
                  className="flex min-h-9 cursor-default items-center gap-2 rounded-lg px-2.5 text-xs font-medium text-ink-700 outline-none data-[highlighted]:bg-[#f4f6f3]"
                  onSelect={() => void logout()}
                >
                  <LogOut size={14} />
                  退出登录
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {sidebarOpen && (
          <button
            className="absolute inset-0 z-30 bg-ink-950/20 backdrop-blur-[2px] lg:hidden"
            type="button"
            aria-label="关闭导航"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        <WorkspaceSidebar
          mode={mode}
          workspaceId={workspaceId}
          knowledgeBaseId={knowledgeBaseId}
          documentId={documentId}
          open={sidebarOpen}
          query={query}
          onQuery={setQuery}
          tagFilter={tagFilter}
          onTagFilter={setTagFilter}
          notes={notes.data ?? []}
          recent={recent.data ?? []}
          knowledgeBases={knowledgeBases.data ?? []}
          knowledgeDocuments={visibleSummaries}
          selectedKnowledgeBase={selectedKnowledgeBase}
          onCreateNote={createBlankNote}
          onCreateKnowledgeBase={() => {
            setDraftName("");
            setDialogError("");
            setCreateDialog("knowledge");
          }}
          onRenameKnowledgeBase={(knowledgeBase) => {
            setKnowledgeNameDraft(knowledgeBase.name);
            setKnowledgeDialog({ mode: "rename", knowledgeBase });
          }}
          onDeleteKnowledgeBase={(knowledgeBase) =>
            setKnowledgeDialog({ mode: "delete", knowledgeBase })
          }
          onMoveKnowledgeBase={(knowledgeBase, direction) =>
            void moveKnowledgeBase(knowledgeBase, direction)
          }
          knowledgeActionPending={knowledgeActionPending}
          onImportMarkdown={() => importMarkdownRef.current?.click()}
          onImportFolder={() => importFolderRef.current?.click()}
          onClose={() => setSidebarOpen(false)}
          searchRef={searchRef}
        />

        <main className="min-w-0 flex-1 overflow-hidden">
          {documentId ? (
            document.isPending ? (
              <DocumentSkeleton />
            ) : document.isError || !document.data ? (
              <RouteError
                title="文档暂时无法打开"
                message={
                  document.error instanceof Error
                    ? document.error.message
                    : "请稍后重试。"
                }
                onRetry={() => void document.refetch()}
              />
            ) : (
              <DocumentSurface
                document={document.data}
                userId={session.data?.id ?? ""}
                mode={mode}
                knowledgeBases={knowledgeBases.data ?? []}
                onFocusSearch={() => {
                  setSidebarOpen(true);
                  window.setTimeout(() => searchRef.current?.focus(), 30);
                }}
                onSaved={async (saved) => {
                  queryClient.setQueryData(
                    ["document", workspaceId, documentId],
                    saved
                  );
                  await Promise.all([
                    queryClient.invalidateQueries({
                      queryKey: ["notes", workspaceId]
                    }),
                    queryClient.invalidateQueries({
                      queryKey: ["notes", workspaceId, "recent"]
                    }),
                    queryClient.invalidateQueries({
                      queryKey: ["knowledge-documents", workspaceId]
                    })
                  ]);
                }}
              />
            )
          ) : (
            <EmptyWorkspaceState
              mode={mode}
              selectedKnowledgeBase={selectedKnowledgeBase}
              onCreateNote={createBlankNote}
              onCreateKnowledgeBase={() => {
                setDraftName("");
                setDialogError("");
                setCreateDialog("knowledge");
              }}
              onImportMarkdown={() => importMarkdownRef.current?.click()}
              onOpenNotes={() =>
                navigate(`/workspaces/${encodeURIComponent(workspaceId)}/notes`)
              }
            />
          )}
        </main>
      </div>

      <input
        ref={importMarkdownRef}
        className="hidden"
        type="file"
        accept=".md,.markdown,text/markdown,text/plain"
        multiple
        onChange={(event) => void importFiles(event, "file")}
      />
      <input
        ref={(node) => {
          importFolderRef.current = node;
          if (node) {
            (
              node as HTMLInputElement & { webkitdirectory: boolean }
            ).webkitdirectory = true;
          }
        }}
        className="hidden"
        type="file"
        multiple
        onChange={(event) => void importFiles(event, "folder")}
      />

      <AppDialog
        open={createDialog === "knowledge"}
        title="新建知识库"
        description="知识库是平铺文档的顶层容器。"
        onClose={() => setCreateDialog(null)}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setCreateDialog(null)}
              disabled={createKnowledgeBase.isPending}
            >
              取消
            </Button>
            <Button
              variant="primary"
              type="submit"
              form="product-create-form"
              disabled={createKnowledgeBase.isPending}
            >
              {createKnowledgeBase.isPending ? "正在创建…" : "创建"}
            </Button>
          </>
        }
      >
        <form
          id="product-create-form"
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submitCreate();
          }}
        >
          <FieldLabel>
            知识库名称
            <TextInput
              autoFocus
              maxLength={80}
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              placeholder="例如：产品知识"
            />
          </FieldLabel>
          {dialogError && (
            <p className="rounded-xl bg-danger-50 px-3 py-2 text-xs text-danger-700">
              {dialogError}
            </p>
          )}
        </form>
      </AppDialog>

      <AppDialog
        open={knowledgeDialog?.mode === "rename"}
        title="重命名知识库"
        description="知识库名称更新会携带 revision，如果其他页面已修改会提示冲突。"
        onClose={() => setKnowledgeDialog(null)}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setKnowledgeDialog(null)}
              disabled={knowledgeActionPending}
            >
              取消
            </Button>
            <Button
              variant="primary"
              type="submit"
              form="knowledge-rename-form"
              disabled={knowledgeActionPending}
            >
              {knowledgeActionPending ? "正在保存…" : "保存名称"}
            </Button>
          </>
        }
      >
        <form
          id="knowledge-rename-form"
          onSubmit={(event) => {
            event.preventDefault();
            void renameKnowledgeBase();
          }}
        >
          <FieldLabel>
            知识库名称
            <TextInput
              autoFocus
              maxLength={80}
              value={knowledgeNameDraft}
              onChange={(event) => setKnowledgeNameDraft(event.target.value)}
            />
          </FieldLabel>
        </form>
      </AppDialog>

      <AppDialog
        open={knowledgeDialog?.mode === "delete"}
        title="删除知识库"
        description={
          knowledgeDialog?.mode === "delete"
            ? `“${knowledgeDialog.knowledgeBase.name}”中的文档会移回随记，不会删除正文和版本历史。`
            : ""
        }
        onClose={() => setKnowledgeDialog(null)}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setKnowledgeDialog(null)}
              disabled={knowledgeActionPending}
            >
              取消
            </Button>
            <Button
              variant="danger"
              onClick={() => void deleteKnowledgeBase()}
              disabled={knowledgeActionPending}
            >
              {knowledgeActionPending ? "正在删除…" : "删除并移回文档"}
            </Button>
          </>
        }
      >
        <p className="rounded-xl bg-sun-50 px-3 py-2 text-xs leading-5 text-sun-700">
          删除只移除知识库容器，文档会保留并平铺回到随记。
        </p>
      </AppDialog>
    </div>
  );
}

function WorkspaceSidebar({
  mode,
  workspaceId,
  knowledgeBaseId,
  documentId,
  open,
  query,
  onQuery,
  tagFilter,
  onTagFilter,
  notes,
  recent,
  knowledgeBases,
  knowledgeDocuments,
  selectedKnowledgeBase,
  onCreateNote,
  onCreateKnowledgeBase,
  onRenameKnowledgeBase,
  onDeleteKnowledgeBase,
  onMoveKnowledgeBase,
  knowledgeActionPending,
  onImportMarkdown,
  onImportFolder,
  onClose,
  searchRef
}: {
  mode: WorkspaceMode;
  workspaceId: string;
  knowledgeBaseId?: string;
  documentId?: string;
  open: boolean;
  query: string;
  onQuery: (value: string) => void;
  tagFilter: string;
  onTagFilter: (value: string) => void;
  notes: CloudDocumentSummary[];
  recent: CloudDocumentSummary[];
  knowledgeBases: CloudKnowledgeBase[];
  knowledgeDocuments: CloudDocumentSummary[];
  selectedKnowledgeBase?: CloudKnowledgeBase;
  onCreateNote: () => void;
  onCreateKnowledgeBase: () => void;
  onRenameKnowledgeBase: (knowledgeBase: CloudKnowledgeBase) => void;
  onDeleteKnowledgeBase: (knowledgeBase: CloudKnowledgeBase) => void;
  onMoveKnowledgeBase: (
    knowledgeBase: CloudKnowledgeBase,
    direction: "up" | "down"
  ) => void;
  knowledgeActionPending: boolean;
  onImportMarkdown: () => void;
  onImportFolder: () => void;
  onClose: () => void;
  searchRef: RefObject<HTMLInputElement | null>;
}) {
  const navigate = useNavigate();
  const normalizedQuery = query.trim().toLowerCase();
  const filteredNotes = notes.filter(
    (item) =>
      (!tagFilter ||
        item.tags.some(
          (tag) => tag.toLowerCase() === tagFilter.toLowerCase()
        )) &&
      (!normalizedQuery ||
        item.title.toLowerCase().includes(normalizedQuery) ||
        item.excerpt.toLowerCase().includes(normalizedQuery) ||
        item.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery)))
  );
  const availableTags = [...new Set(notes.flatMap((item) => item.tags))].slice(
    0,
    10
  );

  return (
    <aside
      className={`absolute inset-y-0 left-0 z-40 flex w-[min(88vw,18.5rem)] flex-col border-r border-line-soft bg-white shadow-[18px_0_50px_rgb(28_45_36_/_0.08)] transition-transform duration-200 ease-out lg:relative lg:z-10 lg:w-[18rem] lg:translate-x-0 lg:shadow-none xl:w-[19rem] ${
        open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      }`}
    >
      <div className="flex items-center justify-between px-3 pt-3 lg:hidden">
        <span className="text-xs font-semibold text-ink-500">Navigation</span>
        <IconButton aria-label="关闭导航" onClick={onClose}>
          <X size={16} />
        </IconButton>
      </div>

      <div className="grid grid-cols-2 gap-1 p-3">
        <ModeButton
          active={mode === "notes"}
          icon={<FileText size={14} />}
          onClick={() =>
            navigate(`/workspaces/${encodeURIComponent(workspaceId)}/notes`)
          }
        >
          随记
        </ModeButton>
        <ModeButton
          active={mode === "knowledge"}
          icon={<BookOpen size={14} />}
          onClick={() =>
            navigate(`/workspaces/${encodeURIComponent(workspaceId)}/knowledge`)
          }
        >
          知识库
        </ModeButton>
      </div>

      <div className="flex items-center gap-2 px-3 pb-3">
        <label className="flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-line-soft bg-[#fafbf9] px-3 text-ink-400 transition focus-within:border-brand-300 focus-within:bg-white focus-within:ring-4 focus-within:ring-brand-100/70">
          <Search size={15} />
          <input
            ref={searchRef}
            className="min-w-0 flex-1 border-0 bg-transparent text-xs text-ink-900 outline-none placeholder:text-ink-300"
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="搜索"
          />
        </label>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <IconButton
              className="border border-line-soft bg-white"
              aria-label="新建"
            >
              <Plus size={16} />
            </IconButton>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={8}
              className="z-50 w-52 rounded-xl border border-line-soft bg-white p-1.5 shadow-[0_18px_50px_rgb(20_36_28_/_0.14)]"
            >
              <SidebarMenuItem icon={<FileText size={14} />} onSelect={onCreateNote}>
                新建随记
              </SidebarMenuItem>
              <SidebarMenuItem
                icon={<FolderPlus size={14} />}
                onSelect={onCreateKnowledgeBase}
              >
                新建知识库
              </SidebarMenuItem>
              <DropdownMenu.Separator className="my-1 h-px bg-line-soft" />
              <SidebarMenuItem icon={<Import size={14} />} onSelect={onImportMarkdown}>
                导入 Markdown
              </SidebarMenuItem>
              <SidebarMenuItem icon={<Import size={14} />} onSelect={onImportFolder}>
                导入文件夹
              </SidebarMenuItem>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      {mode === "notes" && availableTags.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto px-3 pb-3">
          <button
            type="button"
            className={`shrink-0 rounded-full px-2.5 py-1 text-[0.62rem] font-semibold transition ${
              tagFilter
                ? "bg-[#f4f6f3] text-ink-500 hover:text-ink-800"
                : "bg-brand-50 text-brand-800"
            }`}
            onClick={() => onTagFilter("")}
          >
            全部
          </button>
          {availableTags.map((tag) => (
            <button
              key={tag}
              type="button"
              className={`shrink-0 rounded-full px-2.5 py-1 text-[0.62rem] font-semibold transition ${
                tagFilter === tag
                  ? "bg-brand-50 text-brand-800"
                  : "bg-[#f4f6f3] text-ink-500 hover:text-ink-800"
              }`}
              onClick={() => onTagFilter(tagFilter === tag ? "" : tag)}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        {mode === "notes" ? (
          <>
            {recent.length > 0 && !normalizedQuery && (
              <SidebarGroup icon={<Clock3 size={13} />} title="最近">
                {recent.slice(0, 4).map((item) => (
                  <DocumentRow
                    key={`recent-${item.id}`}
                    document={item}
                    active={item.id === documentId}
                    onClick={() =>
                      navigate(
                        `/workspaces/${encodeURIComponent(
                          workspaceId
                        )}/notes/${encodeURIComponent(item.id)}`
                      )
                    }
                  />
                ))}
              </SidebarGroup>
            )}
            <SidebarGroup icon={<FileText size={13} />} title="全部随记">
              {filteredNotes.map((item) => (
                <DocumentRow
                  key={item.id}
                  document={item}
                  active={item.id === documentId}
                  onClick={() =>
                    navigate(
                      `/workspaces/${encodeURIComponent(
                        workspaceId
                      )}/notes/${encodeURIComponent(item.id)}`
                    )
                  }
                />
              ))}
              {filteredNotes.length === 0 && (
                <p className="px-3 py-5 text-center text-xs leading-5 text-ink-400">
                  没有匹配的随记。
                </p>
              )}
            </SidebarGroup>
          </>
        ) : (
          <>
            <SidebarGroup icon={<BookOpen size={13} />} title="知识库">
              {knowledgeBases.map((item) => (
                <div
                  key={item.id}
                  className={`group flex min-h-10 w-full items-center rounded-xl pr-1 transition ${
                    item.id === knowledgeBaseId
                      ? "bg-[#f1f5f2] text-brand-800"
                      : "text-ink-600 hover:bg-[#f7f8f6] hover:text-ink-900"
                  }`}
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2.5 text-left text-xs font-semibold"
                    onClick={() =>
                      navigate(
                        `/workspaces/${encodeURIComponent(
                          workspaceId
                        )}/knowledge/${encodeURIComponent(item.id)}`
                      )
                    }
                  >
                    <BookOpen size={14} className="text-brand-600" />
                    <span className="min-w-0 flex-1 truncate">
                      {item.name}
                    </span>
                  </button>
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                      <button
                        type="button"
                        className="grid size-7 place-items-center rounded-lg text-ink-300 opacity-100 transition hover:bg-white hover:text-ink-700 focus-visible:opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                        aria-label={`${item.name} 操作`}
                        disabled={knowledgeActionPending}
                      >
                        <MoreHorizontal size={14} />
                      </button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                      <DropdownMenu.Content
                        align="end"
                        sideOffset={6}
                        className="z-50 w-40 rounded-xl border border-line-soft bg-white p-1.5 shadow-[0_18px_50px_rgb(20_36_28_/_0.14)]"
                      >
                        <SidebarMenuItem
                          icon={<Pencil size={14} />}
                          onSelect={() => onRenameKnowledgeBase(item)}
                        >
                          重命名
                        </SidebarMenuItem>
                        <SidebarMenuItem
                          icon={<ChevronDown size={14} className="-rotate-90" />}
                          onSelect={() => onMoveKnowledgeBase(item, "up")}
                        >
                          上移
                        </SidebarMenuItem>
                        <SidebarMenuItem
                          icon={<ChevronDown size={14} className="rotate-90" />}
                          onSelect={() => onMoveKnowledgeBase(item, "down")}
                        >
                          下移
                        </SidebarMenuItem>
                        <DropdownMenu.Separator className="my-1 h-px bg-line-soft" />
                        <DropdownMenu.Item
                          className="flex min-h-9 cursor-default items-center gap-2 rounded-lg px-2.5 text-xs font-medium text-danger-700 outline-none data-[highlighted]:bg-danger-50"
                          onSelect={() => onDeleteKnowledgeBase(item)}
                        >
                          <Trash2 size={14} />
                          删除知识库
                        </DropdownMenu.Item>
                      </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                  </DropdownMenu.Root>
                </div>
              ))}
              {knowledgeBases.length === 0 && (
                <p className="px-3 py-5 text-center text-xs leading-5 text-ink-400">
                  还没有知识库。
                </p>
              )}
            </SidebarGroup>
            {selectedKnowledgeBase && (
              <SidebarGroup icon={<FileText size={13} />} title="文档">
                {knowledgeDocuments.map((item) => (
                  <DocumentRow
                    key={item.id}
                    document={item}
                    active={item.id === documentId}
                    onClick={() =>
                      navigate(
                        `/workspaces/${encodeURIComponent(
                          workspaceId
                        )}/knowledge/${encodeURIComponent(
                          selectedKnowledgeBase.id
                        )}/${encodeURIComponent(item.id)}`
                      )
                    }
                  />
                ))}
                {knowledgeDocuments.length === 0 && (
                  <p className="px-3 py-5 text-center text-xs leading-5 text-ink-400">
                    知识库中还没有文档。
                  </p>
                )}
              </SidebarGroup>
            )}
          </>
        )}
      </div>

      <div className="border-t border-line-soft p-3">
        <button
          type="button"
          className="flex min-h-10 w-full items-center gap-2 rounded-xl px-2.5 text-xs font-medium text-ink-500 transition hover:bg-[#f7f8f6] hover:text-ink-900"
          onClick={() => onCreateKnowledgeBase()}
        >
          <Settings size={14} />
          工作区设置
        </button>
      </div>
    </aside>
  );
}

function ModeButton({
  active,
  icon,
  onClick,
  children
}: {
  active: boolean;
  icon: ReactNode;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`flex min-h-10 items-center justify-center gap-2 rounded-xl text-xs font-semibold transition ${
        active
          ? "bg-ink-950 text-white shadow-sm"
          : "text-ink-500 hover:bg-[#f4f6f3] hover:text-ink-900"
      }`}
      onClick={onClick}
    >
      {icon}
      {children}
    </button>
  );
}

function SidebarGroup({
  icon,
  title,
  children
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-4">
      <h2 className="flex items-center gap-1.5 px-2.5 py-2 text-[0.62rem] font-bold tracking-[0.1em] text-ink-300 uppercase">
        {icon}
        {title}
      </h2>
      <div className="grid gap-0.5">{children}</div>
    </section>
  );
}

function DocumentRow({
  document,
  active,
  onClick
}: {
  document: CloudDocumentSummary;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`flex min-h-11 w-full items-center gap-2 rounded-xl px-2.5 text-left transition ${
        active
          ? "bg-[#eef3ef] text-ink-950 ring-1 ring-brand-200/60"
          : "text-ink-600 hover:bg-[#f7f8f6] hover:text-ink-900"
      }`}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
    >
      <FileText
        size={14}
        className={active ? "text-brand-600" : "text-ink-300"}
      />
      <span className="min-w-0 flex-1">
        <strong className="block truncate text-xs font-semibold">
          {document.title}
        </strong>
        <small className="mt-0.5 block truncate text-[0.62rem] text-ink-400">
          {document.excerpt || "空白文档"}
        </small>
      </span>
    </button>
  );
}

function SidebarMenuItem({
  icon,
  onSelect,
  children
}: {
  icon: ReactNode;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <DropdownMenu.Item
      className="flex min-h-9 cursor-default items-center gap-2 rounded-lg px-2.5 text-xs font-medium text-ink-700 outline-none data-[highlighted]:bg-[#f4f6f3]"
      onSelect={onSelect}
    >
      {icon}
      {children}
    </DropdownMenu.Item>
  );
}

function EmptyWorkspaceState({
  mode,
  selectedKnowledgeBase,
  onCreateNote,
  onCreateKnowledgeBase,
  onImportMarkdown,
  onOpenNotes
}: {
  mode: WorkspaceMode;
  selectedKnowledgeBase?: CloudKnowledgeBase;
  onCreateNote: () => void;
  onCreateKnowledgeBase: () => void;
  onImportMarkdown: () => void;
  onOpenNotes: () => void;
}) {
  return (
    <div className="grid h-full min-h-0 place-items-center overflow-y-auto px-5 py-10">
      <section className="w-full max-w-[34rem] text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-[1.15rem] border border-line-soft bg-white text-brand-700 shadow-[0_16px_40px_rgb(20_36_28_/_0.07)]">
          {mode === "notes" ? <Sparkles size={22} /> : <BookOpen size={22} />}
        </span>
        <h1 className="mt-6 font-display text-2xl font-semibold tracking-[-0.035em] text-ink-950 sm:text-[1.8rem]">
          {mode === "notes"
            ? "从一个清晰的想法开始"
            : selectedKnowledgeBase
              ? selectedKnowledgeBase.name
              : "选择或创建一个知识库"}
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-ink-500">
          {mode === "notes"
            ? "随记直接编辑，之后可以归档到知识库。所有内容保持标准 Markdown。"
            : selectedKnowledgeBase
              ? "这里平铺保存已归档文档，打开后默认进入阅读预览。"
              : "知识库用于长期整理，不创建文件夹，也不产生嵌套层级。"}
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-2.5">
          {mode === "notes" ? (
            <>
              <Button variant="primary" onClick={onCreateNote}>
                <Plus size={15} /> 新建随记
              </Button>
              <Button variant="secondary" onClick={onImportMarkdown}>
                <Import size={15} /> 导入 Markdown
              </Button>
            </>
          ) : (
            <>
              <Button variant="primary" onClick={onCreateKnowledgeBase}>
                <FolderPlus size={15} /> 新建知识库
              </Button>
              <Button variant="secondary" onClick={onOpenNotes}>
                <Archive size={15} /> 从随记归档
              </Button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function DocumentSurface({
  document,
  userId,
  mode,
  knowledgeBases,
  onFocusSearch,
  onSaved
}: {
  document: DocumentSnapshot;
  userId: string;
  mode: WorkspaceMode;
  knowledgeBases: CloudKnowledgeBase[];
  onFocusSearch: () => void;
  onSaved: (snapshot: DocumentSnapshot) => Promise<void>;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const showToast = useToastStore((state) => state.show);
  const [editing, setEditing] = useState(mode === "notes");
  const [exporting, setExporting] = useState(false);
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [tagDraft, setTagDraft] = useState("");
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveKnowledgeBaseId, setArchiveKnowledgeBaseId] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [documentActionPending, setDocumentActionPending] = useState(false);
  const ownership = useEditorOwnership(
    userId
      ? `${userId}:${document.meta.workspaceId}:${document.meta.id}`
      : ""
  );
  const ownsEditor = ownership === "owned" || ownership === "unavailable";
  const editorActive =
    Boolean(userId) && ownsEditor && (mode === "notes" || editing);
  const autosave = useDocumentAutosave({
    document,
    userId,
    active: editorActive,
    onSaved: (saved) => {
      void onSaved(saved);
    },
    onConflictCopy: () => {
      void queryClient.invalidateQueries({
        queryKey: ["notes", document.meta.workspaceId]
      });
    }
  });

  useEffect(() => {
    setEditing(mode === "notes");
  }, [document.meta.id, mode]);

  async function finishEditing() {
    const saved = await autosave.flush(true);
    if (saved) setEditing(false);
  }

  async function exportCurrentDocument() {
    setExporting(true);
    try {
      await autosave.flush(true);
      await exportDocumentZip(document, autosave.markdown);
    } finally {
      setExporting(false);
    }
  }

  async function saveTags(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    autosave.changeTags(tagDraft.split(/[,，]/));
    setTagDialogOpen(false);
  }

  async function archiveCurrentDocument() {
    if (!archiveKnowledgeBaseId) return;
    setDocumentActionPending(true);
    try {
      if (!(await autosave.flush(true))) {
        throw new Error("当前修改尚未保存，已保留在随记和本地草稿中。");
      }
      const adapter = cloudClient.workspace(
        document.meta.workspaceId as WorkspaceId
      );
      const latest = await adapter.readDocument(document.meta.id);
      await cloudClient.archiveDocument(
        document.meta.workspaceId as WorkspaceId,
        document.meta.id,
        {
          knowledgeBaseId: archiveKnowledgeBaseId,
          baseRevision: latest.meta.revision
        }
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["notes", document.meta.workspaceId] }),
        queryClient.invalidateQueries({
          queryKey: ["knowledge-documents", document.meta.workspaceId]
        })
      ]);
      setArchiveOpen(false);
      showToast("已归档到知识库");
      navigate(
        `/workspaces/${encodeURIComponent(document.meta.workspaceId)}/notes`
      );
    } catch (error) {
      showToast(error instanceof Error ? error.message : "归档失败，请重试。");
    } finally {
      setDocumentActionPending(false);
    }
  }

  async function deleteCurrentDocument() {
    setDocumentActionPending(true);
    try {
      if (!(await autosave.flush(true))) {
        throw new Error("当前修改尚未保存，暂不能删除。");
      }
      const adapter = cloudClient.workspace(
        document.meta.workspaceId as WorkspaceId
      );
      const latest = await adapter.readDocument(document.meta.id);
      await adapter.deleteNode({
        nodeId: document.meta.id,
        baseRevision: latest.meta.revision
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["notes", document.meta.workspaceId] }),
        queryClient.invalidateQueries({
          queryKey: ["knowledge-documents", document.meta.workspaceId]
        })
      ]);
      setDeleteOpen(false);
      showToast("文档已删除");
      navigate(
        `/workspaces/${encodeURIComponent(document.meta.workspaceId)}/${
          mode === "knowledge" && document.meta.knowledgeBaseId
            ? `knowledge/${encodeURIComponent(
                document.meta.knowledgeBaseId
              )}`
            : "notes"
        }`
      );
    } catch (error) {
      showToast(error instanceof Error ? error.message : "删除失败，请重试。");
    } finally {
      setDocumentActionPending(false);
    }
  }

  async function restoreCurrentDocumentToNotes() {
    setDocumentActionPending(true);
    try {
      if (!(await autosave.flush(true))) {
        throw new Error("当前修改尚未保存，已保留在知识库和本地草稿中。");
      }
      const adapter = cloudClient.workspace(
        document.meta.workspaceId as WorkspaceId
      );
      const latest = await adapter.readDocument(document.meta.id);
      await cloudClient.restoreDocumentToNotes(
        document.meta.workspaceId as WorkspaceId,
        document.meta.id,
        latest.meta.revision
      );
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["knowledge-documents", document.meta.workspaceId]
        }),
        queryClient.invalidateQueries({
          queryKey: ["notes", document.meta.workspaceId]
        }),
        queryClient.invalidateQueries({
          queryKey: ["notes", document.meta.workspaceId, "recent"]
        })
      ]);
      showToast("文档已移回随记");
      navigate(
        `/workspaces/${encodeURIComponent(
          document.meta.workspaceId
        )}/notes/${encodeURIComponent(document.meta.id)}`
      );
    } catch (error) {
      showToast(error instanceof Error ? error.message : "移回随记失败，请重试。");
    } finally {
      setDocumentActionPending(false);
    }
  }

  const showEditor = editorActive;

  return (
    <div className="h-full overflow-y-auto bg-[#fafbf9]">
      <article className="mx-auto min-h-full w-full max-w-[58rem] border-x border-line-soft bg-white">
        <header className="sticky top-0 z-20 flex min-h-14 items-center gap-3 border-b border-line-soft bg-white/94 px-4 backdrop-blur-xl sm:px-6">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold text-ink-900">
              {document.meta.title}
            </h1>
            <p className="mt-0.5 text-[0.62rem] font-medium text-ink-400">
              {document.meta.lifecycle === "knowledge"
                ? "知识库 · 预览优先"
                : "随记 · Markdown"}
            </p>
            {autosave.tags.length > 0 && (
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {autosave.tags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className="rounded-full bg-[#f4f6f3] px-2 py-0.5 text-[0.6rem] font-medium text-ink-500 transition hover:bg-brand-50 hover:text-brand-800"
                    onClick={() => {
                      setTagDraft(autosave.tags.join(", "));
                      setTagDialogOpen(true);
                    }}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            )}
          </div>
          {editorActive && (
            <AutosaveIndicator
              status={autosave.status}
              lastSavedAt={autosave.lastSavedAt}
            />
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void exportCurrentDocument()}
            disabled={exporting}
          >
            <Download size={13} />
            <span className="hidden sm:inline">
              {exporting ? "导出中…" : "导出"}
            </span>
          </Button>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <IconButton aria-label="文档操作">
                <MoreHorizontal size={16} />
              </IconButton>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={8}
                className="z-50 w-48 rounded-xl border border-line-soft bg-white p-1.5 shadow-[0_18px_50px_rgb(20_36_28_/_0.14)]"
              >
                <DropdownMenu.Item
                  className="flex min-h-9 cursor-default items-center gap-2 rounded-lg px-2.5 text-xs font-medium text-ink-700 outline-none data-[highlighted]:bg-[#f4f6f3]"
                  onSelect={() => {
                    setTagDraft(autosave.tags.join(", "));
                    setTagDialogOpen(true);
                  }}
                >
                  <Tag size={14} />
                  管理标签
                </DropdownMenu.Item>
                {mode === "notes" && (
                  <DropdownMenu.Item
                    className="flex min-h-9 cursor-default items-center gap-2 rounded-lg px-2.5 text-xs font-medium text-ink-700 outline-none data-[highlighted]:bg-[#f4f6f3] data-[disabled]:opacity-40"
                    disabled={knowledgeBases.length === 0}
                    onSelect={() => {
                      setArchiveKnowledgeBaseId(
                        knowledgeBases[0]?.id ?? ""
                      );
                      setArchiveOpen(true);
                    }}
                  >
                    <Archive size={14} />
                    归档到知识库
                  </DropdownMenu.Item>
                )}
                {mode === "knowledge" && (
                  <DropdownMenu.Item
                    className="flex min-h-9 cursor-default items-center gap-2 rounded-lg px-2.5 text-xs font-medium text-ink-700 outline-none data-[highlighted]:bg-[#f4f6f3]"
                    onSelect={() => void restoreCurrentDocumentToNotes()}
                  >
                    <FileText size={14} />
                    移回随记
                  </DropdownMenu.Item>
                )}
                <DropdownMenu.Separator className="my-1 h-px bg-line-soft" />
                <DropdownMenu.Item
                  className="flex min-h-9 cursor-default items-center gap-2 rounded-lg px-2.5 text-xs font-medium text-danger-700 outline-none data-[highlighted]:bg-danger-50"
                  onSelect={() => setDeleteOpen(true)}
                >
                  <Trash2 size={14} />
                  删除文档
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
          {mode === "knowledge" && !editing && ownsEditor && (
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
              编辑
            </Button>
          )}
          {mode === "knowledge" && editing && ownsEditor && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => void finishEditing()}
              disabled={autosave.status === "saving"}
            >
              完成
            </Button>
          )}
        </header>
        {ownership === "blocked" && (
          <DocumentNotice
            tone="warning"
            title="此文档正在另一个标签页编辑"
            description="当前标签页以只读方式打开。关闭另一个编辑标签页后会重新接管。"
          />
        )}
        {autosave.draftRecovered && autosave.status !== "conflict" && (
          <DocumentNotice
            tone="neutral"
            title="已恢复本机草稿"
            description="草稿保存在 IndexedDB 中，正在与云端重新同步。"
          />
        )}
        {(autosave.status === "error" || autosave.status === "offline") && (
          <DocumentNotice
            tone="warning"
            title={
              autosave.status === "offline"
                ? "当前已保存在本机"
                : "自动保存暂时失败"
            }
            description={autosave.error}
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void autosave.retry()}
              >
                <RefreshCw size={13} />
                重试
              </Button>
            }
          />
        )}
        {autosave.conflictCopy && (
          <DocumentNotice
            tone="danger"
            title="发现版本冲突"
            description={autosave.error}
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  navigate(
                    `/workspaces/${encodeURIComponent(
                      document.meta.workspaceId
                    )}/notes/${encodeURIComponent(
                      autosave.conflictCopy!.id
                    )}`
                  )
                }
              >
                打开本地副本
              </Button>
            }
          />
        )}
        {showEditor ? (
          <ProductMarkdownEditor
            value={autosave.markdown}
            title={document.meta.title}
            documentId={document.meta.id}
            workspaceId={document.meta.workspaceId}
            legacyCanvas={
              document.extensions?.canvas as unknown as
                | CanvasScene
                | undefined
            }
            onChange={autosave.changeMarkdown}
            onFocusSearch={onFocusSearch}
          />
        ) : (
          <div className="whitespace-pre-wrap px-[clamp(1.25rem,5vw,4.5rem)] py-10 font-reading text-[1.02rem] leading-8 text-ink-800">
            {document.markdown || "这篇文档还没有内容。"}
          </div>
        )}
      </article>
      <AppDialog
        open={tagDialogOpen}
        title="管理标签"
        description="标签会随文档一起自动保存，并可用于随记筛选。"
        onClose={() => setTagDialogOpen(false)}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setTagDialogOpen(false)}
            >
              取消
            </Button>
            <Button
              variant="primary"
              type="submit"
              form="document-tags-form"
            >
              保存标签
            </Button>
          </>
        }
      >
        <form
          id="document-tags-form"
          className="grid gap-3"
          onSubmit={(event) => void saveTags(event)}
        >
          <FieldLabel>
            标签
            <TextInput
              autoFocus
              value={tagDraft}
              onChange={(event) => setTagDraft(event.target.value)}
              placeholder="产品, 灵感, 待整理"
            />
          </FieldLabel>
          <p className="text-xs leading-5 text-ink-400">
            使用逗号分隔，留空会清除全部标签。
          </p>
        </form>
      </AppDialog>

      <AppDialog
        open={archiveOpen}
        title="归档到知识库"
        description="归档后文档会从随记移入所选知识库，正文和版本历史保持不变。"
        onClose={() => setArchiveOpen(false)}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setArchiveOpen(false)}
              disabled={documentActionPending}
            >
              取消
            </Button>
            <Button
              variant="primary"
              onClick={() => void archiveCurrentDocument()}
              disabled={!archiveKnowledgeBaseId || documentActionPending}
            >
              {documentActionPending ? "正在归档…" : "确认归档"}
            </Button>
          </>
        }
      >
        <div className="grid gap-2">
          {knowledgeBases.map((knowledgeBase) => (
            <button
              key={knowledgeBase.id}
              type="button"
              className={`flex min-h-11 items-center gap-2.5 rounded-xl border px-3 text-left text-sm font-medium transition ${
                archiveKnowledgeBaseId === knowledgeBase.id
                  ? "border-brand-300 bg-brand-50 text-brand-800"
                  : "border-line-soft text-ink-600 hover:border-line hover:bg-[#fafbf9]"
              }`}
              onClick={() => setArchiveKnowledgeBaseId(knowledgeBase.id)}
            >
              <BookOpen size={15} />
              <span className="min-w-0 flex-1 truncate">
                {knowledgeBase.name}
              </span>
              {archiveKnowledgeBaseId === knowledgeBase.id && (
                <Check size={14} />
              )}
            </button>
          ))}
        </div>
      </AppDialog>

      <AppDialog
        open={deleteOpen}
        title="删除文档"
        description={`“${document.meta.title}”将从当前工作区删除，此操作不能直接撤销。`}
        onClose={() => setDeleteOpen(false)}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setDeleteOpen(false)}
              disabled={documentActionPending}
            >
              取消
            </Button>
            <Button
              variant="danger"
              onClick={() => void deleteCurrentDocument()}
              disabled={documentActionPending}
            >
              {documentActionPending ? "正在删除…" : "确认删除"}
            </Button>
          </>
        }
      >
        <p className="rounded-xl bg-danger-50 px-3 py-2 text-xs leading-5 text-danger-700">
          删除前会先确认当前内容已保存；如果保存失败，文档不会被删除。
        </p>
      </AppDialog>
    </div>
  );
}

function AutosaveIndicator({
  status,
  lastSavedAt
}: {
  status: AutosaveStatus;
  lastSavedAt?: string;
}) {
  const label =
    status === "saving"
      ? "保存中…"
      : status === "draft"
        ? "待保存"
        : status === "offline"
          ? "已存本机"
          : status === "error"
            ? "保存失败"
            : status === "conflict"
              ? "版本冲突"
              : lastSavedAt
                ? `已保存 · ${formatSavedTime(lastSavedAt)}`
                : "已保存";
  return (
    <span
      className={`mr-1 flex min-h-8 items-center gap-1.5 rounded-lg px-2 text-[0.65rem] font-semibold ${
        status === "error" || status === "conflict"
          ? "text-danger-700"
          : status === "offline"
            ? "text-sun-700"
            : "text-ink-400"
      }`}
      aria-live="polite"
    >
      {status === "saving" ? (
        <LoaderCircle size={13} className="animate-spin" />
      ) : status === "offline" ? (
        <CloudOff size={13} />
      ) : (
        <Check size={13} />
      )}
      <span className="hidden sm:inline">{label}</span>
    </span>
  );
}

function DocumentNotice({
  tone,
  title,
  description,
  action
}: {
  tone: "neutral" | "warning" | "danger";
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div
      className={`mx-4 mt-4 flex flex-wrap items-center gap-3 rounded-xl border px-3 py-2.5 text-xs sm:mx-6 ${
        tone === "danger"
          ? "border-danger-200 bg-danger-50 text-danger-800"
          : tone === "warning"
            ? "border-sun-200 bg-sun-50 text-sun-700"
            : "border-brand-200 bg-brand-50 text-brand-800"
      }`}
    >
      <span className="min-w-0 flex-1">
        <strong className="block font-semibold">{title}</strong>
        <span className="mt-0.5 block leading-5 opacity-80">{description}</span>
      </span>
      {action}
    </div>
  );
}

function formatSavedTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(value));
}

function DocumentSkeleton() {
  return (
    <div className="h-full overflow-hidden bg-white">
      <div className="mx-auto max-w-[58rem] px-[clamp(1.25rem,5vw,4.5rem)] py-12">
        <Skeleton className="h-9 w-1/2 rounded-xl" />
        <div className="mt-10 grid gap-3">
          {Array.from({ length: 11 }, (_, index) => (
            <Skeleton
              className={index % 4 === 3 ? "h-4 w-3/5 rounded-md" : "h-4 w-full rounded-md"}
              key={String(index)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function RouteError({
  title,
  message,
  onRetry
}: {
  title: string;
  message: string;
  onRetry: () => void;
}) {
  return (
    <main className="grid min-h-dvh place-items-center bg-[#fafbf9] px-5 text-center">
      <section className="max-w-md rounded-[1.5rem] border border-line-soft bg-white p-8 shadow-sm">
        <BrandMark className="mx-auto size-12" />
        <h1 className="mt-5 font-display text-2xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-ink-500">{message}</p>
        <Button variant="primary" className="mt-5" onClick={onRetry}>
          重新连接
        </Button>
      </section>
    </main>
  );
}

function uniqueMarkdownPath(title: string, existing: Set<string>) {
  const safeTitle = title.replace(/[\\/:*?"<>|]/g, "-").trim() || "未命名文档";
  let candidate = `${safeTitle}.md`;
  let index = 2;
  while (existing.has(candidate.toLowerCase())) {
    candidate = `${safeTitle} (${index}).md`;
    index += 1;
  }
  existing.add(candidate.toLowerCase());
  return workspacePath(candidate);
}
