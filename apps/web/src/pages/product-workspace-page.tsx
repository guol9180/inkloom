import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Archive,
  BookOpen,
  Check,
  ChevronDown,
  Clock3,
  FileText,
  FolderPlus,
  Import,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings,
  Sparkles,
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
import { BrandLockup, BrandMark } from "../components/brand-mark";
import { AppDialog } from "../components/ui/app-dialog";
import { Button, IconButton } from "../components/ui/button";
import { FieldLabel, TextInput } from "../components/ui/field";
import { Skeleton, WorkspaceSkeleton } from "../components/ui/skeleton";
import { cloudClient } from "../cloud-workspace";
import { workspacesQuery } from "../queries";
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
  const workspaces = useQuery(workspacesQuery);
  const workspace = workspaces.data?.workspaces.find(
    (item) => item.id === workspaceId
  );
  const [query, setQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [createDialog, setCreateDialog] = useState<"note" | "knowledge" | null>(
    null
  );
  const [draftName, setDraftName] = useState("");
  const [dialogError, setDialogError] = useState("");
  const importMarkdownRef = useRef<HTMLInputElement>(null);
  const importFolderRef = useRef<HTMLInputElement>(null);

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

  if (workspaces.isPending) return <WorkspaceSkeleton />;
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
      !normalizedQuery ||
      item.title.toLowerCase().includes(normalizedQuery) ||
      item.excerpt.toLowerCase().includes(normalizedQuery) ||
      item.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery))
  );

  async function submitCreate() {
    const name = draftName.trim();
    if (!name) {
      setDialogError(
        createDialog === "knowledge" ? "知识库名称不能为空。" : "文档标题不能为空。"
      );
      return;
    }
    setDialogError("");
    if (createDialog === "knowledge") {
      await createKnowledgeBase.mutateAsync(name);
    } else {
      await createNote.mutateAsync({
        title: name,
        markdown: name === "未命名文档" ? "" : `# ${name}\n`
      });
    }
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
          notes={notes.data ?? []}
          recent={recent.data ?? []}
          knowledgeBases={knowledgeBases.data ?? []}
          knowledgeDocuments={visibleSummaries}
          selectedKnowledgeBase={selectedKnowledgeBase}
          onCreateNote={() => {
            setDraftName("未命名文档");
            setDialogError("");
            setCreateDialog("note");
          }}
          onCreateKnowledgeBase={() => {
            setDraftName("");
            setDialogError("");
            setCreateDialog("knowledge");
          }}
          onImportMarkdown={() => importMarkdownRef.current?.click()}
          onImportFolder={() => importFolderRef.current?.click()}
          onClose={() => setSidebarOpen(false)}
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
                mode={mode}
                onSaved={async () => {
                  await Promise.all([
                    queryClient.invalidateQueries({
                      queryKey: ["document", workspaceId, documentId]
                    }),
                    queryClient.invalidateQueries({
                      queryKey: ["notes", workspaceId]
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
              onCreateNote={() => {
                setDraftName("未命名文档");
                setDialogError("");
                setCreateDialog("note");
              }}
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
        open={createDialog !== null}
        title={createDialog === "knowledge" ? "新建知识库" : "新建随记"}
        description={
          createDialog === "knowledge"
            ? "知识库是平铺文档的顶层容器。"
            : "创建后会直接进入编辑。"
        }
        onClose={() => setCreateDialog(null)}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setCreateDialog(null)}
              disabled={createNote.isPending || createKnowledgeBase.isPending}
            >
              取消
            </Button>
            <Button
              variant="primary"
              type="submit"
              form="product-create-form"
              disabled={createNote.isPending || createKnowledgeBase.isPending}
            >
              {createNote.isPending || createKnowledgeBase.isPending
                ? "正在创建…"
                : "创建"}
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
            {createDialog === "knowledge" ? "知识库名称" : "文档标题"}
            <TextInput
              autoFocus
              maxLength={80}
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              placeholder={
                createDialog === "knowledge" ? "例如：产品知识" : "未命名文档"
              }
            />
          </FieldLabel>
          {dialogError && (
            <p className="rounded-xl bg-danger-50 px-3 py-2 text-xs text-danger-700">
              {dialogError}
            </p>
          )}
        </form>
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
  notes,
  recent,
  knowledgeBases,
  knowledgeDocuments,
  selectedKnowledgeBase,
  onCreateNote,
  onCreateKnowledgeBase,
  onImportMarkdown,
  onImportFolder,
  onClose
}: {
  mode: WorkspaceMode;
  workspaceId: string;
  knowledgeBaseId?: string;
  documentId?: string;
  open: boolean;
  query: string;
  onQuery: (value: string) => void;
  notes: CloudDocumentSummary[];
  recent: CloudDocumentSummary[];
  knowledgeBases: CloudKnowledgeBase[];
  knowledgeDocuments: CloudDocumentSummary[];
  selectedKnowledgeBase?: CloudKnowledgeBase;
  onCreateNote: () => void;
  onCreateKnowledgeBase: () => void;
  onImportMarkdown: () => void;
  onImportFolder: () => void;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const normalizedQuery = query.trim().toLowerCase();
  const filteredNotes = notes.filter(
    (item) =>
      !normalizedQuery ||
      item.title.toLowerCase().includes(normalizedQuery) ||
      item.excerpt.toLowerCase().includes(normalizedQuery) ||
      item.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery))
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
                <button
                  key={item.id}
                  type="button"
                  className={`flex min-h-10 w-full items-center gap-2 rounded-xl px-2.5 text-left text-xs font-semibold transition ${
                    item.id === knowledgeBaseId
                      ? "bg-[#f1f5f2] text-brand-800"
                      : "text-ink-600 hover:bg-[#f7f8f6] hover:text-ink-900"
                  }`}
                  onClick={() =>
                    navigate(
                      `/workspaces/${encodeURIComponent(
                        workspaceId
                      )}/knowledge/${encodeURIComponent(item.id)}`
                    )
                  }
                >
                  <BookOpen size={14} className="text-brand-600" />
                  <span className="min-w-0 flex-1 truncate">{item.name}</span>
                  <ChevronDown size={13} className="-rotate-90 text-ink-300" />
                </button>
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
  mode,
  onSaved
}: {
  document: DocumentSnapshot;
  mode: WorkspaceMode;
  onSaved: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(mode === "notes");
  const [markdown, setMarkdown] = useState(document.markdown);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(document.meta.revision);

  useEffect(() => {
    setMarkdown(document.markdown);
    setRevision(document.meta.revision);
    setEditing(mode === "notes");
  }, [document.meta.id, document.markdown, document.meta.revision, mode]);

  async function save() {
    setSaving(true);
    setError("");
    try {
      const saved = await cloudClient
        .workspace(document.meta.workspaceId)
        .writeDocument({
          documentId: document.meta.id,
          baseRevision: revision,
          markdown,
          title: document.meta.title,
          tags: document.meta.tags
        });
      setRevision(saved.meta.revision);
      setMarkdown(saved.markdown);
      if (mode === "knowledge") setEditing(false);
      await onSaved();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "保存失败，请稍后重试。"
      );
    } finally {
      setSaving(false);
    }
  }

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
          </div>
          {mode === "knowledge" && !editing && (
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
              编辑
            </Button>
          )}
          {editing && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => void save()}
              disabled={saving}
            >
              {saving ? "保存中…" : "保存"}
            </Button>
          )}
        </header>
        {error && (
          <p className="mx-4 mt-4 rounded-xl bg-danger-50 px-3 py-2 text-xs text-danger-700 sm:mx-6">
            {error}
          </p>
        )}
        {editing ? (
          <textarea
            className="min-h-[calc(100dvh-8rem)] w-full resize-none border-0 bg-transparent px-[clamp(1.25rem,5vw,4.5rem)] py-10 font-mono text-[0.92rem] leading-7 text-ink-800 outline-none"
            value={markdown}
            onChange={(event) => setMarkdown(event.target.value)}
            aria-label="Markdown 正文"
            spellCheck={false}
          />
        ) : (
          <div className="whitespace-pre-wrap px-[clamp(1.25rem,5vw,4.5rem)] py-10 font-reading text-[1.02rem] leading-8 text-ink-800">
            {markdown || "这篇文档还没有内容。"}
          </div>
        )}
      </article>
    </div>
  );
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
