# PeerConnect

## The Problem

Every year, thousands of students — especially international students — arrive at German universities and face the same questions that thousands of students before them already solved: which Krankenkasse to pick, how to navigate the Ausländerbehörde, which professor's exam is actually hard, how to find housing fast. That knowledge exists, but it lives in WhatsApp group history that scrolls away, in Discord servers that go quiet, and in the heads of students who graduate and take it with them. Every new cohort starts from zero.

Existing platforms don't fix this. Reddit and Discord are anonymous, unstructured, and not university-specific. WhatsApp is ephemeral — knowledge buried in days, gone in months. Generic AI like ChatGPT gives plausible-sounding answers with no grounding in real German student experience.

## The Solution

PeerConnect is a verified peer knowledge platform built specifically for international and first-semester students at German universities. Students post questions across four categories — Academic, Social, Sport, and Daily Life Support — and answers accumulate permanently, ranked by community votes, with the best answer pinned as the accepted solution.

Every account is verified via university email, so every answer carries real context: who said it, where they study, how far along they are. Knowledge doesn't disappear when a student graduates — it stays searchable and citable for every cohort that follows.

**The AI layer makes accumulated knowledge instantly accessible.** While typing a new post, the platform silently searches existing answers and surfaces relevant ones inline — before you post. On the dedicated Ask AI page, students can query the entire peer knowledge base and receive a synthesised answer citing real source posts. The AI is deliberately constrained: it never answers from outside knowledge, only from verified peer posts. If no answer exists yet, it says so and prompts the student to be the first — growing the base for everyone who comes after.

Every new post makes the AI more useful. Every answer the AI surfaces reduces duplicate questions. The platform compounds in value over time in a way no chat group or generic AI can replicate.

## Key Features

- **Verified identity** — University email domain required at registration; answers carry university, programme, and semester context
- **Accepted solutions** — Post authors pin the best answer; it rises permanently above the noise
- **AI Ask Bot** — RAG-based assistant (GPT-4.1 nano) that answers only from verified peer posts, with cited sources; surfaces inline while drafting a post and on a dedicated `/ask` page
- **Real-time notifications** — Server-Sent Events deliver replies, upvotes, and solution alerts instantly
- **Full-text search** — PostgreSQL tsvector search with relevance ranking across all posts
- **Badge & reputation system** — Activity-based badges reward consistent contributors
- **Subscription tier** — Premium accounts remove ads

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Prerequisites](#prerequisites)
3. [Getting Started](#getting-started)
4. [Test Accounts](#test-accounts)
5. [Features & Expected Behaviour](#features--expected-behaviour)
6. [Manual Test Scenarios](#manual-test-scenarios)
7. [API Documentation](#api-documentation)
8. [Project Structure](#project-structure)
9. [Known Limitations](#known-limitations)

---

## Tech Stack

### Backend
| Concern | Technology |
|---|---|
| Runtime | Node.js 22 |
| Framework | Fastify 5 |
| Language | TypeScript 5.4 |
| Database | PostgreSQL 16 |
| ORM | Prisma 7 |
| Authentication | JWT in httpOnly cookies + Bcrypt (rounds: 12) |
| Real-time | Server-Sent Events (SSE) |
| Email | Nodemailer → Resend SMTP |
| API Docs | Fastify Swagger (OpenAPI 3) |

### Frontend
| Concern | Technology |
|---|---|
| Framework | React 18 + Vite 5 |
| Language | TypeScript 5.4 |
| Routing | React Router v7 |
| Server state | TanStack Query v5 |
| Client state | Zustand v5 |
| Styling | Tailwind CSS v4 |

---

## Prerequisites

Make sure you have the following installed before starting:

- **Node.js 22+** — [nodejs.org](https://nodejs.org)
- **Docker** — [docker.com](https://www.docker.com/get-started) (required for the recommended database setup)
- **Git**

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/Mhd-Bashi/PeerConnect.git
cd PeerConnect
```

### 2. Activate git hooks

```bash
git config core.hooksPath .githooks
```

This enables the pre-commit hook that guards against a known Prisma code-generation issue (see `CLAUDE.md` for details).

### 3. Install dependencies

```bash
npm ci
```

### 4. Start the database

#### Option A: Docker (recommended)

Build the pre-seeded database image and start it. This single command gives you a fully migrated PostgreSQL 16 instance with all test data already loaded.

```bash
docker build -f docker/db/Dockerfile -t peerconnect-db .
docker run -d -p 5432:5432 --name peerconnect-db peerconnect-db
```

The database is immediately ready at `postgresql://postgres:postgres@localhost:5432/peerconnect`.

To stop and remove the container:
```bash
docker stop peerconnect-db && docker rm peerconnect-db
```

#### Option B: Local PostgreSQL (without Docker)

If you cannot use Docker, install PostgreSQL 16 locally then run:

```bash
# Create the database
createdb peerconnect

# Copy the example env and update DATABASE_URL with your local credentials
cp apps/backend/.env.example apps/backend/.env
# Edit apps/backend/.env — set DATABASE_URL to your local connection string

# Run migrations
cd apps/backend
npx prisma migrate deploy

# Run all four seed scripts in order
npm run db:seed
npm run db:seed-dev
npm run db:seed-ads
npm run db:seed-extended
```

> The seed scripts must be run in that exact order. Skipping or reordering them will break foreign-key constraints.

### 5. Configure environment variables

```bash
cp apps/backend/.env.example apps/backend/.env
```

Open `apps/backend/.env` and set the following. All other fields can be left as-is for local development.

| Variable | Value for local dev |
|---|---|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/peerconnect` (Docker) or your local connection string |
| `JWT_SECRET` | Any random string of 32+ characters. Generate one with: `openssl rand -base64 32` |
| `FRONTEND_URL` | `http://localhost:5173` |
| `OPENAI_API_KEY` | Your OpenAI API key — required for the AI Ask Bot feature. The app runs without it, but `/ai/ask` will return 500. |

> The `SMTP_*` variables are required for new user registration but are **not needed** for local development — use the pre-seeded test accounts listed below instead.

The frontend has no environment variables; it proxies all API calls through Vite's dev server to the backend.

### 6. Start the development servers

From the project root, one command starts the backend, frontend, and shared package watcher concurrently:

```bash
npm run dev
```

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:3001 |
| API Docs (Swagger) | http://localhost:3001/docs |

---

## Test Accounts

All accounts are pre-verified and ready to use. **Password for all accounts: `Test1234!`**

> Do not attempt to register a new account locally — email verification requires SMTP credentials that are not set up in the local dev environment.

### Primary accounts (richest test data)

| Email | Tier | Name | Details |
|---|---|---|---|
| `free@tu-berlin.de` | Free | Alex Müller | CS sem 3, 1 badge, subscribed to Social |
| `premium@tu-berlin.de` | Premium | Jana Schmidt | Mech Eng sem 5, all 7 badges, subscribed to Academic + DailyLifeSupport, no ads |

### Extended accounts (one per university)

These accounts give you a realistic multi-user feed with posts and replies spread across all supported universities.

| Email | Tier | University | Study Programme |
|---|---|---|---|
| `alice@uni-dortmund.de` | Free | TU Dortmund | Mathematics, sem 2 |
| `bob@tu-berlin.de` | Free | TU Berlin | Computer Science, sem 4 |
| `carol@lmu.de` | Premium | LMU Munich | Biology, sem 6 |
| `dan@uni-heidelberg.de` | Free | Heidelberg | History, sem 3 |
| `eva@rwth-aachen.de` | Premium | RWTH Aachen | Mechanical Engineering, sem 5 |
| `frank@uni-hamburg.de` | Free | Hamburg | Economics, sem 1 |
| `greta@hu-berlin.de` | Premium | Humboldt Berlin | Law, sem 7 |
| `hans@uni-koeln.de` | Free | Cologne | Psychology, sem 3 |
| `ida@uni-frankfurt.de` | Premium | Frankfurt | Physics, sem 4 |
| `jan@uni-stuttgart.de` | Free | Stuttgart | Civil Engineering, sem 2 |
| `kai@stud.th-deg.de` | Free | TH Deggendorf | Business Informatics, sem 1 |

---

## Features & Expected Behaviour

### Authentication
- **Registration** — Email must belong to a recognised German university domain. A verification email is sent before the account is active. (Requires SMTP setup; not available in local dev without it.)
- **Login / Logout** — Sessions use short-lived JWTs (15 min) stored in httpOnly cookies, backed by a refresh token stored as a hash in the database.
- **Session persistence** — On page load the app silently refreshes the session via the refresh token; users stay logged in across browser restarts.

### Feed
- The main feed shows all posts, newest first.
- **Category filter** — Filter by Academic, Social, Sport, or Daily Life Support.
- **Subscribed-only filter** — Show only posts in categories the logged-in user has subscribed to.
- **Urgent posts** — Posts flagged as urgent appear with a visual indicator.
- **Ads** — Free-tier users see ads interspersed in the feed. Premium users see no ads.

### Full-text Search
- The search bar queries all post content using PostgreSQL's full-text search with English stemming.
- Results are ranked by relevance, not recency.
- Filters (category, time range) can be combined with search.

### Posts
- Any logged-in user can create a post in any category, with an optional urgent flag.
- The post author can **edit** the content at any time. An "edited" indicator appears after the first edit.
- The post author can **delete** their post only if it has no replies yet.
- Deleting a post with existing replies is blocked.

### Replies
- Any logged-in user can reply to any post.
- The reply author can **edit** their reply at any time.
- The reply author can **delete** their reply, unless it has been marked as the accepted solution.
- Any logged-in user can **upvote** a reply (once per reply). Upvotes can be removed.
- Replies are sorted: accepted solution first, then by upvote count descending, then by oldest first.

### Accepted Solutions
- The post author can mark one reply as the accepted solution.
- Only one solution per post is allowed. Marking a new solution automatically unmarks the previous one.
- The post author can also unmark a solution entirely.
- A reply marked as solution cannot be deleted by its author.

### Notifications
- **Real-time** — Notifications arrive instantly via Server-Sent Events (SSE) while the app is open.
- **Triggers:** reply on your post, upvote on your reply, your reply marked as solution, new post in a subscribed category, badge awarded.
- The notification bell shows an unread count badge.
- Notifications can be viewed in a history panel and marked as read individually.

### Notification Preferences
- Users can subscribe to any combination of the four post categories.
- When a new post is created in a subscribed category, the user receives a notification.
- Preferences are updated from the profile page.

### User Profiles
- Every user has a public profile showing their name, university, study programme, semester, languages, reply count, solution count, and earned badges.
- Users can edit their own profile (name, study programme, semester, languages).

### Badge System
Badges are awarded automatically based on activity thresholds:

| Badge | Trigger |
|---|---|
| First Reply | Post your first reply |
| Getting Started | Reach a reply count threshold |
| Active Helper | Reach a higher reply count |
| Community Builder | Reach an even higher reply count |
| Helpful Contributor | Receive a cumulative upvote threshold |
| Trusted Helper | Receive a higher upvote threshold |
| Solution Provider | Have a reply marked as accepted solution |

Each badge is awarded once and never re-awarded.

### Subscription Tiers
- **Free** — Full access to all features; ads displayed in feed. AI Ask Bot: inline pre-post helper shows FTS-only source links (no LLM synthesis, no quota consumed); explicit `/ask` page uses full RAG and counts against a **10 queries/day** cap (resets midnight UTC). A counter shows remaining queries on the `/ask` page; cap-exceeded state shows an upgrade prompt.
- **Premium** — Ads hidden; AI Ask Bot full RAG on both surfaces, no daily cap.
- The subscription model is data-only. No upgrade flow exists in the UI — use the pre-seeded accounts to test each tier.

### AI Ask Bot
- **Pre-post suggestions** — While typing a new post, the form queries existing posts after 800 ms of inactivity (minimum 20 characters). If relevant posts are found, a suggestion panel appears with source links. For free users this is FTS-only (no LLM call, no quota consumed). For premium users the panel also includes a synthesised answer. The post can still be submitted regardless.
- **Standalone /ask page** — Accessible via the "Ask AI" link in the header. Full RAG for all users (free and premium). Students receive a synthesised answer citing source posts. A "No answers found" state links back to the feed when the knowledge base has no relevant content.
- **Confidence levels** — `high` (3+ matching posts found), `low` (1–2 posts found), `none` (no matches — panel is hidden in the form, empty state shown on the /ask page).
- **Daily cap (free tier)** — Free users may make 10 explicit `/ask` queries per day (resets midnight UTC). The inline pre-post helper does not count against this quota. The `/ask` page shows a live counter ("X of 10 AI queries used today"). On cap hit both surfaces show an upgrade prompt. Premium users have no cap.
- **Burst rate limit** — 10 requests per user per 60 seconds (separate from the daily cap). Exceeding it returns a `429` with a `Retry-After` header indicating seconds until the window resets; the form remains usable.
- **Requires `OPENAI_API_KEY`** — The feature is disabled (500 error) if the env var is not set. All other app features continue to work normally.

---

## Manual Test Scenarios

Use the test accounts above to walk through each scenario. Log in via http://localhost:5173.

### 1. Authentication
- [ ] Log in as `free@tu-berlin.de` with password `Test1234!` — should reach the feed.
- [ ] Log out — should redirect to the login page.
- [ ] Log in as `premium@tu-berlin.de` — confirm the feed loads without ads.
- [ ] Refresh the page while logged in — session should persist without re-logging in.

### 2. Feed & Filtering
- [ ] Open the feed — confirm posts appear from multiple categories.
- [ ] Apply the **Academic** category filter — only Academic posts should remain.
- [ ] Apply the **Subscribed only** filter (logged in as `free@tu-berlin.de`, subscribed to Social) — only Social posts should appear.
- [ ] Confirm urgent posts display a visual urgent indicator.
- [ ] As a free user, confirm ads appear in the feed. As `premium@tu-berlin.de`, confirm no ads appear.

### 3. Full-text Search
- [ ] Search for `"linear algebra"` — relevant posts should appear ranked by relevance.
- [ ] Search for `"exam"` — multiple posts should match.
- [ ] Combine search with a category filter — results should narrow accordingly.
- [ ] Search for a term that matches nothing — an empty state should appear.

### 4. Creating & Managing Posts
- [ ] Log in as any account and create a new post in each category.
- [ ] Create a post with the **urgent** flag enabled — confirm the urgent indicator appears in the feed.
- [ ] Edit the post content — confirm an "edited" indicator appears on the post.
- [ ] Create a post with no replies and delete it — confirm it is removed from the feed.
- [ ] Try to delete a post that already has replies — the delete option should be disabled or produce an error.

### 5. Replies & Upvotes
- [ ] Open any post and add a reply.
- [ ] Edit the reply — confirm the updated content is saved.
- [ ] Log in as a different account and upvote the reply — confirm the upvote count increments.
- [ ] Remove the upvote — confirm the count decrements.
- [ ] Confirm you cannot upvote your own reply.
- [ ] Add a second reply to a post — confirm replies are ordered correctly (solution first, then upvotes desc, then oldest).

### 6. Accepted Solutions
- [ ] Log in as the author of a post. Open it and mark one reply as the solution.
- [ ] Confirm the solution reply moves to the top of the reply list with a solution indicator.
- [ ] Mark a different reply as the solution — confirm the previous one loses its solution status.
- [ ] Try to delete the reply marked as solution (log in as the reply author) — deletion should be blocked.
- [ ] Unmark the solution — confirm the reply becomes deletable again.

### 7. Notifications — Real-time
Open two browser windows (or use an incognito window):
- [ ] Window 1: logged in as `free@tu-berlin.de`. Window 2: logged in as `premium@tu-berlin.de`.
- [ ] From Window 2, reply to a post authored by the free user — a notification should appear live in Window 1.
- [ ] From Window 2, upvote a reply by the free user — notification should arrive in Window 1.
- [ ] From Window 1, mark the free user's own-post reply (authored by premium user) as solution — premium user should receive a notification in Window 2.

### 8. Notifications — History & Read State
- [ ] Open the notification panel — all unread notifications should be listed.
- [ ] Mark one notification as read — the unread count badge should decrement.
- [ ] Mark all notifications as read — the badge should disappear.

### 9. Notification Preferences
- [ ] Log in as `bob@tu-berlin.de` (no subscriptions set). Go to profile and subscribe to **Sport**.
- [ ] From another account, create a Sport post — `bob` should receive a notification.
- [ ] Unsubscribe from Sport — creating another Sport post should not trigger a notification.

### 10. User Profiles
- [ ] Open your own profile — confirm reply count, solution count, and badges are displayed.
- [ ] Edit your profile: change study programme, semester, and languages. Save and confirm changes persist.
- [ ] View another user's public profile — confirm you can see their badges and stats but cannot edit anything.
- [ ] Log in as `premium@tu-berlin.de` and open their profile — all 7 badges should be visible.

### 11. Badge System
- [ ] Log in as `alice@uni-dortmund.de` (fresh account, no badges). Post a reply on any post — the **First Reply** badge should be awarded and a notification should appear.
- [ ] Log in as `free@tu-berlin.de` — confirm the **First Reply** badge is already present on their profile.
- [ ] Log in as `premium@tu-berlin.de` — confirm all 7 badges are shown on their profile.

### 12. Ads & Subscription Tiers
- [ ] Log in as any free-tier account — confirm ads appear in the feed between posts.
- [ ] Log in as `premium@tu-berlin.de` or `carol@lmu.de` — confirm the feed contains no ads at all.

### 13. AI Ask Bot

> Requires `OPENAI_API_KEY` to be set in `apps/backend/.env`.

**Pre-post suggestion panel**
- [ ] Log in and open the feed. Start typing a new post with fewer than 20 characters — confirm no suggestion panel appears.
- [ ] Continue typing until the post reaches 20+ characters and pause for ~1 second — confirm the "Checking previous answers…" spinner appears, then a suggestion panel (or nothing if no matches).
- [ ] Type a question on a topic that exists in the seeded posts (e.g. `"linear algebra exam"`) — confirm the panel shows at least one source link.
- [ ] As a **free user**: confirm the panel shows source links only (no synthesised answer paragraph). As `premium@tu-berlin.de`: confirm the panel also shows a synthesised answer above the sources.
- [ ] Click a source link — confirm it navigates to the correct post detail page.
- [ ] Confirm the **Post** button remains enabled throughout — the panel never blocks submission.

**Standalone /ask page**
- [ ] Click the **Ask AI** link in the header — confirm it navigates to `/ask`.
- [ ] Submit a question that matches seeded content — confirm an answer and source links are shown.
- [ ] Click a source link — confirm it navigates to the correct post detail page.
- [ ] Submit a question on a topic with no matching posts — confirm the empty state appears with a "Go to feed" link.
- [ ] Click the "← Back to feed" link — confirm it returns to the feed.
- [ ] Log out and attempt to navigate to `/ask` directly — confirm you are redirected to the login page.

**Daily usage cap (free tier)**
- [ ] Log in as `free@tu-berlin.de`. Open `/ask` — confirm the usage counter ("X of 10 AI queries used today") is visible.
- [ ] Submit a query — confirm the counter increments.
- [ ] Log in as `premium@tu-berlin.de`. Open `/ask` — confirm no counter is shown.
- [ ] (Optional, requires DB manipulation) Exhaust the 10-query cap as a free user — confirm both `/ask` and the feed inline form show the upgrade CTA instead of an answer.

---

## API Documentation

The backend auto-generates interactive OpenAPI documentation using Fastify Swagger.

**URL:** http://localhost:3001/docs

The Swagger UI lists every endpoint with its request schema, response schema, and lets you make test requests directly from the browser. This is the fastest way to explore or manually test backend behaviour without writing curl commands.

---

## Project Structure

```
PeerConnect/
├── apps/
│   ├── backend/
│   │   ├── prisma/
│   │   │   ├── schema.prisma        # Database schema — source of truth for all tables
│   │   │   ├── migrations/          # Prisma migration history (auto-generated)
│   │   │   ├── seed.ts              # Reference data (universities, badges)
│   │   │   ├── seed-dev.ts          # Primary test users + example content
│   │   │   ├── seed-ads.ts          # Ad entries
│   │   │   └── seed-extended.ts     # Extended multi-university test users
│   │   ├── src/
│   │   │   ├── index.ts             # Entry point — starts the server
│   │   │   ├── app.ts               # Fastify app setup, plugins, route registration
│   │   │   ├── db.ts                # Prisma client singleton
│   │   │   ├── routes/              # One file per resource (auth, posts, replies, users, notifications, ads)
│   │   │   ├── modules/             # Domain logic extracted from routes
│   │   │   │   ├── ai-retrieval.ts        # FTS retrieval for AI Ask Bot (top-N posts + accepted solutions)
│   │   │   │   ├── ai-answer.ts           # GPT-4.1-nano synthesis — strict source-only prompt
│   │   │   │   ├── badge-engine.ts        # Badge award logic (atomic, threshold-based)
│   │   │   │   ├── domain-validator.ts    # University email domain checks
│   │   │   │   ├── email-verification-service.ts
│   │   │   │   ├── feed-query.ts          # Composable Prisma filters for the post feed
│   │   │   │   ├── post-search.ts         # Full-text search query builder
│   │   │   │   ├── reply-query.ts         # Reply sorting logic
│   │   │   │   ├── sse-manager.ts         # Server-Sent Events connection registry
│   │   │   │   └── token-service.ts       # JWT + refresh token handling
│   │   │   └── generated/           # Prisma client (auto-generated — do not edit)
│   │   └── tests/                   # Vitest integration tests (one file per module/route)
│   │
│   └── frontend/
│       └── src/
│           ├── pages/               # Route-level components (one per page)
│           │   ├── FeedPage.tsx
│           │   ├── AskPage.tsx          # AI Ask Bot — standalone /ask page
│           │   ├── PostDetailPage.tsx
│           │   ├── ProfilePage.tsx
│           │   ├── UserProfilePage.tsx
│           │   ├── LoginPage.tsx
│           │   ├── RegisterPage.tsx
│           │   ├── CheckEmailPage.tsx
│           │   └── VerifyEmailPage.tsx
│           ├── components/          # Reusable UI components
│           │   ├── ui/              # Base design-system primitives (buttons, inputs, etc.)
│           │   ├── AdCard.tsx
│           │   ├── NotificationBell.tsx
│           │   └── ProtectedRoute.tsx
│           ├── api/                 # Fetch wrappers, one file per backend resource
│           │   ├── ai.ts            # askAI(query, source), getAiUsage() — AI Ask Bot fetch wrappers
│           ├── hooks/               # React Query hooks + auth initialisation
│           ├── store/               # Zustand store (auth/user state)
│           └── lib/                 # Shared utilities (cn, etc.)
│
├── packages/
│   └── shared/                      # TypeScript types shared between backend and frontend
│
└── docker/
    └── db/
        └── Dockerfile               # Multi-stage image: runs migrations + seeds, dumps to SQL
```

### How a feature is structured (backend)

Each feature follows the same pattern:

1. **Route file** (`src/routes/posts.ts`) — declares endpoints, validates input/output schemas with Fastify's JSON Schema, calls services or Prisma directly.
2. **Module file(s)** (`src/modules/feed-query.ts`) — extracted domain logic that is complex enough to test in isolation (badge thresholds, search query building, token handling, etc.).
3. **Tests** (`tests/posts.test.ts`) — integration tests that spin up the full Fastify app against a real test database.

To add a new feature: create a route file in `src/routes/`, register it in `app.ts`, and add any non-trivial logic to a new module in `src/modules/`.

---

## Known Limitations

- **Premium tier is data-only.** The subscription status is stored in the database and controls ad visibility and the AI daily query cap, but there is no upgrade flow, payment processing, or checkout UI. Use the pre-seeded premium accounts to test the premium experience.
- **SSE notifications are single-process only.** The SSE manager holds open connections in memory. This works correctly for local development but would not work across multiple server instances in production (would require a Redis pub/sub layer).
- **Registration is restricted to known university domains.** Any email address whose domain is not in the seeded university list is rejected outright at registration with a 422 error. Adding a new university requires updating the seed data and rerunning migrations — there is no admin UI for this.
- **Text only.** Posts and replies are plain text. File and image uploads are not supported.
- **No direct messaging.** All communication is public within posts.
- **English full-text search only.** PostgreSQL stemming is configured for English regardless of the post's actual language. German or mixed-language posts may return incomplete results.
