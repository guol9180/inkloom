import type { DocumentExtensions } from "@inkloom/core";

export type IndexedDbDraftScope = {
  userId: string;
  workspaceId: string;
  documentId: string;
};

export type IndexedDbDocumentDraft = IndexedDbDraftScope & {
  key: string;
  title: string;
  markdown: string;
  tags: readonly string[];
  baseRevision: number;
  contentHash: string;
  extensions?: DocumentExtensions;
  savedAt: string;
  diffSummary?: string;
};

const DATABASE_NAME = "inkloom-drafts";
const STORE_NAME = "document-drafts";
const DATABASE_VERSION = 1;

export class IndexedDbDraftStore {
  private databasePromise: Promise<IDBDatabase> | undefined;

  constructor(private readonly factory: IDBFactory = globalThis.indexedDB) {}

  async get(
    scope: IndexedDbDraftScope
  ): Promise<IndexedDbDocumentDraft | undefined> {
    const database = await this.open();
    const draft = await requestResult<IndexedDbDocumentDraft | undefined>(
      database
        .transaction(STORE_NAME, "readonly")
        .objectStore(STORE_NAME)
        .get(draftKey(scope))
    );
    return draft && isDraft(draft) ? draft : undefined;
  }

  async put(draft: IndexedDbDocumentDraft): Promise<void> {
    const database = await this.open();
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(draft);
    await transactionDone(transaction);
  }

  async remove(scope: IndexedDbDraftScope): Promise<void> {
    const database = await this.open();
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(draftKey(scope));
    await transactionDone(transaction);
  }

  close(): void {
    void this.databasePromise?.then((database) => database.close());
    this.databasePromise = undefined;
  }

  private open(): Promise<IDBDatabase> {
    if (!this.factory) {
      return Promise.reject(new Error("IndexedDB is unavailable."));
    }
    this.databasePromise ??= new Promise((resolve, reject) => {
      const request = this.factory.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) {
          request.result.createObjectStore(STORE_NAME, { keyPath: "key" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(request.error ?? new Error("Unable to open IndexedDB."));
      request.onblocked = () =>
        reject(new Error("IndexedDB upgrade was blocked by another tab."));
    });
    return this.databasePromise;
  }
}

export function draftKey(scope: IndexedDbDraftScope) {
  return `${scope.userId}:${scope.workspaceId}:${scope.documentId}`;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction failed."));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction aborted."));
  });
}

function isDraft(value: unknown): value is IndexedDbDocumentDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as Partial<IndexedDbDocumentDraft>;
  return (
    typeof draft.key === "string" &&
    typeof draft.userId === "string" &&
    typeof draft.workspaceId === "string" &&
    typeof draft.documentId === "string" &&
    typeof draft.title === "string" &&
    typeof draft.markdown === "string" &&
    Array.isArray(draft.tags) &&
    draft.tags.every((tag) => typeof tag === "string") &&
    typeof draft.baseRevision === "number" &&
    typeof draft.contentHash === "string" &&
    typeof draft.savedAt === "string"
  );
}
