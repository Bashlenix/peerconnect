# 57 — Optional academic profile fields at sign-up

**Type:** AFK
**Labels:** enhancement, done
**GitHub:** https://github.com/Bashlenix/peerconnect/issues/63
**Blocked by:** 56

## What to build

Extend sign-up to optionally collect `studyProgramme`, `semester`, and
`languages` — the same optional profile fields already editable later via
Settings — so users can fill them in during registration instead of only
afterward.

- `apps/backend/src/routes/auth.ts`: extend `RegisterBody`/schema with
  optional `studyProgramme` (string), `semester` (integer, minimum 1),
  `languages` (array of strings) — mirror the existing `PATCH /users/me` body
  schema in `apps/backend/src/routes/users.ts`.
- `apps/backend/src/modules/auth-service.ts`: extend `register()` to accept
  and persist these fields when provided; omit them when not provided.
- `apps/frontend/src/pages/RegisterPage.tsx`: add optional Study programme
  (text), Semester (number, min 1), and Languages (comma-separated text)
  inputs, matching `SettingsPage.tsx`'s existing inputs and comma-separated
  parsing logic exactly.
- No Prisma migration.

## Acceptance criteria

- [x] `POST /auth/register` accepts optional `studyProgramme`, `semester`,
      `languages` and persists whichever are provided.
- [x] Registering without these fields still succeeds (they remain optional).
- [x] Sign-up form has optional Study programme / Semester / Languages inputs
      using the same parsing/validation as Settings.
- [x] Backend tests cover both a registration with all three fields populated
      and one with them omitted.
- [x] `npm run typecheck`, `npm run test`, `npm run build` pass

## Blocked by

- #56 (shares the same register route/service/form)

## Completion notes

`register()` in `auth-service.ts` and the route handler in `auth.ts` were
switched from positional args to a single input object (`RegisterInput` on
the backend, matching the frontend's already-object-shaped `RegisterInput`)
since the function now takes 7 params — avoids further positional-arg churn
for #58, which adds one more optional field to the same function.

Two new backend tests added: one asserting all three optional fields persist
when provided, one asserting they stay null/empty when omitted (the latter
was already implicitly covered by every pre-existing register test that
doesn't pass them, but this makes the "optional" contract explicit).

No blockers. #58 (Free/Premium toggle) builds on the same `RegisterInput`
shape and can proceed next.
