# Issue 07 — Post Edit & Delete

**Type:** AFK
**Label:** needs-triage

## What to build

Post authors can edit their post at any time (recording `edited_at`) and delete it only if it has no replies. Enforce both rules in the backend and reflect them in the UI.

## Acceptance criteria

- [ ] `PATCH /posts/:id` updates `content` and sets `edited_at` to now; returns 403 if the requester is not the author
- [ ] `DELETE /posts/:id` deletes the post if `reply_count = 0`; returns 409 if replies exist; returns 403 if not the author
- [ ] Frontend post card shows edit and delete controls only to the post author
- [ ] Frontend inline edit form pre-fills current content and saves on submit
- [ ] Edited posts display an "edited" timestamp below the content
- [ ] Delete button shows a confirmation dialog before sending the request
- [ ] Delete button is hidden (or disabled with tooltip) when the post has replies

## Blocked by

- Issue 05 — Post Creation & Chronological Feed
