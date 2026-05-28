import { auth } from "@/auth";

/**
 * Demo mode turns Cheevo into a public, read-only showcase of a single account.
 * No login is required, and write actions (sync) are hidden. Toggle it with the
 * NEXT_PUBLIC_DEMO_MODE env var so the same codebase can later run in normal
 * multi-user mode by flipping the flag off.
 */
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

/** The XUID whose synced library is shown publicly in demo mode. */
export const DEMO_XUID = process.env.DEMO_XUID ?? "";

/**
 * The XUID whose data the current request should display.
 * - Demo mode: always the configured demo account (no login required).
 * - Normal mode: the signed-in user's XUID, or null if not signed in.
 */
export async function getViewerXuid(): Promise<string | null> {
  if (DEMO_MODE) return DEMO_XUID || null;
  const session = await auth();
  return session?.xuid ?? null;
}
