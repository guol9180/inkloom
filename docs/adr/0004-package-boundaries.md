# ADR 0004: Monorepo Package Boundaries

## Status

Superseded by [ADR 0007](./0007-desktop-scaffold-ordering-exception.md).

- Accepted: 2026-11-13
- Superseded: 2026-11-24

## Decision

Use pnpm workspace with `apps`, `packages`, and `services`:

- `@inkloom/core` contains platform-neutral types and contracts.
- `@inkloom/editor`, `@inkloom/diagrams`, `@inkloom/storage`, and `@inkloom/sync` provide platform adapters.
- `@inkloom/ui` provides shared brand and components.
- `@inkloom/web` and `@inkloom/desktop` are composition roots.
- `@inkloom/api` is a server composition root.

## Consequences

- `core` must not import React, Tauri, Node, DOM, or database SDKs.
- Storage and network capabilities are injected through adapters.
- Apps may depend on packages; packages must not depend on apps.
- Package extraction should happen before adding the Tauri composition root.
