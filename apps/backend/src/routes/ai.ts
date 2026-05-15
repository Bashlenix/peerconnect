import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { retrieveRelevantPosts } from "../modules/ai-retrieval.js";
import { generateAiAnswer } from "../modules/ai-answer.js";

interface AskBody {
  query: string;
}

// In-memory rate limit: max 10 requests per user per 60 seconds
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
const WINDOW_MS = 60_000;

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
          "Searches existing posts and synthesises an answer using GPT-4.1 nano. Only answers from retrieved peer posts — never from outside knowledge.",
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

      const { query } = request.body;

      const posts = await retrieveRelevantPosts(prisma, query);
      const result = await generateAiAnswer(query, posts);

      return reply.status(200).send(result);
    }
  );
}
