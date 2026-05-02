const BASE = "/api";

export interface UserBadge {
  name: string;
  description: string;
  awardedAt: string;
}

export interface PublicProfile {
  id: string;
  firstName: string | null;
  lastName: string | null;
  studyProgramme: string | null;
  semester: number | null;
  languages: string[];
  replyCount: number;
  solutionCount: number;
  badges: UserBadge[];
}

export interface OwnProfile {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  studyProgramme: string | null;
  semester: number | null;
  languages: string[];
}

export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
  studyProgramme?: string;
  semester?: number;
  languages?: string[];
}

export async function getPublicProfile(userId: string): Promise<PublicProfile> {
  const res = await fetch(`${BASE}/users/${userId}`, { credentials: "include" });

  if (!res.ok) {
    const data = (await res.json()) as { message?: string };
    throw new Error(data.message ?? "Failed to fetch profile");
  }

  return res.json() as Promise<PublicProfile>;
}

export async function updateProfile(input: UpdateProfileInput): Promise<OwnProfile> {
  const res = await fetch(`${BASE}/users/me`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input),
  });

  const data = (await res.json()) as OwnProfile & { message?: string };

  if (!res.ok) {
    throw new Error(data.message ?? "Failed to update profile");
  }

  return data;
}

export type PostCategory = "Academic" | "Social" | "Sport" | "DailyLifeSupport";

export const ALL_CATEGORIES: PostCategory[] = ["Academic", "Social", "Sport", "DailyLifeSupport"];

export interface NotificationPreferences {
  categories: PostCategory[];
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const res = await fetch(`${BASE}/users/me/notification-preferences`, {
    credentials: "include",
  });

  if (!res.ok) {
    const data = (await res.json()) as { message?: string };
    throw new Error(data.message ?? "Failed to fetch notification preferences");
  }

  return res.json() as Promise<NotificationPreferences>;
}

export async function updateNotificationPreferences(
  categories: PostCategory[]
): Promise<NotificationPreferences> {
  const res = await fetch(`${BASE}/users/me/notification-preferences`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ categories }),
  });

  const data = (await res.json()) as NotificationPreferences & { message?: string };

  if (!res.ok) {
    throw new Error(data.message ?? "Failed to update notification preferences");
  }

  return data;
}
