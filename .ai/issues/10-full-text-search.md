# Issue 10 — Full-Text Post Search

**Type:** AFK
**Label:** needs-triage

## What to build

Users can search posts by keyword using PostgreSQL full-text search. Results are ranked by relevance. The `PostSearchService` module wraps the `tsvector`/`tsquery` logic behind a clean interface and is fully unit tested.

## Acceptance criteria

- [ ] `GET /posts/search?q=keyword` returns posts ranked by `ts_rank` descending
- [ ] Search matches stemmed words (e.g. "register" matches posts containing "registration")
- [ ] `PostSearchService` unit tests cover: keyword match, stemming behaviour, category filter combined with search, time filter combined with search, empty result set, SQL injection safety (parameterised queries only)
- [ ] `posts.search_vector` is updated automatically when a post is created or edited (via Prisma middleware or database trigger)
- [ ] Frontend search bar is accessible from the feed page; submits on Enter
- [ ] Search results page renders matched posts with the same card layout as the feed
- [ ] Clearing the search query returns to the normal feed

## Blocked by

- Issue 05 — Post Creation & Chronological Feed
