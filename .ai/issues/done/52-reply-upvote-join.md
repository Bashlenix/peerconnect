# 52 — Fold reply upvote lookup into reply query

**Type:** AFK  
**Labels:** enhancement, done  
**Blocked by:** None

## What to build

Eliminate the separate `upvote.findMany` round-trip in `getReplies` by including `upvotes: { where: { userId } }` in the Prisma reply select. Prisma performs a single join. Make `userId` required (the endpoint is authenticated; it was always passed).

## Acceptance criteria

- [ ] `getReplies(prisma, postId, userId: string)` — `userId` is no longer optional
- [ ] The reply select includes `upvotes: { where: { userId }, select: { userId: true } }`
- [ ] `hasUpvoted` is derived as `r.upvotes.length > 0` — no separate `upvote.findMany` call
- [ ] TypeScript compiles clean
