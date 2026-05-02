import type { FastifyInstance } from "fastify";
import type { HealthResponse } from "@peerconnect/shared";

export async function healthRoute(app: FastifyInstance) {
  app.get<{ Reply: HealthResponse }>(
    "/health",
    {
      schema: {
        tags: ["System"],
        summary: "Health check",
        response: {
          200: {
            type: "object",
            properties: {
              status: { type: "string", enum: ["ok", "error"] }
            },
            required: ["status"]
          }
        }
      }
    },
    async () => {
      return { status: "ok" };
    }
  );
}
