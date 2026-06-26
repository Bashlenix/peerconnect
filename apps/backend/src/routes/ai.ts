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

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry || now >= entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT) return false;

  entry.count++;
  return true;
}

function todayUtc(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

async function checkAndIncrementDailyUsage(
  userId: string,
): Promise<{ allowed: boolean; used: number; limit: number }> {
  const date = todayUtc();

  const existing = await prisma.aiUsageLog.findUnique({
    where: { userId_date: { userId, date } },
    select: { count: true },
  });

  if (existing && existing.count >= AI_DAILY_LIMIT) {
    return { allowed: false, used: existing.count, limit: AI_DAILY_LIMIT };
  }

  const log = await prisma.aiUsageLog.upsert({
    where: { userId_date: { userId, date } },
    update: { count: { increment: 1 } },
    create: { userId, date, count: 1 },
    select: { count: true },
  });

  return { allowed: true, used: log.count, limit: AI_DAILY_LIMIT };
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
          429: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { userId } = request.user;

      if (!checkRateLimit(userId)) {
        return reply.status(429).send({ message: "Too many requests — please wait a moment" });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { subscription: { select: { status: true } } },
      });

      const isPremium = user?.subscription?.status === "premium";

      if (!isPremium) {
        const { allowed } = await checkAndIncrementDailyUsage(userId);
        if (!allowed) {
          return reply
            .status(429)
            .send({ message: "Daily AI limit reached — upgrade to Premium for unlimited access" });
        }
      }

      const { query } = request.body;

      const posts = await retrieveRelevantPosts(prisma, query);
      const result = await generateAiAnswer(query, posts);

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
