# 64 — Auto-start dev servers on Codespace start

**Type:** Chore
**Labels:** needs-triage
**GitHub:** https://github.com/Bashlenix/peerconnect/issues/70

## What to build

Even with the DB and `.env` automated, a Codespace user still has to
manually run `npm run dev`. Make the app actually reachable the moment the
Codespace finishes creating/resuming.

- `.devcontainer/devcontainer.json`'s `postStartCommand`: after
  `setup-env.sh` and the existing blocking `db-up.sh` DB-readiness wait,
  background-start the dev servers, log-redirected for later inspection:
  `bash .devcontainer/setup-env.sh && bash .devcontainer/db-up.sh && (nohup npm run dev > /tmp/peerconnect-dev.log 2>&1 &)`
- Bash grouping matters here: the trailing `&` must only background the
  `npm run dev` part via the explicit subshell `(... &)`, not the whole
  `&&` chain — otherwise `db-up.sh`'s blocking Postgres-readiness wait
  would itself run in the background, and the devcontainer lifecycle would
  report "ready" before Postgres actually is.

## Acceptance criteria

- [ ] After `postStartCommand` runs, `curl localhost:3001/health` and the
      frontend on 5173 both respond without any manual step.
- [ ] `/tmp/peerconnect-dev.log` contains the backend+frontend startup
      output.
- [ ] A quick isolated check (e.g. `true && true && (sleep 1 &); echo done`)
      confirms the chain returns immediately while the backgrounded part
      still runs — proving the DB wait isn't backgrounded too.

## Blocked by

- #63 (needs a working `.env` for the backend to boot cleanly)
