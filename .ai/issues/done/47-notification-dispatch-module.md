# 47 — Extract notification dispatch module

**Type:** AFK  
**Labels:** enhancement, done  
**Blocked by:** None

## What to build

Centralise all fire-and-forget notification logic from posts.ts and replies.ts into a single `notifier.ts` module. Use a discriminated union (`NotificationEvent`) so each event type is fully typed and self-exclusion guards live inside the module rather than scattered across route handlers.

## Acceptance criteria

- [ ] `notifier.ts` exports `dispatch(event: NotificationEvent)` covering all five event types: NEW_POST_IN_CATEGORY, REPLY_TO_POST, REPLY_UPVOTED, REPLY_MARKED_SOLUTION, BADGE_AWARDED
- [ ] Route files import only `dispatch` — no direct `sseManager` or `NotificationType` references
- [ ] Self-exclusion guards (e.g. replyAuthorId === postAuthorId) are inside the module, not in route handlers
- [ ] Errors are caught and logged inside `dispatch`; callers use fire-and-forget (`void dispatch(...)`)
