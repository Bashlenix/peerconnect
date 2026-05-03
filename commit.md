feat: Issue 16 — Ad schema, migration, and dev seed

Key decisions:
- Ad model added to schema.prisma with all required fields: id, title,
  body, imageUrl (nullable), linkUrl, advertiserName, isActive, startsAt
  (nullable), endsAt (nullable), createdAt, updatedAt
- Migration 20260503000000_add_ads_table created manually and applied
  directly via psql + prisma migrate resolve --applied, because
  migrate dev conflicts with the modified post_implementation migration
  (shadow DB could not replay the bogus DROP DEFAULT on a GENERATED
  column — fixed that SQL to DROP IF EXISTS on the index only)
- seed-ads.ts inserts 4 sample ads using upserts (safe to re-run):
  · BuchDepot: always-active, with image
  · CampusWohnen: always-active, no image
  · Campus Events Berlin: active May–Aug 2026, with image
  · StudyBuddy: active until 2027, no image
- db:seed-ads script added to package.json

Files changed:
- apps/backend/prisma/schema.prisma  (added Ad model)
- apps/backend/prisma/migrations/20260503000000_add_ads_table/migration.sql  (new)
- apps/backend/prisma/migrations/20260502193708_post_implementation/migration.sql
  (fixed: DROP DEFAULT → DROP IF EXISTS on index; no-op for generated column)
- apps/backend/prisma/seed-ads.ts  (new — 4 sample ads)
- apps/backend/package.json  (added db:seed-ads script)
- .ai/issues/done/16-ad-schema-and-seed.md  (moved to done)

Blockers / notes for next iteration:
- 17 pre-existing test failures (auth.test requiresManualReview test;
  notifications.test registration uses non-university domain; posts.test
  ordering pollution from seed data) — NOT caused by this issue
- Issue 17 (GET /api/ads) can now proceed — Ad model is available in
  Prisma client

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
