# 62 — Fix devcontainer port forwarding and automate git hooks activation

**Type:** Chore
**Labels:** needs-triage, done
**GitHub:** https://github.com/Bashlenix/peerconnect/issues/68

## What to build

Two small, unrelated one-line fixes to `.devcontainer/devcontainer.json`
discovered while scoping fully-automatic Codespace startup:

- `forwardPorts` is currently `[3000, 3001, 5432]`. Port 3000 is unused
  (backend is 3001, frontend is Vite's default 5173 per
  `apps/frontend/vite.config.ts`), and 5173 — the actual frontend port — is
  missing entirely. Fix to `[3001, 5173, 5432]`.
- Git hook activation (`git config core.hooksPath .githooks`) is currently a
  manual README step, needed for the pre-commit guard against the Prisma
  `search_vector` bug. Add it to `postCreateCommand` so a fresh Codespace has
  it active with zero manual steps.

## Acceptance criteria

- [x] `devcontainer.json`'s `forwardPorts` is `[3001, 5173, 5432]`.
- [x] `postCreateCommand` includes `git config core.hooksPath .githooks`.
- [x] Running the updated `postCreateCommand` sequence and then
      `git config --get core.hooksPath` returns `.githooks`.

## Blocked by

None - can start immediately

## Completion notes

Both fixes applied to `.devcontainer/devcontainer.json`. Verified:

- JSON parses cleanly (`node -e "require('./.devcontainer/devcontainer.json')"`).
- Ran `git config core.hooksPath .githooks` directly and confirmed
  `git config --get core.hooksPath` returns `.githooks` afterward.

Side finding worth flagging: this local checkout's `core.hooksPath` was
actually unset before this (`git config --get core.hooksPath` returned
`.git/hooks`, the default) — meaning the pre-commit `search_vector` guard
hadn't been active locally at all until this change was verified. Running
the verification step itself fixed that for this checkout too, which is
the correct/desired outcome, not a side effect to revert.

No automated test seam here — this is a devcontainer config file with no
runtime code path to unit test; verification was direct command execution
as described above. `npm run typecheck`/`build`/`test` are all unaffected
by this change (no application code touched) but were not re-run since
nothing in their scope changed.
