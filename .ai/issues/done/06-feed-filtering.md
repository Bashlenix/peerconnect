# Issue 06 — Feed Filtering (Category, Time, Subscribed Toggle)

**Type:** AFK
**Label:** needs-triage

## What to build

Extend the feed with composable filters: category (Academic, Social, Sport, Daily Life Support), time range (last 24h, last 3 days, last 7 days), and a subscribed-categories toggle that narrows the feed to the user's preferred categories. Filters are applied via query parameters on `GET /posts`.

## Acceptance criteria

- [ ] `GET /posts?category=Academic` returns only Academic posts
- [ ] `GET /posts?since=24h` returns only posts from the last 24 hours (also supports `3d`, `7d`)
- [ ] `GET /posts?subscribed=true` returns only posts in the current user's subscribed categories
- [ ] Filters are combinable (e.g. `?category=Academic&since=7d` works correctly)
- [ ] `FeedQuery` module handles all filter combinations without SQL injection risk
- [ ] Frontend filter panel renders category checkboxes, time range selector, and subscribed-only toggle
- [ ] Changing a filter updates the feed immediately without a page reload
- [ ] Active filters are visually indicated

## Blocked by

- Issue 05 — Post Creation & Chronological Feed
