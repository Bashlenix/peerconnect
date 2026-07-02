feat(#44): make badge-engine.ts data-driven via BADGE_RULES

Key decisions:
- BadgeEvent moved from badge-engine.ts to badge-config.ts to break the circular import
  (config needs BadgeEvent to type its rules; engine needs BADGE_RULES — can't import both ways).
  badge-engine.ts re-exports BadgeEvent so existing callers don't need updating.
- REPLY_CREATED path deduplicates count queries by categoryFilter set using a
  Map<filterKey, PostCategory[]|undefined>. Rules sharing the same filter fire one DB query,
  matching the prior parallel-query behavior.
- categoryFilter typed as PostCategory[] (Prisma enum) instead of string[], catching invalid
  category values at compile time and satisfying the Prisma query type.
- UPVOTE_RECEIVED and SOLUTION_MARKED are trivial single-count loops over rulesForEvent.

Files changed:
  apps/backend/src/modules/badge-config.ts
  apps/backend/src/modules/badge-engine.ts

Notes:
- No schema changes, no migration needed.
- 230/230 tests pass.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
