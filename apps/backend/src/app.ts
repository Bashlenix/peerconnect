import Fastify from "fastify";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUI from "@fastify/swagger-ui";
import { healthRoute } from "./routes/health.js";

export async function buildApp() {
  const app = Fastify({ logger: false });

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

  return app;
}
