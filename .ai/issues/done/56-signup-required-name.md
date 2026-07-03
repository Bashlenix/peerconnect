# 56 — Require first and last name at sign-up

**Type:** AFK
**Labels:** enhancement, done
**GitHub:** https://github.com/Bashlenix/peerconnect/issues/62
**Blocked by:** None

## What to build

Extend `POST /auth/register` and the sign-up form so that first name and last
name are collected and required during account creation, instead of only
being fillable afterward in Settings.

- `apps/backend/src/routes/auth.ts`: extend `RegisterBody` and the Fastify
  body schema to require `firstName` and `lastName` (in addition to existing
  `email`/`password`).
- `apps/backend/src/modules/auth-service.ts`: extend `register()` to accept
  `firstName`/`lastName` and persist them on the created `User` row.
- `apps/frontend/src/pages/RegisterPage.tsx`: add required First name / Last
  name inputs (matching the Input/Label pattern already used in
  `SettingsPage.tsx`); update the `register()` call in
  `apps/frontend/src/api/auth.ts` to send the new fields.
- No Prisma migration — `firstName`/`lastName` remain nullable `String?`
  columns in `schema.prisma`; "required" is enforced only at the Fastify
  schema + frontend `required` attribute layer, not the DB.
- Keep the existing single form-level error banner pattern (no per-field
  inline errors).

## Acceptance criteria

- [x] `POST /auth/register` returns 400 if `firstName` or `lastName` is
      missing from the request body.
- [x] A successful registration persists `firstName` and `lastName` on the
      new `User` row.
- [x] The sign-up form has required First name / Last name fields; submission
      is blocked client-side if left blank.
- [x] `apps/backend/tests/auth.test.ts` register tests are updated to pass
      `firstName`/`lastName`; a new test asserts 400 when either is missing.
- [x] No Prisma schema/migration changes.
- [x] `npm run typecheck`, `npm run test`, `npm run build` pass

## Blocked by

None — can start immediately.

## Completion notes

Also updated 8 other backend test files (`ads`, `ai`, `badge-engine`,
`db-unavailable`, `notifications`, `post-search`, `posts`, `replies`,
`users`) whose `registerVerifyAndLogin`-style helpers called
`POST /auth/register` with only `email`/`password` — these would have
started failing with 400 once the fields became required. All now pass
hardcoded `firstName: "Test", lastName: "User"`.

`register()` in `apps/frontend/src/api/auth.ts` was changed from positional
args `(email, password)` to a single `RegisterInput` object, since it now
takes 4 params — avoids positional-arg mixups for #57/#58 which extend the
same function next.

Frontend has no test infrastructure at all (no vitest/jest/testing-library
in `apps/frontend/package.json`); verification for the frontend piece is
typecheck + build + manual code review only, not automated tests — flagged
to the user during planning, not a regression introduced here.

No blockers for the next iteration. #57 and #58 both build directly on this
issue's route/service/form changes.
