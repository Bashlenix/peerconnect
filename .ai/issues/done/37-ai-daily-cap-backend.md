# Issue #37 — AI daily usage cap: schema + backend enforcement

**Type:** AFK  
**GitHub:** https://github.com/Bashlenix/peerconnect/issues/37

## What to build

Add a daily AI usage cap for free-tier users. Every call to `POST /ai/ask` by a free user must be counted against a per-day quota (10 queries, resetting at midnight UTC). Premium users are exempt. A new `GET /ai/usage` endpoint lets the frontend read the current day's usage.

## Schema changes (Prisma migration required)

- New `AiUsageLog` model: `id`, `userId`, `date` (`@db.Date`), `count` (`@default(1)`), `@@unique([userId, date])`, `onDelete: Cascade` to `User`
- Add `aiUsageLogs AiUsageLog[]` relation to `User`

⚠️ After running `npx prisma migrate dev --name add_ai_usage_log`, open the generated SQL and **strip any lines referencing `search_vector`** before applying. See CLAUDE.md.

## Backend

- `POST /ai/ask` — for free users: upsert today's `AiUsageLog` row; return `429` with `"Daily AI limit reached — upgrade to Premium for unlimited access"` when `count > 10`; premium users bypass entirely
- `GET /ai/usage` (authenticated) — returns `{ used: number | null, limit: number | null }`; both null for premium, otherwise `used` = today's count (0 if no row), `limit` = 10
- Existing in-memory burst limiter (10 req / 60 s) is left untouched

## Tests

- Free user under cap succeeds
- Free user at cap returns 429 with daily-limit message
- Premium user is never blocked
- `GET /ai/usage` returns correct counts for both tiers

## Blocked by

None — can start immediately
