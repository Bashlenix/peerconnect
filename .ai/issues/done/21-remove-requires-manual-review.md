# Issue 21 — Remove Unused `requiresManualReview` Column

**Type:** Chore
**Label:** done

## Background

The `requiresManualReview` field existed on the `User` model as a leftover from an earlier PRD design where users registering with an unrecognised email domain would be flagged for manual admin approval. That workflow was never implemented. The actual code in `domain-validator.ts` returns `{ valid: false }` for any unrecognised domain, and `auth.ts` hard-blocks registration with a 422 — the field was always `false` and was never read for any business logic.

The dead field was discovered during README authoring when the Known Limitations section was incorrectly written to describe the non-existent manual review workflow.

## What was done

- Removed `requiresManualReview Boolean @default(false)` from `schema.prisma`
- Created and applied migration `20260505085331_remove_requires_manual_review` to drop the DB column
  - Note: Prisma auto-generated spurious SQL for the `search_vector` generated column (`DROP INDEX` + `ALTER COLUMN ... DROP DEFAULT`). Those lines were stripped manually before applying — this is a known Prisma limitation with `Unsupported("tsvector")` columns.
- Removed the field from the `POST /auth/register` response schema and returned body in `auth.ts`
- Removed assertions from `auth.test.ts` (response body + DB read) and `schema.test.ts`
- Removed `requiresManualReview: boolean` from the `RegisterResponse` interface in `frontend/src/api/auth.ts`
- Regenerated Prisma client
- Updated the README Known Limitations section to accurately describe the real behaviour (hard block on unrecognised domains)

## Acceptance criteria

- [x] `requiresManualReview` column does not exist in the `users` table
- [x] No references to `requiresManualReview` remain outside of generated files and migration history
- [x] `npm run typecheck` passes with 0 errors
- [x] `npm run test` passes — 210/210 tests

## Commits

- `663ecf2` — refactor: remove unused requiresManualReview field from User model
- `a34dfbc` — docs: fix incorrect known limitation about unrecognised email domains

## Blocked by

None.
