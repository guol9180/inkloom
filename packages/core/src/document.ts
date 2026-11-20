import { InkLoomError } from "./errors";

export type DocumentId = string;
export type WorkspaceId = string;
export type KnowledgeBaseId = string;
export type Revision = number;
export type DocumentLifecycle = "scratch" | "knowledge";

export type ContentHash = string & {
  readonly __brand: "ContentHash";
};

export type WorkspacePath = string & {
  readonly __brand: "WorkspacePath";
};

export type IsoTimestamp = string;

export type DocumentMeta = {
  id: DocumentId;
  workspaceId: WorkspaceId;
  lifecycle: DocumentLifecycle;
  knowledgeBaseId?: KnowledgeBaseId;
  path: WorkspacePath;
  title: string;
  tags: readonly string[];
  revision: Revision;
  contentHash: ContentHash;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
  archivedAt?: IsoTimestamp;
  lastOpenedAt?: IsoTimestamp;
};

export type DocumentSnapshot = {
  meta: DocumentMeta;
  markdown: string;
  extensions?: DocumentExtensions;
};

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export type DocumentExtensions = Readonly<Record<string, JsonValue>>;

export function workspacePath(value: string): WorkspacePath {
  const normalized = value.replaceAll("\\", "/");
  const segments = normalized.split("/");
  if (
    value.includes("\0") ||
    /^\/|^[A-Za-z]:\//.test(normalized) ||
    /^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(value) ||
    normalized.length === 0 ||
    segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")
  ) {
    throw new InkLoomError("INVALID_WORKSPACE_PATH", `Invalid workspace path: ${value}`);
  }
  return normalized as WorkspacePath;
}

export function contentHash(value: string): ContentHash {
  return value as ContentHash;
}
