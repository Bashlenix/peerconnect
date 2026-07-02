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
