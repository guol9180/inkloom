# Security Policy

## Supported Scope

Production M1.1 and the latest `main` branch are supported. Desktop, mobile,
HarmonyOS, M2 synchronization and real-time collaboration are not implemented
or supported in the current release; see
[DEVELOP_PLAN.md](./DEVELOP_PLAN.md).

## Reporting a Vulnerability

Use the repository's GitHub Security tab and private vulnerability reporting.
Do not open a public issue with exploit details, credentials, document content
or production identifiers.

If private reporting is unavailable, open a minimal public issue asking the
maintainer for a private reporting channel; include no vulnerability details in
that issue.

## High-Risk Areas

- Markdown HTML and SVG injection.
- Mermaid rendering and Excalidraw asset handling.
- Authentication, sessions, rate limits and CORS.
- Workspace authorization, path validation and revision conflicts.
- Immutable asset upload, download headers and content-addressed storage.

Current security controls are documented in
[安全与性能](./docs/agents/security-and-performance.md) and
[部署手册](./docs/agents/deployment.md#security).
