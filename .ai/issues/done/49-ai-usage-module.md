# 49 — Extract AI usage module

**Type:** AFK  
**Labels:** enhancement, done  
**Blocked by:** None

## What to build

Extract quota and rate-limit logic from the AI route into a dedicated `ai-usage.ts` module. The module owns the burst rate-limit map (private), the daily quota check, and the subscription check. It returns a `UsageCheckResult` discriminated union so the route handler is a clean switch with no inline quota math.

## Acceptance criteria

- [ ] `ai-usage.ts` exports `checkAndConsume(userId, source)` returning `UsageCheckResult = { allowed: true; ftsOnly: boolean } | { denied: "burst" | "daily"; retryAfter: number }`
- [ ] `ai-usage.ts` exports `getUsage(userId)` returning `{ used: number | null; limit: number | null }`
- [ ] `rateLimitMap` is not exported — private to the module
- [ ] `source: "inline"` for free users returns `{ allowed: true, ftsOnly: true }` without consuming daily quota
- [ ] Route handler contains no inline quota logic
