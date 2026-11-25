# Changelog

No semantic version tag has been created yet. The current deployed release and
verification evidence are tracked in
[DEVELOP_PLAN.md](./DEVELOP_PLAN.md); task history is in the
[M1.1 archive](./docs/archive/plan-2026-11-m1.md).

## [Unreleased]

### Added

- M1.1 Web workspace with scratch notes, flat knowledge bases and preview-first
  reading.
- Milkdown/ProseMirror editing, Markdown fidelity, history, search and conflict
  handling.
- Content-addressed images, attachments, Mermaid diagrams and Excalidraw
  canvases.
- Production image publishing, private deployment control plane and release
  verification.

### Changed

- Authentication uses asynchronous bounded password hashing and fixed-window
  rate limits.
- Document writes, knowledge-base ordering and deletion cache updates are
  revision-safe and race-aware.
- The editor uses a unified action slot, semantic spacing and stabilized
  diagram/callout/toggle/table/divider surfaces.
- Project documentation is split into current sources, agent specifications
  and append-only history.

### Fixed

- Frontmatter and untouched Markdown source slices remain intact across saves.
- Cross-document switching and deletion no longer leak stale editor state.
- Large diagram and editor dependencies remain outside the initial workspace
  chunk.
