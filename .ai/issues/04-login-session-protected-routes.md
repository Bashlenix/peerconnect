# Issue 04 — Login, Session & Protected Routes

**Type:** AFK
**Label:** needs-triage

## What to build

Login flow end-to-end: user submits credentials, backend validates and issues a JWT stored in an `httpOnly` cookie, and the frontend gates all authenticated pages behind a protected route wrapper. Include logout. The Zustand auth store holds the current user object for use across the frontend.

## Acceptance criteria

- [ ] `POST /auth/login` validates email + password, returns a JWT in an `httpOnly` cookie on success
- [ ] `POST /auth/login` returns 401 for wrong credentials and 403 for unverified accounts
- [ ] `POST /auth/logout` clears the auth cookie
- [ ] `GET /auth/me` returns the current user object (used on page load to rehydrate auth state)
- [ ] Zustand auth store initialises by calling `/auth/me` on app load; stores `{ user, isAuthenticated }`
- [ ] React Router protected route wrapper redirects unauthenticated users to `/login`
- [ ] Frontend login page submits credentials and redirects to the feed on success
- [ ] Frontend shows a clear error for invalid credentials

## Blocked by

- Issue 03 — Student Registration & Email Verification
