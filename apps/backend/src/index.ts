import { buildApp } from "./app.js";
import { logger } from "./logger.js";

const app = await buildApp();

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? "0.0.0.0";

try {
  await app.listen({ port, host });
  logger.info(`Backend running on http://localhost:${port}`);
  logger.info(`API docs available at http://localhost:${port}/docs`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
