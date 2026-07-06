import pino from "pino";

const isProd = process.env["NODE_ENV"] === "production";
const isTest = process.env["NODE_ENV"] === "test";

// Never let auth cookies, bearer tokens, or raw passwords land in log output —
// req/res shapes here match Fastify's default pino request/response serializers.
export const redactConfig = {
  paths: [
    "req.headers.cookie",
    "req.headers.authorization",
    "req.body.password",
    'res.headers["set-cookie"]',
  ],
  remove: true,
};

export const logger = pino({
  level: isTest ? "silent" : "info",
  redact: redactConfig,
  transport: isProd || isTest ? undefined : { target: "pino-pretty" },
});
