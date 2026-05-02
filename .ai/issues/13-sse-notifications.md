# Issue 13 — Real-Time SSE Notifications

**Type:** AFK
**Label:** needs-triage

## What to build

Real-time notifications delivered via Server-Sent Events. The `SSEManager` module holds open connections per user and exposes a `push(userId, event)` function called from post, reply, upvote, solution, and badge logic. The frontend shows a notification bell with unread count and a dropdown listing recent notifications.

Event types to dispatch:
- `new_post_in_category` — sent to all users subscribed to the post's category
- `reply_to_post` — sent to the post author
- `reply_upvoted` — sent to the reply author
- `reply_marked_solution` — sent to the reply author
- `badge_awarded` — sent to the user who earned it

## Acceptance criteria

- [ ] `GET /notifications/stream` establishes an SSE connection for the authenticated user; sends a `ping` event every 30s to keep the connection alive
- [ ] `SSEManager` unit tests cover: connection registration, `push` delivers to correct user, cleanup on disconnect, push to disconnected user does not throw
- [ ] `push(userId, event)` is called at the correct points in post creation, reply creation, upvote, solution marking, and badge awarding
- [ ] `GET /notifications` returns the current user's notification history (paginated, newest first)
- [ ] `PATCH /notifications/:id/read` marks a notification as read
- [ ] `PATCH /notifications/read-all` marks all notifications as read
- [ ] Frontend notification bell shows unread count badge; updates in real-time via SSE
- [ ] Clicking the bell opens a dropdown listing recent notifications with type, message, and timestamp
- [ ] Receiving a new SSE event appends to the dropdown and increments the unread count without a page reload

## Blocked by

- Issue 09 — Reply Upvoting, Solution Marking & Reply Edit/Delete
- Issue 12 — Notification Category Preferences
