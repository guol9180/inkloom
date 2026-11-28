# InkLoom

Markdown-native notes and knowledge workspace for text, diagrams and the web.

InkLoom helps users capture quickly as scratch notes, then archive selected
documents into flat knowledge bases for long-term reading and maintenance.
Markdown remains the canonical document format.

## Current Status

The production Web MVP is available at:

- Web: `https://inkloom.imhgl.com`
- API: `https://api.inkloom.imhgl.com`

The current production release is **M1.1: product-grade editor and knowledge
workflow**, and supports:

- Email registration, login, logout and HttpOnly sessions.
- Multiple user-isolated cloud workspaces with an in-product create flow.
- Flat scratch notes and user-created knowledge bases.
- Markdown documents, tags, revisions, history, search and conflict copies.
- Recoverable document trash with restore and permanent deletion.
- Product-level Milkdown editing, preview-first knowledge documents and a
  responsive Web UI.
- Content-addressed assets, Mermaid and Excalidraw editing.

The M1.1 release is complete. Further desktop, synchronization, collaboration
and mobile milestones remain paused until explicitly approved in
[DEVELOP_PLAN.md](./DEVELOP_PLAN.md).

## Product Model

```text
Workspace
  ├─ Scratch
  │    └─ flat, directly editable Markdown notes with tags
  ├─ Knowledge
       └─ user-created knowledge bases
            └─ flat Markdown documents, preview-first
  └─ Trash
       └─ deleted documents, restorable
```

- Scratch notes do not use user-managed folders.
- A knowledge base is a top-level library, not a group.
- Knowledge-base documents have no internal folder hierarchy.
- Archiving moves one scratch note into one knowledge base.
- Deleting a knowledge base returns its documents to scratch.

## Architecture Snapshot

```text
apps/
  web/             active Web client
  desktop/         parked Tauri scaffold
  mobile-tauri/    future mobile host placeholder
  harmony/         future HarmonyOS host placeholder

packages/
  core/            platform-neutral domain contracts
  editor/          Markdown helpers and editor contracts
  diagrams/        Mermaid and Excalidraw integration
  storage/         workspace and asset adapters
  sync/            future offline and collaboration boundary
  ui/              shared design primitives

services/
  api/             Web API and persistence
```

M1.1 implements only Web UI and cloud persistence. Domain contracts, storage
adapters and editor commands must remain host-independent so desktop, mobile,
HarmonyOS and future sync clients can integrate without redefining document
semantics.

## Web Stack

- React 19 and TypeScript.
- Vite and React Router.
- Tailwind CSS 4 with Notion-like neutral paper design tokens.
- TanStack Query, React Hook Form and Zod.
- Milkdown / ProseMirror / Remark for Markdown.
- CodeMirror 6 only inside code and diagram source nodes.
- Radix primitives, cmdk, Vaul, Sonner, Floating UI and dnd-kit.
- React Aria Components for accessible document lists.
- Lucide icons, React Dropzone and an on-demand image lightbox.
- Node.js 22, SQLite WAL, SQLite FTS5 and content-addressed assets.

The product and architecture rationale is in
[product-and-architecture.md](./docs/agents/product-and-architecture.md).
Detailed editor, UI, motion, typography, save and responsive behavior is in
[ux-and-editor-spec.md](./docs/agents/ux-and-editor-spec.md).

## Quick Start

Requirements:

- Node.js 22.12 or newer.
- pnpm 12.5.1.

Install dependencies:

```bash
corepack enable
pnpm install
```

Run API and Web in separate terminals:

```bash
pnpm dev:api
pnpm dev:web
```

Local URLs:

- Web: `http://127.0.0.1:4173`
- API: `http://127.0.0.1:3001`

Build and verification:

```bash
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm test:coverage
pnpm build
pnpm test:e2e
```

Additional environment details are in [.env.example](./.env.example) and
[deployment.md](./docs/agents/deployment.md).

## Documentation

- [AGENTS.md](./AGENTS.md): engineering rules and package boundaries.
- [DEVELOP_PLAN.md](./DEVELOP_PLAN.md): tasks, progress and acceptance.
- [HANDOFF.md](./HANDOFF.md): current state and handoff instructions.
- [product-and-architecture.md](./docs/agents/product-and-architecture.md):
  product scope, technical stack, repository and host boundaries.
- [data-and-api.md](./docs/agents/data-and-api.md): data model, API contracts
  and search.
- [editor-architecture.md](./docs/agents/editor-architecture.md): editor
  layering and Markdown boundaries.
- [ux-and-editor-spec.md](./docs/agents/ux-and-editor-spec.md): detailed Web and editor
  experience specification.
- [security-and-performance.md](./docs/agents/security-and-performance.md):
  security baseline and performance targets.
- [code-style.md](./docs/agents/code-style.md): coding conventions and
  dependency constraints.
- [deployment.md](./docs/agents/deployment.md): production domains, release and
  rollback.
- [docs/adr](./docs/adr/): accepted and superseded architecture decisions.
- [CONTRIBUTING.md](./CONTRIBUTING.md): contribution entry point.
- [SECURITY.md](./SECURITY.md): vulnerability reporting and supported scope.

## License

[MIT](./LICENSE)
