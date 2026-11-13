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
pnpm build
pnpm test
```

`pnpm test` will be available once the first package tests are added.

## Rules

- One pull request handles one task card in `DEVELOP_PLAN.md`.
- Read `AGENTS.md` before changing package boundaries or storage behavior.
- Use Conventional Commits.
- Include verification evidence in the PR description.
- Never commit `node_modules/`, secrets, build caches, or user documents.

## Areas That Need Extra Review

- Markdown parse/serialize round trips
- File path validation and atomic writes
- HTML/SVG sanitization and Mermaid security
- Sync conflicts and revision ordering
- License and third-party dependency changes
