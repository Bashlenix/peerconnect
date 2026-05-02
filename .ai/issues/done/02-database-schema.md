# Issue 02 — Database Schema & Prisma Setup

**Type:** AFK
**Label:** needs-triage

## What to build

Define the complete Prisma schema for all domain entities and run the initial migration. Seed the `universities` table with an initial list of German university domains. This schema is the foundation every other slice reads from — get it right before building features on top.

Tables to define: `users`, `universities`, `posts`, `replies`, `upvotes`, `notifications`, `notification_preferences`, `badges`, `user_badges`, `subscriptions`.

Notable schema decisions to encode:
- `posts.search_vector` as a generated `tsvector` column with a GIN index
- `posts.edited_at` nullable timestamp
- `replies.is_solution` boolean
- `users.requires_manual_review` boolean
- `subscriptions(user_id, status, start_date, end_date)`

## Acceptance criteria

- [ ] Prisma schema defines all tables listed above with correct relations and field types
- [ ] `prisma migrate dev` runs without errors against a local PostgreSQL instance
- [ ] `prisma db seed` populates the `universities` table with at least 5 real German university domains (e.g. `uni-dortmund.de`, `tu-berlin.de`)
- [ ] `badges` table is seeded with all 7 badge definitions (First Reply, Getting Started, Active Helper, Community Builder, Helpful Contributor, Trusted Helper, Solution Provider)
- [ ] `posts.search_vector` GIN index is present in the migration SQL
- [ ] All foreign key relations have appropriate cascade/restrict rules

## Blocked by

- Issue 01 — Monorepo & Project Scaffold
