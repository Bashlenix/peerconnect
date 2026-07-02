# 51 — Make badge rules executable

**Type:** AFK  
**Labels:** enhancement, done  
**Blocked by:** None

## What to build

Move `BADGE_RULES` from `@peerconnect/shared` to `apps/backend/src/modules/badge-rules.ts`. Give each rule a `check(tx: Prisma.TransactionClient, userId: string): Promise<boolean>` closure that encapsulates the DB query for that rule. The badge engine becomes a generic `Promise.all` loop with no per-event branching. The shared package retains only `BadgeEvent` and `BADGE_NAMES` (pure string constants with no Prisma dependency).

## Acceptance criteria

- [ ] `badge-rules.ts` defines `BadgeRule` with `check` and exports `BADGE_RULES`
- [ ] `badge-engine.ts` body is a generic loop: filter by event → `Promise.all(rules.map(r => r.check(tx, userId)))` → award eligible
- [ ] `@peerconnect/shared` no longer exports `BadgeRule` or `BADGE_RULES`
- [ ] `seed-data.ts` imports `BADGE_RULES` from `badge-rules.ts`
- [ ] TypeScript compiles clean across all packages
