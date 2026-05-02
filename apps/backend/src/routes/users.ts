import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import type { PostCategory } from "../generated/prisma/client.js";

const VALID_CATEGORIES: PostCategory[] = ["Academic", "Social", "Sport", "DailyLifeSupport"];

interface UserIdParams {
  id: string;
}

interface PatchMeBody {
  firstName?: string;
  lastName?: string;
  studyProgramme?: string;
  semester?: number;
  languages?: string[];
}

interface PutNotificationPreferencesBody {
  categories: string[];
}

const badgeSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    description: { type: "string" },
    awardedAt: { type: "string", format: "date-time" },
  },
  required: ["name", "description", "awardedAt"],
};

const publicProfileSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    firstName: { type: "string", nullable: true },
    lastName: { type: "string", nullable: true },
    studyProgramme: { type: "string", nullable: true },
    semester: { type: "integer", nullable: true },
    languages: { type: "array", items: { type: "string" } },
    replyCount: { type: "integer" },
    solutionCount: { type: "integer" },
    badges: { type: "array", items: badgeSchema },
  },
  required: ["id", "languages", "replyCount", "solutionCount", "badges"],
};

const ownProfileSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    email: { type: "string" },
    firstName: { type: "string", nullable: true },
    lastName: { type: "string", nullable: true },
    studyProgramme: { type: "string", nullable: true },
    semester: { type: "integer", nullable: true },
    languages: { type: "array", items: { type: "string" } },
  },
  required: ["id", "email", "languages"],
};

const errorSchema = {
  type: "object",
  properties: { message: { type: "string" } },
  required: ["message"],
};

export async function usersRoute(app: FastifyInstance) {
  // ─── GET /users/:id ───────────────────────────────────────────────────────

  app.get<{ Params: UserIdParams }>(
    "/users/:id",
    {
      schema: {
        tags: ["Users"],
        summary: "Get public profile for a user",
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        response: {
          200: publicProfileSchema,
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          studyProgramme: true,
          semester: true,
          languages: true,
          _count: {
            select: {
              replies: true,
            },
          },
          replies: {
            where: { isSolution: true },
            select: { id: true },
          },
          userBadges: {
            select: {
              awardedAt: true,
              badge: { select: { name: true, description: true } },
            },
            orderBy: { awardedAt: "asc" },
          },
        },
      });

      if (!user) return reply.status(404).send({ message: "User not found" });

      return reply.status(200).send({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        studyProgramme: user.studyProgramme,
        semester: user.semester,
        languages: user.languages,
        replyCount: user._count.replies,
        solutionCount: user.replies.length,
        badges: user.userBadges.map((ub) => ({
          name: ub.badge.name,
          description: ub.badge.description,
          awardedAt: ub.awardedAt.toISOString(),
        })),
      });
    }
  );

  // ─── PATCH /users/me ──────────────────────────────────────────────────────

  app.patch<{ Body: PatchMeBody }>(
    "/users/me",
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ["Users"],
        summary: "Update the authenticated user's profile",
        body: {
          type: "object",
          properties: {
            firstName: { type: "string" },
            lastName: { type: "string" },
            studyProgramme: { type: "string" },
            semester: { type: "integer", minimum: 1 },
            languages: { type: "array", items: { type: "string" } },
          },
        },
        response: {
          200: ownProfileSchema,
          401: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = request.user.userId;
      const { firstName, lastName, studyProgramme, semester, languages } = request.body;

      const updated = await prisma.user.update({
        where: { id: userId },
        data: {
          ...(firstName !== undefined && { firstName }),
          ...(lastName !== undefined && { lastName }),
          ...(studyProgramme !== undefined && { studyProgramme }),
          ...(semester !== undefined && { semester }),
          ...(languages !== undefined && { languages }),
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          studyProgramme: true,
          semester: true,
          languages: true,
        },
      });

      return reply.status(200).send(updated);
    }
  );

  // ─── GET /users/me/notification-preferences ──────────────────────────────────

  app.get(
    "/users/me/notification-preferences",
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ["Users"],
        summary: "Get the authenticated user's notification category subscriptions",
        response: {
          200: {
            type: "object",
            properties: {
              categories: { type: "array", items: { type: "string" } },
            },
            required: ["categories"],
          },
          401: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = request.user.userId;

      const prefs = await prisma.notificationPreference.findMany({
        where: { userId },
        select: { category: true },
        orderBy: { category: "asc" },
      });

      return reply.status(200).send({ categories: prefs.map((p) => p.category) });
    }
  );

  // ─── PUT /users/me/notification-preferences ───────────────────────────────────

  app.put<{ Body: PutNotificationPreferencesBody }>(
    "/users/me/notification-preferences",
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ["Users"],
        summary: "Replace the authenticated user's notification category subscriptions",
        body: {
          type: "object",
          required: ["categories"],
          properties: {
            categories: {
              type: "array",
              items: { type: "string", enum: VALID_CATEGORIES },
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              categories: { type: "array", items: { type: "string" } },
            },
            required: ["categories"],
          },
          400: errorSchema,
          401: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = request.user.userId;
      const { categories } = request.body;

      const invalid = categories.filter((c) => !VALID_CATEGORIES.includes(c as PostCategory));
      if (invalid.length > 0) {
        return reply.status(400).send({ message: `Invalid categories: ${invalid.join(", ")}` });
      }

      const unique = [...new Set(categories)] as PostCategory[];

      await prisma.$transaction([
        prisma.notificationPreference.deleteMany({ where: { userId } }),
        prisma.notificationPreference.createMany({
          data: unique.map((category) => ({ userId, category })),
        }),
      ]);

      return reply.status(200).send({ categories: unique.sort() });
    }
  );
}
