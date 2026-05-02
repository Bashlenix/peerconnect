# Issue 05 — Post Creation & Chronological Feed

**Type:** AFK
**Label:** needs-triage

## What to build

The core of the platform: authenticated users can create a post with a text body, category, and optional urgency flag. The feed displays all posts in reverse-chronological order showing author name, category tag, time posted, and reply count. The `FeedQuery` module encapsulates the feed SQL.

## Acceptance criteria

- [ ] `POST /posts` creates a post with `content`, `category`, and optional `is_urgent`; returns the created post
- [ ] `GET /posts` returns paginated posts in reverse-chronological order with `author`, `category`, `created_at`, `edited_at`, `reply_count` fields
- [ ] `FeedQuery` module builds the feed SQL with composable filters; tested for all-posts mode and pagination boundaries
- [ ] Frontend feed page renders the post list with all required fields visible
- [ ] Frontend create-post form collects content, category (dropdown), and urgency toggle; submits and refreshes the feed on success
- [ ] Urgent posts are visually distinguished in the feed
- [ ] TanStack Query manages feed data fetching, loading, and error states

## Blocked by

- Issue 04 — Login, Session & Protected Routes
