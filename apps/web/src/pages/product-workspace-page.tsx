import {
  lazy,
  Suspense,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
  type RefObject
} from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient
} from "@tanstack/react-query";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Command } from "cmdk";
import {
  GridList,
  GridListHeader,
  GridListItem,
  GridListSection
} from "react-aria-components/GridList";
import { ListLayout, Virtualizer } from "react-aria-components/Virtualizer";
import {
  Archive,
  ArrowUpDown,
  BookOpen,
  Check,
  ChevronDown,
  Clock3,
  CloudOff,
  Download,
  FileText,
  FolderPlus,
  History,
  Import,
  LoaderCircle,
  LogOut,
  Menu,
  MoreHorizontal,
  PanelRight,
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
import { useNavigate, useParams } from "react-router";
import {
  workspacePath,
  type DocumentSnapshot,
  type WorkspaceId
} from "@inkloom/core";
import type {
  CloudDocumentSummary,
  CloudDocumentRevision,
  CloudDocumentSort,
  CloudKnowledgeBase,
  CloudSearchResult,
  CloudWorkspace
} from "@inkloom/storage";
import type { CanvasScene } from "@inkloom/diagrams";
import { BrandLockup, BrandMark } from "../components/brand-mark";
import {
  AppDialog,
  AppSheet,
  Button,
  FieldLabel,
  IconButton,
  SegmentedControl,
  Skeleton,
  TextInput,
  ToggleGroupItem,
  ToggleGroupRoot,
  toast as showToast,
  useMediaQuery,
  WorkspaceSkeleton
} from "@inkloom/ui";
import { cloudClient, persistActiveCloudWorkspace } from "../cloud-workspace";
import {
  useDocumentAutosave,
  type AutosaveStatus
} from "../features/editor/use-document-autosave";
import { exportDocumentZip } from "../features/editor/document-export";
import { useEditorOwnership } from "../features/editor/use-editor-ownership";
import { DocumentContextPanel } from "../features/workspace/document-context-panel";
import { RevisionHistoryDrawer } from "../features/workspace/revision-history-drawer";
import { TrashDialog } from "../features/workspace/trash-dialog";
import {
  matchesSearchShortcut,
  saveWorkspacePreferences,
  useWorkspacePreferences,
  type WorkspacePreferences
} from "../features/workspace/workspace-preferences";
import { sessionQuery, workspacesQuery } from "../queries";

function preloadProductMarkdownEditor() {
  return import("../features/editor/product-markdown-editor");
}

const ProductMarkdownEditor = lazy(() =>
  preloadProductMarkdownEditor().then((module) => ({
    default: module.ProductMarkdownEditor
  }))
);

export type WorkspaceMode = "notes" | "knowledge";
type DocumentCommandAction = "rename" | "archive" | "delete";
type DocumentCommand = {
  requestId: number;
  documentId: string;
  action: DocumentCommandAction;
};
type DocumentRowAction = {
  label: string;
  icon: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  onSelect: () => void;
};
type DocumentSection = {
  id: string;
  title: string;
  icon: ReactNode;
  documents: CloudDocumentSummary[];
};

export function ProductWorkspacePage({ mode }: { mode: WorkspaceMode }) {
  const { workspaceId = "", knowledgeBaseId, documentId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const session = useQuery(sessionQuery);
  const workspaces = useQuery(workspacesQuery);
  const workspace = workspaces.data?.workspaces.find(
    (item) => item.id === workspaceId
  );
  const [query, setQuery] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [createDialog, setCreateDialog] = useState<"note" | "knowledge" | null>(
    null
  );
  const [workspaceSettingsOpen, setWorkspaceSettingsOpen] = useState(false);
  const [workspaceSettingsPending, setWorkspaceSettingsPending] =
    useState(false);
  const [workspaceSettingsError, setWorkspaceSettingsError] = useState("");
  const [workspaceNameDraft, setWorkspaceNameDraft] = useState("");
  const [workspaceCreateOpen, setWorkspaceCreateOpen] = useState(false);
  const [workspaceCreateName, setWorkspaceCreateName] = useState("");
  const [workspaceCreateError, setWorkspaceCreateError] = useState("");
  const [trashOpen, setTrashOpen] = useState(false);
  const [knowledgeSort, setKnowledgeSort] =
    useState<CloudDocumentSort>("updated");
  const [preferences, setPreferences] = useWorkspacePreferences(workspaceId);
  const [preferencesDraft, setPreferencesDraft] =
    useState<WorkspacePreferences>(preferences);
  const [draftName, setDraftName] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [knowledgeDialog, setKnowledgeDialog] = useState<
    | { mode: "rename"; knowledgeBase: CloudKnowledgeBase }
    | { mode: "delete"; knowledgeBase: CloudKnowledgeBase }
    | null
  >(null);
  const [knowledgeNameDraft, setKnowledgeNameDraft] = useState("");
  const [knowledgeActionPending, setKnowledgeActionPending] = useState(false);
  const [documentCommand, setDocumentCommand] = useState<DocumentCommand>();
  const documentCommandIdRef = useRef(0);
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
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchTerm(query.trim());
    }, 220);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!workspace) return;
    const timer = window.setTimeout(() => {
      void preloadProductMarkdownEditor();
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [workspace]);
  const search = useInfiniteQuery({
    queryKey: ["search", workspaceId, searchTerm],
    queryFn: ({ pageParam }) =>
      cloudClient.searchDocuments(workspaceId as WorkspaceId, {
        query: searchTerm,
        page: pageParam,
        pageSize: 20
      }),
    enabled: Boolean(workspace && searchTerm),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page * lastPage.pageSize < lastPage.total
        ? lastPage.page + 1
        : undefined
  });
  const knowledgeBases = useQuery({
    queryKey: ["knowledge-bases", workspaceId],
    queryFn: () => cloudClient.listKnowledgeBases(workspaceId as WorkspaceId),
    enabled: Boolean(workspace)
  });
  const knowledgeDocuments = useQuery({
    queryKey: [
      "knowledge-documents",
      workspaceId,
      knowledgeBaseId,
      knowledgeSort
    ],
    queryFn: () =>
      cloudClient.listKnowledgeBaseDocuments(
        workspaceId as WorkspaceId,
        knowledgeBaseId!,
        knowledgeSort
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
    mutationFn: async (input: {
      title: string;
      markdown?: string;
      tags?: string[];
    }) => {
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

  const createWorkspace = useMutation({
    mutationFn: (name: string) => cloudClient.createWorkspace(name),
    onSuccess(created) {
      queryClient.setQueryData<{
        workspaces: CloudWorkspace[];
        activeWorkspace: CloudWorkspace;
      }>(workspacesQuery.queryKey, (current) => ({
        workspaces: current ? [...current.workspaces, created] : [created],
        activeWorkspace: created
      }));
      setWorkspaceCreateOpen(false);
      setWorkspaceCreateName("");
      setWorkspaceCreateError("");
      persistActiveCloudWorkspace(created.id as WorkspaceId);
      navigate(`/workspaces/${encodeURIComponent(created.id)}/notes`, {
        replace: true
      });
    },
    onError(error) {
      setWorkspaceCreateError(
        error instanceof Error ? error.message : "工作区创建失败，请重试。"
      );
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
      showToast(
        error instanceof Error ? error.message : "重命名失败，请重试。"
      );
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
    const reordered = [...ordered];
    reordered.splice(index, 1);
    reordered.splice(
      direction === "up" ? index - 1 : index + 1,
      0,
      knowledgeBase
    );
    setKnowledgeActionPending(true);
    try {
      await cloudClient.reorderKnowledgeBases(
        workspaceId as WorkspaceId,
        reordered.map((item) => ({
          id: item.id,
          baseRevision: item.revision
        }))
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
    if (
      mode === "knowledge" &&
      !knowledgeBaseId &&
      knowledgeBases.data?.length === 1
    ) {
      const knowledgeBase = knowledgeBases.data[0];
      if (!knowledgeBase) return;
      navigate(
        `/workspaces/${encodeURIComponent(
          workspaceId
        )}/knowledge/${encodeURIComponent(knowledgeBase.id)}`,
        { replace: true }
      );
    }
  }, [knowledgeBaseId, knowledgeBases.data, mode, navigate, workspaceId]);

  useEffect(() => {
    function focusDocumentSearch(event: KeyboardEvent) {
      if (!matchesSearchShortcut(event, preferences.searchShortcut)) {
        return;
      }
      event.preventDefault();
      setSidebarOpen(true);
      window.setTimeout(() => searchRef.current?.focus(), 30);
    }
    window.addEventListener("keydown", focusDocumentSearch);
    return () => window.removeEventListener("keydown", focusDocumentSearch);
  }, [preferences.searchShortcut]);

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
    mode === "knowledge" ? (knowledgeDocuments.data ?? []) : (notes.data ?? []);
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
  const searchResults =
    search.data?.pages.flatMap((page) => page.results) ?? [];

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

  function requestDocumentCommand(
    document: CloudDocumentSummary,
    action: DocumentCommandAction
  ) {
    documentCommandIdRef.current += 1;
    setDocumentCommand({
      requestId: documentCommandIdRef.current,
      documentId: document.id,
      action
    });
    if (document.id === documentId) return;
    navigate(
      document.lifecycle === "knowledge" && document.knowledgeBaseId
        ? `/workspaces/${encodeURIComponent(
            workspaceId
          )}/knowledge/${encodeURIComponent(
            document.knowledgeBaseId
          )}/${encodeURIComponent(document.id)}`
        : `/workspaces/${encodeURIComponent(workspaceId)}/notes/${encodeURIComponent(
            document.id
          )}`
    );
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

  function openWorkspaceSettings() {
    if (!workspace) return;
    setWorkspaceNameDraft(workspace.name);
    setPreferencesDraft(preferences);
    setWorkspaceSettingsError("");
    setWorkspaceSettingsOpen(true);
  }

  async function saveWorkspaceSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspace) return;
    const name = workspaceNameDraft.trim();
    if (!name) {
      setWorkspaceSettingsError("工作区名称不能为空。");
      return;
    }
    setWorkspaceSettingsPending(true);
    setWorkspaceSettingsError("");
    try {
      if (name !== workspace.name) {
        const renamed = await cloudClient.renameWorkspace(
          workspace.id as WorkspaceId,
          name
        );
        queryClient.setQueryData<{
          workspaces: CloudWorkspace[];
          activeWorkspace: CloudWorkspace;
        }>(workspacesQuery.queryKey, (current) =>
          current
            ? {
                workspaces: current.workspaces.map((item) =>
                  item.id === renamed.id ? renamed : item
                ),
                activeWorkspace:
                  current.activeWorkspace.id === renamed.id
                    ? renamed
                    : current.activeWorkspace
              }
            : current
        );
      }
      saveWorkspacePreferences(workspaceId, preferencesDraft);
      setPreferences(preferencesDraft);
      setWorkspaceSettingsOpen(false);
      showToast("工作区设置已保存");
    } catch (error) {
      setWorkspaceSettingsError(
        error instanceof Error ? error.message : "工作区设置保存失败。"
      );
    } finally {
      setWorkspaceSettingsPending(false);
    }
  }

  return (
    <div className="app-product-shell flex h-dvh min-h-0 flex-col overflow-hidden bg-canvas text-ink-900">
      <header className="flex h-14 shrink-0 items-center border-b border-line bg-paper px-3 sm:px-4">
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
              className="ml-1.5 grid size-8 place-items-center rounded-md text-ink-500 transition hover:bg-surface-hover hover:text-ink-800"
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
              className="z-50 w-64 rounded-2xl border border-line-soft bg-white p-2 shadow-popover"
            >
              <DropdownMenu.Label className="px-2 py-1.5 text-[0.75rem] font-medium text-ink-500">
                工作区
              </DropdownMenu.Label>
              {workspaces.data?.workspaces.map((item) => (
                <DropdownMenu.Item
                  key={item.id}
                  className="flex min-h-10 cursor-default items-center gap-2 rounded-lg px-2.5 text-xs font-medium text-ink-700 outline-none data-[highlighted]:bg-surface-subtle"
                  onSelect={() =>
                    navigate(`/workspaces/${encodeURIComponent(item.id)}/notes`)
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
              <DropdownMenu.Separator className="my-1 h-px bg-line-soft" />
              <DropdownMenu.Item
                className="flex min-h-10 cursor-default items-center gap-2 rounded-lg px-2.5 text-xs font-medium text-ink-700 outline-none data-[highlighted]:bg-surface-subtle"
                onSelect={() => {
                  setWorkspaceCreateName("");
                  setWorkspaceCreateError("");
                  setWorkspaceCreateOpen(true);
                }}
              >
                <span className="grid size-7 place-items-center rounded-lg bg-surface-subtle text-ink-600">
                  <Plus size={14} />
                </span>
                新建工作区
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        <div className="ml-auto flex items-center gap-1">
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                className="flex min-h-9 items-center gap-2 rounded-md px-2 text-xs font-semibold text-ink-500 transition hover:bg-surface-subtle hover:text-ink-900"
                type="button"
                aria-label="账号设置"
              >
                <span className="grid size-7 place-items-center rounded-full bg-ink-950 text-white">
                  <BrandMark className="size-7 border-0 bg-transparent text-white shadow-none" />
                </span>
                <span className="hidden sm:inline">账号</span>
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={8}
                className="z-50 w-44 rounded-xl border border-line-soft bg-white p-1.5 shadow-popover"
              >
                <DropdownMenu.Item
                  className="flex min-h-9 cursor-default items-center gap-2 rounded-lg px-2.5 text-xs font-medium text-ink-700 outline-none data-[highlighted]:bg-surface-subtle"
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
          searchResults={searchResults}
          searchPending={
            Boolean(query.trim()) &&
            (query.trim() !== searchTerm || search.isPending)
          }
          searchError={search.isError}
          searchHasMore={search.hasNextPage}
          onLoadMoreSearch={() => void search.fetchNextPage()}
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
          onDocumentCommand={requestDocumentCommand}
          knowledgeActionPending={knowledgeActionPending}
          onImportMarkdown={() => importMarkdownRef.current?.click()}
          onImportFolder={() => importFolderRef.current?.click()}
          onOpenSettings={openWorkspaceSettings}
          onOpenTrash={() => {
            setSidebarOpen(false);
            setTrashOpen(true);
          }}
          knowledgeSort={knowledgeSort}
          onKnowledgeSort={setKnowledgeSort}
          onClose={() => setSidebarOpen(false)}
          searchRef={searchRef}
        />

        <main className="min-w-0 flex-1 overflow-hidden">
          {documentId ? (
            document.isPending ||
            (document.data && document.data.meta.id !== documentId) ? (
              <DocumentSkeleton />
            ) : document.isError ||
              !document.data ||
              document.data.meta.id !== documentId ? (
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
                key={document.data.meta.id}
                document={document.data}
                userId={session.data?.id ?? ""}
                mode={mode}
                knowledgeBases={knowledgeBases.data ?? []}
                command={
                  documentCommand?.documentId === document.data.meta.id
                    ? documentCommand
                    : undefined
                }
                onCommandHandled={(requestId) =>
                  setDocumentCommand((current) =>
                    current?.requestId === requestId ? undefined : current
                  )
                }
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
                defaultInfoOpen={preferences.openDocumentInfoByDefault}
                readingScale={preferences.readingScale}
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
        open={workspaceCreateOpen}
        title="新建工作区"
        description="工作区彼此隔离，适合区分不同项目或个人空间。"
        onClose={() => {
          if (!createWorkspace.isPending) setWorkspaceCreateOpen(false);
        }}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setWorkspaceCreateOpen(false)}
              disabled={createWorkspace.isPending}
            >
              取消
            </Button>
            <Button
              variant="primary"
              type="submit"
              form="workspace-create-form"
              disabled={createWorkspace.isPending}
            >
              {createWorkspace.isPending ? "正在创建…" : "创建工作区"}
            </Button>
          </>
        }
      >
        <form
          id="workspace-create-form"
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const name = workspaceCreateName.trim();
            if (!name) {
              setWorkspaceCreateError("工作区名称不能为空。");
              return;
            }
            createWorkspace.mutate(name);
          }}
        >
          <FieldLabel>
            工作区名称
            <TextInput
              autoFocus
              maxLength={80}
              value={workspaceCreateName}
              onChange={(event) => setWorkspaceCreateName(event.target.value)}
              placeholder="例如：个人写作"
            />
          </FieldLabel>
          {workspaceCreateError && (
            <p
              role="alert"
              className="rounded-xl bg-danger-50 px-3 py-2 text-xs text-danger-700"
            >
              {workspaceCreateError}
            </p>
          )}
        </form>
      </AppDialog>

      <AppDialog
        open={workspaceSettingsOpen}
        title="工作区设置"
        description="这些偏好保存在当前浏览器，并只影响当前工作区的编辑体验。"
        onClose={() => {
          if (!workspaceSettingsPending) setWorkspaceSettingsOpen(false);
        }}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setWorkspaceSettingsOpen(false)}
              disabled={workspaceSettingsPending}
            >
              取消
            </Button>
            <Button
              variant="primary"
              type="submit"
              form="workspace-settings-form"
              disabled={workspaceSettingsPending}
            >
              {workspaceSettingsPending ? "正在保存…" : "保存设置"}
            </Button>
          </>
        }
      >
        <form
          id="workspace-settings-form"
          className="grid gap-5"
          onSubmit={(event) => void saveWorkspaceSettings(event)}
        >
          <FieldLabel>
            工作区名称
            <TextInput
              autoFocus
              maxLength={80}
              value={workspaceNameDraft}
              onChange={(event) => setWorkspaceNameDraft(event.target.value)}
            />
          </FieldLabel>

          <FieldLabel>
            文档搜索快捷键
            <select
              className="h-11 w-full rounded-xl border border-line bg-white px-3.5 text-sm text-ink-950 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-200/55"
              value={preferencesDraft.searchShortcut}
              onChange={(event) =>
                setPreferencesDraft((current) => ({
                  ...current,
                  searchShortcut: event.target.value as
                    "ctrl-j" | "ctrl-shift-f"
                }))
              }
            >
              <option value="ctrl-j">Ctrl / Cmd + J</option>
              <option value="ctrl-shift-f">Ctrl / Cmd + Shift + F</option>
            </select>
          </FieldLabel>

          <label className="flex items-start gap-3 rounded-xl border border-line-soft bg-paper-warm px-3.5 py-3">
            <input
              type="checkbox"
              className="mt-1 size-4 accent-brand-700"
              checked={preferencesDraft.openDocumentInfoByDefault}
              onChange={(event) =>
                setPreferencesDraft((current) => ({
                  ...current,
                  openDocumentInfoByDefault: event.target.checked
                }))
              }
            />
            <span>
              <strong className="block text-sm font-semibold text-ink-800">
                新文档默认打开信息栏
              </strong>
              <small className="mt-0.5 block text-xs leading-5 text-ink-400">
                切换文档或新建文档时显示大纲、链接与资产信息。
              </small>
            </span>
          </label>

          <fieldset className="grid gap-2">
            <legend className="text-sm font-semibold text-ink-700">
              正文阅读字号
            </legend>
            <SegmentedControl
              value={preferencesDraft.readingScale}
              ariaLabel="正文阅读字号"
              className="grid-cols-3 border border-line-soft bg-white"
              onValueChange={(readingScale) =>
                setPreferencesDraft((current) => ({
                  ...current,
                  readingScale
                }))
              }
              options={[
                { value: "compact", label: "紧凑正文" },
                { value: "comfortable", label: "标准正文" },
                { value: "large", label: "大号正文" }
              ]}
            />
          </fieldset>

          {workspaceSettingsError && (
            <p
              role="alert"
              className="rounded-xl bg-danger-50 px-3 py-2 text-xs text-danger-700"
            >
              {workspaceSettingsError}
            </p>
          )}
        </form>
      </AppDialog>

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

      <TrashDialog
        open={trashOpen}
        workspaceId={workspaceId}
        onClose={() => setTrashOpen(false)}
        onRestored={(restored) => {
          setTrashOpen(false);
          navigate(
            restored.lifecycle === "knowledge" && restored.knowledgeBaseId
              ? `/workspaces/${encodeURIComponent(
                  workspaceId
                )}/knowledge/${encodeURIComponent(
                  restored.knowledgeBaseId
                )}/${encodeURIComponent(restored.id)}`
              : `/workspaces/${encodeURIComponent(
                  workspaceId
                )}/notes/${encodeURIComponent(restored.id)}`
          );
        }}
      />
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
  searchResults,
  searchPending,
  searchError,
  searchHasMore,
  onLoadMoreSearch,
  knowledgeBases,
  knowledgeDocuments,
  selectedKnowledgeBase,
  onCreateNote,
  onCreateKnowledgeBase,
  onRenameKnowledgeBase,
  onDeleteKnowledgeBase,
  onMoveKnowledgeBase,
  onDocumentCommand,
  knowledgeActionPending,
  onImportMarkdown,
  onImportFolder,
  onOpenSettings,
  onOpenTrash,
  knowledgeSort,
  onKnowledgeSort,
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
  searchResults: CloudSearchResult[];
  searchPending: boolean;
  searchError: boolean;
  searchHasMore: boolean;
  onLoadMoreSearch: () => void;
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
  onDocumentCommand: (
    document: CloudDocumentSummary,
    action: DocumentCommandAction
  ) => void;
  knowledgeActionPending: boolean;
  onImportMarkdown: () => void;
  onImportFolder: () => void;
  onOpenSettings: () => void;
  onOpenTrash: () => void;
  knowledgeSort: CloudDocumentSort;
  onKnowledgeSort: (sort: CloudDocumentSort) => void;
  onClose: () => void;
  searchRef: RefObject<HTMLInputElement | null>;
}) {
  const navigate = useNavigate();
  const desktop = useMediaQuery("(min-width: 1024px)");
  const normalizedQuery = query.trim().toLowerCase();
  const searchInputFocusedRef = useRef(false);
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
  const recentDocuments = recent.slice(0, 4);
  const recentDocumentIds = new Set(
    recentDocuments.map((document) => document.id)
  );
  const notesWithoutRecentDuplicates =
    normalizedQuery || tagFilter
      ? filteredNotes
      : filteredNotes.filter((document) => !recentDocumentIds.has(document.id));

  useEffect(() => {
    if (!searchInputFocusedRef.current) return;
    const frame = window.requestAnimationFrame(() => {
      searchRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [Boolean(query.trim()), searchRef]);
  const scratchActions = (item: CloudDocumentSummary): DocumentRowAction[] => [
    {
      label: "重命名",
      icon: <Pencil size={14} />,
      onSelect: () => onDocumentCommand(item, "rename")
    },
    {
      label: "归档到知识库",
      icon: <Archive size={14} />,
      disabled: knowledgeBases.length === 0,
      onSelect: () => onDocumentCommand(item, "archive")
    },
    {
      label: "删除文档",
      icon: <Trash2 size={14} />,
      danger: true,
      onSelect: () => onDocumentCommand(item, "delete")
    }
  ];
  const knowledgeDocumentActions = (
    item: CloudDocumentSummary
  ): DocumentRowAction[] => [
    {
      label: "重命名",
      icon: <Pencil size={14} />,
      onSelect: () => onDocumentCommand(item, "rename")
    },
    {
      label: "删除文档",
      icon: <Trash2 size={14} />,
      danger: true,
      onSelect: () => onDocumentCommand(item, "delete")
    }
  ];

  const content = (
    <Command
      shouldFilter={false}
      label="文档搜索"
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="flex items-center justify-between px-3 pt-3 lg:hidden">
        <span className="text-xs font-semibold text-ink-500">工作区导航</span>
        <IconButton aria-label="关闭导航" onClick={onClose}>
          <X size={16} />
        </IconButton>
      </div>

      <SegmentedControl
        value={mode}
        ariaLabel="工作区模式"
        className="m-3 grid-cols-2 bg-[#ececea]"
        itemClassName="rounded-md data-[state=on]:shadow-none"
        onValueChange={(nextMode) => {
          navigate(
            `/workspaces/${encodeURIComponent(workspaceId)}/${nextMode}`
          );
          onClose();
        }}
        options={[
          {
            value: "notes",
            label: "随记",
            icon: <FileText size={14} />
          },
          {
            value: "knowledge",
            label: "知识库",
            icon: <BookOpen size={14} />
          }
        ]}
      />

      <div className="flex items-center gap-2 px-3 pb-3">
        <label className="flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border border-line bg-paper px-3 text-ink-500 transition focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100">
          <Search size={15} />
          {normalizedQuery ? (
            <Command.Input
              ref={searchRef}
              className="min-w-0 flex-1 border-0 bg-transparent text-xs text-ink-900 outline-none placeholder:text-ink-500"
              value={query}
              onValueChange={(value) => {
                searchInputFocusedRef.current = true;
                onQuery(value);
              }}
              placeholder="搜索"
            />
          ) : (
            <input
              ref={searchRef}
              className="min-w-0 flex-1 border-0 bg-transparent text-xs text-ink-900 outline-none placeholder:text-ink-500"
              value={query}
              onChange={(event) => {
                searchInputFocusedRef.current = true;
                onQuery(event.target.value);
              }}
              placeholder="搜索"
            />
          )}
        </label>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <IconButton
              className="size-9 min-h-9 rounded-lg border border-line bg-paper shadow-none"
              aria-label="新建"
            >
              <Plus size={16} />
            </IconButton>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={8}
              className="z-50 w-52 rounded-xl border border-line-soft bg-white p-1.5 shadow-popover"
            >
              <SidebarMenuItem
                icon={<FileText size={14} />}
                onSelect={onCreateNote}
              >
                新建随记
              </SidebarMenuItem>
              <SidebarMenuItem
                icon={<FolderPlus size={14} />}
                onSelect={onCreateKnowledgeBase}
              >
                新建知识库
              </SidebarMenuItem>
              <DropdownMenu.Separator className="my-1 h-px bg-line-soft" />
              <SidebarMenuItem
                icon={<Import size={14} />}
                onSelect={onImportMarkdown}
              >
                导入 Markdown
              </SidebarMenuItem>
              <SidebarMenuItem
                icon={<Import size={14} />}
                onSelect={onImportFolder}
              >
                导入文件夹
              </SidebarMenuItem>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      {mode === "notes" && availableTags.length > 0 && (
        <ToggleGroupRoot
          type="single"
          value={tagFilter || "all"}
          aria-label="按标签筛选"
          className="flex gap-1.5 overflow-x-auto px-3 pb-3"
          onValueChange={(value: string) =>
            onTagFilter(value === "all" ? "" : value)
          }
        >
          <ToggleGroupItem
            value="all"
            className="shrink-0 rounded-full bg-surface-subtle px-2.5 py-1 text-[0.75rem] font-semibold text-ink-500 outline-none transition hover:text-ink-800 data-[state=on]:bg-brand-50 data-[state=on]:text-brand-800"
          >
            全部
          </ToggleGroupItem>
          {availableTags.map((tag) => (
            <ToggleGroupItem
              key={tag}
              value={tag}
              className="shrink-0 rounded-full bg-surface-subtle px-2.5 py-1 text-[0.75rem] font-semibold text-ink-500 outline-none transition hover:text-ink-800 data-[state=on]:bg-brand-50 data-[state=on]:text-brand-800"
            >
              #{tag}
            </ToggleGroupItem>
          ))}
        </ToggleGroupRoot>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        {normalizedQuery ? (
          searchError ? (
            <div className="mx-1 rounded-xl border border-danger-200 bg-danger-50 px-3 py-3 text-xs leading-5 text-danger-700">
              搜索暂时不可用，文档内容没有受到影响。
            </div>
          ) : searchPending ? (
            <Command.Loading label="正在搜索文档">
              <div className="grid gap-2 px-1 py-3">
                {Array.from({ length: 4 }, (_, index) => (
                  <Skeleton key={index} className="h-11 w-full rounded-xl" />
                ))}
              </div>
            </Command.Loading>
          ) : searchResults.length === 0 ? (
            <Command.List>
              <Command.Empty className="px-3 py-8 text-center text-xs leading-5 text-ink-400">
                没有找到匹配内容。
              </Command.Empty>
            </Command.List>
          ) : (
            <>
              <Command.List className="grid gap-1">
                <SearchResultGroup
                  title="随记"
                  results={searchResults.filter(
                    (item) => item.lifecycle === "scratch"
                  )}
                  workspaceId={workspaceId}
                  activeDocumentId={documentId}
                />
                <SearchResultGroup
                  title="知识库"
                  results={searchResults.filter(
                    (item) => item.lifecycle === "knowledge"
                  )}
                  workspaceId={workspaceId}
                  activeDocumentId={documentId}
                />
                {searchHasMore && (
                  <button
                    type="button"
                    className="mx-1 mt-2 min-h-9 w-[calc(100%-0.5rem)] rounded-lg border border-line-soft text-xs font-semibold text-ink-500 transition hover:bg-canvas hover:text-ink-900"
                    onClick={onLoadMoreSearch}
                  >
                    加载更多
                  </button>
                )}
              </Command.List>
            </>
          )
        ) : mode === "notes" ? (
          <DocumentGridList
            sections={[
              ...(recent.length > 0 && !normalizedQuery && !tagFilter
                ? [
                    {
                      id: "recent",
                      title: "最近打开",
                      icon: <Clock3 size={13} />,
                      documents: recentDocuments
                    }
                  ]
                : []),
              {
                id: "notes",
                title: "全部随记",
                icon: <FileText size={13} />,
                documents: notesWithoutRecentDuplicates
              }
            ]}
            activeDocumentId={documentId}
            actions={scratchActions}
            emptyMessage="没有匹配的随记。"
            onOpen={(item) =>
              navigate(
                `/workspaces/${encodeURIComponent(workspaceId)}/notes/${encodeURIComponent(item.id)}`
              )
            }
          />
        ) : (
          <>
            <SidebarGroup icon={<BookOpen size={13} />} title="知识库">
              {knowledgeBases.map((item) => (
                <div
                  key={item.id}
                  className={`group flex min-h-10 w-full items-center rounded-xl pr-1 transition ${
                    item.id === knowledgeBaseId
                      ? "bg-surface-selected text-brand-800"
                      : "text-ink-600 hover:bg-canvas hover:text-ink-900"
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
                    <span className="min-w-0 flex-1 truncate">{item.name}</span>
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
                        className="z-50 w-40 rounded-xl border border-line-soft bg-white p-1.5 shadow-popover"
                      >
                        <SidebarMenuItem
                          icon={<Pencil size={14} />}
                          onSelect={() => onRenameKnowledgeBase(item)}
                        >
                          重命名
                        </SidebarMenuItem>
                        <SidebarMenuItem
                          icon={
                            <ChevronDown size={14} className="-rotate-90" />
                          }
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
              <DocumentGridList
                sections={[
                  {
                    id: "knowledge-documents",
                    title: "文档",
                    icon: <FileText size={13} />,
                    documents: knowledgeDocuments
                  }
                ]}
                activeDocumentId={documentId}
                actions={knowledgeDocumentActions}
                headerAction={
                  <KnowledgeSortMenu
                    value={knowledgeSort}
                    onChange={onKnowledgeSort}
                  />
                }
                emptyMessage="知识库中还没有文档。"
                onOpen={(item) =>
                  navigate(
                    `/workspaces/${encodeURIComponent(
                      workspaceId
                    )}/knowledge/${encodeURIComponent(
                      selectedKnowledgeBase.id
                    )}/${encodeURIComponent(item.id)}`
                  )
                }
              />
            )}
          </>
        )}
      </div>

      <div className="border-t border-line-soft p-3">
        <div className="grid gap-0.5">
          <button
            type="button"
            className="flex min-h-10 w-full items-center gap-2 rounded-lg px-2.5 text-xs font-medium text-ink-600 transition hover:bg-canvas hover:text-ink-900"
            onClick={onOpenTrash}
          >
            <Trash2 size={14} />
            回收站
          </button>
          <button
            type="button"
            className="flex min-h-10 w-full items-center gap-2 rounded-lg px-2.5 text-xs font-medium text-ink-600 transition hover:bg-canvas hover:text-ink-900"
            onClick={onOpenSettings}
          >
            <Settings size={14} />
            工作区设置
          </button>
        </div>
      </div>
    </Command>
  );

  if (!desktop) {
    return (
      <AppSheet
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) onClose();
        }}
        side="left"
        title="工作区导航"
        showHeader={false}
        bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        {content}
      </AppSheet>
    );
  }

  return (
    <aside className="relative z-10 flex w-[17rem] shrink-0 flex-col border-r border-line bg-canvas xl:w-[18rem]">
      {content}
    </aside>
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
      <h2 className="flex items-center gap-1.5 px-2.5 py-2 text-[0.72rem] font-medium text-ink-500">
        {icon}
        {title}
      </h2>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-0.5">{children}</div>
    </section>
  );
}

function SearchResultGroup({
  title,
  results,
  workspaceId,
  activeDocumentId
}: {
  title: string;
  results: CloudSearchResult[];
  workspaceId: string;
  activeDocumentId?: string;
}) {
  const navigate = useNavigate();
  if (results.length === 0) return null;
  return (
    <Command.Group
      heading={
        <span className="flex items-center gap-1.5 px-2.5 py-2 text-[0.72rem] font-medium text-ink-500">
          {title === "随记" ? <FileText size={13} /> : <BookOpen size={13} />}
          {title} · {results.length}
        </span>
      }
      className="mb-4 grid gap-0.5"
    >
      {results.map((item) => {
        const route =
          item.lifecycle === "knowledge" && item.knowledgeBaseId
            ? `/workspaces/${encodeURIComponent(
                workspaceId
              )}/knowledge/${encodeURIComponent(
                item.knowledgeBaseId
              )}/${encodeURIComponent(item.id)}`
            : `/workspaces/${encodeURIComponent(
                workspaceId
              )}/notes/${encodeURIComponent(item.id)}`;
        return (
          <Command.Item
            key={item.id}
            asChild
            value={item.id}
            onSelect={() => navigate(route)}
          >
            <button
              type="button"
              className={`flex min-h-11 w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left text-ink-600 transition outline-none hover:bg-surface-hover hover:text-ink-900 data-[selected=true]:bg-surface-selected data-[selected=true]:text-ink-950 ${
                item.id === activeDocumentId
                  ? "bg-surface-selected text-ink-950"
                  : ""
              }`}
            >
              <FileText size={14} className="mt-0.5 shrink-0 text-ink-500" />
              <span className="min-w-0 flex-1">
                <strong className="block truncate text-xs font-semibold">
                  {item.title}
                </strong>
                <small className="mt-0.5 line-clamp-2 block text-[0.75rem] leading-4 text-ink-500">
                  <HighlightedSearchText value={item.snippet || item.excerpt} />
                </small>
                {item.tags.length > 0 && (
                  <span className="mt-1 flex flex-wrap gap-1">
                    {item.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="rounded bg-surface-subtle px-1.5 py-0.5 text-[0.72rem] font-medium text-ink-500"
                      >
                        #{tag}
                      </span>
                    ))}
                  </span>
                )}
              </span>
            </button>
          </Command.Item>
        );
      })}
    </Command.Group>
  );
}

function HighlightedSearchText({ value }: { value: string }) {
  const parts = value.split(/(<mark>|<\/mark>)/i);
  let highlighted = false;
  return parts.map((part, index) => {
    if (/^<mark>$/i.test(part)) {
      highlighted = true;
      return null;
    }
    if (/^<\/mark>$/i.test(part)) {
      highlighted = false;
      return null;
    }
    return highlighted ? (
      <mark
        key={`${index}-${part}`}
        className="rounded bg-sun-100 px-0.5 text-ink-800"
      >
        {part}
      </mark>
    ) : (
      part
    );
  });
}

function DocumentGridList({
  sections,
  activeDocumentId,
  actions,
  headerAction,
  emptyMessage,
  onOpen
}: {
  sections: readonly DocumentSection[];
  activeDocumentId?: string;
  actions: (document: CloudDocumentSummary) => DocumentRowAction[];
  headerAction?: ReactNode;
  emptyMessage: string;
  onOpen: (document: CloudDocumentSummary) => void;
}) {
  const populated = sections.filter((section) => section.documents.length > 0);
  if (populated.length === 0) {
    return (
      <div>
        {headerAction && (
          <div className="flex min-h-8 items-center gap-1.5 px-2.5 py-1.5 text-[0.75rem] font-semibold text-ink-500">
            <span className="flex items-center gap-1.5">
              {sections[0]?.icon}
              {sections[0]?.title}
            </span>
            <span className="ml-auto">{headerAction}</span>
          </div>
        )}
        <p className="px-3 py-5 text-center text-xs leading-5 text-ink-500">
          {emptyMessage}
        </p>
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-label="文档列表快捷操作"
      onKeyDown={(event) => {
        const row = (event.target as Element | null)?.closest<HTMLElement>(
          "[data-document-id]"
        );
        const documentId = row?.dataset.documentId;
        if (!documentId) return;
        const document = populated
          .flatMap((section) => section.documents)
          .find((item) => item.id === documentId);
        if (!document) return;
        const itemActions = actions(document);
        if (event.key === "F2") {
          const rename = itemActions.find(
            (action) => action.label === "重命名"
          );
          if (!rename) return;
          event.preventDefault();
          rename.onSelect();
        } else if (event.key === "Delete") {
          const remove = itemActions.find(
            (action) => action.label === "删除文档"
          );
          if (!remove) return;
          event.preventDefault();
          remove.onSelect();
        }
      }}
    >
      <Virtualizer
        layout={ListLayout}
        layoutOptions={{
          estimatedRowSize: 44,
          estimatedHeadingSize: 32,
          gap: 2
        }}
      >
        <GridList
          aria-label="文档列表"
          selectionMode="none"
          className="grid gap-0.5"
        >
          {populated.map((section) => (
            <GridListSection key={section.id} id={section.id} className="mb-4">
              <GridListHeader className="flex min-h-8 items-center gap-1.5 px-2.5 py-1.5 text-[0.75rem] font-semibold text-ink-500">
                <span className="flex items-center gap-1.5">
                  {section.icon}
                  {section.title}
                </span>
                {headerAction && (
                  <span className="ml-auto">{headerAction}</span>
                )}
              </GridListHeader>
              {section.documents.map((document) => (
                <DocumentGridItem
                  key={`${section.id}-${document.id}`}
                  itemId={`${section.id}-${document.id}`}
                  document={document}
                  active={document.id === activeDocumentId}
                  actions={actions(document)}
                  onClick={() => onOpen(document)}
                />
              ))}
            </GridListSection>
          ))}
        </GridList>
      </Virtualizer>
    </div>
  );
}

function KnowledgeSortMenu({
  value,
  onChange
}: {
  value: CloudDocumentSort;
  onChange: (sort: CloudDocumentSort) => void;
}) {
  const labels: Record<CloudDocumentSort, string> = {
    updated: "最近更新",
    created: "创建时间",
    title: "标题顺序"
  };
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="flex min-h-7 items-center gap-1 rounded-md px-1.5 text-[0.75rem] font-medium text-ink-500 outline-none transition hover:bg-surface-hover hover:text-ink-800"
          aria-label="知识库文档排序"
        >
          <ArrowUpDown size={12} />
          {labels[value]}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 w-40 rounded-xl border border-line-soft bg-white p-1.5 shadow-popover"
        >
          {(Object.keys(labels) as CloudDocumentSort[]).map((sort) => (
            <DropdownMenu.Item
              key={sort}
              className="flex min-h-9 cursor-default items-center gap-2 rounded-lg px-2.5 text-xs font-medium text-ink-700 outline-none data-[highlighted]:bg-surface-subtle"
              onSelect={() => onChange(sort)}
            >
              <span className="min-w-0 flex-1">{labels[sort]}</span>
              {value === sort && <Check size={13} />}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function DocumentGridItem({
  itemId,
  document,
  active,
  actions,
  onClick
}: {
  itemId: string;
  document: CloudDocumentSummary;
  active: boolean;
  actions: readonly DocumentRowAction[];
  onClick: () => void;
}) {
  return (
    <GridListItem
      id={itemId}
      textValue={document.title}
      data-document-id={document.id}
      data-document-title={document.title}
      aria-current={active ? "page" : undefined}
      allowsArrowNavigation
      focusMode="child"
      onPointerEnter={() => void preloadProductMarkdownEditor()}
      className={`group flex min-h-13 w-full items-center rounded-lg pr-1 outline-none transition data-[focus-visible]:ring-2 data-[focus-visible]:ring-brand-300 ${
        active
          ? "bg-surface-selected text-ink-950"
          : "text-ink-600 hover:bg-canvas hover:text-ink-900"
      }`}
    >
      <button
        type="button"
        className="flex min-h-13 min-w-0 flex-1 items-center gap-2.5 px-2.5 py-1.5 text-left"
        onClick={onClick}
      >
        <span
          className={`grid size-7 shrink-0 place-items-center rounded-md ${
            active
              ? "bg-brand-50 text-brand-700"
              : "bg-white text-ink-500 shadow-xs"
          }`}
        >
          <FileText size={14} />
        </span>
        <span className="min-w-0 flex-1">
          <strong
            className="block min-w-0 truncate text-xs font-semibold"
            title={document.title}
          >
            {document.title}
          </strong>
          <span className="mt-1 flex min-w-0 items-center gap-2 text-[0.68rem] font-medium text-ink-500">
            <time dateTime={document.updatedAt}>
              {formatDocumentTime(document.updatedAt)}
            </time>
            {document.tags.slice(0, 2).map((tag) => (
              <span key={tag} className="truncate">
                #{tag}
              </span>
            ))}
          </span>
        </span>
      </button>
      {actions.length > 0 && (
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              className="grid size-8 shrink-0 place-items-center rounded-md text-ink-500 opacity-100 transition hover:bg-white hover:text-ink-800 focus-visible:opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
              aria-label={`${document.title} 操作`}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            >
              <MoreHorizontal size={14} />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={6}
              className="z-50 w-44 rounded-xl border border-line-soft bg-white p-1.5 shadow-popover"
            >
              {actions.map((action) => (
                <DropdownMenu.Item
                  key={action.label}
                  className={`flex min-h-9 cursor-default items-center gap-2 rounded-lg px-2.5 text-xs font-medium outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-40 ${
                    action.danger
                      ? "text-danger-700 data-[highlighted]:bg-danger-50"
                      : "text-ink-700 data-[highlighted]:bg-surface-subtle"
                  }`}
                  disabled={action.disabled}
                  onSelect={action.onSelect}
                >
                  {action.icon}
                  {action.label}
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      )}
    </GridListItem>
  );
}

function formatDocumentTime(value: string) {
  const date = new Date(value);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  return new Intl.DateTimeFormat("zh-CN", {
    month: sameDay ? undefined : "2-digit",
    day: sameDay ? undefined : "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
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
      className="flex min-h-9 cursor-default items-center gap-2 rounded-lg px-2.5 text-xs font-medium text-ink-700 outline-none data-[highlighted]:bg-surface-subtle"
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
      <section className="w-full max-w-[36rem] text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-xl border border-line bg-paper text-ink-600 shadow-xs">
          {mode === "notes" ? <Sparkles size={20} /> : <BookOpen size={20} />}
        </span>
        <h1 className="mt-6 font-display text-2xl font-semibold tracking-[-0.025em] text-ink-950 sm:text-[1.9rem]">
          {mode === "notes"
            ? "从一个清晰的想法开始"
            : selectedKnowledgeBase
              ? selectedKnowledgeBase.name
              : "选择或创建一个知识库"}
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-ink-500">
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
  command,
  onCommandHandled,
  onFocusSearch,
  onSaved,
  defaultInfoOpen,
  readingScale
}: {
  document: DocumentSnapshot;
  userId: string;
  mode: WorkspaceMode;
  knowledgeBases: CloudKnowledgeBase[];
  command?: DocumentCommand;
  onCommandHandled: (requestId: number) => void;
  onFocusSearch: () => void;
  onSaved: (snapshot: DocumentSnapshot) => Promise<void>;
  defaultInfoOpen: boolean;
  readingScale: WorkspacePreferences["readingScale"];
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(mode === "notes");
  const [exporting, setExporting] = useState(false);
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [tagDraft, setTagDraft] = useState("");
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveKnowledgeBaseId, setArchiveKnowledgeBaseId] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameDraft, setRenameDraft] = useState(document.meta.title);
  const [documentActionPending, setDocumentActionPending] = useState(false);
  const [infoOpen, setInfoOpen] = useState(defaultInfoOpen);
  const [historyOpen, setHistoryOpen] = useState(false);
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const pendingReaderScrollRef = useRef<number | undefined>(undefined);
  const ownership = useEditorOwnership(
    userId ? `${userId}:${document.meta.workspaceId}:${document.meta.id}` : ""
  );
  const ownsEditor = ownership === "owned" || ownership === "unavailable";
  const editorActive =
    Boolean(userId) && ownsEditor && (mode === "notes" || editing);
  const autosave = useDocumentAutosave({
    document,
    userId,
    active: editorActive,
    onSaved: (saved) => onSaved(saved),
    onConflictCopy: () => {
      void queryClient.invalidateQueries({
        queryKey: ["notes", document.meta.workspaceId]
      });
    }
  });

  useEffect(() => {
    setEditing(mode === "notes");
  }, [document.meta.id, mode]);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    void cloudClient
      .markDocumentOpened(
        document.meta.workspaceId as WorkspaceId,
        document.meta.id
      )
      .then(async (opened) => {
        if (!active) return;
        queryClient.setQueryData(
          ["document", document.meta.workspaceId, document.meta.id],
          opened
        );
        await queryClient.invalidateQueries({
          queryKey: ["notes", document.meta.workspaceId, "recent"]
        });
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [document.meta.id, document.meta.workspaceId, queryClient, userId]);

  useEffect(() => {
    setInfoOpen(defaultInfoOpen);
  }, [defaultInfoOpen, document.meta.id]);

  useLayoutEffect(() => {
    scrollViewportRef.current?.scrollTo({ top: 0, left: 0 });
  }, [document.meta.id]);

  useLayoutEffect(() => {
    const pendingScrollTop = pendingReaderScrollRef.current;
    const scroller = scrollViewportRef.current;
    if (pendingScrollTop === undefined || !scroller) return;
    const targetScrollTop = Math.max(
      0,
      pendingScrollTop + (editing ? 48 : -48)
    );
    pendingReaderScrollRef.current = undefined;
    scroller.scrollTop = targetScrollTop;
    const firstFrame = window.requestAnimationFrame(() => {
      scroller.scrollTop = targetScrollTop;
    });
    const secondFrame = window.requestAnimationFrame(() => {
      scroller.scrollTop = targetScrollTop;
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
    };
  }, [editing]);

  useEffect(() => {
    if (!command || command.documentId !== document.meta.id) return;
    if (command.action === "rename") {
      setRenameDraft(autosave.title);
      setRenameOpen(true);
    } else if (command.action === "archive") {
      setArchiveKnowledgeBaseId(knowledgeBases[0]?.id ?? "");
      setArchiveOpen(true);
    } else {
      setDeleteOpen(true);
    }
  }, [command?.requestId, document.meta.id]);

  function completeDocumentCommand() {
    if (command) onCommandHandled(command.requestId);
  }

  function closeRenameDialog() {
    setRenameOpen(false);
    completeDocumentCommand();
  }

  function closeArchiveDialog() {
    setArchiveOpen(false);
    completeDocumentCommand();
  }

  function closeDeleteDialog() {
    setDeleteOpen(false);
    completeDocumentCommand();
  }

  function beginEditing() {
    pendingReaderScrollRef.current = scrollViewportRef.current?.scrollTop;
    setEditing(true);
  }

  async function finishEditing() {
    const saved = await autosave.flush(true);
    if (saved) {
      pendingReaderScrollRef.current = scrollViewportRef.current?.scrollTop;
      setEditing(false);
    }
  }

  useEffect(() => {
    if (mode !== "knowledge" || !ownsEditor) return;
    function toggleEditing(event: KeyboardEvent) {
      if (
        !(event.ctrlKey || event.metaKey) ||
        !event.shiftKey ||
        event.key.toLowerCase() !== "e"
      ) {
        return;
      }
      event.preventDefault();
      if (editing) {
        void finishEditing();
      } else {
        beginEditing();
      }
    }
    window.addEventListener("keydown", toggleEditing);
    return () => window.removeEventListener("keydown", toggleEditing);
  }, [autosave, editing, mode, ownsEditor]);

  async function exportCurrentDocument() {
    setExporting(true);
    try {
      await autosave.flush(true);
      await exportDocumentZip(document, autosave.markdown);
    } finally {
      setExporting(false);
    }
  }

  async function restoreHistoricalVersion(revision: CloudDocumentRevision) {
    if (!(await autosave.flush(true))) {
      throw new Error("当前修改尚未保存，已保留在本地草稿中。");
    }
    const adapter = cloudClient.workspace(
      document.meta.workspaceId as WorkspaceId
    );
    const latest = await adapter.readDocument(document.meta.id);
    const restored = await cloudClient.restoreRevision(
      document.meta.workspaceId as WorkspaceId,
      document.meta.id,
      revision.revisionId,
      latest.meta.revision
    );
    autosave.replaceDocument(restored);
    await onSaved(restored);
    queryClient.setQueryData(
      ["document", document.meta.workspaceId, document.meta.id],
      restored
    );
    await queryClient.invalidateQueries({
      queryKey: ["revisions", document.meta.workspaceId, document.meta.id]
    });
    showToast("历史版本已恢复为新的当前版本");
  }

  async function saveTags(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    autosave.changeTags(tagDraft.split(/[,，]/));
    setTagDialogOpen(false);
  }

  function renameCurrentDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    autosave.changeTitle(renameDraft);
    closeRenameDialog();
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
      const archived = await cloudClient.archiveDocument(
        document.meta.workspaceId as WorkspaceId,
        document.meta.id,
        {
          knowledgeBaseId: archiveKnowledgeBaseId,
          baseRevision: latest.meta.revision
        }
      );
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["notes", document.meta.workspaceId]
        }),
        queryClient.invalidateQueries({
          queryKey: ["knowledge-documents", document.meta.workspaceId]
        })
      ]);
      closeArchiveDialog();
      showToast("已归档到知识库", {
        duration: 6000,
        action: {
          label: "撤销",
          onClick: () => {
            void (async () => {
              try {
                await cloudClient.restoreDocumentToNotes(
                  document.meta.workspaceId as WorkspaceId,
                  document.meta.id,
                  archived.meta.revision
                );
                await Promise.all([
                  queryClient.invalidateQueries({
                    queryKey: ["notes", document.meta.workspaceId]
                  }),
                  queryClient.invalidateQueries({
                    queryKey: ["knowledge-documents", document.meta.workspaceId]
                  })
                ]);
                showToast("已撤销归档");
                navigate(
                  `/workspaces/${encodeURIComponent(
                    document.meta.workspaceId
                  )}/notes/${encodeURIComponent(document.meta.id)}`
                );
              } catch (error) {
                showToast(
                  error instanceof Error ? error.message : "撤销归档失败。"
                );
              }
            })();
          }
        }
      });
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
      const removeDeleted = (documents: CloudDocumentSummary[] | undefined) =>
        documents?.filter((item) => item.id !== document.meta.id);
      const removeDeletedFromCaches = () => {
        queryClient.setQueryData<CloudDocumentSummary[]>(
          ["notes", document.meta.workspaceId],
          removeDeleted
        );
        queryClient.setQueryData<CloudDocumentSummary[]>(
          ["notes", document.meta.workspaceId, "recent"],
          removeDeleted
        );
        if (document.meta.knowledgeBaseId) {
          queryClient.setQueryData<CloudDocumentSummary[]>(
            [
              "knowledge-documents",
              document.meta.workspaceId,
              document.meta.knowledgeBaseId
            ],
            removeDeleted
          );
        }
      };
      removeDeletedFromCaches();
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["notes", document.meta.workspaceId]
        }),
        queryClient.invalidateQueries({
          queryKey: ["knowledge-documents", document.meta.workspaceId]
        })
      ]);
      removeDeletedFromCaches();
      closeDeleteDialog();
      showToast("文档已移入回收站", {
        duration: 6000,
        action: {
          label: "撤销",
          onClick: () => {
            void (async () => {
              try {
                await cloudClient.restoreDeletedDocument(
                  document.meta.workspaceId as WorkspaceId,
                  document.meta.id,
                  latest.meta.revision + 1
                );
                await Promise.all([
                  queryClient.invalidateQueries({
                    queryKey: ["notes", document.meta.workspaceId]
                  }),
                  queryClient.invalidateQueries({
                    queryKey: ["trash", document.meta.workspaceId]
                  })
                ]);
                showToast("已恢复文档");
                navigate(
                  `/workspaces/${encodeURIComponent(
                    document.meta.workspaceId
                  )}/notes/${encodeURIComponent(document.meta.id)}`
                );
              } catch (error) {
                showToast(
                  error instanceof Error ? error.message : "恢复文档失败。"
                );
              }
            })();
          }
        }
      });
      navigate(
        `/workspaces/${encodeURIComponent(document.meta.workspaceId)}/${
          mode === "knowledge" && document.meta.knowledgeBaseId
            ? `knowledge/${encodeURIComponent(document.meta.knowledgeBaseId)}`
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
      showToast(
        error instanceof Error ? error.message : "移回随记失败，请重试。"
      );
    } finally {
      setDocumentActionPending(false);
    }
  }

  const showEditor = editorActive;

  return (
    <div className="relative flex h-full min-h-0 bg-canvas">
      <div
        ref={scrollViewportRef}
        className="document-reader-scroll min-w-0 flex-1 overflow-y-auto"
      >
        <article className="min-h-full w-full bg-paper">
          <header className="sticky top-0 z-20 flex min-h-12 items-center gap-2 border-b border-line-soft bg-paper/96 px-3 backdrop-blur-md sm:px-5">
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-sm font-semibold text-ink-900">
                {autosave.title}
              </h1>
              <p className="mt-0.5 truncate whitespace-nowrap text-[0.75rem] font-medium text-ink-500">
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
                      className="rounded-full bg-surface-subtle px-2 py-0.5 text-[0.75rem] font-medium text-ink-500 transition hover:bg-brand-50 hover:text-brand-800"
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
              aria-label={exporting ? "导出中" : "导出"}
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
                  className="z-50 w-48 rounded-xl border border-line-soft bg-white p-1.5 shadow-popover"
                >
                  <DropdownMenu.Item
                    className="flex min-h-9 cursor-default items-center gap-2 rounded-lg px-2.5 text-xs font-medium text-ink-700 outline-none data-[highlighted]:bg-surface-subtle"
                    onSelect={() => {
                      setRenameDraft(autosave.title);
                      setRenameOpen(true);
                    }}
                  >
                    <Pencil size={14} />
                    重命名文档
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    className="flex min-h-9 cursor-default items-center gap-2 rounded-lg px-2.5 text-xs font-medium text-ink-700 outline-none data-[highlighted]:bg-surface-subtle"
                    onSelect={() => setHistoryOpen(true)}
                  >
                    <History size={14} />
                    版本历史
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    className="flex min-h-9 cursor-default items-center gap-2 rounded-lg px-2.5 text-xs font-medium text-ink-700 outline-none data-[highlighted]:bg-surface-subtle"
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
                      className="flex min-h-9 cursor-default items-center gap-2 rounded-lg px-2.5 text-xs font-medium text-ink-700 outline-none data-[highlighted]:bg-surface-subtle data-[disabled]:opacity-40"
                      disabled={knowledgeBases.length === 0}
                      onSelect={() => {
                        setArchiveKnowledgeBaseId(knowledgeBases[0]?.id ?? "");
                        setArchiveOpen(true);
                      }}
                    >
                      <Archive size={14} />
                      归档到知识库
                    </DropdownMenu.Item>
                  )}
                  {mode === "knowledge" && (
                    <DropdownMenu.Item
                      className="flex min-h-9 cursor-default items-center gap-2 rounded-lg px-2.5 text-xs font-medium text-ink-700 outline-none data-[highlighted]:bg-surface-subtle"
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
            <IconButton
              aria-label={infoOpen ? "关闭文档信息" : "打开文档信息"}
              aria-pressed={infoOpen}
              className={infoOpen ? "bg-brand-50 text-brand-800" : ""}
              onClick={() => setInfoOpen((current) => !current)}
            >
              <PanelRight size={16} />
            </IconButton>
            {mode === "knowledge" && !editing && ownsEditor && (
              <Button variant="secondary" size="sm" onClick={beginEditing}>
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
                      )}/notes/${encodeURIComponent(autosave.conflictCopy!.id)}`
                    )
                  }
                >
                  打开本地副本
                </Button>
              }
            />
          )}
          <Suspense fallback={<DocumentSkeleton />}>
            <ProductMarkdownEditor
              value={autosave.markdown}
              title={autosave.title}
              documentId={document.meta.id}
              workspaceId={document.meta.workspaceId}
              readOnly={!showEditor}
              readingScale={readingScale}
              legacyCanvas={
                document.extensions?.canvas as unknown as
                  CanvasScene | undefined
              }
              onChange={autosave.changeMarkdown}
              onFocusSearch={onFocusSearch}
            />
          </Suspense>
        </article>
      </div>
      <DocumentContextPanel
        open={infoOpen}
        document={document}
        workspaceId={document.meta.workspaceId}
        markdown={autosave.markdown}
        onClose={() => setInfoOpen(false)}
        onOpenHistory={() => setHistoryOpen(true)}
        onNavigate={(link) => {
          navigate(
            link.lifecycle === "knowledge" && link.knowledgeBaseId
              ? `/workspaces/${encodeURIComponent(
                  document.meta.workspaceId
                )}/knowledge/${encodeURIComponent(
                  link.knowledgeBaseId
                )}/${encodeURIComponent(link.documentId)}`
              : `/workspaces/${encodeURIComponent(
                  document.meta.workspaceId
                )}/notes/${encodeURIComponent(link.documentId)}`
          );
        }}
      />
      <RevisionHistoryDrawer
        open={historyOpen}
        document={document}
        workspaceId={document.meta.workspaceId}
        currentMarkdown={autosave.markdown}
        onClose={() => setHistoryOpen(false)}
        onRestore={restoreHistoricalVersion}
      />
      <AppDialog
        open={renameOpen}
        title="重命名文档"
        description="标题会与正文、标签一起进入自动保存队列。"
        onClose={closeRenameDialog}
        footer={
          <>
            <Button variant="secondary" onClick={closeRenameDialog}>
              取消
            </Button>
            <Button variant="primary" type="submit" form="document-rename-form">
              保存名称
            </Button>
          </>
        }
      >
        <form
          id="document-rename-form"
          className="grid gap-3"
          onSubmit={renameCurrentDocument}
        >
          <FieldLabel>
            文档名称
            <TextInput
              autoFocus
              maxLength={120}
              value={renameDraft}
              onChange={(event) => setRenameDraft(event.target.value)}
              placeholder="未命名文档"
            />
          </FieldLabel>
        </form>
      </AppDialog>

      <AppDialog
        open={tagDialogOpen}
        title="管理标签"
        description="标签会随文档一起自动保存，并可用于随记筛选。"
        onClose={() => setTagDialogOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setTagDialogOpen(false)}>
              取消
            </Button>
            <Button variant="primary" type="submit" form="document-tags-form">
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
        onClose={closeArchiveDialog}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={closeArchiveDialog}
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
                  : "border-line-soft text-ink-600 hover:border-line hover:bg-paper-warm"
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
        title="移入回收站"
        description={`“${autosave.title}”会从当前列表移入回收站，之后仍可恢复。`}
        onClose={closeDeleteDialog}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={closeDeleteDialog}
              disabled={documentActionPending}
            >
              取消
            </Button>
            <Button
              variant="danger"
              onClick={() => void deleteCurrentDocument()}
              disabled={documentActionPending}
            >
              {documentActionPending ? "正在移入…" : "移入回收站"}
            </Button>
          </>
        }
      >
        <p className="rounded-xl bg-danger-50 px-3 py-2 text-xs leading-5 text-danger-700">
          移入回收站前会先确认当前内容已保存；如果保存失败，文档不会移动。
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
  const compactLabel =
    status === "saving"
      ? "保存中"
      : status === "draft"
        ? "待保存"
        : status === "offline"
          ? "本机"
          : status === "error"
            ? "失败"
            : status === "conflict"
              ? "冲突"
              : "已保存";
  return (
    <span
      className={`mr-1 flex min-h-8 items-center gap-1.5 rounded-lg px-2 text-[0.75rem] font-semibold ${
        status === "error" || status === "conflict"
          ? "text-danger-700"
          : status === "offline"
            ? "text-sun-700"
            : "text-ink-400"
      }`}
      role="status"
      aria-label={label}
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
      <span className="sm:hidden">{compactLabel}</span>
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
              className={
                index % 4 === 3
                  ? "h-4 w-3/5 rounded-md"
                  : "h-4 w-full rounded-md"
              }
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
    <main className="grid min-h-dvh place-items-center bg-paper-warm px-5 text-center">
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
