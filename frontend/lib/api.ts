const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export type UserOut = {
  id: number;
  xuid: string;
  gamertag: string;
  gamerscore: number;
  account_tier: string | null;
  avatar_url: string | null;
  last_synced_at: string | null;
};

export type GameOut = {
  id: number;
  title_id: string;
  name: string;
  platform: string | null;
  total_achievements: number;
  total_gamerscore: number;
  cover_url: string | null;
};

export type UserGameOut = {
  game: GameOut;
  current_gamerscore: number;
  current_achievements_unlocked: number;
  completion_percent: number;
  last_played_at: string | null;
};

export type AchievementOut = {
  id: number;
  achievement_id: string;
  name: string;
  description: string | null;
  gamerscore_value: number;
  rarity_percent: number | null;
  is_secret: boolean;
  icon_url: string | null;
};

export type SyncResult = {
  gamertag: string;
  xuid: string;
  gamerscore: number;
  games_synced: number;
  achievements_synced: number;
};

export const api = {
  getProfile: () => apiFetch<UserOut>("/api/profile/me"),
  syncProfile: (achievements = true) =>
    apiFetch<SyncResult>(`/api/profile/sync?achievements=${achievements}`, { method: "POST" }),
  getGames: () => apiFetch<UserGameOut[]>("/api/games/"),
  getAchievements: (titleId: string) =>
    apiFetch<AchievementOut[]>(`/api/games/${titleId}/achievements`),
};
