# 48 — Extract feed query module and fix count filter bug

**Type:** AFK  
**Labels:** bug, enhancement, done  
**Blocked by:** None

## What to build

Extract the `GET /posts` query logic into `feed-query.ts` returning `{ posts, total }`. The `total` count query must share the same `where` clause as the list query — the previous inline version omitted the `since` filter from the count, causing incorrect pagination totals when a time filter was active.

## Acceptance criteria

- [ ] `getFeedPosts(prisma, params)` is exported from `feed-query.ts` and returns `FeedResult = { posts: FeedPost[]; total: number }`
- [ ] `prisma.post.count` and `prisma.post.findMany` run in parallel via `Promise.all` and share the same `where` object
- [ ] The `since`, `category`, `subscribed`, and `authorId` filters all apply to both the list and the count
- [ ] Route handler imports `getFeedPosts` and removes the previously inline query logic
