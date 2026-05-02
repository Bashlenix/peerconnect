feat: Issue 07 — Post Edit & Delete

Key decisions:
- PATCH /posts/:id: protected; validates content minLength:1; 403 if requester is
  not the author; sets editedAt = new Date() on update; returns full updated post
  via shared serializePost helper; 404 for unknown post
- DELETE /posts/:id: protected; 403 if not author; 409 if post._count.replies > 0
  (checked in a single Prisma query with _count select); 204 on success; 404 for
  unknown post
- Routes registered before PATCH/DELETE /posts/:id/solution in postsRoute to keep
  the file organized by resource then sub-resource
- Frontend api/posts.ts: updatePost(postId, content) → Post, deletePost(postId) →
  void; follow the same fetch/throw pattern as existing functions
- FeedPage PostCard refactored from <Link> wrapper to Card with onClick for
  navigation so author buttons can stopPropagation without nesting buttons in <a>
- PostCard inline edit: controlled Textarea pre-filled with post.content; Cancel/Save
  buttons; invalidates ['posts'] on success; editing state suppresses navigation click
- PostCard delete: Trash2 button is disabled (opacity-40 + disabled attr) when
  replyCount > 0 with tooltip; when 0 replies, clicking shows inline "Delete this
  post? / Cancel / Delete" confirmation row; mutation navigates away via onUpdated
- PostDetailPage: same edit/delete surface added to the post Card at the top;
  delete navigates to /feed on success; Pencil/Trash2 hidden while editing or
  confirming to prevent state overlap

Files changed:
- apps/backend/src/routes/posts.ts (PATCH /posts/:id, DELETE /posts/:id)
- apps/backend/tests/posts.test.ts (10 new tests: edit success, 403, 404, 400
  empty content, 401; delete success, 409 has-replies, 403, 404, 401)
- apps/frontend/src/api/posts.ts (updatePost, deletePost)
- apps/frontend/src/pages/FeedPage.tsx (PostCard refactored with edit/delete)
- apps/frontend/src/pages/PostDetailPage.tsx (edit/delete on post section at top)
- .ai/issues/done/07-post-edit-delete.md (moved to done)

Blockers/notes:
- All 130 tests pass (10 new); tsc --noEmit clean on backend and frontend
- Issue 07 has no downstream blockers; Issues 06, 10, 13, 14, 15 remain

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
