# InkLoom Data and API

本文件维护数据模型、API 契约与搜索实现。产品边界、仓库结构和演进见
[产品与技术方案](./product-and-architecture.md)，工程约束见
[AGENTS.md](../../AGENTS.md)。

## 1. Data Architecture

### 1.1 Current Tables

The production database contains:

- `users`
- `sessions`
- `workspaces`
- `documents`
- `document_revisions`

Schema migrations are additive and versioned; applying them must not rewrite
existing production data.

### 1.2 Target Tables

```text
users
sessions
workspaces
knowledge_bases
documents
document_revisions
assets
document_asset_refs
document_links
schema_migrations
```

### 1.3 Documents

Target document metadata includes:

```ts
type DocumentMeta = {
  id: string;
  workspaceId: string;
  lifecycle: "scratch" | "knowledge";
  knowledgeBaseId?: string;
  path: string;
  title: string;
  tags: readonly string[];
  revision: number;
  contentHash: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  lastOpenedAt?: string;
};
```

The Markdown body is stored in `documents.markdown`. Extensions remain limited to
small structured data; large canvas scenes are assets.

### 1.4 History

Every successful document write advances the document revision. History
checkpoints are selected snapshots, not necessarily every autosave.

Policy:

- Idle checkpoint after about 2 seconds.
- Maximum checkpoint interval of 30 seconds during continuous editing.
- Explicit checkpoints on manual save, title change, diagram replacement and
  restore.
- Retain 30 days or 200 checkpoints by default.
- Deduplicate equal content hashes.

### 1.5 Assets

```ts
type AssetMeta = {
  id: string;
  workspaceId: string;
  hash: string;
  mime: string;
  size: number;
  kind: "image" | "attachment" | "excalidraw" | "svg";
  createdAt: string;
};
```

Rules:

- Key by SHA-256 content hash within a workspace.
- Store immutable bytes on a persistent volume.
- Do not store binary content in document JSON.
- Link documents through `document_asset_refs`.
- Clean only unreferenced assets after a safety window.
- Keep the adapter replaceable with S3-compatible storage.

### 1.6 Links

The link index stores:

```ts
type DocumentLink = {
  sourceDocumentId: string;
  targetDocumentId?: string;
  targetPath: string;
  linkText: string;
  anchor?: string;
  broken: boolean;
};
```

Update the index in the same transaction as document saves or archive/move
operations. Backlinks must not use full-workspace string matching.

## 2. API Design

Existing authentication and revision error semantics remain valid. New Web
routes are additive.

### 2.1 Workspace and Navigation

```text
GET    /api/auth/me
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout

GET    /api/workspaces
POST   /api/workspaces
PATCH  /api/workspaces/:workspaceId

GET    /api/workspaces/:workspaceId/notes
GET    /api/workspaces/:workspaceId/notes/recent
GET    /api/workspaces/:workspaceId/trash

GET    /api/workspaces/:workspaceId/knowledge-bases
POST   /api/workspaces/:workspaceId/knowledge-bases
PATCH  /api/workspaces/:workspaceId/knowledge-bases/:knowledgeBaseId
PUT    /api/workspaces/:workspaceId/knowledge-bases/order
DELETE /api/workspaces/:workspaceId/knowledge-bases/:knowledgeBaseId
GET    /api/workspaces/:workspaceId/knowledge-bases/:knowledgeBaseId/documents
```

### 2.2 Documents

```text
GET    /api/workspaces/:workspaceId/documents/:documentId
POST   /api/workspaces/:workspaceId/documents
PUT    /api/workspaces/:workspaceId/documents/:documentId
DELETE /api/workspaces/:workspaceId/documents/:documentId

POST   /api/workspaces/:workspaceId/documents/:documentId/archive
POST   /api/workspaces/:workspaceId/documents/:documentId/restore-to-notes
POST   /api/workspaces/:workspaceId/documents/:documentId/open
POST   /api/workspaces/:workspaceId/documents/:documentId/restore
DELETE /api/workspaces/:workspaceId/documents/:documentId/permanent
```

All writes include a `baseRevision`.

The metadata-only `open` route updates `lastOpenedAt` without advancing the
document content revision. Knowledge-base ordering is submitted as one
revision-checked array and committed atomically.

`DELETE /nodes/:nodeId` sets `deleted_at`, advances the revision, removes the
document from FTS and clears its source links. `POST /restore` reinserts the
document into FTS, resolves incoming links, allocates a conflict-free path when
needed and creates a revision checkpoint. Permanent deletion is allowed only
for an already trashed document and removes its search row before cascading the
document, revisions and asset-reference rows.

### 2.3 Search and History

```text
GET  /api/workspaces/:workspaceId/search?q=...&scope=all|notes|knowledge
GET  /api/workspaces/:workspaceId/documents/:documentId/revisions
POST /api/workspaces/:workspaceId/documents/:documentId/revisions/:revisionId/restore
```

### 2.4 Assets

```text
POST /api/workspaces/:workspaceId/assets
GET  /api/workspaces/:workspaceId/assets/:hash
GET  /api/workspaces/:workspaceId/assets/:hash/info
```

Upload raw binary with metadata headers. Avoid Base64 and in-memory multipart
buffering for large files.

### 2.5 Error Contract

```ts
type ApiError = {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
};
```

Revision conflict:

```json
{
  "error": {
    "code": "REVISION_CONFLICT",
    "message": "文档已被其他会话修改，请刷新后处理。",
    "details": {
      "documentId": "doc_...",
      "expectedRevision": 12,
      "actualRevision": 14
    }
  }
}
```

## 3. Search

Use SQLite FTS5 as the Web search engine.

Index:

- title.
- Markdown body.
- tags.
- workspace-relative path.
- filename.

Chinese search must use a tested bigram or trigram strategy. Search must return
snippets and categorized results without loading the whole workspace into the
browser.
