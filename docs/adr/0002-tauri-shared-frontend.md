# ADR 0002: Tauri Desktop with a Shared Frontend

## Status

Accepted.

## Decision

Use Tauri 2 for the desktop client and share the React/TypeScript application layer with the Web client.

## Consequences

- File system, SQLite, file watching, and system integration live behind Rust commands and storage adapters.
- Browser and desktop UI remain aligned.
- Windows WebView2, macOS WKWebView, and Linux WebKitGTK require explicit regression testing.
- Electron remains a fallback if cross-platform WebView behavior becomes a blocker.
