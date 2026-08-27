import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const pathname = nextUrl.pathname;

      // Protect dashboard and all sub-routes
      if (pathname.startsWith("/dashboard")) {
        return isLoggedIn; // false = redirect to signIn page
      }

      // Redirect logged-in users away from auth pages
      if (pathname === "/login" || pathname === "/register") {
        if (isLoggedIn) {
          return Response.redirect(new URL("/dashboard", nextUrl));
        }
        return true;
      }

      // Allow everything else (home, share, api, etc.)
      return true;
    },

    jwt({ token, user, account }) {
      // On first sign-in, user object is available
      if (user) {
        token.id = user.id;
        token.email = user.email;
      }
      // Track provider for debugging
      if (account) {
        token.provider = account.provider;
      }
      return token;
    },

    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  providers: [], // Populated in lib/auth.ts (not edge-safe)
};
