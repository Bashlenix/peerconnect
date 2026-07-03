import type { ServiceErrorCode } from "@peerconnect/shared";

const BASE = "/api";

// Carries the backend's stable error `code` (e.g. "service_unavailable") so
// UI can branch on it instead of matching human-readable prose.
export class AuthError extends Error {
  code?: ServiceErrorCode;
  constructor(message: string, code?: ServiceErrorCode) {
    super(message);
    this.name = "AuthError";
    this.code = code;
  }
}

// Maps an auth request failure to a message safe to show the user, giving the
// DB-still-starting case a friendly, actionable line.
export function authErrorMessage(err: unknown): string {
  if (err instanceof AuthError && err.code === "service_unavailable") {
    return "PeerConnect is starting up. Please try again in a moment.";
  }
  return err instanceof Error ? err.message : "Something went wrong. Please try again.";
}

export interface RegisterResponse {
  message: string;
}

export interface VerifyEmailResponse {
  message: string;
}

export interface Subscription {
  status: "free" | "premium";
  startDate: string;
  endDate: string | null;
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isVerified: boolean;
  subscription: Subscription | null;
}

export interface LoginResponse {
  user: Omit<AuthUser, "isVerified">;
}

export interface MeResponse {
  user: AuthUser;
}

export async function register(email: string, password: string): Promise<RegisterResponse> {
  const res = await fetch(`${BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });

  const data = (await res.json()) as RegisterResponse & {
    message?: string;
    code?: ServiceErrorCode;
  };

  if (!res.ok) {
    throw new AuthError(data.message ?? "Registration failed", data.code);
  }

  return data;
}

export async function verifyEmail(token: string): Promise<VerifyEmailResponse> {
  const res = await fetch(`${BASE}/auth/verify-email?token=${encodeURIComponent(token)}`, {
    credentials: "include",
  });

  const data = (await res.json()) as VerifyEmailResponse & { message: string };

  if (!res.ok) {
    throw new Error(data.message ?? "Verification failed");
  }

  return data;
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });

  const data = (await res.json()) as LoginResponse & {
    message?: string;
    code?: ServiceErrorCode;
  };

  if (!res.ok) {
    throw new AuthError(data.message ?? "Login failed", data.code);
  }

  return data;
}

export async function logout(): Promise<void> {
  await fetch(`${BASE}/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
}

export async function getMe(): Promise<MeResponse> {
  const res = await fetch(`${BASE}/auth/me`, {
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error("Unauthorized");
  }

  return res.json() as Promise<MeResponse>;
}
