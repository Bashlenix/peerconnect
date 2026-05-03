# Issue 16 — Ad Schema & Dev Seed

**Type:** AFK
**Label:** needs-triage

## What to build

Add an `Ad` model to the Prisma schema, generate and apply the migration, and create a `seed-ads.ts` dev seed script with 3–4 sample ads so the feature is testable end-to-end without manual DB inserts.

## Acceptance criteria

- [ ] `ads` table exists with fields: `id`, `title`, `body`, `imageUrl` (nullable), `linkUrl`, `advertiserName`, `isActive`, `startsAt` (nullable), `endsAt` (nullable), `createdAt`, `updatedAt`
- [ ] Prisma migration is generated and applied cleanly
- [ ] `prisma/seed-ads.ts` inserts at least 3 sample ads (mix of with/without image, one with future `endsAt`, one always-active) using upserts so it is safe to re-run
- [ ] `db:seed-ads` script added to `package.json`
- [ ] Running `db:seed-ads` against a fresh DB populates the ads table without errors

## Blocked by

None — can start immediately.
