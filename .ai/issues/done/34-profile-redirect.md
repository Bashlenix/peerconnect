# Issue #34 — Routing: redirect /profile to /users/:me and show Settings link on own profile

**Type:** AFK  
**GitHub:** https://github.com/Bashlenix/peerconnect/issues/34

## What to build

Wire up `/profile` as a convenience redirect to the current user's own profile (`/users/:currentUserId`), and show a contextual "Settings" link on `UserProfilePage` when the viewer is looking at their own profile.

After this slice, clicking "Profile" anywhere in the app takes users to a real profile page — not an edit form.

## Key files
- `apps/frontend/src/App.tsx` — add `/profile` route that redirects to `/users/:currentUserId`
- `apps/frontend/src/pages/UserProfilePage.tsx` — show "Settings" button/link when `currentUser.id === profileUserId`
- `apps/frontend/src/store/auth.ts` — Zustand auth store, use to get current user ID

## Acceptance criteria

- [ ] Navigating to `/profile` redirects to `/users/:currentUserId` (using the ID from the auth store)
- [ ] Redirect is instant and does not flash the old edit form
- [ ] `UserProfilePage` shows a "Settings" link/button when `currentUser.id === profileUserId`
- [ ] The Settings link navigates to `/settings`
- [ ] The Settings link is not visible when viewing another user's profile

## Tech constraints
- Frontend: React + TypeScript + React Router v6
- Use `<Navigate>` from react-router-dom for the redirect
- Get current user from Zustand auth store
- UI: Tailwind CSS + shadcn/ui only

## Blocked by

- #32 (`/settings` route) ✅ done
- #33 (profile page tabs) ✅ done
