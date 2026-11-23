import type { ContentHash, DocumentId, Revision } from "@inkloom/core";

export type SyncState = "offline" | "syncing" | "synced" | "conflict";

export type SyncOperation =
  | {
      kind: "put-document";
      documentId: DocumentId;
      baseRevision: Revision;
      contentHash: ContentHash;
    }
  | { kind: "delete-document"; documentId: DocumentId; baseRevision: Revision }
  | {
      kind: "move-node";
      nodeId: string;
      parentId: string | null;
      baseRevision: Revision;
    };
