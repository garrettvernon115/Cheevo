import { signIn } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

// OpenXBL redirects here after the user signs in with Microsoft, carrying a
// single-use ?code. We hand it to the "openxbl" Credentials provider, which
// claims it via the backend and establishes the session, then redirects home.
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", req.nextUrl));
  }
  // signIn throws a redirect (to "/" on success, or the login page with an
  // error on failure); the route handler propagates it.
  await signIn("openxbl", { code, redirectTo: "/" });
}
