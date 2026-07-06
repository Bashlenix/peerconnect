# 61 — Add general API rate limiting (@fastify/rate-limit)

**Type:** Chore
**Labels:** needs-triage, done
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

- [x] More than 100 requests/minute from the same client to a general route
      returns 429 with `{ code: "rate_limited", ... }` and a `Retry-After`
      header.
- [x] More than 5 requests/minute to `/auth/login` or `/auth/register`
      returns 429 sooner than the global limit would.
- [x] `/ai/*` routes are unaffected by the global limiter (still governed
      only by their existing per-user quota).
- [x] All existing 268 backend tests still pass unmodified (limiter is
      disabled by default under `NODE_ENV=test`).
- [x] `npm run typecheck` and `npm run build` pass.

## Blocked by

None - can start immediately

## Completion notes

Built test-first, and hit one real bug along the way worth flagging:
`@fastify/rate-limit` doesn't call `reply.send()` itself on the exceeded
path — it `throw`s whatever `errorResponseBuilder` returns
(`throw params.errorResponseBuilder(req, respCtx)` in its source). That
thrown plain object landed in this app's custom `setErrorHandler`, which
only special-cased the DB-unavailable error and otherwise did a bare
`reply.send(error)` — since the thrown object isn't an `Error` instance and
carries no `statusCode`, that fell through to a bare 500, not 429. First
saw this via `tests/rate-limit.test.ts` failing with "expected undefined
not to be undefined" (never observed a 429 in 105 attempts); root-caused by
temporarily logging `x-ratelimit-remaining` per request, which showed the
counter correctly hitting 0 right as the response flipped to 500.

Fixed with a small new module, `apps/backend/src/modules/rate-limit-errors.ts`
(`isRateLimitError`), mirroring `db-errors.ts`'s existing pattern exactly —
its own test file (`tests/rate-limit-errors.test.ts`, 4 tests) was written
red-first the same way. `app.ts`'s error handler now branches on it
explicitly and responds `reply.status(429).send(error)`.

Also required rebuilding `packages/shared`'s `dist/` after widening
`ServiceErrorCode` — backend's typecheck resolves `@peerconnect/shared`
only via that built output (see #60's completion notes for the same
constraint), so the new `"rate_limited"` code wasn't visible to `tsc`
until `npm run build --workspace=packages/shared` ran.

Verified end-to-end against a real running dev server (not just the test
suite): 6 rapid `POST /auth/login` attempts — first 5 return 401 (wrong
credentials), 6th returns 429 with the exact `{code, message}` body and
`retry-after`/`x-ratelimit-*` headers; `POST /ai/ask` returns 401 either
way, confirming the exclusion.

Full backend suite: 277/277 passing (270 pre-existing + 3 rate-limit + 4
rate-limit-errors), 18/18 files. Typecheck and both workspace builds clean.
