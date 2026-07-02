import crypto from "crypto";
import bcrypt from "bcrypt";
import nodemailer from "nodemailer";
import { prisma } from "../db.js";
import { validateEmailDomain } from "./domain-validator.js";

const BCRYPT_ROUNDS = 12;
const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000;
const REFRESH_EXPIRY_DAYS = 7;

export type RegisterResult =
  | { ok: true }
  | { ok: false; reason: "email_taken" | "invalid_domain" };

export type VerifyEmailResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "invalid" | "expired" };

export type LoginResult =
  | { ok: true; refreshToken: string; user: { id: string; email: string; firstName: string | null; lastName: string | null } }
  | { ok: false; reason: "not_found" | "wrong_password" | "not_verified" };

export async function register(email: string, password: string): Promise<RegisterResult> {
  const normalised = email.toLowerCase().trim();

  const existing = await prisma.user.findUnique({ where: { email: normalised }, select: { id: true } });
  if (existing) return { ok: false, reason: "email_taken" };

  const domainResult = await validateEmailDomain(normalised);
  if (!domainResult.valid) return { ok: false, reason: "invalid_domain" };

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await prisma.user.create({
    data: { email: normalised, passwordHash, universityId: domainResult.university.id, subscription: { create: {} } },
    select: { id: true },
  });

  const token = crypto.randomBytes(32).toString("hex");
  const expiry = new Date(Date.now() + TOKEN_EXPIRY_MS);
  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerificationToken: token, emailVerificationExpiry: expiry },
  });

  await sendVerificationEmail(normalised, token);

  return { ok: true };
}

export async function verifyEmail(token: string): Promise<VerifyEmailResult> {
  const user = await prisma.user.findFirst({
    where: { emailVerificationToken: token },
    select: { id: true, emailVerificationExpiry: true },
  });

  if (!user) return { ok: false, reason: "invalid" };
  if (!user.emailVerificationExpiry || user.emailVerificationExpiry < new Date()) {
    return { ok: false, reason: "expired" };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { isVerified: true, emailVerificationToken: null, emailVerificationExpiry: null },
  });

  return { ok: true, userId: user.id };
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const normalised = email.toLowerCase().trim();
  const user = await prisma.user.findUnique({
    where: { email: normalised },
    select: { id: true, email: true, passwordHash: true, isVerified: true, firstName: true, lastName: true },
  });

  if (!user) return { ok: false, reason: "not_found" };

  const passwordMatch = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatch) return { ok: false, reason: "wrong_password" };

  if (!user.isVerified) return { ok: false, reason: "not_verified" };

  const refreshToken = crypto.randomBytes(32).toString("hex");
  const refreshHash = crypto.createHash("sha256").update(refreshToken).digest("hex");
  const expiry = new Date(Date.now() + REFRESH_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  await prisma.user.update({
    where: { id: user.id },
    data: { refreshTokenHash: refreshHash, refreshTokenExpiry: expiry },
  });

  return { ok: true, refreshToken, user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName } };
}

export async function verifyRefreshToken(token: string): Promise<{ id: string; email: string } | null> {
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  return prisma.user.findFirst({
    where: { refreshTokenHash: hash, refreshTokenExpiry: { gt: new Date() } },
    select: { id: true, email: true },
  });
}

export async function logout(userId: string | undefined, refreshToken: string | undefined): Promise<void> {
  if (userId) {
    await prisma.user.update({ where: { id: userId }, data: { refreshTokenHash: null, refreshTokenExpiry: null } });
    return;
  }
  if (refreshToken) {
    const user = await verifyRefreshToken(refreshToken);
    if (user) {
      await prisma.user.update({ where: { id: user.id }, data: { refreshTokenHash: null, refreshTokenExpiry: null } });
    }
  }
}

async function sendVerificationEmail(email: string, token: string): Promise<void> {
  const frontendUrl = process.env["FRONTEND_URL"] ?? "http://localhost:5173";
  const verifyUrl = `${frontendUrl}/verify-email?token=${token}`;
  const transporter = nodemailer.createTransport({
    host: process.env["SMTP_HOST"] ?? "smtp.resend.com",
    port: parseInt(process.env["SMTP_PORT"] ?? "587"),
    auth: { user: process.env["SMTP_USER"] ?? "resend", pass: process.env["SMTP_PASS"] ?? "" },
  });
  await transporter.sendMail({
    from: process.env["EMAIL_FROM"] ?? "noreply@peerconnect.de",
    to: email,
    subject: "Verify your PeerConnect account",
    text: `Welcome to PeerConnect!\n\nVerify your email: ${verifyUrl}\n\nThis link expires in 24 hours.`,
    html: `<p>Welcome to PeerConnect!</p><p><a href="${verifyUrl}">Click here to verify your email</a></p><p>This link expires in 24 hours.</p>`,
  });
}
