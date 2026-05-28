"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { UserGameOut } from "@/lib/api";

type SortKey = "name" | "completion" | "gamerscore" | "last_played";
type SortDir = "asc" | "desc";

export default function GamesGrid({ games }: { games: UserGameOut[] }) {
  const [achievementsOnly, setAchievementsOnly] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("last_played");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const filtered = useMemo(
    () =>
      achievementsOnly
        ? games.filter((g) => g.game.total_achievements > 0 || g.game.total_gamerscore > 0)
        : games,
    [achievementsOnly, games],
  );

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      switch (sortKey) {
        case "name": {
          const av = a.game.name.toLowerCase();
          const bv = b.game.name.toLowerCase();
          return av < bv ? -dir : av > bv ? dir : 0;
        }
        case "completion":
          return (a.completion_percent - b.completion_percent) * dir;
        case "gamerscore":
          return (a.current_gamerscore - b.current_gamerscore) * dir;
        case "last_played": {
          const av = a.last_played_at ? new Date(a.last_played_at).getTime() : 0;
          const bv = b.last_played_at ? new Date(b.last_played_at).getTime() : 0;
          return (av - bv) * dir;
        }
      }
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  }

  const arrow = (key: SortKey) =>
    sortKey === key ? (
      <span className="text-emerald-400">{sortDir === "asc" ? "▴" : "▾"}</span>
    ) : (
      <span className="text-zinc-600">▾</span>
    );

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2
          className="text-base font-semibold text-white pl-3"
          style={{ boxShadow: "inset 3px 0 0 #ef4444" }}
        >
          Games{" "}
          <span className="text-zinc-500 font-normal text-sm">· {sorted.length}</span>
        </h2>
        <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={achievementsOnly}
            onChange={(e) => setAchievementsOnly(e.target.checked)}
            className="accent-emerald-500 h-3.5 w-3.5"
          />
          Achievements only
        </label>
      </div>

      <div className="border border-zinc-800/80 rounded-sm overflow-hidden">
        <div className="grid grid-cols-[1fr_180px_90px_90px_110px] gap-3 px-3 py-2 text-[10px] uppercase tracking-wider text-zinc-400 bg-[#25272a] border-b border-zinc-800/80">
          <button
            onClick={() => toggleSort("name")}
            className="text-left hover:text-white flex items-center gap-1"
          >
            Name {arrow("name")}
          </button>
          <button
            onClick={() => toggleSort("completion")}
            className="text-left hover:text-white flex items-center gap-1"
          >
            Completion {arrow("completion")}
          </button>
          <div className="text-right">Cheevos</div>
          <button
            onClick={() => toggleSort("gamerscore")}
            className="text-right hover:text-white flex items-center gap-1 justify-end"
          >
            Score {arrow("gamerscore")}
          </button>
          <button
            onClick={() => toggleSort("last_played")}
            className="text-right hover:text-white flex items-center gap-1 justify-end"
          >
            Last Played {arrow("last_played")}
          </button>
        </div>

        <div>
          {sorted.map(
            ({ game, current_gamerscore, current_achievements_unlocked, completion_percent, last_played_at }, idx) => (
              <div
                key={game.title_id}
                className={`grid grid-cols-[1fr_180px_90px_90px_110px] gap-3 px-3 py-2.5 items-center text-sm border-b border-zinc-800/40 last:border-b-0 transition-colors hover:bg-white/[0.05] ${
                  idx % 2 === 1 ? "bg-white/[0.018]" : ""
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {game.cover_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={game.cover_url}
                      alt=""
                      className="h-7 w-7 rounded-sm shrink-0 object-cover bg-zinc-800"
                    />
                  ) : (
                    <div className="h-7 w-7 rounded-sm bg-zinc-800 shrink-0 text-[10px] text-zinc-600 font-mono flex items-center justify-center">
                      img
                    </div>
                  )}
                  <Link
                    href={`/games/${game.title_id}`}
                    className="text-blue-400 hover:underline truncate"
                    title={game.name}
                  >
                    {game.name}
                  </Link>
                </div>

                <div className="flex items-center gap-2">
                  <div className="h-1.5 rounded-full bg-zinc-800 flex-1 overflow-hidden">
                    <div
                      className={`h-full ${completion_percent >= 100 ? "bg-emerald-400" : "bg-emerald-500"}`}
                      style={{ width: `${Math.min(100, completion_percent)}%` }}
                    />
                  </div>
                  <span className="text-xs text-zinc-400 tabular-nums w-9 text-right">
                    {Math.round(completion_percent)}%
                  </span>
                </div>

                <span className="text-right text-zinc-300 tabular-nums">
                  {game.total_achievements > 0
                    ? `${current_achievements_unlocked}/${game.total_achievements}`
                    : "—"}
                </span>

                <span className="text-right text-emerald-400 tabular-nums font-medium">
                  {current_gamerscore.toLocaleString()}
                </span>

                <span className="text-right text-zinc-500 text-xs tabular-nums">
                  {last_played_at
                    ? new Date(last_played_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "2-digit",
                      })
                    : "—"}
                </span>
              </div>
            ),
          )}
          {sorted.length === 0 && (
            <div className="px-3 py-8 text-center text-sm text-zinc-500">No games to show.</div>
          )}
        </div>
      </div>
    </div>
  );
}
