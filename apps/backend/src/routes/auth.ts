import type { FastifyInstance } from "fastify";
import bcrypt from "bcrypt";
import { prisma } from "../db.js";
import { validateEmailDomain } from "../modules/domain-validator.js";
import {
  generateToken,
  saveToken,
  sendVerificationEmail,
  confirmEmail,
} from "../modules/email-verification-service.js";

const BCRYPT_ROUNDS = 12;

interface RegisterBody {
  email: string;
  password: string;
}

interface VerifyEmailQuery {
  token: string;
}

export async function authRoute(app: FastifyInstance) {
  app.post<{ Body: RegisterBody }>(
    "/auth/register",
    {
      schema: {
        tags: ["Auth"],
        summary: "Register a new student account",
        body: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 8 },
          },
        },
        response: {
          201: {
            type: "object",
            properties: {
              message: { type: "string" },
              requiresManualReview: { type: "boolean" },
            },
            required: ["message", "requiresManualReview"],
          },
          409: {
            type: "object",
            properties: { message: { type: "string" } },
            required: ["message"],
          },
        },
      },
    },
    async (request, reply) => {
      const { email, password } = request.body;
      const normalised = email.toLowerCase().trim();

      const existing = await prisma.user.findUnique({
        where: { email: normalised },
        select: { id: true },
      });
      if (existing) {
        return reply.status(409).send({ message: "Email already registered" });
      }

      const domainResult = await validateEmailDomain(normalised);
      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

      const user = await prisma.user.create({
        data: {
          email: normalised,
          passwordHash,
          universityId: domainResult.valid ? domainResult.university.id : null,
          requiresManualReview: !domainResult.valid,
        },
        select: { id: true, requiresManualReview: true },
      });

      const token = generateToken();
      await saveToken(user.id, token);
      await sendVerificationEmail(normalised, token);

      return reply.status(201).send({
        message: "Registration successful. Please verify your email.",
        requiresManualReview: user.requiresManualReview,
      });
    }
  );

  app.get<{ Querystring: VerifyEmailQuery }>(
    "/auth/verify-email",
    {
      schema: {
        tags: ["Auth"],
        summary: "Verify email address using token",
        querystring: {
          type: "object",
          required: ["token"],
          properties: {
            token: { type: "string" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: { message: { type: "string" } },
            required: ["message"],
          },
          400: {
            type: "object",
            properties: { message: { type: "string" } },
            required: ["message"],
          },
        },
      },
    },
    async (request, reply) => {
      const { token } = request.query;

      const result = await confirmEmail(token);

      if (!result.success) {
        const message =
          result.reason === "expired"
            ? "Verification link has expired. Please request a new one."
            : "Invalid verification token.";
        return reply.status(400).send({ message });
      }

      return reply.status(200).send({ message: "Email verified successfully." });
    }
  );
}
