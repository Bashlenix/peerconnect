# 46 — Add GET /posts/:id endpoint

**Type:** AFK  
**Labels:** enhancement, done  
**Blocked by:** None

## What to build

Add a dedicated single-post API endpoint so PostDetailPage can fetch one post by ID without loading the entire feed. The frontend query key changes from `["posts"]` to `["post", postId]` and invalidates correctly on edit.

## Acceptance criteria

- [ ] `GET /posts/:id` route returns the same shape as the feed list items (including `replyCount`)
- [ ] PostDetailPage uses `useQuery(["post", postId])` backed by the new endpoint
- [ ] Edit mutation invalidates `["post", postId]`
- [ ] No feed fetch is triggered when navigating to a post detail page
