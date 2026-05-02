# Issue 11 — User Profile (Own & Public View)

**Type:** AFK
**Label:** needs-triage

## What to build

Each user has an editable profile (first name, last name, study programme, semester, languages spoken) and a public profile view visible to other users showing their stats and badges. Email is locked and non-editable.

## Acceptance criteria

- [ ] `GET /users/:id` returns public profile data: name, study programme, semester, languages, reply count, accepted solution count, badges
- [ ] `PATCH /users/me` updates name, study programme, semester, and languages; email field is ignored even if included
- [ ] Frontend `/profile` page shows the current user's editable profile form
- [ ] Frontend `/users/:id` page shows another user's public read-only profile
- [ ] Reply count and accepted solution count are derived from the database at query time (not cached counters at this stage)
- [ ] Badges section on the public profile renders earned badges; empty state shown if none earned yet

## Blocked by

- Issue 04 — Login, Session & Protected Routes
