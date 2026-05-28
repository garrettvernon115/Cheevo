import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import {
  api,
  AchievementOut,
  UserGameDetailOut,
} from "@/lib/api";
import { getViewerXuid } from "@/lib/demo";

type Filter = "all" | "earned" | "locked";
type SortDir = "asc" | "desc";
type SortKey = "earned" | "points" | "rarity";

const DEFAULT_DIR: Record<SortKey, SortDir> = {
  earned: "desc",
  points: "desc",
  rarity: "asc",
};

function buildSortHref(
  targetKey: SortKey,
  currentKey: SortKey,
  currentDir: SortDir,
  titleId: string,
  filter: Filter,
): string {
  const newDir =
    targetKey === currentKey
      ? currentDir === "asc" ? "desc" : "asc"
      : DEFAULT_DIR[targetKey];
  const params = new URLSearchParams();
  if (filter !== "all") params.set("filter", filter);
  if (targetKey !== "earned" || newDir !== "desc") {
    params.set("sortBy", targetKey);
    params.set("sort", newDir);
  }
  const qs = params.toString();
  return `/games/${titleId}${qs ? `?${qs}` : ""}`;
}

async function getGameData(
  titleId: string,
  xuid: string,
  filter: Filter,
): Promise<{ detail: UserGameDetailOut | null; achievements: AchievementOut[] }> {
  try {
    const [detail, achievements] = await Promise.all([
      api.getGameDetail(titleId, xuid),
      api.getAchievements(titleId, xuid, filter),
    ]);
    return { detail, achievements };
  } catch {
    return { detail: null, achievements: [] };
  }
}


function formatDate(iso: string | null): { date: string; time: string } | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (d.getFullYear() < 2000) return null;
  return {
    date: d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    time: d.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }),
  };
}

function rarityTier(percent: number | null): { label: string; color: string } {
  if (percent === null) return { label: "", color: "text-zinc-600" };
  if (percent >= 50) return { label: "Very Common", color: "text-zinc-600" };
  if (percent >= 25) return { label: "Common", color: "text-zinc-500" };
  if (percent >= 10) return { label: "Uncommon", color: "text-blue-400/80" };
  if (percent >= 3) return { label: "Rare", color: "text-amber-500/80" };
  return { label: "Ultra Rare", color: "text-fuchsia-400/80" };
}

export default async function GameDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ titleId: string }>;
  searchParams: Promise<{ filter?: string; sortBy?: string; sort?: string }>;
}) {
  const xuid = await getViewerXuid();
  if (!xuid) redirect("/login");

  const { titleId } = await params;
  const sp = await searchParams;
  const filter: Filter =
    sp.filter === "earned" || sp.filter === "locked" ? sp.filter : "all";
  const sortBy: SortKey =
    sp.sortBy === "points" || sp.sortBy === "rarity" ? sp.sortBy : "earned";
  const sort: SortDir = sp.sort === "asc" ? "asc" : sp.sort === "desc" ? "desc" : DEFAULT_DIR[sortBy];

  const { detail, achievements: rawAchievements } = await getGameData(titleId, xuid, filter);

  const dir = sort === "asc" ? 1 : -1;
  const achievements = [...rawAchievements].sort((a, b) => {
    switch (sortBy) {
      case "points":
        return (a.gamerscore_value - b.gamerscore_value) * dir;
      case "rarity": {
        if (a.rarity_percent === null && b.rarity_percent === null) return 0;
        if (a.rarity_percent === null) return 1;
        if (b.rarity_percent === null) return -1;
        return (a.rarity_percent - b.rarity_percent) * dir;
      }
      default: {
        const at = a.earned_at ? new Date(a.earned_at).getTime() : null;
        const bt = b.earned_at ? new Date(b.earned_at).getTime() : null;
        if (at === null && bt === null) return 0;
        if (at === null) return 1;
        if (bt === null) return -1;
        return (at - bt) * dir;
      }
    }
  });

  if (!detail) notFound();

  const { game } = detail;
  const earnedCount = detail.current_achievements_unlocked;
  const totalCount = game.total_achievements;
  const earnedScore = detail.current_gamerscore;
  const totalScore = game.total_gamerscore;
  const completion = detail.completion_percent;

  return (
    <main className="min-h-screen bg-[#2b2d30] text-zinc-100">
      {/* Top header */}
      <header className="border-b border-zinc-800/80 bg-[#222427] relative z-10">
        <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between text-sm">
          <Link href="/" className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-md bg-emerald-500/90 flex items-center justify-center font-black text-zinc-900 text-lg">
              C
            </div>
            <span className="text-xl font-bold tracking-tight">Cheevo</span>
          </Link>
        </div>
      </header>

      {/* Hero banner */}
      <section className="relative">
        <div className="absolute inset-0 overflow-hidden">
          {game.cover_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={game.cover_url}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover scale-110 blur-md opacity-40"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-[#2b2d30] to-zinc-950" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/40 to-[#2b2d30]" />
        </div>

        <div className="relative max-w-[1400px] mx-auto px-6 pt-4 pb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-xs text-zinc-300 hover:text-white"
          >
            <span>←</span> Back to games
          </Link>

          <div className="flex items-end gap-6 mt-10 pb-2 flex-wrap">
            <div className="shrink-0 h-44 w-44 rounded-sm overflow-hidden border border-zinc-700/50 shadow-2xl bg-zinc-900">
              {game.cover_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={game.cover_url}
                  alt={game.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-700 text-xs font-mono">
                  no cover
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0 pb-2">
              <h1 className="text-4xl font-bold tracking-tight leading-tight drop-shadow-lg">
                {game.name}
              </h1>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {game.platform && (
                  <span className="inline-flex items-center gap-1.5 rounded-sm bg-emerald-600/95 px-2.5 py-1 text-xs font-medium text-white">
                    <span className="text-[10px]">●</span> {game.platform}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="border-y border-zinc-800/80 bg-[#25272a]">
        <div className="max-w-[1400px] mx-auto px-6 py-5 grid grid-cols-3 gap-4 text-center">
          <Stat
            value={
              <>
                {earnedCount}
                <span className="text-zinc-500 text-base font-normal"> / {totalCount}</span>
              </>
            }
            label="Achievements"
          />
          <Stat
            value={
              <span className="text-emerald-400">
                {earnedScore.toLocaleString()}
                <span className="text-zinc-500 text-base font-normal"> / {totalScore.toLocaleString()}</span>
              </span>
            }
            label="Gamerscore"
          />
          <Stat
            value={<span className="text-blue-400">{Math.round(completion)}%</span>}
            label="Completion"
          />
        </div>
      </section>

      {/* Main content */}
      <div className="max-w-[1400px] mx-auto px-6 py-6 grid grid-cols-12 gap-6">
        {/* LEFT */}
        <section className="col-span-12 lg:col-span-9">
          {game.platform === "Xbox360" ? (
            <div className="border border-zinc-800/80 rounded-sm px-5 py-10 text-center space-y-2">
              <p className="text-sm text-zinc-400">
                Individual achievement details are not available for Xbox 360 games through the Xbox API.
              </p>
              <p className="text-xs text-zinc-600">
                Completion stats above are pulled from your game history.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-zinc-800 mb-4">
                <nav className="flex items-center gap-1">
                  <FilterTab titleId={titleId} filter="all" active={filter === "all"} label="All" sortBy={sortBy} sort={sort} />
                  <FilterTab titleId={titleId} filter="earned" active={filter === "earned"} label="Earned" count={earnedCount} sortBy={sortBy} sort={sort} />
                  <FilterTab titleId={titleId} filter="locked" active={filter === "locked"} label="Locked" count={Math.max(0, totalCount - earnedCount)} sortBy={sortBy} sort={sort} />
                </nav>
              </div>

              {achievements.length > 0 ? (
                <AchievementGroups achievements={achievements} titleId={titleId} filter={filter} sortBy={sortBy} sort={sort} earnedTotal={earnedCount} earnedScoreTotal={earnedScore} />
              ) : (
                <>
                  <div className="grid grid-cols-[1fr_80px_110px_140px] gap-4 px-3 py-2 text-[10px] uppercase tracking-wider text-zinc-500 border-b border-zinc-800/60">
                    <div>Achievement</div>
                    <div className="text-right">Points</div>
                    <div className="text-right">Rarity</div>
                    <div className="text-right">Earned</div>
                  </div>
                  <div className="px-3 py-12 text-center text-sm text-zinc-500">
                    {filter === "earned"
                      ? "No achievements earned yet."
                      : filter === "locked"
                      ? "All achievements unlocked."
                      : "No achievements found for this game."}
                  </div>
                </>
              )}

              {achievements.length > 0 && (
                <p className="text-xs text-zinc-500 mt-4">
                  Showing {achievements.length} achievement{achievements.length === 1 ? "" : "s"}
                </p>
              )}
            </>
          )}
        </section>

        {/* RIGHT sidebar */}
        <aside className="col-span-12 lg:col-span-3 space-y-6">
          <div>
            <h3
              className="text-sm font-semibold text-white mb-3 pl-3"
              style={{ boxShadow: "inset 3px 0 0 #4caf50" }}
            >
              My Stats
            </h3>
            <div className="border border-zinc-800/80 rounded-sm divide-y divide-zinc-800/80 text-sm">
              <KV label="Achieved" value={<>{earnedCount} <span className="text-zinc-500">/ {totalCount}</span></>} />
              <KV label="Gamerscore" value={<span className="text-emerald-400">{earnedScore.toLocaleString()} <span className="text-zinc-500">/ {totalScore.toLocaleString()}</span></span>} />
              <KV label="Completion" value={<span className="text-blue-400">{Math.round(completion)}%</span>} />
              {detail.last_played_at && (
                <KV label="Last played" value={<span className="text-xs text-zinc-300">{new Date(detail.last_played_at).toLocaleDateString()}</span>} />
              )}
            </div>
          </div>

          <div>
            <h3
              className="text-sm font-semibold text-white mb-3 pl-3"
              style={{ boxShadow: "inset 3px 0 0 #ef4444" }}
            >
              Game Info
            </h3>
            <div className="border border-zinc-800/80 rounded-sm divide-y divide-zinc-800/80 text-sm">
              {game.platform && (
                <KV label="Platform" value={<span className="text-zinc-200">{game.platform}</span>} />
              )}
              <KV label="Achievements" value={totalCount.toLocaleString()} />
              <KV label="Total score" value={totalScore.toLocaleString()} />
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

function AchievementGroups({
  achievements,
  titleId,
  filter,
  sortBy,
  sort,
  earnedTotal,
  earnedScoreTotal,
}: {
  achievements: AchievementOut[];
  titleId: string;
  filter: Filter;
  sortBy: SortKey;
  sort: SortDir;
  earnedTotal: number;
  earnedScoreTotal: number;
}) {
  const arrow = (key: SortKey) =>
    sortBy === key ? (
      <span className="text-emerald-400">{sort === "asc" ? "▴" : "▾"}</span>
    ) : (
      <span className="text-zinc-600">▾</span>
    );
  const buckets = new Map<string | null, AchievementOut[]>();
  for (const a of achievements) {
    const key = a.dlc_name ?? null;
    const arr = buckets.get(key);
    if (arr) arr.push(a);
    else buckets.set(key, [a]);
  }

  const orderedKeys: (string | null)[] = [];
  if (buckets.has(null)) orderedKeys.push(null);
  const dlcNames = [...buckets.keys()]
    .filter((k): k is string => k !== null)
    .sort((a, b) => a.localeCompare(b));
  orderedKeys.push(...dlcNames);

  const showHeaders = dlcNames.length > 0;

  return (
    <div className="space-y-6">
      {orderedKeys.map((key) => {
        const rows = buckets.get(key)!;
        const isSingleGroup = orderedKeys.length === 1;
        const earnedInGroup = isSingleGroup ? earnedTotal : rows.filter((r) => r.earned).length;
        const scoreInGroup = isSingleGroup ? earnedScoreTotal : rows.filter((r) => r.earned).reduce((s, r) => s + r.gamerscore_value, 0);
        const totalScoreInGroup = rows.reduce((s, r) => s + r.gamerscore_value, 0);
        const isBaseGame = key === null;

        return (
          <div key={key ?? "__base__"}>
            {showHeaders && (
              <div
                className={`flex items-center justify-between px-3 py-2.5 mb-0 rounded-t-sm ${
                  isBaseGame
                    ? "bg-[#25272a] border border-zinc-800/80"
                    : "bg-gradient-to-r from-red-950/60 via-red-950/20 to-zinc-900/30 border border-red-900/40"
                }`}
                style={isBaseGame ? { boxShadow: "inset 3px 0 0 #4caf50" } : { boxShadow: "inset 3px 0 0 #ef4444" }}
              >
                <div className="pl-2">
                  <div className="text-sm font-semibold text-white">
                    {isBaseGame ? "Base Game" : key}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-zinc-400 tabular-nums">
                  <span>
                    <span className="text-zinc-200 font-medium">{earnedInGroup}</span>
                    <span className="text-zinc-600"> / {rows.length}</span>
                  </span>
                  <span>
                    <span className="text-emerald-400 font-medium">{scoreInGroup}</span>
                    <span className="text-zinc-600"> / {totalScoreInGroup}</span>
                    <span className="text-zinc-500 ml-1">G</span>
                  </span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-[1fr_80px_110px_140px] gap-4 px-3 py-2 text-[10px] uppercase tracking-wider text-zinc-500 border-b border-zinc-800/60">
              <div>Achievement</div>
              <div className="text-right">
                <Link href={buildSortHref("points", sortBy, sort, titleId, filter)} scroll={false} className="inline-flex items-center justify-end gap-1 hover:text-white transition-colors">
                  Points {arrow("points")}
                </Link>
              </div>
              <div className="text-right">
                <Link href={buildSortHref("rarity", sortBy, sort, titleId, filter)} scroll={false} className="inline-flex items-center justify-end gap-1 hover:text-white transition-colors">
                  Rarity {arrow("rarity")}
                </Link>
              </div>
              <div className="text-right">
                <Link href={buildSortHref("earned", sortBy, sort, titleId, filter)} scroll={false} className="inline-flex items-center justify-end gap-1 hover:text-white transition-colors">
                  Earned {arrow("earned")}
                </Link>
              </div>
            </div>

            <ul>
              {rows.map((a) => (
                <AchievementRow key={a.id} a={a} />
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function Stat({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div>
      <div className="text-2xl font-bold tabular-nums leading-none">{value}</div>
      <div className="text-[11px] uppercase tracking-wider text-zinc-500 mt-1.5">{label}</div>
    </div>
  );
}

function FilterTab({
  titleId,
  filter,
  active,
  label,
  count,
  sortBy,
  sort,
}: {
  titleId: string;
  filter: Filter;
  active: boolean;
  label: string;
  count?: number;
  sortBy: SortKey;
  sort: SortDir;
}) {
  const params = new URLSearchParams();
  if (filter !== "all") params.set("filter", filter);
  if (sortBy !== "earned" || sort !== DEFAULT_DIR[sortBy]) {
    params.set("sortBy", sortBy);
    params.set("sort", sort);
  }
  const qs = params.toString();
  const href = `/games/${titleId}${qs ? `?${qs}` : ""}`;
  return (
    <Link
      href={href}
      className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
        active ? "text-white border-blue-500" : "text-zinc-400 hover:text-white border-transparent"
      }`}
    >
      {label}
      {count !== undefined && (
        <span className={`ml-1 font-normal ${active ? "text-zinc-500" : "text-zinc-600"}`}>
          {count}
        </span>
      )}
    </Link>
  );
}

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 gap-2">
      <span className="text-zinc-400">{label}</span>
      <span className="font-medium tabular-nums text-right">{value}</span>
    </div>
  );
}

function AchievementRow({ a }: { a: AchievementOut }) {
  const earned = a.earned;
  const desc =
    !earned && a.is_secret
      ? a.locked_description ?? "Hidden achievement"
      : a.description ?? a.locked_description ?? "";
  const rarity = rarityTier(a.rarity_percent);
  const earnedDate = formatDate(a.earned_at);

  return (
    <li
      className={`grid grid-cols-[1fr_80px_110px_140px] gap-4 items-center px-3 py-3 border-b border-zinc-800/40 transition-colors hover:bg-white/[0.04] ${
        earned ? "" : "opacity-60"
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`h-12 w-12 shrink-0 rounded-sm overflow-hidden bg-zinc-800 flex items-center justify-center ${
            earned ? "" : "grayscale"
          }`}
        >
          {a.icon_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={a.icon_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-[10px] text-zinc-600 font-mono">img</span>
          )}
        </div>
        <div className="min-w-0">
          <div className={`font-semibold text-sm truncate ${earned ? "text-white" : "text-zinc-300"}`}>
            {a.name}
          </div>
          <div className={`text-xs truncate ${earned ? "text-zinc-400" : "text-zinc-500 italic"}`}>
            {desc}
          </div>
        </div>
      </div>

      <div className="text-right">
        <div className="inline-flex items-center gap-1.5 text-sm">
          <span
            className={`inline-flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold ${
              earned ? "bg-emerald-500/20 text-emerald-300" : "bg-zinc-700/50 text-zinc-500"
            }`}
          >
            G
          </span>
          <span className={`tabular-nums font-medium ${earned ? "text-zinc-100" : "text-zinc-400"}`}>
            {a.gamerscore_value}
          </span>
        </div>
      </div>

      <div className="text-right">
        {a.rarity_percent !== null ? (
          <>
            <div className="text-sm tabular-nums text-zinc-300">{a.rarity_percent.toFixed(2)}%</div>
            {rarity.label && (
              <div className={`text-[10px] uppercase tracking-wider ${rarity.color}`}>
                {rarity.label}
              </div>
            )}
          </>
        ) : (
          <span className="text-xs text-zinc-600">—</span>
        )}
      </div>

      <div className="text-right text-xs tabular-nums leading-tight">
        {earned && earnedDate ? (
          <>
            <span className="text-zinc-300">{earnedDate.date}</span>
            <br />
            <span className="text-zinc-600">{earnedDate.time}</span>
          </>
        ) : null}
      </div>
    </li>
  );
}
