# Issue #38 — AI daily usage cap: frontend counter + upgrade CTA

**Type:** AFK  
**GitHub:** https://github.com/Bashlenix/peerconnect/issues/38

## What to build

Surface the daily AI usage cap in the UI. Free users should see how many queries they have left today and hit a clear upgrade prompt — not a generic error — when the cap is reached. Covers both the `/ask` standalone page and the inline pre-post suggestion box on the feed.

## Frontend

- `apps/frontend/src/api/ai.ts` — add `getAiUsage()` calling `GET /ai/usage`
- `apps/frontend/src/pages/AskPage.tsx`:
  - Fetch usage on mount; show **"X of 10 AI queries used today"** counter for free users
  - Update counter after each successful query
  - On daily-limit 429: show **"You've reached your 10 free AI queries for today. Upgrade to Premium for unlimited access."** instead of a generic error
- `apps/frontend/src/pages/FeedPage.tsx` `CreatePostForm`:
  - Distinguish daily-limit 429 (by message string) from other errors
  - Show upgrade CTA in the suggestion area instead of silently swallowing
- Premium users see no counter and no cap UI on either surface

## Blocked by

- #37 — AI daily usage cap: schema + backend enforcement
