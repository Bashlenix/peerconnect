feat: Issue 11 — User Profile (Own & Public View)

Key decisions:
- GET /users/:id: public endpoint (no auth required); returns id, firstName,
  lastName, studyProgramme, semester, languages, replyCount, solutionCount, badges;
  email and passwordHash are never exposed; replyCount from _count.replies,
  solutionCount from filtered replies where isSolution=true, badges from
  userBadges with nested badge select; 404 for unknown id
- PATCH /users/me: protected; accepts firstName, lastName, studyProgramme,
  semester, languages; email field silently ignored even if sent in body;
  partial update — only provided fields are written (spread-conditional pattern
  used in existing routes); returns updated own-profile object including email
- usersRoute registered in app.ts following the existing route-per-file pattern
- Frontend API (api/users.ts): getPublicProfile(userId), updateProfile(input)
  with typed PublicProfile and OwnProfile interfaces
- ProfilePage (/profile): protected; loads profile via getPublicProfile using
  the Zustand user.id; form pre-fills from loaded data via useEffect; partial
  diff sent on submit (only changed fields); shows "Saved!" confirmation briefly;
  badges rendered below form; email shown as read-only
- UserProfilePage (/users/:id): protected; read-only; shows name, study
  programme, semester, languages, reply/solution stat cards, and badge chips
  with description tooltip; "User not found" state for 404; navigate(-1) back
- Both pages use TanStack Query (useQuery/useMutation) for server state

Files changed:
- apps/backend/src/routes/users.ts (new — GET /users/:id, PATCH /users/me)
- apps/backend/src/app.ts (register usersRoute)
- apps/backend/tests/users.test.ts (new — 10 tests: public profile, PATCH /users/me)
- apps/frontend/src/api/users.ts (new — getPublicProfile, updateProfile)
- apps/frontend/src/pages/ProfilePage.tsx (new — editable own profile)
- apps/frontend/src/pages/UserProfilePage.tsx (new — public read-only profile)
- apps/frontend/src/App.tsx (/profile + /users/:id protected routes added)
- .ai/issues/done/11-user-profile.md (moved to done)

Blockers/notes:
- All 111 tests pass (10 new); tsc --noEmit clean on backend and frontend
- Issue 11 unblocks Issue 12 (Notification Category Preferences)
- solutionCount uses a filtered relation query (replies where isSolution=true)
  rather than a separate aggregate call to keep it in one Prisma round-trip

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
