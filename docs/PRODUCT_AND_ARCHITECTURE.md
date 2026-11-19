# InkLoom Product and Architecture

版本：1.0
日期：2026-11-19
状态：Web-first M1.1 baseline

## 1. Product Definition

InkLoom is a Markdown-native knowledge workspace for writing notes and gradually
organizing them into durable knowledge bases.

The primary product loop is:

```text
Quickly write a scratch note
  -> refine and tag it
  -> archive it into one knowledge base
  -> read it in a calm preview-first mode
  -> explicitly enter edit mode when it needs to change
```

The first product principle is:

> Markdown is the canonical document format. The application may add structure
> around Markdown, but must not make user content depend on an opaque rich-text
> JSON document.

Detailed interaction, visual and editor behavior is specified in
[UX_AND_EDITOR_SPEC.md](./UX_AND_EDITOR_SPEC.md).

## 2. Product Scope

### 2.1 Current M1.1 Scope

- Web application only.
- Accounts and HttpOnly sessions.
- Multiple isolated workspaces.
- Scratch notes.
- Flat knowledge bases.
- Archive and return-to-scratch workflows.
- Preview-first reading for knowledge-base documents.
- Milkdown / ProseMirror editor with a product-level editor shell.
- Markdown fidelity and unknown-syntax preservation.
- Mermaid and Excalidraw blocks.
- Image and attachment assets.
- Full-text search.
- Backlinks, outline, version history and revision conflict handling.
- Responsive UI from 320px to 2560px.

### 2.2 Explicit Non-Goals

- Desktop client implementation.
- Mobile and HarmonyOS implementation.
- Offline cross-device synchronization.
- Real-time collaboration, comments and team permissions.
- Public sharing.
- Third-party document embeds.
- AI features as part of the critical editing path.

These capabilities remain designed-for, but not implemented in M1.1.

## 3. Core Product Model

### 3.1 Workspace

A workspace is the isolation boundary for documents, knowledge bases, tags,
assets, search indexes and history.

```ts
type Workspace = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};
```

### 3.2 Scratch Note

A scratch note is a directly editable Markdown document without user-managed
folders.

Properties:

- Flat navigation list.
- Tags.
- Direct edit on open.
- Can be archived into exactly one knowledge base.
- No fixed folders such as “Personal” or “Work” are created by the product.

### 3.3 Knowledge Base

A knowledge base is a user-created top-level container.

- Knowledge-base documents are stored flat.
- There are no groups, nested knowledge bases or internal folders.
- A document belongs to at most one knowledge base.
- Knowledge-base documents open in read-only preview by default.
- Editing requires an explicit user action.
- Deleting a knowledge base returns its documents to scratch.

```ts
type KnowledgeBase = {
  id: string;
  workspaceId: string;
  name: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};
```

### 3.4 Document Lifecycle

```ts
type DocumentLifecycle = "scratch" | "knowledge";

type DocumentLocation = {
  lifecycle: DocumentLifecycle;
  knowledgeBaseId?: string;
  archivedAt?: string;
};
```

Invariant:

```text
scratch   -> knowledgeBaseId is undefined
knowledge -> knowledgeBaseId is required
```

Dashboard routes, save state and default mode derive from these values.

## 4. Technical Stack

| Area | Choice |
| --- | --- |
| Web | React 19, TypeScript, Vite, React Router |
| Styling | Tailwind CSS 4, semantic design tokens |
| UI primitives | Radix Dialog, Dropdown Menu, accessible custom components |
| Server state | TanStack Query |
| Forms | React Hook Form, Zod |
| Local transient state | Zustand |
| Editor | Milkdown / ProseMirror / Remark |
| Code editing | CodeMirror 6 only inside code and diagram source nodes |
| Diagrams | Mermaid, Excalidraw |
| Icons | Lucide |
| API | Node.js 22 using `node:http` |
| Data | SQLite with WAL |
| Search | SQLite FTS5 |
| Assets | Content-addressed files on a persistent volume; S3-compatible adapter later |

The editor decision is intentional:

- Milkdown / ProseMirror remains because Markdown is the canonical format.
- Crepe defaults are not treated as the complete product UI.
- A product-level command registry and editor shell own toolbar, slash menu,
  block handles and contextual tools.
- Custom NodeViews own diagrams, assets, tables and extended blocks.

Rationale is captured in
[ADR 0006](./adr/0006-notes-knowledge-base-and-editor-shell.md).

## 5. Repository and Dependency Direction

```text
apps/web
apps/desktop              future Tauri host
apps/mobile-tauri         future Tauri mobile host
apps/harmony              future ArkUI + ArkWeb host
        |
        +-> packages/ui ----+
        +-> packages/editor +-> packages/core
        +-> packages/diagrams
        +-> packages/storage
        +-> packages/sync

services/api -> packages/core
```

Rules:

- `packages/core` remains platform-neutral.
- Storage behavior is exposed through adapters.
- Editor domain code does not directly access disk, database or network.
- Web UI may consume Cloud adapters, but domain contracts do not depend on Web.
- Future hosts reuse core document, lifecycle, revision, asset and command
  contracts.
- Do not extract speculative abstractions before a second host or real duplicate
  exists; preserve seams through contracts instead.

## 6. Web-First, Host-Ready Boundary

M1.1 implements only the Web host. Future hosts must be able to join without
redefining document semantics.

Required seams:

1. Stable document and workspace IDs.
2. Logical `WorkspacePath`, never raw native or browser filesystem paths.
3. `WorkspaceAdapter` for tree/document operations.
4. `AssetAdapter` for content-addressed put/get/metadata operations.
5. Revision checks on every write.
6. Platform capability reporting rather than user-agent branching.
7. Versioned platform bridge for mobile and HarmonyOS.
8. Editor command contracts that do not depend on a React Router route or DOM
   event.
9. API error codes that can be mapped by desktop and mobile clients.
10. A clear separation between canonical Markdown and host-local drafts.

Detailed cross-platform invariants remain in
[ADR 0005](./adr/0005-mobile-ready-foundation.md).

## 7. Data Architecture

### 7.1 Existing M1 Tables

The production database currently contains:

- `users`
- `sessions`
- `workspaces`
- `documents`
- `document_revisions`

T25 adds additive schema migrations rather than rewriting the production DB.

### 7.2 Target Tables

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

### 7.3 Documents

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

### 7.4 History

Every successful document write advances the document revision. History
checkpoints are selected snapshots, not necessarily every autosave.

Policy:

- Idle checkpoint after about 2 seconds.
- Maximum checkpoint interval of 30 seconds during continuous editing.
- Explicit checkpoints on manual save, title change, diagram replacement and
  restore.
- Retain 30 days or 200 checkpoints by default.
- Deduplicate equal content hashes.

### 7.5 Assets

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

### 7.6 Links

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

## 8. API Design

Existing authentication and revision error semantics remain valid. New Web
routes are additive.

### 8.1 Workspace and Navigation

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

GET    /api/workspaces/:workspaceId/knowledge-bases
POST   /api/workspaces/:workspaceId/knowledge-bases
PATCH  /api/workspaces/:workspaceId/knowledge-bases/:knowledgeBaseId
DELETE /api/workspaces/:workspaceId/knowledge-bases/:knowledgeBaseId
GET    /api/workspaces/:workspaceId/knowledge-bases/:knowledgeBaseId/documents
```

### 8.2 Documents

```text
GET    /api/workspaces/:workspaceId/documents/:documentId
POST   /api/workspaces/:workspaceId/documents
PUT    /api/workspaces/:workspaceId/documents/:documentId
DELETE /api/workspaces/:workspaceId/documents/:documentId

POST   /api/workspaces/:workspaceId/documents/:documentId/archive
POST   /api/workspaces/:workspaceId/documents/:documentId/restore-to-notes
```

All writes include a `baseRevision`.

### 8.3 Search and History

```text
GET  /api/workspaces/:workspaceId/search?q=...&scope=all|notes|knowledge
GET  /api/workspaces/:workspaceId/documents/:documentId/revisions
POST /api/workspaces/:workspaceId/documents/:documentId/revisions/:revisionId/restore
```

### 8.4 Assets

```text
POST /api/workspaces/:workspaceId/assets
GET  /api/workspaces/:workspaceId/assets/:hash
GET  /api/workspaces/:workspaceId/assets/:hash/info
```

Upload raw binary with metadata headers. Avoid Base64 and in-memory multipart
buffering for large files.

### 8.5 Error Contract

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

## 9. Search

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

## 10. Editor Architecture

```text
Milkdown / ProseMirror
  schema, selection, IME, undo, Markdown parsing

Editor Command Registry
  one command definition per operation

Editor Shell
  fixed toolbar, slash menu, block handles, contextual tools

NodeViews
  Mermaid, Excalidraw, tables, images, files and extended blocks

Asset layer
  scene, SVG, image and attachment storage

Markdown codec
  source slices, canonical serialization and unknown-node preservation
```

Milkdown and ProseMirror remain the lowest-risk choice because:

- Markdown is a first-class representation.
- ProseMirror provides strong schema, selection and custom NodeView support.
- The same editor command layer can later run inside Tauri and mobile hosts.
- Tiptap and Lexical do not remove the need to build the product UI and Markdown
  fidelity layer; they would add a JSON/HTML conversion boundary.

## 11. Security

- Passwords use scrypt with per-user salts.
- Session tokens are hashed in storage and sent only in HttpOnly, SameSite=Lax,
  Secure cookies in production.
- CORS allows only configured Web origins.
- API validates workspace ownership and body size.
- Markdown HTML renders through an allowlist and sanitization.
- Mermaid uses `securityLevel: "strict"`.
- SVG assets are sanitized before inline rendering.
- Unsafe attachments download with `Content-Disposition: attachment`.
- Asset URLs enforce workspace authorization.
- Logs never contain document bodies, passwords, session tokens or asset bytes.
- Rate-limit authentication and asset upload endpoints.

## 12. Performance Targets

| Operation | Target |
| --- | --- |
| First workspace shell | under 1s on a warm API |
| Document switch | P95 under 150ms after selection |
| Autosave network start | within 800ms after input stops |
| Search | P95 under 120ms for 1,000 documents |
| Mermaid initial render | under 500ms for typical diagrams |
| Excalidraw first open | lazy-loaded, under 1.5s on a normal connection |
| UI interaction | visually stable near 60fps |

Engineering requirements:

- Lazy-load Excalidraw and large diagram dependencies.
- Do not load all document bodies to render the navigation.
- Use cursor pagination for document and search lists.
- Use skeleton screens with stable dimensions.
- Avoid layout thrash during editor and drawer transitions.

## 13. Evolution

### M1.1

Web product loop, editor shell, assets and knowledge flow.

### M1D

Desktop file-first host after the shared document and editor contracts settle.

### M2

Offline queue and bidirectional synchronization.

### M3

Real-time collaboration, permissions and comments.

### M4

Mobile and HarmonyOS hosts.

Future hosts must extend adapters and commands, not fork Markdown semantics or
copy product business rules into platform-specific UI.
