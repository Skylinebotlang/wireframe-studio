// ─────────────────────────────────────────────────────────────────────────────
// LIVEBLOCKS AUTH ENDPOINT
//
// When a browser joins a room, Liveblocks asks the server "who is this?"
// This endpoint receives the person's identity (name/role/color chosen on the
// join screen) and returns a signed token that says: "this is user X, and
// here is their info". Liveblocks then shares that info with everyone in the
// room — that's how other windows know your cursor's name and color.
//
// SIGN-IN REQUIRED: the browser must send its Supabase sign-in token. No
// valid token → 401, and Liveblocks won't let them into the room. The
// person's Liveblocks id is their account id (from the token, not from
// anything the browser claims).
//
// Your SECRET key (sk_...) is used here — on the server only, never in the
// browser. That's why it lives in .env.local WITHOUT the NEXT_PUBLIC_ prefix.
// ─────────────────────────────────────────────────────────────────────────────

import { Liveblocks } from "@liveblocks/node";
import { NextResponse } from "next/server";
import { getSignedInUser } from "@/lib/auth-server";
import { boardsConfigured, canEdit, getRole, visitBoard } from "@/lib/boards-db";

// Only letters, numbers, dashes and underscores are allowed in room ids.
const ROOM_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export async function POST(request: Request) {
  // 1. Read what the browser sent: which room, and who is joining.
  let body: {
    room?: string;
    identity?: { id?: string; name?: string; role?: string; color?: string };
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const room = body.room;
  const identity = body.identity;

  const account = await getSignedInUser(request);
  if (!account) {
    return NextResponse.json({ error: "Please sign in to open boards." }, { status: 401 });
  }

  if (!room || !ROOM_ID_PATTERN.test(room)) {
    return NextResponse.json({ error: "Invalid room id." }, { status: 400 });
  }
  if (!identity?.name || !identity.color) {
    return NextResponse.json(
      { error: "Missing identity (id, name, color)." },
      { status: 400 }
    );
  }

  // 2. Make sure the secret key is actually configured.
  const secretKey = process.env.LIVEBLOCKS_SECRET_KEY;
  if (!secretKey || secretKey.includes("paste_yours_here")) {
    return NextResponse.json(
      {
        error:
          "LIVEBLOCKS_SECRET_KEY is not set. Open .env.local inside the canvas-team folder, paste your sk_dev_... key from liveblocks.io/dashboard (see .env.local.example for instructions), then restart 'npm run dev'.",
      },
      { status: 500 }
    );
  }

  // 3. This person's role on the board (lib/boards-db.ts). First time here?
  // Record the visit first: someone new joins as a viewer, the person who
  // just created it is owner. (Later visits are recorded by PUT /api/boards,
  // in parallel, so joining stays fast.) No database set up → everyone edits.
  let editor = true;
  if (boardsConfigured()) {
    try {
      let role = await getRole(account.id, room);
      if (!role) {
        await visitBoard(account.id, room, undefined, account.name);
        role = await getRole(account.id, room);
      }
      editor = canEdit(role);
    } catch (err) {
      console.error("Liveblocks auth: couldn't read the role:", err);
      return NextResponse.json({ error: "Couldn't check your access to this board. Please try again." }, { status: 502 });
    }
  }
  // Viewers may look and show their cursor, but not change the canvas or the
  // agent panel. Liveblocks enforces it, so browser tricks can't get round it.
  const VIEW = ["room:read", "room:presence:write"] as const;

  // 4. Ask Liveblocks for a signed token that grants access to THIS room.
  try {
    const liveblocks = new Liveblocks({ secret: secretKey });

    // prepareSession creates a session for this user, carrying their
    // public info (name/role/color). session.allow() grants them access
    // to the room they asked for: full for owners/editors, look-only for
    // viewers.
    const session = liveblocks.prepareSession(account.id, {
      userInfo: {
        name: identity.name,
        role: identity.role ?? "PM",
        color: identity.color,
      },
    });
    session.allow(room, editor ? session.FULL_ACCESS : session.READ_ACCESS);

    // The ROOM's own access rules say the same thing (newer Liveblocks
    // projects with "Access Control" let room rules win over the token):
    // by default look-only, plus write for this person if they may edit.
    // Created on first use; only updated when the rules actually changed
    // (each call to Liveblocks takes a moment, and this runs on every join).
    const existing = await liveblocks.getOrCreateRoom(room, {
      defaultAccesses: [...VIEW],
      usersAccesses: editor ? { [account.id]: ["room:write"] } : {},
    });
    const defaultsOk =
      existing.defaultAccesses.length === VIEW.length && VIEW.every((a) => existing.defaultAccesses.includes(a));
    const mineOk = editor ? !!existing.usersAccesses?.[account.id]?.includes("room:write") : !existing.usersAccesses?.[account.id];
    if (!defaultsOk || !mineOk) {
      await liveblocks.updateRoom(room, {
        defaultAccesses: [...VIEW],
        usersAccesses: { [account.id]: editor ? ["room:write"] : null },
      });
    }

    const { status, body: token } = await session.authorize();

    if (status !== 200 || !token) {
      console.error("Liveblocks auth failed with status", status);
      return NextResponse.json(
        { error: "Liveblocks rejected the secret key. Double-check the sk_dev_... value in .env.local." },
        { status: 500 }
      );
    }

    // `token` is already the JSON the browser expects ({ "token": "…" }).
    return new Response(token, { headers: { "content-type": "application/json" } });
  } catch (err) {
    console.error("Liveblocks auth error:", err);
    return NextResponse.json(
      { error: "Could not reach Liveblocks. Check your secret key and internet connection." },
      { status: 500 }
    );
  }
}
