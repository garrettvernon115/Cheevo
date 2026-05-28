"use client";

import { useState, useEffect } from "react";
import SyncButton from "@/components/SyncButton";
import { UserGameOut, UserOut } from "@/lib/api";

function formatRelative(iso: string | null): string {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

interface Props {
  profile: UserOut;
  games: UserGameOut[];
  totalAchievementsUnlocked: number;
  gamerscore: number;
  overallCompletion: number;
  completedGames: number;
  gamesPlayed: number;
  /** Read-only (demo) view: hides write actions like Sync. */
  readOnly?: boolean;
}

export default function ProfileBanner({
  profile,
  games,
  totalAchievementsUnlocked,
  gamerscore,
  overallCompletion,
  completedGames,
  gamesPlayed,
  readOnly = false,
}: Props) {
  const gamesWithCovers = games.filter((g) => g.game.cover_url);
  const [featuredGame, setFeaturedGame] = useState<UserGameOut | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("cheevo:bannerGame");
    const pick = saved
      ? gamesWithCovers.find((g) => g.game.title_id === saved)
      : null;
    setFeaturedGame(pick ?? gamesWithCovers[0] ?? null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectGame = (game: UserGameOut) => {
    setFeaturedGame(game);
    localStorage.setItem("cheevo:bannerGame", game.game.title_id);
    setPickerOpen(false);
  };

  return (
    <section className="border-b border-zinc-800/80">
      <div className="max-w-[1400px] mx-auto px-6">
        {/* Banner */}
        <div className="relative h-44 mt-4 rounded-sm overflow-hidden bg-[#1f2226]">
          {/* Blurred cover background */}
          {featuredGame?.game.cover_url ? (
            <div
              className="absolute inset-0 scale-110"
              style={{
                backgroundImage: `url(${featuredGame.game.cover_url})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                filter: "blur(20px) saturate(1.2)",
              }}
            />
          ) : (
            <div
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(ellipse 80% 60% at 70% 30%, rgba(76,175,80,0.18), transparent 60%), radial-gradient(ellipse 60% 80% at 20% 80%, rgba(59,130,246,0.18), transparent 60%), linear-gradient(135deg, #1f2226 0%, #2b2d30 50%, #1a1c1f 100%)",
              }}
            />
          )}

          {/* Darkening overlay with left-to-right fade */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(90deg, rgba(20,22,25,0.85) 0%, rgba(20,22,25,0.45) 50%, rgba(20,22,25,0.80) 100%)",
            }}
          />

          {/* Subtle diagonal texture */}
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, transparent 0 12px, rgba(255,255,255,0.04) 12px 13px)",
            }}
          />

          {/* Featured game card — right side */}
          {featuredGame?.game.cover_url && (
            <div className="absolute right-5 top-1/2 -translate-y-1/2 flex items-center gap-4">
              <div className="text-right max-w-[200px]">
                <p className="text-[10px] uppercase tracking-widest text-zinc-400 font-mono mb-1">
                  Featured
                </p>
                <p className="text-base font-semibold leading-tight text-white truncate">
                  {featuredGame.game.name}
                </p>
                <p className="text-xs text-zinc-400 mt-1 tabular-nums">
                  {featuredGame.current_gamerscore.toLocaleString()} G &middot;{" "}
                  {Math.round(featuredGame.completion_percent)}%
                </p>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={featuredGame.game.cover_url}
                alt={featuredGame.game.name}
                className="h-32 w-[88px] rounded-sm shadow-2xl ring-1 ring-black/50 object-cover shrink-0"
              />
            </div>
          )}

          {/* Change cover button */}
          {gamesWithCovers.length > 0 && (
            <button
              onClick={() => setPickerOpen((v) => !v)}
              className="absolute top-3 left-3 text-[10px] uppercase tracking-widest text-zinc-200 font-mono bg-black/45 hover:bg-black/70 border border-white/10 rounded-sm px-2 py-1 transition-colors flex items-center gap-1.5"
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M3 17V21H7L18 10L14 6L3 17Z" />
                <path d="M14 6L18 10" />
              </svg>
              Change cover
            </button>
          )}
        </div>

        {/* Picker panel */}
        {pickerOpen && (
          <div className="mt-2 border border-zinc-800/80 rounded-sm bg-[#1f2124] p-3">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs text-zinc-300 font-medium">
                  Choose a banner cover
                </p>
                <p className="text-[10px] text-zinc-500">
                  Pick any game from your library
                </p>
              </div>
              <button
                onClick={() => setPickerOpen(false)}
                className="text-zinc-500 hover:text-white text-sm leading-none px-1"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(60px,1fr))] gap-2">
              {gamesWithCovers.map((g) => (
                <button
                  key={g.game.title_id}
                  onClick={() => selectGame(g)}
                  title={g.game.name}
                  className={`relative aspect-[3/4] rounded-sm overflow-hidden ring-1 transition-all hover:ring-2 hover:ring-emerald-500 hover:ring-offset-1 ring-offset-[#1f2124] ${
                    featuredGame?.game.title_id === g.game.title_id
                      ? "ring-2 ring-emerald-500 ring-offset-1 ring-white/0"
                      : "ring-white/5"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={g.game.cover_url!}
                    alt={g.game.name}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Profile info */}
        <div className="flex items-start gap-5 px-2 pb-5 pt-4 flex-wrap">
          <div className="relative shrink-0 -mt-2">
            <div className="h-20 w-20 rounded-full bg-zinc-800 border-4 border-[#2b2d30] overflow-hidden flex items-center justify-center text-2xl font-bold text-zinc-500">
              {profile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.avatar_url}
                  alt={profile.gamertag}
                  className="h-full w-full object-cover"
                />
              ) : (
                profile.gamertag.charAt(0).toUpperCase()
              )}
            </div>
            <div className="absolute bottom-1 right-1 h-3.5 w-3.5 rounded-full bg-emerald-500 border-2 border-[#2b2d30]" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-6 flex-wrap">
              <h1 className="text-3xl font-semibold tracking-tight leading-none">
                {profile.gamertag}
              </h1>
              <div className="flex items-center gap-5 text-zinc-200 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-amber-500/20 text-amber-300 text-sm">
                    🏆
                  </span>
                  <span className="text-lg font-medium tabular-nums leading-none">
                    {totalAchievementsUnlocked.toLocaleString()}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-zinc-500 ml-1">
                    Achievements
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-emerald-500/20 text-emerald-300 text-sm font-bold">
                    G
                  </span>
                  <span className="text-lg font-medium tabular-nums leading-none">
                    {gamerscore.toLocaleString()}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-zinc-500 ml-1">
                    Gamerscore
                  </span>
                </div>
              </div>

              <div className="ml-auto flex items-center gap-3">
                {profile.last_synced_at && (
                  <span className="text-zinc-500 text-xs hidden sm:inline">
                    Last sync · {formatRelative(profile.last_synced_at)}
                  </span>
                )}
                {!readOnly && <SyncButton />}
              </div>
            </div>

            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span className="inline-flex items-center gap-1.5 rounded-sm bg-emerald-600/90 px-2.5 py-1 text-xs font-medium text-white">
                <span className="font-bold">G</span> {gamerscore.toLocaleString()}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-sm bg-blue-600/90 px-2.5 py-1 text-xs font-medium text-white">
                % {overallCompletion.toFixed(1)}
                <span className="text-blue-200/80 ml-0.5">completion</span>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-sm bg-zinc-700 px-2.5 py-1 text-xs font-medium text-zinc-200">
                {gamesPlayed} games
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-sm bg-zinc-700 px-2.5 py-1 text-xs font-medium text-zinc-200">
                {completedGames} completed
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
