"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSync } from "@/lib/useSync";

// Shown right after a new user signs in (no games yet): auto-starts their first
// sync and shows live progress, then lets them into the dashboard.
export default function FirstSync() {
  const router = useRouter();
  const { state, start } = useSync();
  const started = useRef(false);

  useEffect(() => {
    if (!started.current) {
      started.current = true;
      start();
    }
  }, [start]);

  const pct = state.total > 0 ? Math.round((state.done / state.total) * 100) : 0;
  const done = state.status === "complete";
  const errored = state.status === "error";

  return (
    <main className="min-h-screen bg-[#2b2d30] flex items-center justify-center px-8">
      <div className="w-full max-w-[420px] space-y-7 text-center">
        {/* logo */}
        <div className="flex items-center justify-center gap-2.5 select-none">
          <span className="h-9 w-9 rounded-lg overflow-hidden bg-zinc-900 ring-1 ring-emerald-500/60 flex items-center justify-center shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/cheevo-mark.png" alt="Cheevo" className="h-full w-full object-cover" />
          </span>
          <span className="text-xl font-extrabold tracking-tight leading-none">
            <span className="text-white">Chee</span>
            <span className="text-emerald-400">vo</span>
          </span>
        </div>

        <div className="space-y-1.5">
          <h1 className="text-xl font-bold text-white tracking-tight">
            {done ? "You're all caught up" : errored ? "Sync hit a snag" : "Pulling your achievements"}
          </h1>
          <p className="text-sm text-zinc-400">
            {done
              ? "Your library is synced and ready."
              : errored
              ? state.error ?? "Something went wrong syncing your library."
              : "Hang tight — pulling your games and achievements from Xbox."}
          </p>
        </div>

        {/* progress card */}
        <div className="border border-zinc-800 rounded-lg p-5 bg-[#222427] space-y-3">
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] uppercase tracking-widest text-zinc-500 font-mono">
              {done ? "Complete" : errored ? "Stopped" : "Syncing"}
            </span>
            <span className="text-2xl font-bold text-emerald-400 tabular-nums">{pct}%</span>
          </div>
          <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${errored ? "bg-red-500/70" : "bg-emerald-500"}`}
              style={{ width: `${errored ? 100 : pct}%` }}
            />
          </div>
          <p className="text-xs text-zinc-500 tabular-nums">
            {state.total > 0
              ? `${state.done} of ${state.total} games · ${state.achievements.toLocaleString()} achievements`
              : "Starting…"}
          </p>
        </div>

        {done && (
          <button
            type="button"
            onClick={() => router.refresh()}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-5 py-3 rounded-md transition-colors text-sm"
          >
            Enter Cheevo →
          </button>
        )}
        {errored && (
          <button
            type="button"
            onClick={() => {
              started.current = true;
              start();
            }}
            className="w-full border border-zinc-700 hover:border-zinc-500 text-zinc-200 font-medium px-5 py-3 rounded-md transition-colors text-sm"
          >
            Try again
          </button>
        )}
      </div>
    </main>
  );
}
