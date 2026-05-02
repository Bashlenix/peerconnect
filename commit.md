feat: Issue 04 — Login, Session & Protected Routes

Key decisions:
- @fastify/jwt (v10) + @fastify/cookie (v11): cookie plugin registered before JWT;
  access_token extracted from httpOnly cookie; `authenticate` decorator added to
  FastifyInstance for protected routes in future issues
- Access token: JWT, 15-minute TTL, signed with JWT_SECRET, stored in httpOnly cookie
- Refresh token: 32-byte crypto.randomBytes hex, 7-day TTL; SHA-256 hashed before DB
  storage (refreshTokenHash unique index); set in separate httpOnly cookie
- POST /auth/login: bcrypt compare → 401 for wrong creds; 403 if not verified; on
  success issues both tokens and returns user object
- GET /auth/me: tries jwtVerify(); on failure falls back to refresh_token cookie —
  verifies hash against DB, issues new access token, returns user; 401 if neither valid
- POST /auth/logout: best-effort DB cleanup (via access or refresh token); always
  clears both cookies with clearCookie
- Prisma migration 20260502200000_add_refresh_token: adds refreshTokenHash (unique)
  and refreshTokenExpiry columns to users; deployed to both dev and test DBs
- Frontend: useInitAuth() hook uses TanStack Query to call /auth/me on app load,
  syncs result to Zustand store via useEffect; isLoading:true initial state prevents
  ProtectedRoute from flashing redirect before auth check completes
- ProtectedRoute: reads isLoading + isAuthenticated from Zustand; shows spinner while
  loading, redirects to /login if not authenticated
- LoginPage: mutation calls login(), on success calls setAuth() + navigates to /feed;
  shows inline error for invalid credentials; redirects to /feed if already authed

Files changed:
- apps/backend/prisma/schema.prisma (refreshTokenHash, refreshTokenExpiry on User)
- apps/backend/prisma/migrations/20260502200000_add_refresh_token/migration.sql (new)
- apps/backend/src/modules/token-service.ts (new — refresh token CRUD + cookie helpers)
- apps/backend/src/app.ts (@fastify/cookie, @fastify/jwt, authenticate decorator)
- apps/backend/src/routes/auth.ts (POST /auth/login, GET /auth/me, POST /auth/logout)
- apps/backend/tests/auth.test.ts (+17 tests: login 4, me 3, logout 1 = 8 new; 46 total)
- apps/backend/.env.example (JWT_SECRET var added)
- apps/backend/package.json (@fastify/jwt, @fastify/cookie)
- apps/frontend/src/api/auth.ts (login, logout, getMe + AuthUser/MeResponse types)
- apps/frontend/src/store/auth.ts (isLoading state, setLoading action, AuthUser type)
- apps/frontend/src/hooks/useInitAuth.ts (new — TanStack Query /auth/me + Zustand sync)
- apps/frontend/src/components/ProtectedRoute.tsx (new)
- apps/frontend/src/pages/LoginPage.tsx (new)
- apps/frontend/src/pages/FeedPage.tsx (new — placeholder with logout)
- apps/frontend/src/App.tsx (useInitAuth, /login + /feed routes, ProtectedRoute)
- .ai/issues/done/04-login-session-protected-routes.md (moved to done)

Blockers/notes:
- All 46 tests pass; tsc --noEmit clean on backend and frontend
- FeedPage is a placeholder ("Feed coming in Issue 05")
- Issue 05 (Post Creation & Chronological Feed) is next

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
