import nodemailer from "nodemailer";

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env["SMTP_HOST"] ?? "smtp.resend.com",
    port: parseInt(process.env["SMTP_PORT"] ?? "587"),
    auth: { user: process.env["SMTP_USER"] ?? "resend", pass: process.env["SMTP_PASS"] ?? "" },
  });
}

export async function sendMail(to: string, subject: string, text: string, html: string): Promise<void> {
  const transporter = createTransporter();
  await transporter.sendMail({
    from: process.env["EMAIL_FROM"] ?? "noreply@peerconnect.de",
    to,
    subject,
    text,
    html,
  });
}
