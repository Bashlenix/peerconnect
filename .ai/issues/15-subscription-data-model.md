# Issue 15 — Subscription Data Model

**Type:** AFK
**Label:** needs-triage

## What to build

Seed a default free subscription record for every newly registered user. Expose the subscription status on the current user's profile endpoint so the frontend can read it. No payment processing — this slice only establishes the data model for future billing integration.

## Acceptance criteria

- [ ] A `subscriptions` row with `status = "free"` and no `end_date` is created automatically when a new user registers
- [ ] `GET /auth/me` includes `subscription: { status, start_date, end_date }` in the response
- [ ] Frontend profile page displays the user's current subscription status (e.g. "Free plan")
- [ ] No payment UI, no Stripe integration, no premium entitlement checks

## Blocked by

- Issue 04 — Login, Session & Protected Routes
