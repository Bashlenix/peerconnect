# Issue #33 — Profile page: add Posts tab and About tab with Load More pagination

**Type:** AFK  
**GitHub:** https://github.com/Bashlenix/peerconnect/issues/33

## What to build

Enhance `UserProfilePage.tsx` (`/users/:id`) with two tabs — **Posts** and **About** — so visitors can browse a user's posts directly from their profile.

The **About** tab contains the existing content unchanged (stats cards, badges, study programme, semester, languages). The **Posts** tab fetches `GET /posts?authorId=:id` and renders posts using the existing post card component (as used in `FeedPage.tsx`), with a "Load more" button for pagination (fetch next page on click, append to list).

## Key files
- `apps/frontend/src/pages/UserProfilePage.tsx` — enhance with tabs
- `apps/frontend/src/api/posts.ts` — `getPosts({ authorId })` already accepts authorId (added in #31)
- `apps/frontend/src/pages/FeedPage.tsx` — reference for how post cards are rendered
- `apps/backend/src/routes/posts.ts` — `GET /posts?authorId=&page=&limit=` (already supports authorId; check if pagination params exist, add if needed)

## Acceptance criteria

- [ ] Profile page shows two tabs: Posts (default/active) and About
- [ ] About tab renders existing profile content without any changes
- [ ] Posts tab fetches `GET /posts?authorId=:id` on mount and displays results using the existing post card component
- [ ] "Load more" button appears when more posts are available; clicking it appends the next page to the list
- [ ] "Load more" button is hidden (or shows "No more posts") when all posts have been loaded
- [ ] Empty state shown when the user has no posts (e.g. "No posts yet")
- [ ] Works for both self-view and viewing another user's profile
- [ ] Pagination uses `page` + `limit` query params on `GET /posts` (add to backend if not present)

## Tech constraints
- Frontend: React + TypeScript, TanStack Query for server state, Zustand for client state
- UI: Tailwind CSS + shadcn/ui only — reuse existing tab/button components if available
- Backend: Fastify + Prisma — add page/limit params to feed-query module if not already there

## Blocked by

- #31 (authorId filter) ✅ done
- #32 (settings route) ✅ done (not a hard dependency but both merged)
