feat: Issue 10 — Full-Text Post Search

Key decisions:
- PostSearchService (post-search.ts) uses prisma.$queryRaw with Prisma.sql
  tagged template literals for all parameterized queries; no user input is ever
  interpolated as a literal — websearch_to_tsquery('english', ${q}) escapes q
  safely, making SQL injection structurally impossible
- search_vector is a GENERATED ALWAYS AS (to_tsvector('english', content)) STORED
  column from the initial migration; no trigger or Prisma middleware needed —
  PostgreSQL auto-updates it on every INSERT/UPDATE to content
- searchPosts joins users and LEFT JOINs replies for reply count in a single
  query; results ordered by ts_rank DESC so higher-frequency matches rank first
- Optional category filter uses Prisma.sql`AND p.category::text = ${category}`
  to avoid the CAST("PostCategory") enum type complexity while remaining safe
- Optional since filter reuses exported sinceDate() from feed-query.ts; sinceDate
  was made export (no other callers needed changing — just an export keyword)
- GET /posts/search registered before PATCH/DELETE /posts/:id so find-my-way
  resolves the static path segment "search" before the :id parameter; q is
  required (minLength:1) so Fastify returns 400 automatically for missing q
- Frontend: searchInput (typed text) and searchQuery (committed query) are kept
  separate; Enter commits the search, Escape or clearing the input clears it;
  when searchActive, feedQueryResult is disabled and searchQueryResult drives
  the UI — FilterPanel is hidden during search mode to avoid confusion
- Stemming test uses "study" -> "studying" (both stem to "studi" in PostgreSQL
  English config); the issue's "register -> registration" example is incorrect —
  they stem to different roots ("regist" vs "registr") in Snowball English

Files changed:
- apps/backend/src/modules/post-search.ts (new — searchPosts function)
- apps/backend/src/modules/feed-query.ts (export sinceDate helper)
- apps/backend/src/routes/posts.ts (GET /posts/search route)
- apps/backend/tests/post-search.test.ts (new — 12 tests: keyword match,
  stemming, category+search, since+search, empty result, SQL injection safety,
  ts_rank ordering, reply count, 4 route integration tests)
- apps/frontend/src/api/posts.ts (searchPosts function + SearchPostsParams)
- apps/frontend/src/pages/FeedPage.tsx (search bar in header; searchInput +
  searchQuery state; dual-query pattern; search mode context messages)
- .ai/issues/done/10-full-text-search.md (moved to done)

Blockers/notes:
- All 200 tests pass (12 new); tsc --noEmit clean on backend and frontend
- No new migration needed — search_vector was already a generated column
- All AFK issues are now complete

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
