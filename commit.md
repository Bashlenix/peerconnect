feat: Issue 08 — Reply Thread View & Reply Creation

Key decisions:
- ReplyQuery module (reply-query.ts): accepts PrismaClient as first param for
  testability; orderBy: [isSolution DESC, upvotes._count DESC, createdAt ASC]
  using Prisma's relation-count ordering; returns ReplyItem[] with dates as
  Date objects and upvoteCount derived from _count.upvotes
- GET /posts/:id/replies: protected; 404 if post not found; delegates to
  getReplies(prisma, postId); returns { replies: ReplyItem[] }
- POST /posts/:id/replies: protected; validates content minLength:1; 404 if
  post not found; creates reply via prisma.reply.create with select to avoid
  separate fetch; createdAt/editedAt serialized via .toISOString()
- Routes extracted to replies.ts registered separately in app.ts to keep
  posts.ts focused on post CRUD; follows existing pattern
- Frontend: PostDetailPage fetches feed cache for post data (avoids a separate
  GET /posts/:id endpoint) and loads replies via useQuery(['replies', postId]);
  ReplyForm uses Cmd/Ctrl+Enter shortcut in addition to submit button;
  invalidates both ['replies', postId] and ['posts'] on new reply (keeps
  replyCount in sync on feed)
- FeedPage PostCard wrapped in React Router Link to /posts/:id with
  hover:shadow-md transition; focus ring for keyboard accessibility

Files changed:
- apps/backend/src/modules/reply-query.ts (new — getReplies)
- apps/backend/src/routes/replies.ts (new — GET /posts/:id/replies, POST /posts/:id/replies)
- apps/backend/src/app.ts (register repliesRoute)
- apps/backend/tests/replies.test.ts (new — 13 tests: ReplyQuery + route coverage)
- apps/frontend/src/api/posts.ts (added Reply type, getReplies, createReply)
- apps/frontend/src/pages/PostDetailPage.tsx (new — thread detail + reply form)
- apps/frontend/src/pages/FeedPage.tsx (PostCard wrapped in Link to /posts/:id)
- apps/frontend/src/App.tsx (added /posts/:id protected route)
- .ai/issues/done/08-reply-thread-creation.md (moved to done)

Blockers/notes:
- All 73 tests pass (13 new); tsc --noEmit clean on backend and frontend
- PostDetailPage reads post from ['posts'] query cache — if user navigates
  directly to /posts/:id without visiting the feed, the post will show a
  "Post not found" state until feed data loads; Issue 07 or a dedicated
  GET /posts/:id endpoint can resolve this cleanly
- Reply count on feed card updates after submitting a reply via query invalidation

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
