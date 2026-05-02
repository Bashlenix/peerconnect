import crypto from "crypto";
import nodemailer from "nodemailer";
import { prisma } from "../db.js";

const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

export function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function saveToken(userId: string, token: string): Promise<Date> {
  const expiry = new Date(Date.now() + TOKEN_EXPIRY_MS);
  await prisma.user.update({
    where: { id: userId },
    data: { emailVerificationToken: token, emailVerificationExpiry: expiry },
  });
  return expiry;
}

export async function sendVerificationEmail(
  email: string,
  token: string,
  transporter?: nodemailer.Transporter
): Promise<void> {
  const t = transporter ?? createTransporter();
  const frontendUrl = process.env["FRONTEND_URL"] ?? "http://localhost:5173";
  const verifyUrl = `${frontendUrl}/verify-email?token=${token}`;

  await t.sendMail({
    from: process.env["EMAIL_FROM"] ?? "noreply@peerconnect.de",
    to: email,
    subject: "Verify your PeerConnect account",
    text: `Welcome to PeerConnect!\n\nVerify your email: ${verifyUrl}\n\nThis link expires in 24 hours.`,
    html: `<p>Welcome to PeerConnect!</p><p><a href="${verifyUrl}">Click here to verify your email</a></p><p>This link expires in 24 hours.</p>`,
  });
}

export async function confirmEmail(
  token: string
): Promise<
  | { success: true; userId: string }
  | { success: false; reason: "invalid" | "expired" }
> {
  const user = await prisma.user.findFirst({
    where: { emailVerificationToken: token },
    select: { id: true, emailVerificationExpiry: true },
  });

  if (!user) return { success: false, reason: "invalid" };

  if (!user.emailVerificationExpiry || user.emailVerificationExpiry < new Date()) {
    return { success: false, reason: "expired" };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      isVerified: true,
      emailVerificationToken: null,
      emailVerificationExpiry: null,
    },
  });

  return { success: true, userId: user.id };
}

function createTransporter(): nodemailer.Transporter {
  return nodemailer.createTransport({
    host: process.env["SMTP_HOST"] ?? "smtp.resend.com",
    port: parseInt(process.env["SMTP_PORT"] ?? "587"),
    auth: {
      user: process.env["SMTP_USER"] ?? "resend",
      pass: process.env["SMTP_PASS"] ?? "",
    },
  });
}
