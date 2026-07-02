export type PostCategory = "Academic" | "Social" | "Sport" | "Daily Life Support";

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface HealthResponse {
  status: "ok" | "error";
}

export interface AiSource {
  id: string;
  content: string;
  category: string;
  author: { firstName: string | null; lastName: string | null };
}

export type AiErrorCode = "rate_limit_burst" | "rate_limit_daily";

export interface AiErrorResponse {
  code: AiErrorCode;
  message: string;
}

export interface AiAskRequest {
  query: string;
  source?: "inline" | "ask";
}

export interface AiAskResponse {
  answer: string | null;
  sources: AiSource[];
  confidence: "high" | "low" | "none";
}

// ─── Badges ────────────────────────────────────────────────────────────────
// Single source of truth for badge definitions and award thresholds. Consumed
// by both the runtime badge engine (apps/backend/src/modules/badge-engine.ts)
// and the reference-data seed (apps/backend/prisma/seed-data.ts).

export type BadgeEvent = "REPLY_CREATED" | "UPVOTE_RECEIVED" | "SOLUTION_MARKED";

export interface BadgeRule {
  name: string;
  description: string;
  event: BadgeEvent;
  threshold: number;
  /**
   * When set, only replies on posts in these categories count toward the
   * threshold. Values must match the Prisma `PostCategory` enum members
   * (e.g. "Social", "Sport") since they are used directly in DB queries.
   */
  categoryFilter?: string[];
}

export const BADGE_NAMES = {
  FIRST_REPLY: "First Reply",
  GETTING_STARTED: "Getting Started",
  ACTIVE_HELPER: "Active Helper",
  COMMUNITY_BUILDER: "Community Builder",
  HELPFUL_CONTRIBUTOR: "Helpful Contributor",
  TRUSTED_HELPER: "Trusted Helper",
  SOLUTION_PROVIDER: "Solution Provider",
} as const;

export const BADGE_RULES: BadgeRule[] = [
  {
    name: BADGE_NAMES.FIRST_REPLY,
    description: "Posted your first reply",
    event: "REPLY_CREATED",
    threshold: 1,
  },
  {
    name: BADGE_NAMES.GETTING_STARTED,
    description: "Posted 3 replies",
    event: "REPLY_CREATED",
    threshold: 3,
  },
  {
    name: BADGE_NAMES.ACTIVE_HELPER,
    description: "Posted 10 or more replies",
    event: "REPLY_CREATED",
    threshold: 10,
  },
  {
    name: BADGE_NAMES.COMMUNITY_BUILDER,
    description: "Posted 10 or more replies in Social or Sport categories",
    event: "REPLY_CREATED",
    threshold: 10,
    categoryFilter: ["Social", "Sport"],
  },
  {
    name: BADGE_NAMES.HELPFUL_CONTRIBUTOR,
    description: "Received 5 upvotes on your replies",
    event: "UPVOTE_RECEIVED",
    threshold: 5,
  },
  {
    name: BADGE_NAMES.TRUSTED_HELPER,
    description: "Received 15 upvotes on your replies",
    event: "UPVOTE_RECEIVED",
    threshold: 15,
  },
  {
    name: BADGE_NAMES.SOLUTION_PROVIDER,
    description: "Had 5 replies marked as the accepted solution",
    event: "SOLUTION_MARKED",
    threshold: 5,
  },
];
