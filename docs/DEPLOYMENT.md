# Deployment

## Domains

| Host | Service | Notes |
| --- | --- | --- |
| `inkloom.imhgl.com` | Web static app | Public browser app |
| `api.inkloom.imhgl.com` | HTTP API | REST and upload URL signing |
| `sync.inkloom.imhgl.com` | WebSocket | Yjs collaboration |
| `cdn.inkloom.imhgl.com` | Object storage/CDN | Optional SVG, images, and release assets |

Use host-only cookies by default. If a cookie must be shared by Web and API, scope it to `.inkloom.imhgl.com`, never the parent `.imhgl.com`.

## Environment

```dotenv
VITE_APP_ORIGIN=https://inkloom.imhgl.com
VITE_API_ORIGIN=https://api.inkloom.imhgl.com
VITE_COLLAB_ORIGIN=wss://sync.inkloom.imhgl.com
VITE_ASSET_ORIGIN=https://cdn.inkloom.imhgl.com
```

Server-only variables belong under the API deployment and must never be prefixed with `VITE_`.

## Web

- Build command: `pnpm build`
- Output: `apps/web/dist`
- SPA fallback: `/* -> /index.html`
- Long-lived cache: hashed files under `/assets`
- No long-lived cache for `index.html`
- CSP must allow only required script, style, image, connect, and frame sources

## API

- CORS allow list contains only `https://inkloom.imhgl.com` and local development origins.
- Upload and download URLs should be short-lived pre-signed URLs.
- WebSocket endpoint requires the same workspace authorization as HTTP API.
- Never proxy collaboration traffic through the Web static host.

## Suggested Caddy Layout

```caddyfile
inkloom.imhgl.com {
  root * /srv/inkloom/web
  try_files {path} /index.html
  file_server
}

api.inkloom.imhgl.com {
  reverse_proxy 127.0.0.1:3001
}

sync.inkloom.imhgl.com {
  reverse_proxy 127.0.0.1:3002
}
```

The exact reverse-proxy ports are implementation details and should move into API deployment config when T7 starts.

## Local Development

| Service | Local URL |
| --- | --- |
| Web | `http://127.0.0.1:4173` |
| API | `http://127.0.0.1:3001` |
| Sync | `ws://127.0.0.1:3002` |

Local `.env` files are ignored by Git. Use `.env.example` at the repository root as the key list.
