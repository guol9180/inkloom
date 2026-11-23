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
- User-isolated cloud workspaces.
- Flat scratch notes and user-created knowledge bases.
- Markdown documents, tags, revisions, history, search and conflict copies.
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
  └─ Knowledge
       └─ user-created knowledge bases
            └─ flat Markdown documents, preview-first
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
- Tailwind CSS 4 with semantic design tokens.
- TanStack Query, React Hook Form, Zod and Zustand.
- Milkdown / ProseMirror / Remark for Markdown.
- CodeMirror 6 only inside code and diagram source nodes.
- Radix primitives and Lucide icons.
- Node.js 22, SQLite WAL, SQLite FTS5 and content-addressed assets.

The product and architecture rationale is in
[PRODUCT_AND_ARCHITECTURE.md](./docs/PRODUCT_AND_ARCHITECTURE.md). Detailed
editor, UI, motion, typography, save and responsive behavior is in
[UX_AND_EDITOR_SPEC.md](./docs/UX_AND_EDITOR_SPEC.md).

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
[DEPLOYMENT.md](./docs/DEPLOYMENT.md).

## Documentation

- [START_HERE.md](./START_HERE.md): reading order and next task.
- [AGENTS.md](./AGENTS.md): engineering rules and package boundaries.
- [DEVELOP_PLAN.md](./DEVELOP_PLAN.md): tasks, progress and acceptance.
- [HANDOFF.md](./HANDOFF.md): current state and handoff instructions.
- [PRODUCT_AND_ARCHITECTURE.md](./docs/PRODUCT_AND_ARCHITECTURE.md): product,
  data, API and host architecture.
- [UX_AND_EDITOR_SPEC.md](./docs/UX_AND_EDITOR_SPEC.md): detailed Web and editor
  experience specification.
- [DEPLOYMENT.md](./docs/DEPLOYMENT.md): production domains, release and rollback.

## License

[MIT](./LICENSE)
