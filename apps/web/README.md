# @inkloom/web

InkLoom Web client.

The current source includes the production M1 cloud workspace and the first
formal frontend migration: React Router, Tailwind CSS 4, TanStack Query,
Radix, Lucide and Milkdown.

M1.1 is now being planned and implemented from
[DEVELOP_PLAN.md](../../DEVELOP_PLAN.md). The target Web experience is:

- Scratch notes and flat knowledge-base navigation.
- Preview-first knowledge-base reading with explicit edit mode.
- Product-level Milkdown/ProseMirror editor shell.
- Mermaid, Excalidraw, images and attachments as durable assets.
- Markdown source preservation and content-addressed asset storage.
- White/near-white responsive UI from 320px to 2560px.

The detailed behavior is in
[UX_AND_EDITOR_SPEC.md](../../docs/UX_AND_EDITOR_SPEC.md).

## Run

From the repository root:

```bash
corepack enable
pnpm install
pnpm dev:api
pnpm dev:web
```

Build:

```bash
pnpm --filter @inkloom/web build
```

M1.1 requirements and acceptance are tracked only in
[DEVELOP_PLAN.md](../../DEVELOP_PLAN.md).
