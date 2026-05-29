// Render at request time so OPENXBL_PUBLIC_KEY (a runtime env var) is read on
// the server per-request — otherwise this page is prerendered at build time and
// the key bakes in empty.
export const dynamic = "force-dynamic";

// Place the Master Chief mark (currently app/icon.png) at public/cheevo-mark.png
// so it can be referenced as a normal image here.
const FEATURES: { title: string; sub: string; icon: React.ReactNode }[] = [
  {
    title: "Auto-sync your library",
    sub: "Every game pulled straight from your Xbox profile.",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12a9 9 0 1 1-9-9c2.5 0 4.8.95 6.5 2.5L21 8" />
        <path d="M21 3v5h-5" />
      </svg>
    ),
  },
  {
    title: "Rarity on every unlock",
    sub: "See how rare each achievement really is.",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3 L14.5 9 L21 9.3 L16 13.5 L17.7 20 L12 16.3 L6.3 20 L8 13.5 L3 9.3 L9.5 9 Z" />
      </svg>
    ),
  },
  {
    title: "Completion at a glance",
    sub: "Track progress across all your platforms.",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
];

export default function LoginPage() {
  // Sign-in starts the OpenXBL OAuth flow; OpenXBL handles the Microsoft login
  // and redirects back to /api/openxbl/callback with a code.
  const authBase = process.env.OPENXBL_AUTH_BASE_URL ?? "https://api.xbl.io";
  const authUrl = `${authBase}/app/auth/${process.env.OPENXBL_PUBLIC_KEY ?? ""}`;

  return (
    <main className="min-h-screen bg-[#2b2d30] flex items-center justify-center px-8">
      <div className="w-full max-w-[380px] space-y-8 text-center">
        {/* logo */}
        <div className="flex items-center justify-center gap-2.5 select-none">
          <span className="h-12 w-12 rounded-xl overflow-hidden bg-zinc-900 ring-1 ring-emerald-500/60 shadow-[0_1px_3px_rgba(0,0,0,0.5)] flex items-center justify-center shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/cheevo-mark.png" alt="Cheevo" className="h-full w-full object-cover" />
          </span>
          <span className="text-3xl font-extrabold tracking-tight leading-none">
            <span className="text-white">Chee</span>
            <span className="text-emerald-400">vo</span>
          </span>
        </div>

        {/* headline */}
        <div className="space-y-3">
          <h1 className="text-2xl font-bold text-white tracking-tight leading-tight">
            Every achievement.
            <br />
            One place.
          </h1>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Track your Xbox achievements, completion, and rarest unlocks — synced
            straight from your profile.
          </p>
        </div>

        {/* feature list */}
        <ul className="space-y-3 text-left">
          {FEATURES.map((f) => (
            <li key={f.title} className="flex items-start gap-3">
              <span className="mt-0.5 h-7 w-7 rounded-md bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
                {f.icon}
              </span>
              <div>
                <p className="text-sm font-medium text-zinc-100 leading-tight">{f.title}</p>
                <p className="text-xs text-zinc-500 mt-0.5 leading-snug">{f.sub}</p>
              </div>
            </li>
          ))}
        </ul>

        {/* sign-in */}
        <div className="space-y-3">
          <a
            href={authUrl}
            className="w-full inline-flex items-center justify-center gap-2.5 bg-[#107C10] hover:bg-[#0c6a0c] text-white font-semibold px-6 py-3 rounded-md transition-colors text-sm shadow-[0_1px_2px_rgba(0,0,0,0.4)]"
          >
            <span className="h-4 w-4 rounded-full bg-white/90 flex items-center justify-center">
              <span className="h-2.5 w-2.5 rounded-full border-2 border-[#107C10]" />
            </span>
            Sign in with Xbox
          </a>
          <p className="text-[11px] text-zinc-600">
            We only read your public achievement data.
          </p>
        </div>
      </div>
    </main>
  );
}
