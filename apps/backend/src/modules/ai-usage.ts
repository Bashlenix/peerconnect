import { prisma } from "../db.js";

const RATE_LIMIT = 10;
const WINDOW_MS = 60_000;
const AI_DAILY_LIMIT = 10;

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

/** Test-only: clears burst rate-limit state without exposing the internal Map. */
export function resetRateLimit(): void {
  rateLimitMap.clear();
}

export type UsageCheckResult =
  | { denied: "burst"; retryAfter: number }
  | { denied: "daily"; retryAfter: number }
  | { allowed: true; ftsOnly: boolean; shouldIncrement: boolean };

function checkBurst(userId: string): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry || now >= entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, retryAfter: 0 };
  }

  if (entry.count >= RATE_LIMIT) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }

  entry.count++;
  return { allowed: true, retryAfter: 0 };
}

function todayUtc(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function secondsUntilMidnightUtc(): number {
  const tomorrow = new Date();
  tomorrow.setUTCHours(24, 0, 0, 0);
  return Math.ceil((tomorrow.getTime() - Date.now()) / 1000);
}

async function isPremiumUser(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { subscription: { select: { status: true } } },
  });
  return user?.subscription?.status === "premium";
}

export async function checkUsage(
  userId: string,
  source: "inline" | "ask" | undefined,
): Promise<UsageCheckResult> {
  const burst = checkBurst(userId);
  if (!burst.allowed) {
    return { denied: "burst", retryAfter: burst.retryAfter };
  }

  const premium = await isPremiumUser(userId);

  if (premium) {
    return { allowed: true, ftsOnly: false, shouldIncrement: false };
  }

  // Free users on the inline surface: FTS-only, no quota consumed.
  if (source === "inline") {
    return { allowed: true, ftsOnly: true, shouldIncrement: false };
  }

  // Free users on the ask surface: read-only check against the daily quota.
  // Do NOT increment here — the caller must only increment after the answer
  // is actually generated, so a failed request doesn't burn a query.
  const date = todayUtc();
  const existing = await prisma.aiUsageLog.findUnique({
    where: { userId_date: { userId, date } },
    select: { count: true },
  });

  if ((existing?.count ?? 0) >= AI_DAILY_LIMIT) {
    return { denied: "daily", retryAfter: secondsUntilMidnightUtc() };
  }

  return { allowed: true, ftsOnly: false, shouldIncrement: true };
}

export async function incrementDailyUsage(userId: string): Promise<void> {
  const date = todayUtc();
  await prisma.aiUsageLog.upsert({
    where: { userId_date: { userId, date } },
    update: { count: { increment: 1 } },
    create: { userId, date, count: 1 },
  });
}

export async function getUsage(
  userId: string,
): Promise<{ used: number | null; limit: number | null }> {
  const premium = await isPremiumUser(userId);
  if (premium) return { used: null, limit: null };

  const today = todayUtc();
  const log = await prisma.aiUsageLog.findUnique({
    where: { userId_date: { userId, date: today } },
    select: { count: true },
  });

  return { used: log?.count ?? 0, limit: AI_DAILY_LIMIT };
}
