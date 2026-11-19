# @inkloom/desktop

Tauri 2 desktop scaffold for a future file-first InkLoom host.

## Current State

- Tauri shell, platform icons and a Rust filesystem command surface exist.
- The current UI is a WIP scaffold and still uses a source/split/read layout.
- It does not yet share the M1.1 product editor shell.
- T4 remains `in-progress` and is parked until the Web editor, document model and
  asset contracts settle.

This package is never included in the Web release image.

## Future Target

A desktop host will reuse the same:

- Document lifecycle and revision contracts.
- Markdown codec and unknown-syntax preservation.
- Editor command registry and product-level editor shell.
- Asset adapter contract.

Platform-specific disk access belongs in `@inkloom/storage` adapters and Rust
commands; React pages must not import native filesystem APIs directly.

See [PRODUCT_AND_ARCHITECTURE.md](../../docs/PRODUCT_AND_ARCHITECTURE.md) and
[DEVELOP_PLAN.md](../../DEVELOP_PLAN.md).
