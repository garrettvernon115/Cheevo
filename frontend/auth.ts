import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

const API_URL =
  process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8082";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      id: "openxbl",
      name: "Xbox",
      credentials: { code: {} },
      // OpenXBL OAuth redirects to /api/openxbl/callback with a ?code. We exchange
      // that code for the user's identity + per-user token via the backend claim
      // endpoint. A session is only created if the claim succeeds, so a session
      // can't be forged without a valid (single-use) code.
      async authorize(credentials) {
        const code = typeof credentials?.code === "string" ? credentials.code : "";
        if (!code) return null;

        const res = await fetch(`${API_URL}/api/auth/openxbl/claim`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
          cache: "no-store",
        });
        if (!res.ok) return null;

        const u = await res.json();
        if (!u?.xuid) return null;

        return {
          id: String(u.xuid),
          name: u.gamertag ?? null,
          email: u.email ?? null,
          image: u.avatar_url ?? null,
          xuid: String(u.xuid),
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user && "xuid" in user && user.xuid) {
        token.xuid = user.xuid as string;
      }
      return token;
    },
    async session({ session, token }) {
      session.xuid = token.xuid as string | undefined;
      return session;
    },
  },
  pages: { signIn: "/login" },
});

declare module "next-auth" {
  interface Session {
    xuid?: string;
  }
  interface User {
    xuid?: string;
  }
}
