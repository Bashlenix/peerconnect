# 55 — Surface a meaningful error when the database is unreachable

**Type:** AFK
**Labels:** enhancement
**GitHub:** https://github.com/Bashlenix/peerconnect/issues/61
**Blocked by:** None

## What to build

When the database is unreachable (e.g. the `peerconnect-db` container is still
starting after a Codespace resume), Prisma throws a raw connection error that
bubbles up as an unhelpful `Invalid prisma.user.findUnique() invocation` stack
trace on login/signup. Turn that into a clear, actionable response end-to-end.

- **Backend:** detect Prisma connection/initialization errors (can't reach the
  database server) at the request boundary and map them to a `503` response
  with a stable machine-readable `code` (e.g. `service_unavailable`) and a human
  message, instead of leaking the Prisma error. Apply consistently to the
  auth routes (login, register) at minimum.
- **Shared:** export the new error `code` type from `packages/shared` so the
  frontend branches on `code`, not on English prose (mirrors the existing
  `AiErrorCode` pattern from issue 39).
- **Frontend:** on login and signup, when the `service_unavailable` code comes
  back, show a friendly message such as "Service is starting up — please try
  again in a moment" rather than a generic failure.
- **Tests:** cover the mapping — when the DB is unreachable, the endpoint
  returns `503` with the expected `code`.

## Acceptance criteria

- [ ] Prisma connection errors on login/register return HTTP `503` with
      `{ code: "service_unavailable", message: ... }` (no stack trace leaked)
- [ ] The error `code` type is exported from `packages/shared`
- [ ] Login and signup pages render a friendly "service starting" message when
      that code is returned
- [ ] Backend test asserts the `503` + `code` when the DB connection fails
- [ ] `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` pass

## Blocked by

None — can start immediately.
