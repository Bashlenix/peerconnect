# 60 — Add GitHub Actions CI pipeline (typecheck, build, test)

**Type:** Chore
**Labels:** needs-triage
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

- [ ] Opening a PR shows a CI check running and reporting pass/fail.
- [ ] The workflow catches a deliberately broken build (e.g. a type error) —
      verified once during implementation, not left in the final PR.
- [ ] All existing 268 backend tests pass in CI against the Postgres service
      container.
- [ ] A migration file containing `search_vector` fails the CI job with a
      clear message.

## Blocked by

None - can start immediately
