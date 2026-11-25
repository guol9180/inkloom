# InkLoom Security and Performance

本文件维护安全基线、性能目标和工程门禁。部署控制见
[部署手册](./deployment.md)，漏洞报告见 [SECURITY.md](../../SECURITY.md)。

## 1. Security

- Passwords use scrypt with per-user salts.
- Password hashing runs asynchronously with bounded concurrency; login and
  registration attempts are rate-limited by client address and account.
- Session tokens are hashed in storage and sent only in HttpOnly, SameSite=Lax,
  Secure cookies in production.
- CORS allows only configured Web origins.
- API validates workspace ownership and body size.
- Markdown HTML renders through an allowlist and sanitization.
- Mermaid uses `securityLevel: "strict"`.
- SVG assets are sanitized before inline rendering.
- Unsafe attachments download with `Content-Disposition: attachment`.
- Asset URLs enforce workspace authorization.
- Logs never contain document bodies, passwords, session tokens or asset bytes.
- Rate-limit authentication and asset upload endpoints.

## 2. Performance Targets

| Operation              | Target                                         |
| ---------------------- | ---------------------------------------------- |
| First workspace shell  | under 1s on a warm API                         |
| Document switch        | P95 under 150ms after selection                |
| Autosave network start | within 800ms after input stops                 |
| Search                 | P95 under 120ms for 1,000 documents            |
| Mermaid initial render | under 500ms for typical diagrams               |
| Excalidraw first open  | lazy-loaded, under 1.5s on a normal connection |
| UI interaction         | visually stable near 60fps                     |

Engineering requirements:

- Lazy-load Excalidraw and large diagram dependencies.
- Do not load all document bodies to render the navigation.
- Use cursor pagination for document and search lists.
- Use skeleton screens with stable dimensions.
- Avoid layout thrash during editor and drawer transitions.
