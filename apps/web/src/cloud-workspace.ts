import {
  type DocumentSnapshot,
  type WorkspaceId,
  type WorkspaceNode
} from "@inkloom/core";
import {
  CloudClient,
  type CloudFetch,
  type CloudWorkspace,
  type CloudWorkspaceAdapter
} from "@inkloom/storage";
import type { CanvasScene } from "@inkloom/diagrams";
import { folderOrder, type Note } from "./data";

const SESSION_ACTIVE_PREFIX = "inkloom.active.";
const DRAFT_PREFIX = "inkloom.draft.";

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
  const snapshots = await Promise.all(
    documentNodes.map((node) => adapter.readDocument(node.id))
  );
  let recoveredDraft = false;
  const notes = snapshots.map((snapshot) => {
    const note = snapshotToNote(snapshot);
    const draft = readDraft(note.id);
    if (!draft) return note;
    recoveredDraft = true;
    return {
      ...note,
      title: draft.title,
      content: draft.content,
      tags: draft.tags,
      canvas: draft.canvas
    };
  });
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

export function snapshotToNote(snapshot: DocumentSnapshot): Note {
  const segments = snapshot.meta.path.split("/");
  const fallbackFolder = folderOrder[0] ?? "个人";
  return {
    id: snapshot.meta.id,
    title: snapshot.meta.title,
    folder: segments.length > 1 ? segments[0] : fallbackFolder,
    filePath: snapshot.meta.path,
    revision: snapshot.meta.revision,
    tags: [...snapshot.meta.tags],
    createdAt: snapshot.meta.createdAt,
    updatedAt: snapshot.meta.updatedAt,
    content: snapshot.markdown,
    canvas: snapshot.extensions?.canvas as unknown as CanvasScene | undefined
  };
}

export function saveDraft(note: Note): void {
  const draft = {
    title: note.title,
    content: note.content,
    tags: note.tags,
    canvas: note.canvas
  };
  localStorage.setItem(`${DRAFT_PREFIX}${note.id}`, JSON.stringify(draft));
}

export function clearDraft(documentId: string): void {
  localStorage.removeItem(`${DRAFT_PREFIX}${documentId}`);
}

function readDraft(documentId: string):
  | {
      title: string;
      content: string;
      tags: string[];
      canvas?: CanvasScene;
    }
  | undefined {
  const raw = localStorage.getItem(`${DRAFT_PREFIX}${documentId}`);
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
    return {
      title: value.title,
      content: value.content,
      tags: value.tags,
      canvas: value.canvas as CanvasScene | undefined
    };
  } catch {
    return undefined;
  }
}

function collectDocumentNodes(node: WorkspaceNode): Array<
  Extract<WorkspaceNode, { kind: "document" }>
> {
  if (node.kind === "document") return [node];
  return node.children.flatMap(collectDocumentNodes);
}
