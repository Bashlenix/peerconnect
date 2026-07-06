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

// Generic service-level error codes clients branch on rather than matching
// the human-readable `message`: "service_unavailable" (HTTP 503) when the
// backend cannot reach its database — e.g. the dev DB container is still
// starting after a Codespace resume — and "rate_limited" (HTTP 429) when a
// client has exceeded a route's request quota.
export type ServiceErrorCode = "service_unavailable" | "rate_limited";

export interface ServiceErrorResponse {
  code: ServiceErrorCode;
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

export type BadgeEvent = "REPLY_CREATED" | "UPVOTE_RECEIVED" | "SOLUTION_MARKED";

export const BADGE_NAMES = {
  FIRST_REPLY: "First Reply",
  GETTING_STARTED: "Getting Started",
  ACTIVE_HELPER: "Active Helper",
  COMMUNITY_BUILDER: "Community Builder",
  HELPFUL_CONTRIBUTOR: "Helpful Contributor",
  TRUSTED_HELPER: "Trusted Helper",
  SOLUTION_PROVIDER: "Solution Provider",
} as const;

export interface BadgeMetadata {
  description: string;
  rank: number;
  icon: string;
}

// Rank is the sole source of truth for "which badge is most impressive" —
// used by badge-engine.ts to compute each user's topBadgeName, and by the
// frontend to pick an icon/tooltip. Peer-validated badges (upvotes, accepted
// solutions) outrank pure activity-volume badges.
export const BADGE_METADATA: Record<string, BadgeMetadata> = {
  [BADGE_NAMES.FIRST_REPLY]: {
    description: "Posted first reply",
    rank: 0,
    icon: "MessageSquare",
  },
  [BADGE_NAMES.GETTING_STARTED]: {
    description: "Posted 3 replies",
    rank: 1,
    icon: "Footprints",
  },
  [BADGE_NAMES.COMMUNITY_BUILDER]: {
    description: "Posted 10 or more replies in Social or Sport categories",
    rank: 2,
    icon: "Users",
  },
  [BADGE_NAMES.ACTIVE_HELPER]: {
    description: "Posted 10 or more replies",
    rank: 3,
    icon: "Zap",
  },
  [BADGE_NAMES.HELPFUL_CONTRIBUTOR]: {
    description: "Received 5 upvotes on replies",
    rank: 4,
    icon: "ThumbsUp",
  },
  [BADGE_NAMES.SOLUTION_PROVIDER]: {
    description: "Had 5 replies marked as the accepted solution",
    rank: 5,
    icon: "CheckCircle",
  },
  [BADGE_NAMES.TRUSTED_HELPER]: {
    description: "Received 15 upvotes on replies",
    rank: 6,
    icon: "ShieldCheck",
  },
};
