# Issue #41 — Increment AI daily usage after success, not before

**Type:** AFK  
**GitHub:** https://github.com/Bashlenix/peerconnect/issues/41

## What to build

Currently the daily usage count is incremented before `generateAiAnswer` is called. If OpenAI fails, the user burns a quota slot for nothing. Split into a read-only check + write-after-success pattern.

## Backend (`apps/backend/src/routes/ai.ts`)

- Split `checkAndIncrementDailyUsage` into `checkDailyLimit` (read-only) and `incrementDailyUsage` (write)
- Call `checkDailyLimit` before the OpenAI call; call `incrementDailyUsage` only after `generateAiAnswer` resolves successfully
- On exception from `generateAiAnswer`, count is not incremented

## Tests

- OpenAI failure does not consume quota
- Success increments exactly once

## Blocked by

None — can start immediately
