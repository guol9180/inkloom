import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent
} from "react";
import {
  CanvasEditor,
  renderMarkdown,
  renderMermaidBlocks,
  type CanvasScene
} from "@inkloom/diagrams";
import {
  RevisionConflictError,
  workspacePath,
  type JsonValue,
  type WorkspaceId
} from "@inkloom/core";
import {
  countWords,
  extractHeadings,
  type MarkdownViewMode
} from "@inkloom/editor";
import type {
  CloudDocumentRevision,
  CloudUser,
  CloudWorkspace,
  CloudWorkspaceAdapter
} from "@inkloom/storage";
import {
  ArrowUpRight,
  Bold,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  CirclePlus,
  Cloud,
  Code2,
  Columns2,
  Download,
  Eye,
  FileText,
  FolderPlus,
  FolderInput,
  FolderClosed,
  FolderOpen,
  GitBranch,
  HardDrive,
  Heading2,
  History,
  ImagePlus,
  Italic,
  Link2,
  List,
  LogOut,
  Menu,
  MoreHorizontal,
  Network,
  PanelLeftClose,
  PanelRightClose,
  Pencil,
  Search,
  Settings,
  SquarePen,
  Tag,
  Trash2,
  Upload,
  X
} from "lucide-react";
import {
  clearDraft,
  cloudClient,
  loadCloudWorkspace,
  loadCloudWorkspaces,
  persistActiveCloudWorkspace,
  persistActiveWorkspace,
  saveDraft,
  snapshotToNote
} from "./cloud-workspace";
import { Dialog } from "./Dialog";
import { BrandMark } from "./BrandMark";
import { folderOrder, type Note } from "./data";

type ViewMode = MarkdownViewMode;
type SaveState = "loading" | "saved" | "saving" | "error" | "conflict";
type DialogKind =
  | "workspace"
  | "workspace-create"
  | "workspace-rename"
  | "settings"
  | "move"
  | "tags"
  | "delete"
  | "restore"
  | "logout"
  | null;

type SavedNoteShape = {
  title: string;
  content: string;
  tags: string[];
  canvas?: CanvasScene;
};

type PendingSave = {
  noteId: string;
  adapter: CloudWorkspaceAdapter;
};

function formatTime(value: string): string {
  const date = new Date(value);
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

function WorkspaceApp({
  user,
  onLogout
}: {
  user: CloudUser;
  onLogout: () => Promise<void>;
}) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeId, setActiveId] = useState("");
  const [workspaces, setWorkspaces] = useState<CloudWorkspace[]>([]);
  const [workspace, setWorkspace] = useState<CloudWorkspace>();
  const [adapter, setAdapter] = useState<CloudWorkspaceAdapter>();
  const [workspaceLoading, setWorkspaceLoading] = useState(true);
  const [workspaceError, setWorkspaceError] = useState("");
  const [revisions, setRevisions] = useState<CloudDocumentRevision[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [query, setQuery] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("loading");
  const [saveError, setSaveError] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(folderOrder)
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [documentMenuOpen, setDocumentMenuOpen] = useState(false);
  const [canvasOpen, setCanvasOpen] = useState(false);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [workspaceNameDraft, setWorkspaceNameDraft] = useState("");
  const [movePathDraft, setMovePathDraft] = useState("");
  const [tagDraft, setTagDraft] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [dialogBusy, setDialogBusy] = useState(false);
  const [pendingRestore, setPendingRestore] =
    useState<CloudDocumentRevision>();
  const [toast, setToast] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const documentMenuRef = useRef<HTMLDivElement>(null);
  const notesRef = useRef<Note[]>([]);
  const lastSavedRef = useRef(new Map<string, SavedNoteShape>());
  const revisionRef = useRef(new Map<string, number>());
  const pendingSavesRef = useRef(new Map<string, PendingSave>());
  const drainingSavesRef = useRef(false);
  const saveDrainRef = useRef<Promise<void>>(Promise.resolve());
  const conflictLockedRef = useRef(false);
  const saveTimerRef = useRef<number | undefined>(undefined);

  const activeNote = notes.find((note) => note.id === activeId) ?? notes[0];
  const visibleFolders = useMemo(() => {
    const folders = new Set<string>();
    for (const folder of folderOrder) folders.add(folder);
    for (const note of notes) {
      const segments = note.folder.split("/").filter(Boolean);
      for (let index = 1; index <= segments.length; index += 1) {
        folders.add(segments.slice(0, index).join("/"));
      }
    }
    return [...folders].sort((left, right) => {
      const leftDepth = left.split("/").length;
      const rightDepth = right.split("/").length;
      if (leftDepth !== rightDepth) return leftDepth - rightDepth;
      return left.localeCompare(right, "zh-CN");
    });
  }, [notes]);
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

  const previewHtml = useMemo(
    () => renderMarkdown(activeNote?.content ?? "", activeNote?.canvas),
    [activeNote?.content, activeNote?.canvas]
  );

  const outline = useMemo(() => {
    if (!activeNote) return [];
    return extractHeadings(activeNote.content);
  }, [activeNote]);

  const backlinks = useMemo(() => {
    if (!activeNote) return [];
    return notes.filter(
      (note) =>
        note.id !== activeNote.id &&
        (note.content.includes(activeNote.title) || note.content.includes(activeNote.filePath))
    );
  }, [activeNote, notes]);

  useEffect(() => {
    let cancelled = false;
    void renderMermaidBlocks(previewRef.current, () => cancelled);

    return () => {
      cancelled = true;
    };
  }, [previewHtml]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setWorkspaceLoading(true);
      setWorkspaceError("");
      setSaveState("loading");
      try {
        const session = await loadCloudWorkspaces();
        if (cancelled) return;
        setWorkspaces(session.workspaces);
        await activateWorkspace(session.activeWorkspace, () => cancelled);
      } catch (error) {
        if (cancelled) return;
        setWorkspaceError(
          error instanceof Error ? error.message : "工作区加载失败。"
        );
        setWorkspaceLoading(false);
        setSaveState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  useEffect(() => {
    if (!adapter || !activeNote || workspaceLoading) return;
    if (conflictLockedRef.current) return;
    const saved = lastSavedRef.current.get(activeNote.id);
    if (!saved || noteShapesEqual(saved, noteShape(activeNote))) {
      return;
    }
    saveDraft(activeNote);
    setSaveState("saving");
    setSaveError("");
    saveTimerRef.current = window.setTimeout(() => {
      queueSave(activeNote.id, adapter);
    }, 550);
    return () => {
      if (saveTimerRef.current !== undefined) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [activeNote, adapter, workspaceLoading]);

  useEffect(() => {
    const desktopInspector = window.matchMedia("(min-width: 1241px)");
    const syncInspector = () => setInspectorOpen(desktopInspector.matches);
    syncInspector();
    desktopInspector.addEventListener("change", syncInspector);
    return () => desktopInspector.removeEventListener("change", syncInspector);
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      const current = notesRef.current.find((note) => note.id === activeId);
      if (!current) return;
      const saved = lastSavedRef.current.get(current.id);
      if (saved && noteShapesEqual(saved, noteShape(current))) return;
      saveDraft(current);
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [activeId]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setSidebarOpen(false);
      setDocumentMenuOpen(false);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  useEffect(() => {
    if (!documentMenuOpen) return;
    const closeMenu = (event: PointerEvent) => {
      if (!documentMenuRef.current?.contains(event.target as Node)) {
        setDocumentMenuOpen(false);
      }
    };
    window.addEventListener("pointerdown", closeMenu);
    return () => window.removeEventListener("pointerdown", closeMenu);
  }, [documentMenuOpen]);

  useEffect(() => {
    if (workspace && activeId) persistActiveWorkspace(workspace.id as WorkspaceId, activeId);
  }, [activeId, workspace]);

  useEffect(() => {
    if (!adapter || !activeNote) {
      setRevisions([]);
      return;
    }
    let cancelled = false;
    void cloudClient
      .listRevisions(adapter.workspaceId, activeNote.id)
      .then((items) => {
        if (!cancelled) setRevisions(items);
      })
      .catch(() => {
        if (!cancelled) setRevisions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [adapter, activeNote?.id, activeNote?.revision]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (adapter && activeNote) {
          void persistNote(activeNote, adapter);
          showToast("正在保存当前文档");
        }
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [activeNote, adapter]);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  }

  function closeDialog() {
    if (dialogBusy) return;
    setDialog(null);
    setDialogError("");
    setPendingRestore(undefined);
  }

  function toggleSidebar() {
    setSidebarOpen((current) => {
      const next = !current;
      if (next) setInspectorOpen(false);
      return next;
    });
  }

  function toggleInspector() {
    setInspectorOpen((current) => {
      const next = !current;
      if (next) setSidebarOpen(false);
      return next;
    });
  }

  function noteShape(note: Note): SavedNoteShape {
    return {
      title: note.title,
      content: note.content,
      tags: note.tags,
      canvas: note.canvas
    };
  }

  function noteShapesEqual(left: SavedNoteShape, right: SavedNoteShape): boolean {
    return (
      left.title === right.title &&
      left.content === right.content &&
      JSON.stringify(left.tags) === JSON.stringify(right.tags) &&
      JSON.stringify(left.canvas) === JSON.stringify(right.canvas)
    );
  }

  function updateNotes(updater: (current: Note[]) => Note[]): void {
    setNotes((current) => {
      const next = updater(current);
      notesRef.current = next;
      return next;
    });
  }

  async function activateWorkspace(
    nextWorkspace: CloudWorkspace,
    isCancelled: () => boolean = () => false
  ): Promise<void> {
    const nextAdapter = cloudClient.workspace(nextWorkspace.id as WorkspaceId);
    const loaded = await loadCloudWorkspace(nextAdapter, nextWorkspace);
    if (isCancelled()) return;
    notesRef.current = loaded.notes;
    lastSavedRef.current = new Map(
      loaded.notes.map((note) => [note.id, noteShape(note)])
    );
    revisionRef.current = new Map(
      loaded.notes.map((note) => [note.id, note.revision])
    );
    pendingSavesRef.current.clear();
    conflictLockedRef.current = false;
    setWorkspace(nextWorkspace);
    setAdapter(nextAdapter);
    setNotes(loaded.notes);
    setActiveId(loaded.activeId);
    setExpandedFolders(
      new Set([
        ...folderOrder,
        ...loaded.notes.flatMap((note) => folderHierarchy(note.folder))
      ])
    );
    setWorkspaceLoading(false);
    setSaveState("saved");
    setSaveError("");
    persistActiveCloudWorkspace(nextWorkspace.id as WorkspaceId);
    if (loaded.recoveredDraft) {
      showToast("已恢复上次未成功保存到云端的本地草稿");
    }
  }

  async function switchWorkspace(nextWorkspace: CloudWorkspace): Promise<void> {
    if (nextWorkspace.id === workspace?.id) {
      setDialog(null);
      return;
    }
    setDialogBusy(true);
    setDialogError("");
    try {
      if (adapter && activeNote) await queueSave(activeNote.id, adapter);
      await saveDrainRef.current;
      setWorkspaceLoading(true);
      await activateWorkspace(nextWorkspace);
      setDialog(null);
      setSidebarOpen(false);
      showToast(`已切换到“${nextWorkspace.name}”`);
    } catch (error) {
      setDialogError(
        error instanceof Error ? error.message : "切换工作区失败。"
      );
    } finally {
      setDialogBusy(false);
    }
  }

  function queueSave(
    noteId: string,
    targetAdapter: CloudWorkspaceAdapter
  ): Promise<void> {
    if (saveTimerRef.current !== undefined) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = undefined;
    }
    const latest = notesRef.current.find((note) => note.id === noteId);
    if (latest) saveDraft(latest);
    pendingSavesRef.current.set(noteId, { noteId, adapter: targetAdapter });
    setSaveState("saving");
    setSaveError("");
    saveDrainRef.current = saveDrainRef.current.then(drainSaves);
    return saveDrainRef.current;
  }

  async function drainSaves(): Promise<void> {
    if (drainingSavesRef.current) return;
    drainingSavesRef.current = true;
    let failed = false;
    try {
      while (pendingSavesRef.current.size > 0) {
        const [noteId, pending] = pendingSavesRef.current.entries().next().value as [
          string,
          PendingSave
        ];
        pendingSavesRef.current.delete(noteId);
        const latest = notesRef.current.find((note) => note.id === noteId);
        if (!latest) continue;
        const savedShape = lastSavedRef.current.get(noteId);
        if (savedShape && noteShapesEqual(savedShape, noteShape(latest))) {
          clearDraft(noteId);
          continue;
        }
        const sentShape = noteShape(latest);
        try {
          const saved = await pending.adapter.writeDocument({
            documentId: latest.id,
            baseRevision:
              revisionRef.current.get(latest.id) ?? latest.revision,
            markdown: latest.content,
            title: latest.title,
            tags: latest.tags,
            extensions: latest.canvas
              ? { canvas: latest.canvas as unknown as JsonValue }
              : undefined
          });
          const savedNote = snapshotToNote(saved);
          revisionRef.current.set(savedNote.id, savedNote.revision);
          lastSavedRef.current.set(savedNote.id, noteShape(savedNote));
          updateNotes((current) => {
            const next = current.map((item) => {
              if (item.id !== savedNote.id) return item;
              return noteShapesEqual(sentShape, noteShape(item))
                ? savedNote
                : {
                    ...item,
                    revision: savedNote.revision,
                    updatedAt: savedNote.updatedAt
                  };
            });
            return next;
          });
          const current = notesRef.current.find((note) => note.id === noteId);
          if (current && noteShapesEqual(sentShape, noteShape(current))) {
            clearDraft(noteId);
          }
        } catch (error) {
          const localNote =
            notesRef.current.find((note) => note.id === noteId) ?? latest;
          saveDraft(localNote);
          if (error instanceof RevisionConflictError) {
            pendingSavesRef.current.delete(noteId);
            conflictLockedRef.current = true;
            setSaveState("conflict");
            setSaveError("云端已有更新，正在保留本地副本。");
            try {
              await preserveConflictCopy(localNote, pending.adapter);
            } catch {
              failed = true;
              setSaveError(
                "保存冲突。请保留此页面并刷新后处理，云端内容不会被覆盖。"
              );
            }
          } else {
            failed = true;
            setSaveState("error");
            setSaveError(
              error instanceof Error
                ? `保存失败：${error.message}`
                : "保存失败，本地草稿已保留。"
            );
          }
        }
      }
      if (!failed && pendingSavesRef.current.size === 0) setSaveState("saved");
    } finally {
      drainingSavesRef.current = false;
    }
  }

  function persistNote(
    note: Note,
    targetAdapter: CloudWorkspaceAdapter
  ): Promise<void> {
    saveDraft(note);
    return queueSave(note.id, targetAdapter);
  }

  async function preserveConflictCopy(
    localNote: Note,
    targetAdapter: CloudWorkspaceAdapter
  ): Promise<void> {
    const serverSnapshot = await targetAdapter.readDocument(localNote.id);
    const copyTitle = nextAvailableTitle(
      `${localNote.title}（本地冲突副本）`,
      localNote.folder,
      notesRef.current
    );
    const copyPath = uniqueFilePath(
      localNote.folder,
      copyTitle,
      notesRef.current
    );
    const created = await targetAdapter.createDocument({
      workspaceId: targetAdapter.workspaceId,
      path: workspacePath(copyPath),
      title: copyTitle,
      markdown: localNote.content,
      tags: localNote.tags,
      extensions: localNote.canvas
        ? { canvas: localNote.canvas as unknown as JsonValue }
        : undefined
    });
    const serverNote = snapshotToNote(serverSnapshot);
    const copyNote = snapshotToNote(created);
    lastSavedRef.current.set(serverNote.id, noteShape(serverNote));
    lastSavedRef.current.set(copyNote.id, noteShape(copyNote));
    revisionRef.current.set(serverNote.id, serverNote.revision);
    revisionRef.current.set(copyNote.id, copyNote.revision);
    clearDraft(localNote.id);
    clearDraft(copyNote.id);
    updateNotes((current) =>
      current.flatMap((item) =>
        item.id === localNote.id ? [serverNote, copyNote] : [item]
      )
    );
    setActiveId(copyNote.id);
    conflictLockedRef.current = false;
    setSaveError("");
    setSaveState("saved");
    showToast("云端版本与本地修改均已保留");
  }

  async function createServerNote(folder = "个人"): Promise<Note> {
    if (!adapter) throw new Error("工作区尚未加载。");
    const title = nextAvailableTitle("未命名文档", folder, notes);
    const snapshot = await adapter.createDocument({
      workspaceId: adapter.workspaceId,
      path: workspacePath(uniqueFilePath(folder, title, notes)),
      title,
      markdown: `# ${title}\n\n从这里开始记录。\n`
    });
    const note = snapshotToNote(snapshot);
    lastSavedRef.current.set(note.id, noteShape(note));
    revisionRef.current.set(note.id, note.revision);
    updateNotes((current) => [...current, note]);
    setActiveId(note.id);
    setSaveState("saved");
    return note;
  }

  function updateActiveNote(patch: Partial<Note>) {
    if (!activeNote) return;
    updateNotes((current) =>
      current.map((note) =>
        note.id === activeNote.id
          ? { ...note, ...patch, updatedAt: new Date().toISOString() }
          : note
      )
    );
  }

  function updateTitle(title: string) {
    if (!activeNote) return;
    const nextContent = activeNote.content.replace(/^# .+$/m, `# ${title}`);
    updateActiveNote({ title, content: nextContent });
  }

  function selectNote(id: string) {
    if (adapter && activeNote && id !== activeNote.id) {
      const saved = lastSavedRef.current.get(activeNote.id);
      if (saved && !noteShapesEqual(saved, noteShape(activeNote))) {
        void persistNote(activeNote, adapter);
      }
    }
    setActiveId(id);
    setSidebarOpen(false);
  }

  async function addNote(folder = activeNote?.folder ?? "个人") {
    if (!adapter) return;
    setSaveState("saving");
    try {
      await createServerNote(folder);
    } catch (error) {
      setSaveState("error");
      setSaveError(error instanceof Error ? error.message : "新建文档失败。");
      return;
    }
    setExpandedFolders(
      (current) => new Set([...current, ...folderHierarchy(folder)])
    );
    window.setTimeout(() => {
      const titleInput = document.querySelector<HTMLInputElement>(".document-title");
      titleInput?.focus();
      titleInput?.select();
    }, 30);
  }

  async function deleteActiveNote() {
    if (!activeNote || !adapter) return;
    setDialogBusy(true);
    setDialogError("");
    try {
      pendingSavesRef.current.delete(activeNote.id);
      await adapter.deleteNode({
        nodeId: activeNote.id,
        baseRevision:
          revisionRef.current.get(activeNote.id) ?? activeNote.revision
      });
      clearDraft(activeNote.id);
      lastSavedRef.current.delete(activeNote.id);
      revisionRef.current.delete(activeNote.id);
      const remaining = notesRef.current.filter(
        (note) => note.id !== activeNote.id
      );
      updateNotes(() => remaining);
      setActiveId(remaining[0]?.id ?? "");
      setSaveState("saved");
      if (remaining.length === 0) await createServerNote();
      setDialog(null);
      showToast("文档已删除");
    } catch (error) {
      setSaveState("error");
      setDialogError(error instanceof Error ? error.message : "删除失败。");
    } finally {
      setDialogBusy(false);
    }
  }

  function insertAtCursor(before: string, after = "", placeholder = "文字") {
    const textarea = textareaRef.current;
    if (!activeNote) return;
    if (!textarea) {
      updateActiveNote({
        content: `${activeNote.content.trimEnd()}\n\n${before}${placeholder}${after}\n`
      });
      setViewMode("split");
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = activeNote.content.slice(start, end) || placeholder;
    const next =
      activeNote.content.slice(0, start) +
      before +
      selected +
      after +
      activeNote.content.slice(end);
    updateActiveNote({ content: next });
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  }

  function insertMermaid() {
    if (!activeNote) return;
    const snippet = `\n## 新图表\n\n\`\`\`mermaid\nflowchart LR\n  A[输入] --> B{判断}\n  B -->|是| C[完成]\n  B -->|否| D[调整]\n\`\`\`\n`;
    updateActiveNote({ content: activeNote.content + snippet });
    setViewMode("split");
    showToast("已插入 Mermaid 图表");
  }

  function openCanvas() {
    if (!activeNote) return;
    setCanvasOpen(true);
  }

  function insertCanvas() {
    if (!activeNote) return;
    const canvas: CanvasScene = activeNote.canvas ?? {
      title: "新画布",
      elements: []
    };
    const marker = `\`\`\`excalidraw\nid: ${activeNote.id}\ntitle: ${canvas.title}\nsrc: ./assets/${activeNote.id}.excalidraw\n\`\`\`\n`;
    updateActiveNote({
      canvas,
      content: activeNote.content.includes("```excalidraw")
        ? activeNote.content
        : `${activeNote.content}\n## 图表\n\n${marker}`
    });
    setCanvasOpen(true);
  }

  function saveCanvas(elements: readonly Record<string, unknown>[]) {
    if (!activeNote) return;
    updateActiveNote({
      canvas: {
        title: activeNote.canvas?.title ?? "自由画布",
        elements
      }
    });
    setCanvasOpen(false);
    showToast("画布场景已保存");
  }

  function exportMarkdown() {
    if (!activeNote) return;
    const body = activeNote.content.trimStart().startsWith("#")
      ? activeNote.content
      : `# ${activeNote.title}\n\n${activeNote.content}`;
    const blob = new Blob([body], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${activeNote.title.replace(/[\\/:*?"<>|]/g, "-")}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
    showToast("Markdown 已导出");
  }

  async function importMarkdown(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !adapter) return;
    setSaveState("saving");
    try {
      const note = await importOneMarkdown(
        file.name,
        await file.text(),
        "个人",
        ["导入"]
      );
      setActiveId(note.id);
      setSaveState("saved");
      showToast("Markdown 已保存到云端");
    } catch (error) {
      setSaveState("error");
      setSaveError(error instanceof Error ? error.message : "Markdown 导入失败。");
    }
  }

  async function importFolder() {
    const picker = (window as unknown as { showDirectoryPicker?: (options?: unknown) => Promise<DirectoryHandle> })
      .showDirectoryPicker;
    if (!picker || !adapter) {
      showToast("当前浏览器不支持目录读取，请使用导入 Markdown");
      return;
    }

    try {
      const directory = await picker({ mode: "read" });
      const pending: Array<{
        name: string;
        text: string;
        folder: string;
      }> = [];
      const scan = async (handle: DirectoryHandle, prefix = "") => {
        for await (const [name, entry] of handle.entries()) {
          if (name.startsWith(".") || pending.length >= 200) continue;
          if (entry.kind === "file" && /\.md$/i.test(name)) {
            const file = await entry.getFile();
            pending.push({
              name,
              text: await file.text(),
              folder: prefix.replace(/\/$/, "") || "个人"
            });
          }
          if (entry.kind === "directory" && prefix.split("/").length < 8) {
            await scan(entry, `${prefix}${name}/`);
          }
        }
      };
      await scan(directory);
      if (pending.length === 0) {
        showToast("文件夹里没有找到 Markdown");
        return;
      }
      setSaveState("saving");
      const imported: Note[] = [];
      try {
        for (const file of pending) {
          imported.push(
            await importOneMarkdown(
              file.name,
              file.text,
              file.folder,
              ["文件夹导入"]
            )
          );
        }
      } finally {
        if (imported.length > 0) {
          setActiveId(imported[0].id);
          setExpandedFolders(
            (current) =>
              new Set([
                ...current,
                ...imported.flatMap((note) => folderHierarchy(note.folder))
              ])
          );
        }
      }
      setSaveState("saved");
      showToast(`已导入 ${imported.length} 篇 Markdown`);
    } catch (error) {
      if ((error as Error).name !== "AbortError") showToast("目录读取失败");
    }
  }

  async function importOneMarkdown(
    fileName: string,
    text: string,
    folder: string,
    tags: string[]
  ): Promise<Note> {
    if (!adapter) throw new Error("工作区尚未加载。");
    const heading = /^#\s+(.+)$/m.exec(text)?.[1]?.trim();
    const baseTitle = heading || fileName.replace(/\.md$/i, "");
    const title = nextAvailableTitle(baseTitle, folder, notes);
    const path = uniqueFilePath(folder, title, notes);
    const markdown = /^#\s/m.test(text) ? text : `# ${title}\n\n${text}`;
    const snapshot = await adapter.createDocument({
      workspaceId: adapter.workspaceId,
      path: workspacePath(path),
      title,
      markdown,
      tags
    });
    const note = snapshotToNote(snapshot);
    lastSavedRef.current.set(note.id, noteShape(note));
    revisionRef.current.set(note.id, note.revision);
    updateNotes((current) => [...current, note]);
    return note;
  }

  function openMoveDialog() {
    if (!activeNote || !adapter) return;
    setMovePathDraft(activeNote.filePath);
    setDialogError("");
    setDialog("move");
  }

  async function moveActiveNote() {
    if (!activeNote || !adapter) return;
    const targetPath = movePathDraft.trim();
    if (!targetPath || targetPath === activeNote.filePath) {
      setDialog(null);
      return;
    }
    setDialogBusy(true);
    setDialogError("");
    try {
      await queueSave(activeNote.id, adapter);
      await saveDrainRef.current;
      const baseRevision =
        revisionRef.current.get(activeNote.id) ?? activeNote.revision;
      const moved = await adapter.moveNode({
        nodeId: activeNote.id,
        targetPath: workspacePath(targetPath),
        baseRevision
      });
      const folder =
        targetPath.split("/").slice(0, -1).join("/") || "个人";
      if (moved.kind === "document") {
        revisionRef.current.set(activeNote.id, moved.meta.revision);
      }
      updateNotes((current) =>
        current.map((note) =>
          note.id === activeNote.id
            ? {
                ...note,
                filePath: moved.path,
                folder,
                revision:
                  moved.kind === "document" ? moved.meta.revision : note.revision,
                updatedAt:
                  moved.kind === "document" ? moved.meta.updatedAt : note.updatedAt
              }
            : note
        )
      );
      const updated = notesRef.current.find((note) => note.id === activeNote.id);
      if (updated) {
        lastSavedRef.current.set(activeNote.id, noteShape(updated));
      }
      setExpandedFolders(
        (current) => new Set([...current, ...folderHierarchy(folder)])
      );
      setSaveState("saved");
      setDialog(null);
      showToast("文档路径已更新");
    } catch (error) {
      setSaveState("error");
      setDialogError(error instanceof Error ? error.message : "移动文档失败。");
    } finally {
      setDialogBusy(false);
    }
  }

  function requestRestoreVersion(revision: CloudDocumentRevision) {
    setPendingRestore(revision);
    setDialogError("");
    setDialog("restore");
  }

  async function restoreVersion() {
    if (!activeNote || !adapter) return;
    const revision = pendingRestore;
    if (!revision) return;
    setDialogBusy(true);
    setDialogError("");
    try {
      await queueSave(activeNote.id, adapter);
      await saveDrainRef.current;
      const restored = await cloudClient.restoreRevision(
        adapter.workspaceId,
        activeNote.id,
        revision.revisionId,
        revisionRef.current.get(activeNote.id) ?? activeNote.revision
      );
      const restoredNote = snapshotToNote(restored);
      lastSavedRef.current.set(restoredNote.id, noteShape(restoredNote));
      revisionRef.current.set(restoredNote.id, restoredNote.revision);
      clearDraft(restoredNote.id);
      updateNotes((current) =>
        current.map((note) => (note.id === restoredNote.id ? restoredNote : note))
      );
      setSaveState("saved");
      setPendingRestore(undefined);
      setDialog(null);
      showToast("历史版本已恢复并保存为新 revision");
    } catch (error) {
      setSaveState("error");
      setDialogError(
        error instanceof Error ? error.message : "恢复历史版本失败。"
      );
    } finally {
      setDialogBusy(false);
    }
  }

  async function logout() {
    setDialogBusy(true);
    setDialogError("");
    try {
      await onLogout();
    } catch (error) {
      setDialogError(error instanceof Error ? error.message : "退出失败，请稍后重试");
    } finally {
      setDialogBusy(false);
    }
  }

  function openTagDialog() {
    setTagDraft("");
    setDialogError("");
    setDialog("tags");
  }

  function addTag() {
    if (!activeNote) return;
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
    updateActiveNote({ tags: [...activeNote.tags, tag] });
    setTagDraft("");
    setDialogError("");
  }

  function removeTag(tag: string) {
    if (!activeNote) return;
    updateActiveNote({
      tags: activeNote.tags.filter((item) => item !== tag)
    });
  }

  function openWorkspaceDialog() {
    setDialogError("");
    setDialog("workspace");
  }

  function openWorkspaceRename() {
    setWorkspaceNameDraft(workspace?.name ?? "");
    setDialogError("");
    setDialog("workspace-rename");
  }

  async function renameWorkspace() {
    if (!workspace) return;
    const name = workspaceNameDraft.trim();
    if (!name) {
      setDialogError("工作区名称不能为空。");
      return;
    }
    setDialogBusy(true);
    setDialogError("");
    try {
      const renamed = await cloudClient.renameWorkspace(
        workspace.id as WorkspaceId,
        name
      );
      setWorkspace(renamed);
      setWorkspaces((current) =>
        current.map((item) => (item.id === renamed.id ? renamed : item))
      );
      setDialog("workspace");
      showToast("工作区名称已更新");
    } catch (error) {
      setDialogError(
        error instanceof Error ? error.message : "工作区重命名失败。"
      );
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
      setWorkspaces((current) => [...current, created]);
      await switchWorkspace(created);
      showToast(`已创建并切换到“${created.name}”`);
    } catch (error) {
      setDialogError(
        error instanceof Error ? error.message : "创建工作区失败。"
      );
    } finally {
      setDialogBusy(false);
    }
  }

  function handlePreviewClick(event: MouseEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest(".canvas-open")) {
      openCanvas();
    }
    const link = (event.target as HTMLElement).closest("a");
    if (link && link.getAttribute("href")?.startsWith("#")) {
      event.preventDefault();
      const target = document.getElementById(link.getAttribute("href")!.slice(1));
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  if (workspaceLoading) {
    return (
      <main className="session-loading">
        <BrandMark />
        <p>正在载入云端文档…</p>
      </main>
    );
  }

  if (workspaceError) {
    return (
      <main className="workspace-load-error">
        <BrandMark />
        <h1>工作区暂时无法打开</h1>
        <p>{workspaceError}</p>
        <button className="auth-submit" type="button" onClick={() => window.location.reload()}>
          重新连接
        </button>
      </main>
    );
  }

  if (!activeNote) {
    return (
      <main className="workspace-load-error">
        <BrandMark />
        <h1>工作区还是空的</h1>
        <p>新建一篇 Markdown，开始记录第一篇云端文档。</p>
        <button className="auth-submit" type="button" onClick={() => void addNote("个人")}>
          新建文档
        </button>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <button
            className="icon-button mobile-menu"
            type="button"
            onClick={toggleSidebar}
            aria-label="打开文件栏"
          >
            <Menu size={18} />
          </button>
          <BrandMark />
          <div className="brand-copy">
            <strong>InkLoom</strong>
            <span>Markdown workspace</span>
          </div>
        </div>

        <div className="workspace-switcher">
          <span className="workspace-kicker">工作区</span>
          <button
            className="workspace-title"
            type="button"
            aria-label="切换工作区"
            onClick={openWorkspaceDialog}
          >
            {workspace?.name ?? "我的工作区"}
            <ChevronDown size={14} />
          </button>
        </div>

        <div className="topbar-actions">
          <span className="sync-state">
            <span className={`sync-dot is-${saveState}`} />
            {saveState === "error"
              ? "云端连接异常"
              : saveState === "conflict"
                ? "需要处理冲突"
                : "云端已连接"}
          </span>
          <button
            className="top-action secondary-action"
            type="button"
            aria-label="导入文件夹"
            onClick={importFolder}
          >
            <FolderOpen size={16} />
            <span>导入文件夹</span>
          </button>
          <button
            className="top-action secondary-action"
            type="button"
            aria-label="导入 Markdown"
            onClick={() => importRef.current?.click()}
          >
            <Upload size={16} />
            <span>导入</span>
          </button>
          <button className="top-action" type="button" onClick={exportMarkdown}>
            <Download size={16} />
            导出
          </button>
          <button
            className="avatar"
            type="button"
            title={`${user.displayName} · 账号设置`}
            aria-label="账号设置"
            onClick={() => {
              setDialogError("");
              setDialog("settings");
            }}
          >
            {user.displayName.slice(0, 1)}
          </button>
        </div>
        <input
          ref={importRef}
          className="visually-hidden"
          type="file"
          accept=".md,.markdown,text/markdown,text/plain"
          onChange={importMarkdown}
        />
      </header>

      <div
        className={`main-grid ${inspectorOpen ? "" : "is-inspector-collapsed"}`}
      >
        <aside className={`sidebar ${sidebarOpen ? "is-open" : ""}`}>
          <div className="sidebar-head">
            <div>
              <span className="section-label">文件</span>
              <strong>{notes.length} 篇文档</strong>
            </div>
            <button
              className="icon-button"
              type="button"
              aria-label="新建文档"
              onClick={() => addNote()}
            >
              <SquarePen size={17} />
            </button>
          </div>

          <button
            className="sidebar-workspace-switcher"
            type="button"
            onClick={openWorkspaceDialog}
          >
            <Cloud size={15} />
            <span>
              <small>当前工作区</small>
              <strong>{workspace?.name ?? "我的工作区"}</strong>
            </span>
            <ChevronDown size={14} />
          </button>

          <label className="search-box">
            <Search size={15} />
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索标题、正文或标签"
            />
            <kbd>Ctrl K</kbd>
          </label>

          <div className="file-tree">
            {visibleFolders.map((folder) => {
              const folderNotes = filteredNotes.filter((note) => note.folder === folder);
              const expanded = expandedFolders.has(folder);
              const segments = folder.split("/");
              const parentPath = segments.slice(0, -1).join("/");
              const folderName = segments.at(-1) ?? folder;
              const matchingNotes = filteredNotes.filter(
                (note) =>
                  note.folder === folder ||
                  note.folder.startsWith(`${folder}/`)
              );
              if (parentPath && !expandedFolders.has(parentPath)) return null;
              if (query && matchingNotes.length === 0) return null;
              return (
                <section className="tree-folder" key={folder}>
                  <button
                    className="folder-row"
                    type="button"
                    style={{ paddingLeft: `${8 + (segments.length - 1) * 12}px` }}
                    onClick={() =>
                      setExpandedFolders((current) => {
                        const next = new Set(current);
                        if (next.has(folder)) next.delete(folder);
                        else next.add(folder);
                        return next;
                      })
                    }
                  >
                    {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    {expanded ? <FolderOpen size={16} /> : <FolderClosed size={16} />}
                    <span>{folderName}</span>
                    <em>{matchingNotes.length}</em>
                  </button>
                  {expanded && (
                    <div className="folder-children">
                      {folderNotes.map((note) => (
                        <button
                          className={`file-row ${note.id === activeNote.id ? "is-active" : ""}`}
                          type="button"
                          key={note.id}
                          onClick={() => selectNote(note.id)}
                        >
                          <FileText size={15} />
                          <span>
                            <strong>{note.title}</strong>
                            <small>{formatTime(note.updatedAt)}</small>
                          </span>
                        </button>
                      ))}
                      <button className="add-file-row" type="button" onClick={() => addNote(folder)}>
                        <CirclePlus size={14} />
                        新建文档
                      </button>
                    </div>
                  )}
                </section>
              );
            })}
          </div>

          <div className="sidebar-foot">
            <div className="storage-card">
              <HardDrive size={18} />
              <div>
                <strong>云端工作区 SQLite</strong>
                <span>账号内自动保存与版本记录</span>
              </div>
              <Check size={15} />
            </div>
            <div className="sidebar-links">
              <button
                type="button"
                onClick={() => {
                  setInspectorOpen(true);
                  setSidebarOpen(false);
                }}
              >
                <History size={15} /> 版本历史
              </button>
              <button
                type="button"
                onClick={() => {
                  setDialogError("");
                  setDialog("settings");
                  setSidebarOpen(false);
                }}
              >
                <Settings size={15} /> 工作区设置
              </button>
            </div>
          </div>
        </aside>

        {sidebarOpen && (
          <button
            className="drawer-scrim is-sidebar"
            type="button"
            aria-label="关闭文件栏"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <main className="editor-column">
          <div className="document-topline">
            <div className="breadcrumbs">
              <span>{workspace?.name ?? "我的工作区"}</span>
              <ChevronRight size={12} />
              <span>{activeNote.folder}</span>
              <ChevronRight size={12} />
              <strong>{activeNote.title}</strong>
            </div>
            <div className="document-actions">
              <div className="save-indicator" aria-live="polite">
                {saveState === "saving" || saveState === "loading" ? (
                  <>
                    <span className="saving-dot" />
                    保存中
                  </>
                ) : saveState === "error" || saveState === "conflict" ? (
                  <button
                    type="button"
                    title={saveError || "保存失败"}
                    onClick={() => {
                      if (adapter && activeNote) void persistNote(activeNote, adapter);
                    }}
                  >
                    <span className="save-error-dot" />
                    {saveState === "conflict" ? "冲突已隔离" : "保存失败"}
                  </button>
                ) : (
                  <>
                    <Check size={13} />
                    已保存到云端
                  </>
                )}
              </div>
              <div className="view-switcher" aria-label="视图模式">
                <button
                  className={viewMode === "source" ? "is-active" : ""}
                  type="button"
                  onClick={() => setViewMode("source")}
                  title="源码模式"
                >
                  <Code2 size={15} />
                </button>
                <button
                  className={viewMode === "split" ? "is-active" : ""}
                  type="button"
                  onClick={() => setViewMode("split")}
                  title="分栏模式"
                >
                  <Columns2 size={15} />
                </button>
                <button
                  className={viewMode === "read" ? "is-active" : ""}
                  type="button"
                  onClick={() => setViewMode("read")}
                  title="阅读模式"
                >
                  <Eye size={15} />
                </button>
              </div>
              <button
                className="icon-button"
                type="button"
                onClick={toggleInspector}
                aria-label="切换信息栏"
              >
                <PanelRightClose size={17} />
              </button>
              <button
                className="icon-button"
                type="button"
                aria-label="移动或重命名文档路径"
                title="移动或重命名文档路径"
                onClick={openMoveDialog}
              >
                <FolderInput size={17} />
              </button>
              <div className="document-menu" ref={documentMenuRef}>
                <button
                  className="icon-button"
                  type="button"
                  aria-label="更多操作"
                  aria-haspopup="menu"
                  aria-expanded={documentMenuOpen}
                  onClick={() => setDocumentMenuOpen((value) => !value)}
                >
                  <MoreHorizontal size={18} />
                </button>
                {documentMenuOpen && (
                  <div className="document-menu-popover" role="menu">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setDocumentMenuOpen(false);
                        openMoveDialog();
                      }}
                    >
                      <FolderInput size={15} />
                      移动或重命名路径
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setDocumentMenuOpen(false);
                        openTagDialog();
                      }}
                    >
                      <Tag size={15} />
                      管理标签
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setDocumentMenuOpen(false);
                        exportMarkdown();
                      }}
                    >
                      <Download size={15} />
                      导出 Markdown
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setDocumentMenuOpen(false);
                        importRef.current?.click();
                      }}
                    >
                      <Upload size={15} />
                      导入 Markdown
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setDocumentMenuOpen(false);
                        void importFolder();
                      }}
                    >
                      <FolderOpen size={15} />
                      导入文件夹
                    </button>
                    <button
                      className="is-danger"
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setDocumentMenuOpen(false);
                        setDialogError("");
                        setDialog("delete");
                      }}
                    >
                      <Trash2 size={15} />
                      删除文档
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="document-scroll">
            <article className="document-paper">
              <header className="document-header">
                <div className="document-meta">
                  <span>{activeNote.folder}</span>
                  <span>更新于 {formatTime(activeNote.updatedAt)}</span>
                  <span>{countWords(activeNote.content).toLocaleString("zh-CN")} 字</span>
                </div>
                <input
                  className="document-title"
                  value={activeNote.title}
                  onChange={(event) => updateTitle(event.target.value)}
                  onBlur={() => {
                    const title = activeNote.title.trim() || "未命名文档";
                    if (title !== activeNote.title) updateTitle(title);
                  }}
                  maxLength={200}
                  aria-label="文档标题"
                />
                <div className="tag-line">
                  {activeNote.tags.map((tag) => (
                    <span className="tag-pill" key={tag}>
                      <Tag size={12} />
                      {tag}
                    </span>
                  ))}
                  <button type="button" onClick={openTagDialog}>
                    <CirclePlus size={12} />
                    {activeNote.tags.length > 0 ? "管理标签" : "添加标签"}
                  </button>
                </div>
              </header>

              <div className="editor-toolbar" role="toolbar" aria-label="Markdown 编辑工具">
                <button type="button" onClick={() => insertAtCursor("**", "**", "重点文字")} title="加粗">
                  <Bold size={15} />
                </button>
                <button type="button" onClick={() => insertAtCursor("_", "_", "强调文字")} title="斜体">
                  <Italic size={15} />
                </button>
                <button type="button" onClick={() => insertAtCursor("## ", "", "二级标题")} title="标题">
                  <Heading2 size={15} />
                </button>
                <button type="button" onClick={() => insertAtCursor("- ", "", "列表项")} title="列表">
                  <List size={15} />
                </button>
                <button type="button" onClick={() => insertAtCursor("[", "](https://)", "链接文字")} title="链接">
                  <Link2 size={15} />
                </button>
                <span className="toolbar-separator" />
                <button className="toolbar-with-label" type="button" onClick={insertMermaid}>
                  <Network size={15} /> Mermaid
                </button>
                <button className="toolbar-with-label" type="button" onClick={insertCanvas}>
                  <ImagePlus size={15} /> 画布
                </button>
                <span className="toolbar-spacer" />
                <span className="autosave-note">
                  <span className="shortcut-dot" /> Markdown 自动保存
                </span>
              </div>

              <div className={`editor-surface mode-${viewMode}`}>
                {viewMode !== "read" && (
                  <section className="source-pane">
                    <div className="pane-caption">
                      <span>Markdown</span>
                      <span>UTF-8</span>
                    </div>
                    <textarea
                      ref={textareaRef}
                      className="markdown-source"
                      value={activeNote.content}
                      onChange={(event) => updateActiveNote({ content: event.target.value })}
                      spellCheck={false}
                      aria-label="Markdown 源码"
                    />
                  </section>
                )}
                {viewMode !== "source" && (
                  <section className="preview-pane">
                    <div className="pane-caption">
                      <span>预览</span>
                      <span className="preview-live">
                        <span /> LIVE
                      </span>
                    </div>
                    <div
                      ref={previewRef}
                      className="markdown-preview"
                      onClick={handlePreviewClick}
                      dangerouslySetInnerHTML={{ __html: previewHtml }}
                    />
                  </section>
                )}
              </div>

              <footer className="document-footer">
                <span>
                  <HardDrive size={13} /> {activeNote.filePath}
                </span>
                <span>Markdown · UTF-8</span>
                <span>{countWords(activeNote.content).toLocaleString("zh-CN")} 字</span>
              </footer>
            </article>
          </div>
        </main>

        {inspectorOpen && (
          <button
            className="drawer-scrim is-inspector"
            type="button"
            aria-label="关闭信息栏"
            onClick={() => setInspectorOpen(false)}
          />
        )}

        <aside className={`inspector ${inspectorOpen ? "" : "is-collapsed"}`}>
          <div className="inspector-head">
            <strong>文档信息</strong>
            <button
              className="icon-button"
              type="button"
              aria-label="关闭信息栏"
              onClick={() => setInspectorOpen(false)}
            >
              <X size={16} />
            </button>
          </div>

          <section className="inspector-section">
            <div className="inspector-title">
              <BookOpen size={15} />
              大纲
            </div>
            <nav className="outline-list">
              {outline.map((item, index) => (
                <button
                  key={`${item.id}-${index}`}
                  type="button"
                  className={`depth-${item.depth}`}
                  onClick={() =>
                    previewRef.current
                      ?.querySelector(`#${CSS.escape(item.id)}`)
                      ?.scrollIntoView({ behavior: "smooth", block: "start" })
                  }
                >
                  {item.text}
                </button>
              ))}
            </nav>
          </section>

          <section className="inspector-section">
            <div className="inspector-title">
              <GitBranch size={15} />
              反向链接
              <span className="count-badge">{backlinks.length}</span>
            </div>
            {backlinks.length > 0 ? (
              <div className="backlink-list">
                {backlinks.map((note) => (
                  <button type="button" key={note.id} onClick={() => selectNote(note.id)}>
                    <span>{note.title}</span>
                    <ArrowUpRight size={13} />
                  </button>
                ))}
              </div>
            ) : (
              <p className="empty-note">暂时没有其他文档引用此页。</p>
            )}
          </section>

          <section className="inspector-section">
            <div className="inspector-title">
              <ImagePlus size={15} />
              图表资产
            </div>
            <div className="asset-list">
              <button type="button" onClick={openCanvas}>
                <span className="asset-icon canvas-asset">
                  <ImagePlus size={15} />
                </span>
                <span>
                  <strong>{activeNote.canvas?.title ?? "自由画布"}</strong>
                  <small>{activeNote.canvas?.elements.length ?? 0} 个图元 · 可编辑</small>
                </span>
              </button>
              <div className="asset-row">
                <span className="asset-icon mermaid-asset">
                  <Network size={15} />
                </span>
                <span>
                  <strong>Mermaid 文本图</strong>
                  <small>内嵌在 Markdown</small>
                </span>
              </div>
            </div>
          </section>

          <section className="inspector-section">
            <div className="inspector-title">
              <History size={15} />
              最近版本
            </div>
            <div className="version-list">
              <button type="button">
                <span className="version-dot is-current" />
                <span>
                  <strong>当前版本</strong>
                  <small>
                    revision {activeNote.revision} · {formatTime(activeNote.updatedAt)}
                  </small>
                </span>
              </button>
              {revisions.slice(0, 3).map((revision) => (
                <button
                  type="button"
                  key={revision.revisionId}
                  onClick={() => requestRestoreVersion(revision)}
                  title="恢复为这个历史版本"
                >
                  <span className="version-dot" />
                  <span>
                    <strong>revision {revision.meta.revision}</strong>
                    <small>{formatTime(revision.recordedAt)} · 点击恢复</small>
                  </span>
                </button>
              ))}
              {revisions.length === 0 && (
                <p className="empty-note">首次修改后会在这里生成历史版本。</p>
              )}
            </div>
          </section>
        </aside>
      </div>

      {canvasOpen && (
        <CanvasEditor
          scene={activeNote.canvas}
          onCancel={() => setCanvasOpen(false)}
          onSave={saveCanvas}
        />
      )}

      <Dialog
        open={dialog === "workspace"}
        title="工作区"
        description="每个工作区拥有独立的云端文档，切换前会先保存当前修改。"
        onClose={closeDialog}
        footer={
          <>
            <button
              className="dialog-button secondary"
              type="button"
              onClick={openWorkspaceRename}
            >
              <Pencil size={15} />
              重命名当前工作区
            </button>
            <button
              className="dialog-button primary"
              type="button"
              onClick={() => {
                setWorkspaceNameDraft("");
                setDialogError("");
                setDialog("workspace-create");
              }}
            >
              <FolderPlus size={15} />
              新建工作区
            </button>
          </>
        }
      >
        {dialogError && <p className="dialog-error">{dialogError}</p>}
        <div className="workspace-list">
          {workspaces.map((item) => (
            <button
              type="button"
              key={item.id}
              className={item.id === workspace?.id ? "is-current" : ""}
              aria-pressed={item.id === workspace?.id}
              disabled={dialogBusy}
              onClick={() => void switchWorkspace(item)}
            >
              <span className="workspace-list-icon">
                <Cloud size={17} />
              </span>
              <span>
                <strong>{item.name}</strong>
                <small>
                  {item.id === workspace?.id ? "当前工作区" : "切换到此工作区"}
                </small>
              </span>
              {item.id === workspace?.id && <Check size={17} />}
            </button>
          ))}
        </div>
      </Dialog>

      <Dialog
        open={dialog === "workspace-create"}
        title="新建工作区"
        description="适合按项目、主题或客户隔离文档。"
        onClose={closeDialog}
        footer={
          <>
            <button
              className="dialog-button secondary"
              type="button"
              onClick={() => setDialog("workspace")}
              disabled={dialogBusy}
            >
              返回
            </button>
            <button
              className="dialog-button primary"
              type="submit"
              form="workspace-create-form"
              disabled={dialogBusy}
            >
              {dialogBusy ? "正在创建…" : "创建并切换"}
            </button>
          </>
        }
      >
        <form
          id="workspace-create-form"
          className="dialog-form"
          onSubmit={(event) => {
            event.preventDefault();
            void createWorkspace();
          }}
        >
          <label className="dialog-field">
            <span>工作区名称</span>
            <input
              value={workspaceNameDraft}
              onChange={(event) => setWorkspaceNameDraft(event.target.value)}
              maxLength={80}
              placeholder="例如：客户项目"
              autoFocus
            />
          </label>
          {dialogError && <p className="dialog-error">{dialogError}</p>}
        </form>
      </Dialog>

      <Dialog
        open={dialog === "workspace-rename"}
        title="重命名工作区"
        onClose={closeDialog}
        footer={
          <>
            <button
              className="dialog-button secondary"
              type="button"
              onClick={() => setDialog("workspace")}
              disabled={dialogBusy}
            >
              取消
            </button>
            <button
              className="dialog-button primary"
              type="submit"
              form="workspace-rename-form"
              disabled={dialogBusy}
            >
              {dialogBusy ? "正在保存…" : "保存名称"}
            </button>
          </>
        }
      >
        <form
          id="workspace-rename-form"
          className="dialog-form"
          onSubmit={(event) => {
            event.preventDefault();
            void renameWorkspace();
          }}
        >
          <label className="dialog-field">
            <span>工作区名称</span>
            <input
              value={workspaceNameDraft}
              onChange={(event) => setWorkspaceNameDraft(event.target.value)}
              maxLength={80}
              autoFocus
            />
          </label>
          {dialogError && <p className="dialog-error">{dialogError}</p>}
        </form>
      </Dialog>

      <Dialog
        open={dialog === "settings"}
        title="账号与工作区"
        description="当前账号的云端存储和会话信息。"
        onClose={closeDialog}
        footer={
          <>
            <button
              className="dialog-button danger-quiet"
              type="button"
              onClick={() => setDialog("logout")}
            >
              <LogOut size={15} />
              退出登录
            </button>
            <button
              className="dialog-button primary"
              type="button"
              onClick={closeDialog}
            >
              完成
            </button>
          </>
        }
      >
        <div className="settings-profile">
          <span className="settings-avatar" aria-hidden="true">
            {user.displayName.slice(0, 1)}
          </span>
          <span>
            <strong>{user.displayName}</strong>
            <small>{user.email}</small>
          </span>
        </div>
        <div className="settings-list">
          <button type="button" onClick={openWorkspaceDialog}>
            <Cloud size={17} />
            <span>
              <strong>{workspace?.name ?? "我的工作区"}</strong>
              <small>{workspaces.length} 个工作区 · 切换或新建</small>
            </span>
            <ChevronRight size={16} />
          </button>
          <div className="settings-row">
            <HardDrive size={17} />
            <span>
              <strong>云端持久化</strong>
              <small>文档、标签、画布和版本保存在服务端 SQLite</small>
            </span>
            <Check size={16} />
          </div>
          <button type="button" onClick={openWorkspaceRename}>
            <Pencil size={17} />
            <span>
              <strong>重命名工作区</strong>
              <small>只改变显示名称，不影响文档内容</small>
            </span>
            <ChevronRight size={16} />
          </button>
        </div>
      </Dialog>

      <Dialog
        open={dialog === "move"}
        title="移动或重命名文档"
        description="使用工作区内相对路径；文件夹和文件名会自动创建。"
        onClose={closeDialog}
        footer={
          <>
            <button
              className="dialog-button secondary"
              type="button"
              onClick={closeDialog}
              disabled={dialogBusy}
            >
              取消
            </button>
            <button
              className="dialog-button primary"
              type="submit"
              form="move-document-form"
              disabled={dialogBusy}
            >
              {dialogBusy ? "正在移动…" : "保存路径"}
            </button>
          </>
        }
      >
        <form
          id="move-document-form"
          className="dialog-form"
          onSubmit={(event) => {
            event.preventDefault();
            void moveActiveNote();
          }}
        >
          <label className="dialog-field">
            <span>工作区路径</span>
            <input
              value={movePathDraft}
              onChange={(event) => setMovePathDraft(event.target.value)}
              placeholder="目录/文档.md"
              spellCheck={false}
              autoFocus
            />
          </label>
          <p className="dialog-hint">
            当前路径：{activeNote.filePath}
          </p>
          {dialogError && <p className="dialog-error">{dialogError}</p>}
        </form>
      </Dialog>

      <Dialog
        open={dialog === "tags"}
        title="管理标签"
        description="标签会随文档保存在云端，并可用于左侧搜索。"
        onClose={closeDialog}
        footer={
          <button
            className="dialog-button primary"
            type="button"
            onClick={closeDialog}
          >
            完成
          </button>
        }
      >
        <div className="tag-editor">
          <div className="tag-editor-list">
            {activeNote.tags.length === 0 && (
              <p className="dialog-hint">还没有标签。</p>
            )}
            {activeNote.tags.map((tag) => (
              <span key={tag} className="tag-editor-chip">
                {tag}
                <button
                  type="button"
                  aria-label={`移除标签 ${tag}`}
                  onClick={() => removeTag(tag)}
                >
                  <X size={13} />
                </button>
              </span>
            ))}
          </div>
          <form
            className="tag-editor-form"
            onSubmit={(event) => {
              event.preventDefault();
              addTag();
            }}
          >
            <label className="dialog-field">
              <span>新标签</span>
              <input
                value={tagDraft}
                onChange={(event) => setTagDraft(event.target.value)}
                maxLength={30}
                placeholder="输入标签后按 Enter"
                autoFocus
              />
            </label>
            <button className="dialog-button secondary" type="submit">
              <CirclePlus size={15} />
              添加
            </button>
          </form>
          {dialogError && <p className="dialog-error">{dialogError}</p>}
        </div>
      </Dialog>

      <Dialog
        open={dialog === "delete"}
        title="删除这篇文档？"
        onClose={closeDialog}
        footer={
          <>
            <button
              className="dialog-button secondary"
              type="button"
              onClick={() => setDialog(null)}
              disabled={dialogBusy}
            >
              保留文档
            </button>
            <button
              className="dialog-button danger"
              type="button"
              onClick={() => void deleteActiveNote()}
              disabled={dialogBusy}
            >
              <Trash2 size={15} />
              {dialogBusy ? "正在删除…" : "确认删除"}
            </button>
          </>
        }
      >
        <p className="dialog-copy">
          “{activeNote.title}”会从当前云端工作区移除。删除前请确认已经导出仍需保留的内容。
        </p>
        {dialogError && <p className="dialog-error">{dialogError}</p>}
      </Dialog>

      <Dialog
        open={dialog === "restore"}
        title={`恢复 revision ${pendingRestore?.meta.revision ?? ""}`}
        onClose={closeDialog}
        footer={
          <>
            <button
              className="dialog-button secondary"
              type="button"
              onClick={closeDialog}
              disabled={dialogBusy}
            >
              取消
            </button>
            <button
              className="dialog-button primary"
              type="button"
              onClick={() => void restoreVersion()}
              disabled={dialogBusy}
            >
              {dialogBusy ? "正在恢复…" : "恢复此版本"}
            </button>
          </>
        }
      >
        <p className="dialog-copy">
          当前内容会先进入历史记录，然后生成一个新的 revision。可以在信息栏继续恢复较新的版本。
        </p>
        {dialogError && <p className="dialog-error">{dialogError}</p>}
      </Dialog>

      <Dialog
        open={dialog === "logout"}
        title="退出当前账号？"
        onClose={closeDialog}
        footer={
          <>
            <button
              className="dialog-button secondary"
              type="button"
              onClick={() => setDialog("settings")}
              disabled={dialogBusy}
            >
              返回设置
            </button>
            <button
              className="dialog-button danger"
              type="button"
              onClick={() => void logout()}
              disabled={dialogBusy}
            >
              <LogOut size={15} />
              {dialogBusy ? "正在退出…" : "退出登录"}
            </button>
          </>
        }
      >
        <p className="dialog-copy">
          未保存的修改会先保留在本机草稿中；下次登录同一浏览器时可继续恢复。
        </p>
        {dialogError && <p className="dialog-error">{dialogError}</p>}
      </Dialog>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

type DirectoryHandle = {
  entries(): AsyncIterableIterator<[string, DirectoryEntry]>;
};

type DirectoryEntry =
  | {
      kind: "file";
      getFile(): Promise<File>;
    }
  | {
      kind: "directory";
      entries(): AsyncIterableIterator<[string, DirectoryEntry]>;
    };

function folderHierarchy(folder: string): string[] {
  const segments = folder.split("/").filter(Boolean);
  return segments.map((_, index) => segments.slice(0, index + 1).join("/"));
}

function nextAvailableTitle(
  baseTitle: string,
  folder: string,
  notes: readonly Note[]
): string {
  const existing = new Set(
    notes
      .filter((note) => note.folder === folder)
      .map((note) => note.title)
  );
  if (!existing.has(baseTitle)) return baseTitle;
  let index = 2;
  while (existing.has(`${baseTitle} ${index}`)) index += 1;
  return `${baseTitle} ${index}`;
}

function uniqueFilePath(
  folder: string,
  title: string,
  notes: readonly Note[]
): string {
  const safeFolder =
    folder
      .split("/")
      .map((segment) => segment.replace(/[\\:*?"<>|]/g, "-").trim())
      .filter(Boolean)
      .join("/") || "个人";
  const safeTitle = title.replace(/[\\/:*?"<>|]/g, "-").trim() || "未命名文档";
  const existing = new Set(notes.map((note) => note.filePath));
  let path = `${safeFolder}/${safeTitle}.md`;
  let index = 2;
  while (existing.has(path)) {
    path = `${safeFolder}/${safeTitle} ${index}.md`;
    index += 1;
  }
  return path;
}

export default WorkspaceApp;
