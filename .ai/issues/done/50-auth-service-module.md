# 50 — Extract auth service module

**Type:** AFK  
**Labels:** enhancement, done  
**Blocked by:** None

## What to build

Absorb register, verifyEmail, login, verifyRefreshToken, and logout DB and crypto logic into a single `auth-service.ts` module. Delete `email-verification-service.ts` (fully absorbed). Keep `token-service.ts` for HTTP cookie helpers only. Route handlers become thin orchestrators with no bcrypt, crypto, or Prisma calls.

## Acceptance criteria

- [ ] `auth-service.ts` exports `register`, `verifyEmail`, `login`, `verifyRefreshToken`, `logout` with discriminated-union return types (`RegisterResult`, `VerifyEmailResult`, `LoginResult`)
- [ ] `email-verification-service.ts` is deleted
- [ ] `token-service.ts` retains only `setAccessTokenCookie`, `setRefreshTokenCookie`, `clearAuthCookies`
- [ ] Auth route handlers contain no `bcrypt`, `crypto`, or direct Prisma calls
- [ ] TypeScript compiles clean with no errors
