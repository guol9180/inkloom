# @inkloom/mobile-tauri

Android/iOS composition root using Tauri 2. This package is a placeholder until the mobile feasibility task begins.

## Non-Negotiable Rules

- Reuse `@inkloom/core`, `@inkloom/editor`, and `@inkloom/diagrams`.
- Native capabilities are exposed through storage adapters.
- Network sync is primary; arbitrary folder access is optional.
- Test touch UI, IME behavior, app suspension, and process recovery.

See [ADR 0005](../../docs/adr/0005-mobile-ready-foundation.md).
