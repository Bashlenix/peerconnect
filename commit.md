feat: Issue 18 — AdCard component & feed injection

Key decisions:
- api/ads.ts: thin fetch wrapper for GET /api/ads using the same
  credentials:include pattern as other API modules; typed Ad interface
  matches the backend select (id, title, body, imageUrl, linkUrl,
  advertiserName)
- AdCard component: amber border/background to be visually distinct from
  PostCard; "Sponsored" label + advertiserName in header; image rendered
  only when imageUrl is non-null (card layout unchanged when absent);
  entire card is an <a> with target="_blank" rel="noopener noreferrer"
- FeedPage: adsQueryResult is declared alongside feedQueryResult and
  searchQueryResult — all three useQuery calls are issued concurrently
  (React Query batches them in a single render, no waterfall)
- ads array is set to [] during active search so no slots are injected
  in search results; premium users get [] from the backend so the same
  code path suppresses ads transparently
- Injection logic: Fisher-Yates-shuffled order returned by API is
  preserved as-is; ads cycle via adSlot % ads.length when slots exceed
  ad count; no ad injected if posts.length < 5
- staleTime of 5 min on the ads query avoids re-fetching on every
  re-render while keeping ad rotation fresh

Files changed:
- apps/frontend/src/api/ads.ts  (new — getAds() + Ad type)
- apps/frontend/src/components/AdCard.tsx  (new — AdCard component)
- apps/frontend/src/pages/FeedPage.tsx  (added adsQueryResult, ad
  injection loop, imports)
- .ai/issues/done/18-ad-card-feed-injection.md  (moved to done)

Blockers / notes for next iteration:
- 16 pre-existing test failures in auth/notifications remain — not
  caused by this issue
- No frontend test runner is configured; typecheck passes clean
- Ad click tracking / impression events not in scope for this issue

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
