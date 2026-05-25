# Issue #32 — Settings page: rename ProfilePage → SettingsPage and add /settings route

**Type:** AFK  
**GitHub:** https://github.com/Bashlenix/peerconnect/issues/32

## What to build

The current `/profile` route renders an edit form (name, study programme, languages, notification preferences, subscription). Move this to `/settings` so that `/profile` can become a proper profile view in a later slice.

Rename `apps/frontend/src/pages/ProfilePage.tsx` → `SettingsPage.tsx`, register it at `/settings` in `App.tsx`, and update any internal links that currently point to `/profile` with the intent of editing the user's info.

## Acceptance criteria

- [x] `/settings` renders the existing edit form (all fields, save buttons, notification prefs, subscription info) unchanged
- [x] `SettingsPage.tsx` replaces `ProfilePage.tsx` — old filename removed
- [x] `App.tsx` registers the `/settings` route and removes the old `/profile` edit-form route (a redirect will be added in a later slice)
- [x] No functionality is changed — only the route path and filename differ

## Blocked by

None — can start immediately
