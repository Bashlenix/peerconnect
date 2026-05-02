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
