// ─────────────────────────────────────────────────────────────────────────────
// PROXY — runs before every /api request (Next.js 16's name for middleware).
//
// 1. CSRF guard: a request that changes something (POST, PUT, PATCH, DELETE)
//    must come from our own pages. Another site can't make a visitor's
//    browser call our API with their sign-in cookies.
// 2. Keeps people signed in: when the sign-in pass (ACCESS cookie) is about
//    to run out, swap the REFRESH cookie for a new pair before the route
//    runs, so the route sees a valid pass. If the refresh is refused (signed
//    out elsewhere, password reset), both cookies are cleared.
// Every route still checks the sign-in itself (lib/server/auth-server.ts).
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse, type NextRequest } from "next/server";
import { ACCESS, REFRESH, clearSession, clientIp, expiresAt, isTokens, setSession, supabaseAuth } from "@/lib/server/session";

const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);
// These start or end a session themselves: no automatic refresh.
const NO_REFRESH = /^\/api\/auth\/(signin|signup|signout|forgot|reset|session|refresh)$/;

export async function proxy(request: NextRequest) {
  if (!SAFE.has(request.method) && !sameSite(request)) {
    return NextResponse.json({ error: "This request didn't come from Wireframe Studio." }, { status: 403 });
  }

  const access = request.cookies.get(ACCESS)?.value;
  const refresh = request.cookies.get(REFRESH)?.value;
  const stale = !access || expiresAt(access) - Date.now() / 1000 < 60;
  if (!refresh || !stale || NO_REFRESH.test(request.nextUrl.pathname)) return NextResponse.next();

  const r = await supabaseAuth("token?grant_type=refresh_token", { body: { refresh_token: refresh }, ip: clientIp(request) });
  if (!isTokens(r.data)) {
    // Refused (not a network blip): the session is over.
    if (r.status === 400 || r.status === 401) {
      request.cookies.delete(ACCESS);
      const res = NextResponse.next({ request: { headers: request.headers } });
      clearSession(res);
      return res;
    }
    return NextResponse.next();
  }
  // The route reads the NEW pass in this same request; the browser keeps it.
  request.cookies.set(ACCESS, r.data.access_token);
  const res = NextResponse.next({ request: { headers: request.headers } });
  setSession(res, r.data);
  return res;
}

/** Did this request come from one of our own pages? */
function sameSite(request: NextRequest) {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return false;
  const origin = request.headers.get("origin");
  if (!origin) return true; // not a browser form/fetch (browsers send Origin on these): no cookies to abuse
  try {
    return new URL(origin).host === (request.headers.get("x-forwarded-host") ?? request.headers.get("host"));
  } catch {
    return false;
  }
}

export const config = { matcher: "/api/:path*" };
