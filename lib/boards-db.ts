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
  mine: boolean; // this person made it (only they may delete it)
  others: string[]; // names of other people who opened it, most recent first
};

type Row = { last_opened_at: string; boards: { id: string; name: string; created_by: string; updated_at: string } };

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
      `&select=last_opened_at,boards(id,name,created_by,updated_at)&order=last_opened_at.desc&limit=100`
  );
  // Who else opened these boards (one query for all of them).
  const ids = rows.map((r) => r.boards.id);
  const people: { board_id: string; user_id: string; user_name: string | null }[] = ids.length
    ? await rest(
        `board_visits?board_id=in.(${ids.map((id) => `"${id}"`).join(",")})` +
          `&user_id=neq.${encodeURIComponent(userId)}&select=board_id,user_id,user_name&order=last_opened_at.desc&limit=1000`
      )
    : [];
  return rows.map((r) => ({
    id: r.boards.id,
    name: r.boards.name,
    createdBy: r.boards.created_by,
    updatedAt: r.boards.updated_at,
    lastOpenedAt: r.last_opened_at,
    mine: r.boards.created_by === userId,
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
  // Upsert without overwriting an existing name or creator.
  await rest("boards?on_conflict=id", {
    method: "POST",
    headers: { prefer: "resolution=ignore-duplicates" },
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
 * Delete a board from the list: only its creator may. Its visits and
 * decision log go with it (database cascade). Returns false if not allowed.
 * (The drawings in Liveblocks are deleted by the caller.)
 */
export async function deleteBoard(userId: string, boardId: string): Promise<boolean> {
  const rows: { created_by: string }[] = await rest(`boards?id=eq.${encodeURIComponent(boardId)}&select=created_by`);
  if (!rows.length || rows[0].created_by !== userId) return false;
  await rest(`boards?id=eq.${encodeURIComponent(boardId)}`, { method: "DELETE" });
  return true;
}
