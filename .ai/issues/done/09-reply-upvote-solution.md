# Issue 09 — Reply Upvoting, Solution Marking & Reply Edit/Delete

**Type:** AFK
**Label:** needs-triage

## What to build

Complete the reply interaction surface: any user can upvote a reply (once), the post author can mark/unmark one reply as the accepted solution, and reply authors can edit or delete their reply (delete blocked if the reply is the accepted solution).

## Acceptance criteria

- [ ] `POST /replies/:id/upvote` adds an upvote from the current user; returns 409 if already upvoted
- [ ] `DELETE /replies/:id/upvote` removes the user's upvote
- [ ] `PATCH /posts/:id/solution` accepts `{ replyId }` and marks that reply as `is_solution = true`, unsetting any previous solution on the same post; returns 403 if requester is not the post author
- [ ] `DELETE /posts/:id/solution` unmarks the current solution; returns 403 if not the post author
- [ ] `PATCH /replies/:id` updates reply content; returns 403 if not the author
- [ ] `DELETE /replies/:id` deletes the reply; returns 409 if `is_solution = true`; returns 403 if not the author
- [ ] Frontend reply shows an upvote button with current count; toggles filled/outlined state based on whether the user has upvoted
- [ ] Post author sees a "Mark as solution" button on each non-solution reply and an "Unmark" button on the current solution
- [ ] Accepted solution reply is visually highlighted (e.g. green border or checkmark badge)
- [ ] Reply author sees edit and delete controls; delete is hidden when the reply is the accepted solution

## Blocked by

- Issue 08 — Reply Thread View & Reply Creation
