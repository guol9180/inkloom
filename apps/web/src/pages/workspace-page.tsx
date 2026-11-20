import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
  type RefObject
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Cloud,
  Download,
  FolderInput,
  FolderOpen,
  FolderPlus,
  HardDrive,
  LogOut,
  Menu,
  MoreHorizontal,
  PanelRightClose,
  Pencil,
  Plus,
  Tag,
  Trash2,
  Upload,
  X
} from "lucide-react";
import { useNavigate, useParams } from "react-router";
import type {
  CloudDocumentRevision,
  CloudWorkspace
} from "@inkloom/storage";
import type { CanvasScene } from "@inkloom/diagrams";
import type { MarkdownHeading } from "@inkloom/editor";
import { CanvasEditor } from "@inkloom/diagrams";
import { BrandLockup, BrandMark } from "../components/brand-mark";
import { AppDialog } from "../components/ui/app-dialog";
import { Button, IconButton } from "../components/ui/button";
import { FieldLabel, TextInput } from "../components/ui/field";
import { cloudClient } from "../cloud-workspace";
import { folderHierarchy } from "../features/workspace/note-utils";
import { DocumentEditor } from "../features/workspace/document-editor";
import { DocumentInspector } from "../features/workspace/document-inspector";
import { DocumentSidebar } from "../features/workspace/document-sidebar";
import { useWorkspaceController } from "../features/workspace/use-workspace-controller";
import { workspacesQuery } from "../queries";
import { useToastStore } from "../stores/toast-store";
import type { Note } from "../data";

type DialogKind =
  | "workspace"
  | "workspace-create"
  | "workspace-rename"
  | "settings"
  | "title"
  | "move"
  | "tags"
  | "delete"
  | "restore"
  | "logout"
  | null;

export function WorkspacePage() {
  const { workspaceId = "", documentId } = useParams();
  const navigate = useNavigate();
  const client = useQueryClient();
  const showToast = useToastStore((state) => state.show);
  const workspaces = useQuery(workspacesQuery);
  const workspace = workspaces.data?.workspaces.find(
    (item) => item.id === workspaceId
  );
  const [query, setQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [outline, setOutline] = useState<MarkdownHeading[]>([]);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [dialogBusy, setDialogBusy] = useState(false);
  const [dialogError, setDialogError] = useState("");
  const [workspaceNameDraft, setWorkspaceNameDraft] = useState("");
  const [titleDraft, setTitleDraft] = useState("");
  const [movePathDraft, setMovePathDraft] = useState("");
  const [tagDraft, setTagDraft] = useState("");
  const [pendingRestore, setPendingRestore] =
    useState<CloudDocumentRevision>();
  const [canvasOpen, setCanvasOpen] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1241px)");
    const sync = () => setInspectorOpen(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        if (target?.closest(".cm-editor")) return;
        event.preventDefault();
        setSidebarOpen(true);
        window.setTimeout(() => searchRef.current?.focus(), 30);
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  if (workspaces.isPending) return <PageLoading message="正在读取工作区…" />;
  if (workspaces.isError) {
    return (
      <PageError
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
    return <PageError title="找不到这个工作区" message="它可能已经被删除。" onRetry={() => navigate("/")} />;
  }

  return (
    <WorkspaceSurface
      key={workspace.id}
      workspace={workspace}
      workspaces={workspaces.data?.workspaces ?? []}
      workspaceId={workspaceId}
      documentId={documentId}
      query={query}
      setQuery={setQuery}
      sidebarOpen={sidebarOpen}
      setSidebarOpen={setSidebarOpen}
      inspectorOpen={inspectorOpen}
      setInspectorOpen={setInspectorOpen}
      outline={outline}
      setOutline={setOutline}
      dialog={dialog}
      setDialog={setDialog}
      dialogBusy={dialogBusy}
      setDialogBusy={setDialogBusy}
      dialogError={dialogError}
      setDialogError={setDialogError}
      workspaceNameDraft={workspaceNameDraft}
      setWorkspaceNameDraft={setWorkspaceNameDraft}
      titleDraft={titleDraft}
      setTitleDraft={setTitleDraft}
      movePathDraft={movePathDraft}
      setMovePathDraft={setMovePathDraft}
      tagDraft={tagDraft}
      setTagDraft={setTagDraft}
      pendingRestore={pendingRestore}
      setPendingRestore={setPendingRestore}
      canvasOpen={canvasOpen}
      setCanvasOpen={setCanvasOpen}
      importRef={importRef}
      searchRef={searchRef}
      showToast={showToast}
      navigate={navigate}
      client={client}
    />
  );
}

function WorkspaceSurface({
  workspace,
  workspaces,
  workspaceId,
  documentId,
  query,
  setQuery,
  sidebarOpen,
  setSidebarOpen,
  inspectorOpen,
  setInspectorOpen,
  outline,
  setOutline,
  dialog,
  setDialog,
  dialogBusy,
  setDialogBusy,
  dialogError,
  setDialogError,
  workspaceNameDraft,
  setWorkspaceNameDraft,
  titleDraft,
  setTitleDraft,
  movePathDraft,
  setMovePathDraft,
  tagDraft,
  setTagDraft,
  pendingRestore,
  setPendingRestore,
  canvasOpen,
  setCanvasOpen,
  importRef,
  searchRef,
  showToast,
  navigate,
  client
}: {
  workspace: CloudWorkspace;
  workspaces: CloudWorkspace[];
  workspaceId: string;
  documentId?: string;
  query: string;
  setQuery: (value: string) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (value: boolean) => void;
  inspectorOpen: boolean;
  setInspectorOpen: (value: boolean) => void;
  outline: MarkdownHeading[];
  setOutline: (value: MarkdownHeading[]) => void;
  dialog: DialogKind;
  setDialog: (value: DialogKind) => void;
  dialogBusy: boolean;
  setDialogBusy: (value: boolean) => void;
  dialogError: string;
  setDialogError: (value: string) => void;
  workspaceNameDraft: string;
  setWorkspaceNameDraft: (value: string) => void;
  titleDraft: string;
  setTitleDraft: (value: string) => void;
  movePathDraft: string;
  setMovePathDraft: (value: string) => void;
  tagDraft: string;
  setTagDraft: (value: string) => void;
  pendingRestore?: CloudDocumentRevision;
  setPendingRestore: (value: CloudDocumentRevision | undefined) => void;
  canvasOpen: boolean;
  setCanvasOpen: (value: boolean) => void;
  importRef: RefObject<HTMLInputElement | null>;
  searchRef: RefObject<HTMLInputElement | null>;
  showToast: (message: string) => void;
  navigate: ReturnType<typeof useNavigate>;
  client: ReturnType<typeof useQueryClient>;
}) {
  const selectDocument = (id: string) => {
    navigate(`/workspaces/${encodeURIComponent(workspaceId)}/documents/${encodeURIComponent(id)}`);
    setSidebarOpen(false);
  };
  const controller = useWorkspaceController({
    workspace,
    documentId,
    selectDocument
  });
  const {
    notes,
    activeNote,
    revisions,
    workspaceQuery,
    saveState,
    saveError,
    expandedFolders,
    setExpandedFolders
  } = controller;

  useEffect(() => {
    if (!activeNote) return;
    if (documentId !== activeNote.id) {
      navigate(
        `/workspaces/${encodeURIComponent(workspaceId)}/documents/${encodeURIComponent(activeNote.id)}`,
        { replace: true }
      );
    }
  }, [activeNote?.id, documentId, navigate, workspaceId]);

  useEffect(() => {
    const handleSaveShortcut = (event: KeyboardEvent) => {
      if (
        !(event.ctrlKey || event.metaKey) ||
        event.key.toLowerCase() !== "s"
      ) {
        return;
      }
      event.preventDefault();
      void controller.saveNow().then(() => showToast("当前文档已保存"));
    };
    window.addEventListener("keydown", handleSaveShortcut);
    return () => window.removeEventListener("keydown", handleSaveShortcut);
  }, [activeNote?.id, controller, showToast]);

  if (workspaceQuery.isPending || !activeNote) {
    return <PageLoading message="正在展开文档…" />;
  }
  if (workspaceQuery.isError) {
    return (
      <PageError
        title="文档暂时无法打开"
        message={
          workspaceQuery.error instanceof Error
            ? workspaceQuery.error.message
            : "请稍后重试。"
        }
        onRetry={() => void workspaceQuery.refetch()}
      />
    );
  }

  function closeDialog() {
    if (dialogBusy) return;
    setDialog(null);
    setDialogError("");
    setPendingRestore(undefined);
  }

  function openWorkspaceDialog() {
    setDialogError("");
    setDialog("workspace");
  }

  function toggleInspector() {
    setSidebarOpen(false);
    setInspectorOpen(!inspectorOpen);
  }

  async function switchWorkspace(next: CloudWorkspace) {
    if (next.id === workspace.id) {
      setDialog(null);
      return;
    }
    setDialogBusy(true);
    setDialogError("");
    try {
      await controller.saveNow();
      navigate(`/workspaces/${encodeURIComponent(next.id)}`);
      setDialog(null);
      setSidebarOpen(false);
      showToast(`已切换到“${next.name}”`);
    } catch (error) {
      setDialogError(error instanceof Error ? error.message : "切换工作区失败。");
    } finally {
      setDialogBusy(false);
    }
  }

  async function createWorkspace() {
    const name = workspaceNameDraft.trim();
    if (!name) {
      setDialogError("请输入新工作区名称。");
      return;
    }
    setDialogBusy(true);
    setDialogError("");
    try {
      const created = await cloudClient.createWorkspace(name);
      client.setQueryData<WorkspaceSession>(workspacesQuery.queryKey, (current) => {
        if (!current) return current;
        return {
          workspaces: [...current.workspaces, created],
          activeWorkspace: created
        };
      });
      await controller.saveNow();
      navigate(`/workspaces/${encodeURIComponent(created.id)}`);
      setDialog(null);
      showToast(`已创建“${created.name}”`);
    } catch (error) {
      setDialogError(error instanceof Error ? error.message : "创建工作区失败。");
    } finally {
      setDialogBusy(false);
    }
  }

  async function renameWorkspace() {
    const name = workspaceNameDraft.trim();
    if (!name) {
      setDialogError("工作区名称不能为空。");
      return;
    }
    setDialogBusy(true);
    setDialogError("");
    try {
      const renamed = await cloudClient.renameWorkspace(
        workspace.id as never,
        name
      );
      client.setQueryData<WorkspaceSession>(workspacesQuery.queryKey, (current) => {
        if (!current) return current;
        return {
          workspaces: current.workspaces.map((item) =>
            item.id === renamed.id ? renamed : item
          ),
          activeWorkspace:
            current.activeWorkspace.id === renamed.id
              ? renamed
              : current.activeWorkspace
        };
      });
      setDialog("workspace");
      showToast("工作区名称已更新");
    } catch (error) {
      setDialogError(error instanceof Error ? error.message : "重命名失败。");
    } finally {
      setDialogBusy(false);
    }
  }

  async function createNote(folder?: string) {
    try {
      await controller.createNote(folder ?? activeNote.folder);
      window.setTimeout(() => {
        const title = document.querySelector<HTMLInputElement>(".document-title");
        title?.focus();
        title?.select();
      }, 30);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "新建文档失败。");
    }
  }

  async function importMarkdown(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const note = await controller.importOneMarkdown(
        file.name,
        await file.text(),
        "个人",
        ["导入"]
      );
      selectDocument(note.id);
      showToast("Markdown 已保存到云端");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Markdown 导入失败。");
    }
  }

  async function importFolder() {
    const picker = (
      window as unknown as {
        showDirectoryPicker?: (options?: unknown) => Promise<DirectoryHandle>;
      }
    ).showDirectoryPicker;
    if (!picker) {
      showToast("当前浏览器不支持目录读取，请使用导入 Markdown");
      return;
    }
    try {
      const directory = await picker({ mode: "read" });
      const files: Array<{ name: string; text: string; folder: string }> = [];
      const scan = async (handle: DirectoryHandle, prefix = "") => {
        for await (const [name, entry] of handle.entries()) {
          if (name.startsWith(".") || files.length >= 200) continue;
          if (entry.kind === "file" && /\.md$/i.test(name)) {
            const file = await entry.getFile();
            files.push({
              name,
              text: await file.text(),
              folder: prefix.replace(/\/$/, "") || "个人"
            });
          } else if (
            entry.kind === "directory" &&
            prefix.split("/").length < 8
          ) {
            await scan(entry, `${prefix}${name}/`);
          }
        }
      };
      await scan(directory);
      if (files.length === 0) {
        showToast("文件夹里没有找到 Markdown");
        return;
      }
      const imported: Note[] = [];
      for (const file of files) {
        imported.push(
          await controller.importOneMarkdown(file.name, file.text, file.folder, [
            "文件夹导入"
          ])
        );
      }
      setExpandedFolders(
        new Set([
          ...expandedFolders,
          ...imported.flatMap((note) => folderHierarchy(note.folder))
        ])
      );
      selectDocument(imported[0].id);
      showToast(`已导入 ${imported.length} 篇 Markdown`);
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        showToast("目录读取失败");
      }
    }
  }

  function exportMarkdown() {
    const content = controller.getActiveContent();
    const body = content.trimStart().startsWith("#")
      ? content
      : `# ${activeNote.title}\n\n${content}`;
    const blob = new Blob([body], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${activeNote.title.replace(/[\\/:*?"<>|]/g, "-")}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
    showToast("Markdown 已导出");
  }

  function updateTitle(title: string) {
    controller.updateTitle(title);
  }

  function addTag() {
    const tag = tagDraft.trim();
    if (!tag) return;
    if (activeNote.tags.includes(tag)) {
      setDialogError("这个标签已经添加过了。");
      return;
    }
    if (activeNote.tags.length >= 30) {
      setDialogError("每篇文档最多添加 30 个标签。");
      return;
    }
    controller.updateActiveNote({ tags: [...activeNote.tags, tag] });
    setTagDraft("");
    setDialogError("");
  }

  function removeTag(tag: string) {
    controller.updateActiveNote({
      tags: activeNote.tags.filter((item) => item !== tag)
    });
  }

  async function moveDocument() {
    const path = movePathDraft.trim();
    if (!path || path === activeNote.filePath) {
      setDialog(null);
      return;
    }
    setDialogBusy(true);
    setDialogError("");
    try {
      await controller.moveActiveNote(path);
      setDialog(null);
      showToast("文档路径已更新");
    } catch (error) {
      setDialogError(error instanceof Error ? error.message : "移动文档失败。");
    } finally {
      setDialogBusy(false);
    }
  }

  async function restoreVersion() {
    if (!pendingRestore) return;
    setDialogBusy(true);
    setDialogError("");
    try {
      await controller.restoreVersion(pendingRestore);
      setDialog(null);
      setPendingRestore(undefined);
      showToast("历史版本已恢复并保存为新 revision");
    } catch (error) {
      setDialogError(error instanceof Error ? error.message : "恢复历史版本失败。");
    } finally {
      setDialogBusy(false);
    }
  }

  async function deleteDocument() {
    setDialogBusy(true);
    setDialogError("");
    try {
      await controller.deleteActiveNote();
      setDialog(null);
      showToast("文档已删除");
    } catch (error) {
      setDialogError(error instanceof Error ? error.message : "删除失败。");
    } finally {
      setDialogBusy(false);
    }
  }

  async function logout() {
    setDialogBusy(true);
    setDialogError("");
    try {
      await cloudClient.logout();
      window.location.assign("/login");
    } catch (error) {
      setDialogError(error instanceof Error ? error.message : "退出失败。");
    } finally {
      setDialogBusy(false);
    }
  }

  function saveCanvas(canvas: CanvasScene | readonly Record<string, unknown>[]) {
    const scene: CanvasScene = Array.isArray(canvas)
      ? {
          title: activeNote.canvas?.title ?? "自由画布",
          elements: canvas
        }
      : (canvas as CanvasScene);
    controller.saveCanvas(scene);
    setCanvasOpen(false);
    showToast("画布场景已保存");
  }

  return (
    <div className="app-shell flex h-dvh min-h-0 flex-col overflow-hidden bg-canvas text-ink-900">
      <header className="topbar z-30 flex min-h-[4.65rem] shrink-0 items-center border-b border-line bg-paper/94 px-3 backdrop-blur-xl sm:px-4">
        <div className="brand-block flex min-w-0 items-center gap-2">
          <IconButton
            className="lg:hidden"
            aria-label="打开文件栏"
            onClick={() => {
              setSidebarOpen(true);
              setInspectorOpen(false);
            }}
          >
            <Menu size={18} />
          </IconButton>
          <BrandLockup />
        </div>
        <div className="workspace-switcher ml-4 hidden min-w-0 items-center gap-2 border-l border-line pl-4 sm:flex md:ml-7 md:pl-7">
          <span className="workspace-kicker text-[0.6rem] font-bold tracking-[0.12em] text-ink-400 uppercase">
            工作区
          </span>
          <button
            className="workspace-title flex max-w-[21rem] items-center gap-1.5 truncate text-sm font-semibold text-ink-900 hover:text-brand-700"
            type="button"
            aria-label="切换工作区"
            onClick={openWorkspaceDialog}
          >
            <span className="truncate">{workspace.name}</span>
            <ChevronDown size={14} className="shrink-0 text-ink-400" />
          </button>
        </div>
        <div className="topbar-actions ml-auto flex items-center gap-1 sm:gap-1.5">
          <span className="sync-state mr-1 hidden min-h-9 items-center gap-2 rounded-full bg-canvas px-3 text-[0.68rem] font-semibold text-ink-500 xl:flex">
            <span
              className={`size-1.5 rounded-full ${
                saveState === "error" || saveState === "conflict"
                  ? "bg-danger-500"
                  : saveState === "saving"
                    ? "bg-sun-500"
                    : "bg-brand-500"
              }`}
            />
            {saveState === "error"
              ? "连接异常"
              : saveState === "conflict"
                ? "存在冲突"
                : "云端已连接"}
          </span>
          <Button
            variant="quiet"
            size="sm"
            className="hidden xl:inline-flex"
            aria-label="导入文件夹"
            onClick={() => void importFolder()}
          >
            <FolderOpen size={15} /> 文件夹
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="hidden sm:inline-flex"
            aria-label="导入 Markdown"
            onClick={() => importRef.current?.click()}
          >
            <Upload size={15} />
            <span className="hidden md:inline">导入</span>
          </Button>
          <Button variant="primary" size="sm" onClick={exportMarkdown}>
            <Download size={15} />
            <span className="hidden md:inline">导出</span>
          </Button>
          <button
            className="ml-0.5 grid size-9 place-items-center rounded-full bg-brand-900 text-xs font-bold text-white ring-2 ring-white shadow-sm focus-visible:ring-4 focus-visible:ring-brand-300"
            type="button"
            aria-label="账号设置"
            title="账号设置"
            onClick={() => {
              setDialogError("");
              setDialog("settings");
            }}
          >
            {workspace.name.slice(0, 1)}
          </button>
        </div>
        <input
          ref={importRef}
          className="visually-hidden"
          type="file"
          accept=".md,.markdown,text/markdown,text/plain"
          onChange={(event) => void importMarkdown(event)}
        />
      </header>

      <div
        className={`main-grid relative flex min-h-0 flex-1 ${
          inspectorOpen ? "" : "is-inspector-collapsed"
        }`}
      >
        <DocumentSidebar
          workspace={workspace}
          open={sidebarOpen}
          notes={notes}
          activeId={activeNote.id}
          query={query}
          onQuery={setQuery}
          expandedFolders={expandedFolders}
          onToggleFolder={(folder) =>
            setExpandedFolders((current) => {
              const next = new Set(current);
              if (next.has(folder)) next.delete(folder);
              else next.add(folder);
              return next;
            })
          }
          onSelect={controller.selectNote}
          onCreate={(folder) => void createNote(folder)}
          onOpenWorkspace={openWorkspaceDialog}
          onOpenInspector={() => {
            setInspectorOpen(true);
            setSidebarOpen(false);
          }}
          onOpenSettings={() => {
            setDialog("settings");
            setSidebarOpen(false);
          }}
          onClose={() => setSidebarOpen(false)}
          searchRef={searchRef}
        />

        {sidebarOpen && (
          <button
            className="drawer-scrim is-sidebar absolute inset-0 z-30 bg-ink-950/25 backdrop-blur-[2px] lg:hidden"
            type="button"
            aria-label="关闭文件栏"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <main className="editor-column flex min-w-0 flex-1 flex-col">
          <div className="document-topline flex min-h-[3.15rem] shrink-0 flex-wrap items-center gap-2 border-b border-line bg-paper/76 px-3 backdrop-blur-md sm:px-4">
            <div className="breadcrumbs flex min-w-0 flex-1 items-center gap-1.5 text-[0.69rem] font-medium text-ink-400">
              <span className="hidden max-w-32 truncate sm:block">{workspace.name}</span>
              <ChevronRight size={11} className="hidden shrink-0 sm:block" />
              <span className="max-w-28 truncate">{activeNote.folder}</span>
              <ChevronRight size={11} className="shrink-0" />
              <strong className="truncate font-semibold text-ink-700">{activeNote.title}</strong>
            </div>
            <div className="document-actions flex items-center gap-1">
              <div className="save-indicator mr-1 hidden min-h-8 items-center gap-1.5 rounded-lg px-2 text-[0.68rem] font-semibold text-ink-400 md:flex" aria-live="polite">
                {saveState === "saving" || saveState === "loading" ? (
                  <>
                    <span className="size-1.5 animate-pulse rounded-full bg-sun-500" />
                    保存中
                  </>
                ) : saveState === "error" || saveState === "conflict" ? (
                  <button
                    className="flex items-center gap-1.5 text-danger-700"
                    type="button"
                    title={saveError}
                    onClick={controller.retrySave}
                  >
                    <span className="size-1.5 rounded-full bg-danger-500" />
                    {saveState === "conflict" ? "冲突已隔离" : "保存失败"}
                  </button>
                ) : (
                  <>
                    <Check size={13} className="text-brand-600" />
                    已保存到云端
                  </>
                )}
              </div>
              <IconButton aria-label="切换信息栏" title="切换信息栏" onClick={toggleInspector}>
                <PanelRightClose size={17} />
              </IconButton>
              <IconButton
                aria-label="移动或重命名文档路径"
                title="移动或重命名文档路径"
                className="hidden sm:grid"
                onClick={() => {
                  setMovePathDraft(activeNote.filePath);
                  setDialog("move");
                }}
              >
                <FolderInput size={17} />
              </IconButton>
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <IconButton
                    aria-label="更多操作"
                    className="data-[state=open]:bg-brand-100 data-[state=open]:text-brand-800"
                  >
                    <MoreHorizontal size={18} />
                  </IconButton>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    align="end"
                    sideOffset={7}
                    className="document-menu-popover z-50 min-w-[13rem] rounded-xl border border-line bg-paper p-1.5 text-sm shadow-[0_18px_45px_rgb(27_55_43_/_0.18)]"
                  >
                    <MenuAction icon={<Pencil size={15} />} onSelect={() => {
                      setTitleDraft(activeNote.title);
                      setDialog("title");
                    }}>
                      重命名标题
                    </MenuAction>
                    <MenuAction icon={<FolderInput size={15} />} onSelect={() => {
                      setMovePathDraft(activeNote.filePath);
                      setDialog("move");
                    }}>
                      移动或重命名路径
                    </MenuAction>
                    <MenuAction icon={<Tag size={15} />} onSelect={() => {
                      setTagDraft("");
                      setDialog("tags");
                    }}>
                      管理标签
                    </MenuAction>
                    <MenuAction icon={<Download size={15} />} onSelect={exportMarkdown}>
                      导出 Markdown
                    </MenuAction>
                    <MenuAction icon={<Upload size={15} />} onSelect={() => importRef.current?.click()}>
                      导入 Markdown
                    </MenuAction>
                    <MenuAction icon={<FolderOpen size={15} />} onSelect={() => void importFolder()}>
                      导入文件夹
                    </MenuAction>
                    <DropdownMenu.Separator className="my-1 h-px bg-line-soft" />
                    <MenuAction danger icon={<Trash2 size={15} />} onSelect={() => {
                      setDialogError("");
                      setDialog("delete");
                    }}>
                      删除文档
                    </MenuAction>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            </div>
          </div>

          <DocumentEditor
            key={activeNote.id}
            note={activeNote}
            onContentChange={(content) => controller.stageContent(activeNote.id, content)}
            onManageTags={() => {
              setTagDraft("");
              setDialogError("");
              setDialog("tags");
            }}
            onOpenCanvas={() => setCanvasOpen(true)}
            onCanvasChange={(canvas) => controller.updateActiveNote({ canvas })}
            onOutline={setOutline}
          />
        </main>

        {inspectorOpen && (
          <button
            className="drawer-scrim is-inspector absolute inset-0 z-30 bg-ink-950/25 backdrop-blur-[2px] lg:hidden"
            type="button"
            aria-label="关闭信息栏"
            onClick={() => setInspectorOpen(false)}
          />
        )}
        <DocumentInspector
          open={inspectorOpen}
          note={activeNote}
          notes={notes}
          outline={outline}
          revisions={revisions}
          onClose={() => setInspectorOpen(false)}
          onSelect={controller.selectNote}
          onOpenCanvas={() => setCanvasOpen(true)}
          onRestore={(revision) => {
            setPendingRestore(revision);
            setDialogError("");
            setDialog("restore");
          }}
        />
      </div>

      {canvasOpen && (
        <CanvasEditor
          scene={activeNote.canvas}
          title={activeNote.canvas?.title ?? "自由画布"}
          onCancel={() => setCanvasOpen(false)}
          onSave={async (result) => {
            const parsed = JSON.parse(result.sceneJson) as {
              elements?: readonly Record<string, unknown>[];
            };
            saveCanvas({
              title: activeNote.canvas?.title ?? "自由画布",
              elements: parsed.elements ?? []
            });
            setCanvasOpen(false);
          }}
        />
      )}

      <AppDialog
        open={dialog === "workspace"}
        title="工作区"
        description="每个工作区拥有独立的云端文档，切换前会先保存当前修改。"
        onClose={closeDialog}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setWorkspaceNameDraft(workspace.name);
                setDialog("workspace-rename");
              }}
            >
              <Pencil size={15} /> 重命名当前工作区
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setWorkspaceNameDraft("");
                setDialogError("");
                setDialog("workspace-create");
              }}
            >
              <FolderPlus size={15} /> 新建工作区
            </Button>
          </>
        }
      >
        {dialogError && <DialogError message={dialogError} />}
        <div className="workspace-list grid gap-2">
          {workspaces.map((item) => (
            <button
              type="button"
              key={item.id}
              className={`flex min-h-16 items-center gap-3 rounded-xl border p-3 text-left transition ${
                item.id === workspace.id
                  ? "border-brand-300 bg-brand-50"
                  : "border-line bg-white hover:border-brand-300 hover:bg-brand-50/50"
              }`}
              aria-pressed={item.id === workspace.id}
              disabled={dialogBusy}
              onClick={() => void switchWorkspace(item)}
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-100 text-brand-700">
                <Cloud size={17} />
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block truncate text-sm font-semibold text-ink-900">
                  {item.name}
                </strong>
                <small className="mt-1 block text-xs text-ink-400">
                  {item.id === workspace.id ? "当前工作区" : "切换到此工作区"}
                </small>
              </span>
              {item.id === workspace.id && <Check size={17} className="text-brand-600" />}
            </button>
          ))}
        </div>
      </AppDialog>

      <AppDialog
        open={dialog === "workspace-create"}
        title="新建工作区"
        description="适合按项目、主题或客户隔离文档。"
        onClose={closeDialog}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog("workspace")} disabled={dialogBusy}>
              返回
            </Button>
            <Button variant="primary" type="submit" form="workspace-create-form" disabled={dialogBusy}>
              {dialogBusy ? "正在创建…" : "创建并切换"}
            </Button>
          </>
        }
      >
        <form id="workspace-create-form" className="grid gap-4" onSubmit={(event) => {
          event.preventDefault();
          void createWorkspace();
        }}>
          <FieldLabel>
            工作区名称
            <TextInput
              value={workspaceNameDraft}
              onChange={(event) => setWorkspaceNameDraft(event.target.value)}
              maxLength={80}
              placeholder="例如：客户项目"
              autoFocus
            />
          </FieldLabel>
          {dialogError && <DialogError message={dialogError} />}
        </form>
      </AppDialog>

      <AppDialog
        open={dialog === "workspace-rename"}
        title="重命名工作区"
        onClose={closeDialog}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog("workspace")} disabled={dialogBusy}>
              取消
            </Button>
            <Button variant="primary" type="submit" form="workspace-rename-form" disabled={dialogBusy}>
              {dialogBusy ? "正在保存…" : "保存名称"}
            </Button>
          </>
        }
      >
        <form id="workspace-rename-form" className="grid gap-4" onSubmit={(event) => {
          event.preventDefault();
          void renameWorkspace();
        }}>
          <FieldLabel>
            工作区名称
            <TextInput
              value={workspaceNameDraft}
              onChange={(event) => setWorkspaceNameDraft(event.target.value)}
              maxLength={80}
              autoFocus
            />
          </FieldLabel>
          {dialogError && <DialogError message={dialogError} />}
        </form>
      </AppDialog>

      <AppDialog
        open={dialog === "settings"}
        title="账号与工作区"
        description="当前账号的云端存储和会话信息。"
        onClose={closeDialog}
        footer={
          <>
            <Button variant="danger-quiet" onClick={() => setDialog("logout")}>
              <LogOut size={15} /> 退出登录
            </Button>
            <Button variant="primary" onClick={closeDialog}>
              完成
            </Button>
          </>
        }
      >
        <div className="settings-profile flex items-center gap-3 rounded-xl bg-canvas p-3">
          <span className="settings-avatar grid size-11 place-items-center rounded-full bg-brand-900 text-sm font-bold text-white">
            <BrandMark className="size-9 border-0 bg-transparent text-white shadow-none" />
          </span>
          <span className="min-w-0">
            <strong className="block text-sm font-semibold">InkLoom Web</strong>
            <small className="mt-0.5 block truncate text-xs text-ink-400">
              {workspace.name} · 云端账号会话
            </small>
          </span>
        </div>
        <div className="settings-list mt-3 grid gap-2">
          <button className="flex items-center gap-3 rounded-xl border border-line p-3 text-left hover:bg-canvas" type="button" onClick={openWorkspaceDialog}>
            <Cloud size={17} className="text-brand-600" />
            <span className="min-w-0 flex-1">
              <strong className="block text-sm font-semibold">{workspace.name}</strong>
              <small className="mt-0.5 block text-xs text-ink-400">{workspaces.length} 个工作区 · 切换或新建</small>
            </span>
            <ChevronRight size={16} className="text-ink-300" />
          </button>
          <div className="flex items-center gap-3 rounded-xl border border-line p-3">
            <HardDrive size={17} className="text-brand-600" />
            <span className="min-w-0 flex-1">
              <strong className="block text-sm font-semibold">云端持久化</strong>
              <small className="mt-0.5 block text-xs text-ink-400">文档、标签、画布和版本保存在服务端 SQLite</small>
            </span>
            <Check size={16} className="text-brand-600" />
          </div>
          <button className="flex items-center gap-3 rounded-xl border border-line p-3 text-left hover:bg-canvas" type="button" onClick={() => {
            setWorkspaceNameDraft(workspace.name);
            setDialog("workspace-rename");
          }}>
            <Pencil size={17} className="text-brand-600" />
            <span className="min-w-0 flex-1">
              <strong className="block text-sm font-semibold">重命名工作区</strong>
              <small className="mt-0.5 block text-xs text-ink-400">只改变显示名称，不影响文档内容</small>
            </span>
            <ChevronRight size={16} className="text-ink-300" />
          </button>
        </div>
      </AppDialog>

      <AppDialog
        open={dialog === "title"}
        title="重命名文档标题"
        onClose={closeDialog}
        footer={
          <>
            <Button variant="secondary" onClick={closeDialog} disabled={dialogBusy}>
              取消
            </Button>
            <Button
              variant="primary"
              type="submit"
              form="rename-title-form"
              disabled={dialogBusy}
            >
              保存标题
            </Button>
          </>
        }
      >
        <form
          id="rename-title-form"
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const title = titleDraft.trim();
            if (!title) {
              setDialogError("文档标题不能为空。");
              return;
            }
            controller.updateTitle(title);
            setDialog(null);
            setDialogError("");
          }}
        >
          <FieldLabel>
            文档标题
            <TextInput
              value={titleDraft}
              onChange={(event) => setTitleDraft(event.target.value)}
              maxLength={200}
              autoFocus
            />
          </FieldLabel>
          {dialogError && <DialogError message={dialogError} />}
        </form>
      </AppDialog>

      <AppDialog
        open={dialog === "move"}
        title="移动或重命名文档"
        description="使用工作区内相对路径；文件夹和文件名会自动创建。"
        onClose={closeDialog}
        footer={
          <>
            <Button variant="secondary" onClick={closeDialog} disabled={dialogBusy}>取消</Button>
            <Button variant="primary" type="submit" form="move-document-form" disabled={dialogBusy}>
              {dialogBusy ? "正在移动…" : "保存路径"}
            </Button>
          </>
        }
      >
        <form id="move-document-form" className="grid gap-4" onSubmit={(event) => {
          event.preventDefault();
          void moveDocument();
        }}>
          <FieldLabel>
            工作区路径
            <TextInput
              value={movePathDraft}
              onChange={(event) => setMovePathDraft(event.target.value)}
              placeholder="目录/文档.md"
              spellCheck={false}
              autoFocus
            />
          </FieldLabel>
          <p className="text-xs leading-5 text-ink-400">当前路径：{activeNote.filePath}</p>
          {dialogError && <DialogError message={dialogError} />}
        </form>
      </AppDialog>

      <AppDialog
        open={dialog === "tags"}
        title="管理标签"
        description="标签会随文档保存在云端，并可用于左侧搜索。"
        onClose={closeDialog}
        footer={<Button variant="primary" onClick={closeDialog}>完成</Button>}
      >
        <div className="tag-editor">
          <div className="tag-editor-list flex min-h-12 flex-wrap gap-2 rounded-xl bg-canvas p-3">
            {activeNote.tags.length === 0 && <span className="text-xs text-ink-400">还没有标签。</span>}
            {activeNote.tags.map((tag) => (
              <span className="tag-editor-chip inline-flex min-h-8 items-center gap-1.5 rounded-full border border-brand-200 bg-white px-3 text-xs font-semibold text-brand-700" key={tag}>
                {tag}
                <button type="button" aria-label={`移除标签 ${tag}`} onClick={() => removeTag(tag)}>
                  <X size={13} />
                </button>
              </span>
            ))}
          </div>
          <form className="mt-4 flex items-end gap-2" onSubmit={(event) => {
            event.preventDefault();
            addTag();
          }}>
            <FieldLabel className="min-w-0 flex-1">
              新标签
              <TextInput
                value={tagDraft}
                onChange={(event) => setTagDraft(event.target.value)}
                maxLength={30}
                placeholder="输入标签后按 Enter"
                autoFocus
              />
            </FieldLabel>
            <Button variant="secondary" type="submit">
              <Plus size={15} /> 添加
            </Button>
          </form>
          {dialogError && <DialogError message={dialogError} />}
        </div>
      </AppDialog>

      <AppDialog
        open={dialog === "delete"}
        title="删除这篇文档？"
        onClose={closeDialog}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)} disabled={dialogBusy}>保留文档</Button>
            <Button variant="danger" onClick={() => void deleteDocument()} disabled={dialogBusy}>
              <Trash2 size={15} /> {dialogBusy ? "正在删除…" : "确认删除"}
            </Button>
          </>
        }
      >
        <p className="text-sm leading-7 text-ink-600">
          “{activeNote.title}”会从当前云端工作区移除。删除前请确认已经导出仍需保留的内容。
        </p>
        {dialogError && <DialogError message={dialogError} />}
      </AppDialog>

      <AppDialog
        open={dialog === "restore"}
        title={`恢复 revision ${pendingRestore?.meta.revision ?? ""}`}
        onClose={closeDialog}
        footer={
          <>
            <Button variant="secondary" onClick={closeDialog} disabled={dialogBusy}>取消</Button>
            <Button variant="primary" onClick={() => void restoreVersion()} disabled={dialogBusy}>
              {dialogBusy ? "正在恢复…" : "恢复此版本"}
            </Button>
          </>
        }
      >
        <p className="text-sm leading-7 text-ink-600">
          当前内容会先进入历史记录，然后生成一个新的 revision。
        </p>
        {dialogError && <DialogError message={dialogError} />}
      </AppDialog>

      <AppDialog
        open={dialog === "logout"}
        title="退出当前账号？"
        onClose={closeDialog}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog("settings")} disabled={dialogBusy}>返回设置</Button>
            <Button variant="danger" onClick={() => void logout()} disabled={dialogBusy}>
              <LogOut size={15} /> {dialogBusy ? "正在退出…" : "退出登录"}
            </Button>
          </>
        }
      >
        <p className="text-sm leading-7 text-ink-600">
          未保存的修改会先保留在本机草稿中；下次登录同一浏览器时可继续恢复。
        </p>
        {dialogError && <DialogError message={dialogError} />}
      </AppDialog>

      <Toast />
    </div>
  );
}

function MenuAction({
  icon,
  danger = false,
  onSelect,
  children
}: {
  icon: ReactNode;
  danger?: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <DropdownMenu.Item
      className={`flex min-h-9 cursor-default items-center gap-2 rounded-lg px-2.5 text-xs font-medium outline-none data-[highlighted]:bg-brand-50 ${
        danger ? "text-danger-700 data-[highlighted]:bg-danger-50" : "text-ink-700"
      }`}
      onSelect={onSelect}
    >
      {icon}
      {children}
    </DropdownMenu.Item>
  );
}

function DialogError({ message }: { message: string }) {
  return (
    <p className="mt-3 rounded-xl border border-danger-200 bg-danger-50 px-3 py-2.5 text-xs leading-5 text-danger-700" role="alert">
      {message}
    </p>
  );
}

function Toast() {
  const message = useToastStore((state) => state.message);
  return message ? (
    <div className="toast fixed bottom-5 left-1/2 z-[80] -translate-x-1/2 rounded-full bg-ink-950 px-5 py-2.5 text-xs font-semibold text-white shadow-xl">
      {message}
    </div>
  ) : null;
}

function PageLoading({ message }: { message: string }) {
  return (
    <main className="session-loading grid min-h-dvh place-items-center bg-canvas">
      <div className="grid justify-items-center gap-4">
        <BrandMark className="size-12 rounded-2xl" />
        <p className="text-sm font-medium text-ink-500">{message}</p>
      </div>
    </main>
  );
}

function PageError({
  title,
  message,
  onRetry
}: {
  title: string;
  message: string;
  onRetry: () => void;
}) {
  return (
    <main className="workspace-load-error grid min-h-dvh place-items-center bg-canvas px-5">
      <div className="max-w-md rounded-3xl border border-line bg-paper p-8 text-center shadow-sm">
        <BrandMark className="mx-auto size-12" />
        <h1 className="mt-5 font-display text-2xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-ink-500">{message}</p>
        <Button variant="primary" className="mt-5" onClick={onRetry}>重新连接</Button>
      </div>
    </main>
  );
}

type DirectoryHandle = {
  entries(): AsyncIterableIterator<[string, DirectoryEntry]>;
};

type DirectoryEntry =
  | { kind: "file"; getFile(): Promise<File> }
  | { kind: "directory"; entries(): AsyncIterableIterator<[string, DirectoryEntry]> };

type WorkspaceSession = {
  workspaces: CloudWorkspace[];
  activeWorkspace: CloudWorkspace;
};
