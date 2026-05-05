# ─── Stage 1: builder ────────────────────────────────────────────────────────
# node:22-alpine + postgres16: runs all migrations and seed scripts against a
# local Postgres instance, then dumps the result to /seed.sql.
FROM node:22-alpine AS builder

RUN apk add --no-cache postgresql16

# Probe for the server binaries at build time (location varies by Alpine version).
RUN PG_BINDIR=$(dirname "$(find /usr -name initdb -type f | head -1)") \
    && mkdir -p /var/lib/postgresql/data \
    && chown postgres:postgres /var/lib/postgresql/data \
    && su -s /bin/sh postgres -c \
         "${PG_BINDIR}/initdb \
          -D /var/lib/postgresql/data \
          --auth=trust --no-locale --encoding=UTF8"

# ── npm install (layer cached until lockfile changes) ─────────────────────────
WORKDIR /app
COPY package.json package-lock.json    ./
COPY packages/shared/package.json      ./packages/shared/
COPY apps/frontend/package.json        ./apps/frontend/
COPY apps/backend/package.json         ./apps/backend/
RUN npm ci

# ── source files required for migrations + seeds ─────────────────────────────
COPY packages/shared/              ./packages/shared/
COPY apps/backend/prisma/          ./apps/backend/prisma/
COPY apps/backend/src/generated/   ./apps/backend/src/generated/
COPY apps/backend/prisma.config.ts ./apps/backend/
COPY apps/backend/tsconfig.json    ./apps/backend/

# Trust auth is set in pg_hba.conf so no password is required here.
ENV DATABASE_URL="postgresql://postgres@localhost:5432/peerconnect"

RUN PG_BINDIR=$(dirname "$(find /usr -name pg_ctl -type f | head -1)") \
    && su -s /bin/sh postgres -c \
        "${PG_BINDIR}/pg_ctl -D /var/lib/postgresql/data start -w -l /tmp/pg.log" \
    && su -s /bin/sh postgres -c "createdb peerconnect" \
    && sh -c 'cd /app/apps/backend && npx prisma migrate deploy' \
    && sh -c 'cd /app/apps/backend && npx tsx prisma/seed.ts' \
    && sh -c 'cd /app/apps/backend && npx tsx prisma/seed-dev.ts' \
    && sh -c 'cd /app/apps/backend && npx tsx prisma/seed-ads.ts' \
    && sh -c 'cd /app/apps/backend && npx tsx prisma/seed-extended.ts' \
    && pg_dump -U postgres -h localhost peerconnect > /seed.sql \
    && su -s /bin/sh postgres -c \
        "${PG_BINDIR}/pg_ctl -D /var/lib/postgresql/data stop -w"

# ─── Stage 2: final ──────────────────────────────────────────────────────────
# Minimal postgres:16-alpine image. The dump is auto-restored on first
# container start via /docker-entrypoint-initdb.d/.
#
# Build:  docker build -f docker/db/Dockerfile -t peerconnect-db .
# Run:    docker run -p 5432:5432 peerconnect-db
# URL:    postgresql://postgres:postgres@localhost:5432/peerconnect
FROM postgres:16-alpine

ENV POSTGRES_USER=postgres \
    POSTGRES_PASSWORD=postgres \
    POSTGRES_DB=peerconnect

COPY --from=builder /seed.sql /docker-entrypoint-initdb.d/seed.sql

EXPOSE 5432
