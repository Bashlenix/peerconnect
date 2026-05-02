refactor: simplify seed — shared helper, createMany, derive assertions from constants

Key decisions:
- Extracted `seedReferenceData(prisma)` helper into `seed-data.ts`; both `seed.ts` and `schema.test.ts` now call it instead of duplicating the upsert loops
- Replaced `Promise.all(…upsert)` with `createMany({ skipDuplicates: true })` — reduces 17 individual round-trips to 2 bulk inserts per seed call
- Fixed hardcoded `7` in badge count assertion → `BADGES.length`
- Fixed hardcoded domain/badge name strings in test assertions → derived via loop over `UNIVERSITIES` / `BADGES` constants; no divergence if seed data changes

Files changed:
- apps/backend/prisma/seed-data.ts (added PrismaClient import + seedReferenceData export)
- apps/backend/prisma/seed.ts (replaced upsert loops with seedReferenceData call)
- apps/backend/tests/schema.test.ts (replaced upsert loops with seedReferenceData; fixed magic number and hardcoded strings)

Blockers/notes:
- All 16 tests pass; tsc --noEmit clean
- Issue 03 (Registration & Email Verification) is next

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
