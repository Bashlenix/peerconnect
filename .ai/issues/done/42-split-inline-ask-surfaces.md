# Issue #42 — Split inline/ask AI surfaces (Option A: FTS-only inline for free)

**Type:** AFK  
**GitHub:** https://github.com/Bashlenix/peerconnect/issues/42

## What to build

Free users composing a post fire 4-6 debounced AI calls per draft, consuming ~50% of their daily quota before submitting. Split surfaces: inline pre-post helper is FTS-only (no LLM, no quota) for free users; /ask page uses full RAG for everyone. Premium gets full RAG on both.

## Shared

- `AiAskRequest` gets optional `source: "inline" | "ask"` field (defaults to `"ask"`)

## Backend

- `POST /ai/ask`: free + `source: "inline"` → run `retrieveRelevantPosts` only, skip `generateAiAnswer`, return `{ answer: null, sources, confidence }`, quota NOT consumed
- Free + `source: "ask"` → existing full RAG + quota behaviour
- Premium → full RAG on both, no quota check

## Frontend

- `askAI()` in `apps/frontend/src/api/ai.ts` accepts `source` param
- `FeedPage.tsx` passes `source: "inline"`; `AskPage.tsx` passes `source: "ask"`
- Inline suggestion panel handles `answer: null` correctly (shows sources only, no synthesised text)

## Tests

All four combos: free+inline, free+ask, premium+inline, premium+ask

## Blocked by

- #39 (stable error codes)
