# ADR 0007: Desktop Scaffold Ordering Exception

## Status

Accepted — 2026-11-24.

## Context

[ADR 0004](./0004-package-boundaries.md) records that package extraction should
happen before adding a Tauri composition root. The repository now contains
`apps/desktop/src-tauri/` as a parked WIP scaffold, while T4 remains blocked and
the M1.1 product boundary is Web-only.

The historical sequencing statement and the current repository state therefore
need an explicit decision without rewriting the accepted ADR 0004 body.

## Decision

Keep the existing desktop scaffold as an isolated WIP artifact:

- It must never enter the Web release image.
- It must not be treated as an active desktop milestone or platform support.
- Resume work only after a new milestone is approved in
  [DEVELOP_PLAN.md](../../DEVELOP_PLAN.md).
- Before implementation resumes, rebase the scaffold on the settled package,
  storage, editor and asset contracts and pass the shared boundary checks.

## Consequences

- ADR 0004 remains authoritative for package boundaries and dependency
  direction.
- Only its “extraction before composition root” sequencing consequence is
  superseded.
- The parked scaffold remains visible without implying that desktop is
  supported or released.
