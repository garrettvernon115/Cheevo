import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Demo mode: the whole site is a public, read-only showcase — no auth gating.
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") return;

  // Not logged in → login page
  if (!req.auth) {
    if (pathname === "/login") return;
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  // Logged in, no XUID linked yet → setup (unless already there)
  if (!req.auth.xuid && pathname !== "/setup") {
    return NextResponse.redirect(new URL("/setup", req.nextUrl));
  }

  // Logged in with XUID, trying to hit login or setup → home
  if (req.auth.xuid && (pathname === "/login" || pathname === "/setup")) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
