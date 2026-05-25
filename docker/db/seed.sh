#!/bin/sh
# Runs inside the builder stage of docker/db/Dockerfile.
# Starts a temporary PostgreSQL instance, applies all migrations and seed
# scripts, dumps the result to /seed.sql, then shuts Postgres back down.
# The dump is later copied into /docker-entrypoint-initdb.d/ in the final
# image so the container starts with all data already loaded.
set -e

# Locate pg binaries — path varies across Alpine / postgresql package versions.
PG_BINDIR=$(dirname "$(find /usr -name pg_ctl -type f | head -1)")

echo "▶  Starting PostgreSQL..."
su -s /bin/sh postgres -c \
  "${PG_BINDIR}/pg_ctl -D /var/lib/postgresql/data start -w -l /tmp/pg.log"

echo "▶  Creating database..."
su -s /bin/sh postgres -c "createdb peerconnect"

cd /app/apps/backend

echo "▶  Running migrations..."
npx prisma migrate deploy

echo "▶  Seeding: reference data (universities, badges)..."
npx tsx prisma/seed.ts

echo "▶  Seeding: dev users and posts..."
npx tsx prisma/seed-dev.ts

echo "▶  Seeding: ads..."
npx tsx prisma/seed-ads.ts

echo "▶  Seeding: extended data..."
npx tsx prisma/seed-extended.ts

echo "▶  Dumping database → /seed.sql..."
"${PG_BINDIR}/pg_dump" -U postgres -h localhost peerconnect > /seed.sql

echo "▶  Stopping PostgreSQL..."
su -s /bin/sh postgres -c \
  "${PG_BINDIR}/pg_ctl -D /var/lib/postgresql/data stop -w"

echo "✓  seed.sql ready."
