import { auth } from "@/auth";
import { NextResponse } from "next/server";

const API_URL =
  process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8082";

// Returns the current background-sync progress for the signed-in user.
export async function GET() {
  const session = await auth();
  if (!session?.xuid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const res = await fetch(`${API_URL}/api/profile/sync/status`, {
    headers: { "x-user-xuid": session.xuid },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({ status: "idle" }));
  return NextResponse.json(data, { status: res.status });
}
