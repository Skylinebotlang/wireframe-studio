// ─────────────────────────────────────────────────────────────────────────────
// BOARDS DATABASE — talks to Supabase for the saved boards list. SERVER ONLY.
//
// Uses Supabase's REST API with plain fetch (no extra library). The secret
// key (SUPABASE_SECRET_KEY) never leaves the server; the browser only talks
// to our own /api/boards route. Tables: supabase/boards.sql.
// ─────────────────────────────────────────────────────────────────────────────

export type Board = {
  id: string; // the Liveblocks room id, used in /room/<id>
  name: string;
  createdBy: string;
  updatedAt: string; // ISO time, last opened by anyone
  lastOpenedAt: string; // ISO time, last opened by THIS person
  mine: boolean; // this person is an owner (only owners may delete it)
  role: Role; // this person's role on it
  others: string[]; // names of other people who opened it, most recent first
};

type Row = { last_opened_at: string; role: Role; boards: { id: string; name: string; created_by: string; updated_at: string } };

function config() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key || key.includes("paste_yours_here")) return null;
  return { url: url.replace(/\/$/, ""), key };
}

export const boardsConfigured = () => config() !== null;

// One request to Supabase's REST API. Throws on failure (callers catch it).
// Also used by lib/decisions-db.ts.
export async function rest(path: string, init: RequestInit = {}) {
  const c = config();
  if (!c) throw new Error("Supabase is not set up");
  const res = await fetch(`${c.url}/rest/v1/${path}`, {
    ...init,
    headers: {
      // New-style sb_secret_ keys go ONLY in "apikey" (as a Bearer token
      // they are rejected, because they are not login tokens).
      apikey: c.key,
      "content-type": "application/json",
      ...init.headers,
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text().catch(() => "")}`);
  // Writes answer with an empty body (201/204); reads answer with JSON.
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

/** The boards this person has opened, most recent first. */
export async function listBoards(userId: string): Promise<Board[]> {
  const rows: Row[] = await rest(
    `board_visits?user_id=eq.${encodeURIComponent(userId)}` +
      `&select=last_opened_at,role,boards(id,name,created_by,updated_at)&order=last_opened_at.desc&limit=100`
  );
  // Who else opened these boards (one query for all of them).
  const ids = rows.map((r) => r.boards.id);
  const people: { board_id: string; user_id: string; user_name: string | null }[] = ids.length
    ? await rest(
        `board_visits?board_id=in.(${ids.map((id) => `"${id}"`).join(",")})` +
          `&user_id=neq.${encodeURIComponent(userId)}&select=board_id,user_id,user_name&order=last_opened_at.desc&limit=1000`
      ).then((rows: { board_id: string; user_id: string; user_name: string | null }[]) =>
        rows.filter((p) => !isLegacyId(p.user_id))
      )
    : [];
  return rows.map((r) => ({
    id: r.boards.id,
    name: r.boards.name,
    createdBy: r.boards.created_by,
    updatedAt: r.boards.updated_at,
    lastOpenedAt: r.last_opened_at,
    mine: r.role === "owner",
    role: r.role,
    others: people.filter((p) => p.board_id === r.boards.id).map((p) => p.user_name || "Someone"),
  }));
}

/**
 * Record that this person opened a board. Creates the board on first sight
 * (rooms made by just typing a link get their id as a name), refreshes its
 * "last opened" time, and adds it to this person's list.
 */
export async function visitBoard(userId: string, boardId: string, name?: string, userName?: string) {
  const now = new Date().toISOString();
  // Upsert without overwriting an existing name or creator. Returns the row
  // only if it was just made, i.e. this person created the board.
  const created: unknown[] = await rest("boards?on_conflict=id", {
    method: "POST",
    headers: { prefer: "resolution=ignore-duplicates,return=representation" },
    body: JSON.stringify({ id: boardId, name: name || boardId, created_by: userId }),
  });
  await rest(`boards?id=eq.${encodeURIComponent(boardId)}`, {
    method: "PATCH",
    body: JSON.stringify({ updated_at: now }),
  });
  await rest("board_visits?on_conflict=board_id,user_id", {
    method: "POST",
    headers: { prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ board_id: boardId, user_id: userId, last_opened_at: now, ...(userName ? { user_name: userName.slice(0, 80) } : {}) }),
  });
  // A new visitor's role defaults to viewer (database default, never
  // overwritten on later visits). The person who just created it is owner.
  // Boards made before real sign-in belong to an old browser identity
  // ("user-…") that nobody can sign in as any more: if a board has no owner
  // with a real account, the first signed-in person to open it takes over.
  // Both go through claim_board_owner, which the database makes all-or-
  // nothing: a board has exactly ONE owner, even if two people arrive at once.
  if (created?.length || !isLegacyId(userId)) await claimOwner(boardId, userId);
}

// Become owner if the board has no real owner yet. Never blocks opening the
// board: if it fails, the person just keeps their role.
async function claimOwner(boardId: string, userId: string) {
  try {
    await rest("rpc/claim_board_owner", { method: "POST", body: JSON.stringify({ p_board: boardId, p_user: userId }) });
  } catch (err) {
    console.error("Boards: couldn't check the board's owner:", err);
  }
}

/** Old pre-sign-in browser identities (lib/user.ts) look like "user-<uuid>". */
const isLegacyId = (id: string) => id.startsWith("user-");

// ── Roles: Owner / Editor / Viewer, one per person per board ─────────────────
// Exactly ONE owner per board (the database enforces it: supabase/boards.sql).
// Making someone else owner hands the board over: you become an editor.

export type Role = "owner" | "editor" | "viewer";
export const ROLES: Role[] = ["owner", "editor", "viewer"];
export type Member = { userId: string; name: string; role: Role };

/** This person's role on a board, or null if they've never opened it. */
export async function getRole(userId: string, boardId: string): Promise<Role | null> {
  const rows: { role: Role }[] = await rest(
    `board_visits?board_id=eq.${encodeURIComponent(boardId)}&user_id=eq.${encodeURIComponent(userId)}&select=role`
  );
  return rows[0]?.role ?? null;
}

/** May this person change the board (draw, run the agent)? */
export const canEdit = (role: Role | null) => role === "owner" || role === "editor";

/**
 * For the AI and decision routes: null if this person may change the board,
 * else a friendly message. No database set up → allowed (nothing to check).
 */
export async function editorCheck(userId: string, boardId: string): Promise<string | null> {
  if (!boardsConfigured()) return null;
  try {
    return canEdit(await getRole(userId, boardId))
      ? null
      : "You're a viewer on this board. Ask an owner to make you an editor.";
  } catch (err) {
    console.error("Role check failed:", err);
    return "Couldn't check your access to this board. Please try again.";
  }
}

/** Everyone who has opened a board, owners first. */
export async function listMembers(boardId: string): Promise<Member[]> {
  const rows: { user_id: string; user_name: string | null; role: Role }[] = await rest(
    `board_visits?board_id=eq.${encodeURIComponent(boardId)}&select=user_id,user_name,role&order=last_opened_at.desc&limit=200`
  );
  return rows
    .filter((r) => !isLegacyId(r.user_id)) // old browser identities can't sign in: not real members
    .map((r) => ({ userId: r.user_id, name: r.user_name || "Someone", role: r.role }))
    .sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role));
}

/**
 * The owner changes someone's role. Returns an error message, or null.
 *   • role "owner" → hand the board over: they become owner, you become editor
 *   • the owner can't demote themselves (hand the board over instead)
 */
export async function changeRole(byUserId: string, boardId: string, userId: string, role: Role): Promise<string | null> {
  if ((await getRole(byUserId, boardId)) !== "owner") return "Only the owner can change roles.";
  if (userId === byUserId) {
    return role === "owner" ? null : "You're the owner. To step down, make someone else the owner.";
  }
  const target = await getRole(userId, boardId);
  if (!target) return "That person hasn't opened this board.";
  if (role === "owner") {
    const ok = await rest("rpc/transfer_board_owner", {
      method: "POST",
      body: JSON.stringify({ p_board: boardId, p_from: byUserId, p_to: userId }),
    });
    return ok === true ? null : "Couldn't hand over the board. Please try again.";
  }
  await setRoleRow(boardId, userId, role);
  return null;
}

async function setRoleRow(boardId: string, userId: string, role: Role) {
  await rest(`board_visits?board_id=eq.${encodeURIComponent(boardId)}&user_id=eq.${encodeURIComponent(userId)}`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}

/** Rename a board. Only people who have opened it may rename it. */
export async function renameBoard(userId: string, boardId: string, name: string): Promise<boolean> {
  const visits = await rest(
    `board_visits?board_id=eq.${encodeURIComponent(boardId)}&user_id=eq.${encodeURIComponent(userId)}&select=board_id`
  );
  if (!visits.length) return false;
  await rest(`boards?id=eq.${encodeURIComponent(boardId)}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
  return true;
}

/**
 * Delete a board from the list: only the owner may. Its visits and
 * decision log go with it (database cascade). Returns false if not allowed.
 * (The drawings in Liveblocks are deleted by the caller.)
 */
export async function deleteBoard(userId: string, boardId: string): Promise<boolean> {
  if ((await getRole(userId, boardId)) !== "owner") return false;
  await rest(`boards?id=eq.${encodeURIComponent(boardId)}`, { method: "DELETE" });
  return true;
}
