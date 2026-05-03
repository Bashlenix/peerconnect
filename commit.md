feat: Issue 17 — GET /api/ads backend endpoint

Key decisions:
- adsRoute registered under GET /ads with onRequest: [app.authenticate]; returns
  401 via the standard authenticate decorator if no valid JWT cookie is present
- Premium check: fetches user's subscription.status from DB; returns { ads: [] }
  immediately for 'premium' users — no ad query executed (early-return pattern)
- Active-ad filter uses Prisma findMany with AND [ OR[startsAt null / lte now],
  OR[endsAt null / gte now] ] plus isActive:true — handles all four null/date
  combinations correctly without raw SQL
- Fisher-Yates shuffle applied in-process after the DB fetch; random order per
  request as required by issue spec
- Response select: only id, title, body, imageUrl, linkUrl, advertiserName —
  no internal fields (isActive, startsAt, endsAt, createdAt, updatedAt) exposed
- Swagger schema added with Tags: ["Ads"], 200 + 401 response shapes documented
- Subscription is auto-created as 'free' on registration (auth.ts line 101), so
  the premium test uses prisma.subscription.update (not create) to upgrade status

Files changed:
- apps/backend/src/routes/ads.ts  (new — adsRoute with GET /ads)
- apps/backend/src/app.ts  (import + register adsRoute)
- apps/backend/tests/ads.test.ts  (new — 10 tests covering auth, premium, free,
  inactive/expired/future ads, null bounds, imageUrl, response shape)
- .ai/issues/done/17-ads-api-endpoint.md  (moved to done)

Blockers / notes for next iteration:
- 17 pre-existing test failures in auth/notifications/posts tests remain
  (non-university domain, ordering pollution, requiresManualReview) — not caused
  by this issue
- Issue 18 (AdCard + feed injection) is now unblocked

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
