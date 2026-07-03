# 57 — Optional academic profile fields at sign-up

**Type:** AFK
**Labels:** enhancement, needs-triage
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

- [ ] `POST /auth/register` accepts optional `studyProgramme`, `semester`,
      `languages` and persists whichever are provided.
- [ ] Registering without these fields still succeeds (they remain optional).
- [ ] Sign-up form has optional Study programme / Semester / Languages inputs
      using the same parsing/validation as Settings.
- [ ] Backend tests cover both a registration with all three fields populated
      and one with them omitted.
- [ ] `npm run typecheck`, `npm run test`, `npm run build` pass

## Blocked by

- #56 (shares the same register route/service/form)
