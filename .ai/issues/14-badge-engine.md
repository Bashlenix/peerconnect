# Issue 14 — Badge Engine & Badge Display

**Type:** AFK
**Label:** needs-triage

## What to build

The `BadgeEngine` module awards badges in real-time when a user crosses a threshold. It is called after reply creation, upvote received, and solution marking. Newly awarded badges trigger a `badge_awarded` SSE notification. Earned badges are displayed on the user's public profile.

Badges and their thresholds:
- **First Reply** — 1 reply
- **Getting Started** — 3 replies
- **Active Helper** — 10+ replies
- **Community Builder** — 10+ replies in Social or Sport categories
- **Helpful Contributor** — 5 upvoted replies
- **Trusted Helper** — 15 upvoted replies
- **Solution Provider** — 5 accepted solutions

## Acceptance criteria

- [ ] `checkAndAwardBadges(userId, event)` queries the user's current counters and awards any newly crossed badge thresholds
- [ ] Already-awarded badges are not re-awarded (idempotent)
- [ ] `BadgeEngine` unit tests cover: each of the 7 badge thresholds independently, re-award prevention, correct badge triggered by correct event type
- [ ] Badge award is wrapped in a transaction with the triggering action (reply insert, upvote insert, solution update) so badges are never awarded for a rolled-back action
- [ ] `badge_awarded` SSE event is pushed to the user via `SSEManager.push` after a new badge is inserted
- [ ] `GET /users/:id` response includes the user's earned badges
- [ ] Frontend public profile renders earned badge icons/names; tooltip shows badge description on hover

## Blocked by

- Issue 09 — Reply Upvoting, Solution Marking & Reply Edit/Delete
