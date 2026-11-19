# Deployment

## Domains

| Host | Service | Notes |
| --- | --- | --- |
| `inkloom.imhgl.com` | Web static app | Internal `inkloom-web` service proxied by the shared `platform-edge` |
| `api.inkloom.imhgl.com` | HTTP API | Internal `inkloom-api` service proxied by the shared `platform-edge` |
| `api.imhgl.com` | workbench | Optional companion app; the route stays available when workbench rejoins `platform-edge` |
| `sync.inkloom.imhgl.com` | WebSocket | Reserved for M2 collaboration |
| `cdn.inkloom.imhgl.com` | Object storage/CDN | Reserved for diagram assets |

Create `A` records for the Web and API hosts pointing to the deployment server before starting Caddy. Caddy obtains and renews TLS certificates automatically. Keep cookies host-only; never scope an InkLoom session cookie to `.imhgl.com`.

## Runtime

The deployment consists of three containers:

- `platform-edge`: Shared Caddy entry managed by the private control plane; owns TLS, public ports and domain routing.
- `inkloom-web`: Internal Caddy serving only the built static Web app on `8080`.
- `inkloom-api`: Node.js 22 serving the API and using the persistent SQLite volume.

Required server ports are `80/tcp`, `443/tcp`, and optionally `443/udp` for HTTP/3. Docker Engine with the Compose plugin is required. Only `platform-edge` publishes host ports. Inkloom services join the external `platform-edge` network under unique aliases; future projects must do the same.

Resource and operational defaults:

- `inkloom-api` is limited to `256m` and `0.75 CPU`, runs with a read-only root filesystem, and writes only to its data volume and `/tmp`.
- `inkloom-web` is limited to `128m` and `0.50 CPU`; it has no public ports.
- `platform-edge` is limited to `128m` and `0.50 CPU`; it alone owns ports `80/443`.
- Container logs rotate at `10m` per file with three files.
- Caddy certificates persist in `inkloom-caddy-data`; SQLite data persists in `inkloom-data`.
- Deploy immutable commits or release artifacts. Do not deploy a dirty worktree.
- Images are built outside the production host. This public repository's GitHub Actions publishes commit-tagged `linux/amd64` images to GHCR; the server only pulls and starts them.
- Production deployment credentials and release orchestration live only in the private `guol9180/imhgl-ops` repository. This public repository stores no SSH host, deployment key, server path or GHCR read token.

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

The private deployment control plane sets these values. Server-only variables must never use a `VITE_` prefix.

## Image Publishing

Run the manual `Build and publish images` workflow with the desired immutable Git ref. It runs typecheck, unit and integration tests, the production build and Playwright, then publishes commit-tagged `inkloom-api` and `inkloom-web` images to GHCR.

This workflow never connects to the production server and has no deployment secrets.

## Deployment

Deploy the published full commit SHA from the private `guol9180/imhgl-ops` control plane. Its `verify` mode checks the dedicated deployment identity without changing containers; its `deploy` mode uploads the production Compose manifest, pulls the exact image tag and recreates the service.

Each successful deployment records the active commit in `/srv/apps/inkloom/DEPLOYED_RELEASE`. The shared entry records its control-plane revision in `/srv/platform/edge/DEPLOYED_RELEASE`.

Production verification runs after deployment:

```bash
curl -fsS https://api.inkloom.imhgl.com/api/health
curl -fsSI https://inkloom.imhgl.com
pnpm verify:production
```

Expected API health:

```json
{"ok":true,"service":"inkloom-api"}
```

## Updates

1. Run `Build and publish images` in this repository for the desired immutable Git ref.
2. Confirm both GHCR images exist under the resolved full commit SHA.
3. Run the private `imhgl-ops` deployment workflow with that exact SHA.
4. Confirm its production verification and this repository's local or CI `pnpm verify:production` both pass.

Production hosts must not build application images.

Use a service restart window for M1. Database writes are revision-checked, but this version does not yet provide blue/green deployment.

Before starting the workflow:

1. Read `/srv/apps/inkloom/DEPLOYED_RELEASE` through the private control plane and retain the previous release SHA for rollback.
2. Run the database backup procedure below and confirm the archive is non-empty.
3. Confirm DNS still resolves both production hosts to the intended edge.
4. Confirm the deployment workflow uses the full commit SHA and the private control plane's Environment Secrets.
5. After deployment, verify both public health checks, security headers and container health before removing the previous images.

## Database Backup

Back up before each release and on a daily schedule. Stop the API briefly so SQLite WAL files are quiescent, copy the named volume, then restart:

```bash
cd /srv/apps/inkloom
mkdir -p /srv/inkloom-backups
docker compose stop api
docker run --rm \
  -v inkloom-data:/data:ro \
  -v /srv/inkloom-backups:/backup \
  alpine:3.21 \
  tar czf "/backup/inkloom-$(date -u +%Y%m%dT%H%M%SZ).tgz" -C /data .
docker compose start api
```

Retain at least seven daily backups and one pre-release backup. Store copies outside the deployment server.

To restore:

```bash
cd /srv/apps/inkloom
docker compose stop api
docker run --rm \
  -v inkloom-data:/data \
  -v /srv/inkloom-backups:/backup:ro \
  alpine:3.21 \
  sh -c "rm -rf /data/* && tar xzf /backup/<backup-file>.tgz -C /data"
docker compose start api
pnpm verify:production
```

Restoring is destructive. Verify the backup filename and current incident scope first.

## Rollback

The M1 schema is additive and performs no destructive migrations. Code rollback is safe only when the previous release supports the current schema. Run the private `imhgl-ops` deployment workflow with the last-known-good full Git SHA; do not rebuild it and do not move deployment credentials into this public repository.

Run `pnpm verify:production` from a trusted local checkout or CI runner after the rollback. The production host does not contain this workspace or a Node.js application build environment.

If a release changed the database schema incompatibly, restore the matching pre-release backup before rolling back code.

## Operations

```bash
docker compose -f /srv/apps/inkloom/compose.yaml logs -f api
docker compose -f /srv/apps/inkloom/compose.yaml logs -f web
docker compose -f /srv/apps/inkloom/compose.yaml restart api
docker compose -f /srv/platform/edge/compose.yaml logs -f edge
```

The API writes only `INKLOOM_DATABASE_PATH` and its SQLite WAL/SHM companions. Logs must not contain document bodies or passwords.

## CPU Troubleshooting

Start with a short baseline before changing anything:

```bash
uptime
vmstat 1 5
mpstat -P ALL 1 5
top -b -n 1 -o %CPU -w 240 | head -n 45
pidstat 1 3
docker stats --no-stream
cat /proc/pressure/cpu /proc/pressure/io /proc/pressure/memory
```

Interpret the result before acting:

- High `%usr` points to an application, script or container.
- High `%system` points to kernel/network/filesystem activity.
- High `%iowait` points to storage rather than pure CPU load.
- High CPU pressure with low request traffic usually means a runaway local process.
- Compare host process CPU with Docker/cgroup CPU before blaming the application containers.

Interactive installer, uninstaller or migration scripts must receive explicit stdin, or use a documented non-interactive mode. A tool timeout may stop the client while leaving the remote script alive. After any timed-out control-plane operation, run `ps`/`top` and verify that no installer or helper child remains. A stale interactive `1pctl` loop was once observed consuming a full CPU core in this deployment; terminating the orphaned script and its helper restored idle CPU to approximately 99%.

## Deployment Standard

The production lessons from the M1 launch are:

- Build only in GitHub Actions or another trusted build environment. A small production host must remain a runtime target.
- Keep production deployment credentials in one private control-plane repository; public application repositories publish images only.
- Tag both images with the full resolved commit SHA. Never deploy a floating `latest` tag.
- Keep one public edge proxy. Additional projects join `platform-edge` and expose only internal ports.
- Bind containerized services to `0.0.0.0` inside the container; retain loopback as the safe local-development default.
- Treat memory limits as ceilings, not capacity. Confirm actual headroom before adding services; swap is a fallback, not normal capacity.
- Configure Docker and Compose log rotation before publishing logs. A stopped or noisy container must not grow without bounds.
- Make the server directory contain runtime Compose inputs only. Application code belongs in immutable images.
- Pin deployment Actions to commit SHAs and pin SSH host keys. Avoid live `ssh-keyscan` in automation.
- Use a dedicated deployment identity. Docker group access is effectively privileged, so do not reuse it for interactive users or unrelated jobs.
- Store SSH keys, tokens, environment secrets and host-specific values in GitHub Secrets or the server secret store, never in Git.
- Keep `.env`, private keys, database archives, raw logs and user documents out of Git and Docker build contexts.
- Record the deployed SHA and verify the public Web, health endpoint and security headers after every release.
- After management-plane commands, verify orphan processes. A timeout only proves the client stopped waiting; it does not prove the remote process exited.

Required release sequence:

```text
clean commit -> CI tests/E2E -> immutable images -> deploy exact SHA
-> pull on server -> recreate containers -> health and HTTPS verification
```

## Security

- Caddy sets HSTS, CSP, frame denial, MIME sniffing protection and a restrictive permissions policy.
- API CORS allows only `https://inkloom.imhgl.com`.
- Session cookies are `HttpOnly`, `SameSite=Lax`, `Secure`, and use the `__Host-` prefix in production.
- Passwords use scrypt with per-user random salts.
- SQLite is stored in a named volume and is never committed to Git.
- The public repository has no production SSH identity or server path; the private `imhgl-ops` control plane owns the dedicated deployment identity, fixed host key and ephemeral GHCR authentication.
- `.env` files are excluded from Docker build contexts; only `.env.example` may be committed.
- Docker group access is treated as root-equivalent. Deployment credentials must not be reused for personal or unrelated administration.
- Review package visibility before publishing proprietary artifacts. Public image packages must not contain secrets or non-public data.
- Run `pnpm audit --prod` before every release and record unresolved transitive issues.
- Current audit residual is one high `picomatch` ReDoS in Excalidraw's Sass build-only dependency chain and one low nested KaTeX advisory. Verify the vulnerable watcher chain is absent from `apps/web/dist`; the API runtime has no such dependency.

## Local Development

| Service | Local URL |
| --- | --- |
| Web | `http://127.0.0.1:4173` |
| API | `http://127.0.0.1:3001` |

Local `.env` files are ignored by Git. Use `.env.example` as the key list.
