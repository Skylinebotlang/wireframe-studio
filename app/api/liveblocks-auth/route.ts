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

  // 3. Ask Liveblocks for a signed token that grants access to THIS room.
  try {
    const liveblocks = new Liveblocks({ secret: secretKey });

    // prepareSession creates a session for this user, carrying their
    // public info (name/role/color). session.allow() grants them access
    // to the room they asked for — required, otherwise Liveblocks
    // rejects the connection with "You have no access to this room".
    // (For the prototype, everyone gets full access to every room;
    // tighter permissions can come later with a login system.)
    const session = liveblocks.prepareSession(account.id, {
      userInfo: {
        name: identity.name,
        role: identity.role ?? "PM",
        color: identity.color,
      },
    });
    session.allow(room, session.FULL_ACCESS);

    // Also make sure the ROOM itself allows everyone to write.
    // Newer Liveblocks projects have "Access Control" enabled, which makes
    // the room's own access rules win over the token permissions above.
    // This creates the room (with open write access) on first use and
    // patches older rooms that were created without it.
    try {
      const roomData = await liveblocks.getOrCreateRoom(room, {
        defaultAccesses: ["room:write"],
      });
      if (!roomData.defaultAccesses?.length) {
        await liveblocks.updateRoom(room, {
          defaultAccesses: ["room:write"],
        });
      }
    } catch (roomErr) {
      // Non-fatal: if the project doesn't use Access Control, the token
      // permission above is already enough.
      console.error("Room access setup failed (non-fatal):", roomErr);
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
