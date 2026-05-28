import { auth } from "@/auth";
import { NextResponse } from "next/server";

const API_URL =
  process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8082";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.xuid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const achievements = searchParams.get("achievements") !== "false";

  const res = await fetch(
    `${API_URL}/api/profile/sync?achievements=${achievements}`,
    {
      method: "POST",
      headers: { "x-user-xuid": session.xuid },
    }
  );

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
