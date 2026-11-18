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
  Code2,
  Columns2,
  Download,
  Eye,
  FileText,
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
  Menu,
  MoreHorizontal,
  Network,
  PanelLeftClose,
  PanelRightClose,
  Search,
  Settings,
  SquarePen,
  Tag,
  Upload,
  X
} from "lucide-react";
import {
  clearDraft,
  cloudClient,
  ensureCloudWorkspace,
  loadCloudWorkspace,
  persistActiveWorkspace,
  saveDraft,
  snapshotToNote
} from "./cloud-workspace";
import { folderOrder, type Note } from "./data";

type ViewMode = MarkdownViewMode;
type SaveState = "loading" | "saved" | "saving" | "error" | "conflict";

type SavedNoteShape = {
  title: string;
  content: string;
  tags: string[];
  canvas?: CanvasScene;
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
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [canvasOpen, setCanvasOpen] = useState(false);
  const [toast, setToast] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const lastSavedRef = useRef(new Map<string, SavedNoteShape>());
  const savingRef = useRef(false);
  const conflictLockedRef = useRef(false);
  const saveTimerRef = useRef<number | undefined>(undefined);

  const activeNote = notes.find((note) => note.id === activeId) ?? notes[0];
  const visibleFolders = useMemo(
    () => [...new Set([...folderOrder, ...notes.map((note) => note.folder)])],
    [notes]
  );
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
        const nextWorkspace = await ensureCloudWorkspace();
        if (cancelled) return;
        const nextAdapter = cloudClient.workspace(nextWorkspace.id as WorkspaceId);
        const loaded = await loadCloudWorkspace(nextAdapter, nextWorkspace);
        if (cancelled) return;
        lastSavedRef.current = new Map(
          loaded.notes.map((note) => [note.id, noteShape(note)])
        );
        setWorkspace(nextWorkspace);
        setAdapter(nextAdapter);
        setNotes(loaded.notes);
        setActiveId(loaded.activeId);
        setWorkspaceLoading(false);
        setSaveState("saved");
        if (loaded.recoveredDraft) {
          showToast("已恢复上次未成功保存到云端的本地草稿");
        }
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
    if (!adapter || !activeNote || workspaceLoading || savingRef.current) return;
    if (conflictLockedRef.current) return;
    const saved = lastSavedRef.current.get(activeNote.id);
    if (!saved || noteShapesEqual(saved, noteShape(activeNote))) {
      return;
    }
    saveDraft(activeNote);
    setSaveState("saving");
    setSaveError("");
    saveTimerRef.current = window.setTimeout(() => {
      void persistNote(activeNote, adapter);
    }, 550);
    return () => {
      if (saveTimerRef.current !== undefined) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [activeNote, adapter, workspaceLoading]);

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

  async function persistNote(
    note: Note,
    targetAdapter: CloudWorkspaceAdapter
  ): Promise<void> {
    if (savingRef.current) return;
    const savedShape = lastSavedRef.current.get(note.id);
    if (savedShape && noteShapesEqual(savedShape, noteShape(note))) {
      clearDraft(note.id);
      setSaveState("saved");
      return;
    }
    if (saveTimerRef.current !== undefined) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = undefined;
    }
    savingRef.current = true;
    const sentShape = noteShape(note);
    saveDraft(note);
    setSaveState("saving");
    setSaveError("");
    try {
      const saved = await targetAdapter.writeDocument({
        documentId: note.id,
        baseRevision: note.revision,
        markdown: note.content,
        title: note.title,
        tags: note.tags,
        extensions: note.canvas
          ? { canvas: note.canvas as unknown as JsonValue }
          : undefined
      });
      const savedNote = snapshotToNote(saved);
      lastSavedRef.current.set(
        savedNote.id,
        noteShape(savedNote)
      );
      clearDraft(savedNote.id);
      setNotes((current) =>
        current.map((item) => {
          if (item.id !== savedNote.id) return item;
          return noteShapesEqual(sentShape, noteShape(item))
            ? savedNote
            : {
                ...item,
                revision: savedNote.revision,
                updatedAt: savedNote.updatedAt
              };
        })
      );
      setSaveState("saved");
    } catch (error) {
      saveDraft(note);
      if (error instanceof RevisionConflictError) {
        conflictLockedRef.current = true;
        setSaveState("conflict");
        setSaveError("云端已有更新，本地内容已保留为冲突副本。");
        try {
          await preserveConflictCopy(note, targetAdapter);
        } catch {
          setSaveError("保存冲突。请保留此页面并刷新后处理，云端内容不会被覆盖。");
        }
      } else {
        setSaveState("error");
        setSaveError(
          error instanceof Error
            ? `保存失败：${error.message}`
            : "保存失败，本地草稿已保留。"
        );
      }
    } finally {
      savingRef.current = false;
    }
  }

  async function preserveConflictCopy(
    localNote: Note,
    targetAdapter: CloudWorkspaceAdapter
  ): Promise<void> {
    const serverSnapshot = await targetAdapter.readDocument(localNote.id);
    const copyTitle = nextAvailableTitle(
      `${localNote.title}（本地冲突副本）`,
      localNote.folder,
      notes
    );
    const copyPath = uniqueFilePath(localNote.folder, copyTitle, notes);
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
    clearDraft(localNote.id);
    clearDraft(copyNote.id);
    setNotes((current) =>
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
    setNotes((current) => [...current, note]);
    setActiveId(note.id);
    setSaveState("saved");
    return note;
  }

  function updateActiveNote(patch: Partial<Note>) {
    if (!activeNote) return;
    setNotes((current) =>
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
    setExpandedFolders((current) => new Set([...current, folder]));
    window.setTimeout(() => {
      const titleInput = document.querySelector<HTMLInputElement>(".document-title");
      titleInput?.focus();
      titleInput?.select();
    }, 30);
  }

  async function deleteActiveNote() {
    if (!activeNote || !adapter) return;
    if (!window.confirm(`删除“${activeNote.title}”？该操作会从云端工作区删除文档。`)) {
      return;
    }
    setSaveState("saving");
    try {
      await adapter.deleteNode({
        nodeId: activeNote.id,
        baseRevision: activeNote.revision
      });
      clearDraft(activeNote.id);
      lastSavedRef.current.delete(activeNote.id);
      const remaining = notes.filter((note) => note.id !== activeNote.id);
      setNotes(remaining);
      setActiveId(remaining[0]?.id ?? "");
      setSaveState("saved");
      if (remaining.length === 0) await createServerNote();
      showToast("文档已删除");
    } catch (error) {
      setSaveState("error");
      setSaveError(error instanceof Error ? error.message : "删除失败。");
    }
  }

  function insertAtCursor(before: string, after = "", placeholder = "文字") {
    const textarea = textareaRef.current;
    if (!textarea || !activeNote) return;
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
              folder: prefix.split("/")[0] || "个人"
            });
          }
          if (entry.kind === "directory" && prefix.split("/").length < 2) {
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
              new Set([...current, ...imported.map((note) => note.folder)])
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
    const baseTitle = fileName.replace(/\.md$/i, "");
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
    setNotes((current) => [...current, note]);
    return note;
  }

  async function moveActiveNote() {
    if (!activeNote || !adapter) return;
    const targetPath = window.prompt("输入新的工作区路径", activeNote.filePath);
    if (!targetPath || targetPath === activeNote.filePath) return;
    setSaveState("saving");
    try {
      const moved = await adapter.moveNode({
        nodeId: activeNote.id,
        targetPath: workspacePath(targetPath),
        baseRevision: activeNote.revision
      });
      const folder = targetPath.split("/")[0] || "个人";
      lastSavedRef.current.set(activeNote.id, noteShape(activeNote));
      setNotes((current) =>
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
      setExpandedFolders((current) => new Set([...current, folder]));
      setSaveState("saved");
      showToast("文档路径已更新");
    } catch (error) {
      setSaveState("error");
      setSaveError(error instanceof Error ? error.message : "移动文档失败。");
    }
  }

  async function restoreVersion(revision: CloudDocumentRevision) {
    if (!activeNote || !adapter) return;
    if (!window.confirm(`恢复 revision ${revision.meta.revision}？当前内容会先保存为历史版本。`)) {
      return;
    }
    setSaveState("saving");
    try {
      const restored = await cloudClient.restoreRevision(
        adapter.workspaceId,
        activeNote.id,
        revision.revisionId,
        activeNote.revision
      );
      const restoredNote = snapshotToNote(restored);
      lastSavedRef.current.set(restoredNote.id, noteShape(restoredNote));
      clearDraft(restoredNote.id);
      setNotes((current) =>
        current.map((note) => (note.id === restoredNote.id ? restoredNote : note))
      );
      setSaveState("saved");
      showToast("历史版本已恢复并保存为新 revision");
    } catch (error) {
      setSaveState("error");
      setSaveError(error instanceof Error ? error.message : "恢复历史版本失败。");
    }
  }

  async function logout() {
    if (!window.confirm("退出当前账号？")) return;
    try {
      await onLogout();
    } catch {
      showToast("退出失败，请稍后重试");
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
        <span className="brand-mark" aria-hidden="true">
          <span>墨</span>
        </span>
        <p>正在载入云端文档…</p>
      </main>
    );
  }

  if (workspaceError) {
    return (
      <main className="workspace-load-error">
        <span className="brand-mark" aria-hidden="true">
          <span>墨</span>
        </span>
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
        <span className="brand-mark" aria-hidden="true">
          <span>墨</span>
        </span>
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
            onClick={() => setSidebarOpen((value) => !value)}
            aria-label="打开文件栏"
          >
            <Menu size={18} />
          </button>
          <div className="brand-mark" aria-hidden="true">
            <span>墨</span>
          </div>
          <div className="brand-copy">
            <strong>墨织</strong>
            <span>InkLoom · Markdown workspace</span>
          </div>
        </div>

        <div className="workspace-switcher">
          <span className="workspace-kicker">工作区</span>
          <span className="workspace-title">
            {workspace?.name ?? "我的工作区"}
          </span>
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
            title={`${user.displayName} · 退出登录`}
            aria-label="退出登录"
            onClick={() => void logout()}
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

      <div className="main-grid">
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

          <label className="search-box">
            <Search size={15} />
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索标题、正文或标签"
            />
            <kbd>⌘ K</kbd>
          </label>

          <div className="file-tree">
            {visibleFolders.map((folder) => {
              const folderNotes = filteredNotes.filter((note) => note.folder === folder);
              const expanded = expandedFolders.has(folder);
              if (query && folderNotes.length === 0) return null;
              return (
                <section className="tree-folder" key={folder}>
                  <button
                    className="folder-row"
                    type="button"
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
                    <span>{folder}</span>
                    <em>{folderNotes.length}</em>
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
                  showToast("最近版本显示在右侧信息栏");
                }}
              >
                <History size={15} /> 版本历史
              </button>
              <button
                type="button"
                onClick={() =>
                  window.alert(
                    `账号：${user.email}\n工作区：${workspace?.name ?? "我的工作区"}\n存储：云端 SQLite`
                  )
                }
              >
                <Settings size={15} /> 工作区设置
              </button>
            </div>
          </div>
        </aside>

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
                onClick={() => setInspectorOpen((value) => !value)}
                aria-label="切换信息栏"
              >
                <PanelRightClose size={17} />
              </button>
              <button
                className="icon-button"
                type="button"
                aria-label="移动或重命名文档路径"
                title="移动或重命名文档路径"
                onClick={() => void moveActiveNote()}
              >
                <FolderInput size={17} />
              </button>
              <button className="icon-button" type="button" aria-label="更多操作" onClick={deleteActiveNote}>
                <MoreHorizontal size={18} />
              </button>
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
                  aria-label="文档标题"
                />
                <div className="tag-line">
                  {activeNote.tags.map((tag) => (
                    <span className="tag-pill" key={tag}>
                      <Tag size={12} />
                      {tag}
                    </span>
                  ))}
                  <button type="button" onClick={() => {
                    const tag = window.prompt("添加标签");
                    if (tag?.trim()) {
                      updateActiveNote({ tags: [...new Set([...activeNote.tags, tag.trim()])] });
                    }
                  }}>
                    <CirclePlus size={12} /> 标签
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
                      <span>MARKDOWN</span>
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
                      <span>PREVIEW</span>
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

        <aside className={`inspector ${inspectorOpen ? "" : "is-collapsed"}`}>
          <div className="inspector-head">
            <strong>文档信息</strong>
            <button className="icon-button" type="button" onClick={() => setInspectorOpen(false)}>
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
                  onClick={() => void restoreVersion(revision)}
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
  const safeFolder = folder.replaceAll("/", "-").trim() || "个人";
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
