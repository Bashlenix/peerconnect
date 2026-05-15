export type PostCategory = "Academic" | "Social" | "Sport" | "Daily Life Support";

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface HealthResponse {
  status: "ok" | "error";
}

export interface AiSource {
  id: string;
  content: string;
  category: string;
  author: { firstName: string | null; lastName: string | null };
}

export interface AiAskRequest {
  query: string;
}

export interface AiAskResponse {
  answer: string | null;
  sources: AiSource[];
  confidence: "high" | "low" | "none";
}
