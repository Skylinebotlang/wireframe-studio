// ─────────────────────────────────────────────────────────────────────────────
// SIGN-IN CHECK (server side) — "who is calling this API?" SERVER ONLY.
//
// The browser sends its sign-in pass in an HttpOnly cookie (set by
// app/api/auth, renewed by proxy.ts; see lib/server/session.ts). We ask
// Supabase whether that pass is real and still valid, and get back the
// person's id, email and name. No pass, or a fake or expired one → null, and
// the route answers "please sign in".
// ─────────────────────────────────────────────────────────────────────────────

import { ACCESS, readCookie, supabaseAuth } from "./session";

export type SignedInUser = { id: string; email: string; name: string };

/** The raw sign-in pass from the request's cookie (not checked yet). */
export const accessToken = (request: Request) => readCookie(request, ACCESS);

export async function getSignedInUser(request: Request): Promise<SignedInUser | null> {
  const token = accessToken(request);
  return token ? userFromToken(token) : null;
}

/** Ask Supabase who a sign-in pass belongs to (null if it isn't valid). */
export async function userFromToken(token: string): Promise<SignedInUser | null> {
  const { ok, data: u } = await supabaseAuth("user", { token });
  if (!ok || typeof u.id !== "string") return null;
  const email = typeof u.email === "string" ? u.email : "";
  const meta = u.user_metadata as { name?: unknown } | undefined;
  return { id: u.id, email, name: (typeof meta?.name === "string" && meta.name) || email.split("@")[0] };
}
