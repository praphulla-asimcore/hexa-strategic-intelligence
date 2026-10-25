import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { adminEmails, allowedDomain, config } from "@/lib/server/config";

// Google Workspace sign-in restricted to the company domain. Roles live in Postgres;
// the JWT carries the role so pages and API routes can authorise without a DB hit.

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login", error: "/login" },
  providers: config.auth()
    ? [
        Google({
          authorization: { params: { hd: allowedDomain(), prompt: "select_account" } },
        }),
      ]
    : [],
  callbacks: {
    async signIn({ profile }) {
      const email = (profile?.email || "").toLowerCase();
      const verified = (profile as { email_verified?: boolean } | undefined)?.email_verified !== false;
      return verified && email.endsWith(`@${allowedDomain()}`);
    },
    async jwt({ token, profile, trigger }) {
      const email = (token.email || "").toLowerCase();
      if ((profile || trigger === "update") && email && config.db()) {
        const { upsertUser } = await import("@/lib/server/db");
        token.role = await upsertUser(email, token.name, token.picture as string | undefined, adminEmails().includes(email));
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) (session.user as { role?: string }).role = (token.role as string) || "viewer";
      return session;
    },
    authorized({ auth, request }) {
      if (!config.auth()) return true; // setup mode: login not configured yet
      const p = request.nextUrl.pathname;
      if (p.startsWith("/login") || p.startsWith("/api/auth") || p.startsWith("/api/cron") || p.startsWith("/api/health")) return true;
      if (auth?.user) return true;
      if (p.startsWith("/api/")) return Response.json({ error: "unauthenticated" }, { status: 401 });
      return false;
    },
  },
});
