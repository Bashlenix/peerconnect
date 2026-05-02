feat: Issue 12 — Notification Category Preferences

Key decisions:
- NotificationPreference model already existed in schema (no migration needed);
  unique([userId, category]) constraint handles deduplication at the DB level
- GET /users/me/notification-preferences: protected; returns { categories:
  PostCategory[] } sorted alphabetically; empty array for users with no prefs
- PUT /users/me/notification-preferences: protected; accepts { categories:
  PostCategory[] }; validates each value against VALID_CATEGORIES constant;
  uses $transaction([deleteMany, createMany]) for atomic full-replace semantics;
  deduplicates in application layer before insert to avoid unique-constraint errors
- Frontend api/users.ts: getNotificationPreferences(), updateNotificationPreferences()
  with PostCategory type and ALL_CATEGORIES constant shared with UI layer
- ProfilePage extended with "Notification Preferences" section: one checkbox per
  category (Academic, Social, Sport, Daily Life Support); separate Save button
  with its own isPending/saved state to avoid coupling with profile form; toggleCategory
  updates local state immediately, mutation persists on save; invalidates
  ['notificationPreferences'] query key on success

Files changed:
- apps/backend/src/routes/users.ts (GET + PUT /users/me/notification-preferences)
- apps/backend/tests/users.test.ts (9 new tests: GET empty, GET with prefs, PUT set,
  PUT replace, PUT clear, PUT dedup, PUT invalid category, GET 401, PUT 401)
- apps/frontend/src/api/users.ts (getNotificationPreferences, updateNotificationPreferences,
  PostCategory type, ALL_CATEGORIES, NotificationPreferences interface)
- apps/frontend/src/pages/ProfilePage.tsx (notification preferences section with
  category checkboxes and save button)
- .ai/issues/done/12-notification-preferences.md (moved to done)

Blockers/notes:
- All 120 tests pass (9 new); tsc --noEmit clean on backend and frontend
- Issue 12 unblocks Issue 13 (Real-Time SSE Notifications); Issue 13 also needs
  Issue 09 which is already done
- PUT uses opt-in model (empty array = no subscriptions) as specified in acceptance criteria

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
