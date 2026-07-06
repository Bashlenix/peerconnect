# 59 — Turn on structured logging (pino)

**Type:** Chore
**Labels:** needs-triage, done
**GitHub:** https://github.com/Bashlenix/peerconnect/issues/65

## What to build

Fastify's logger is currently fully disabled (`Fastify({ logger: false })` in
`app.ts`), so nothing structured is emitted — only a handful of raw
`console.log`/`console.error` calls remain (`index.ts` startup lines,
`notifier.ts`'s dispatch-failure catch). Wire up Fastify's built-in pino
support properly.

- New `apps/backend/src/logger.ts`: exports a configured `pino` instance —
  pretty-printed via `pino-pretty` in dev, plain JSON in production,
  `level: "silent"` when `NODE_ENV === "test"`. Redacts `req.headers.cookie`,
  `req.headers.authorization`, `req.body.password`, and
  `res.headers["set-cookie"]` so tokens/passwords never hit log output.
- `apps/backend/src/app.ts`: replace `logger: false` with
  `loggerInstance: logger` so every request/response is auto-logged at `info`.
- `apps/backend/src/index.ts`: replace the two `console.log` startup lines
  with `logger.info(...)`.
- `apps/backend/src/modules/notifier.ts`: replace `console.error(...)` with
  `logger.error(...)`.
- `apps/backend/package.json`: add `pino` as a direct dependency (currently
  only transitive via fastify) and `pino-pretty` as a devDependency.

## Acceptance criteria

- [x] Running `npm run dev` and hitting any route shows a pretty-printed
      request/response log line in the terminal.
- [x] Cookies, `Authorization` headers, and request-body passwords never
      appear in plaintext in log output.
- [x] `npm test` output stays quiet (no request logs interleaved with test
      output) — the existing 268 tests are unaffected since `NODE_ENV=test`
      under vitest.
- [x] `npm run typecheck` and `npm run build` pass.

## Blocked by

None - can start immediately

## Completion notes

Implemented test-first: `apps/backend/tests/logger.test.ts` was written
against a not-yet-existing `src/logger.ts` (confirmed red), then the module
was implemented to make it pass. Two testable seams: `logger.level` (must be
`"silent"` under `NODE_ENV=test`) and the exported `redactConfig` used to
build a scratch pino instance against a captured stream, asserting the four
sensitive paths never appear in emitted output while non-sensitive fields do.

Wired via Fastify's `loggerInstance` option (passing a pre-built pino
instance) rather than the `logger` config-object option, so
`notifier.ts`/`index.ts` can import and log through the exact same instance.

Full backend suite: 270/270 passing (268 pre-existing + 2 new), 16/16 files.
Typecheck and both workspace builds clean. Manually started the dev server
and curled `/health` — pretty request/response log lines appeared with no
secrets visible, confirming the acceptance criteria end-to-end.

`npm run lint` and `n8n start` from `ralph/prompt.md`'s feedback-loop list
were skipped — no lint script/ESLint config exists anywhere in this repo,
and `n8n` is unrelated to this project (template leftover).
