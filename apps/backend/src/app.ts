import Fastify from "fastify";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUI from "@fastify/swagger-ui";
import fastifyCors from "@fastify/cors";
import fastifyCookie from "@fastify/cookie";
import fastifyJwt from "@fastify/jwt";
import type { FastifyRequest, FastifyReply } from "fastify";
import type { ServiceErrorResponse } from "@peerconnect/shared";
import { isDatabaseUnavailableError } from "./modules/db-errors.js";
import { healthRoute } from "./routes/health.js";
import { authRoute } from "./routes/auth.js";
import { postsRoute } from "./routes/posts.js";
import { repliesRoute } from "./routes/replies.js";
import { usersRoute } from "./routes/users.js";
import { notificationsRoute } from "./routes/notifications.js";
import { adsRoute } from "./routes/ads.js";
import { aiRoute } from "./routes/ai.js";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { userId: string; email: string };
    user: { userId: string; email: string };
  }
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void>;
  }
}

export async function buildApp() {
  const app = Fastify({ logger: false });

  await app.register(fastifyCors, {
    origin: process.env["FRONTEND_URL"] ?? "http://localhost:5173",
    credentials: true,
  });

  await app.register(fastifyCookie);

  await app.register(fastifyJwt, {
    secret: process.env["JWT_SECRET"] ?? "dev-secret-change-in-production",
    cookie: { cookieName: "access_token", signed: false },
  });

  app.decorate("authenticate", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch {
      reply.status(401).send({ message: "Unauthorized" });
    }
  });

  // Turn transient "can't reach the database" failures into a clean 503 with a
  // stable code so clients can show a friendly retry message instead of an
  // opaque Prisma stack trace. Everything else falls through to Fastify's
  // default error handling (preserving validation 400s, explicit statuses, etc).
  app.setErrorHandler((error, request, reply) => {
    if (isDatabaseUnavailableError(error)) {
      request.log.error(error, "database unavailable");
      const body: ServiceErrorResponse = {
        code: "service_unavailable",
        message:
          "PeerConnect is temporarily unavailable while the database starts up. Please try again in a moment.",
      };
      return reply.status(503).send(body);
    }
    return reply.send(error);
  });

  await app.register(fastifySwagger, {
    openapi: {
      info: {
        title: "PeerConnect API",
        description: "PeerConnect DIT — University Q&A Platform API",
        version: "1.0.0",
      },
    },
  });

  await app.register(fastifySwaggerUI, {
    routePrefix: "/docs",
  });

  await app.register(healthRoute);
  await app.register(authRoute);
  await app.register(postsRoute);
  await app.register(repliesRoute);
  await app.register(usersRoute);
  await app.register(notificationsRoute);
  await app.register(adsRoute);
  await app.register(aiRoute);

  return app;
}
