# Issue #40 — Retry-After headers on AI 429 responses

**Type:** AFK  
**GitHub:** https://github.com/Bashlenix/peerconnect/issues/40

## What to build

Add `Retry-After: <seconds>` to both 429 responses from POST /ai/ask.

- Burst 429: `Math.ceil((entry.resetAt - Date.now()) / 1000)` seconds
- Daily 429: seconds until next midnight UTC

## Tests

- Both 429 variants assert header is present, > 0, ≤ window size

## Blocked by

None — can start immediately
