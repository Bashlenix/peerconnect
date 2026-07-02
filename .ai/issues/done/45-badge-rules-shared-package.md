# Issue 45 — Move BADGE_RULES to @peerconnect/shared to fix the Docker DB build

**Type:** AFK
**Label:** needs-triage
**GitHub:** https://github.com/Bashlenix/peerconnect/issues/45

## What to build

The `docker/db` image build fails at the seed step with
`ERR_MODULE_NOT_FOUND: .../apps/backend/src/modules/badge-config.js`.

`seed-data.ts` imports `BADGE_RULES` from `src/modules/badge-config.ts`, but the
DB image only copies `apps/backend/prisma/`, `packages/shared/`, and the Prisma
config — it never copies `apps/backend/src/`. The seed (run via `tsx`) therefore
cannot resolve the module.

Moving the file under `prisma/` is not an option: `badge-engine.ts` (compiled
server code) also imports it, and the backend `tsconfig` uses `rootDir: "./src"`,
so a `src` → `prisma` import breaks `tsc` (TS6059).

Fix: make `packages/shared` the single source of truth for badge definitions.
It is already a backend project reference (so the engine can import it with no
`rootDir` violation) and is already copied into the DB image. Add a shared build
step to the Dockerfile so `@peerconnect/shared` resolves to its `dist` at seed
time.

## Acceptance criteria

- [x] `BADGE_RULES`, `BADGE_NAMES`, `BadgeRule`, and `BadgeEvent` live in `packages/shared/src/index.ts`
- [x] `badge-engine.ts` imports them from `@peerconnect/shared` (no `rootDir` violation)
- [x] `seed-data.ts` derives `BADGES` from `@peerconnect/shared` and no longer reaches into `src/`
- [x] `apps/backend/src/modules/badge-config.ts` is removed
- [x] `docker/db/Dockerfile` builds `packages/shared` before running the seed
- [x] `docker build -f docker/db/Dockerfile -t peerconnect-db .` succeeds
- [x] `npm run typecheck` passes across all workspaces
- [x] README badge section points to the shared single source of truth

## Blocked by

None — follow-up to #43 (badge-config extraction) and #44 (data-driven engine).
