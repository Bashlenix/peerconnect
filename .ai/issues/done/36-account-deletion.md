# Issue #36 — Account deletion with post anonymisation

**Type:** AFK  
**GitHub:** https://github.com/Bashlenix/peerconnect/issues/36

## What to build

Add a "Delete account" action to the Settings page. When a user deletes their account:
1. Their User record is hard-deleted
2. Their posts and replies are **kept** but anonymised — `authorId` set to `null`, shown as "Deleted User" in the UI
3. Their personal data (upvotes, notifications, notification preferences, subscription, badges) is cascade-deleted
4. The session is terminated and the user is redirected to `/login`

## Schema changes (Prisma migration required)
- Make `Post.authorId` nullable (`String?`)
- Make `Reply.authorId` nullable (`String?`)
- Change `Post.author` relation: `onDelete: SetNull`
- Change `Reply.author` relation: `onDelete: SetNull`
- All other User relations keep `onDelete: Cascade`

⚠️ IMPORTANT — after running `npx prisma migrate dev --name account-deletion`, open the generated SQL file and **strip any lines referencing `search_vector`** before applying. See CLAUDE.md for details.

## Backend
- New endpoint: `DELETE /users/me` (authenticated, documented with `@fastify/swagger`)
- Prisma `deleteUser` call is sufficient — cascade + SetNull handled by DB

## Frontend
- `apps/frontend/src/pages/SettingsPage.tsx` — "Delete account" button (destructive/red), confirmation dialog before proceeding
- On success: clear auth store (`apps/frontend/src/store/auth.ts`) + redirect to `/login`
- `apps/frontend/src/pages/FeedPage.tsx` post cards — handle `author === null`, show "Deleted User"
- `apps/frontend/src/pages/UserProfilePage.tsx` — handle `author === null`, "Deleted User" display, no broken profile link
- `apps/frontend/src/pages/PostDetailPage.tsx` — same null-author guard on reply cards

## Key files
- `apps/backend/prisma/schema.prisma`
- `apps/backend/src/routes/users.ts`
- `apps/frontend/src/pages/SettingsPage.tsx`
- `apps/frontend/src/pages/FeedPage.tsx`
- `apps/frontend/src/pages/UserProfilePage.tsx`
- `apps/frontend/src/pages/PostDetailPage.tsx`
- `apps/frontend/src/store/auth.ts`
- `apps/frontend/src/api/users.ts`

## Acceptance criteria

- [ ] `Post.authorId` and `Reply.authorId` are nullable in schema
- [ ] Migration SQL has no `search_vector` lines
- [ ] `DELETE /users/me` returns 204, is authenticated, swagger-documented
- [ ] Deleting a user leaves posts/replies with `authorId = null`
- [ ] Settings page has a "Delete account" button behind a confirmation dialog
- [ ] On deletion: auth store cleared, redirected to `/login`
- [ ] Feed post cards show "Deleted User" when `author === null`
- [ ] Profile and post detail pages handle null author gracefully
- [ ] Clicking "Deleted User" does NOT navigate to a broken profile

## Blocked by

None — can start immediately
