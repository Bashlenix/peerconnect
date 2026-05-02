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
import {
  generateRefreshToken,
  saveRefreshToken,
  verifyRefreshToken,
  clearRefreshToken,
  setAccessTokenCookie,
  setRefreshTokenCookie,
  clearAuthCookies,
} from "../modules/token-service.js";

const BCRYPT_ROUNDS = 12;
const ACCESS_TOKEN_TTL = "15m";

interface RegisterBody {
  email: string;
  password: string;
}

interface LoginBody {
  email: string;
  password: string;
}

interface VerifyEmailQuery {
  token: string;
}

export async function authRoute(app: FastifyInstance) {
  // ─── POST /auth/register ──────────────────────────────────────────────────

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

  // ─── GET /auth/verify-email ───────────────────────────────────────────────

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

  // ─── POST /auth/login ─────────────────────────────────────────────────────

  app.post<{ Body: LoginBody }>(
    "/auth/login",
    {
      schema: {
        tags: ["Auth"],
        summary: "Login with email and password",
        body: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              user: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  email: { type: "string" },
                  firstName: { type: "string", nullable: true },
                  lastName: { type: "string", nullable: true },
                },
                required: ["id", "email"],
              },
            },
            required: ["user"],
          },
          401: {
            type: "object",
            properties: { message: { type: "string" } },
            required: ["message"],
          },
          403: {
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

      const user = await prisma.user.findUnique({
        where: { email: normalised },
        select: { id: true, email: true, passwordHash: true, isVerified: true, firstName: true, lastName: true },
      });

      if (!user) {
        return reply.status(401).send({ message: "Invalid email or password" });
      }

      const passwordMatch = await bcrypt.compare(password, user.passwordHash);
      if (!passwordMatch) {
        return reply.status(401).send({ message: "Invalid email or password" });
      }

      if (!user.isVerified) {
        return reply.status(403).send({ message: "Please verify your email before logging in" });
      }

      const accessToken = app.jwt.sign({ userId: user.id, email: user.email }, { expiresIn: ACCESS_TOKEN_TTL });
      const refreshToken = generateRefreshToken();
      await saveRefreshToken(user.id, refreshToken);

      setAccessTokenCookie(reply, accessToken);
      setRefreshTokenCookie(reply, refreshToken);

      return reply.status(200).send({
        user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName },
      });
    }
  );

  // ─── GET /auth/me ─────────────────────────────────────────────────────────

  app.get(
    "/auth/me",
    {
      schema: {
        tags: ["Auth"],
        summary: "Get current authenticated user",
        response: {
          200: {
            type: "object",
            properties: {
              user: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  email: { type: "string" },
                  firstName: { type: "string", nullable: true },
                  lastName: { type: "string", nullable: true },
                  isVerified: { type: "boolean" },
                },
                required: ["id", "email", "isVerified"],
              },
            },
            required: ["user"],
          },
          401: {
            type: "object",
            properties: { message: { type: "string" } },
            required: ["message"],
          },
        },
      },
    },
    async (request, reply) => {
      let userId: string;

      try {
        await request.jwtVerify();
        userId = request.user.userId;
      } catch {
        // Access token invalid/absent — try refresh token
        const refreshToken = request.cookies["refresh_token"];
        if (!refreshToken) {
          return reply.status(401).send({ message: "Unauthorized" });
        }

        const refreshUser = await verifyRefreshToken(refreshToken);
        if (!refreshUser) {
          clearAuthCookies(reply);
          return reply.status(401).send({ message: "Unauthorized" });
        }

        userId = refreshUser.id;
        const newAccessToken = app.jwt.sign(
          { userId: refreshUser.id, email: refreshUser.email },
          { expiresIn: ACCESS_TOKEN_TTL }
        );
        setAccessTokenCookie(reply, newAccessToken);
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, firstName: true, lastName: true, isVerified: true },
      });

      if (!user) {
        clearAuthCookies(reply);
        return reply.status(401).send({ message: "Unauthorized" });
      }

      return reply.status(200).send({ user });
    }
  );

  // ─── POST /auth/logout ────────────────────────────────────────────────────

  app.post(
    "/auth/logout",
    {
      schema: {
        tags: ["Auth"],
        summary: "Logout and clear session",
        response: {
          200: {
            type: "object",
            properties: { message: { type: "string" } },
            required: ["message"],
          },
        },
      },
    },
    async (request, reply) => {
      // Best-effort: try to identify user and clear refresh token from DB
      try {
        await request.jwtVerify();
        await clearRefreshToken(request.user.userId);
      } catch {
        const refreshToken = request.cookies["refresh_token"];
        if (refreshToken) {
          const user = await verifyRefreshToken(refreshToken);
          if (user) {
            await clearRefreshToken(user.id);
          }
        }
      }

      clearAuthCookies(reply);
      return reply.status(200).send({ message: "Logged out successfully" });
    }
  );
}
