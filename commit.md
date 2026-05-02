feat: Issue 13 — Real-Time SSE Notifications

Key decisions:
- SSEManager module holds per-user connection maps keyed by UUID; push()
  skips writableEnded/destroyed connections without throwing; unregister()
  prunes empty user buckets; singleton exported for use across routes
- GET /notifications/stream: reply.hijack() used to take ownership of the raw
  Node.js response; writes SSE headers + initial ping; 30s ping interval kept
  alive until client close event fires; clearInterval on close prevents leaks
- PATCH /notifications/read-all registered BEFORE PATCH /notifications/:id/read
  so find-my-way matches the static path first (no conflict since depths differ)
- POST /posts: fires NEW_POST_IN_CATEGORY notifications to all subscribed users
  (excluding post author) using createMany for batch insert then SSE push per
  user; wrapped in void fire-and-forget async IIFE to avoid delaying the 201
- POST /posts/:id/replies: extended post select to include authorId; creates
  REPLY_TO_POST notification + SSE push for post author, skipped when replier
  === post author
- POST /replies/:id/upvote: extended reply select to include authorId + postId;
  creates REPLY_UPVOTED notification + SSE push for reply author, skipped for
  self-upvote
- PATCH /posts/:id/solution: extended replyRecord select to include authorId;
  creates REPLY_MARKED_SOLUTION notification + SSE push for reply author, skipped
  when post author marks their own reply
- Frontend NotificationBell: EventSource("/api/notifications/stream") opened in
  useEffect; on "notification" event -> invalidate ['notifications'] query so
  TanStack Query refetches; bell badge shows unreadCount; dropdown lists 20
  most recent notifications with type label + timestamp; click marks read +
  navigates to post if postId present; "Mark all read" button when unreadCount > 0
- NotificationBell added to FeedPage header (between email and sign-out) and
  PostDetailPage header (ml-auto right side)

Files changed:
- apps/backend/src/modules/sse-manager.ts (new - SSEManager class + singleton)
- apps/backend/src/routes/notifications.ts (new - stream, list, mark-read, mark-all-read)
- apps/backend/src/app.ts (register notificationsRoute)
- apps/backend/src/routes/posts.ts (NEW_POST_IN_CATEGORY + REPLY_MARKED_SOLUTION push)
- apps/backend/src/routes/replies.ts (REPLY_TO_POST + REPLY_UPVOTED push)
- apps/backend/tests/notifications.test.ts (new - 26 tests: SSEManager unit, HTTP endpoints,
  integration tests verifying notification rows created on each trigger event)
- apps/frontend/src/api/notifications.ts (new - getNotifications, markNotificationRead,
  markAllNotificationsRead; Notification interface; NotificationType union)
- apps/frontend/src/components/NotificationBell.tsx (new - bell + SSE + dropdown)
- apps/frontend/src/pages/FeedPage.tsx (NotificationBell in header)
- apps/frontend/src/pages/PostDetailPage.tsx (NotificationBell in header)
- .ai/issues/done/13-sse-notifications.md (moved to done)

Blockers/notes:
- All 158 tests pass (26 new); tsc --noEmit clean on backend and frontend
- badge_awarded SSE event intentionally left for Issue 14 (Badge Engine) to wire;
  SSEManager.push("badge_awarded") call will be added there
- SSE stream endpoint not integration-tested with inject (long-lived connection
  incompatible with light-my-request); covered by SSEManager unit tests instead
- Issues 06, 10, 14 remain open

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
