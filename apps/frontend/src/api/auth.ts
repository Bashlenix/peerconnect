const BASE = "/api";

export interface RegisterResponse {
  message: string;
  requiresManualReview: boolean;
}

export interface VerifyEmailResponse {
  message: string;
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isVerified: boolean;
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

  const data = (await res.json()) as RegisterResponse & { message: string };

  if (!res.ok) {
    throw new Error(data.message ?? "Registration failed");
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

  const data = (await res.json()) as LoginResponse & { message: string };

  if (!res.ok) {
    throw new Error(data.message ?? "Login failed");
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
