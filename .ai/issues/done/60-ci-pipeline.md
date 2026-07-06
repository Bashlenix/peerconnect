# 60 — Add GitHub Actions CI pipeline (typecheck, build, test)

**Type:** Chore
**Labels:** needs-triage, done
**GitHub:** https://github.com/Bashlenix/peerconnect/issues/66

## What to build

There is currently no CI — regressions are only caught by whoever remembers
to run tests locally before pushing. Add a GitHub Actions workflow that runs
the same checks a contributor is expected to run by hand.

- New `.github/workflows/ci.yml`, triggered on every `push` and on pull
  requests targeting `main`.
- A `postgres:16` service container (`POSTGRES_DB=peerconnect_test`, with a
  `pg_isready` health check) — the backend test suite needs a real, migrated
  Postgres database (see `apps/backend/tests/setup-env.ts`).
- Job steps: checkout → `actions/setup-node@v4` (Node 22, npm cache) →
  `npm ci` → `npm run build --workspace=packages/shared` (backend resolves
  `@peerconnect/shared` only via its built `dist/`, same as the root `dev`
  script and `docker/db/Dockerfile` already require) → `npx prisma generate`
  → a migration-guard step that greps committed
  `apps/backend/prisma/migrations/*/migration.sql` files for `search_vector`
  and fails the job if found (the same rule `.githooks/pre-commit` enforces
  locally, run here too since hook setup isn't automatic on a fresh clone) →
  `npx prisma migrate deploy` against the service DB → `npm run typecheck` →
  `npm run build` → `npm test` (with `TEST_DATABASE_URL` pointed at the
  service container).
- No branch protection changes — the workflow just needs to exist and report
  status on PRs.

## Acceptance criteria

- [x] Opening a PR shows a CI check running and reporting pass/fail.
- [x] The workflow catches a deliberately broken build (e.g. a type error) —
      verified once during implementation, not left in the final PR.
- [x] All existing 268 backend tests pass in CI against the Postgres service
      container.
- [x] A migration file containing the spurious `search_vector` SQL fails the
      CI job with a clear message.

## Blocked by

None - can start immediately

## Completion notes

Built as planned, with one correction discovered during implementation: a
blanket grep for any mention of `search_vector` across all *committed*
migration files (rather than just staged ones, like the local pre-commit
hook does) would have false-positived on this repo's own history — three
existing, legitimate migrations already reference `search_vector` (the
initial column definition, the `post_implementation` index drop, and the
`restore_search_vector_gin_index` migration). The CI guard instead matches
the two exact spurious lines named in `CLAUDE.md`
(`DROP INDEX "posts_search_vector_idx";` with no `IF EXISTS`, and
`ALTER TABLE "posts" ALTER COLUMN "search_vector" DROP DEFAULT;`), which is
safe to run against the full tree and was verified both ways: no match
against real history, and a confirmed match against a scratch file
containing the exact spurious pattern.

Verification performed locally (no push/PR was opened this session, so the
workflow has not yet run on GitHub's own infrastructure):
- Started a fresh `postgres:16` Docker container (matching the CI service
  config exactly: `POSTGRES_DB=peerconnect_test`, health-checked) on a
  scratch port.
- Ran every job step against it in order: `prisma generate` → migration
  guard (pass) → `prisma migrate deploy` (all 9 migrations applied cleanly
  from empty) → `npm run typecheck` → `npm run build` → `npm test`
  (270/270 passing against the freshly-migrated container, not the
  long-lived local dev/test DB).
- Confirmed the "catches a deliberately broken build" criterion directly:
  temporarily added a type error to `index.ts`, reran `npm run typecheck`,
  confirmed `tsc` failed with `TS2322`, then reverted the change (git diff
  showed only the temporary line before revert).

Next iteration should open a PR (or push to a branch) to confirm the
workflow actually goes green on GitHub-hosted infrastructure — the local
Docker simulation is a strong proxy but isn't identical to a GitHub-hosted
runner.
