# ADR 0004: Monorepo Package Boundaries

## Status

Accepted.

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
