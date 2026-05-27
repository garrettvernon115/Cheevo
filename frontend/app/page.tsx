import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { api, UserGameOut, UserOut } from "@/lib/api";
import GamesGrid from "@/components/GamesGrid";
import ProfileBanner from "@/components/ProfileBanner";

async function getProfileData(xuid: string): Promise<{ profile: UserOut | null; games: UserGameOut[] }> {
  try {
    const [profile, games] = await Promise.all([api.getProfile(xuid), api.getGames(xuid)]);
    return { profile, games };
  } catch {
    return { profile: null, games: [] };
  }
}


export default async function Home() {
  const session = await auth();
  if (!session?.xuid) redirect("/login");

  const { profile, games } = await getProfileData(session.xuid);

  const totalAchievementsUnlocked = games.reduce((s, g) => s + g.current_achievements_unlocked, 0);
  const totalAchievementsAvailable = games.reduce((s, g) => s + g.game.total_achievements, 0);
  const overallCompletion =
    totalAchievementsAvailable > 0
      ? (totalAchievementsUnlocked / totalAchievementsAvailable) * 100
      : 0;
  const completedGames = games.filter((g) => g.completion_percent >= 100).length;
  const gamesPlayed = games.length;
  const gamerscore =
    profile?.gamerscore ?? games.reduce((s, g) => s + g.current_gamerscore, 0);

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
          <ProfileBanner
            profile={profile}
            games={games}
            totalAchievementsUnlocked={totalAchievementsUnlocked}
            gamerscore={gamerscore}
            overallCompletion={overallCompletion}
            completedGames={completedGames}
            gamesPlayed={gamesPlayed}
          />

          {/* Main two-column */}
          <div className="max-w-[1400px] mx-auto px-6 py-6 grid grid-cols-12 gap-6">
            <section className="col-span-12 lg:col-span-9">
              <GamesGrid games={games} />
            </section>

            <aside className="col-span-12 lg:col-span-3 space-y-6">
              <div>
                <h3
                  className="text-sm font-semibold text-white mb-3 pl-3"
                  style={{ boxShadow: "inset 3px 0 0 #4caf50" }}
                >
                  My Stats
                </h3>
                <div className="border border-zinc-800/80 rounded-sm divide-y divide-zinc-800/80 text-sm">
                  <StatRow label="Gamerscore" value={gamerscore.toLocaleString()} accent="emerald" />
                  <StatRow label="Games played" value={gamesPlayed.toLocaleString()} />
                  <StatRow label="Achievements" value={totalAchievementsUnlocked.toLocaleString()} />
                  <StatRow label="Completion" value={`${overallCompletion.toFixed(1)}%`} accent="blue" />
                  <StatRow label="Completed games" value={completedGames.toLocaleString()} />
                </div>
              </div>

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
                        <span className="text-zinc-500 text-xs tabular-nums">{i + 1}</span>
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
            No profile found. Click <strong>Sync Now</strong> to pull your Xbox data.
          </div>
        </div>
      )}
    </main>
  );
}

function StatRow({
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
