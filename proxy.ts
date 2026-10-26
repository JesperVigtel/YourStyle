import { NextResponse, type NextRequest } from "next/server";
import { refreshSession } from "@/lib/supabase/proxy";

const PUBLIC = ["/login", "/auth/", "/api/auth/", "/offline"];

/**
 * Auth gate. Refreshes the Supabase session and lets only the allowlisted email through:
 * pages redirect to /login, API routes get 401. Route handlers check again (defence in depth).
 */
export async function proxy(request: NextRequest) {
  // Dev/test mode (local backend) has no auth server. It is refused on Vercel in lib/env.ts.
  if (process.env.DATA_BACKEND === "local" && !process.env.VERCEL) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (PUBLIC.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const { response, email } = await refreshSession(request);
  const allowed = process.env.ALLOWED_EMAIL?.trim().toLowerCase();
  if (email && allowed && email === allowed) return response;

  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const login = new URL("/login", request.url);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icons/|manifest.webmanifest|sw.js|favicon.ico|robots.txt).*)"],
};
