// ─────────────────────────────────────────────────────────────────────────────
// SIGN-IN CHECK (server side) — "who is calling this API?" SERVER ONLY.
//
// The browser sends `Authorization: Bearer <token>` (see authHeader() in
// lib/auth.ts). We ask Supabase whether that token is real and still valid,
// and get back the person's id, email and name. No token, or a fake or
// expired one → null, and the route answers "please sign in".
// ─────────────────────────────────────────────────────────────────────────────

export type SignedInUser = { id: string; email: string; name: string };

export async function getSignedInUser(request: Request): Promise<SignedInUser | null> {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!token || !url || !key) return null;
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/auth/v1/user`, {
      headers: { apikey: key, authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const u = await res.json();
    if (typeof u?.id !== "string") return null;
    const email = typeof u.email === "string" ? u.email : "";
    return { id: u.id, email, name: u.user_metadata?.name || email.split("@")[0] };
  } catch {
    return null;
  }
}
