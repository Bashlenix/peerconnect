import crypto from "crypto";
import bcrypt from "bcrypt";
import { prisma } from "../db.js";
import { validateEmailDomain } from "./domain-validator.js";
import { sendMail } from "./mailer.js";

const BCRYPT_ROUNDS = 12;
const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000;
const REFRESH_EXPIRY_DAYS = 7;
const PASSWORD_RESET_EXPIRY_MS = 60 * 60 * 1000;
const PASSWORD_RESET_COOLDOWN_MS = 60 * 1000;

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export type RegisterResult =
  | { ok: true }
  | { ok: false; reason: "email_taken" | "invalid_domain" };

export type VerifyEmailResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "invalid" | "expired" };

export type LoginResult =
  | { ok: true; refreshToken: string; user: { id: string; email: string; firstName: string | null; lastName: string | null } }
  | { ok: false; reason: "not_found" | "wrong_password" | "not_verified" };

export type ResetPasswordResult = { ok: true } | { ok: false; reason: "invalid" | "expired" };

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  studyProgramme?: string;
  semester?: number;
  languages?: string[];
  subscriptionStatus?: "free" | "premium";
}

export async function register(input: RegisterInput): Promise<RegisterResult> {
  const { email, password, firstName, lastName, studyProgramme, semester, languages, subscriptionStatus } = input;
  const normalised = email.toLowerCase().trim();

  const existing = await prisma.user.findUnique({ where: { email: normalised }, select: { id: true } });
  if (existing) return { ok: false, reason: "email_taken" };

  const domainResult = await validateEmailDomain(normalised);
  if (!domainResult.valid) return { ok: false, reason: "invalid_domain" };

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await prisma.user.create({
    data: {
      email: normalised,
      passwordHash,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      ...(studyProgramme !== undefined && { studyProgramme }),
      ...(semester !== undefined && { semester }),
      ...(languages !== undefined && { languages }),
      universityId: domainResult.university.id,
      subscription: { create: { ...(subscriptionStatus !== undefined && { status: subscriptionStatus }) } },
    },
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
  await sendMail(
    email,
    "Verify your PeerConnect account",
    `Welcome to PeerConnect!\n\nVerify your email: ${verifyUrl}\n\nThis link expires in 24 hours.`,
    `<p>Welcome to PeerConnect!</p><p><a href="${verifyUrl}">Click here to verify your email</a></p><p>This link expires in 24 hours.</p>`
  );
}

async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  const frontendUrl = process.env["FRONTEND_URL"] ?? "http://localhost:5173";
  const resetUrl = `${frontendUrl}/reset-password?token=${token}`;
  await sendMail(
    email,
    "Reset your PeerConnect password",
    `We received a request to reset your PeerConnect password.\n\nReset it here: ${resetUrl}\n\nThis link expires in 1 hour. If you didn't request this, you can safely ignore this email.`,
    `<p>We received a request to reset your PeerConnect password.</p><p><a href="${resetUrl}">Click here to reset your password</a></p><p>This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>`
  );
}

export async function requestPasswordReset(email: string): Promise<void> {
  const normalised = email.toLowerCase().trim();
  const user = await prisma.user.findUnique({
    where: { email: normalised },
    select: { id: true, passwordResetExpiry: true },
  });
  if (!user) return;

  if (user.passwordResetExpiry) {
    const requestedAt = user.passwordResetExpiry.getTime() - PASSWORD_RESET_EXPIRY_MS;
    if (Date.now() - requestedAt < PASSWORD_RESET_COOLDOWN_MS) return;
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiry = new Date(Date.now() + PASSWORD_RESET_EXPIRY_MS);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordResetTokenHash: hashToken(token), passwordResetExpiry: expiry },
  });

  await sendPasswordResetEmail(normalised, token);
}

async function sendPasswordChangedEmail(email: string): Promise<void> {
  await sendMail(
    email,
    "Your PeerConnect password was changed",
    `Your PeerConnect password was just changed. If this wasn't you, please contact support immediately.`,
    `<p>Your PeerConnect password was just changed.</p><p>If this wasn't you, please contact support immediately.</p>`
  );
}

export async function validateResetToken(token: string): Promise<boolean> {
  const user = await prisma.user.findFirst({
    where: { passwordResetTokenHash: hashToken(token) },
    select: { passwordResetExpiry: true },
  });
  return !!user?.passwordResetExpiry && user.passwordResetExpiry > new Date();
}

export async function resetPassword(token: string, newPassword: string): Promise<ResetPasswordResult> {
  const user = await prisma.user.findFirst({
    where: { passwordResetTokenHash: hashToken(token) },
    select: { id: true, email: true, passwordResetExpiry: true },
  });

  if (!user) return { ok: false, reason: "invalid" };
  if (!user.passwordResetExpiry || user.passwordResetExpiry < new Date()) {
    return { ok: false, reason: "expired" };
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      passwordResetTokenHash: null,
      passwordResetExpiry: null,
      refreshTokenHash: null,
      refreshTokenExpiry: null,
    },
  });

  await sendPasswordChangedEmail(user.email);

  return { ok: true };
}
