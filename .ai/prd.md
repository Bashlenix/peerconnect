# PRD: PeerConnect DIT

## Problem Statement

Students at German universities — especially international students — struggle to find help from peers. Information is scattered across private WhatsApp groups and Discord servers, meaning the same questions get asked repeatedly with no centralised, searchable record of answers. Students feel uncomfortable contacting strangers privately, and there is no structured way to signal who can help with what.

## Solution

PeerConnect DIT is a university-focused, community-driven Q&A platform where students post questions publicly and receive structured help from verified peers. All interactions are public and searchable, so knowledge is reusable. Access is restricted to verified university students via email domain validation. A reputation and badge system incentivises quality contributions.

## User Stories

### Authentication & Verification
1. As a new user, I want to register with my university email address, so that I can access the platform.
2. As a new user, I want the system to automatically verify my university affiliation by checking my email domain, so that I don't need to submit paper proof.
3. As a new user, I want to receive a verification email with a confirmation link, so that I can activate my account.
4. As a new user, I want to be shown a clear error if my email domain is not a recognised university domain, so that I understand why registration failed.
5. As a new user whose domain is unrecognised, I want to be flagged for manual admin review, so that I still have a path to access the platform.
6. As a registered user, I want to log in with my email and password, so that I can access my account.
7. As a logged-in user, I want my session to persist across page reloads, so that I don't have to log in repeatedly.
8. As a logged-in user, I want to log out, so that I can secure my account on shared devices.

### Post System
9. As a verified student, I want to create a post with a text body and a category (Academic, Social, Sport, Daily Life Support), so that others can discover and answer my question.
10. As a verified student, I want to optionally mark my post as urgent, so that it stands out to potential helpers.
11. As a user, I want to browse a chronological feed of all posts, so that I can see what others are asking.
12. As a user, I want to filter the feed by category, so that I can focus on topics relevant to me.
13. As a user, I want to filter the feed by time range (last 24h, last 3 days, last 7 days), so that I can find recent posts.
14. As a user, I want to toggle the feed to show only posts in my subscribed categories, so that I can reduce noise.
15. As a post author, I want to edit my post at any time, so that I can correct mistakes or add detail.
16. As a post author, I want to delete my post if it has no replies, so that I can remove irrelevant questions.
17. As a user, I want to see an "edited" indicator on modified posts, so that I know the content has changed since it was first posted.
18. As a user, I want to see the author name, category tag, time posted, and reply count on each post in the feed, so that I can quickly assess relevance.

### Reply System
19. As a verified student, I want to reply publicly to any post, so that I can share my knowledge.
20. As a reply author, I want to edit my reply at any time, so that I can improve my answer.
21. As a reply author, I want to delete my reply, unless it has been marked as the accepted solution, so that I can remove incorrect information.
22. As a user viewing a post, I want to see all replies sorted with the accepted solution first, then by upvote count descending, so that the best answer is always immediately visible.
23. As a user, I want to upvote any reply I find helpful, so that quality answers rise to the top.
24. As a post author, I want to mark one reply as the accepted solution, so that future readers know which answer resolved the question.
25. As a post author, I want to unmark a solution if I change my mind, so that I can correct a mistaken selection.

### Search
26. As a user, I want to search posts by keyword, so that I can find existing answers before asking a duplicate question.
27. As a user, I want search results to be ranked by relevance (not just chronological), so that the most pertinent posts appear first.
28. As a user, I want search to match stemmed words (e.g. "register" matches "registration"), so that I don't need to guess the exact phrasing used.

### Notification System
29. As a user, I want to subscribe to one or more post categories, so that I am notified of new posts relevant to me.
30. As a user, I want to receive a real-time notification when a new post is created in a category I subscribe to, so that I can respond quickly.
31. As a post author, I want to receive a real-time notification when someone replies to my post, so that I can follow the discussion.
32. As a reply author, I want to receive a real-time notification when my reply is upvoted, so that I know my answer was helpful.
33. As a reply author, I want to receive a real-time notification when my reply is marked as the accepted solution, so that I know my answer resolved the question.
34. As a user, I want to manage which categories trigger notifications, so that I can reduce unwanted interruptions.
35. As a user, I want a notification bell icon that shows unread notification count, so that I can see at a glance if something needs my attention.
36. As a user, I want to mark notifications as read, so that the unread count stays accurate.

### User Profile
37. As a user, I want to view and edit my profile (first name, last name, study programme, semester, languages spoken), so that others can understand my background.
38. As a user, I want my email address to be locked and non-editable, so that my university verification remains valid.
39. As a user, I want to view another user's public profile showing their badges, reply count, and accepted solution count, so that I can assess their credibility.
40. As a user, I want to manage my notification preferences from my profile page, so that I have one place to control my experience.

### Badge & Reputation System
41. As a user, I want to automatically receive the "First Reply" badge after posting my first reply, so that I feel welcomed to contribute.
42. As a user, I want to automatically receive the "Getting Started" badge after posting 3 replies, so that early participation is recognised.
43. As a user, I want to automatically receive the "Active Helper" badge after posting 10 or more replies, so that sustained contribution is rewarded.
44. As a user, I want to automatically receive the "Community Builder" badge after posting 10 or more replies in the Social or Sport categories, so that community-building is specifically recognised.
45. As a user, I want to automatically receive the "Helpful Contributor" badge when 5 of my replies have been upvoted, so that quality contributions are recognised.
46. As a user, I want to automatically receive the "Trusted Helper" badge when 15 of my replies have been upvoted, so that sustained quality is rewarded.
47. As a user, I want to automatically receive the "Solution Provider" badge when 5 of my replies have been marked as accepted solutions, so that reliable answering is recognised.
48. As a user, I want to see my earned badges displayed on my profile, so that others can see my reputation.
49. As a user, I want to receive a notification when I earn a new badge, so that I am aware of my progress.

### Subscription & Premium Features
50. As a user, I want the platform to track whether I have a free or premium subscription, so that premium features are correctly gated.
51. As a user, I want the system to store my subscription start and end dates, so that entitlements can be calculated correctly when billing is added.
52. As a free user, I want ads to appear in the feed, so that the platform can be sustained without a subscription fee.
53. As a premium user, I want ads to be hidden from the feed entirely, so that my reading experience is uninterrupted.

### Account Management
54. As a user, I want to delete my account, so that I can remove my personal data from the platform.
55. As a user, I want my posts and replies to remain on the platform after account deletion (shown as "Deleted User"), so that community knowledge is preserved even if I leave.

### AI Ask Bot
56. As a user composing a post, I want the form to silently check existing posts while I type and surface relevant source links in a suggestion panel, so that I can find existing answers before posting a duplicate question.
57. As a user on the `/ask` page, I want to ask a freeform question and receive a synthesised answer citing real peer posts, so that I can get an immediate answer from the knowledge base.
58. As a free user on the `/ask` page, I want to know how many AI queries I have left today, so that I can budget my usage.
59. As a free user who has exhausted their daily AI quota, I want a clear message explaining the limit and how to unlock more, so that I understand why the feature is unavailable.
60. As a premium user, I want unrestricted access to AI queries on both surfaces, so that my subscription delivers tangible value.
61. As a free user using the inline pre-post helper, I want the suggestion panel to appear without consuming my daily AI quota, so that exploring existing answers doesn't penalise me for asking a question.

## Implementation Decisions

### Monorepo Structure
- Single repository with npm workspaces: `apps/frontend`, `apps/backend`, `packages/shared`
- `packages/shared` exports TypeScript types for all API request/response shapes, shared between frontend and backend

### Backend
- Node.js + Fastify + TypeScript
- Prisma ORM for all database access and migrations
- `@fastify/swagger` enabled from day one for auto-generated OpenAPI docs
- JWT stored in `httpOnly` cookies; refresh token strategy for session persistence
- Passwords hashed with bcrypt

### Frontend
- React + TypeScript, bundled with Vite
- React Router v6 for client-side routing with protected route wrappers
- TanStack Query for all server state (posts, replies, notifications, profile)
- Zustand for client state (current user, auth status, UI state)
- Tailwind CSS + shadcn/ui for styling and base components

### Database (PostgreSQL via Prisma)
Key tables: `users`, `universities`, `posts`, `replies`, `upvotes`, `notifications`, `notification_preferences`, `badges`, `user_badges`, `subscriptions`, `ai_usage_logs`, `ads`

Notable schema decisions:
- `universities(id, name, domain, is_active)` — seeded via Prisma seed script
- `users.requires_manual_review` boolean flag for unrecognised domains
- `posts.search_vector` generated `tsvector` column, indexed with GIN, for full-text search
- `posts.edited_at` nullable timestamp to drive "edited" indicator
- `posts.author_id` / `replies.author_id` nullable (`onDelete: SetNull`) to preserve content after account deletion
- `replies.is_solution` boolean, only one true per post (enforced in application layer)
- `subscriptions(user_id, status, start_date, end_date)` — `status` is `free | premium`; acted upon for ad visibility and AI quota
- `ai_usage_logs(user_id, date @db.Date, count)` — `@@unique([user_id, date])`; tracks daily AI usage per free user; premium users have no rows

### Deep Modules
- **DomainValidator** — validates email domain against `universities` table; returns `{ valid, university } | { valid: false }`
- **EmailVerificationService** — generates signed tokens, persists them, sends emails via Nodemailer (Resend SMTP), validates on click
- **BadgeEngine** — `checkAndAwardBadges(userId, event)` queries user counters, compares against badge thresholds, inserts new `user_badges` rows atomically; called after reply creation, upvote, and solution-marking
- **SSEManager** — maintains a registry of open SSE connections keyed by `userId`; exposes `push(userId, event)` callable from anywhere in the backend; cleans up on disconnect
- **PostSearchService** — wraps PostgreSQL `to_tsquery` / `ts_rank` queries behind `search(query: string, filters: SearchFilters): Post[]`
- **FeedQuery** — constructs the feed SQL query with composable filters (category, time range, subscribed-only toggle); returns paginated results
- **AI Retrieval (`ai-retrieval.ts`)** — runs FTS against `posts` using `retrieveRelevantPosts(prisma, query)`; returns top-N posts with accepted solutions weighted higher
- **AI Answer (`ai-answer.ts`)** — calls GPT-4.1 nano via OpenAI SDK; strict source-only system prompt; returns `{ answer, sources, confidence }`

### AI Ask Bot Architecture
- `POST /ai/ask` accepts `{ query, source?: "inline" | "ask" }`. `source` defaults to `"ask"`.
- **Free + `source: "inline"`**: runs retrieval only, skips LLM synthesis, returns `{ answer: null, sources, confidence }`. No quota consumed.
- **Free + `source: "ask"`**: full RAG pipeline; checks and increments `ai_usage_logs` (read before, write after success). Daily cap: 10/day, resets midnight UTC.
- **Premium (any source)**: full RAG, no quota check.
- Both 429 variants return `{ code: "rate_limit_burst" | "rate_limit_daily", message }` and a `Retry-After` header.
- `GET /ai/usage` returns `{ used: number | null, limit: number | null }` — both null for premium.

### Notifications
- Server-Sent Events (SSE) for real-time push — one-directional server-to-client, no WebSocket complexity
- SSEManager holds connections in memory; acceptable for local deployment scope
- Notification events: `new_post_in_category`, `reply_to_post`, `reply_upvoted`, `reply_marked_solution`, `badge_awarded`

### Reply Ordering
- Accepted solution always first (`is_solution DESC`)
- Remaining replies sorted by `upvote_count DESC, created_at ASC`

### Edit / Delete Rules
- Posts: editable anytime; deletable only if `reply_count = 0`
- Replies: editable anytime; deletable only if `is_solution = false`
- Both show `edited_at` timestamp when modified

### Feed Default
- Default: all posts, newest first
- Toggle: filter to user's subscribed categories only

## Testing Decisions

A good test verifies observable behaviour from the outside — what goes in and what comes out — not how the module achieves it internally. Tests should not assert on private state, internal method calls, or database query structure.

The following deep modules will have unit/integration tests:

1. **DomainValidator** — test valid university domains, invalid domains, inactive domains, malformed emails, and subdomains
2. **EmailVerificationService** — test token generation uniqueness, token expiry, valid confirmation flow, invalid/expired token rejection
3. **BadgeEngine** — test each badge threshold independently; test that already-awarded badges are not re-awarded; test atomic award under concurrent events
4. **SSEManager** — test connection registration, `push` delivery to correct user, cleanup on disconnect, push to disconnected user does not throw
5. **PostSearchService** — test keyword matching, stemming behaviour, filter combinations (category + time), empty result sets, SQL injection safety
6. **FeedQuery** — test all-posts mode, subscribed-category filter, time range filter, category filter, combined filters, pagination boundaries

Shallow route handlers (auth, post, reply, notification, profile, badge routes) are not unit tested — they are covered implicitly by manual integration testing during development.

7. **AI route** — integration tests cover: free+inline (FTS-only, no quota consumed), free+ask (full RAG, quota incremented after success only), premium (no quota check on either surface), burst 429 (correct `code` + `Retry-After`), daily 429 (correct `code` + `Retry-After`), OpenAI failure does not consume quota.

## Out of Scope

- Location-based features (geolocation, proximity filtering, distance display)
- Payment processing or upgrade flow for Premium subscriptions (Stripe or any billing provider) — subscription status is set directly in the database; no UI checkout exists
- Admin panel UI (university domain management is handled via Prisma seed script)
- Mobile native apps
- Deployment infrastructure (project runs locally only)
- Algorithmic feed ranking
- Direct messaging between users
- Post attachments or image uploads

## Further Notes

- The `universities` table is the authoritative source for allowed domains. Adding a new university requires a database insert, not a code change.
- The `requires_manual_review` flag on users provides an escape hatch for students at valid universities with non-standard email domains; the workflow for acting on this flag (e.g. an admin query) is out of scope for this version.
- `@fastify/swagger` auto-generates the OpenAPI documentation required for the university submission — no manual API doc writing needed.
- The SSEManager holds connections in process memory, which is acceptable for a single-process local deployment. A production version would need a shared pub/sub layer (e.g. Redis) to support multiple server instances.
