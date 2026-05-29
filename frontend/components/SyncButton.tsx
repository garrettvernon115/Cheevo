"use client";

import { useRouter } from "next/navigation";
import { useSync } from "@/lib/useSync";

export default function SyncButton() {
  const router = useRouter();
  const { state, start } = useSync(() => router.refresh());

  const syncing = state.status === "running";
  const pct = state.total > 0 ? Math.round((state.done / state.total) * 100) : 0;

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={start}
        disabled={syncing}
        className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium hover:bg-green-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      >
        {syncing
          ? state.total > 0
            ? `Syncing ${state.done}/${state.total}`
            : "Syncing…"
          : "Sync Now"}
      </button>

      {syncing && state.total > 0 && (
        <div className="h-1 w-40 overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {(state.status === "error" || state.status === "partial") && (
        <span className="max-w-[240px] text-right text-xs text-amber-400">
          {state.error ?? "Sync failed."}
        </span>
      )}
    </div>
  );
}
