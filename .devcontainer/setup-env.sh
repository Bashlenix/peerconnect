#!/usr/bin/env bash
# Generates apps/backend/.env from .env.example on first Codespace setup, so
# the app boots with zero manual steps. Safe to run on both Codespace create
# and every resume (mirrors db-up.sh's own idempotent style): skips entirely
# if .env already exists, so a container rebuild never clobbers a .env
# you've since hand-edited (e.g. after adding a real OPENAI_API_KEY).
set -euo pipefail

# Run from the repo root regardless of the caller's working directory.
cd "$(dirname "$0")/.."

ENV_FILE=apps/backend/.env
ENV_EXAMPLE=apps/backend/.env.example

if [ -f "$ENV_FILE" ]; then
  echo "$ENV_FILE already exists — leaving it untouched."
  exit 0
fi

cp "$ENV_EXAMPLE" "$ENV_FILE"

# Real per-Codespace secret instead of relying on the hardcoded fallback in
# apps/backend/src/app.ts.
JWT_SECRET_VALUE=$(openssl rand -hex 32)
sed -i "s|^JWT_SECRET=.*|JWT_SECRET=\"$JWT_SECRET_VALUE\"|" "$ENV_FILE"

# SMTP_PASS and OPENAI_API_KEY are placeholder-only in .env.example (e.g.
# "<openai-api-key>"). A literal placeholder string is non-empty, so it would
# pass the app's `if (!apiKey)` guards and attempt a real API call with
# garbage credentials instead of failing cleanly. Comment both out so the
# app's existing "not configured" error path stays intact. Setting a
# Codespaces secret with the same name still works transparently — dotenv
# never overrides an already-set env var, so a real injected secret always
# wins regardless of what's (or isn't) in this file.
sed -i \
  -e 's|^SMTP_PASS=|# SMTP_PASS=|' \
  -e 's|^OPENAI_API_KEY=|# OPENAI_API_KEY=|' \
  "$ENV_FILE"

echo "Generated $ENV_FILE from $ENV_EXAMPLE (JWT_SECRET randomized; SMTP_PASS and OPENAI_API_KEY left commented out — set as Codespaces secrets to enable real email sending / the AI Ask Bot)."
