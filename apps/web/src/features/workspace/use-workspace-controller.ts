import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  RevisionConflictError,
  workspacePath,
  type JsonValue,
  type WorkspaceId
} from "@inkloom/core";
import type {
  CloudDocumentRevision,
  CloudWorkspace,
  CloudWorkspaceAdapter
} from "@inkloom/storage";
import type { CanvasScene } from "@inkloom/diagrams";
import {
  clearDraft,
  cloudClient,
  loadCloudWorkspace,
  persistActiveWorkspace,
  saveDraft,
  snapshotToNote
} from "../../cloud-workspace";
import type { Note } from "../../data";
import { useToastStore } from "../../stores/toast-store";
import {
  folderHierarchy,
  nextAvailableTitle,
  noteShape,
  noteShapesEqual,
  uniqueFilePath,
  type NoteShape
} from "./note-utils";

export type SaveState = "loading" | "saved" | "saving" | "error" | "conflict";

type PendingSave = {
  noteId: string;
  adapter: CloudWorkspaceAdapter;
};

type CachedWorkspace = Awaited<ReturnType<typeof loadCloudWorkspace>>;

export function useWorkspaceController({
  workspace,
  documentId,
  selectDocument
}: {
  workspace: CloudWorkspace;
  documentId?: string;
  selectDocument: (documentId: string) => void;
}) {
  const queryClient = useQueryClient();
  const showToast = useToastStore((state) => state.show);
  const adapter = useMemo(
    () => cloudClient.workspace(workspace.id as WorkspaceId),
    [workspace.id]
  );
  const workspaceQuery = useQuery({
    queryKey: ["workspace-documents", workspace.id],
    queryFn: () => loadCloudWorkspace(adapter, workspace),
    staleTime: Number.POSITIVE_INFINITY,
    retry: 1
  });
  const [notes, setNotes] = useState<Note[]>([]);
  const [saveState, setSaveState] = useState<SaveState>("loading");
  const [saveError, setSaveError] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(["个人", "工作", "学习", "项目"])
  );
  const notesRef = useRef<Note[]>([]);
  const lastSavedRef = useRef(new Map<string, NoteShape>());
  const revisionRef = useRef(new Map<string, number>());
  const pendingSavesRef = useRef(new Map<string, PendingSave>());
  const saveDrainRef = useRef<Promise<void>>(Promise.resolve());
  const drainingRef = useRef(false);
  const saveTimerRef = useRef<number | undefined>(undefined);
  const conflictLockedRef = useRef(false);
  const initializedWorkspaceRef = useRef("");

  const activeNote =
    notes.find((note) => note.id === documentId) ?? notes[0];
  const revisionsQuery = useQuery({
    queryKey: [
      "revisions",
      workspace.id,
      activeNote?.id,
      activeNote?.revision
    ],
    queryFn: () =>
      cloudClient.listRevisions(
        workspace.id as WorkspaceId,
        activeNote!.id
      ),
    enabled: Boolean(activeNote),
    staleTime: 10_000
  });

  useEffect(() => {
    const loaded = workspaceQuery.data;
    if (!loaded) return;
    if (initializedWorkspaceRef.current === workspace.id) return;
    initializedWorkspaceRef.current = workspace.id;
    notesRef.current = loaded.notes;
    lastSavedRef.current = new Map(
      loaded.notes.map((note) => [note.id, noteShape(note)])
    );
    revisionRef.current = new Map(
      loaded.notes.map((note) => [note.id, note.revision])
    );
    pendingSavesRef.current.clear();
    conflictLockedRef.current = false;
    setNotes(loaded.notes);
    setExpandedFolders(
      new Set([
        "个人",
        "工作",
        "学习",
        "项目",
        ...loaded.notes.flatMap((note) => folderHierarchy(note.folder))
      ])
    );
    setSaveState("saved");
    setSaveError("");
    if (loaded.recoveredDraft) {
      showToast("已恢复上次未成功保存到云端的本地草稿");
    }
  }, [workspaceQuery.data, showToast]);

  useEffect(() => {
    if (!activeNote) return;
    const saved = lastSavedRef.current.get(activeNote.id);
    if (saved && noteShapesEqual(saved, noteShape(activeNote))) return;
    const timer = window.setTimeout(() => {
      saveDraft(activeNote);
      void queueSave(activeNote.id, adapter);
    }, 550);
    return () => window.clearTimeout(timer);
  }, [activeNote?.title, activeNote?.tags, activeNote?.canvas, adapter]);

  useEffect(() => {
    if (activeNote) {
      persistActiveWorkspace(workspace.id as WorkspaceId, activeNote.id);
    }
  }, [activeNote?.id, workspace.id]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      const current = notesRef.current.find((note) => note.id === activeNote?.id);
      if (!current) return;
      const saved = lastSavedRef.current.get(current.id);
      if (saved && noteShapesEqual(saved, noteShape(current))) return;
      saveDraft(current);
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [activeNote?.id]);

  useEffect(
    () => () => {
      if (saveTimerRef.current !== undefined) {
        window.clearTimeout(saveTimerRef.current);
      }
    },
    []
  );

  function replaceNotes(updater: (current: Note[]) => Note[]) {
    const next = updater(notesRef.current);
    notesRef.current = next;
    cacheNotes(next);
    setNotes(next);
  }

  function cacheNotes(next: Note[]) {
    queryClient.setQueryData<CachedWorkspace>(
      ["workspace-documents", workspace.id],
      (current) =>
        current
          ? {
              ...current,
              notes: next,
              activeId: activeNote?.id ?? current.activeId
            }
          : current
    );
  }

  function stageContent(documentIdValue: string, content: string) {
    const current = notesRef.current;
    const next = current.map((note) =>
      note.id === documentIdValue
        ? { ...note, content, updatedAt: new Date().toISOString() }
        : note
    );
    notesRef.current = next;
    cacheNotes(next);
    const latest = next.find((note) => note.id === documentIdValue);
    if (!latest) return;
    saveDraft(latest);
    setSaveState("saving");
    setSaveError("");
    if (saveTimerRef.current !== undefined) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      void queueSave(documentIdValue, adapter);
    }, 550);
  }

  function updateActiveNote(patch: Partial<Note>) {
    if (!activeNote) return;
    replaceNotes((current) =>
      current.map((note) =>
        note.id === activeNote.id
          ? { ...note, ...patch, updatedAt: new Date().toISOString() }
          : note
      )
    );
    setSaveState("saving");
    setSaveError("");
  }

  function updateTitle(title: string) {
    if (!activeNote) return;
    const current = notesRef.current.find((note) => note.id === activeNote.id);
    const content = current?.content.replace(/^# .+$/m, `# ${title}`) ?? "";
    updateActiveNote({ title, content });
  }

  function selectNote(id: string) {
    if (!activeNote || id === activeNote.id) return;
    const current = notesRef.current.find((note) => note.id === activeNote.id);
    if (current) {
      const saved = lastSavedRef.current.get(current.id);
      if (!saved || !noteShapesEqual(saved, noteShape(current))) {
        void queueSave(current.id, adapter);
      }
    }
    selectDocument(id);
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
    if (drainingRef.current) return;
    drainingRef.current = true;
    let failed = false;
    try {
      while (pendingSavesRef.current.size > 0) {
        const [noteId, pending] = pendingSavesRef.current.entries().next()
          .value as [string, PendingSave];
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
          const nextNotes = notesRef.current.map((item) => {
              if (item.id !== savedNote.id) return item;
              return noteShapesEqual(sentShape, noteShape(item))
                ? savedNote
                : {
                    ...item,
                    revision: savedNote.revision,
                    updatedAt: savedNote.updatedAt
                  };
            });
          notesRef.current = nextNotes;
          setNotes(nextNotes);
          cacheNotes(nextNotes);
          const current = notesRef.current.find((note) => note.id === noteId);
          if (current && noteShapesEqual(sentShape, noteShape(current))) {
            clearDraft(noteId);
          }
        } catch (error) {
          const localNote =
            notesRef.current.find((note) => note.id === noteId) ?? latest;
          saveDraft(localNote);
          if (error instanceof RevisionConflictError) {
            conflictLockedRef.current = true;
            setSaveState("conflict");
            setSaveError("云端已有更新，本地副本正在单独保存。");
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
      drainingRef.current = false;
    }
  }

  async function preserveConflictCopy(
    localNote: Note,
    targetAdapter: CloudWorkspaceAdapter
  ) {
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
    replaceNotes((current) =>
      current.flatMap((item) =>
        item.id === localNote.id ? [serverNote, copyNote] : [item]
      )
    );
    conflictLockedRef.current = false;
    setSaveError("");
    setSaveState("saved");
    showToast("云端版本与本地修改均已保留");
    selectDocument(copyNote.id);
  }

  async function createNote(folder = "个人"): Promise<Note> {
    const title = nextAvailableTitle("未命名文档", folder, notesRef.current);
    const snapshot = await adapter.createDocument({
      workspaceId: adapter.workspaceId,
      path: workspacePath(uniqueFilePath(folder, title, notesRef.current)),
      title,
      markdown: ""
    });
    const note = snapshotToNote(snapshot);
    lastSavedRef.current.set(note.id, noteShape(note));
    revisionRef.current.set(note.id, note.revision);
    replaceNotes((current) => [...current, note]);
    setExpandedFolders(
      (current) => new Set([...current, ...folderHierarchy(folder)])
    );
    setSaveState("saved");
    selectDocument(note.id);
    return note;
  }

  async function deleteActiveNote() {
    if (!activeNote) return;
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
    replaceNotes(() => remaining);
    setSaveState("saved");
    if (remaining.length === 0) {
      await createNote();
    } else {
      selectDocument(remaining[0].id);
    }
  }

  async function importOneMarkdown(
    fileName: string,
    text: string,
    folder: string,
    tags: string[]
  ): Promise<Note> {
    const heading = /^#\s+(.+)$/m.exec(text)?.[1]?.trim();
    const baseTitle = heading || fileName.replace(/\.md$/i, "");
    const title = nextAvailableTitle(baseTitle, folder, notesRef.current);
    const path = uniqueFilePath(folder, title, notesRef.current);
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
    replaceNotes((current) => [...current, note]);
    return note;
  }

  async function moveActiveNote(targetPath: string) {
    if (!activeNote) return;
    await queueSave(activeNote.id, adapter);
    await saveDrainRef.current;
    const moved = await adapter.moveNode({
      nodeId: activeNote.id,
      targetPath: workspacePath(targetPath),
      baseRevision:
        revisionRef.current.get(activeNote.id) ?? activeNote.revision
    });
    const folder = targetPath.split("/").slice(0, -1).join("/") || "个人";
    if (moved.kind === "document") {
      revisionRef.current.set(activeNote.id, moved.meta.revision);
    }
    replaceNotes((current) =>
      current.map((note) =>
        note.id === activeNote.id
          ? {
              ...note,
              filePath: moved.path,
              folder,
              revision:
                moved.kind === "document"
                  ? moved.meta.revision
                  : note.revision,
              updatedAt:
                moved.kind === "document"
                  ? moved.meta.updatedAt
                  : note.updatedAt
            }
          : note
      )
    );
    setExpandedFolders(
      (current) => new Set([...current, ...folderHierarchy(folder)])
    );
    setSaveState("saved");
  }

  async function restoreVersion(revision: CloudDocumentRevision) {
    if (!activeNote) return;
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
    replaceNotes((current) =>
      current.map((note) => (note.id === restoredNote.id ? restoredNote : note))
    );
    setSaveState("saved");
    void queryClient.invalidateQueries({
      queryKey: ["revisions", workspace.id, restoredNote.id]
    });
  }

  async function saveCanvas(canvas: CanvasScene) {
    if (!activeNote) return;
    updateActiveNote({ canvas });
  }

  return {
    adapter,
    notes,
    activeNote,
    revisions: revisionsQuery.data ?? [],
    workspaceQuery,
    saveState,
    saveError,
    expandedFolders,
    setExpandedFolders,
    stageContent,
    updateTitle,
    updateActiveNote,
    selectNote,
    createNote,
    deleteActiveNote,
    importOneMarkdown,
    moveActiveNote,
    restoreVersion,
    saveCanvas,
    saveNow: async () => {
      if (activeNote) await queueSave(activeNote.id, adapter);
      await saveDrainRef.current;
    },
    getActiveContent: () =>
      notesRef.current.find((note) => note.id === activeNote?.id)?.content ??
      activeNote?.content ??
      "",
    retrySave: () => {
      if (activeNote) void queueSave(activeNote.id, adapter);
    }
  };
}
