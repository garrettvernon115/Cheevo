const API_BASE =
  process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8082";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
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

export type UserGameDetailOut = {
  game: GameOut;
  current_gamerscore: number;
  current_achievements_unlocked: number;
  completion_percent: number;
  minutes_played: number;
  last_played_at: string | null;
};

export type AchievementOut = {
  id: number;
  achievement_id: string;
  name: string;
  description: string | null;
  locked_description: string | null;
  gamerscore_value: number;
  rarity_percent: number | null;
  is_secret: boolean;
  icon_url: string | null;
  dlc_name: string | null;
  earned: boolean;
  earned_at: string | null;
};

export type SyncResult = {
  gamertag: string;
  xuid: string;
  gamerscore: number;
  games_synced: number;
  achievements_synced: number;
};

const xuidHeader = (xuid: string) => ({ "x-user-xuid": xuid });

export const api = {
  getProfile: (xuid: string) =>
    apiFetch<UserOut>("/api/profile/me", { headers: xuidHeader(xuid) }),

  getGames: (xuid: string) =>
    apiFetch<UserGameOut[]>("/api/games/", { headers: xuidHeader(xuid) }),

  getGameDetail: (titleId: string, xuid: string) =>
    apiFetch<UserGameDetailOut>(`/api/games/${titleId}`, { headers: xuidHeader(xuid) }),

  getAchievements: (titleId: string, xuid: string, filter: "all" | "earned" | "locked" = "all") =>
    apiFetch<AchievementOut[]>(`/api/games/${titleId}/achievements?filter=${filter}`, {
      headers: xuidHeader(xuid),
    }),
};
