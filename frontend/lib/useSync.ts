"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SyncState = {
  status: "idle" | "running" | "complete" | "error";
  total: number;
  done: number;
  achievements: number;
  error?: string;
};

const INITIAL: SyncState = { status: "idle", total: 0, done: 0, achievements: 0 };

/**
 * Starts a background sync and polls its progress.
 * `onComplete` fires once when the sync finishes successfully (e.g. to refresh
 * the page so freshly-synced data shows).
 */
export function useSync(onComplete?: () => void) {
  const [state, setState] = useState<SyncState>(INITIAL);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  }, []);

  // Clear the poll interval if the component unmounts mid-sync.
  useEffect(() => stop, [stop]);

  const start = useCallback(async () => {
    setState({ ...INITIAL, status: "running" });
    try {
      const res = await fetch("/api/sync/start", { method: "POST" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setState({ ...INITIAL, status: "error", error: d.detail ?? `Couldn't start sync (${res.status})` });
        return;
      }
    } catch {
      setState({ ...INITIAL, status: "error", error: "Couldn't reach the server." });
      return;
    }

    stop();
    timer.current = setInterval(async () => {
      try {
        const res = await fetch("/api/sync/status");
        const s = await res.json();
        setState({
          status: s.status ?? "running",
          total: s.total_games ?? 0,
          done: s.synced_games ?? 0,
          achievements: s.achievements_synced ?? 0,
          error: s.error ?? undefined,
        });
        if (s.status === "complete" || s.status === "error") {
          stop();
          if (s.status === "complete") onComplete?.();
        }
      } catch {
        /* transient poll error — keep polling */
      }
    }, 2000);
  }, [stop, onComplete]);

  return { state, start };
}
