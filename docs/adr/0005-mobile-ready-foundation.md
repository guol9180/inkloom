# ADR 0005: Mobile-Ready Platform Foundation

## Status

Accepted.

## Context

InkLoom may ship on the Web, Windows/macOS/Linux desktop, Android/iOS, and HarmonyOS. Tauri 2 officially targets desktop, Android, and iOS. HarmonyOS applications use ArkUI/ArkTS and can host the React editor through ArkWeb with a JavaScript bridge.

The same document, diagram, storage, sync, and permission rules must work across these hosts. Passing raw native file handles or platform-specific objects into UI code would make every future client diverge.

## Decision

1. All hosts compose the same platform-neutral `@inkloom/core` contracts.
2. Workspace paths are logical paths, never raw disk paths or native handles.
3. All storage interfaces are asynchronous and capability-driven.
4. Every native host implements a versioned `PlatformBridge`.
5. Web and mobile hosts default to cloud workspaces; desktop may use user-selected folders.
6. File writes require `baseRevision`; silent overwrite is forbidden.
7. Mobile-specific features enter through adapters and capabilities, not conditional code in `packages/core`.
8. Every adapter runs the same contract tests before a platform is considered supported.

## Host Composition

```text
apps/web
apps/desktop            Tauri 2
apps/mobile-tauri       Tauri 2 Android/iOS
apps/harmony            ArkUI + ArkWeb + native bridge
        │
        └─> shared packages and adapters
```

## PlatformBridge Rules

- The bridge protocol is versioned with `PLATFORM_BRIDGE_VERSION`.
- Requests and responses are JSON-safe, bounded, and method-whitelisted.
- Raw native handles never cross into JavaScript.
- Heavy or blocking native work uses asynchronous methods.
- Harmony hosts must validate the calling frame URL before privileged calls.
- Secrets remain in platform secure storage.
- The Web editor must continue in a degraded read/cache mode when a bridge method is unavailable.

## Mobile Storage

- Mobile apps use an application sandbox.
- Harmony relationalStore is based on SQLite and can host the metadata/index database.
- User-selected files and exports go through system pickers.
- Background execution is not guaranteed, so edits must be persisted locally before network sync and recovered after process termination.
- Mobile document identity is workspace/document ID based, not file path based.

## Non-Goals

- Rewriting Excalidraw as a native ArkTS canvas.
- Sharing one UI implementation between ArkUI native screens and React DOM.
- Treating Tauri as an official HarmonyOS runtime.
- Making mobile file-system access semantics identical to desktop.

## Consequences

- The first extraction task must harden core contracts before adding more host code.
- Adapter contract tests become a release gate.
- Mobile and desktop can evolve separately without changing document semantics.
