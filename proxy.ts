import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

// Create the auth middleware
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;

  // ── Protect /dashboard ──
  if (pathname.startsWith("/dashboard")) {
    if (isLoggedIn) return; // Allow
    const loginUrl = new URL("/login", req.nextUrl);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return Response.redirect(loginUrl);
  }

  // ── Redirect logged-in users away from auth pages ──
  if (pathname === "/login" || pathname === "/register") {
    if (isLoggedIn) {
      return Response.redirect(new URL("/dashboard", req.nextUrl));
    }
    return; // Allow
  }

  // ── Allow everything else ──
  return;
});

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - api routes (handled by route handlers)
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - share pages (public)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|share).*)",
  ],
};
