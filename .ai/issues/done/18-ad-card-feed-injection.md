# Issue 18 — AdCard Component & Feed Injection

**Type:** AFK
**Label:** needs-triage

## What to build

Add an `AdCard` component and inject ads inline into the post feed for free users. The feed calls `GET /api/ads` in parallel with `GET /api/posts` via React Query, then interleaves ad cards every 5 posts. No ads are shown if the feed has fewer than 5 posts. Premium users see no ads at all (the backend returns `[]`).

## Acceptance criteria

- [ ] `AdCard` is visually distinct from `PostCard` — clearly labelled "Sponsored" and styled differently (e.g. muted border, sponsor name shown)
- [ ] Clicking an ad opens `linkUrl` in a new tab with `rel="noopener noreferrer"`
- [ ] If `imageUrl` is present it is rendered; if null the card renders without an image and does not break layout
- [ ] Ads are injected every 5 posts (positions 5, 10, 15, …); no ad appears if the feed has fewer than 5 posts
- [ ] Ads are drawn in the shuffled order returned by the API; if there are more slots than ads, the list cycles
- [ ] `GET /api/ads` is called in parallel with `GET /api/posts` using React Query — no sequential waterfall
- [ ] Premium users see zero ad cards (API returns `[]`, no slots injected)
- [ ] Ad injection is skipped entirely during active search (search results show no ads)

## Blocked by

- Issue 17 — GET /api/ads Backend Endpoint
