import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { retrieveRelevantPosts } from "../modules/ai-retrieval.js";
import { generateAiAnswer } from "../modules/ai-answer.js";
import { checkUsage, incrementDailyUsage, getUsage } from "../modules/ai-usage.js";

interface AskBody {
  query: string;
  source?: "inline" | "ask";
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
      // Excluded from the general rate limiter — already governed by its
      // own per-user burst/daily quota in ai-usage.ts.
      config: { rateLimit: false },
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
            source: { type: "string", enum: ["inline", "ask"] },
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
      const { query, source } = request.body;

      const check = await checkUsage(userId, source);

      if ("denied" in check) {
        const code = check.denied === "burst" ? "rate_limit_burst" : "rate_limit_daily";
        const message = check.denied === "burst"
          ? "Too many requests — please wait a moment"
          : "Daily AI limit reached — upgrade to Premium for unlimited access";
        return reply.status(429).header("Retry-After", String(check.retryAfter)).send({ code, message });
      }

      const posts = await retrieveRelevantPosts(prisma, query);

      if (check.ftsOnly) {
        const confidence = posts.length >= 3 ? "high" : posts.length >= 1 ? "low" : "none";
        return reply.status(200).send({ answer: null, sources: posts, confidence });
      }

      const result = await generateAiAnswer(query, posts);
      if (check.shouldIncrement) await incrementDailyUsage(userId);
      return reply.status(200).send(result);
    }
  );

  app.get(
    "/ai/usage",
    {
      onRequest: [app.authenticate],
      // Same exclusion as /ai/ask above — no general-purpose quota needed
      // on top of ai-usage.ts's own limits.
      config: { rateLimit: false },
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
      return reply.send(await getUsage(userId));
    }
  );
}
