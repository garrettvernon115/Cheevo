import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8082";

export const { handlers, signIn, signOut, auth, unstable_update } = NextAuth({
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID!,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET!,
      // Auth.js v5 derives the tenant from `issuer`; omitting it defaults to
      // "common", which allows any Microsoft account (personal/work/school) to
      // sign in — what we want for public multi-user.
      authorization: {
        params: { scope: "openid profile email" },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, trigger, session }) {
      // Store Microsoft account ID on first login
      if (account) {
        token.microsoft_sub = account.providerAccountId;
      }

      // Handle explicit session update (after setup completes)
      if (trigger === "update" && session?.xuid) {
        token.xuid = session.xuid;
      }

      // Look up XUID from backend if not cached yet
      if (token.microsoft_sub && !token.xuid) {
        try {
          const res = await fetch(
            `${API_URL}/api/profile/by-sub/${token.microsoft_sub}`,
            { cache: "no-store" }
          );
          if (res.ok) {
            const data = await res.json();
            token.xuid = data.xuid;
          }
        } catch {
          // backend unavailable — will retry on next request
        }
      }

      return token;
    },
    async session({ session, token }) {
      session.microsoft_sub = token.microsoft_sub as string | undefined;
      session.xuid = token.xuid as string | undefined;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});

declare module "next-auth" {
  interface Session {
    microsoft_sub?: string;
    xuid?: string;
  }
}

// Note: no `next-auth/jwt` augmentation needed — the JWT type already has a
// `Record<string, unknown>` index signature, so token.microsoft_sub / token.xuid
// are accessible without it (and augmenting the subpath breaks `next build`).
