#!/usr/bin/env bash
# Ensure the seeded Postgres container (peerconnect-db) is running and actually
# accepting connections. Safe to run on both Codespace create and every resume.
#
# Why this exists: on Codespace resume the DB container is often stopped (or not
# yet ready) when the app is first used, so Prisma calls crash with an opaque
# "Can't reach database server" error. This script makes the DB reliably
# available without any manual `docker start`.
set -euo pipefail

# Run from the repo root regardless of the caller's working directory, so the
# Docker build context and Dockerfile path resolve correctly.
cd "$(dirname "$0")/.."

CONTAINER=peerconnect-db
IMAGE=peerconnect-db
REMOTE_IMAGE=ghcr.io/bashlenix/peerconnect-db:latest

if docker ps -a --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  # Container exists (running or stopped) — start it. Errors are NOT suppressed
  # so a genuine failure is visible instead of silently triggering a rebuild.
  docker start "$CONTAINER"
else
  # No container yet (fresh Codespace, or it was removed). Prefer pulling the
  # prebuilt seeded image published by .github/workflows/build-db-image.yml — a
  # pull is far faster than building here (which runs npm ci + prisma + seeds)
  # and won't time out under postStartCommand. Fall back to a local build when
  # the pull fails (offline, or the image hasn't been published yet).
  echo "Container '$CONTAINER' not found — pulling prebuilt image '$REMOTE_IMAGE'..."
  if docker pull "$REMOTE_IMAGE"; then
    RUN_IMAGE="$REMOTE_IMAGE"
  else
    echo "Pull failed — building the image locally as a fallback..."
    docker build -f docker/db/Dockerfile -t "$IMAGE" .
    RUN_IMAGE="$IMAGE"
  fi
  docker run -d -p 5432:5432 --restart unless-stopped --name "$CONTAINER" "$RUN_IMAGE"
fi

# Ensure the restart policy is set even on containers created before this change,
# so the Docker daemon brings the DB back automatically on future resumes.
docker update --restart unless-stopped "$CONTAINER" >/dev/null

echo "Waiting for Postgres to accept connections..."
for _ in $(seq 1 60); do
  if docker exec "$CONTAINER" pg_isready -U postgres -d peerconnect >/dev/null 2>&1; then
    echo "Postgres is ready."
    exit 0
  fi
  sleep 1
done

echo "ERROR: Postgres did not become ready within 60s." >&2
docker logs --tail 30 "$CONTAINER" >&2 || true
exit 1
