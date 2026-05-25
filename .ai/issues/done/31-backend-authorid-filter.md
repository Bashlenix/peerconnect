# Issue #31 — Backend: add `authorId` filter to `GET /posts`

**Type:** AFK  
**GitHub:** https://github.com/Bashlenix/peerconnect/issues/31

## What to build

Add an optional `authorId` query parameter to the existing `GET /posts` endpoint so callers can fetch posts by a specific author. This is the backend foundation for the profile Posts tab.

The filter should be added in the feed-query module (`apps/backend/src/modules/feed-query/`) and wired into the route handler (`apps/backend/src/routes/posts.ts`). Update the frontend API client (`apps/frontend/src/api/posts.ts`) to accept and forward the new param.

## Acceptance criteria

- [x] `GET /posts?authorId=<uuid>` returns only posts authored by that user
- [x] Existing filters (category, since, subscribed) still work when combined with `authorId`
- [x] `authorId` is optional — omitting it preserves current behaviour
- [x] Frontend `fetchPosts()` in `posts.ts` accepts an optional `authorId` argument and forwards it as a query param
- [x] Invalid / unknown `authorId` returns an empty array, not an error

## Blocked by

None — can start immediately

## Resolution

Implemented in commit c9d92bc. All acceptance criteria met.
