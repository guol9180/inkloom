# InkLoom Product and Architecture

版本：1.0
日期：2026-11-24
状态：M1.1 production baseline

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
[ux-and-editor-spec.md](./ux-and-editor-spec.md).

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

| Area                  | Choice                                                                      |
| --------------------- | --------------------------------------------------------------------------- |
| Web                   | React 19, TypeScript, Vite, React Router                                    |
| Styling               | Tailwind CSS 4, semantic design tokens                                      |
| UI primitives         | Radix Dialog, Dropdown Menu, accessible custom components                   |
| Server state          | TanStack Query                                                              |
| Forms                 | React Hook Form, Zod                                                        |
| Local transient state | Zustand                                                                     |
| Editor                | Milkdown / ProseMirror / Remark                                             |
| Code editing          | CodeMirror 6 only inside code and diagram source nodes                      |
| Diagrams              | Mermaid, Excalidraw                                                         |
| Icons                 | Lucide                                                                      |
| API                   | Node.js 22 using `node:http`                                                |
| Data                  | SQLite with WAL                                                             |
| Search                | SQLite FTS5                                                                 |
| Assets                | Content-addressed files on a persistent volume; S3-compatible adapter later |

The editor kernel, product shell and rejected alternatives are recorded in
[ADR 0006](../adr/0006-notes-knowledge-base-and-editor-shell.md). Current editor
structure is in [editor-architecture.md](./editor-architecture.md).

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

Package-boundary rationale is recorded in
[ADR 0004](../adr/0004-package-boundaries.md); the parked desktop scaffold
exception is in [ADR 0007](../adr/0007-desktop-scaffold-ordering-exception.md).

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
[ADR 0005](../adr/0005-mobile-ready-foundation.md).

## 7. Related Specifications

- [数据与 API](./data-and-api.md)
- [编辑器架构](./editor-architecture.md)
- [安全与性能](./security-and-performance.md)

## 8. Evolution

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
