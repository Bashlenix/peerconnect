import { createHash, randomBytes } from "node:crypto";
import type { FastifyReply } from "fastify";
import { prisma } from "../db.js";

const REFRESH_EXPIRY_DAYS = 7;
const ACCESS_EXPIRY_SECONDS = 15 * 60;
const REFRESH_EXPIRY_SECONDS = REFRESH_EXPIRY_DAYS * 24 * 60 * 60;

const isProd = process.env["NODE_ENV"] === "production";

const COOKIE_BASE = {
  httpOnly: true,
  sameSite: "strict" as const,
  secure: isProd,
  path: "/",
};

export function generateRefreshToken(): string {
  return randomBytes(32).toString("hex");
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function saveRefreshToken(userId: string, token: string): Promise<void> {
  const expiry = new Date(Date.now() + REFRESH_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  await prisma.user.update({
    where: { id: userId },
    data: { refreshTokenHash: hashToken(token), refreshTokenExpiry: expiry },
  });
}

export async function verifyRefreshToken(
  token: string
): Promise<{ id: string; email: string } | null> {
  const hash = hashToken(token);
  const user = await prisma.user.findFirst({
    where: { refreshTokenHash: hash, refreshTokenExpiry: { gt: new Date() } },
    select: { id: true, email: true },
  });
  return user;
}

export async function clearRefreshToken(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { refreshTokenHash: null, refreshTokenExpiry: null },
  });
}

export function setAccessTokenCookie(reply: FastifyReply, token: string): void {
  reply.setCookie("access_token", token, {
    ...COOKIE_BASE,
    maxAge: ACCESS_EXPIRY_SECONDS,
  });
}

export function setRefreshTokenCookie(reply: FastifyReply, token: string): void {
  reply.setCookie("refresh_token", token, {
    ...COOKIE_BASE,
    maxAge: REFRESH_EXPIRY_SECONDS,
  });
}

export function clearAuthCookies(reply: FastifyReply): void {
  reply.clearCookie("access_token", { path: "/" });
  reply.clearCookie("refresh_token", { path: "/" });
}
