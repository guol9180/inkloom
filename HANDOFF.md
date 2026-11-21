# InkLoom Session Handoff

## Reading Order

1. [README.md](./README.md): product snapshot, structure and commands.
2. [AGENTS.md](./AGENTS.md): engineering rules and package boundaries.
3. [DEVELOP_PLAN.md](./DEVELOP_PLAN.md): current task, scope and acceptance.
4. [PRODUCT_AND_ARCHITECTURE.md](./docs/PRODUCT_AND_ARCHITECTURE.md): product,
   data, API and host architecture.
5. [UX_AND_EDITOR_SPEC.md](./docs/UX_AND_EDITOR_SPEC.md): canonical editor and
   interaction design.
6. [DEPLOYMENT.md](./docs/DEPLOYMENT.md): production release, backup and rollback.

## Current State

- Product: InkLoom, English-only visible brand text.
- Web: `https://inkloom.imhgl.com`.
- API: `https://api.inkloom.imhgl.com`.
- Repository: `https://github.com/guol9180/inkloom`, branch `main`.
- Production application release:
  `2e1e3173374d6e0b0c78ccc8282b8e8822e45dff`.
- Current production is the completed M1.1 product-grade editor and knowledge
  workflow.
- Production was intentionally initialized without migrating old data. A
  temporary API smoke test was removed afterward; the final database has zero
  users, workspaces, documents, knowledge bases and assets.
- The source tree also contains a WIP Tauri desktop scaffold. Desktop is parked
  and must not enter the Web release image.

M1.1 is complete and released. T25–T44 are closed; the milestone state and
verification evidence are recorded in [DEVELOP_PLAN.md](./DEVELOP_PLAN.md).

## Locked Product Decisions

- M1.1 implements Web only.
- Future desktop, mobile, HarmonyOS and sync hosts retain adapter and command
  entry points, but no future host implementation starts in M1.1.
- Workspace navigation has two modes: Scratch and Knowledge.
- Scratch notes are flat and directly editable.
- The new button is integrated into the `+` menu to the right of search; there
  is no separate scratch-note creation button.
- Knowledge bases are directly created top-level containers.
- Knowledge-base documents are flat Markdown files with no groups or nesting.
- Knowledge-base documents open in preview by default and require explicit
  editing.
- Milkdown / ProseMirror remains the editor kernel; the product-level editor
  shell and custom NodeViews are rebuilt around it.
- The visual theme is white/near-white.
- UI typography follows a Codex-like precise and restrained hierarchy using
  Geist Sans, system Chinese fonts and Geist Mono.
- All content loading uses layout-stable skeleton screens.
- Content editing is autosave-only with IndexedDB drafts, serialized writes,
  idle/max-interval checkpoints, conflict copies and one editor owner per tab.
- Markdown source is canonical; unknown syntax and untouched source slices must
  be preserved.

## Next Work

There is no active product-development task after M1.1. The next milestone must
be explicitly selected in [DEVELOP_PLAN.md](./DEVELOP_PLAN.md).

Do not resume desktop, M2 synchronization, real-time collaboration or mobile
work without explicit user confirmation.

## Verified Before Handoff

The last production check returned:

```json
{
  "web": 200,
  "api": 200,
  "cors": 204,
  "securityHeaders": true
}
```

Final container and data checks:

- `inkloom-api`, `inkloom-web` and `platform-edge` are healthy.
- `inkloom-api` and `inkloom-web` are running the release SHA above.
- The data volume contains only the initialized SQLite database, WAL and SHM
  files; all business-table row counts are zero.
- No container restart or OOM was observed after release.
