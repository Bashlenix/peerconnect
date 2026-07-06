# 61 — Add general API rate limiting (@fastify/rate-limit)

**Type:** Chore
**Labels:** needs-triage
**GitHub:** https://github.com/Bashlenix/peerconnect/issues/67

## What to build

Only the AI endpoint has any request-quota protection today (`ai-usage.ts`'s
per-user burst/daily limits). Every other route, including `/auth/login` and
`/auth/register`, has no rate limiting at all — nothing stands between a
client and repeated brute-force login attempts or signup spam.

- `apps/backend/package.json`: add `@fastify/rate-limit` as a dependency.
- `packages/shared/src/index.ts`: widen `ServiceErrorCode` to
  `"service_unavailable" | "rate_limited"` (generalize the comment above it,
  which currently only describes the 503 case).
- `apps/backend/src/app.ts`: `buildApp()` gains an optional
  `{ enableRateLimit?: boolean }` param, defaulting to
  `process.env["NODE_ENV"] !== "test"` — keeps all existing tests unaffected
  while letting one dedicated test opt back in. When enabled, registers
  `@fastify/rate-limit` globally at `max: 100, timeWindow: "1 minute"`, with a
  custom `errorResponseBuilder` returning the `ServiceErrorResponse` shape
  (`{ code: "rate_limited", message }`) at 429 (the plugin sets `Retry-After`
  automatically).
- `apps/backend/src/routes/auth.ts`:
  `config: { rateLimit: { max: 5, timeWindow: "1 minute" } }` on
  `POST /auth/register` and `POST /auth/login`.
- `apps/backend/src/routes/ai.ts`: `config: { rateLimit: false }` on both AI
  routes, so the global limiter doesn't double up with the existing per-user
  quota logic.
- New `apps/backend/tests/rate-limit.test.ts`, following the
  `health.test.ts` `buildApp()`/`app.inject()` pattern, built with
  `buildApp({ enableRateLimit: true })` to verify the limiter in isolation.

## Acceptance criteria

- [ ] More than 100 requests/minute from the same client to a general route
      returns 429 with `{ code: "rate_limited", ... }` and a `Retry-After`
      header.
- [ ] More than 5 requests/minute to `/auth/login` or `/auth/register`
      returns 429 sooner than the global limit would.
- [ ] `/ai/*` routes are unaffected by the global limiter (still governed
      only by their existing per-user quota).
- [ ] All existing 268 backend tests still pass unmodified (limiter is
      disabled by default under `NODE_ENV=test`).
- [ ] `npm run typecheck` and `npm run build` pass.

## Blocked by

None - can start immediately
