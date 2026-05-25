feat(#36): account deletion with post/reply anonymisation

Key decisions:
- Post.authorId and Reply.authorId changed to String? (nullable) with onDelete: SetNull
  so posts/replies survive user deletion but are anonymised (authorId set to null).
- Manually created migration SQL (20260526000000_account_deletion): ALTER TABLE
  drops NOT NULL constraint and replaces Cascade FK with SET NULL FK for posts + replies.
- DELETE /users/me endpoint: JWT-authenticated, deletes user via prisma.user.delete,
  clears auth cookies with clearAuthCookies, returns 204.
- Frontend: ProfilePage shows "Delete account" button with inline confirm step (no
  AlertDialog — component not in ui/); on confirm calls deleteAccount(), clearAuth(),
  redirects to /login.
- Null-author UI guard: all post/reply cards show "Deleted User" for null authors with
  no profile link; isAuthor checks guard against null.author before id comparison.
- Type changes propagated through: PostAuthor (nullable in Post/Reply interfaces),
  FeedPost, ReplyItem, serializePost, serializeReply, ai-retrieval, badge/notification
  paths in posts+replies routes — all guarded with null checks before calling
  checkAndAwardBadges or creating notifications.
- Search results naturally exclude deleted-author posts (raw SQL INNER JOIN on authorId).

Files changed:
  apps/backend/prisma/schema.prisma
  apps/backend/prisma/migrations/20260526000000_account_deletion/migration.sql (new)
  apps/backend/src/routes/users.ts
  apps/backend/src/routes/posts.ts
  apps/backend/src/routes/replies.ts
  apps/backend/src/modules/feed-query.ts
  apps/backend/src/modules/reply-query.ts
  apps/backend/src/modules/ai-retrieval.ts
  apps/frontend/src/api/users.ts
  apps/frontend/src/api/posts.ts
  apps/frontend/src/pages/ProfilePage.tsx
  apps/frontend/src/pages/FeedPage.tsx
  apps/frontend/src/pages/PostDetailPage.tsx
  .ai/issues/done/36-account-deletion.md (moved)

Notes:
- Migration SQL must be applied via `prisma migrate deploy` or run manually.
- typecheck + build pass for both backend and frontend.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
