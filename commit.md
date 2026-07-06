refactor: improve architecture across 8 dimensions (deep modules, seam closure)

Eight architectural improvements extracted from the improve-codebase-architecture skill:

1. GET /posts/:id — added dedicated single-post endpoint; PostDetailPage now
   uses ["post", postId] query instead of fetching the full feed and filtering
   client-side.

2. Notification dispatch module — centralised all fire-and-forget notification
   logic from posts.ts and replies.ts into notifier.ts using a discriminated
   union (NotificationEvent). Self-exclusion guards live in the module.

3. Feed query module — extracted getFeedPosts into feed-query.ts returning
   { posts, total }; parallel count query now correctly shares the same `where`
   clause as the list query, fixing a latent filter bug with `since`.

4. AI usage module — extracted quota logic into ai-usage.ts exposing
   checkAndConsume / getUsage; UsageCheckResult discriminated union replaces
   inline if-chains; burst rate-limit map is private to the module.

5. Auth service module — auth-service.ts absorbs register/verifyEmail/login/
   logout DB and crypto logic; email-verification-service.ts deleted; route
   handlers reduced to thin HTTP orchestrators. token-service.ts kept for
   cookie helpers only.

6. Badge rules executable — BADGE_RULES moved from @peerconnect/shared to
   apps/backend/src/modules/badge-rules.ts; each rule carries its own
   check(tx, userId) closure; badge-engine.ts reduced to a generic
   Promise.all loop; shared retains only BadgeEvent and BADGE_NAMES.

7. Reply upvote join — getReplies now includes upvotes:{where:{userId}} in the
   Prisma select; eliminates a separate upvote.findMany round-trip. userId
   made required (always passed from authenticated route).

8. Auth state consolidation — deleted useInitAuth.ts (React Query → Zustand
   bridge) and store/auth.ts (Zustand). Replaced with useAuth() wrapping
   useQuery(["auth","me"]) directly. After login: invalidateQueries triggers
   a clean /auth/me refetch (avoids the previous setAuth patch with partial
   user shape). After logout/delete: queryClient.clear() is sufficient.

Files changed:
  apps/backend/src/routes/posts.ts
  apps/backend/src/routes/replies.ts
  apps/backend/src/routes/auth.ts
  apps/backend/src/modules/notifier.ts              (new)
  apps/backend/src/modules/feed-query.ts            (new)
  apps/backend/src/modules/ai-usage.ts              (new)
  apps/backend/src/modules/auth-service.ts          (new)
  apps/backend/src/modules/badge-rules.ts           (new)
  apps/backend/src/modules/badge-engine.ts
  apps/backend/src/modules/reply-query.ts
  apps/backend/prisma/seed-data.ts
  apps/frontend/src/hooks/useAuth.ts                (new)
  apps/frontend/src/api/posts.ts
  apps/frontend/src/App.tsx
  apps/frontend/src/components/ProtectedRoute.tsx
  apps/frontend/src/components/AvatarDropdown.tsx
  apps/frontend/src/pages/LoginPage.tsx
  apps/frontend/src/pages/FeedPage.tsx
  apps/frontend/src/pages/AskPage.tsx
  apps/frontend/src/pages/PostDetailPage.tsx
  apps/frontend/src/pages/SettingsPage.tsx
  apps/frontend/src/pages/UserProfilePage.tsx
  packages/shared/src/index.ts
  apps/backend/src/modules/email-verification-service.ts  (deleted)
  apps/frontend/src/hooks/useInitAuth.ts                   (deleted)
  apps/frontend/src/store/auth.ts                          (deleted)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

────────────────────────────────────────────────────────────────

feat(#48): add badge rank config and top-badge persistence on award

Foundational slice for surfacing user badges in the UI (grill-me design
session): a user's single "top badge" is now computed and persisted
whenever a badge is awarded, using an explicit quality-weighted rank
order rather than recency — peer-validated badges (upvotes, accepted
solutions) outrank pure activity-volume badges.

Key decisions:
- Rank/description/icon live in one shared BADGE_METADATA config
  (packages/shared) rather than a new DB column — the badge set is
  small (7) and already fully hardcoded in badge-rules.ts, so a
  migration was unnecessary overhead.
- topBadgeName/topBadgeAwardedAt are denormalized onto User and
  recomputed inside checkAndAwardBadges's existing transaction —
  feed/reply reads vastly outnumber badge-award writes, so cheap
  reads were prioritised over a per-read subquery.
- Migration (20260702190000_add_top_badge_to_user) was hand-written
  rather than generated via `prisma migrate dev`, because the dev DB
  had pre-existing drift on the search_vector index (known issue,
  see CLAUDE.md) that made `migrate dev` demand a full reset. Applied
  via `migrate deploy` instead, which doesn't drift-check.

Files changed:
  packages/shared/src/index.ts                    (+BADGE_METADATA)
  apps/backend/prisma/schema.prisma                (+User.topBadgeName, topBadgeAwardedAt)
  apps/backend/prisma/migrations/20260702190000_add_top_badge_to_user/migration.sql  (new)
  apps/backend/src/modules/badge-engine.ts         (+updateTopBadge)
  apps/backend/src/routes/users.ts                 (+topBadgeName in GET /users/:id)
  apps/backend/tests/badge-engine.test.ts          (+4 tests)
  apps/backend/tests/users.test.ts                 (+2 tests)

Also closed as part of this session, in the same working tree:

fix(#53): stop backend tests from wiping the dev database

`src/db.ts` imports "dotenv/config" at module scope. Every test file
computes its DB target as `process.env.DATABASE_URL ?? ".../peerconnect_test"`,
but since test files import buildApp() (which pulls in db.ts), dotenv
populates DATABASE_URL from .env — the dev DB — before that fallback
line ever runs. Every test file's afterAll/afterEach TRUNCATE and
DELETE were silently running against the real dev database on every
test run. Discovered when a background test run collided with a
manual db:seed pass and wiped freshly-seeded accounts mid-flight.

Fix: a new Vitest setupFiles entry (tests/setup-env.ts) forces
DATABASE_URL to the test DB before any test file's imports execute;
dotenv does not override an already-set var, so this wins
deterministically. Verified by snapshotting dev DB row counts across
two full suite runs — unchanged both times.

Files changed:
  apps/backend/tests/setup-env.ts    (new)
  apps/backend/vitest.config.ts      (+setupFiles)

Blockers / notes for next iteration:
- Full backend suite still has 4 pre-existing failing files unrelated
  to either change above (posts.test.ts ordering, ai.test.ts — 20
  failures, auth.test.ts — 1 failure, and a stale
  email-verification-service.test.ts referencing an already-deleted
  module). All predate this session and come from the separate
  uncommitted refactor already sitting in the working tree (see the
  commit message above this one). Confirmed unrelated by diffing
  against pre-fix test runs — same files/tests were already failing.
- Issues #49 (backfill), #50 (reply cards), #51 (feed cards), #52
  (post detail header) are unblocked and ready to pick up next.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

────────────────────────────────────────────────────────────────

feat(#49): backfill topBadgeName for existing users

Users who earned badges before #48 shipped would otherwise show no
badge until their next reply/upvote/solution event recomputes it.
One-time backfill closes that gap immediately.

Key decisions:
- Extracted as a testable module (badge-backfill.ts) plus a thin CLI
  wrapper (prisma/backfill-top-badge.ts), matching the existing
  seed.ts/seedReferenceData split rather than putting logic directly
  in the script.
- Backfill sets topBadgeAwardedAt to the badge's real historical
  awardedAt (from the UserBadge row), not the current time — unlike
  the live engine's `new Date()` approximation on award, we have the
  actual value here and should use it.
- No attempt to skip users who already have topBadgeName set; always
  recomputes from full UserBadge history for every badge-holding user.
  Simpler than a "skip if already set" check and free — the script is
  a one-time run, not a hot path.

Files changed:
  apps/backend/src/modules/badge-backfill.ts   (new)
  apps/backend/prisma/backfill-top-badge.ts    (new)
  apps/backend/package.json                    (+db:backfill-top-badge script)
  apps/backend/tests/badge-backfill.test.ts    (new, 6 tests)

Verified against real dev seed data, not just tests: free@tu-berlin.de
(First Reply + Getting Started) correctly resolved to Getting Started;
premium@tu-berlin.de (all 7 badges) resolved to Trusted Helper. Re-ran
the script a second time against the same dev DB — identical result.

Blockers / notes for next iteration:
- Same 4 pre-existing unrelated test failures as noted above
  (posts.test.ts, ai.test.ts, auth.test.ts, stale
  email-verification-service.test.ts) — unchanged failure counts,
  confirmed not caused by this change.
- Issues #50 (reply cards), #51 (feed cards), #52 (post detail header)
  remain unblocked and ready to pick up next.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

────────────────────────────────────────────────────────────────

feat(#50): show badge indicator on reply/comment cards

First real UI-facing slice of the badge-visibility feature (matches
the original complaint: badges were only visible on Settings, not
next to people's comments).

Key decisions:
- New shared AuthorLine component (apps/frontend/src/components) —
  the author-name-plus-badge rendering was about to be needed in 3
  places (reply cards, feed cards, post header), so it was extracted
  now rather than copy-pasted, even though only reply cards consume
  it in this slice.
- PostAuthor (api/posts.ts) is a single type shared by Post.author and
  Reply.author, so extending it with topBadgeName affects both — Post
  objects just won't have it populated by the backend until #51/#52
  land. AuthorLine treats missing/null the same way (falsy check), so
  this is safe in the interim.
- PostDetailPage.tsx's existing module-level authorName() helper was
  deliberately left in place (still used by the post header at line
  ~386) rather than refactored now — that call site belongs to #52,
  not this slice.

Files changed:
  apps/backend/src/modules/reply-query.ts        (+topBadgeName in author select/type)
  apps/backend/src/routes/replies.ts             (+topBadgeName in schema, serializeReply type, 2 inline selects)
  apps/backend/tests/replies.test.ts             (+2 tests)
  apps/frontend/src/components/AuthorLine.tsx    (new)
  apps/frontend/src/api/posts.ts                 (+topBadgeName on PostAuthor)
  apps/frontend/src/pages/PostDetailPage.tsx     (+AuthorLine import, reply card uses it)

Verified end-to-end against the real running backend (no browser tool
available this session): logged in as premium@tu-berlin.de, posted a
reply, confirmed GET /posts/:id/replies returns the correct
topBadgeName per author. Frontend tsc --noEmit and vite build both
clean.

Blockers / notes for next iteration:
- Same 4 pre-existing unrelated test failures, unchanged counts
  (posts.test.ts, ai.test.ts, auth.test.ts, stale
  email-verification-service.test.ts).
- UI has not been visually verified in an actual browser — no browser
  automation tool was available in this session. Worth a manual check
  before considering the feature fully done.
- Issues #51 (feed cards) and #52 (post detail header) are next; both
  can now reuse AuthorLine directly.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

────────────────────────────────────────────────────────────────

feat(#51, #52): show badge indicator on feed cards and post detail header

Completes the badge-visibility tracer bullet across all three planned
surfaces (replies in #50, now feed + post detail). Both issues landed
together since they share the exact same backend schema/serializer
(postSchema/serializePost in posts.ts) and frontend component
(AuthorLine).

Key decisions:
- Extended post-search.ts (raw SQL, separate from feed-query.ts) even
  though neither issue explicitly named it — it feeds the same
  postSchema/serializePost and search results render through the same
  PostCard/AuthorLine as the feed. Leaving it out would have been a
  silent, confusing gap (badges disappear specifically when searching).
- FeedPage.tsx's PostCard has a card-level onClick that navigates to
  the post; AuthorLine's links are wrapped in a stopPropagation span
  there (matching the existing pattern used by the edit/delete
  buttons in the same card) to prevent double-navigation. PostDetailPage's
  post header card has no such handler, so no wrapper was needed there.
- Removed both now-fully-dead authorName() helpers (FeedPage.tsx,
  PostDetailPage.tsx) and PostDetailPage's now-unused Post type import,
  now that AuthorLine has replaced every call site in both files.

Bugs found and fixed along the way (not part of either issue's ask,
but necessary/adjacent):
- PATCH /replies/:id's author select was still missing topBadgeName —
  a gap left over from #50 that #52's stricter typing caught. Fixed
  and added a test.
- posts.test.ts's afterEach only deleted users, but Post.authorId is
  onDelete: SetNull (not Cascade), so posts silently leaked across
  tests within the file, polluting later unscoped-count assertions.
  Adding more tests for this work tipped several previously-passing
  tests into failure. Fixed by also deleting posts in afterEach.
- Added a GET /posts/:id test suite from scratch — this endpoint had
  zero prior test coverage despite already existing in production code.

Files changed:
  apps/backend/src/modules/feed-query.ts        (+topBadgeName)
  apps/backend/src/modules/post-search.ts       (+topBadgeName, raw SQL + type)
  apps/backend/src/routes/posts.ts              (+topBadgeName in schema, serializer, 3 inline selects)
  apps/backend/src/routes/replies.ts            (fix: PATCH select was missing topBadgeName)
  apps/backend/tests/posts.test.ts              (+6 tests, +GET /posts/:id suite, afterEach fix)
  apps/backend/tests/post-search.test.ts        (+1 test)
  apps/backend/tests/replies.test.ts            (+1 test for the PATCH fix)
  apps/frontend/src/pages/FeedPage.tsx          (AuthorLine + stopPropagation wrapper, dead code removed)
  apps/frontend/src/pages/PostDetailPage.tsx    (AuthorLine, dead code + unused import removed)

Verified end-to-end against the real running backend (no browser tool
available this session): GET /posts, GET /posts/:id, and GET
/posts/search all correctly return topBadgeName per author. Frontend
tsc --noEmit and vite build both clean.

Blockers / notes for next iteration:
- Same pre-existing unrelated failures as before, unchanged
  (posts.test.ts's 10 FeedQuery.getFeedPosts destructuring bugs —
  calls a function that now returns {posts,total} as if it still
  returned an array directly, unrelated to this work; ai.test.ts's 20;
  one flaky 5000ms-timeout test, a different one each run; auth.test.ts's
  1; stale email-verification-service.test.ts referencing a deleted
  module).
- UI still has not been visually verified in an actual browser — no
  browser automation tool was available in this session across any of
  #50/#51/#52. This is the one remaining gap before calling the whole
  badge-visibility feature (issues #48-#52) fully done.
- All 5 issues from the original grill-me/to-issues breakdown are now
  closed. The feature is code-complete pending a manual browser check.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

────────────────────────────────────────────────────────────────

fix(#54): stop backend tests from making real SMTP calls to Resend

With the badge-visibility feature (#48-#52) done, moved to the next
priority tier per ralph/prompt.md's task ordering (critical bugfixes
before new features) rather than declaring the queue empty — several
pre-existing, previously-unexplained flaky failures observed
throughout this session turned out to share one root cause.

Root cause: the auth refactor (already uncommitted in the working
tree before this session) moved email sending into a private,
unexported sendVerificationEmail() inside auth-service.ts, calling
nodemailer directly with real Resend credentials from .env. All 9
other backend test files still mocked the old, now-deleted
email-verification-service.js path — a no-op mock, since nothing
imports that path anymore. Every test calling registerVerifyAndLogin()
(nearly the whole suite) was making a real network call to Resend's
SMTP API, with register() having no try/catch around it.

This explains, in hindsight, several things previously misattributed
to generic environmental/bcrypt flakiness this session:
- auth.test.ts's intermittent 500-instead-of-201 registration failure
- "Test timed out in 5000ms" failures that hit a different test each
  run in notifications.test.ts, replies.test.ts, and posts.test.ts
- Slow overall suite runtime

Key decisions:
- Mock nodemailer itself (the actual external module boundary/seam),
  not auth-service.ts's internal function — matches the TDD skill's
  "test/mock at the public boundary" principle, and is robust to
  future internal refactors of how email gets sent.
- Centralized the mock in tests/setup-env.ts (already registered via
  vitest.config.ts's setupFiles, same mechanism used for #53's
  DATABASE_URL fix) instead of duplicating it across 9 files again —
  the whole reason this went stale unnoticed was 9 copies of the same
  mock with no single source of truth.
- Deleted tests/email-verification-service.test.ts outright (0 tests,
  testing an already-deleted module) rather than trying to preserve it.

Files changed:
  apps/backend/tests/setup-env.ts                          (+nodemailer mock)
  apps/backend/tests/{ads,auth,badge-engine,notifications,
    posts,post-search,replies,users}.test.ts                (removed stale mock + unused vi import)
  apps/backend/tests/ai.test.ts                             (removed stale mock only; keeps vi for its own ai-answer mock)
  apps/backend/tests/email-verification-service.test.ts     (deleted)

Verified: auth.test.ts passed 19/19 across 3 consecutive isolated
runs (previously flaky). Full suite runtime dropped from ~340s to
~75s. notifications.test.ts and replies.test.ts now fully green with
no recurrence of their prior timeout flakes. Dev DB row count
unchanged (13) throughout — #53's isolation fix continues to hold.

Blockers / notes for next iteration:
- Two pre-existing, unrelated bugs remain, both already diagnosed but
  not fixed (out of scope for this issue):
  1. posts.test.ts's 10 FeedQuery.getFeedPosts tests call the function
     as if it still returns a bare array; it returns {posts, total}
     since the uncommitted refactor changed its signature. Test-only
     fix (destructure {posts} in each assertion).
  2. ai.test.ts's 20 failures ("Cannot read properties of undefined
     (reading 'clear')") — a separate, unrelated generateAiAnswer mock
     issue, not touched by this fix.
- Both would make good next AFK issues if continuing down the
  critical-bugfix track.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

────────────────────────────────────────────────────────────────

fix(#55, #56, #57): backend test suite is fully green (247/247)

Continued down the critical-bugfix track from #54 rather than
stopping once the badge feature and known infra issues were done —
the two remaining "known bugs" (#55, #56) were fully diagnosed
already; fixing #56 then surfaced a third, more serious one (#57).

fix(#55): FeedQuery.getFeedPosts tests used stale array-return
calling convention. getFeedPosts's return type changed to
{posts, total} in the uncommitted refactor; 10 tests in
posts.test.ts were never updated to destructure {posts}. Test-only
fix, no source changes — updated all 10 call sites
(const posts/allPosts/page2/noMatch/match = await getFeedPosts(...)
→ const { posts } = ..., renaming the destructured binding per test
as needed). posts.test.ts: 53/53 passing.

fix(#56): ai.test.ts imported `rateLimitMap` from routes/ai.ts, but
the refactor moved it into ai-usage.ts as a private, intentionally
non-exported Map. The import silently resolved to undefined (test
files aren't covered by tsconfig's `include` so this wasn't caught
by typecheck), and every `rateLimitMap.clear()` call threw. Rather
than re-exposing the internal Map, added a purpose-built
`resetRateLimit()` export to ai-usage.ts and pointed the test's 5
call sites at it — respects the module's existing encapsulation
instead of breaking it for test convenience.

fix(#57): fixing #56 let a pre-existing test actually run for the
first time, which caught a real regression — checkAndConsume()
incremented the free-tier daily quota *before* calling
generateAiAnswer(), so a failed OpenAI call still burned a query.
This is a regression of an already-closed issue (#41, "increment
usage after success, not before") that the uncommitted refactor
silently reintroduced by collapsing the old checkDailyLimit/
incrementDailyUsage split back into one checkAndConsume. Restored
the split: checkUsage() is now read-only (returns
{allowed, ftsOnly, shouldIncrement}), and routes/ai.ts calls the new
incrementDailyUsage() only after generateAiAnswer resolves
successfully and only when shouldIncrement is true (free, ask-surface
requests — premium and inline-surface behavior unchanged).

Files changed:
  apps/backend/tests/posts.test.ts        (10 destructuring fixes)
  apps/backend/src/modules/ai-usage.ts    (checkAndConsume split into checkUsage + incrementDailyUsage, +resetRateLimit)
  apps/backend/src/routes/ai.ts           (call incrementDailyUsage only after success)
  apps/backend/tests/ai.test.ts           (import/call resetRateLimit instead of rateLimitMap)

Result: full backend suite — 247/247 tests passing, 13/13 files
green. First fully-green run this session. Dev DB row count
unchanged (13) throughout — #53's test-isolation fix continues to
hold.

Blockers / notes for next iteration:
- None outstanding from the badge feature or backend test
  infrastructure — everything filed this session (#48-#57) is closed
  and verified.
- The large pre-existing uncommitted refactor (architecture
  improvements, see the first commit message in this file) is still
  sitting uncommitted in the working tree, separate from all of the
  above. Not touched or evaluated for correctness beyond what
  surfaced through the bugs above.
- UI still has not been visually verified in an actual browser for
  the badge-visibility feature — no browser automation tool was
  available in this session.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

────────────────────────────────────────────────────────────────

feat(#58): mock premium upgrade (free → premium)

Adds a self-service, non-payment way for a free user to become
premium. Subscription.status was previously a static DB flag only
ever set via seed scripts or direct test writes — there was no API
endpoint or UI action to change it, so the already-implemented
premium-gated behaviors (ad-free feed in ads.ts, unlimited AI queries
in ai-usage.ts) could never actually be exercised by real users.

Key decisions (from prior grill-me/to-issues design session):
- Real DB toggle, not UI theater — PATCH /users/me/subscription
  actually flips Subscription.status so premium-gated behavior
  genuinely changes, clearly labeled "Demo only — no payment is
  processed" rather than faking a payment flow.
- Single PATCH endpoint taking {status: "free"|"premium"} rather than
  two verb-style endpoints (upgrade/downgrade) — mirrors the schema
  enum directly and is idempotent by construction.
- No fake endDate set on upgrade — leaving it null avoids implying
  auto-renewal/expiry logic that doesn't exist.
- Endpoint lives in users.ts alongside the other /users/me/* routes
  rather than a new dedicated route file, consistent with existing
  route organization.
- This slice only ships the upgrade direction in the UI (button shown
  when status === "free"). Downgrade + its confirm-step UX is #59,
  which builds on this same endpoint and mutation.

Files changed:
  apps/backend/src/routes/users.ts         (+PATCH /users/me/subscription)
  apps/backend/tests/users.test.ts         (+5 tests: upgrade, downgrade,
                                             idempotency, invalid status, 401)
  apps/frontend/src/api/users.ts           (+updateSubscription)
  apps/frontend/src/pages/SettingsPage.tsx (+Upgrade to Premium button,
                                             demo disclaimer caption)

Verified: full backend suite green (252/252, 13/13 files — 5 new tests
for this endpoint). Frontend/backend typecheck clean, both workspace
builds clean (tsc + vite build). Verification was via the existing
app.inject-based test suite (real Fastify app, real test Postgres
DB) — no browser automation tool was available this session to
click through the Settings page UI, consistent with prior sessions
noted in commit.md.

Blockers / notes for next iteration:
- `npm run lint` and `n8n start` from ralph/prompt.md's feedback-loop
  list were skipped: no lint script/ESLint config exists anywhere in
  this repo, and n8n is unrelated to this project (template leftover)
  — neither is applicable here.
- #59 (mock premium downgrade with confirm step) is now unblocked —
  it extends the same button/mutation added here, no new backend work
  beyond a downgrade-direction test.
- UI has not been visually verified in an actual browser.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

────────────────────────────────────────────────────────────────

feat(#59): mock premium downgrade (premium → free) with confirm step

Extends #58's mock subscription toggle to support downgrading, with
an inline confirmation step since downgrading has real functional
impact (ads reappear via ads.ts, AI daily quota re-applies via
ai-usage.ts) — unlike upgrading, which is harmless to do accidentally.

Key decisions (from prior grill-me/to-issues design session):
- No new backend endpoint — PATCH /users/me/subscription from #58
  already accepts {status: "free"}; this issue only adds the
  downgrade-direction UI and a test proving premium-gated logic
  actually observes the change.
- Confirm step mirrors the existing delete-account pattern in this
  same file (local boolean state, Cancel resets it, Confirm fires the
  mutation) rather than a modal/dialog component, for consistency.
- Backend test hits GET /ai/usage (which calls the private
  isPremiumUser() internally) before and after downgrading, rather
  than trying to test isPremiumUser() directly — it isn't exported,
  and this is a more realistic end-to-end assertion anyway.

Files changed:
  apps/backend/tests/users.test.ts         (+1 test: downgrade →
                                             GET /ai/usage reflects
                                             free-tier limits)
  apps/frontend/src/pages/SettingsPage.tsx (+"Downgrade to Free"
                                             button shown when premium,
                                             inline Cancel/Confirm step)

Verified: full backend suite green (253/253, 13/13 files — 1 new
test). Typecheck and both workspace builds (tsc + vite build) clean.
Verification was via the app.inject-based test suite (real Fastify
app, real test Postgres DB) — no browser automation tool was
available this session to click through the Settings page UI.

Note: this commit also carries the feat(#58) log entry above — it
was written to this file in the previous session but never actually
committed (an oversight), so it rode along with this commit instead.

Blockers / notes for next iteration:
- Same as #58: no lint script/ESLint config exists in this repo, and
  n8n from ralph/prompt.md's feedback-loop list is inapplicable here.
- Both mock subscription issues (#58, #59) from the original
  grill-me/to-issues breakdown are now closed. Feature is code-complete
  pending a manual browser check.
- UI still has not been visually verified in an actual browser.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

────────────────────────────────────────────────────────────────

feat(#59): turn on structured logging (pino)

Fastify's logger was fully disabled (`Fastify({ logger: false })`), so
nothing structured was ever emitted — only a handful of console.log /
console.error calls remained. Closes the "logging" gap flagged in a
/grill-me → /to-issues design session against the project's dev-checklist
evaluation report (GitHub #65).

Key decisions (from the grill-me session):
- New apps/backend/src/logger.ts exports a single pino instance, wired into
  Fastify via the `loggerInstance` option (Fastify v5 supports passing a
  pre-built pino instance this way) — lets notifier.ts and index.ts share
  the exact same instance/config instead of re-deriving it.
- Level branches on NODE_ENV: "silent" under test (keeps all pre-existing
  tests' output, and future CI logs, quiet), "info" otherwise. Pretty-printed
  via pino-pretty outside production, plain JSON in production.
- Redact config strips req.headers.cookie, req.headers.authorization,
  req.body.password, and res.headers["set-cookie"] — covers both the
  request side (login/register bodies, forwarded cookies) and the response
  side (Set-Cookie headers issued on login/register), since Fastify's
  default req/res serializers would otherwise put both in the log line
  verbatim.
- Test-first (TDD): wrote apps/backend/tests/logger.test.ts against a
  not-yet-existing src/logger.ts (confirmed red), then implemented. The two
  testable seams: `logger.level` (silent under test) and `redactConfig`
  used to build a scratch pino instance against a captured stream (the four
  sensitive paths never appear in emitted JSON; non-sensitive fields do).
  Didn't try to test the app.ts/index.ts/notifier.ts wiring directly — with
  level=silent under test there's nothing observable to assert beyond "the
  existing suite still passes," which is the real regression guard here.

Files changed:
  apps/backend/src/logger.ts            (new — pino instance + redact config)
  apps/backend/src/app.ts               (Fastify({ logger: false }) →
                                          Fastify({ loggerInstance: logger }))
  apps/backend/src/index.ts             (console.log → logger.info for the
                                          two startup lines)
  apps/backend/src/modules/notifier.ts  (console.error → logger.error in the
                                          dispatch catch)
  apps/backend/tests/logger.test.ts     (new — 2 tests)
  apps/backend/package.json             (+pino dependency, +pino-pretty
                                          devDependency)

Verified: full backend suite green (270/270, 16/16 files — 2 new).
Typecheck and both workspace builds (tsc + vite build) clean, including
the check-db-seed-imports prebuild guard. Manually started the dev server
and curled /health — pretty request/response log lines appeared as
expected, with no secrets visible.

Blockers / notes for next iteration:
- npm run lint and n8n start from ralph/prompt.md's feedback-loop list were
  skipped: no lint script/ESLint config exists anywhere in this repo, and
  n8n is unrelated to this project (template leftover) — same note as
  prior sessions in this file.
- #60 (CI pipeline) and #61 (general rate limiting) are the other two
  issues from the same design session — both unblocked, independent of
  this one, and are the intended next tasks for the ralph loop.
- UI/browser was not touched by this change; only the backend dev server
  was manually exercised via curl.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

────────────────────────────────────────────────────────────────

feat(#60): add GitHub Actions CI pipeline

Key decisions (from the grill-me/to-issues design session, GitHub #66):
- Triggers on every push (all branches) plus PRs targeting main - fast
  feedback on branches, not just once a PR opens.
- postgres:16 service container (peerconnect_test, pg_isready health check)
  rather than building the seeded docker/db/Dockerfile image - the test
  suite creates its own fixtures, so the baked-in seed data would be dead
  weight and real build time for nothing.
- Corrected mid-implementation: the migration guard matches the two exact
  spurious lines named in CLAUDE.md (DROP INDEX "posts_search_vector_idx";
  with no IF EXISTS, and ALTER TABLE "posts" ALTER COLUMN "search_vector"
  DROP DEFAULT;), not a blanket grep for any "search_vector" mention. A
  blanket match would have false-positived on this repo's own history -
  three existing legitimate migrations (init, post_implementation,
  restore_search_vector_gin_index) already reference that column/index.
  Verified both directions: no match against real history, confirmed match
  against a scratch file with the exact spurious pattern.
- packages/shared is built before anything backend-related, mirroring the
  root dev script and docker/db/Dockerfile - backend's package.json
  resolves @peerconnect/shared only via its built dist/, for both runtime
  imports and tsc's module resolution during typecheck.

Files changed:
- .github/workflows/ci.yml: new - checkout, setup-node (22, npm cache),
  npm ci, build shared, prisma generate, migration guard, prisma migrate
  deploy, typecheck, build, test.
- .ai/issues/done/60-ci-pipeline.md: issue moved to done.

Verified locally (no push/PR opened this session, so the workflow hasn't
run on GitHub's own infrastructure yet): started a fresh postgres:16
Docker container matching the CI service config exactly, ran every job
step against it in order - all 9 migrations applied cleanly from empty,
typecheck/build clean, full suite green (270/270) against the freshly
migrated container. Directly confirmed the "catches a deliberately broken
build" criterion by temporarily introducing a type error, confirming tsc
failed with TS2322, then reverting it.

Blockers/notes for next iteration:
- The workflow itself has only been simulated locally via Docker, not run
  on an actual GitHub-hosted runner - that needs a push or PR, which this
  session didn't do (no push without being asked).
- #61 (general rate limiting) is the last issue from this design session,
  unblocked and ready to start.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

────────────────────────────────────────────────────────────────

feat(#61): add general API rate limiting (@fastify/rate-limit)

Key decisions (from the grill-me/to-issues design session, GitHub #67):
- buildApp() gains an optional { enableRateLimit?: boolean } param,
  defaulting to NODE_ENV !== "test" - keeps all pre-existing tests
  unaffected (many requests per app instance, built once in beforeAll)
  while letting one dedicated test opt back in explicitly rather than
  mutating global process.env state.
- Global default 100 req/min, /auth/login and /auth/register overridden to
  5 req/min via per-route config.rateLimit (brute-force/signup-spam
  surface); /ai/* excluded via config.rateLimit: false since it already has
  its own more precise per-user burst/daily quota in ai-usage.ts.
- ServiceErrorCode (packages/shared) widened to include "rate_limited" so
  the 429 body matches the same { code, message } shape already used for
  the 503 service_unavailable case.

Bug found and fixed during implementation: @fastify/rate-limit doesn't call
reply.send() on the exceeded path - it throws whatever errorResponseBuilder
returns. That thrown plain object landed in this app's custom
setErrorHandler, which only special-cased the DB-unavailable error and
otherwise fell through to a bare reply.send(error) - since the thrown value
isn't an Error instance, that produced a 500, not 429. Caught immediately
by tests/rate-limit.test.ts (written red-first: the test never observed a
429 in 105 attempts; root-caused by temporarily logging
x-ratelimit-remaining per request, which showed the counter correctly
hitting 0 right as the response flipped to 500). Fixed with a small new
isRateLimitError guard mirroring db-errors.ts's existing pattern exactly,
with its own red-first test file.

Files changed:
- packages/shared/src/index.ts: ServiceErrorCode -> "service_unavailable" |
  "rate_limited".
- apps/backend/src/app.ts: buildApp(opts) + global rate-limit registration
  + isRateLimitError branch in setErrorHandler.
- apps/backend/src/modules/rate-limit-errors.ts: new - isRateLimitError
  guard.
- apps/backend/src/routes/auth.ts: config.rateLimit override (5/min) on
  register + login.
- apps/backend/src/routes/ai.ts: config.rateLimit: false on both AI routes.
- apps/backend/tests/rate-limit.test.ts: new, 3 tests.
- apps/backend/tests/rate-limit-errors.test.ts: new, 4 tests.
- apps/backend/package.json: +@fastify/rate-limit dependency.
- .ai/issues/done/61-general-rate-limiting.md: issue moved to done.

Verified against a real running dev server, not just the test suite: 6
rapid POST /auth/login attempts - first 5 return 401 (wrong credentials),
6th returns 429 with the exact {code, message} body and
retry-after/x-ratelimit-* headers; POST /ai/ask stays 401 either way,
confirming the exclusion. Full backend suite: 277/277 passing (270
pre-existing + 7 new), 18/18 files. Typecheck and both workspace builds
clean - required rebuilding packages/shared's dist after widening
ServiceErrorCode, same dist-resolution constraint noted in #60.

Blockers/notes for next iteration:
- This was the last issue from the grill-me/to-issues session that started
  with the dev-checklist evaluation report (logging #59, CI #60, rate
  limiting #61 - all three now closed).
- None of this has been verified against an actual GitHub Actions run yet
  (#60's workflow hasn't been pushed) - worth doing together once ready to
  push.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

────────────────────────────────────────────────────────────────

docs: document logging, rate limiting, and CI pipeline

Note: this entry is a catch-up log for commit 018ba55, made in a prior
session that missed writing to this file at the time.

Covers the three infra additions from #59-#61: Pino structured logging and
@fastify/rate-limit added to the Tech Stack table; a new Continuous
Integration section describing the GitHub Actions pipeline; a
rate-limiting note in both Authentication and API Documentation; and the
Project Structure tree updated with .github/workflows/ci.yml, logger.ts,
and the two new error-detection modules (db-errors.ts was already missing
from the tree despite existing - added it alongside rate-limit-errors.ts
for consistency).

Files changed:
- README.md: Table of Contents, Tech Stack, Authentication, API
  Documentation, new Continuous Integration section, Project Structure
  tree.

Also pushed 3 commits (#59, #60, #61) plus this docs commit to origin/main
in this session - first push of the grill-me/to-issues design-session work.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

────────────────────────────────────────────────────────────────

chore(#62): fix devcontainer port forwarding, automate git hooks

Key decisions (from a second grill-me/to-issues session scoping fully
automatic Codespace startup - #62-#64):
- forwardPorts [3000, 3001, 5432] -> [3001, 5173, 5432]: 3000 was unused
  (backend is 3001, frontend is Vite's default 5173 per
  apps/frontend/vite.config.ts), and 5173 was missing entirely.
- git config core.hooksPath .githooks added to postCreateCommand - was a
  manual README step, needed for the pre-commit search_vector guard.

Files changed:
- .devcontainer/devcontainer.json: both fixes above.
- .ai/issues/done/62-devcontainer-ports-hooks.md: issue moved to done.

Verified: JSON parses cleanly; ran git config core.hooksPath .githooks
directly and confirmed git config --get core.hooksPath returns .githooks
afterward. No automated test seam - this is a devcontainer config file
with no runtime code path.

Side finding worth flagging: this local checkout's core.hooksPath was
actually unset before this (defaulting to .git/hooks) - the pre-commit
search_vector guard hadn't been active locally at all until this change
was verified. Running the verification step fixed that for this checkout
too, which is the correct outcome, not a side effect to revert.

Blockers/notes for next iteration:
- #63 (auto-generate .env) and #64 (auto-start dev servers, blocked by
  #63) are the remaining issues from this session.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

────────────────────────────────────────────────────────────────

chore(#63): auto-generate apps/backend/.env on Codespace setup

Key decisions:
- New .devcontainer/setup-env.sh mirrors db-up.sh's own style (set -euo
  pipefail, cd to repo root regardless of caller CWD, idempotent). Skips
  entirely if apps/backend/.env already exists, so a container rebuild
  never clobbers a hand-edited .env.
- cp's from .env.example first (so future vars added there flow through
  automatically) rather than generating the file from scratch, then fixes
  exactly 3 known lines via sed: JWT_SECRET gets a real openssl rand -hex
  32 value; SMTP_PASS and OPENAI_API_KEY get commented out rather than
  copied verbatim.
- The comment-out matters: ai-answer.ts's `if (!apiKey) throw ...` guard
  only catches a fully-unset var. A literal placeholder string like
  "<openai-api-key>" is non-empty, so it passes that guard and attempts a
  real OpenAI call with garbage credentials - a messier failure than
  today's clean "not configured" error. Still fully compatible with a real
  Codespaces secret set later - dotenv never overrides an already-set env
  var.
- Wired into postCreateCommand ahead of db-up.sh.

Verification note: this script's only real runtime target is the Linux
devcontainer, and this session runs on macOS (BSD sed, incompatible -i
syntax). Verified inside a real container running the exact base image
from devcontainer.json (mcr.microsoft.com/devcontainers/javascript-node:22)
against a scratch copy of just the script + .env.example - never touched
this machine's real apps/backend/.env (confirmed its mtime was unchanged
afterward).

Files changed:
- .devcontainer/setup-env.sh: new script.
- .devcontainer/devcontainer.json: postCreateCommand wiring.
- .ai/issues/done/63-auto-generate-env.md: issue moved to done.

Verified: first run generates a correct .env (64-char hex JWT_SECRET,
DATABASE_URL/FRONTEND_URL unchanged, SMTP_PASS/OPENAI_API_KEY commented
out); second run is byte-for-byte identical (diff confirmed) - correctly a
no-op. Loaded the generated file through the real dotenv package (same
call pattern db.ts uses) and confirmed OPENAI_API_KEY/SMTP_PASS resolve to
undefined - the exact condition the AI guard needs to take the clean path
rather than a real API call with the placeholder. No TypeScript touched,
but re-ran typecheck/build/full backend suite anyway (277/277 passing).

Blockers/notes for next iteration:
- #64 (auto-start dev servers) is the last issue from this session, now
  unblocked.
- The AI-guard verification was via dotenv-loading in isolation, not a full
  app boot - #64 will exercise the complete flow end-to-end once dev
  servers actually auto-start against this generated .env.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
