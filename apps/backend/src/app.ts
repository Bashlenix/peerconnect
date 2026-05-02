import Fastify from "fastify";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUI from "@fastify/swagger-ui";
import fastifyCors from "@fastify/cors";
import { healthRoute } from "./routes/health.js";
import { authRoute } from "./routes/auth.js";

export async function buildApp() {
  const app = Fastify({ logger: false });

  await app.register(fastifyCors, {
    origin: process.env["FRONTEND_URL"] ?? "http://localhost:5173",
    credentials: true,
  });

  await app.register(fastifySwagger, {
    openapi: {
      info: {
        title: "PeerConnect API",
        description: "PeerConnect DIT — University Q&A Platform API",
        version: "1.0.0"
      }
    }
  });

  await app.register(fastifySwaggerUI, {
    routePrefix: "/docs"
  });

  await app.register(healthRoute);
  await app.register(authRoute);

  return app;
}
