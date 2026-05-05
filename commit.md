refactor: remove unused requiresManualReview field from User model

Key decisions:
- requiresManualReview was a leftover from an earlier PRD design where
  unrecognised email domains would be queued for admin approval. The
  actual implementation hard-blocks unrecognised domains with a 422 at
  registration; the field was always false and never read for any logic.
- Removed the field from schema.prisma and created migration
  20260505085331_remove_requires_manual_review to drop the DB column.
- The Prisma-generated migration SQL incorrectly included
  ALTER COLUMN search_vector DROP DEFAULT (a known Prisma limitation
  with Unsupported tsvector generated columns). That line was stripped
  manually from the migration file before applying.
- Prisma client regenerated after schema change.
- npm run typecheck: 0 errors across all workspaces.
- npm run test: 210/210 tests passed across 12 test files.

Files changed:
- prisma/schema.prisma                               (field removed)
- prisma/migrations/20260505085331_.../migration.sql (new — drops column)
- src/routes/auth.ts                                 (removed from response schema + body)
- tests/auth.test.ts                                 (removed two assertions)
- tests/schema.test.ts                               (removed one assertion)
- apps/frontend/src/api/auth.ts                      (removed from RegisterResponse type)
- src/generated/prisma/                              (regenerated client)
- commit.md                                          (updated)

Blockers / notes for next iteration:
- The Prisma tsvector/Unsupported type causes spurious SQL in generated
  migrations (DROP INDEX + ALTER COLUMN on search_vector). Always review
  and strip those lines manually when creating new migrations.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
