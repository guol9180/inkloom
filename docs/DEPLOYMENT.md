# Deployment

## Domains

| Host | Service | Notes |
| --- | --- | --- |
| `inkloom.imhgl.com` | Web static app | Public browser app |
| `api.inkloom.imhgl.com` | HTTP API | REST API and login session |
| `sync.inkloom.imhgl.com` | WebSocket | Reserved for M2 collaboration |
| `cdn.inkloom.imhgl.com` | Object storage/CDN | Reserved for diagram assets |

Create `A` records for the Web and API hosts pointing to the deployment server before starting Caddy. Caddy obtains and renews TLS certificates automatically. Keep cookies host-only; never scope an InkLoom session cookie to `.imhgl.com`.

## Runtime

The M1 deployment consists of two containers:

- `api`: Node.js 22 with a persistent SQLite volume.
- `web`: Caddy serving the built Web app and reverse-proxying `api.inkloom.imhgl.com` to the API container.

Required server ports are `80/tcp` and `443/tcp`. Docker Engine with the Compose plugin is required. The API container is not exposed directly.

## Environment

Web build time:

```dotenv
VITE_APP_ORIGIN=https://inkloom.imhgl.com
VITE_API_ORIGIN=https://api.inkloom.imhgl.com
```

API runtime:

```dotenv
NODE_ENV=production
PORT=3001
INKLOOM_DATABASE_PATH=/data/inkloom.sqlite
INKLOOM_WEB_ORIGINS=https://inkloom.imhgl.com
```

`deploy/compose.yaml` sets these values. Server-only variables must never use a `VITE_` prefix.

## First Deploy

```bash
git clone https://github.com/guol9180/inkloom.git /srv/inkloom
cd /srv/inkloom
git switch main
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
docker compose -f deploy/compose.yaml up -d --build
```

Wait for both services:

```bash
docker compose -f deploy/compose.yaml ps
curl -fsS https://api.inkloom.imhgl.com/api/health
pnpm verify:production
```

Alternatively, configure these GitHub Actions secrets and run the `Deploy Web MVP` workflow:

| Secret | Value |
| --- | --- |
| `INKLOOM_DEPLOY_HOST` | SSH host/IP |
| `INKLOOM_DEPLOY_USER` | Deployment SSH user |
| `INKLOOM_DEPLOY_PATH` | Absolute release directory, for example `/srv/inkloom` |
| `INKLOOM_DEPLOY_SSH_KEY` | Private key with access limited to the deployment directory and Docker commands |

Expected API health:

```json
{"ok":true,"service":"inkloom-api"}
```

## Updates

```bash
cd /srv/inkloom
git pull --ff-only
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
docker compose -f deploy/compose.yaml up -d --build
pnpm verify:production
```

Use a service restart window for M1. Database writes are revision-checked, but this version does not yet provide blue/green deployment.

## Database Backup

Back up before each release and on a daily schedule. Stop the API briefly so SQLite WAL files are quiescent, copy the named volume, then restart:

```bash
cd /srv/inkloom
mkdir -p /srv/inkloom-backups
docker compose -f deploy/compose.yaml stop api
docker run --rm \
  -v inkloom_inkloom-data:/data:ro \
  -v /srv/inkloom-backups:/backup \
  alpine:3.21 \
  tar czf "/backup/inkloom-$(date -u +%Y%m%dT%H%M%SZ).tgz" -C /data .
docker compose -f deploy/compose.yaml start api
```

Retain at least seven daily backups and one pre-release backup. Store copies outside the deployment server.

To restore:

```bash
cd /srv/inkloom
docker compose -f deploy/compose.yaml stop api
docker run --rm \
  -v inkloom_inkloom-data:/data \
  -v /srv/inkloom-backups:/backup:ro \
  alpine:3.21 \
  sh -c "rm -rf /data/* && tar xzf /backup/<backup-file>.tgz -C /data"
docker compose -f deploy/compose.yaml start api
pnpm verify:production
```

Restoring is destructive. Verify the backup filename and current incident scope first.

## Rollback

The M1 schema is additive and performs no destructive migrations. Code rollback is safe only when the previous release supports the current schema:

```bash
cd /srv/inkloom
git switch --detach <last-known-good-commit>
docker compose -f deploy/compose.yaml up -d --build
pnpm verify:production
```

If a release changed the database schema incompatibly, restore the matching pre-release backup before rolling back code.

## Operations

```bash
docker compose -f deploy/compose.yaml logs -f api
docker compose -f deploy/compose.yaml logs -f web
docker compose -f deploy/compose.yaml restart api
```

The API writes only `INKLOOM_DATABASE_PATH` and its SQLite WAL/SHM companions. Logs must not contain document bodies or passwords.

## Security

- Caddy sets HSTS, CSP, frame denial, MIME sniffing protection and a restrictive permissions policy.
- API CORS allows only `https://inkloom.imhgl.com`.
- Session cookies are `HttpOnly`, `SameSite=Lax`, `Secure`, and use the `__Host-` prefix in production.
- Passwords use scrypt with per-user random salts.
- SQLite is stored in a named volume and is never committed to Git.
- Run `pnpm audit --prod` before every release and record unresolved transitive issues.
- Current audit residual is one high `picomatch` ReDoS in Excalidraw's Sass build-only dependency chain and one low nested KaTeX advisory. Verify the vulnerable watcher chain is absent from `apps/web/dist`; the API runtime has no such dependency.

## Local Development

| Service | Local URL |
| --- | --- |
| Web | `http://127.0.0.1:4173` |
| API | `http://127.0.0.1:3001` |

Local `.env` files are ignored by Git. Use `.env.example` as the key list.
