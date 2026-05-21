import { api, UserGameOut, UserOut } from "@/lib/api";
import SyncButton from "@/components/SyncButton";
import GamesGrid from "@/components/GamesGrid";

async function getProfileData(): Promise<{ profile: UserOut | null; games: UserGameOut[] }> {
  try {
    const [profile, games] = await Promise.all([api.getProfile(), api.getGames()]);
    return { profile, games };
  } catch {
    return { profile: null, games: [] };
  }
}

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

export default async function Home() {
  const { profile, games } = await getProfileData();

  // Aggregate sidebar stats from games
  const totalAchievementsUnlocked = games.reduce(
    (s, g) => s + g.current_achievements_unlocked,
    0,
  );
  const totalAchievementsAvailable = games.reduce(
    (s, g) => s + g.game.total_achievements,
    0,
  );
  const overallCompletion =
    totalAchievementsAvailable > 0
      ? (totalAchievementsUnlocked / totalAchievementsAvailable) * 100
      : 0;
  const completedGames = games.filter((g) => g.completion_percent >= 100).length;
  const gamesPlayed = games.length;
  const gamerscore =
    profile?.gamerscore ?? games.reduce((s, g) => s + g.current_gamerscore, 0);

  // Top 5 by gamerscore earned
  const bestGames = [...games]
    .sort((a, b) => b.current_gamerscore - a.current_gamerscore)
    .slice(0, 5);

  return (
    <main className="min-h-screen bg-[#2b2d30] text-zinc-100">
      {/* Top utility bar */}
      <header className="border-b border-zinc-800/80 bg-[#222427]">
        <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between text-sm">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-md bg-emerald-500/90 flex items-center justify-center font-black text-zinc-900 text-lg shadow-[0_0_0_1px_rgba(0,0,0,0.4)_inset]">
              C
            </div>
            <span className="text-xl font-bold tracking-tight">Cheevo</span>
          </div>
        </div>
      </header>

      {profile ? (
        <>
          {/* Profile banner */}
          <section className="border-b border-zinc-800/80">
            <div className="max-w-[1400px] mx-auto px-6">
              {(() => {
                const bannerGame = games.find((g) => g.last_played_at && g.game.cover_url);
                return (
                  <div className="relative h-44 mt-4 rounded-sm overflow-hidden bg-[#1a1c1f]">
                    {bannerGame?.game.cover_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={bannerGame.game.cover_url}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover object-center"
                      />
                    )}
                    {/* Darkening overlay so profile text stays readable */}
                    <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-black/30" />
                    {bannerGame && (
                      <div className="absolute bottom-3 right-4 text-xs text-white/40 italic">
                        {bannerGame.game.name}
                      </div>
                    )}
                  </div>
                );
              })()}

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
                      <SyncButton />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 rounded-sm bg-emerald-600/90 px-2.5 py-1 text-xs font-medium text-white">
                      <span className="font-bold">G</span>{" "}
                      {gamerscore.toLocaleString()}
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

          {/* Main two-column */}
          <div className="max-w-[1400px] mx-auto px-6 py-6 grid grid-cols-12 gap-6">
            <section className="col-span-12 lg:col-span-9">
              <GamesGrid games={games} />
            </section>

            <aside className="col-span-12 lg:col-span-3 space-y-6">
              {/* My Stats */}
              <div>
                <h3
                  className="text-sm font-semibold text-white mb-3 pl-3"
                  style={{ boxShadow: "inset 3px 0 0 #4caf50" }}
                >
                  My Stats
                </h3>
                <div className="border border-zinc-800/80 rounded-sm divide-y divide-zinc-800/80 text-sm">
                  <Stat label="Gamerscore" value={gamerscore.toLocaleString()} accent="emerald" />
                  <Stat label="Games played" value={gamesPlayed.toLocaleString()} />
                  <Stat
                    label="Achievements"
                    value={totalAchievementsUnlocked.toLocaleString()}
                  />
                  <Stat
                    label="Completion"
                    value={`${overallCompletion.toFixed(1)}%`}
                    accent="blue"
                  />
                  <Stat label="Completed games" value={completedGames.toLocaleString()} />
                </div>
              </div>

              {/* Best Games */}
              <div>
                <h3
                  className="text-sm font-semibold text-white mb-3 pl-3"
                  style={{ boxShadow: "inset 3px 0 0 #ef4444" }}
                >
                  Best Games
                </h3>
                {bestGames.length > 0 ? (
                  <ol className="border border-zinc-800/80 rounded-sm divide-y divide-zinc-800/80 text-sm">
                    {bestGames.map((g, i) => (
                      <li
                        key={g.game.title_id}
                        className="grid grid-cols-[18px_1fr_auto] gap-3 items-center px-3 py-2"
                      >
                        <span className="text-zinc-500 text-xs tabular-nums">
                          {i + 1}
                        </span>
                        <span className="text-blue-400 truncate" title={g.game.name}>
                          {g.game.name}
                        </span>
                        <span className="text-emerald-400 tabular-nums font-medium">
                          {g.current_gamerscore.toLocaleString()}
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-xs text-zinc-500 px-1">No games yet.</p>
                )}
              </div>
            </aside>
          </div>
        </>
      ) : (
        <div className="max-w-[1400px] mx-auto px-6 py-10">
          <div className="border border-yellow-700/60 bg-yellow-950/40 p-6 text-yellow-300 text-sm rounded-sm">
            No profile found. Click <strong>Sync Now</strong> to pull your Xbox
            data.
          </div>
        </div>
      )}
    </main>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "emerald" | "blue";
}) {
  const valColor =
    accent === "emerald"
      ? "text-emerald-400"
      : accent === "blue"
      ? "text-blue-400"
      : "text-zinc-100";
  return (
    <div className="flex items-center justify-between px-3 py-2">
      <span className="text-zinc-400">{label}</span>
      <span className={`font-medium tabular-nums ${valColor}`}>{value}</span>
    </div>
  );
}
