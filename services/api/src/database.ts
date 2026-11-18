import { createHash, randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  RevisionConflictError,
  workspacePath,
  type ContentHash,
  type DocumentExtensions,
  type DocumentMeta,
  type DocumentSnapshot,
  type IsoTimestamp,
  type JsonValue,
  type WorkspaceId,
  type WorkspaceNode
} from "@inkloom/core";
import { hashSessionToken } from "./auth";

export type ApiUser = {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
};

export type ApiWorkspace = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type StoredSession = {
  token: string;
  expiresAt: string;
};

type UserRow = {
  id: string;
  email: string;
  display_name: string;
  password_hash: string;
  password_salt: string;
  created_at: string;
};

type WorkspaceRow = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

type DocumentRow = {
  id: string;
  workspace_id: string;
  path: string;
  title: string;
  tags_json: string;
  markdown: string;
  extensions_json: string | null;
  revision: number;
  content_hash: string;
  created_at: string;
  updated_at: string;
};

type RevisionRow = {
  id: string;
  document_id: string;
  workspace_id: string;
  revision: number;
  title: string;
  tags_json: string;
  markdown: string;
  extensions_json: string | null;
  content_hash: string;
  created_at: string;
};

export type WorkspaceDocumentRevision = DocumentSnapshot & {
  revisionId: string;
  recordedAt: IsoTimestamp;
};

export type DocumentDatabaseOptions = {
  filename: string;
  now?: () => string;
  createId?: () => string;
};

type MutableFolderNode = Extract<WorkspaceNode, { kind: "folder" }> & {
  children: WorkspaceNode[];
};

const WELCOME_MARKDOWN = `# 欢迎使用墨织

这是一篇已保存到云端的 Markdown 文档。

## 从这里开始

- 直接编辑正文、标题和标签，墨织会自动保存。
- 使用 **Mermaid** 插入流程图。
- 使用 **画布** 打开 Excalidraw，并把场景与 Markdown 一起持久化。
- 右上角显示服务端保存状态；失败时不会静默覆盖。

Markdown 是正文事实源，账号工作区负责跨浏览器保存。
`;

export class DocumentDatabase {
  readonly db: DatabaseSync;
  private readonly now: () => string;
  private readonly createId: () => string;

  constructor(options: DocumentDatabaseOptions) {
    if (options.filename !== ":memory:") {
      mkdirSync(dirname(options.filename), { recursive: true });
    }
    this.db = new DatabaseSync(options.filename);
    this.now = options.now ?? (() => new Date().toISOString());
    this.createId = options.createId ?? randomUUID;
    this.db.exec(`
      PRAGMA foreign_keys = ON;
      PRAGMA journal_mode = WAL;

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS workspaces (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        path TEXT NOT NULL,
        title TEXT NOT NULL,
        tags_json TEXT NOT NULL,
        markdown TEXT NOT NULL,
        extensions_json TEXT,
        revision INTEGER NOT NULL,
        content_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      );

      CREATE UNIQUE INDEX IF NOT EXISTS documents_active_path
        ON documents(workspace_id, path)
        WHERE deleted_at IS NULL;

      CREATE INDEX IF NOT EXISTS documents_workspace
        ON documents(workspace_id, deleted_at);

      CREATE TABLE IF NOT EXISTS document_revisions (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        revision INTEGER NOT NULL,
        title TEXT NOT NULL,
        tags_json TEXT NOT NULL,
        markdown TEXT NOT NULL,
        extensions_json TEXT,
        content_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(document_id, revision)
      );
    `);
  }

  close(): void {
    this.db.close();
  }

  createUser(input: {
    email: string;
    displayName?: string;
    passwordHash: string;
    passwordSalt: string;
  }): ApiUser {
    const timestamp = this.now();
    const userId = this.createId();
    const workspaceId = this.createId();
    const documentId = this.createId();
    const email = normalizeEmail(input.email);
    const displayName = normalizeDisplayName(input.displayName, email);
    const workspaceName = `${displayName}的工作区`;
    const path = workspacePath("开始使用/欢迎.md");

    this.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO users
            (id, email, display_name, password_hash, password_salt, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(
          userId,
          email,
          displayName,
          input.passwordHash,
          input.passwordSalt,
          timestamp
        );
      this.db
        .prepare(
          `INSERT INTO workspaces (id, user_id, name, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run(workspaceId, userId, workspaceName, timestamp, timestamp);
      this.db
        .prepare(
          `INSERT INTO documents
            (id, workspace_id, path, title, tags_json, markdown, extensions_json,
             revision, content_hash, created_at, updated_at, deleted_at)
           VALUES (?, ?, ?, ?, ?, ?, NULL, 1, ?, ?, ?, NULL)`
        )
        .run(
          documentId,
          workspaceId,
          path,
          "欢迎使用墨织",
          JSON.stringify(["入门", "云端保存"]),
          WELCOME_MARKDOWN,
          contentHash(WELCOME_MARKDOWN),
          timestamp,
          timestamp
        );
    });

    return { id: userId, email, displayName, createdAt: timestamp };
  }

  findUserByEmail(email: string): UserRow | undefined {
    return this.db
      .prepare("SELECT * FROM users WHERE email = ?")
      .get(normalizeEmail(email)) as UserRow | undefined;
  }

  findUserById(userId: string): ApiUser | undefined {
    const row = this.db
      .prepare("SELECT * FROM users WHERE id = ?")
      .get(userId) as UserRow | undefined;
    return row ? userFromRow(row) : undefined;
  }

  createSession(userId: string, token: string, expiresAt: string): void {
    const timestamp = this.now();
    this.db
      .prepare("DELETE FROM sessions WHERE expires_at <= ?")
      .run(timestamp);
    this.db
      .prepare(
        `INSERT INTO sessions (token_hash, user_id, expires_at, created_at)
         VALUES (?, ?, ?, ?)`
      )
      .run(hashSessionToken(token), userId, expiresAt, timestamp);
  }

  findUserBySession(token: string): ApiUser | undefined {
    const row = this.db
      .prepare(
        `SELECT users.*
         FROM sessions
         JOIN users ON users.id = sessions.user_id
         WHERE sessions.token_hash = ? AND sessions.expires_at > ?`
      )
      .get(hashSessionToken(token), this.now()) as UserRow | undefined;
    return row ? userFromRow(row) : undefined;
  }

  deleteSession(token: string): void {
    this.db
      .prepare("DELETE FROM sessions WHERE token_hash = ?")
      .run(hashSessionToken(token));
  }

  listWorkspaces(userId: string): ApiWorkspace[] {
    return (
      this.db
        .prepare(
          `SELECT * FROM workspaces
           WHERE user_id = ?
           ORDER BY created_at ASC`
        )
        .all(userId) as WorkspaceRow[]
    ).map(workspaceFromRow);
  }

  createWorkspace(userId: string, name: string): ApiWorkspace {
    const timestamp = this.now();
    const workspace: ApiWorkspace = {
      id: this.createId(),
      name: normalizeWorkspaceName(name),
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.db
      .prepare(
        `INSERT INTO workspaces (id, user_id, name, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        workspace.id,
        userId,
        workspace.name,
        workspace.createdAt,
        workspace.updatedAt
      );
    return workspace;
  }

  getWorkspace(userId: string, workspaceId: string): ApiWorkspace | undefined {
    const row = this.db
      .prepare("SELECT * FROM workspaces WHERE id = ? AND user_id = ?")
      .get(workspaceId, userId) as WorkspaceRow | undefined;
    return row ? workspaceFromRow(row) : undefined;
  }

  listTree(userId: string, workspaceId: string): WorkspaceNode {
    const workspace = this.requireWorkspace(userId, workspaceId);
    const documents = (
      this.db
        .prepare(
          `SELECT * FROM documents
           WHERE workspace_id = ? AND deleted_at IS NULL
           ORDER BY path ASC`
        )
        .all(workspaceId) as DocumentRow[]
    ).map(documentFromRow);
    return buildTree(workspace, documents);
  }

  readDocument(
    userId: string,
    workspaceId: string,
    documentId: string
  ): DocumentSnapshot {
    this.requireWorkspace(userId, workspaceId);
    return documentFromRow(this.requireDocument(workspaceId, documentId));
  }

  createDocument(
    userId: string,
    workspaceId: string,
    input: {
      path: string;
      title: string;
      markdown?: string;
      tags?: readonly string[];
      extensions?: DocumentExtensions;
    }
  ): DocumentSnapshot {
    const workspace = this.requireWorkspace(userId, workspaceId);
    const timestamp = this.now();
    const title = validateTitle(input.title);
    const path = workspacePath(input.path);
    const markdown = input.markdown ?? `# ${title}\n`;
    this.assertPathAvailable(workspaceId, path);
    const snapshot: DocumentSnapshot = {
      meta: {
        id: this.createId(),
        workspaceId,
        path,
        title,
        tags: validateTags(input.tags ?? []),
        revision: 1,
        contentHash: contentHash(markdown),
        createdAt: timestamp,
        updatedAt: timestamp
      },
      markdown,
      extensions: input.extensions
    };
    this.db
      .prepare(
        `INSERT INTO documents
          (id, workspace_id, path, title, tags_json, markdown, extensions_json,
           revision, content_hash, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`
      )
      .run(
        snapshot.meta.id,
        workspaceId,
        path,
        title,
        JSON.stringify(snapshot.meta.tags),
        markdown,
        serializeExtensions(snapshot.extensions),
        snapshot.meta.revision,
        snapshot.meta.contentHash,
        timestamp,
        timestamp
      );
    this.touchWorkspace(workspace.id, timestamp);
    return snapshot;
  }

  writeDocument(
    userId: string,
    workspaceId: string,
    documentId: string,
    input: {
      markdown: string;
      baseRevision: number;
      title?: string;
      tags?: readonly string[];
      extensions?: DocumentExtensions;
    }
  ): DocumentSnapshot {
    this.requireWorkspace(userId, workspaceId);
    const currentRow = this.requireDocument(workspaceId, documentId);
    assertRevision(documentId, input.baseRevision, currentRow.revision);
    const timestamp = this.now();
    const current = documentFromRow(currentRow);
    const nextTitle =
      input.title === undefined ? current.meta.title : validateTitle(input.title);
    const tags =
      input.tags === undefined ? current.meta.tags : validateTags(input.tags);
    const extensions =
      input.extensions === undefined ? current.extensions : input.extensions;
    const nextRevision = current.meta.revision + 1;

    this.transaction(() => {
      this.insertRevision(current, timestamp);
      this.db
        .prepare(
          `UPDATE documents
           SET title = ?, tags_json = ?, markdown = ?, extensions_json = ?,
               revision = ?, content_hash = ?, updated_at = ?
           WHERE id = ? AND workspace_id = ?`
        )
        .run(
          nextTitle,
          JSON.stringify(tags),
          input.markdown,
          serializeExtensions(extensions),
          nextRevision,
          contentHash(input.markdown),
          timestamp,
          documentId,
          workspaceId
        );
      this.touchWorkspace(workspaceId, timestamp);
    });

    return this.readDocument(userId, workspaceId, documentId);
  }

  moveDocument(
    userId: string,
    workspaceId: string,
    documentId: string,
    input: { targetPath: string; baseRevision: number }
  ): WorkspaceNode {
    this.requireWorkspace(userId, workspaceId);
    const currentRow = this.requireDocument(workspaceId, documentId);
    assertRevision(documentId, input.baseRevision, currentRow.revision);
    const path = workspacePath(input.targetPath);
    this.assertPathAvailable(workspaceId, path, documentId);
    const timestamp = this.now();
    this.db
      .prepare(
        `UPDATE documents
         SET path = ?, revision = revision + 1, updated_at = ?
         WHERE id = ? AND workspace_id = ?`
      )
      .run(path, timestamp, documentId, workspaceId);
    this.touchWorkspace(workspaceId, timestamp);
    const snapshot = documentFromRow(this.requireDocument(workspaceId, documentId));
    return {
      kind: "document",
      id: snapshot.meta.id,
      name: fileName(snapshot.meta.path),
      path: snapshot.meta.path,
      meta: snapshot.meta
    };
  }

  deleteDocument(
    userId: string,
    workspaceId: string,
    documentId: string,
    baseRevision: number
  ): void {
    this.requireWorkspace(userId, workspaceId);
    const currentRow = this.requireDocument(workspaceId, documentId);
    assertRevision(documentId, baseRevision, currentRow.revision);
    const timestamp = this.now();
    this.db
      .prepare(
        `UPDATE documents
         SET deleted_at = ?, revision = revision + 1, updated_at = ?
         WHERE id = ? AND workspace_id = ?`
      )
      .run(timestamp, timestamp, documentId, workspaceId);
    this.touchWorkspace(workspaceId, timestamp);
  }

  listRevisions(
    userId: string,
    workspaceId: string,
    documentId: string
  ): WorkspaceDocumentRevision[] {
    this.requireWorkspace(userId, workspaceId);
    this.requireDocument(workspaceId, documentId);
    return (
      this.db
        .prepare(
          `SELECT * FROM document_revisions
           WHERE document_id = ? AND workspace_id = ?
           ORDER BY revision DESC
           LIMIT 50`
        )
        .all(documentId, workspaceId) as RevisionRow[]
    ).map(revisionFromRow);
  }

  restoreRevision(
    userId: string,
    workspaceId: string,
    documentId: string,
    revisionId: string,
    baseRevision: number
  ): DocumentSnapshot {
    this.requireWorkspace(userId, workspaceId);
    const currentRow = this.requireDocument(workspaceId, documentId);
    assertRevision(documentId, baseRevision, currentRow.revision);
    const revision = this.db
      .prepare(
        `SELECT * FROM document_revisions
         WHERE id = ? AND document_id = ? AND workspace_id = ?`
      )
      .get(revisionId, documentId, workspaceId) as RevisionRow | undefined;
    if (!revision) throw new ApiDatabaseError(404, "REVISION_NOT_FOUND", "找不到历史版本。");

    return this.writeDocument(userId, workspaceId, documentId, {
      markdown: revision.markdown,
      title: revision.title,
      tags: parseTags(revision.tags_json),
      extensions: parseExtensions(revision.extensions_json),
      baseRevision
    });
  }

  private requireWorkspace(userId: string, workspaceId: string): ApiWorkspace {
    const workspace = this.getWorkspace(userId, workspaceId);
    if (!workspace) {
      throw new ApiDatabaseError(404, "WORKSPACE_NOT_FOUND", "找不到工作区。");
    }
    return workspace;
  }

  private requireDocument(workspaceId: string, documentId: string): DocumentRow {
    const row = this.db
      .prepare(
        `SELECT * FROM documents
         WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL`
      )
      .get(documentId, workspaceId) as DocumentRow | undefined;
    if (!row) {
      throw new ApiDatabaseError(404, "DOCUMENT_NOT_FOUND", "找不到文档。");
    }
    return row;
  }

  private assertPathAvailable(
    workspaceId: string,
    path: string,
    exceptDocumentId?: string
  ): void {
    const row = this.db
      .prepare(
        `SELECT id FROM documents
         WHERE workspace_id = ? AND path = ? AND deleted_at IS NULL`
      )
      .get(workspaceId, path) as { id: string } | undefined;
    if (row && row.id !== exceptDocumentId) {
      throw new ApiDatabaseError(
        409,
        "DOCUMENT_PATH_CONFLICT",
        "同路径已存在文档，请更换文件名。"
      );
    }
  }

  private insertRevision(document: DocumentSnapshot, recordedAt: string): void {
    this.db
      .prepare(
        `INSERT OR IGNORE INTO document_revisions
          (id, document_id, workspace_id, revision, title, tags_json, markdown,
           extensions_json, content_hash, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        this.createId(),
        document.meta.id,
        document.meta.workspaceId,
        document.meta.revision,
        document.meta.title,
        JSON.stringify(document.meta.tags),
        document.markdown,
        serializeExtensions(document.extensions),
        document.meta.contentHash,
        recordedAt
      );
  }

  private touchWorkspace(workspaceId: string, timestamp: string): void {
    this.db
      .prepare("UPDATE workspaces SET updated_at = ? WHERE id = ?")
      .run(timestamp, workspaceId);
  }

  private transaction(action: () => void): void {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      action();
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
}

export class ApiDatabaseError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "ApiDatabaseError";
  }
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeDisplayName(value: string | undefined, email: string): string {
  const fallback = email.split("@")[0] || "写作者";
  const name = (value ?? fallback).trim().slice(0, 40);
  return name.length > 0 ? name : "写作者";
}

function normalizeWorkspaceName(value: string): string {
  const name = value.trim().slice(0, 80);
  if (!name) throw new ApiDatabaseError(400, "INVALID_WORKSPACE_NAME", "工作区名称不能为空。");
  return name;
}

function validateTitle(value: string): string {
  const title = value.trim().slice(0, 200);
  if (!title) throw new ApiDatabaseError(400, "INVALID_TITLE", "文档标题不能为空。");
  return title;
}

function validateTags(tags: readonly string[]): string[] {
  return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))].slice(0, 30);
}

function assertRevision(
  documentId: string,
  expectedRevision: number,
  actualRevision: number
): void {
  if (expectedRevision !== actualRevision) {
    throw new RevisionConflictError(documentId, expectedRevision, actualRevision);
  }
}

function contentHash(markdown: string): ContentHash {
  return createHash("sha256").update(markdown).digest("hex") as ContentHash;
}

function userFromRow(row: UserRow): ApiUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    createdAt: row.created_at
  };
}

function workspaceFromRow(row: WorkspaceRow): ApiWorkspace {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function documentFromRow(row: DocumentRow): DocumentSnapshot {
  const meta: DocumentMeta = {
    id: row.id,
    workspaceId: row.workspace_id as WorkspaceId,
    path: workspacePath(row.path),
    title: row.title,
    tags: parseTags(row.tags_json),
    revision: row.revision,
    contentHash: row.content_hash as ContentHash,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
  return {
    meta,
    markdown: row.markdown,
    extensions: parseExtensions(row.extensions_json)
  };
}

function revisionFromRow(row: RevisionRow): WorkspaceDocumentRevision {
  return {
    ...documentFromRow({
      id: row.document_id,
      workspace_id: row.workspace_id,
      path: "历史版本.md",
      title: row.title,
      tags_json: row.tags_json,
      markdown: row.markdown,
      extensions_json: row.extensions_json,
      revision: row.revision,
      content_hash: row.content_hash,
      created_at: row.created_at,
      updated_at: row.created_at
    }),
    revisionId: row.id,
    recordedAt: row.created_at
  };
}

function buildTree(
  workspace: ApiWorkspace,
  documents: readonly DocumentSnapshot[]
): WorkspaceNode {
  const root: MutableFolderNode = {
    kind: "folder",
    id: workspace.id,
    name: workspace.name,
    path: workspacePath(workspace.name.replaceAll("/", "-")),
    children: []
  };
  const folders = new Map<string, MutableFolderNode>();

  for (const document of documents) {
    const segments = document.meta.path.split("/");
    const documentName = segments.pop() ?? document.meta.title;
    let parent = root;
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
        name: documentName,
        path: document.meta.path,
        meta: document.meta
      }
    ];
  }
  return root;
}

function fileName(path: string): string {
  return path.split("/").at(-1) ?? path;
}

function parseTags(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((tag): tag is string => typeof tag === "string")
      : [];
  } catch {
    return [];
  }
}

function serializeExtensions(
  extensions: DocumentExtensions | undefined
): string | null {
  return extensions === undefined ? null : JSON.stringify(extensions);
}

function parseExtensions(value: string | null): DocumentExtensions | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value) as JsonValue;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as DocumentExtensions)
      : undefined;
  } catch {
    return undefined;
  }
}
