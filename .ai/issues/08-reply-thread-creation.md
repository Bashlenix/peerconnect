# Issue 08 — Reply Thread View & Reply Creation

**Type:** AFK
**Label:** needs-triage

## What to build

Clicking a post opens a thread detail page showing the full post and all replies sorted correctly (accepted solution first, then by upvote count descending, then by created_at ascending). Authenticated users can submit a new reply from an input field at the bottom.

## Acceptance criteria

- [ ] `GET /posts/:id/replies` returns all replies sorted by `is_solution DESC, upvote_count DESC, created_at ASC`
- [ ] `POST /posts/:id/replies` creates a reply with `content`; returns the created reply
- [ ] Frontend post detail page renders the full post body and all replies in correct order
- [ ] Each reply displays author name, content, upvote count, and a solution indicator if applicable
- [ ] Reply input field is visible at the bottom of the thread; submits on button click or Cmd/Ctrl+Enter
- [ ] Feed post cards link to the post detail page
- [ ] Reply count on the feed card increments after a new reply is submitted (via TanStack Query invalidation)

## Blocked by

- Issue 05 — Post Creation & Chronological Feed
