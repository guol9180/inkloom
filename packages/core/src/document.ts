import { InkLoomError } from "./errors";

export type DocumentId = string;
export type WorkspaceId = string;
export type Revision = number;

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
  path: WorkspacePath;
  title: string;
  tags: readonly string[];
  revision: Revision;
  contentHash: ContentHash;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
};

export type DocumentSnapshot = {
  meta: DocumentMeta;
  markdown: string;
};

export function workspacePath(value: string): WorkspacePath {
  const normalized = value.replaceAll("\\", "/").replace(/^\/+/, "");
  const segments = normalized.split("/");
  if (
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
