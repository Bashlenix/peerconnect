# Issue 44 — Make badge-engine.ts data-driven using BADGE_RULES config

**Type:** AFK
**Label:** needs-triage
**GitHub:** https://github.com/Bashlenix/peerconnect/issues/44

## What to build

Replace the three hardcoded if/else branches in `badge-engine.ts` with a generic evaluator loop that reads from `BADGE_RULES`. The engine has no knowledge of individual badge names, thresholds, or category filters — all of that lives in the config.

## Acceptance criteria

- [x] `badge-engine.ts` contains no hardcoded badge names, thresholds, or category arrays
- [x] The engine derives all badge evaluation logic from `BADGE_RULES`
- [x] All existing badge-engine tests pass unchanged
- [x] Adding a new badge requires only a new entry in `BADGE_RULES` — no engine edits
- [x] `npm run typecheck` and `npm run test` all pass

## Blocked by

- Issue 43 — Extract badge rules into a BADGE_RULES config array
