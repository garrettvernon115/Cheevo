import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

// OpenXBL redirects here after the user signs in with Microsoft, carrying a
// single-use ?code. We hand it to the "openxbl" Credentials provider, which
// claims it via the backend and establishes the session, then redirects home.
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", req.nextUrl));
  }

  try {
    // On success this throws a NEXT_REDIRECT to "/", which we must let propagate.
    await signIn("openxbl", { code, redirectTo: "/" });
  } catch (error) {
    // A failed claim surfaces as an AuthError (CredentialsSignin) — redirect to
    // the login page with an error instead of returning a 500.
    if (error instanceof AuthError) {
      return NextResponse.redirect(new URL("/login?error=signin_failed", req.nextUrl));
    }
    throw error;
  }
}
