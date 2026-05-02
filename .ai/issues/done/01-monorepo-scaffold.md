# Issue 01 — Monorepo & Project Scaffold

**Type:** AFK
**Label:** needs-triage

## What to build

Set up the monorepo foundation that all other slices build on. Create the npm workspace structure with three packages: `apps/frontend` (React + Vite + TypeScript), `apps/backend` (Fastify + TypeScript), and `packages/shared` (shared TypeScript types). Wire up TypeScript project references so the backend and frontend can both import from `shared`. Confirm the dev servers for both apps start cleanly.

## Acceptance criteria

- [ ] Root `package.json` defines npm workspaces for `apps/*` and `packages/*`
- [ ] `apps/frontend` starts with `npm run dev` and renders a blank React page
- [ ] `apps/backend` starts with `npm run dev` and responds to `GET /health` with `{ status: "ok" }`
- [ ] `packages/shared` exports at least one placeholder type importable in both frontend and backend without TypeScript errors
- [ ] `@fastify/swagger` is installed and the OpenAPI docs UI is accessible at `/docs`
- [ ] Root-level `npm run dev` starts both apps concurrently

## Blocked by

None — can start immediately.
