import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { register, verifyEmail, login, verifyRefreshToken, logout } from "../modules/auth-service.js";
import { setAccessTokenCookie, setRefreshTokenCookie, clearAuthCookies } from "../modules/token-service.js";

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
            },
            required: ["message"],
          },
          409: {
            type: "object",
            properties: { message: { type: "string" } },
            required: ["message"],
          },
          422: {
            type: "object",
            properties: { message: { type: "string" } },
            required: ["message"],
          },
        },
      },
    },
    async (request, reply) => {
      const { email, password } = request.body;
      const result = await register(email, password);

      if (!result.ok) {
        if (result.reason === "email_taken") return reply.status(409).send({ message: "Email already registered" });
        return reply.status(422).send({ message: "Only university email addresses are allowed." });
      }

      return reply.status(201).send({ message: "Registration successful. Please verify your email." });
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
      const result = await verifyEmail(token);

      if (!result.ok) {
        const message = result.reason === "expired"
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
      const result = await login(email, password);

      if (!result.ok) {
        if (result.reason === "not_verified") return reply.status(403).send({ message: "Please verify your email before logging in" });
        return reply.status(401).send({ message: "Invalid email or password" });
      }

      const accessToken = app.jwt.sign({ userId: result.user.id, email: result.user.email }, { expiresIn: ACCESS_TOKEN_TTL });
      setAccessTokenCookie(reply, accessToken);
      setRefreshTokenCookie(reply, result.refreshToken);

      return reply.status(200).send({ user: result.user });
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
                  subscription: {
                    type: "object",
                    nullable: true,
                    properties: {
                      status: { type: "string", enum: ["free", "premium"] },
                      startDate: { type: "string", format: "date-time" },
                      endDate: { type: "string", format: "date-time", nullable: true },
                    },
                    required: ["status", "startDate", "endDate"],
                  },
                },
                required: ["id", "email", "isVerified", "subscription"],
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
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          isVerified: true,
          subscription: { select: { status: true, startDate: true, endDate: true } },
        },
      });

      if (!user) {
        clearAuthCookies(reply);
        return reply.status(401).send({ message: "Unauthorized" });
      }

      return reply.status(200).send({
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          isVerified: user.isVerified,
          subscription: user.subscription
            ? {
                status: user.subscription.status,
                startDate: user.subscription.startDate.toISOString(),
                endDate: user.subscription.endDate?.toISOString() ?? null,
              }
            : null,
        },
      });
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
      let userId: string | undefined;
      try {
        await request.jwtVerify();
        userId = request.user.userId;
      } catch { /* best-effort */ }

      await logout(userId, userId ? undefined : request.cookies["refresh_token"]);
      clearAuthCookies(reply);
      return reply.status(200).send({ message: "Logged out successfully" });
    }
  );
}
