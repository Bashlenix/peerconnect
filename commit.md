chore: enforce Prisma search_vector migration guard via CLAUDE.md and pre-commit hook

Key decisions:
- Created CLAUDE.md at the repo root with an explicit rule telling Claude
  to always strip spurious search_vector SQL from generated Prisma
  migrations before applying or committing. CLAUDE.md is loaded into
  Claude Code's context at the start of every session, making this a
  durable instruction rather than a one-off reminder.
- Created .githooks/pre-commit that scans staged migration SQL files for
  any reference to "search_vector" and blocks the commit with a clear
  error message if found. This catches both AI-generated and
  human-authored migrations.
- Used a committed .githooks/ directory (not .git/hooks/) so the hook
  is version-controlled and shared with the whole team. Each developer
  activates it once with: git config core.hooksPath .githooks
- Added step 2 to the README Getting Started section with the
  git config command and a pointer to CLAUDE.md for context.
  Renumbered subsequent steps 3-5 → 4-6 accordingly.
- npm run typecheck: 0 errors. npm run test: 210/210 passed.

Files changed:
- CLAUDE.md                  (new — project rules for Claude Code)
- .githooks/pre-commit       (new — blocks search_vector in migration SQL)
- README.md                  (step 2 added; steps renumbered)
- commit.md                  (updated)

Blockers / notes for next iteration:
- New team members must run `git config core.hooksPath .githooks` after
  cloning; it cannot be automated without adding a dependency (e.g. husky).
  The README now documents this as step 2 of Getting Started.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
