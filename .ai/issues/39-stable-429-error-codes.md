# Issue #39 — Stable 429 error codes on AI rate-limit responses

**Type:** AFK  
**GitHub:** https://github.com/Bashlenix/peerconnect/issues/39

## What to build

Add a stable `code` field to both 429 responses from POST /ai/ask so the frontend branches on `code` instead of string-matching English prose.

## Backend

- Both 429 responses include `code: "rate_limit_burst"` or `code: "rate_limit_daily"`
- Backend 429 response schema updated to include `code` alongside `message`

## Shared

- `AiErrorCode` type (`"rate_limit_burst" | "rate_limit_daily"`) exported from `packages/shared`

## Frontend

- `FeedPage.tsx` and `AskPage.tsx`: replace `message.includes("Daily AI limit reached")` with `err.code === "rate_limit_daily"`

## Tests

- Both 429 variants assert `code` field is present and correct

## Blocked by

None — can start immediately
