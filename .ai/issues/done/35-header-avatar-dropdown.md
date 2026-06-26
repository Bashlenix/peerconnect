# Issue #35 — Header: replace email link + logout button with avatar dropdown

**Type:** AFK  
**GitHub:** https://github.com/Bashlenix/peerconnect/issues/35

## What to build

Replace the current header's raw email link and standalone logout button with a compact **avatar circle** (user's initials) that opens a dropdown menu with three items: **Profile**, **Settings**, and **Sign out**.

This applies to all pages that render the shared header (FeedPage, PostDetailPage).

## Key files
- `apps/frontend/src/pages/FeedPage.tsx` — header lives here (lines ~510-530 area)
- `apps/frontend/src/pages/PostDetailPage.tsx` — may also have header, check and update
- `apps/frontend/src/store/auth.ts` — Zustand auth store for user name + logout action
- `apps/frontend/src/components/ui/` — check for existing dropdown/popover components (shadcn)

## How to build the avatar
- Initials: first letter of firstName + first letter of lastName (e.g. "MB" for Muhammad Bashi)
- Fallback: first letter of email if name not set
- Circle: Tailwind `rounded-full`, solid background color, white text

## How to build the dropdown
- Use shadcn/ui `DropdownMenu` if available in `components/ui/`, otherwise build with a `relative`/`absolute` Tailwind pattern
- Items: Profile → `/users/:currentUserId`, Settings → `/settings`, Sign out → calls logout + redirects to `/login`
- Closes on outside click

## Acceptance criteria

- [ ] Header shows an avatar circle with user initials instead of the email link and logout button
- [ ] Clicking the avatar opens a dropdown with: Profile, Settings, Sign out
- [ ] Profile → navigates to `/users/:currentUserId`
- [ ] Settings → navigates to `/settings`
- [ ] Sign out → calls logout and redirects to `/login`
- [ ] Dropdown closes when clicking outside
- [ ] Avatar + dropdown present on all pages that use the shared header

## Tech constraints
- Frontend: React + TypeScript
- UI: Tailwind CSS + shadcn/ui only — no new libraries
- Client state: Zustand ONLY

## Blocked by

- #32 (`/settings` route) ✅ done
- #34 (`/profile` redirect) — must be merged before this so Profile link works correctly
