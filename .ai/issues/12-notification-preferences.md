# Issue 12 — Notification Category Preferences

**Type:** AFK
**Label:** needs-triage

## What to build

Users can subscribe to post categories to control which new-post notifications they receive. Preferences are managed from the profile page. This slice delivers the data layer and UI; actual notification delivery is in Issue 13.

## Acceptance criteria

- [ ] `GET /users/me/notification-preferences` returns the user's current category subscriptions
- [ ] `PUT /users/me/notification-preferences` replaces the user's category subscriptions with the submitted list
- [ ] Frontend profile page includes a "Notification Preferences" section with one toggle per category (Academic, Social, Sport, Daily Life Support)
- [ ] Toggling a category and saving immediately persists the change
- [ ] New users default to no subscriptions (opt-in model)

## Blocked by

- Issue 11 — User Profile (Own & Public View)
