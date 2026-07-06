# 64 — Auto-start dev servers on Codespace start

**Type:** Chore
**Labels:** needs-triage, done
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

- [x] After `postStartCommand` runs, `curl localhost:3001/health` and the
      frontend on 5173 both respond without any manual step.
- [x] `/tmp/peerconnect-dev.log` contains the backend+frontend startup
      output.
- [x] A quick isolated check (e.g. `true && true && (sleep 1 &); echo done`)
      confirms the chain returns immediately while the backgrounded part
      still runs — proving the DB wait isn't backgrounded too.

## Blocked by

- #63 (needs a working `.env` for the backend to boot cleanly)

## Completion notes

Built exactly as scoped:
`postStartCommand`: `bash .devcontainer/setup-env.sh && bash .devcontainer/db-up.sh && (nohup npm run dev > /tmp/peerconnect-dev.log 2>&1 &)`

Verified the bash-grouping risk directly, not just by inspection — built
both the correct and the buggy version and proved the difference with an
observable marker file rather than just timing (timing alone doesn't
distinguish them; both "return immediately," which is exactly what makes
the bug easy to miss):
- `A && (sleep 2; touch marker) && (sleep 5 &)` — marker exists immediately
  after the chain returns → the blocking step correctly ran synchronously.
- `A && (sleep 2; touch marker) && sleep 5 &` (no parens around the last
  part) — marker does *not* exist when the chain returns → confirms the
  exact bug this issue's design avoids: without the subshell, the whole
  chain backgrounds, including the blocking DB-readiness wait.

Couldn't run the real `db-up.sh` end-to-end here: this local machine uses
a native Postgres install (not the `peerconnect-db` Docker container
`db-up.sh` manages), so running it for real would have started an
unrelated container colliding with the native install's port 5432 — an
avoidable, unwanted side effect. Substituted a `sleep`-based stand-in for
the blocking step in the grouping test above (structurally identical
risk, decoupled from the Docker specifics) and separately verified the
actual `npm run dev` backgrounding for real against this machine's real
environment: ran
`(nohup npm run dev > /tmp/peerconnect-dev.log 2>&1 &)` from the repo
root (confirmed no backend/vite processes running beforehand), confirmed
the command returned in ~0.01s, then after a few seconds confirmed
`curl localhost:3001/health` → 200, `curl localhost:5173` → 200, and
`/tmp/peerconnect-dev.log` contained the full shared/backend/frontend
startup output (including #59's pretty-printed pino logs). Stopped all
background processes and removed the log file afterward.

No TypeScript touched; `npm run typecheck`/`build`/test suite unaffected
by this change (devcontainer config only).
