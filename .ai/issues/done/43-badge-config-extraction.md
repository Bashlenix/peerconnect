# Issue 43 — Extract badge rules into a BADGE_RULES config array

**Type:** AFK
**Label:** needs-triage
**GitHub:** https://github.com/Bashlenix/peerconnect/issues/43

## What to build

Create `apps/backend/src/modules/badge-config.ts` as the single source of truth for all badge definitions. Update `seed-data.ts` to derive its `BADGES` array from `BADGE_RULES`, eliminating the name/description duplication between the two files.

This is a pure data change — no badge-engine logic is touched in this slice.

## Acceptance criteria

- [x] `badge-config.ts` exists and exports `BadgeRule` type, `BADGE_NAMES` const, and `BADGE_RULES` array
- [x] All 7 existing badges are represented in `BADGE_RULES` with correct thresholds and descriptions
- [x] `seed-data.ts` derives `BADGES` from `BADGE_RULES` — no duplicate name/description strings
- [x] `badge-engine.ts` is **not modified** in this slice
- [x] `npm run typecheck` and `npm run test` all pass

## Blocked by

None — can start immediately.
