import {
  contentHash,
  workspacePath,
  type DocumentSnapshot,
  type JsonValue
} from "@inkloom/core";
import type { CanvasScene } from "@inkloom/diagrams";
import { BrowserLocalAdapter } from "@inkloom/storage";
import type { Note } from "./data";

const adapter = new BrowserLocalAdapter({
  storage: window.localStorage,
  keyPrefix: "inkloom.prototype",
  createId: () => window.crypto.randomUUID()
});

export type BrowserWorkspace = {
  notes: readonly Note[];
  activeId: string;
};

export function loadBrowserWorkspace(
  fallbackNotes: readonly Note[],
  reset = false
): BrowserWorkspace {
  if (reset) adapter.clear();
  const state = adapter.loadWorkspace(fallbackNotes.map(noteToSnapshot));
  const notes = state.documents.map(snapshotToNote);
  return {
    notes,
    activeId: state.activeDocumentId ?? notes[0]?.id ?? ""
  };
}

export function persistBrowserWorkspace(notes: readonly Note[], activeId: string): void {
  adapter.saveWorkspace({
    documents: notes.map(noteToSnapshot),
    activeDocumentId: activeId
  });
}

export function persistBrowserActiveDocument(activeId: string): void {
  adapter.saveActiveDocument(activeId);
}

function noteToSnapshot(note: Note): DocumentSnapshot {
  const extensions = note.canvas
    ? { canvas: note.canvas as unknown as JsonValue }
    : undefined;

  return {
    meta: {
      id: note.id,
      workspaceId: "prototype",
      path: workspacePath(note.filePath),
      title: note.title,
      tags: note.tags,
      revision: 1,
      contentHash: contentHash(note.content),
      createdAt: note.createdAt,
      updatedAt: note.updatedAt
    },
    markdown: note.content,
    extensions
  };
}

function snapshotToNote(snapshot: DocumentSnapshot): Note {
  const segments = snapshot.meta.path.split("/");
  return {
    id: snapshot.meta.id,
    title: snapshot.meta.title,
    folder: segments.length > 1 ? segments[0] : "个人",
    filePath: snapshot.meta.path,
    tags: [...snapshot.meta.tags],
    createdAt: snapshot.meta.createdAt,
    updatedAt: snapshot.meta.updatedAt,
    content: snapshot.markdown,
    canvas: snapshot.extensions?.canvas as unknown as CanvasScene | undefined
  };
}
