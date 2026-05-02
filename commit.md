feat: Issue 15 — Subscription Data Model

Key decisions:
- Subscription model already existed in schema (no migration needed); Prisma
  nested create used in POST /auth/register to atomically create user + free
  subscription in a single DB round-trip (subscription: { create: {} })
- GET /auth/me: extended Prisma select to include subscription relation; response
  serialises startDate/endDate via .toISOString(); endDate serialises to null when
  absent; subscription is null for legacy users with no subscription row
- Swagger schema for /auth/me updated: subscription object is nullable with
  status enum ["free","premium"], startDate (date-time), endDate (date-time, nullable)
- Frontend AuthUser extended with Subscription interface { status, startDate,
  endDate }; subscription: Subscription | null added to AuthUser
- ProfilePage: "Subscription" section added between badges and notification
  preferences; reads user.subscription from Zustand store (populated by /auth/me);
  shows "Free plan" or "Premium"; shows expiry date only when endDate is set

Files changed:
- apps/backend/src/routes/auth.ts (nested subscription create on register;
  subscription included in GET /auth/me query + response + schema)
- apps/backend/tests/auth.test.ts (2 new tests: subscription created on register,
  /auth/me returns subscription with status free and null endDate)
- apps/frontend/src/api/auth.ts (Subscription interface; subscription field on AuthUser)
- apps/frontend/src/pages/ProfilePage.tsx (Subscription section in profile UI)
- .ai/issues/done/15-subscription-data-model.md (moved to done)

Blockers/notes:
- All 132 tests pass (2 new); tsc --noEmit clean on backend and frontend
- Issue 15 has no downstream blockers; Issues 06, 10, 13, 14 remain
- No payment UI or premium entitlement checks as specified in acceptance criteria

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
