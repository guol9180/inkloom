import {
  type DocumentSnapshot,
  type WorkspaceId,
  type WorkspaceNode
} from "@inkloom/core";
import {
  CloudClient,
  IndexedDbDraftStore,
  type CloudFetch,
  type CloudWorkspace,
  type CloudWorkspaceAdapter
} from "@inkloom/storage";
import type { CanvasScene } from "@inkloom/diagrams";
import { folderOrder, type Note } from "./data";

const SESSION_ACTIVE_PREFIX = "inkloom.active.";
const ACTIVE_WORKSPACE_KEY = "inkloom.active-workspace";
const DRAFT_PREFIX = "inkloom.draft.";
const draftStore = new IndexedDbDraftStore();
let activeDraftScope:
  | { userId: string; workspaceId: string }
  | undefined;

export const cloudClient = new CloudClient({
  baseUrl:
    import.meta.env.VITE_API_ORIGIN?.replace(/\/$/, "") ??
    (["127.0.0.1", "localhost"].includes(window.location.hostname)
      ? `${window.location.protocol}//${window.location.hostname}:3001`
      : window.location.origin),
  fetch: ((input, init) => window.fetch(input, init)) satisfies CloudFetch
});

export async function loadCloudWorkspace(
  adapter: CloudWorkspaceAdapter,
  workspace: CloudWorkspace
): Promise<{ notes: Note[]; activeId: string; recoveredDraft: boolean }> {
  const tree = await adapter.listTree();
  const documentNodes = collectDocumentNodes(tree);
  const [session, snapshots] = await Promise.all([
    cloudClient.getSession(),
    Promise.all(documentNodes.map((node) => adapter.readDocument(node.id)))
  ]);
  activeDraftScope =
    session === undefined
      ? undefined
      : { userId: session.id, workspaceId: workspace.id };
  let recoveredDraft = false;
  const notes = await Promise.all(
    snapshots.map(async (snapshot) => {
      const note = snapshotToNote(snapshot);
      const draft = session
        ? await readDraft(session.id, workspace.id, note)
        : undefined;
      if (!draft) return note;
      recoveredDraft = true;
      return {
        ...note,
        title: draft.title,
        content: draft.content,
        tags: draft.tags,
        canvas: draft.canvas
      };
    })
  );
  const storedActiveId = localStorage.getItem(`${SESSION_ACTIVE_PREFIX}${workspace.id}`);
  const activeId =
    notes.find((note) => note.id === storedActiveId)?.id ?? notes[0]?.id ?? "";
  return { notes, activeId, recoveredDraft };
}

export function persistActiveWorkspace(
  workspaceId: WorkspaceId,
  activeId: string
): void {
  if (activeId) {
    localStorage.setItem(`${SESSION_ACTIVE_PREFIX}${workspaceId}`, activeId);
  }
}

export async function ensureCloudWorkspace(): Promise<CloudWorkspace> {
  const workspaces = await cloudClient.listWorkspaces();
  if (workspaces[0]) return workspaces[0];
  return cloudClient.createWorkspace("我的工作区");
}

export async function loadCloudWorkspaces(): Promise<{
  workspaces: CloudWorkspace[];
  activeWorkspace: CloudWorkspace;
}> {
  let workspaces = await cloudClient.listWorkspaces();
  if (workspaces.length === 0) {
    workspaces = [await cloudClient.createWorkspace("我的工作区")];
  }
  const storedId = localStorage.getItem(ACTIVE_WORKSPACE_KEY);
  const activeWorkspace =
    workspaces.find((workspace) => workspace.id === storedId) ?? workspaces[0];
  persistActiveCloudWorkspace(activeWorkspace.id as WorkspaceId);
  return { workspaces, activeWorkspace };
}

export function persistActiveCloudWorkspace(workspaceId: WorkspaceId): void {
  localStorage.setItem(ACTIVE_WORKSPACE_KEY, workspaceId);
}

export function snapshotToNote(snapshot: DocumentSnapshot): Note {
  const segments = snapshot.meta.path.split("/");
  const fallbackFolder = folderOrder[0] ?? "个人";
  return {
    id: snapshot.meta.id,
    title: snapshot.meta.title,
    folder:
      segments.length > 1 ? segments.slice(0, -1).join("/") : fallbackFolder,
    filePath: snapshot.meta.path,
    revision: snapshot.meta.revision,
    tags: [...snapshot.meta.tags],
    createdAt: snapshot.meta.createdAt,
    updatedAt: snapshot.meta.updatedAt,
    content: snapshot.markdown,
    canvas: snapshot.extensions?.canvas as unknown as CanvasScene | undefined
  };
}

export async function saveDraft(note: Note): Promise<void> {
  if (!activeDraftScope) return;
  await draftStore.put({
    key: `${activeDraftScope.userId}:${activeDraftScope.workspaceId}:${note.id}`,
    ...activeDraftScope,
    documentId: note.id,
    title: note.title,
    markdown: note.content,
    tags: note.tags,
    baseRevision: note.revision,
    contentHash: await hashMarkdown(note.content),
    extensions:
      note.canvas === undefined ? undefined : { canvas: note.canvas as never },
    savedAt: new Date().toISOString()
  });
}

export async function clearDraft(documentId: string): Promise<void> {
  if (!activeDraftScope) return;
  await draftStore.remove({
    ...activeDraftScope,
    documentId
  });
}

async function readDraft(
  userId: string,
  workspaceId: string,
  note: Note
):
  Promise<
  | {
      title: string;
      content: string;
      tags: string[];
      canvas?: CanvasScene;
    }
  | undefined
  > {
  const draft = await draftStore.get({
    userId,
    workspaceId,
    documentId: note.id
  });
  if (draft) {
    return {
      title: draft.title,
      content: draft.markdown,
      tags: [...draft.tags],
      canvas: draft.extensions?.canvas as unknown as CanvasScene | undefined
    };
  }
  const raw = localStorage.getItem(`${DRAFT_PREFIX}${note.id}`);
  if (!raw) return undefined;
  try {
    const value = JSON.parse(raw) as {
      title?: unknown;
      content?: unknown;
      tags?: unknown;
      canvas?: unknown;
    };
    if (
      typeof value.title !== "string" ||
      typeof value.content !== "string" ||
      !Array.isArray(value.tags) ||
      !value.tags.every((tag) => typeof tag === "string")
    ) {
      return undefined;
    }
    const recovered = {
      title: value.title,
      content: value.content,
      tags: value.tags,
      canvas: value.canvas as CanvasScene | undefined
    };
    await draftStore.put({
      key: `${userId}:${workspaceId}:${note.id}`,
      userId,
      workspaceId,
      documentId: note.id,
      title: recovered.title,
      markdown: recovered.content,
      tags: recovered.tags,
      baseRevision: note.revision,
      contentHash: await hashMarkdown(recovered.content),
      extensions:
        recovered.canvas === undefined
          ? undefined
          : { canvas: recovered.canvas as never },
      savedAt: new Date().toISOString()
    });
    localStorage.removeItem(`${DRAFT_PREFIX}${note.id}`);
    return recovered;
  } catch {
    return undefined;
  }
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

function collectDocumentNodes(node: WorkspaceNode): Array<
  Extract<WorkspaceNode, { kind: "document" }>
> {
  if (node.kind === "document") return [node];
  return node.children.flatMap(collectDocumentNodes);
}
