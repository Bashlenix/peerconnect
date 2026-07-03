# 54 — Make the seeded DB container reliably available after a Codespace resume

**Type:** AFK
**Labels:** bug, done
**GitHub:** https://github.com/Bashlenix/peerconnect/issues/60
**Blocked by:** None

## What to build

When a Codespace goes inactive and is resumed, the `peerconnect-db` Docker
container is often not running (or not yet accepting connections) by the time
the app is used, so login/signup crash with an opaque
`Invalid prisma.user.findUnique() invocation` connection error. Running
`docker start peerconnect-db` manually fixes it — this issue removes the need to
do that.

Harden the database container lifecycle in `.devcontainer/devcontainer.json`:

- Give the container a restart policy (`--restart unless-stopped` on the
  `docker run` commands) so the Docker daemon brings `peerconnect-db` back up
  automatically on Codespace resume, with no manual `docker start`.
- Make `postStartCommand` wait until Postgres is actually accepting connections
  (poll `pg_isready`, e.g. via `docker exec peerconnect-db pg_isready -U postgres`)
  before it finishes, closing the race where the app is up before the DB is.
- Stop hiding start failures: remove the `2>/dev/null` that silently swallows a
  failed `docker start` and triggers a surprise multi-minute rebuild. Surface
  the error (or fall back explicitly) instead.

No schema, seed, or data-persistence changes — the no-volume, always-seeded
design stays as-is.

## Acceptance criteria

- [ ] `docker run` for `peerconnect-db` includes `--restart unless-stopped`
- [ ] After a Codespace stop → resume, `peerconnect-db` is running without any
      manual command, and login with `free@tu-berlin.de` / `Test1234!` works
- [ ] `postStartCommand` does not complete until Postgres accepts connections
- [ ] `postStartCommand` no longer suppresses errors with `2>/dev/null`
- [ ] `postCreateCommand` still produces a fully seeded DB on first create

## Blocked by

None — can start immediately.
