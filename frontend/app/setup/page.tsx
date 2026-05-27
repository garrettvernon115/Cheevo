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
    <main className="min-h-screen bg-[#2b2d30] flex items-center justify-center">
      <div className="max-w-md w-full px-6 space-y-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-9 w-9 rounded-md bg-emerald-500/90 flex items-center justify-center font-black text-zinc-900 text-lg">
            C
          </div>
          <span className="text-xl font-bold tracking-tight text-zinc-100">Cheevo</span>
        </div>

        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">Link your Xbox account</h1>
          <p className="text-zinc-400 text-sm mt-1">
            Enter your Xbox gamertag to connect your achievement data.
          </p>
        </div>

        {error && (
          <div className="border border-red-700/60 bg-red-950/40 p-3 text-red-300 text-sm rounded-sm">
            {decodeURIComponent(error)}
          </div>
        )}

        <form action={linkAccount} className="space-y-4">
          <div>
            <label className="block text-xs text-zinc-400 uppercase tracking-wider mb-1.5">
              Xbox Gamertag
            </label>
            <input
              name="gamertag"
              type="text"
              placeholder="e.g. tofid"
              required
              className="w-full bg-zinc-800 border border-zinc-700 rounded-sm px-3 py-2 text-zinc-100 text-sm placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-4 py-2.5 rounded-sm text-sm transition-colors"
          >
            Link Account
          </button>
        </form>
      </div>
    </main>
  );
}
