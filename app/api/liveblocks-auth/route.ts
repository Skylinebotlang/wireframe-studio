// ─────────────────────────────────────────────────────────────────────────────
// LIVEBLOCKS AUTH ENDPOINT
//
// When a browser joins a room, Liveblocks asks the server "who is this?"
// This endpoint receives the person's identity (name/role/color chosen on the
// join screen) and returns a signed token that says: "this is user X, and
// here is their info". Liveblocks then shares that info with everyone in the
// room — that's how other windows know your cursor's name and color.
//
// Your SECRET key (sk_...) is used here — on the server only, never in the
// browser. That's why it lives in .env.local WITHOUT the NEXT_PUBLIC_ prefix.
// ─────────────────────────────────────────────────────────────────────────────

import { Liveblocks } from "@liveblocks/node";
import { NextResponse } from "next/server";

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

  if (!room || !ROOM_ID_PATTERN.test(room)) {
    return NextResponse.json({ error: "Invalid room id." }, { status: 400 });
  }
  if (!identity?.id || !identity.name || !identity.color) {
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

  // 3. Ask Liveblocks for a signed token for this user.
  try {
    // In @liveblocks/node v3, the constructor takes an options object and
    // identifyUser takes the user id as a plain string.
    const liveblocks = new Liveblocks({ secret: secretKey });
    const { status, body: token } = await liveblocks.identifyUser(
      identity.id,
      {
        userInfo: {
          name: identity.name,
          role: identity.role ?? "PM",
          color: identity.color,
        },
      }
    );

    if (status !== 200 || !token) {
      console.error("Liveblocks auth failed with status", status);
      return NextResponse.json(
        { error: "Liveblocks rejected the secret key. Double-check the sk_dev_... value in .env.local." },
        { status: 500 }
      );
    }

    // The client-side authEndpoint expects { token } in JSON.
    return NextResponse.json({ token });
  } catch (err) {
    console.error("Liveblocks auth error:", err);
    return NextResponse.json(
      { error: "Could not reach Liveblocks. Check your secret key and internet connection." },
      { status: 500 }
    );
  }
}
