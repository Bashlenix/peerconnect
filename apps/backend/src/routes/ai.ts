import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { retrieveRelevantPosts } from "../modules/ai-retrieval.js";
import { generateAiAnswer } from "../modules/ai-answer.js";

interface AskBody {
  query: string;
}

// In-memory rate limit: max 10 requests per user per 60 seconds
// Exported so integration tests can reset state between cases.
export const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
const WINDOW_MS = 60_000;

const AI_DAILY_LIMIT = 10;

function checkRateLimit(userId: string): { allowed: boolean; retryAfter: number } {
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
  const now = Date.now();
  const tomorrow = new Date();
  tomorrow.setUTCHours(24, 0, 0, 0);
  return Math.ceil((tomorrow.getTime() - now) / 1000);
}

async function checkDailyLimit(
  userId: string,
): Promise<{ allowed: boolean; used: number; limit: number }> {
  const date = todayUtc();
  const existing = await prisma.aiUsageLog.findUnique({
    where: { userId_date: { userId, date } },
    select: { count: true },
  });
  const used = existing?.count ?? 0;
  return { allowed: used < AI_DAILY_LIMIT, used, limit: AI_DAILY_LIMIT };
}

async function incrementDailyUsage(userId: string): Promise<void> {
  const date = todayUtc();
  await prisma.aiUsageLog.upsert({
    where: { userId_date: { userId, date } },
    update: { count: { increment: 1 } },
    create: { userId, date, count: 1 },
  });
}

const aiSourceSchema = {
  type: "object" as const,
  properties: {
    id: { type: "string" },
    content: { type: "string" },
    category: { type: "string" },
    author: {
      type: "object",
      properties: {
        firstName: { type: "string", nullable: true },
        lastName: { type: "string", nullable: true },
      },
      required: ["firstName", "lastName"],
    },
  },
  required: ["id", "content", "category", "author"],
};

const errorSchema = {
  type: "object",
  properties: { message: { type: "string" } },
  required: ["message"],
};

const aiErrorSchema = {
  type: "object",
  properties: {
    code: { type: "string" },
    message: { type: "string" },
  },
  required: ["code", "message"],
};

export async function aiRoute(app: FastifyInstance) {
  app.post<{ Body: AskBody }>(
    "/ai/ask",
    {
      preHandler: app.authenticate,
      schema: {
        tags: ["AI"],
        summary: "Ask the AI bot a question",
        description:
          "Searches existing posts and synthesises an answer using GPT-4.1 nano. Only answers from retrieved peer posts — never from outside knowledge. Free users are limited to 10 queries per day.",
        body: {
          type: "object",
          required: ["query"],
          properties: {
            query: { type: "string", minLength: 10, maxLength: 500 },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              answer: { type: "string", nullable: true },
              sources: { type: "array", items: aiSourceSchema },
              confidence: { type: "string", enum: ["high", "low", "none"] },
            },
            required: ["answer", "sources", "confidence"],
          },
          400: errorSchema,
          401: errorSchema,
          429: aiErrorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { userId } = request.user;

      const rateCheck = checkRateLimit(userId);
      if (!rateCheck.allowed) {
        return reply
          .status(429)
          .header("Retry-After", String(rateCheck.retryAfter))
          .send({ code: "rate_limit_burst", message: "Too many requests — please wait a moment" });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { subscription: { select: { status: true } } },
      });

      const isPremium = user?.subscription?.status === "premium";

      if (!isPremium) {
        const { allowed } = await checkDailyLimit(userId);
        if (!allowed) {
          return reply
            .status(429)
            .header("Retry-After", String(secondsUntilMidnightUtc()))
            .send({ code: "rate_limit_daily", message: "Daily AI limit reached — upgrade to Premium for unlimited access" });
        }
      }

      const { query } = request.body;

      const posts = await retrieveRelevantPosts(prisma, query);
      const result = await generateAiAnswer(query, posts);

      if (!isPremium) {
        await incrementDailyUsage(userId);
      }

      return reply.status(200).send(result);
    }
  );

  app.get(
    "/ai/usage",
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ["AI"],
        summary: "Get today's AI usage for the current user",
        description:
          "Returns how many AI queries the user has made today and the daily limit. Both fields are null for premium users (unlimited).",
        response: {
          200: {
            type: "object",
            properties: {
              used: { type: "number", nullable: true },
              limit: { type: "number", nullable: true },
            },
            required: ["used", "limit"],
          },
          401: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { userId } = request.user;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { subscription: { select: { status: true } } },
      });

      const isPremium = user?.subscription?.status === "premium";

      if (isPremium) {
        return reply.send({ used: null, limit: null });
      }

      const today = todayUtc();
      const log = await prisma.aiUsageLog.findUnique({
        where: { userId_date: { userId, date: today } },
        select: { count: true },
      });

      return reply.send({ used: log?.count ?? 0, limit: AI_DAILY_LIMIT });
    }
  );
}
