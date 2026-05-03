import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";

const adSchema = {
  type: "object" as const,
  properties: {
    id: { type: "string" },
    title: { type: "string" },
    body: { type: "string" },
    imageUrl: { type: "string", nullable: true },
    linkUrl: { type: "string" },
    advertiserName: { type: "string" },
  },
  required: ["id", "title", "body", "imageUrl", "linkUrl", "advertiserName"],
};

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

export async function adsRoute(app: FastifyInstance) {
  app.get("/ads", {
    onRequest: [app.authenticate],
    schema: {
      tags: ["Ads"],
      summary: "Get active ads (empty for premium users)",
      response: {
        200: {
          type: "object",
          properties: {
            ads: { type: "array", items: adSchema },
          },
          required: ["ads"],
        },
        401: {
          type: "object",
          properties: { message: { type: "string" } },
          required: ["message"],
        },
      },
    },
  }, async (request, reply) => {
    const { userId } = request.user;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { subscription: { select: { status: true } } },
    });

    if (user?.subscription?.status === "premium") {
      return reply.send({ ads: [] });
    }

    const now = new Date();
    const ads = await prisma.ad.findMany({
      where: {
        isActive: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
      select: {
        id: true,
        title: true,
        body: true,
        imageUrl: true,
        linkUrl: true,
        advertiserName: true,
      },
    });

    return reply.send({ ads: shuffle(ads) });
  });
}
