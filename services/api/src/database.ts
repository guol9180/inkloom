import { createHash, randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  RevisionConflictError,
  workspacePath,
  type ContentHash,
  type DocumentExtensions,
  type DocumentLifecycle,
  type DocumentMeta,
  type DocumentSnapshot,
  type IsoTimestamp,
  type JsonValue,
  type KnowledgeBaseId,
  type WorkspaceId,
  type WorkspaceNode,
  type WorkspacePath
} from "@inkloom/core";
import { hashSessionToken } from "./auth";
import { extractDocumentLinks } from "./links";
import { runMigrations } from "./migrations";
import {
  buildFtsQuery,
  filenameFromPath,
  highlightSearchSnippet,
  searchIndexTerms
} from "./search";

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

export type ApiKnowledgeBase = {
  id: KnowledgeBaseId;
  workspaceId: WorkspaceId;
  name: string;
  sortOrder: number;
  revision: number;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
};

export type DocumentSort = "updated" | "created" | "title";

export type ApiDocumentSummary = DocumentMeta & {
  excerpt: string;
};

export type ApiSearchResult = ApiDocumentSummary & {
  snippet: string;
};

export type ApiSearchPage = {
  results: ApiSearchResult[];
  total: number;
  page: number;
  pageSize: number;
};

export type ApiDocumentLink = {
  documentId: string;
  title: string;
  path: string;
  lifecycle: DocumentLifecycle;
  knowledgeBaseId?: KnowledgeBaseId;
  linkText: string;
  targetPath: string;
  anchor?: string;
  snippet: string;
  broken: boolean;
};

export type ApiDocumentAsset = {
  id: string;
  hash: string;
  mime: string;
  size: number;
  kind: AssetKind;
  createdAt: IsoTimestamp;
};

export type ApiDocumentContext = {
  document: DocumentMeta & { contentHash: ContentHash };
  outlineSource: string;
  outgoingLinks: ApiDocumentLink[];
  backlinks: ApiDocumentLink[];
  assets: ApiDocumentAsset[];
  revisions: WorkspaceDocumentRevision[];
};

export type AssetKind = "image" | "attachment" | "excalidraw" | "svg";

export type StoredAssetRecord = {
  id: string;
  workspaceId: WorkspaceId;
  hash: string;
  mime: string;
  size: number;
  kind: AssetKind;
  storageKey: string;
  createdAt: IsoTimestamp;
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

type KnowledgeBaseRow = {
  id: string;
  workspace_id: string;
  name: string;
  sort_order: number;
  revision: number;
  created_at: string;
  updated_at: string;
};

type DocumentRow = {
  id: string;
  workspace_id: string;
  lifecycle: DocumentLifecycle;
  knowledge_base_id: string | null;
  path: string;
  title: string;
  tags_json: string;
  markdown: string;
  extensions_json: string | null;
  revision: number;
  content_hash: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  last_opened_at: string | null;
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

type AssetRow = {
  id: string;
  workspace_id: string;
  hash: string;
  mime: string;
  size: number;
  kind: AssetKind;
  storage_key: string;
  created_at: string;
};

type SearchRow = DocumentRow & {
  snippet: string;
  rank: number;
};

type DocumentLinkRow = {
  id: string;
  source_document_id: string;
  target_document_id: string | null;
  target_path: string;
  link_text: string;
  anchor: string | null;
  broken: number;
  updated_at: string;
  source_title?: string;
  source_path?: string;
  source_lifecycle?: DocumentLifecycle;
  source_knowledge_base_id?: string | null;
  source_markdown?: string;
  target_title?: string | null;
  target_lifecycle?: DocumentLifecycle | null;
  target_knowledge_base_id?: string | null;
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

const DEFAULT_DOCUMENT_TITLE = "未命名文档";
const DEFAULT_DOCUMENT_PATH = "未命名文档.md";
const DEFAULT_DOCUMENT_MARKDOWN = "";

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
    `);
    runMigrations(this.db, this.now());
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
    const path = workspacePath(DEFAULT_DOCUMENT_PATH);

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
          DEFAULT_DOCUMENT_TITLE,
          JSON.stringify([]),
          DEFAULT_DOCUMENT_MARKDOWN,
          contentHash(DEFAULT_DOCUMENT_MARKDOWN),
          timestamp,
          timestamp
        );
    });
    this.syncDocumentSearch(workspaceId, documentId);
    this.syncDocumentLinks(workspaceId, documentId);

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
    const documentId = this.createId();
    const path = workspacePath(DEFAULT_DOCUMENT_PATH);
    this.transaction(() => {
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
      this.db
        .prepare(
          `INSERT INTO documents
            (id, workspace_id, path, title, tags_json, markdown, extensions_json,
             revision, content_hash, created_at, updated_at, deleted_at)
           VALUES (?, ?, ?, ?, ?, ?, NULL, 1, ?, ?, ?, NULL)`
        )
        .run(
          documentId,
          workspace.id,
          path,
          DEFAULT_DOCUMENT_TITLE,
          JSON.stringify([]),
          DEFAULT_DOCUMENT_MARKDOWN,
          contentHash(DEFAULT_DOCUMENT_MARKDOWN),
          timestamp,
          timestamp
        );
    });
    return workspace;
  }

  renameWorkspace(
    userId: string,
    workspaceId: string,
    name: string
  ): ApiWorkspace {
    this.requireWorkspace(userId, workspaceId);
    const timestamp = this.now();
    const normalizedName = normalizeWorkspaceName(name);
    this.db
      .prepare(
        `UPDATE workspaces
         SET name = ?, updated_at = ?
         WHERE id = ? AND user_id = ?`
      )
      .run(normalizedName, timestamp, workspaceId, userId);
    return this.requireWorkspace(userId, workspaceId);
  }

  getWorkspace(userId: string, workspaceId: string): ApiWorkspace | undefined {
    const row = this.db
      .prepare("SELECT * FROM workspaces WHERE id = ? AND user_id = ?")
      .get(workspaceId, userId) as WorkspaceRow | undefined;
    return row ? workspaceFromRow(row) : undefined;
  }

  listKnowledgeBases(
    userId: string,
    workspaceId: string
  ): ApiKnowledgeBase[] {
    this.requireWorkspace(userId, workspaceId);
    return (
      this.db
        .prepare(
          `SELECT * FROM knowledge_bases
           WHERE workspace_id = ?
           ORDER BY sort_order ASC, created_at ASC, name ASC`
        )
        .all(workspaceId) as KnowledgeBaseRow[]
    ).map(knowledgeBaseFromRow);
  }

  createKnowledgeBase(
    userId: string,
    workspaceId: string,
    input: { name: string }
  ): ApiKnowledgeBase {
    this.requireWorkspace(userId, workspaceId);
    const name = validateKnowledgeBaseName(input.name);
    this.assertKnowledgeBaseNameAvailable(workspaceId, name);
    const timestamp = this.now();
    const nextSortOrder = (
      this.db
        .prepare(
          `SELECT COALESCE(MAX(sort_order), -1) + 1 AS value
           FROM knowledge_bases
           WHERE workspace_id = ?`
        )
        .get(workspaceId) as { value: number }
    ).value;
    const knowledgeBase: ApiKnowledgeBase = {
      id: this.createId(),
      workspaceId: workspaceId as WorkspaceId,
      name,
      sortOrder: nextSortOrder,
      revision: 1,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO knowledge_bases
            (id, workspace_id, name, sort_order, revision, created_at, updated_at)
           VALUES (?, ?, ?, ?, 1, ?, ?)`
        )
        .run(
          knowledgeBase.id,
          workspaceId,
          name,
          nextSortOrder,
          timestamp,
          timestamp
        );
      this.touchWorkspace(workspaceId, timestamp);
    });
    return knowledgeBase;
  }

  renameKnowledgeBase(
    userId: string,
    workspaceId: string,
    knowledgeBaseId: string,
    input: { name: string; baseRevision: number; sortOrder?: number }
  ): ApiKnowledgeBase {
    this.requireWorkspace(userId, workspaceId);
    const current = this.requireKnowledgeBase(workspaceId, knowledgeBaseId);
    assertKnowledgeBaseRevision(
      knowledgeBaseId,
      input.baseRevision,
      current.revision
    );
    const name = validateKnowledgeBaseName(input.name);
    this.assertKnowledgeBaseNameAvailable(workspaceId, name, knowledgeBaseId);
    const sortOrder =
      input.sortOrder === undefined
        ? current.sort_order
        : validateSortOrder(input.sortOrder);
    const timestamp = this.now();
    this.db
      .prepare(
        `UPDATE knowledge_bases
         SET name = ?, sort_order = ?, revision = revision + 1, updated_at = ?
         WHERE id = ? AND workspace_id = ?`
      )
      .run(name, sortOrder, timestamp, knowledgeBaseId, workspaceId);
    this.touchWorkspace(workspaceId, timestamp);
    return knowledgeBaseFromRow(
      this.requireKnowledgeBase(workspaceId, knowledgeBaseId)
    );
  }

  deleteKnowledgeBase(
    userId: string,
    workspaceId: string,
    knowledgeBaseId: string,
    baseRevision: number
  ): DocumentSnapshot[] {
    this.requireWorkspace(userId, workspaceId);
    const knowledgeBase = this.requireKnowledgeBase(
      workspaceId,
      knowledgeBaseId
    );
    assertKnowledgeBaseRevision(
      knowledgeBaseId,
      baseRevision,
      knowledgeBase.revision
    );
    const documents = this.db
      .prepare(
        `SELECT * FROM documents
         WHERE workspace_id = ? AND knowledge_base_id = ?
           AND lifecycle = 'knowledge' AND deleted_at IS NULL
         ORDER BY updated_at ASC, path ASC, id ASC`
      )
      .all(workspaceId, knowledgeBaseId) as DocumentRow[];
    const timestamp = this.now();

    this.transaction(() => {
      const usedPaths = this.activeScratchPaths(workspaceId);
      for (const row of documents) {
        const current = documentFromRow(row);
        const nextPath = allocatePath(row.path, usedPaths);
        this.insertRevision(current, timestamp);
        this.db
          .prepare(
            `UPDATE documents
             SET lifecycle = 'scratch', knowledge_base_id = NULL,
                 archived_at = NULL, path = ?, revision = revision + 1,
                 updated_at = ?
             WHERE id = ? AND workspace_id = ?`
          )
          .run(nextPath, timestamp, row.id, workspaceId);
      }
      this.db
        .prepare(
          "DELETE FROM knowledge_bases WHERE id = ? AND workspace_id = ?"
        )
        .run(knowledgeBaseId, workspaceId);
      this.touchWorkspace(workspaceId, timestamp);
    });
    for (const row of documents) {
      this.syncDocumentSearch(workspaceId, row.id);
      const updated = this.requireDocument(workspaceId, row.id);
      this.refreshIncomingLinksForPath(
        workspaceId,
        row.path,
        row.id,
        updated.path
      );
    }

    return documents.map((row) =>
      this.readDocument(userId, workspaceId, row.id)
    );
  }

  listNotes(
    userId: string,
    workspaceId: string,
    sort: DocumentSort = "updated"
  ): ApiDocumentSummary[] {
    this.requireWorkspace(userId, workspaceId);
    return this.listDocumentSummaries(
      `workspace_id = ? AND lifecycle = 'scratch'
       AND knowledge_base_id IS NULL AND archived_at IS NULL
       AND deleted_at IS NULL`,
      [workspaceId],
      sort
    );
  }

  listRecentDocuments(
    userId: string,
    workspaceId: string
  ): ApiDocumentSummary[] {
    this.requireWorkspace(userId, workspaceId);
    return this.listDocumentSummaries(
      `workspace_id = ? AND last_opened_at IS NOT NULL AND deleted_at IS NULL`,
      [workspaceId],
      "recent"
    ).slice(0, 12);
  }

  listKnowledgeBaseDocuments(
    userId: string,
    workspaceId: string,
    knowledgeBaseId: string,
    sort: DocumentSort = "updated"
  ): ApiDocumentSummary[] {
    this.requireWorkspace(userId, workspaceId);
    this.requireKnowledgeBase(workspaceId, knowledgeBaseId);
    return this.listDocumentSummaries(
      `workspace_id = ? AND lifecycle = 'knowledge'
       AND knowledge_base_id = ? AND deleted_at IS NULL`,
      [workspaceId, knowledgeBaseId],
      sort
    );
  }

  searchDocuments(
    userId: string,
    workspaceId: string,
    input: { query: string; page?: number; pageSize?: number }
  ): ApiSearchPage {
    this.requireWorkspace(userId, workspaceId);
    const query = buildFtsQuery(input.query);
    const page = Math.max(1, Math.floor(input.page ?? 1));
    const pageSize = Math.min(50, Math.max(1, Math.floor(input.pageSize ?? 20)));
    if (!query) return { results: [], total: 0, page, pageSize };
    const offset = (page - 1) * pageSize;
    const rows = this.db
      .prepare(
        `SELECT d.*,
                snippet(document_search, 5, '<mark>', '</mark>', '…', 36)
                  AS snippet,
                bm25(
                  document_search,
                  0.0, 0.0, 0.0, 0.0,
                  8.0, 2.5, 4.0, 4.5, 5.0, 0.5
                )
                  AS rank
         FROM document_search
         JOIN documents d ON d.id = document_search.document_id
         WHERE document_search MATCH ?
           AND d.workspace_id = ?
           AND d.deleted_at IS NULL
         ORDER BY rank ASC, d.updated_at DESC, d.id ASC
         LIMIT ? OFFSET ?`
      )
      .all(query, workspaceId, pageSize, offset) as SearchRow[];
    const total = (
      this.db
        .prepare(
          `SELECT COUNT(*) AS count
           FROM document_search
           JOIN documents d ON d.id = document_search.document_id
           WHERE document_search MATCH ?
             AND d.workspace_id = ?
             AND d.deleted_at IS NULL`
        )
        .get(query, workspaceId) as { count: number }
    ).count;
    return {
      results: rows.map((row) => {
        const document = documentFromRow(row);
        const highlighted = highlightSearchSnippet(
          document.markdown,
          input.query
        );
        return {
          ...document.meta,
          excerpt: markdownExcerpt(document.markdown),
          snippet:
            highlighted ||
            row.snippet ||
            markdownExcerpt(document.markdown)
        };
      }),
      total,
      page,
      pageSize
    };
  }

  archiveDocument(
    userId: string,
    workspaceId: string,
    documentId: string,
    input: { knowledgeBaseId: string; baseRevision: number }
  ): DocumentSnapshot {
    this.requireWorkspace(userId, workspaceId);
    const currentRow = this.requireDocument(workspaceId, documentId);
    assertRevision(documentId, input.baseRevision, currentRow.revision);
    if (currentRow.lifecycle !== "scratch") {
      throw new ApiDatabaseError(
        409,
        "DOCUMENT_ALREADY_ARCHIVED",
        "该文档已在知识库中。"
      );
    }
    this.requireKnowledgeBase(workspaceId, input.knowledgeBaseId);
    const timestamp = this.now();
    const current = documentFromRow(currentRow);
    const nextPath = this.uniquePathForKnowledgeBase(
      workspaceId,
      input.knowledgeBaseId,
      currentRow.path
    );
    this.transaction(() => {
      this.insertRevision(current, timestamp);
      this.db
        .prepare(
          `UPDATE documents
           SET lifecycle = 'knowledge', knowledge_base_id = ?, path = ?,
               archived_at = ?, revision = revision + 1, updated_at = ?
           WHERE id = ? AND workspace_id = ?`
        )
        .run(
          input.knowledgeBaseId,
          nextPath,
          timestamp,
          timestamp,
          documentId,
          workspaceId
        );
      this.touchWorkspace(workspaceId, timestamp);
    });
    this.syncDocumentSearch(workspaceId, documentId);
    this.refreshIncomingLinksForPath(
      workspaceId,
      currentRow.path,
      documentId,
      nextPath
    );
    return this.readDocument(userId, workspaceId, documentId);
  }

  restoreDocumentToNotes(
    userId: string,
    workspaceId: string,
    documentId: string,
    baseRevision: number
  ): DocumentSnapshot {
    this.requireWorkspace(userId, workspaceId);
    const currentRow = this.requireDocument(workspaceId, documentId);
    assertRevision(documentId, baseRevision, currentRow.revision);
    if (currentRow.lifecycle !== "knowledge") {
      throw new ApiDatabaseError(
        409,
        "DOCUMENT_NOT_ARCHIVED",
        "该文档不在知识库中。"
      );
    }
    const timestamp = this.now();
    const current = documentFromRow(currentRow);
    const nextPath = allocatePath(
      currentRow.path,
      this.activeScratchPaths(workspaceId)
    );
    this.transaction(() => {
      this.insertRevision(current, timestamp);
      this.db
        .prepare(
          `UPDATE documents
           SET lifecycle = 'scratch', knowledge_base_id = NULL,
               archived_at = NULL, path = ?, revision = revision + 1,
               updated_at = ?
           WHERE id = ? AND workspace_id = ?`
        )
        .run(nextPath, timestamp, documentId, workspaceId);
      this.touchWorkspace(workspaceId, timestamp);
    });
    this.syncDocumentSearch(workspaceId, documentId);
    this.refreshIncomingLinksForPath(
      workspaceId,
      currentRow.path,
      documentId,
      nextPath
    );
    return this.readDocument(userId, workspaceId, documentId);
  }

  markDocumentOpened(
    userId: string,
    workspaceId: string,
    documentId: string,
    baseRevision: number
  ): DocumentSnapshot {
    this.requireWorkspace(userId, workspaceId);
    const current = this.requireDocument(workspaceId, documentId);
    assertRevision(documentId, baseRevision, current.revision);
    this.db
      .prepare(
        `UPDATE documents
         SET last_opened_at = ?, revision = revision + 1
         WHERE id = ? AND workspace_id = ?`
      )
      .run(this.now(), documentId, workspaceId);
    return this.readDocument(userId, workspaceId, documentId);
  }

  listTree(userId: string, workspaceId: string): WorkspaceNode {
    const workspace = this.requireWorkspace(userId, workspaceId);
    const documents = (
      this.db
        .prepare(
          `SELECT * FROM documents
           WHERE workspace_id = ? AND lifecycle = 'scratch'
             AND deleted_at IS NULL
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

  getDocumentContext(
    userId: string,
    workspaceId: string,
    documentId: string
  ): ApiDocumentContext {
    this.requireWorkspace(userId, workspaceId);
    const current = documentFromRow(
      this.requireDocument(workspaceId, documentId)
    );
    const outgoingRows = this.db
      .prepare(
        `SELECT links.*, source.title AS source_title,
                source.path AS source_path,
                source.lifecycle AS source_lifecycle,
                source.knowledge_base_id AS source_knowledge_base_id,
                source.markdown AS source_markdown,
                target.title AS target_title,
                target.lifecycle AS target_lifecycle,
                target.knowledge_base_id AS target_knowledge_base_id
         FROM document_links links
         JOIN documents source ON source.id = links.source_document_id
         LEFT JOIN documents target ON target.id = links.target_document_id
         WHERE links.workspace_id = ?
           AND links.source_document_id = ?
           AND source.deleted_at IS NULL
         ORDER BY links.updated_at DESC, links.id ASC`
      )
      .all(workspaceId, documentId) as DocumentLinkRow[];
    const backlinkRows = this.db
      .prepare(
        `SELECT links.*, source.title AS source_title,
                source.path AS source_path,
                source.lifecycle AS source_lifecycle,
                source.knowledge_base_id AS source_knowledge_base_id,
                source.markdown AS source_markdown,
                target.title AS target_title,
                target.lifecycle AS target_lifecycle,
                target.knowledge_base_id AS target_knowledge_base_id
         FROM document_links links
         JOIN documents source ON source.id = links.source_document_id
         LEFT JOIN documents target ON target.id = links.target_document_id
         WHERE links.workspace_id = ?
           AND links.target_document_id = ?
           AND source.deleted_at IS NULL
         ORDER BY links.updated_at DESC, links.id ASC`
      )
      .all(workspaceId, documentId) as DocumentLinkRow[];
    const assets = this.db
      .prepare(
        `SELECT assets.* FROM document_asset_refs refs
         JOIN assets ON assets.id = refs.asset_id
         WHERE refs.document_id = ?
         ORDER BY assets.created_at DESC`
      )
      .all(documentId) as AssetRow[];

    return {
      document: current.meta,
      outlineSource: current.markdown,
      outgoingLinks: outgoingRows.map((row) =>
        documentLinkFromRow(row, "outgoing")
      ),
      backlinks: backlinkRows.map((row) =>
        documentLinkFromRow(row, "incoming")
      ),
      assets: assets.map((asset) => {
        const value = assetFromRow(asset);
        return {
          id: value.id,
          hash: value.hash,
          mime: value.mime,
          size: value.size,
          kind: value.kind,
          createdAt: value.createdAt
        };
      }),
      revisions: this.listRevisions(userId, workspaceId, documentId).slice(0, 5)
    };
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
        lifecycle: "scratch",
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
          (id, workspace_id, lifecycle, knowledge_base_id, path, title,
           tags_json, markdown, extensions_json, revision, content_hash,
           created_at, updated_at, archived_at, last_opened_at, deleted_at)
         VALUES (?, ?, 'scratch', NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL)`
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
    this.syncDocumentAssetRefs(
      workspaceId,
      snapshot.meta.id,
      markdown,
      timestamp
    );
    this.syncDocumentSearch(workspaceId, snapshot.meta.id);
    this.syncDocumentLinks(workspaceId, snapshot.meta.id);
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
      checkpoint?: boolean;
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
      if (input.checkpoint !== false) {
        this.insertRevision(current, timestamp);
      }
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
      this.syncDocumentAssetRefs(
        workspaceId,
        documentId,
        input.markdown,
        timestamp
      );
      this.touchWorkspace(workspaceId, timestamp);
    });

    this.syncDocumentSearch(workspaceId, documentId);
    this.syncDocumentLinks(workspaceId, documentId);
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
    this.assertPathAvailable(
      workspaceId,
      path,
      documentId,
      currentRow.knowledge_base_id
    );
    const timestamp = this.now();
    this.db
      .prepare(
        `UPDATE documents
         SET path = ?, revision = revision + 1, updated_at = ?
         WHERE id = ? AND workspace_id = ?`
      )
      .run(path, timestamp, documentId, workspaceId);
    this.touchWorkspace(workspaceId, timestamp);
    this.refreshIncomingLinksForPath(
      workspaceId,
      currentRow.path,
      documentId,
      path
    );
    this.syncDocumentSearch(workspaceId, documentId);
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
    this.syncDocumentSearch(workspaceId, documentId);
    this.clearDocumentLinks(workspaceId, documentId, true);
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

  upsertAsset(
    userId: string,
    workspaceId: string,
    input: {
      hash: string;
      mime: string;
      size: number;
      kind: AssetKind;
      storageKey: string;
    }
  ): { asset: StoredAssetRecord; deduplicated: boolean } {
    this.requireWorkspace(userId, workspaceId);
    const existing = this.findAssetByHash(workspaceId, input.hash);
    if (existing) return { asset: existing, deduplicated: true };
    const asset: StoredAssetRecord = {
      id: this.createId(),
      workspaceId: workspaceId as WorkspaceId,
      hash: input.hash,
      mime: input.mime,
      size: input.size,
      kind: input.kind,
      storageKey: input.storageKey,
      createdAt: this.now()
    };
    this.db
      .prepare(
        `INSERT INTO assets
          (id, workspace_id, hash, mime, size, kind, storage_key, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        asset.id,
        asset.workspaceId,
        asset.hash,
        asset.mime,
        asset.size,
        asset.kind,
        asset.storageKey,
        asset.createdAt
      );
    return { asset, deduplicated: false };
  }

  getAsset(
    userId: string,
    workspaceId: string,
    hash: string
  ): StoredAssetRecord {
    this.requireWorkspace(userId, workspaceId);
    const asset = this.findAssetByHash(workspaceId, hash);
    if (!asset) {
      throw new ApiDatabaseError(404, "ASSET_NOT_FOUND", "找不到资产。");
    }
    return asset;
  }

  listUnreferencedAssets(
    userId: string,
    workspaceId: string,
    createdBefore: string
  ): StoredAssetRecord[] {
    this.requireWorkspace(userId, workspaceId);
    return (
      this.db
        .prepare(
          `SELECT assets.* FROM assets
           WHERE assets.workspace_id = ? AND assets.created_at <= ?
             AND NOT EXISTS (
               SELECT 1 FROM document_asset_refs
               WHERE document_asset_refs.asset_id = assets.id
             )
           ORDER BY assets.created_at ASC`
        )
        .all(workspaceId, createdBefore) as AssetRow[]
    ).map(assetFromRow);
  }

  deleteAssetRecord(
    userId: string,
    workspaceId: string,
    assetId: string
  ): void {
    this.requireWorkspace(userId, workspaceId);
    this.db
      .prepare("DELETE FROM assets WHERE id = ? AND workspace_id = ?")
      .run(assetId, workspaceId);
  }

  isAssetReferenced(
    userId: string,
    workspaceId: string,
    assetId: string
  ): boolean {
    this.requireWorkspace(userId, workspaceId);
    const row = this.db
      .prepare(
        `SELECT 1 AS referenced FROM document_asset_refs
         WHERE asset_id = ? LIMIT 1`
      )
      .get(assetId) as { referenced: number } | undefined;
    return Boolean(row);
  }

  private requireWorkspace(userId: string, workspaceId: string): ApiWorkspace {
    const workspace = this.getWorkspace(userId, workspaceId);
    if (!workspace) {
      throw new ApiDatabaseError(404, "WORKSPACE_NOT_FOUND", "找不到工作区。");
    }
    return workspace;
  }

  private findAssetByHash(
    workspaceId: string,
    hash: string
  ): StoredAssetRecord | undefined {
    const row = this.db
      .prepare(
        `SELECT * FROM assets
         WHERE workspace_id = ? AND hash = ?`
      )
      .get(workspaceId, hash) as AssetRow | undefined;
    return row ? assetFromRow(row) : undefined;
  }

  private requireKnowledgeBase(
    workspaceId: string,
    knowledgeBaseId: string
  ): KnowledgeBaseRow {
    const row = this.db
      .prepare(
        `SELECT * FROM knowledge_bases
         WHERE id = ? AND workspace_id = ?`
      )
      .get(knowledgeBaseId, workspaceId) as KnowledgeBaseRow | undefined;
    if (!row) {
      throw new ApiDatabaseError(
        404,
        "KNOWLEDGE_BASE_NOT_FOUND",
        "找不到知识库。"
      );
    }
    return row;
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
    exceptDocumentId?: string,
    knowledgeBaseId: string | null = null
  ): void {
    const row =
      knowledgeBaseId === null
        ? (this.db
            .prepare(
              `SELECT id FROM documents
               WHERE workspace_id = ? AND path = ? AND deleted_at IS NULL
                 AND lifecycle = 'scratch'`
            )
            .get(workspaceId, path) as { id: string } | undefined)
        : (this.db
            .prepare(
              `SELECT id FROM documents
               WHERE workspace_id = ? AND path = ? AND deleted_at IS NULL
                 AND lifecycle = 'knowledge' AND knowledge_base_id = ?`
            )
            .get(workspaceId, path, knowledgeBaseId) as
            | { id: string }
            | undefined);
    if (row && row.id !== exceptDocumentId) {
      throw new ApiDatabaseError(
        409,
        "DOCUMENT_PATH_CONFLICT",
        "同路径已存在文档，请更换文件名。"
      );
    }
  }

  private assertKnowledgeBaseNameAvailable(
    workspaceId: string,
    name: string,
    exceptKnowledgeBaseId?: string
  ): void {
    const row = this.db
      .prepare(
        `SELECT id FROM knowledge_bases
         WHERE workspace_id = ? AND name = ?`
      )
      .get(workspaceId, name) as { id: string } | undefined;
    if (row && row.id !== exceptKnowledgeBaseId) {
      throw new ApiDatabaseError(
        409,
        "KNOWLEDGE_BASE_NAME_CONFLICT",
        "同名知识库已存在。"
      );
    }
  }

  private activeScratchPaths(workspaceId: string): Set<string> {
    return new Set(
      (
        this.db
          .prepare(
            `SELECT path FROM documents
             WHERE workspace_id = ? AND lifecycle = 'scratch'
               AND deleted_at IS NULL`
          )
          .all(workspaceId) as Array<{ path: string }>
      ).map((row) => row.path.toLowerCase())
    );
  }

  private uniquePathForKnowledgeBase(
    workspaceId: string,
    knowledgeBaseId: string,
    desiredPath: string
  ): WorkspacePath {
    const usedPaths = new Set(
      (
        this.db
          .prepare(
            `SELECT path FROM documents
             WHERE workspace_id = ? AND lifecycle = 'knowledge'
               AND knowledge_base_id = ? AND deleted_at IS NULL`
          )
          .all(workspaceId, knowledgeBaseId) as Array<{ path: string }>
      ).map((row) => row.path.toLowerCase())
    );
    return allocatePath(desiredPath, usedPaths);
  }

  private listDocumentSummaries(
    whereSql: string,
    parameters: readonly string[],
    sort: DocumentSort | "recent"
  ): ApiDocumentSummary[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM documents
         WHERE ${whereSql}
         ORDER BY ${documentOrder(sort)}`
      )
      .all(...parameters) as DocumentRow[];
    return rows.map((row) => {
      const document = documentFromRow(row);
      return {
        ...document.meta,
        excerpt: markdownExcerpt(document.markdown)
      };
    });
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

  private syncDocumentAssetRefs(
    workspaceId: string,
    documentId: string,
    markdown: string,
    timestamp: string
  ): void {
    this.db
      .prepare("DELETE FROM document_asset_refs WHERE document_id = ?")
      .run(documentId);
    const hashes = [
      ...new Set(
        [...markdown.matchAll(/assets\/([a-f0-9]{64})(?:\.[A-Za-z0-9]+)?/gi)]
          .map((match) => match[1]?.toLowerCase())
          .filter((hash): hash is string => Boolean(hash))
      )
    ];
    const insert = this.db.prepare(
      `INSERT OR IGNORE INTO document_asset_refs
        (document_id, asset_id, created_at)
       SELECT ?, id, ? FROM assets
       WHERE workspace_id = ? AND hash = ?`
    );
    for (const hash of hashes) {
      insert.run(documentId, timestamp, workspaceId, hash);
    }
  }

  private syncDocumentSearch(workspaceId: string, documentId: string): void {
    this.db
      .prepare(
        "DELETE FROM document_search WHERE document_id = ? AND workspace_id = ?"
      )
      .run(documentId, workspaceId);
    const row = this.db
      .prepare(
        `SELECT * FROM documents
         WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL`
      )
      .get(documentId, workspaceId) as DocumentRow | undefined;
    if (!row) return;
    const tags = parseTags(row.tags_json);
    const tagText = tags.join(" ");
    const filename = filenameFromPath(row.path);
    this.db
      .prepare(
        `INSERT INTO document_search
          (document_id, workspace_id, lifecycle, knowledge_base_id, title,
           markdown, tags, path, filename, search_terms)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        row.id,
        row.workspace_id,
        row.lifecycle,
        row.knowledge_base_id,
        row.title,
        row.markdown,
        tagText,
        row.path,
        filename,
        searchIndexTerms(
          `${row.title}\n${row.markdown}\n${tagText}\n${row.path}`
        ).join(" ")
      );
  }

  private syncDocumentLinks(workspaceId: string, documentId: string): void {
    this.db
      .prepare(
        "DELETE FROM document_links WHERE source_document_id = ? AND workspace_id = ?"
      )
      .run(documentId, workspaceId);
    const source = this.db
      .prepare(
        `SELECT * FROM documents
         WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL`
      )
      .get(documentId, workspaceId) as DocumentRow | undefined;
    if (!source) return;
    const timestamp = this.now();
    const insert = this.db.prepare(
      `INSERT INTO document_links
        (id, workspace_id, source_document_id, target_document_id, target_path,
         link_text, anchor, broken, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const link of extractDocumentLinks(source.markdown)) {
      const withExtension = /\.md$/i.test(link.targetPath)
        ? link.targetPath
        : `${link.targetPath}.md`;
      const target = this.db
        .prepare(
          `SELECT id FROM documents
           WHERE workspace_id = ? AND deleted_at IS NULL
             AND (path = ? OR path = ? OR path LIKE ? OR title = ?)
           ORDER BY CASE WHEN path = ? THEN 0 WHEN path = ? THEN 1 ELSE 2 END
           LIMIT 1`
        )
        .get(
          workspaceId,
          link.targetPath,
          withExtension,
          `%/${withExtension}`,
          link.targetPath,
          link.targetPath,
          withExtension
        ) as { id: string } | undefined;
      insert.run(
        this.createId(),
        workspaceId,
        documentId,
        target?.id ?? null,
        link.targetPath,
        link.linkText,
        link.anchor ?? null,
        target ? 0 : 1,
        timestamp
      );
    }
    this.db
      .prepare(
        `UPDATE document_links
         SET target_document_id = ?, broken = 0, updated_at = ?
         WHERE workspace_id = ?
           AND (
             target_path = ? OR target_path = ? OR target_path = ?
             OR target_path LIKE ?
           )`
      )
      .run(
        documentId,
        timestamp,
        workspaceId,
        source.path,
        source.title,
        source.path.replace(/\.md$/i, ""),
        `%/${source.path.replace(/\.md$/i, "")}`
      );
  }

  private refreshIncomingLinksForPath(
    workspaceId: string,
    oldPath: string,
    documentId: string,
    newPath: string
  ): void {
    this.db
      .prepare(
        `UPDATE document_links
         SET target_document_id = ?, target_path = ?, broken = 0, updated_at = ?
         WHERE workspace_id = ? AND (target_document_id = ? OR target_path = ?)`
      )
      .run(
        documentId,
        newPath,
        this.now(),
        workspaceId,
        documentId,
        oldPath
      );
  }

  private clearDocumentLinks(
    workspaceId: string,
    documentId: string,
    targetDeleted: boolean
  ): void {
    this.db
      .prepare(
        "DELETE FROM document_links WHERE source_document_id = ? AND workspace_id = ?"
      )
      .run(documentId, workspaceId);
    if (targetDeleted) {
      this.db
        .prepare(
          `UPDATE document_links
           SET target_document_id = NULL, broken = 1, updated_at = ?
           WHERE target_document_id = ? AND workspace_id = ?`
        )
        .run(this.now(), documentId, workspaceId);
    }
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

function validateKnowledgeBaseName(value: string): string {
  const name = value.trim().slice(0, 80);
  if (!name) {
    throw new ApiDatabaseError(
      400,
      "INVALID_KNOWLEDGE_BASE_NAME",
      "知识库名称不能为空。"
    );
  }
  return name;
}

function validateSortOrder(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new ApiDatabaseError(
      400,
      "INVALID_SORT_ORDER",
      "排序值必须是非负整数。"
    );
  }
  return value;
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

function assertKnowledgeBaseRevision(
  knowledgeBaseId: string,
  expectedRevision: number,
  actualRevision: number
): void {
  if (expectedRevision !== actualRevision) {
    throw new ApiDatabaseError(
      409,
      "KNOWLEDGE_BASE_REVISION_CONFLICT",
      `知识库 ${knowledgeBaseId} 已被其他会话修改。`
    );
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

function knowledgeBaseFromRow(row: KnowledgeBaseRow): ApiKnowledgeBase {
  return {
    id: row.id,
    workspaceId: row.workspace_id as WorkspaceId,
    name: row.name,
    sortOrder: row.sort_order,
    revision: row.revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function assetFromRow(row: AssetRow): StoredAssetRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id as WorkspaceId,
    hash: row.hash,
    mime: row.mime,
    size: row.size,
    kind: row.kind,
    storageKey: row.storage_key,
    createdAt: row.created_at
  };
}

function documentFromRow(row: DocumentRow): DocumentSnapshot {
  const meta: DocumentMeta = {
    id: row.id,
    workspaceId: row.workspace_id as WorkspaceId,
    lifecycle: row.lifecycle,
    knowledgeBaseId: row.knowledge_base_id ?? undefined,
    path: workspacePath(row.path),
    title: row.title,
    tags: parseTags(row.tags_json),
    revision: row.revision,
    contentHash: row.content_hash as ContentHash,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at ?? undefined,
    lastOpenedAt: row.last_opened_at ?? undefined
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
      lifecycle: "scratch",
      knowledge_base_id: null,
      path: "历史版本.md",
      title: row.title,
      tags_json: row.tags_json,
      markdown: row.markdown,
      extensions_json: row.extensions_json,
      revision: row.revision,
      content_hash: row.content_hash,
      created_at: row.created_at,
      updated_at: row.created_at,
      archived_at: null,
      last_opened_at: null
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

function allocatePath(
  desiredPath: string,
  usedPaths: Set<string>
): WorkspacePath {
  const fileNameValue = fileName(desiredPath);
  const dotIndex = fileNameValue.lastIndexOf(".");
  const stem = dotIndex > 0 ? fileNameValue.slice(0, dotIndex) : fileNameValue;
  const extension = dotIndex > 0 ? fileNameValue.slice(dotIndex) : "";
  let sequence = 1;
  let candidate = fileNameValue;
  while (usedPaths.has(candidate.toLowerCase())) {
    sequence += 1;
    candidate = `${stem} (${sequence})${extension}`;
  }
  usedPaths.add(candidate.toLowerCase());
  return workspacePath(candidate);
}

function documentOrder(sort: DocumentSort | "recent"): string {
  switch (sort) {
    case "created":
      return "created_at DESC, id ASC";
    case "title":
      return "title COLLATE NOCASE ASC, updated_at DESC, id ASC";
    case "recent":
      return "last_opened_at DESC, updated_at DESC, id ASC";
    case "updated":
      return "updated_at DESC, id ASC";
  }
}

function markdownExcerpt(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~|-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

function documentLinkFromRow(
  row: DocumentLinkRow,
  direction: "incoming" | "outgoing"
): ApiDocumentLink {
  const sourceTitle = row.source_title ?? "未知文档";
  const sourcePath = row.source_path ?? "";
  const title = direction === "outgoing" ? row.target_title ?? row.target_path : sourceTitle;
  const path = direction === "outgoing" ? row.target_path : sourcePath;
  return {
    documentId:
      direction === "outgoing"
        ? row.target_document_id ?? ""
        : row.source_document_id,
    title,
    path,
    lifecycle:
      direction === "incoming"
        ? row.source_lifecycle ?? "scratch"
        : row.target_lifecycle ?? "scratch",
    ...((direction === "incoming"
      ? row.source_knowledge_base_id
      : row.target_knowledge_base_id)
      ? {
          knowledgeBaseId: (direction === "incoming"
            ? row.source_knowledge_base_id
            : row.target_knowledge_base_id) as KnowledgeBaseId
        }
      : {}),
    linkText: row.link_text,
    targetPath: row.target_path,
    ...(row.anchor ? { anchor: row.anchor } : {}),
    snippet: linkSnippet(row.source_markdown ?? "", row.link_text, row.target_path),
    broken: Boolean(row.broken)
  };
}

function linkSnippet(
  markdown: string,
  linkText: string,
  targetPath: string
): string {
  const line = markdown
    .split(/\r?\n/)
    .find(
      (candidate) =>
        candidate.includes(targetPath) ||
        (linkText.length > 0 && candidate.includes(linkText))
    );
  return (line?.trim() || markdownExcerpt(markdown)).slice(0, 180);
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
