# 63 — Auto-generate apps/backend/.env on Codespace setup

**Type:** Chore
**Labels:** needs-triage
**GitHub:** https://github.com/Bashlenix/peerconnect/issues/69

## What to build

Getting PeerConnect running in a Codespace currently requires manually
copying `apps/backend/.env.example` to `.env`. Automate this so a fresh
Codespace has a working `.env` with zero manual steps, without silently
making the AI Ask Bot's failure mode worse.

- New `.devcontainer/setup-env.sh` (mirrors `.devcontainer/db-up.sh`'s
  existing style: `#!/usr/bin/env bash`, `set -euo pipefail`,
  `cd "$(dirname "$0")/.."` so it's safe regardless of caller CWD):
  - If `apps/backend/.env` already exists, exit 0 immediately — idempotent,
    never clobbers a hand-edited `.env` across a container rebuild.
  - Otherwise `cp apps/backend/.env.example apps/backend/.env` (so any
    future var added to `.env.example` flows through automatically), then
    fix exactly 3 known lines with `sed -i`:
    - Replace the `JWT_SECRET=...` line with a freshly generated
      `openssl rand -hex 32` value — a real per-Codespace secret instead of
      relying on the hardcoded fallback in `apps/backend/src/app.ts:65`.
    - Comment out the `SMTP_PASS=...` line (prefix `# `, with a short
      comment: set a Codespaces secret to enable real email sending).
    - Comment out the `OPENAI_API_KEY=...` line (same treatment: set a
      Codespaces secret to enable the AI Ask Bot).
  - Print a short summary of what was generated.
- `.devcontainer/devcontainer.json`: wire the script into
  `postCreateCommand`, ahead of `db-up.sh`.

Why comment out `SMTP_PASS`/`OPENAI_API_KEY` instead of copying them
verbatim: `apps/backend/src/modules/ai-answer.ts:9`'s
`if (!apiKey) throw ...` guard only catches a fully-unset var. A literal
placeholder string (e.g. `<openai-api-key>`) is non-empty, so it passes
that guard and the code attempts a real OpenAI API call with garbage
credentials — a messier failure than today's clean "not configured" error.
This is fully compatible with anyone setting a real Codespaces secret for
either var later: dotenv never overrides an already-set env var, so a real
injected secret always wins regardless of what's (or isn't) in the file.

## Acceptance criteria

- [ ] Running `setup-env.sh` against a repo with no `apps/backend/.env`
      creates one with a real random `JWT_SECRET`, working
      `DATABASE_URL`/`FRONTEND_URL` values, and `SMTP_PASS`/`OPENAI_API_KEY`
      commented out.
- [ ] Running it a second time is a no-op (existing `.env` untouched).
- [ ] The AI Ask Bot endpoint, hit without a real `OPENAI_API_KEY`, still
      returns today's clean "not configured" error rather than a raw
      OpenAI auth failure.
- [ ] `postCreateCommand` calls `setup-env.sh` before `db-up.sh`.

## Blocked by

None - can start immediately
