import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  RevisionConflictError,
  workspacePath,
  type DocumentSnapshot,
  type WorkspaceId
} from "@inkloom/core";
import {
  IndexedDbDraftStore,
  type IndexedDbDocumentDraft
} from "@inkloom/storage";
import { cloudClient } from "../../cloud-workspace";

const AUTOSAVE_DELAY = 800;
const CHECKPOINT_IDLE_DELAY = 2_000;
const CHECKPOINT_MAX_DELAY = 30_000;
const LEGACY_DRAFT_PREFIX = "inkloom.draft.";
const draftStore = new IndexedDbDraftStore();

export type AutosaveStatus =
  | "saved"
  | "draft"
  | "saving"
  | "offline"
  | "error"
  | "conflict";

export type ConflictCopy = {
  id: string;
  title: string;
};

type PendingSave = {
  checkpoint: boolean;
};

export function useDocumentAutosave({
  document,
  userId,
  active,
  onSaved,
  onConflictCopy
}: {
  document: DocumentSnapshot;
  userId: string;
  active: boolean;
  onSaved: (snapshot: DocumentSnapshot) => void;
  onConflictCopy: (snapshot: DocumentSnapshot) => void;
}) {
  const [markdown, setMarkdownState] = useState(document.markdown);
  const [status, setStatus] = useState<AutosaveStatus>("saved");
  const [error, setError] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState<string | undefined>(undefined);
  const [draftRecovered, setDraftRecovered] = useState(false);
  const [conflictCopy, setConflictCopy] = useState<ConflictCopy | undefined>(
    undefined
  );
  const markdownRef = useRef(document.markdown);
  const currentHashRef = useRef(String(document.meta.contentHash));
  const revisionRef = useRef(document.meta.revision);
  const lastPersistedHashRef = useRef(String(document.meta.contentHash));
  const activeRef = useRef(active);
  const mountedRef = useRef(true);
  const pendingRef = useRef<PendingSave | undefined>(undefined);
  const drainingRef = useRef(false);
  const drainPromiseRef = useRef<Promise<boolean>>(Promise.resolve(true));
  const networkTimerRef = useRef<number | undefined>(undefined);
  const checkpointTimerRef = useRef<number | undefined>(undefined);
  const maxCheckpointTimerRef = useRef<number | undefined>(undefined);
  const onSavedRef = useRef(onSaved);
  const onConflictCopyRef = useRef(onConflictCopy);

  activeRef.current = active;
  onSavedRef.current = onSaved;
  onConflictCopyRef.current = onConflictCopy;

  const scope = useMemo(
    () => ({
      userId,
      workspaceId: document.meta.workspaceId,
      documentId: document.meta.id
    }),
    [document.meta.id, document.meta.workspaceId, userId]
  );

  const clearTimers = useCallback(() => {
    for (const timer of [
      networkTimerRef.current,
      checkpointTimerRef.current,
      maxCheckpointTimerRef.current
    ]) {
      if (timer !== undefined) window.clearTimeout(timer);
    }
    networkTimerRef.current = undefined;
    checkpointTimerRef.current = undefined;
    maxCheckpointTimerRef.current = undefined;
  }, []);

  const persistDraft = useCallback(
    async (value = markdownRef.current) => {
      if (!userId) return;
      const hash = await hashMarkdown(value);
      const draft: IndexedDbDocumentDraft = {
        key: `${scope.userId}:${scope.workspaceId}:${scope.documentId}`,
        ...scope,
        title: document.meta.title,
        markdown: value,
        tags: document.meta.tags,
        baseRevision: revisionRef.current,
        contentHash: hash,
        extensions: document.extensions,
        savedAt: new Date().toISOString()
      };
      await draftStore.put(draft);
    },
    [
      document.meta.id,
      document.meta.tags,
      document.meta.title,
      document.extensions,
      scope.documentId,
      scope.userId,
      scope.workspaceId,
      userId
    ]
  );

  const preserveConflictCopy = useCallback(
    async (localMarkdown: string) => {
      const adapter = cloudClient.workspace(
        document.meta.workspaceId as WorkspaceId
      );
      const notes = await cloudClient.listNotes(
        document.meta.workspaceId as WorkspaceId
      );
      const usedPaths = new Set(notes.map((note) => note.path.toLowerCase()));
      const title = conflictTitle(document.meta.title);
      let path = uniqueConflictPath(title, usedPaths);
      const copy = await adapter.createDocument({
        workspaceId: document.meta.workspaceId as WorkspaceId,
        path: workspacePath(path),
        title,
        markdown: localMarkdown,
        tags: [...document.meta.tags, "冲突副本"],
        extensions: document.extensions
      });
      onConflictCopyRef.current(copy);

      const server = await adapter.readDocument(document.meta.id);
      revisionRef.current = server.meta.revision;
      lastPersistedHashRef.current = String(server.meta.contentHash);
      const serverHash = await hashMarkdown(server.markdown);
      currentHashRef.current = serverHash;
      markdownRef.current = server.markdown;
      if (mountedRef.current) {
        setMarkdownState(server.markdown);
        setConflictCopy({ id: copy.meta.id, title: copy.meta.title });
        setStatus("conflict");
        setError("云端已有更新。当前文档已载入最新版本，你的修改已保存为冲突副本。");
      }
      await draftStore.remove(scope);
      onSavedRef.current(server);
      return copy;
    },
    [
      document.extensions,
      document.meta.id,
      document.meta.tags,
      document.meta.title,
      scope
    ]
  );

  const drainSaves = useCallback(async (): Promise<boolean> => {
    if (drainingRef.current) return drainPromiseRef.current;
    drainingRef.current = true;
    drainPromiseRef.current = (async () => {
      let successful = true;
      try {
        while (pendingRef.current) {
          const pending = pendingRef.current;
          pendingRef.current = undefined;
          if (pending.checkpoint && maxCheckpointTimerRef.current !== undefined) {
            window.clearTimeout(maxCheckpointTimerRef.current);
            maxCheckpointTimerRef.current = undefined;
          }
          const value = markdownRef.current;
          const hash = await hashMarkdown(value);
          if (!pending.checkpoint && hash === lastPersistedHashRef.current) {
            await draftStore.remove(scope);
            if (mountedRef.current) {
              setStatus("saved");
              setError("");
            }
            continue;
          }
          if (mountedRef.current) {
            setStatus("saving");
            setError("");
          }
          try {
            const saved = await cloudClient
              .workspace(document.meta.workspaceId as WorkspaceId)
              .writeDocument({
                documentId: document.meta.id,
                baseRevision: revisionRef.current,
                checkpoint: pending.checkpoint,
                markdown: value,
                title: document.meta.title,
                tags: document.meta.tags,
                extensions: document.extensions
              });
            revisionRef.current = saved.meta.revision;
            lastPersistedHashRef.current = String(saved.meta.contentHash);
            const latestHash = await hashMarkdown(markdownRef.current);
            if (latestHash === lastPersistedHashRef.current) {
              await draftStore.remove(scope);
            }
            if (mountedRef.current) {
              setStatus(
                latestHash === lastPersistedHashRef.current ? "saved" : "draft"
              );
              setLastSavedAt(saved.meta.updatedAt);
              setError("");
            }
            onSavedRef.current(saved);
          } catch (saveError) {
            await persistDraft(markdownRef.current).catch(() => undefined);
            if (saveError instanceof RevisionConflictError) {
              try {
                await preserveConflictCopy(markdownRef.current);
              } catch {
                successful = false;
                if (mountedRef.current) {
                  setStatus("conflict");
                  setError(
                    "保存冲突。云端内容未被覆盖，本地草稿已保留，可重试生成冲突副本。"
                  );
                }
              }
              continue;
            }
            successful = false;
            if (mountedRef.current) {
              setStatus(navigator.onLine ? "error" : "offline");
              setError(
                navigator.onLine
                  ? `保存失败：${
                      saveError instanceof Error
                        ? saveError.message
                        : "请稍后重试。"
                    }`
                  : "已保存到本机，联网后会继续同步。"
              );
            }
          }
        }
      } finally {
        drainingRef.current = false;
      }
      return successful;
    })();
    return drainPromiseRef.current;
  }, [
    document.meta.id,
    document.meta.tags,
    document.meta.title,
    document.meta.workspaceId,
    document.extensions,
    persistDraft,
    preserveConflictCopy,
    scope
  ]);

  const flush = useCallback(
    (checkpoint: boolean) => {
      if (!activeRef.current) return Promise.resolve(true);
      pendingRef.current = {
        checkpoint: checkpoint || pendingRef.current?.checkpoint === true
      };
      return drainSaves();
    },
    [drainSaves]
  );

  const scheduleAutosave = useCallback(() => {
    if (networkTimerRef.current !== undefined) {
      window.clearTimeout(networkTimerRef.current);
    }
    if (checkpointTimerRef.current !== undefined) {
      window.clearTimeout(checkpointTimerRef.current);
    }
    networkTimerRef.current = window.setTimeout(() => {
      void flush(false);
    }, AUTOSAVE_DELAY);
    checkpointTimerRef.current = window.setTimeout(() => {
      void flush(true);
    }, CHECKPOINT_IDLE_DELAY);
    if (maxCheckpointTimerRef.current === undefined) {
      maxCheckpointTimerRef.current = window.setTimeout(() => {
        void flush(true);
      }, CHECKPOINT_MAX_DELAY);
    }
  }, [flush]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    clearTimers();
    pendingRef.current = undefined;
    revisionRef.current = document.meta.revision;
    lastPersistedHashRef.current = String(document.meta.contentHash);
    markdownRef.current = document.markdown;
    currentHashRef.current = String(document.meta.contentHash);
    setMarkdownState(document.markdown);
    setStatus("saved");
    setError("");
    setDraftRecovered(false);
    setConflictCopy(undefined);
    setLastSavedAt(document.meta.updatedAt);
    if (!active || !userId) return;

    let cancelled = false;
    void (async () => {
      await migrateLegacyDraft(document, userId);
      const draft = await draftStore.get(scope).catch(() => undefined);
      if (cancelled || !draft || draft.markdown === document.markdown) return;
      markdownRef.current = draft.markdown;
      currentHashRef.current = draft.contentHash;
      revisionRef.current = document.meta.revision;
      if (!mountedRef.current) return;
      setMarkdownState(draft.markdown);
      setDraftRecovered(true);
      setStatus("draft");
      scheduleAutosave();
    })();
    return () => {
      cancelled = true;
      clearTimers();
      if (markdownRef.current !== document.markdown) {
        void persistDraft(markdownRef.current);
        if (currentHashRef.current !== lastPersistedHashRef.current) {
          void flush(true);
        }
      }
    };
  }, [
    active,
    clearTimers,
    flush,
    persistDraft,
    scheduleAutosave,
    scope.documentId,
    scope.userId,
    scope.workspaceId,
    userId
  ]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "s"
      ) {
        event.preventDefault();
        void flush(true);
      }
    }
    function handleOnline() {
      if (currentHashRef.current !== lastPersistedHashRef.current) {
        void flush(true);
      }
    }
    function handleVisibility() {
      if (window.document.visibilityState === "hidden") void flush(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("online", handleOnline);
    window.document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("online", handleOnline);
      window.document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [flush]);

  function changeMarkdown(next: string) {
    markdownRef.current = next;
    setMarkdownState(next);
    if (!activeRef.current) return;
    setStatus("draft");
    setError("");
    void hashMarkdown(next).then(async (hash) => {
      currentHashRef.current = hash;
      if (hash === lastPersistedHashRef.current) {
        await draftStore.remove(scope).catch(() => undefined);
        if (mountedRef.current) setStatus("saved");
        return;
      }
      await persistDraft(next).catch(() => {
        if (mountedRef.current) {
          setStatus("error");
          setError("本地草稿写入失败，请检查浏览器存储空间。");
        }
      });
    });
    scheduleAutosave();
  }

  return {
    markdown,
    changeMarkdown,
    status,
    error,
    lastSavedAt,
    draftRecovered,
    conflictCopy,
    flush,
    retry: () => flush(true)
  };
}

async function hashMarkdown(value: string) {
  if (typeof crypto === "undefined" || !crypto.subtle) return value;
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function migrateLegacyDraft(
  document: DocumentSnapshot,
  userId: string
) {
  const key = `${LEGACY_DRAFT_PREFIX}${document.meta.id}`;
  const raw = localStorage.getItem(key);
  if (!raw) return;
  try {
    const value = JSON.parse(raw) as {
      title?: unknown;
      content?: unknown;
      tags?: unknown;
    };
    if (typeof value.content !== "string") return;
    const existing = await draftStore.get({
      userId,
      workspaceId: document.meta.workspaceId,
      documentId: document.meta.id
    });
    if (!existing) {
      await draftStore.put({
        key: `${userId}:${document.meta.workspaceId}:${document.meta.id}`,
        userId,
        workspaceId: document.meta.workspaceId,
        documentId: document.meta.id,
        title:
          typeof value.title === "string"
            ? value.title
            : document.meta.title,
        markdown: value.content,
        tags:
          Array.isArray(value.tags) &&
          value.tags.every((tag) => typeof tag === "string")
            ? value.tags
            : document.meta.tags,
        baseRevision: document.meta.revision,
        contentHash: await hashMarkdown(value.content),
        extensions: document.extensions,
        savedAt: new Date().toISOString()
      });
    }
    localStorage.removeItem(key);
  } catch {
    // Invalid legacy drafts are discarded without touching the server copy.
  }
}

function conflictTitle(title: string) {
  const timestamp = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  })
    .format(new Date())
    .replaceAll("/", "-")
    .replaceAll(":", "-")
    .replaceAll(" ", " ");
  return `${title}（本地冲突副本 ${timestamp}）`;
}

function uniqueConflictPath(title: string, existing: Set<string>) {
  const safe = title.replace(/[\\/:*?"<>|]/g, "-").trim() || "冲突副本";
  let path = `${safe}.md`;
  let index = 2;
  while (existing.has(path.toLowerCase())) {
    path = `${safe} (${index}).md`;
    index += 1;
  }
  return path;
}
