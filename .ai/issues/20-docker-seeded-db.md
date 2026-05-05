# Issue 20 — docker/db: multi-stage seeded Postgres 16 image

**Type:** AFK
**Label:** needs-triage

## What to build

Create `docker/db/Dockerfile` — a self-contained, minimal Postgres image with all migrations and seed data baked in at build time. No external setup required; a single `docker run` gives a fully-seeded database.

**Build technique:** Multi-stage build.
- **Stage 1** (`node:22-alpine`): installs Postgres 16, probes for server binary location dynamically, starts a local instance, runs `prisma migrate deploy`, runs all four seed scripts in order (`seed` → `seed-dev` → `seed-ads` → `seed-extended`), dumps the result with `pg_dump`.
- **Stage 2** (`postgres:16-alpine`): copies the SQL dump into `/docker-entrypoint-initdb.d/` so Postgres auto-restores it on first container start.

**Credentials baked into the image:**
- `POSTGRES_USER=postgres`
- `POSTGRES_PASSWORD=postgres`
- `POSTGRES_DB=peerconnect`

**Usage:**
```bash
docker build -f docker/db/Dockerfile -t peerconnect-db .
docker run -p 5432:5432 peerconnect-db
# DATABASE_URL=postgresql://postgres:postgres@localhost:5432/peerconnect
```

## Acceptance criteria

- [ ] `docker/db/Dockerfile` exists and builds without errors
- [ ] Final image is based on `postgres:16-alpine` (no Node.js in the final layer)
- [ ] All four seed scripts are reflected in the running container's data
- [ ] `docker run -p 5432:5432 peerconnect-db` starts a queryable Postgres instance with seed data
- [ ] Build uses `npm ci` (not `npm install`) in the builder stage
- [ ] Postgres binary path is resolved dynamically via `find` — no hardcoded paths

## Blocked by

None — can start immediately.
