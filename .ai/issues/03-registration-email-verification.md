# Issue 03 — Student Registration & Email Verification

**Type:** AFK
**Label:** needs-triage

## What to build

End-to-end student registration flow: a user submits their university email and password, the `DomainValidator` module checks the domain against the `universities` table, the `EmailVerificationService` sends a confirmation email, and the user clicks the link to activate their account. Users with unrecognised domains are flagged with `requires_manual_review = true` rather than hard-rejected.

Deliver the two deep modules (`DomainValidator`, `EmailVerificationService`) with full unit tests, the backend registration and verify-email endpoints, and the frontend registration + "check your email" pages.

## Acceptance criteria

- [ ] `DomainValidator` returns `{ valid: true, university }` for a known active domain and `{ valid: false }` for unknown or inactive domains
- [ ] `DomainValidator` unit tests cover: valid domain, invalid domain, inactive domain, malformed email, subdomain variant
- [ ] `EmailVerificationService` generates a unique signed token, persists it on the user record, and sends a verification email via Nodemailer (Resend SMTP)
- [ ] `EmailVerificationService` unit tests cover: token uniqueness, token expiry, valid confirmation, invalid token rejection, expired token rejection
- [ ] `POST /auth/register` creates an unverified user; sets `requires_manual_review = true` for unrecognised domains
- [ ] `GET /auth/verify-email?token=...` activates the account on valid token; returns a clear error on invalid/expired token
- [ ] Frontend registration form collects email + password and submits to the backend
- [ ] Frontend shows a "check your email" confirmation screen after successful registration
- [ ] Frontend shows a success screen when the verification link is clicked

## Blocked by

- Issue 02 — Database Schema & Prisma Setup
