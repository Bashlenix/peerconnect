# 58 — Free/Premium subscription choice at sign-up

**Type:** AFK
**Labels:** enhancement, needs-triage
**GitHub:** https://github.com/Bashlenix/peerconnect/issues/64
**Blocked by:** 56

## What to build

Let users choose Free or Premium (mock, no real payment) at sign-up time,
instead of only being able to upgrade afterward via Settings. Defaults to
Free if untouched.

- `apps/backend/src/routes/auth.ts`: extend `RegisterBody`/schema with
  optional `subscriptionStatus` (enum `"free" | "premium"`, default
  `"free"`).
- `apps/backend/src/modules/auth-service.ts`: extend `register()` to pass the
  chosen status into `prisma.user.create`'s `subscription: { create: { status
  } }` instead of always relying on the schema default.
- `apps/frontend/src/pages/RegisterPage.tsx`: add a Free/Premium toggle,
  defaulting to Free, reusing the "Demo only — no payment is processed"
  disclaimer copy from `SettingsPage.tsx`.
- No Prisma migration (uses the existing `SubscriptionStatus` enum).

## Acceptance criteria

- [ ] `POST /auth/register` accepts an optional `subscriptionStatus` of
      `"free"` or `"premium"`; invalid values are rejected.
- [ ] Omitting `subscriptionStatus` still creates a user with a Free
      subscription (unchanged default behavior).
- [ ] Sign-up form has a Free/Premium toggle defaulting to Free, with the
      same "Demo only" disclaimer used in Settings.
- [ ] Backend tests assert the created subscription's status matches what was
      requested, and defaults to free when omitted.
- [ ] `npm run typecheck`, `npm run test`, `npm run build` pass

## Blocked by

- #56 (shares the same register route/service/form)
