import type {
  ContentHash,
  DocumentId,
  DocumentMeta,
  DocumentSnapshot,
  Revision,
  WorkspaceId,
  WorkspacePath
} from "./document";

export type WorkspaceNode =
  | {
      kind: "folder";
      id: string;
      name: string;
      path: WorkspacePath;
      children: readonly WorkspaceNode[];
    }
  | {
      kind: "document";
      id: DocumentId;
      name: string;
      path: WorkspacePath;
      meta: DocumentMeta;
    };

export type StorageKind =
  | "browser-local"
  | "browser-opfs"
  | "file-system-access"
  | "tauri-folder"
  | "cloud"
  | "harmony-sandbox";

export type LocalFileAccess = "none" | "sandbox" | "user-selected";

export type StorageCapabilities = {
  localFileAccess: LocalFileAccess;
  fileWatch: boolean;
  sqlite: boolean;
  opfs: boolean;
  offline: boolean;
  backgroundSync: boolean;
  versionHistory: boolean;
};

export type CreateDocumentInput = {
  workspaceId: WorkspaceId;
  path: WorkspacePath;
  title: string;
  markdown?: string;
};

export type WriteDocumentInput = {
  documentId: DocumentId;
  markdown: string;
  baseRevision: Revision;
};

export type MoveNodeInput = {
  nodeId: string;
  targetPath: WorkspacePath;
  baseRevision: Revision;
};

export type DeleteNodeInput = {
  nodeId: string;
  baseRevision: Revision;
};

export interface WorkspaceAdapter {
  readonly kind: StorageKind;
  getCapabilities(): Promise<StorageCapabilities>;
  listTree(): Promise<WorkspaceNode>;
  readDocument(documentId: DocumentId): Promise<DocumentSnapshot>;
  createDocument(input: CreateDocumentInput): Promise<DocumentSnapshot>;
  writeDocument(input: WriteDocumentInput): Promise<DocumentSnapshot>;
  moveNode(input: MoveNodeInput): Promise<WorkspaceNode>;
  deleteNode(input: DeleteNodeInput): Promise<void>;
}

export type AssetRef = {
  id: string;
  hash: ContentHash;
  mime: string;
  size: number;
};

export interface AssetStore {
  put(input: { workspaceId: WorkspaceId; data: Uint8Array; mime: string }): Promise<AssetRef>;
  get(workspaceId: WorkspaceId, assetId: string): Promise<Uint8Array>;
  remove(workspaceId: WorkspaceId, assetId: string): Promise<void>;
}
