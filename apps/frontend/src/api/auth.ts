const BASE = "/api";

export interface RegisterResponse {
  message: string;
  requiresManualReview: boolean;
}

export interface VerifyEmailResponse {
  message: string;
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
