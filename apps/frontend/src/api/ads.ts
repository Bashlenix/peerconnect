const BASE = "/api";

export interface Ad {
  id: string;
  title: string;
  body: string;
  imageUrl: string | null;
  linkUrl: string;
  advertiserName: string;
}

export interface GetAdsResponse {
  ads: Ad[];
}

export async function getAds(): Promise<GetAdsResponse> {
  const res = await fetch(`${BASE}/ads`, { credentials: "include" });
  if (!res.ok) {
    const data = (await res.json()) as { message?: string };
    throw new Error(data.message ?? "Failed to fetch ads");
  }
  return res.json() as Promise<GetAdsResponse>;
}
