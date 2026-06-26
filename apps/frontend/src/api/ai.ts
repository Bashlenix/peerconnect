import type { AiAskResponse, AiErrorCode } from "@peerconnect/shared";

const BASE = "/api";

export class AiError extends Error {
  code?: AiErrorCode;
  constructor(message: string, code?: AiErrorCode) {
    super(message);
    this.code = code;
  }
}

export async function askAI(query: string): Promise<AiAskResponse> {
  const res = await fetch(`${BASE}/ai/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ query }),
  });

  const data = (await res.json()) as AiAskResponse & { message?: string; code?: AiErrorCode };

  if (!res.ok) {
    throw new AiError(data.message ?? "Failed to get AI answer", data.code);
  }

  return data;
}

export interface AiUsage {
  used: number | null;
  limit: number | null;
}

export async function getAiUsage(): Promise<AiUsage> {
  const res = await fetch(`${BASE}/ai/usage`, {
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error("Failed to get AI usage");
  }

  return res.json() as Promise<AiUsage>;
}
