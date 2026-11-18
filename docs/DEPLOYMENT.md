# Deployment

## Domains

| Host | Service | Notes |
| --- | --- | --- |
| `inkloom.imhgl.com` | Web static app | Public browser app served by the shared edge container |
| `api.inkloom.imhgl.com` | HTTP API | REST API and login session, reachable only through the edge network |
| `api.imhgl.com` | workbench | Optional companion app; the route stays available when workbench rejoins `inkloom-edge` |
| `sync.inkloom.imhgl.com` | WebSocket | Reserved for M2 collaboration |
| `cdn.inkloom.imhgl.com` | Object storage/CDN | Reserved for diagram assets |

Create `A` records for the Web and API hosts pointing to the deployment server before starting Caddy. Caddy obtains and renews TLS certificates automatically. Keep cookies host-only; never scope an InkLoom session cookie to `.imhgl.com`.

## Runtime

The M1 deployment consists of two containers:

- `api`: Node.js 22 with a persistent SQLite volume.
- `web`: Caddy serving the built Web app and acting as the single public edge for Inkloom and optional companion apps.

Required server ports are `80/tcp`, `443/tcp`, and optionally `443/udp` for HTTP/3. Docker Engine with the Compose plugin is required. The API container is not exposed directly. Both containers join the named `inkloom-edge` network; future workbench deployments must join the same network as `workbench`.

Resource and operational defaults:

- `api` is limited to `256m`, runs with a read-only root filesystem, and writes only to its data volume and `/tmp`.
- `web` is limited to `128m` and owns ports `80/443`.
- Container logs rotate at `10m` per file with three files.
- Caddy certificates persist in `inkloom-caddy-data`; SQLite data persists in `inkloom-data`.
- Deploy immutable commits or release artifacts. Do not deploy a dirty worktree.
- Images are built outside the production host. GitHub Actions publishes commit-tagged `linux/amd64` images to GHCR; the server only pulls and starts them.
- The public repository stores no deployment credentials. Actions uses a dedicated `inkloom-deploy` SSH identity, pinned host keys and immutable Action SHAs; GHCR login credentials exist only for the duration of a deployment.

## Environment

Web build time:

```dotenv
VITE_APP_ORIGIN=https://inkloom.imhgl.com
VITE_API_ORIGIN=https://api.inkloom.imhgl.com
```

API runtime:

```dotenv
NODE_ENV=production
HOST=0.0.0.0
PORT=3001
INKLOOM_DATABASE_PATH=/data/inkloom.sqlite
INKLOOM_WEB_ORIGINS=https://inkloom.imhgl.com
```

`deploy/compose.yaml` sets these values. Server-only variables must never use a `VITE_` prefix.

## First Deploy

GitHub Actions is the supported build and deployment path. Configure the deployment secrets below, then run the `Deploy Web MVP` workflow. It tests the release, builds and pushes `inkloom-api` and `inkloom-edge`, updates the server Compose files, pulls the commit-tagged images, restarts the two containers, and runs production verification.

Each successful deployment records the active image commit in `/srv/inkloom/DEPLOYED_RELEASE`.

`deploy/migrate-legacy-edge.sh` is a one-time, idempotent migration from the legacy `workbench` Compose edge. It copies the legacy Caddy certificate volume only when present and removes the old container only when its Compose project label is exactly `workbench`.

Manual server commands are limited to pull and runtime operations:

```bash
mkdir -p /srv/inkloom/deploy
cd /srv/inkloom
docker login ghcr.io
INKLOOM_IMAGE_TAG=<release-commit> docker compose -f deploy/compose.yaml pull
INKLOOM_IMAGE_TAG=<release-commit> docker compose -f deploy/compose.yaml up -d --remove-orphans
```

Run tests and image builds in CI or another build environment, never on the production server. Wait for both services:

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

Run the manual `Deploy Web MVP` workflow with the desired immutable Git ref. The workflow publishes a new commit-tagged pair of images, deploys that exact tag, and runs `pnpm verify:production`. Production hosts must not build application images.

Use a service restart window for M1. Database writes are revision-checked, but this version does not yet provide blue/green deployment.

## Database Backup

Back up before each release and on a daily schedule. Stop the API briefly so SQLite WAL files are quiescent, copy the named volume, then restart:

```bash
cd /srv/inkloom
mkdir -p /srv/inkloom-backups
docker compose -f deploy/compose.yaml stop api
docker run --rm \
  -v inkloom-data:/data:ro \
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
  -v inkloom-data:/data \
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
