import { auth } from "@/auth";
import { NextResponse } from "next/server";

const API_URL =
  process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8082";

// Kicks off a background sync for the signed-in user. Returns immediately;
// progress is polled via /api/sync/status.
export async function POST() {
  const session = await auth();
  if (!session?.xuid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const res = await fetch(`${API_URL}/api/profile/sync/start`, {
    method: "POST",
    headers: { "x-user-xuid": session.xuid },
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
