# Contributing to InkLoom

## Setup

```bash
corepack enable
pnpm install
pnpm dev:web
```

## Before a Pull Request

```bash
pnpm typecheck
pnpm test
pnpm build
```

For UI or workflow changes, also run:

```bash
pnpm test:e2e
```

## Rules

- One pull request handles one task card in `DEVELOP_PLAN.md`.
- Read `AGENTS.md` before changing package boundaries or storage behavior.
- Use Conventional Commits.
- Include verification evidence in the PR description.
- Never commit `node_modules/`, secrets, build caches, or user documents.
- UI and editor behavior must follow
  [docs/UX_AND_EDITOR_SPEC.md](./docs/UX_AND_EDITOR_SPEC.md).

## Areas That Need Extra Review

- Markdown parse/serialize round trips
- File path validation and atomic writes
- HTML/SVG sanitization and Mermaid security
- Sync conflicts and revision ordering
- License and third-party dependency changes
