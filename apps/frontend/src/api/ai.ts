import type { AiAskResponse } from "@peerconnect/shared";

const BASE = "/api";

export async function askAI(query: string): Promise<AiAskResponse> {
  const res = await fetch(`${BASE}/ai/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ query }),
  });

  const data = (await res.json()) as AiAskResponse & { message?: string };

  if (!res.ok) {
    throw new Error((data as { message?: string }).message ?? "Failed to get AI answer");
  }

  return data;
}
