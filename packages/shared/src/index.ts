export type PostCategory = "Academic" | "Social" | "Sport" | "Daily Life Support";

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface HealthResponse {
  status: "ok" | "error";
}
