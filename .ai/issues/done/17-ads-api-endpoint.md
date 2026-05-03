# Issue 17 — GET /api/ads Backend Endpoint

**Type:** AFK
**Label:** needs-triage

## What to build

Implement an authenticated `GET /api/ads` endpoint that returns a randomly shuffled list of currently active ads for free users, and an empty array for premium users. "Currently active" means `isActive = true` and the current date falls within `startsAt`/`endsAt` (null bounds are treated as open-ended).

## Acceptance criteria

- [ ] `GET /api/ads` requires authentication; returns 401 if no valid session
- [ ] Returns `{ ads: [] }` when the caller has a `premium` subscription
- [ ] Returns `{ ads: [...] }` with all currently active ads, in random order, for `free` users
- [ ] An ad is considered active when `isActive = true` AND (`startsAt` is null OR `startsAt <= now`) AND (`endsAt` is null OR `endsAt >= now`)
- [ ] Response shape per ad: `id`, `title`, `body`, `imageUrl`, `linkUrl`, `advertiserName`
- [ ] Route is registered under the existing Fastify app and included in the Swagger schema

## Blocked by

- Issue 16 — Ad Schema & Dev Seed
