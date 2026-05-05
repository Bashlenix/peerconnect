docs: add comprehensive README.md

Covers everything a new team member needs to get started and contribute:

- Project description and tech stack (backend: Fastify/Prisma/PostgreSQL,
  frontend: React/Vite/TanStack Query/Zustand/Tailwind)
- Full setup guide from clone to running dev servers, with Docker as the
  primary database path and a manual PostgreSQL fallback
- All 13 test accounts with email, password, tier, university, and
  study programme
- Feature descriptions with expected behaviour for: auth, feed, search,
  posts, replies, solutions, notifications, notification preferences,
  profiles, badges, subscription tiers, and ads
- Manual test scenarios checklist covering every feature
- Short mention of the /docs Swagger UI for API exploration
- Codebase orientation section: directory map + explanation of the
  backend module/route/test pattern
- Known limitations: premium tier is data-only, SSE is single-process,
  no admin UI for manual review, text-only posts, English search only
- Prominent contributor notice restricting new contributors to
  front-end work only (to be removed when backend is opened up)

Notes for later:
- SMTP / email-verification bypass not yet documented (pre-seeded
  accounts are the local dev workaround for now)
- Contributor notice (frontend-only restriction) should be removed
  once backend work is opened to the wider team

Files changed:
- README.md  (new)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
