import { auth, unstable_update } from "@/auth";
import { redirect } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8082";

async function linkAccount(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.microsoft_sub) redirect("/login");

  const gamertag = (formData.get("gamertag") as string).trim();
  if (!gamertag) return;

  const res = await fetch(`${API_URL}/api/profile/setup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ microsoft_sub: session.microsoft_sub, gamertag }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }));
    const raw = err.detail;
    const message =
      typeof raw === "string"
        ? raw
        : Array.isArray(raw)
        ? raw.map((e: { msg?: string }) => e.msg ?? JSON.stringify(e)).join(", ")
        : "Setup failed";
    redirect(`/setup?error=${encodeURIComponent(message)}`);
  }

  const data = await res.json();
  await unstable_update({ xuid: data.xuid });
  redirect("/");
}

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="min-h-screen bg-[#2b2d30] flex items-center justify-center px-8">
      <div className="w-full max-w-[380px] space-y-6">
        {/* logo */}
        <div className="flex items-center justify-center gap-2.5 select-none">
          <span className="h-9 w-9 rounded-lg overflow-hidden bg-zinc-900 ring-1 ring-emerald-500/60 shadow-[0_1px_3px_rgba(0,0,0,0.5)] flex items-center justify-center shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/cheevo-mark.png" alt="Cheevo" className="h-full w-full object-cover" />
          </span>
          <span className="text-xl font-extrabold tracking-tight leading-none">
            <span className="text-white">Chee</span>
            <span className="text-emerald-400">vo</span>
          </span>
        </div>

        {/* heading */}
        <div className="text-center space-y-1.5">
          <p className="text-[11px] uppercase tracking-widest text-emerald-400/80 font-[var(--font-geist-mono)]">
            Step 2 of 2
          </p>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Link your Xbox account
          </h1>
          <p className="text-sm text-zinc-400">
            Enter your gamertag to connect your achievement data.
          </p>
        </div>

        {error && (
          <div className="border border-red-700/60 bg-red-950/40 p-3 text-red-300 text-sm rounded-md">
            {decodeURIComponent(error)}
          </div>
        )}

        <form action={linkAccount} className="space-y-4">
          <div>
            <label className="block text-[10px] text-zinc-400 uppercase tracking-widest mb-1.5">
              Xbox Gamertag
            </label>
            <div className="flex items-center gap-2 border border-zinc-700 bg-[#1b1d20] rounded-md px-3 py-2.5 focus-within:border-emerald-500 transition-colors">
              <span className="text-zinc-500">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 20c0-4 3.5-6 8-6s8 2 8 6" />
                </svg>
              </span>
              <input
                name="gamertag"
                type="text"
                placeholder="e.g. tofid"
                required
                className="bg-transparent flex-1 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
              />
            </div>
          </div>

          <p className="text-[11px] text-zinc-500">
            Find your gamertag in the Xbox app under your profile.
          </p>

          <button
            type="submit"
            className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-5 py-3 rounded-md transition-colors text-sm"
          >
            Link account →
          </button>

          <p className="text-[11px] leading-relaxed text-zinc-500 flex items-start gap-2">
            <span className="mt-0.5 shrink-0 text-zinc-500">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="11" width="14" height="9" rx="2" />
                <path d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
            </span>
            <span>
              Cheevo reads <span className="text-zinc-300">public achievement data only</span>.
              We never post or message on your behalf.
            </span>
          </p>
        </form>
      </div>
    </main>
  );
}
