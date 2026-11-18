import {
  InkLoomError,
  RevisionConflictError,
  contentHash,
  workspacePath,
  type CreateDocumentInput,
  type DeleteNodeInput,
  type DocumentId,
  type DocumentSnapshot,
  type MoveNodeInput,
  type StorageCapabilities,
  type WorkspaceAdapter,
  type WorkspaceNode,
  type WriteDocumentInput
} from "@inkloom/core";

export interface BrowserKeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type BrowserWorkspaceState = {
  documents: readonly DocumentSnapshot[];
  activeDocumentId?: DocumentId;
};

type PersistedWorkspace = {
  version: 1;
  documents: readonly DocumentSnapshot[];
  activeDocumentId?: DocumentId;
};

export type BrowserLocalAdapterOptions = {
  storage: BrowserKeyValueStorage;
  keyPrefix?: string;
  now?: () => string;
  createId?: () => string;
};

export class BrowserLocalAdapter implements WorkspaceAdapter {
  readonly kind = "browser-local" as const;

  private readonly storage: BrowserKeyValueStorage;
  private readonly stateKey: string;
  private readonly now: () => string;
  private readonly createId: () => string;

  constructor(options: BrowserLocalAdapterOptions) {
    this.storage = options.storage;
    this.stateKey = `${options.keyPrefix ?? "inkloom"}.workspace.v1`;
    this.now = options.now ?? (() => new Date().toISOString());
    this.createId =
      options.createId ??
      (() => `document-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  }

  loadWorkspace(fallback: readonly DocumentSnapshot[] = []): BrowserWorkspaceState {
    const persisted = this.readPersisted();
    if (!persisted || persisted.documents.length === 0) {
      return { documents: fallback };
    }

    const activeDocumentId = persisted.documents.some(
      (document) => document.meta.id === persisted.activeDocumentId
    )
      ? persisted.activeDocumentId
      : persisted.documents[0]?.meta.id;

    return { documents: persisted.documents, activeDocumentId };
  }

  saveWorkspace(state: BrowserWorkspaceState): void {
    const documents = state.documents.map((document) => cloneSnapshot(document));
    const persisted: PersistedWorkspace = {
      version: 1,
      documents,
      activeDocumentId: state.activeDocumentId
    };
    this.storage.setItem(this.stateKey, JSON.stringify(persisted));
  }

  saveActiveDocument(documentId: DocumentId): void {
    const persisted = this.readPersisted();
    if (!persisted?.documents.some((document) => document.meta.id === documentId)) return;
    this.storage.setItem(
      this.stateKey,
      JSON.stringify({ ...persisted, activeDocumentId: documentId } satisfies PersistedWorkspace)
    );
  }

  clear(): void {
    this.storage.removeItem(this.stateKey);
  }

  async getCapabilities(): Promise<StorageCapabilities> {
    return {
      localFileAccess: "none",
      fileWatch: false,
      sqlite: false,
      opfs: false,
      offline: true,
      backgroundSync: false,
      versionHistory: false
    };
  }

  async listTree(): Promise<WorkspaceNode> {
    const persisted = this.readPersisted();
    const documents = persisted?.documents ?? [];
    return buildTree(documents);
  }

  async readDocument(documentId: DocumentId): Promise<DocumentSnapshot> {
    const snapshot = this.findDocument(documentId);
    if (!snapshot) throw documentNotFound(documentId);
    return cloneSnapshot(snapshot);
  }

  async createDocument(input: CreateDocumentInput): Promise<DocumentSnapshot> {
    const persisted = this.readPersisted() ?? { version: 1, documents: [] };
    const timestamp = this.now();
    const markdown = input.markdown ?? `# ${input.title}\n`;
    const snapshot: DocumentSnapshot = {
      meta: {
        id: this.createId(),
        workspaceId: input.workspaceId,
        path: input.path,
        title: input.title,
        tags: input.tags ?? [],
        revision: 1,
        contentHash: contentHash(markdown),
        createdAt: timestamp,
        updatedAt: timestamp
      },
      markdown,
      extensions: input.extensions
    };
    this.writePersisted({
      ...persisted,
      documents: [...persisted.documents, snapshot]
    });
    return cloneSnapshot(snapshot);
  }

  async writeDocument(input: WriteDocumentInput): Promise<DocumentSnapshot> {
    const persisted = this.readPersisted() ?? { version: 1, documents: [] };
    const current = persisted.documents.find((document) => document.meta.id === input.documentId);
    if (!current) throw documentNotFound(input.documentId);
    if (current.meta.revision !== input.baseRevision) {
      throw new RevisionConflictError(
        input.documentId,
        input.baseRevision,
        current.meta.revision
      );
    }

    const next: DocumentSnapshot = {
      meta: {
        ...current.meta,
        title: input.title ?? current.meta.title,
        tags: input.tags ?? current.meta.tags,
        revision: current.meta.revision + 1,
        contentHash: contentHash(input.markdown),
        updatedAt: this.now()
      },
      markdown: input.markdown,
      extensions: input.extensions ?? current.extensions
    };
    this.writePersisted({
      ...persisted,
      documents: persisted.documents.map((document) =>
        document.meta.id === input.documentId ? next : document
      )
    });
    return cloneSnapshot(next);
  }

  async moveNode(input: MoveNodeInput): Promise<WorkspaceNode> {
    const persisted = this.readPersisted() ?? { version: 1, documents: [] };
    const current = persisted.documents.find((document) => document.meta.id === input.nodeId);
    if (!current) throw documentNotFound(input.nodeId);
    if (current.meta.revision !== input.baseRevision) {
      throw new RevisionConflictError(input.nodeId, input.baseRevision, current.meta.revision);
    }

    const next: DocumentSnapshot = {
      ...current,
      meta: {
        ...current.meta,
        path: input.targetPath,
        revision: current.meta.revision + 1,
        updatedAt: this.now()
      }
    };
    this.writePersisted({
      ...persisted,
      documents: persisted.documents.map((document) =>
        document.meta.id === input.nodeId ? next : document
      )
    });
    return {
      kind: "document",
      id: next.meta.id,
      name: next.meta.title,
      path: next.meta.path,
      meta: next.meta
    };
  }

  async deleteNode(input: DeleteNodeInput): Promise<void> {
    const persisted = this.readPersisted() ?? { version: 1, documents: [] };
    const current = persisted.documents.find((document) => document.meta.id === input.nodeId);
    if (!current) throw documentNotFound(input.nodeId);
    if (current.meta.revision !== input.baseRevision) {
      throw new RevisionConflictError(input.nodeId, input.baseRevision, current.meta.revision);
    }

    this.writePersisted({
      ...persisted,
      documents: persisted.documents.filter((document) => document.meta.id !== input.nodeId),
      activeDocumentId:
        persisted.activeDocumentId === input.nodeId ? undefined : persisted.activeDocumentId
    });
  }

  private readPersisted(): PersistedWorkspace | undefined {
    const raw = this.storage.getItem(this.stateKey);
    if (!raw) return undefined;

    try {
      const parsed = JSON.parse(raw) as Partial<PersistedWorkspace>;
      if (
        parsed.version !== 1 ||
        !Array.isArray(parsed.documents) ||
        !parsed.documents.every(isDocumentSnapshot)
      ) {
        return undefined;
      }
      return {
        version: 1,
        documents: parsed.documents,
        activeDocumentId: parsed.activeDocumentId
      };
    } catch {
      return undefined;
    }
  }

  private writePersisted(state: PersistedWorkspace): void {
    this.storage.setItem(this.stateKey, JSON.stringify(state));
  }

  private findDocument(documentId: DocumentId): DocumentSnapshot | undefined {
    return this.readPersisted()?.documents.find((document) => document.meta.id === documentId);
  }
}

function cloneSnapshot(snapshot: DocumentSnapshot): DocumentSnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as DocumentSnapshot;
}

function documentNotFound(documentId: string): InkLoomError {
  return new InkLoomError("DOCUMENT_NOT_FOUND", `Document not found: ${documentId}`);
}

function isDocumentSnapshot(value: unknown): value is DocumentSnapshot {
  if (!value || typeof value !== "object") return false;
  const document = value as Partial<DocumentSnapshot>;
  return (
    typeof document.markdown === "string" &&
    Boolean(document.meta) &&
    typeof document.meta?.id === "string" &&
    typeof document.meta?.path === "string" &&
    typeof document.meta?.revision === "number"
  );
}

function buildTree(documents: readonly DocumentSnapshot[]): WorkspaceNode {
  const root: WorkspaceNode = {
    kind: "folder",
    id: "workspace-root",
    name: "Workspace",
    path: workspacePath("workspace"),
    children: []
  };
  const folders = new Map<string, WorkspaceNode & { children: WorkspaceNode[] }>();

  for (const document of documents) {
    const segments = document.meta.path.split("/");
    const fileName = segments.pop() ?? document.meta.title;
    let parent = root as WorkspaceNode & { children: WorkspaceNode[] };
    let currentPath = "";

    for (const segment of segments) {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;
      let folder = folders.get(currentPath);
      if (!folder) {
        folder = {
          kind: "folder",
          id: `folder:${currentPath}`,
          name: segment,
          path: workspacePath(currentPath),
          children: []
        };
        folders.set(currentPath, folder);
        parent.children = [...parent.children, folder];
      }
      parent = folder;
    }

    parent.children = [
      ...parent.children,
      {
        kind: "document",
        id: document.meta.id,
        name: fileName,
        path: document.meta.path,
        meta: document.meta
      }
    ];
  }

  return root;
}
