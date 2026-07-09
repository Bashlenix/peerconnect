# Claude Code — Project Rules

## Prisma migrations

When creating a new Prisma migration on this schema, **always** inspect the
generated SQL file before applying or committing it.

The `search_vector` column on the `posts` table is an `Unsupported("tsvector")`
generated column. Prisma does not handle this type correctly and routinely
emits spurious SQL in generated migrations, including:

```sql
DROP INDEX "posts_search_vector_idx";
ALTER TABLE "posts" ALTER COLUMN "search_vector" DROP DEFAULT;
```

These lines are **wrong** — strip them from the migration file before running
`prisma migrate deploy` or committing. The only content the migration should
contain is the SQL that reflects the actual schema change you made.

The pre-commit hook in `.githooks/pre-commit` will block a commit if any
staged migration SQL file still references `search_vector`.

## Agent skills

### Issue tracker

GitHub Issues (Bashlenix/peerconnect), via the `gh` CLI. External PRs are not a triage surface. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — one `CONTEXT.md` + `docs/adr/` at the repo root (created lazily when needed). See `docs/agents/domain.md`.
