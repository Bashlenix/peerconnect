feat: Issue 06 — Feed Filtering (Category, Time, Subscribed Toggle)

Key decisions:
- FeedQueryParams extended with category (PostCategory), since ("24h"|"3d"|"7d"),
  subscribed (boolean), userId (string); all optional — existing callers unaffected
- Subscribed filter fetches the user's NotificationPreference rows inside
  getFeedPosts and resolves them to a PostCategory[] before the Prisma query;
  short-circuits with [] immediately when no categories match (avoids unnecessary
  DB round-trip)
- Category + subscribed intersection: if both are supplied, the specific category
  must be in the user's subscribed list; otherwise returns empty — avoids leaking
  non-subscribed posts through a combined query
- since filter maps to a sinceDate() helper that converts "24h"/"3d"/"7d" to a
  Date threshold; used as { createdAt: { gte: threshold } } — no raw SQL
- GET /posts querystring schema extended with category (enum), since (enum),
  subscribed (boolean); Fastify validates inputs before reaching handler — invalid
  values return 400 automatically
- userId always available in GET /posts handler since route is protected; passed
  through to getFeedPosts unconditionally (ignored unless subscribed=true)
- Frontend: FeedFilters state { category, since, subscribed } drives queryKey
  ["posts", filters] so TanStack Query refetches immediately on any filter change
  (no page reload needed); FilterPanel renders category select, since select, and
  subscribed checkbox; "Clear all" button shown only when a filter is active;
  Card border highlighted blue when filters are active

Files changed:
- apps/backend/src/modules/feed-query.ts (SinceFilter type; extended
  FeedQueryParams; sinceDate helper; subscribed/category/since logic in
  getFeedPosts)
- apps/backend/src/routes/posts.ts (import SinceFilter; extended GetPostsQuery
  interface; extended querystring schema; pass filter params + userId to
  getFeedPosts)
- apps/backend/tests/posts.test.ts (10 new tests: category filter, since filter,
  subscribed filter, empty subscribed, combined category+since, subscribed+category
  intersection; 4 route integration tests: category param, since param, invalid
  category 400, invalid since 400)
- apps/frontend/src/api/posts.ts (SinceFilter type; GetPostsParams interface;
  getPosts accepts category/since/subscribed; appends to URLSearchParams)
- apps/frontend/src/pages/FeedPage.tsx (SINCE_OPTIONS constant; FeedFilters
  interface; FilterPanel component; filter state in FeedPage; queryKey includes
  filters; empty-state message differs when filters active)
- .ai/issues/done/06-feed-filtering.md (moved to done)

Blockers/notes:
- All 188 tests pass (10 new); tsc --noEmit clean on backend and frontend
- Issue 10 (Full-Text Search) remains open

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
