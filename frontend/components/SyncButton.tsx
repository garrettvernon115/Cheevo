"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Notice = { kind: "error" | "info"; text: string };

export default function SyncButton() {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  async function handleSync() {
    setSyncing(true);
    setNotice(null);
    try {
      const res = await fetch("/api/sync?achievements=true", { method: "POST" });

      // Rate limited — not a failure, just try later. Keep it calm.
      if (res.status === 429) {
        const data = await res.json().catch(() => ({}));
        setNotice({
          kind: "info",
          text: data.detail ?? "Xbox is rate-limiting syncs right now. Try again in a few minutes.",
        });
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail ?? `Sync failed (${res.status})`);
      }

      router.refresh();
    } catch (err) {
      setNotice({ kind: "error", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleSync}
        disabled={syncing}
        className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {syncing ? "Syncing..." : "Sync Now"}
      </button>
      {notice && (
        <span
          className={`max-w-[220px] text-right text-xs ${
            notice.kind === "info" ? "text-amber-400" : "text-red-400"
          }`}
        >
          {notice.text}
        </span>
      )}
    </div>
  );
}
