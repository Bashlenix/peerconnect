const BASE = "/api";

export type NotificationType =
  | "NEW_POST_IN_CATEGORY"
  | "REPLY_TO_POST"
  | "REPLY_UPVOTED"
  | "REPLY_MARKED_SOLUTION"
  | "BADGE_AWARDED";

export interface Notification {
  id: string;
  type: NotificationType;
  postId: string | null;
  replyId: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface GetNotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
}

export async function getNotifications(params?: {
  limit?: number;
  offset?: number;
}): Promise<GetNotificationsResponse> {
  const query = new URLSearchParams();
  if (params?.limit != null) query.set("limit", String(params.limit));
  if (params?.offset != null) query.set("offset", String(params.offset));
  const url = `${BASE}/notifications${query.size > 0 ? `?${query}` : ""}`;
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) {
    const data = (await res.json()) as { message?: string };
    throw new Error(data.message ?? "Failed to fetch notifications");
  }
  return res.json() as Promise<GetNotificationsResponse>;
}

export async function markNotificationRead(id: string): Promise<Notification> {
  const res = await fetch(`${BASE}/notifications/${id}/read`, {
    method: "PATCH",
    credentials: "include",
  });
  if (!res.ok) {
    const data = (await res.json()) as { message?: string };
    throw new Error(data.message ?? "Failed to mark notification as read");
  }
  return res.json() as Promise<Notification>;
}

export async function markAllNotificationsRead(): Promise<void> {
  const res = await fetch(`${BASE}/notifications/read-all`, {
    method: "PATCH",
    credentials: "include",
  });
  if (!res.ok) {
    const data = (await res.json()) as { message?: string };
    throw new Error(data.message ?? "Failed to mark all notifications as read");
  }
}
