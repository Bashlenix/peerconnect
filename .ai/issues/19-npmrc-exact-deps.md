# Issue 19 — Add .npmrc to enforce exact dependency versions

**Type:** AFK
**Label:** needs-triage

## What to build

Add a root-level `.npmrc` file with `save-exact=true` so any future `npm install <package>` saves exact versions (e.g. `5.8.5`) instead of semver ranges (e.g. `^5.8.5`) to `package.json`. The existing `package-lock.json` is already committed and pins the full tree — this makes `package.json` itself consistent with that intent.

## Acceptance criteria

- [ ] `.npmrc` exists at the repo root with `save-exact=true`
- [ ] Running `npm install <any-package>` writes an exact version to the relevant `package.json`
- [ ] No existing scripts or workflows are broken

## Blocked by

None — can start immediately.
