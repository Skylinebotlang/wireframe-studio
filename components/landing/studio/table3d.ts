// ─────────────────────────────────────────────────────────────────────────────
// THE ROUND TABLE (3D) — the story scene behind the top of the new landing
// page (/new). Loaded on demand by Story.tsx, which tells it how far the
// story has scrolled (u = 0 … 5, fractional between chapters).
//
//   0  Hero       a dark room, one lamp over a round table. A PM, a designer
//                 and a developer sit around it, notes scattered. In the
//                 middle, a small orange ember: the AI, waiting.
//   1  The mess   each person's note stands up: three different checkouts.
//   2  Reading    the ember rises and glows; the notes gather around it,
//                 each tied to it by a thin orange thread.
//   3  The clash  the PM's and the developer's notes turn to face each other;
//                 an orange decision card appears between them.
//   4  Screens    two phone wireframes are drawn up out of the table, outlined
//                 in orange while they build; the notes go back to their owners.
//   5  Context    the camera rises overhead: the screens lie on the table and a
//                 copy of the decision sits in front of every person.
//
// Colors: the page's blacks, wine for people's notes, ORANGE = the AI only.
// Reduced motion: nothing drifts, the scene jumps straight to each chapter.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from "three";
import { createPerson, type Role } from "./people3d";

const VOID = 0x090719; // navy room, same as the page
const INK = 0xf8f4f5;
const FAINT = 0x9e99a8;
const WINE = 0x681e2e;
const ROSE = 0xe0607e;
const AI = 0xff6b2c;

const lin = (hex: number) => new THREE.Color(hex).convertSRGBToLinear();
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const range = (u: number, a: number, b: number) => clamp01((u - a) / (b - a));
const smooth = (x: number) => x * x * (3 - 2 * x);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

export type TableHandle = { setStop: (u: number) => void; dispose: () => void };

type Seat = { kind: Role; role: string; deg: number; collar: number; note: string[] };
const SEATS: Seat[] = [
  { kind: "pm", role: "PM", deg: 205, collar: INK, note: ["Checkout in one step.", "No extra screens."] },
  { kind: "designer", role: "Designer", deg: 270, collar: ROSE, note: ["A big product photo", "on the first screen."] },
  { kind: "developer", role: "Developer", deg: 335, collar: FAINT, note: ["Reuse the cart API.", "Three steps is simpler."] },
];

const TABLE_Y = 1; // top of the table
const TABLE_R = 2.4;
const SEAT_R = 3.0; // chair centres (the people are built in metres: 1 m = 4/3 units)
const PERSON_SCALE = 4 / 3; // so a real 0.75 m table height lands on TABLE_Y

// Camera for each chapter: where it is, what it looks at.
const CAMS = [
  { pos: [-0.45, 4.4, 8.8], look: [-0.45, 1.45, 0] }, // shifted so the PM clears the headline
  { pos: [0, 4.4, 9.4], look: [0, 1.8, 0] },
  { pos: [0, 4.7, 9.0], look: [0, 2.1, 0] },
  { pos: [0.4, 4.0, 8.2], look: [0, 2.0, 0] },
  { pos: [0, 3.9, 7.6], look: [0, 1.8, 0] },
  { pos: [0, 11, 2.4], look: [0, 0.8, 0] },
];

/** Draws a card on a canvas and returns it as a texture. */
function cardTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  draw(g, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.encoding = THREE.sRGBEncoding;
  tex.anisotropy = 4;
  return tex;
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

export function createTable(host: HTMLElement, opts: { reduced: boolean; small: boolean; font: string }): TableHandle {
  const { reduced, small, font } = opts;

  const renderer = new THREE.WebGLRenderer({ antialias: !small, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; // filmic highlights and skin
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(lin(VOID), 1);
  renderer.domElement.setAttribute("aria-hidden", "true");
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(lin(VOID), 9, 22);
  const camera = new THREE.PerspectiveCamera(small ? 58 : 42, 1, 0.1, 100);

  // ── Light: one warm lamp over the table, a little fill ──────────────────
  scene.add(new THREE.AmbientLight(lin(0xffffff), 0.3));
  const rimLight = new THREE.DirectionalLight(lin(0xffffff), 0.35); // soft edge light from behind
  rimLight.position.set(0, 4, -8);
  scene.add(rimLight);
  const lamp = new THREE.SpotLight(lin(0xfff3ea), 1.6, 18, Math.PI / 5.2, 0.55, 1.2);
  lamp.position.set(0, 8, 0.5);
  lamp.target.position.set(0, TABLE_Y, 0);
  lamp.castShadow = true; // soft shadows of people and notes on the table and floor
  lamp.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
  lamp.shadow.camera.near = 3;
  lamp.shadow.camera.far = 12;
  lamp.shadow.bias = -0.0004;
  lamp.shadow.normalBias = 0.02;
  scene.add(lamp, lamp.target);
  const aiLight = new THREE.PointLight(lin(AI), 0, 7, 2);
  scene.add(aiLight);

  // ── Floor: the dotted canvas ─────────────────────────────────────────────
  {
    const pts: number[] = [];
    const step = small ? 0.7 : 0.5;
    for (let x = -14; x <= 14; x += step) for (let z = -14; z <= 10; z += step) pts.push(x, 0.003, z);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: lin(0x34325a), size: small ? 0.05 : 0.04 })));
    // A floor that catches the shadows.
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.MeshStandardMaterial({ color: lin(0x0b0a1f), roughness: 1 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
  }

  // ── The table ────────────────────────────────────────────────────────────
  const tableMat = new THREE.MeshStandardMaterial({ color: lin(0x16152b), roughness: 0.72, metalness: 0.05 }); // matte, no harsh hotspot
  const top = new THREE.Mesh(new THREE.CylinderGeometry(TABLE_R, TABLE_R, 0.12, 72), tableMat);
  top.position.y = TABLE_Y - 0.06;
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.45, TABLE_Y - 0.12, 24), tableMat);
  leg.position.y = (TABLE_Y - 0.12) / 2;
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(TABLE_R, 0.025, 8, 96),
    new THREE.MeshStandardMaterial({ color: lin(WINE), emissive: lin(WINE), emissiveIntensity: 0.6 }),
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = TABLE_Y;
  top.castShadow = top.receiveShadow = true;
  leg.castShadow = true;
  scene.add(top, leg, rim);

  // ── The people (people3d.ts): sculpted, seated, each facing the table ────
  const seatDir = SEATS.map((s) => {
    const a = (s.deg * Math.PI) / 180;
    return new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
  });
  const people = SEATS.map((s, i) => {
    const d = seatDir[i];
    const p = createPerson(s.kind);
    p.root.scale.setScalar(PERSON_SCALE);
    p.root.position.set(d.x * SEAT_R, 0, d.z * SEAT_R);
    p.root.lookAt(0, 0, 0);
    scene.add(p.root);
    return p;
  });
  // Where each person's eyes are (for who looks at whom).
  const headAt = seatDir.map((d) => new THREE.Vector3(d.x * (SEAT_R - 0.05), 1.62, d.z * (SEAT_R - 0.05)));

  // Name tags over each person.
  const tags = SEATS.map((s, i) => {
    const tex = cardTexture(320, 96, (g, w, h) => {
      roundRect(g, 4, 4, w - 8, h - 8, 44);
      g.fillStyle = "#191a2f";
      g.fill();
      g.fillStyle = `#${s.collar.toString(16).padStart(6, "0")}`;
      g.beginPath();
      g.arc(46, h / 2, 12, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#f8f4f5";
      g.font = `500 40px ${font}`;
      g.textBaseline = "middle";
      g.fillText(s.role, 74, h / 2 + 2);
    });
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }));
    sp.scale.set(0.9, 0.27, 1);
    const d = seatDir[i];
    sp.position.set(d.x * SEAT_R, 2.3, d.z * SEAT_R);
    scene.add(sp);
    return sp;
  });

  // ── The notes: one per person, plus loose scraps for the mess ────────────
  const noteTex = SEATS.map((s) =>
    cardTexture(512, 320, (g, w, h) => {
      roundRect(g, 0, 0, w, h, 28);
      g.fillStyle = "#191a2f";
      g.fill();
      g.save();
      g.clip();
      g.fillStyle = "#681e2e";
      g.fillRect(0, 0, w, 84);
      g.restore();
      g.fillStyle = "#f8f4f5";
      g.font = `600 40px ${font}`;
      g.textBaseline = "middle";
      g.fillText(s.role, 32, 44);
      g.fillStyle = "#cfcad6";
      g.font = `400 38px ${font}`;
      s.note.forEach((line, k) => g.fillText(line, 32, 150 + k * 60));
    }),
  );
  const NOTE_W = 1.15;
  const notes = noteTex.map((map) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(NOTE_W, NOTE_W * 0.625),
      new THREE.MeshBasicMaterial({ map, transparent: true, side: THREE.DoubleSide, toneMapped: false }),
    );
    m.castShadow = true;
    scene.add(m);
    return m;
  });
  const scrapMat = new THREE.MeshStandardMaterial({ color: lin(WINE), roughness: 0.8 });
  const scraps = Array.from({ length: small ? 6 : 10 }, (_, i) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.3), scrapMat);
    const a = (i / 10) * Math.PI * 2 + 0.4;
    const r = 0.9 + ((i * 37) % 9) / 10;
    m.rotation.set(-Math.PI / 2, 0, a * 1.7);
    m.position.set(Math.cos(a) * r, TABLE_Y + 0.006 + i * 0.001, Math.sin(a) * r);
    scene.add(m);
    return m;
  });

  // ── The AI: an orange ember with a soft glow ─────────────────────────────
  const glowTex = cardTexture(128, 128, (g, w, h) => {
    const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    r.addColorStop(0, "rgba(255,107,44,0.9)");
    r.addColorStop(0.35, "rgba(255,107,44,0.25)");
    r.addColorStop(1, "rgba(255,107,44,0)");
    g.fillStyle = r;
    g.fillRect(0, 0, w, h);
  });
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 16), new THREE.MeshBasicMaterial({ color: lin(AI), toneMapped: false }));
  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
  );
  scene.add(core, glow);

  // Orange threads from each note to the ember.
  const threadMat = new THREE.LineBasicMaterial({ color: lin(AI), transparent: true, opacity: 0, toneMapped: false });
  const threads = notes.map(() => {
    const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const l = new THREE.Line(g, threadMat);
    scene.add(l);
    return l;
  });

  // ── The decision card (and a copy for every seat at the end) ─────────────
  const decisionTex = cardTexture(640, 300, (g, w, h) => {
    roundRect(g, 4, 4, w - 8, h - 8, 28);
    g.fillStyle = "#131224";
    g.fill();
    g.lineWidth = 6;
    g.strokeStyle = "#ff6b2c";
    g.stroke();
    g.textBaseline = "middle";
    g.fillStyle = "#ff6b2c";
    g.font = `600 40px ${font}`;
    g.fillText("Decision", 40, 62);
    g.fillStyle = "#f8f4f5";
    g.font = `500 38px ${font}`;
    g.fillText("2 steps. Guest checkout stays,", 40, 140);
    g.fillText("the photo leads step 1.", 40, 196);
    g.fillStyle = "#9e99a8";
    g.font = `400 30px ${font}`;
    g.fillText("Why: fewer steps, nobody loses their idea.", 40, 252);
  });
  const decisionMat = () => new THREE.MeshBasicMaterial({ map: decisionTex, transparent: true, opacity: 0, side: THREE.DoubleSide, toneMapped: false });
  const decision = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.89), decisionMat());
  scene.add(decision);
  const copies = seatDir.map((d) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 0.49), decisionMat());
    m.position.set(d.x * 1.55, TABLE_Y + 0.02, d.z * 1.55);
    m.rotation.set(-Math.PI / 2, 0, 0); // flat, readable from where the viewer looks
    scene.add(m);
    return m;
  });

  // ── The two phone wireframes the agent draws ─────────────────────────────
  const phoneTex = [0, 1].map((k) =>
    cardTexture(300, 600, (g, w, h) => {
      roundRect(g, 6, 6, w - 12, h - 12, 40);
      g.fillStyle = "#131224";
      g.fill();
      g.fillStyle = "#22213a";
      roundRect(g, 30, 34, w - 60, 34, 17);
      g.fill();
      g.fillStyle = "#9e99a8";
      g.font = `500 22px ${font}`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(k === 0 ? "Step 1 of 2" : "Step 2 of 2", w / 2, 52);
      g.fillStyle = "#22213a";
      if (k === 0) {
        roundRect(g, 30, 92, w - 60, 200, 20);
        g.fill();
        [320, 352, 384].forEach((y, i) => {
          roundRect(g, 30, y, [180, 140, 160][i], 14, 7);
          g.fill();
        });
      } else {
        [100, 170, 240].forEach((y) => {
          g.strokeStyle = "#2b2a42";
          g.lineWidth = 3;
          roundRect(g, 30, y, w - 60, 52, 14);
          g.stroke();
        });
      }
      g.fillStyle = "#681e2e";
      roundRect(g, 30, h - 100, w - 60, 56, 16);
      g.fill();
    }),
  );
  const PHONE_H = 1.5;
  const phones = phoneTex.map((map, k) => {
    const geo = new THREE.PlaneGeometry(PHONE_H / 2, PHONE_H);
    geo.translate(0, PHONE_H / 2, 0); // grow up from the table
    const group = new THREE.Group();
    const face = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map, transparent: true, side: THREE.DoubleSide, toneMapped: false }));
    const edge = new THREE.LineSegments(
      new THREE.EdgesGeometry(geo),
      new THREE.LineBasicMaterial({ color: lin(AI), transparent: true, toneMapped: false }),
    );
    group.add(face, edge);
    group.position.set(k === 0 ? -0.5 : 0.5, TABLE_Y, 0.15);
    scene.add(group);
    return { group, face, edge };
  });

  // ── Size ─────────────────────────────────────────────────────────────────
  let pullBack = 1;
  function resize() {
    const w = Math.max(1, host.clientWidth);
    const h = Math.max(1, host.clientHeight);
    renderer.setSize(w, h); // also sets the canvas's CSS size (matters on high density screens)
    camera.aspect = w / h;
    // Tall, narrow screens (phones) step the camera back; the fog moves with it.
    pullBack = w < h ? 1 + (1 - w / h) * 0.8 : 1;
    const fog = scene.fog as THREE.Fog;
    fog.near = 9 * pullBack;
    fog.far = 22 * pullBack;
    // Desktop: the story text sits on the left, so the table moves right.
    // Phones: the text sits at the bottom, so the table moves up.
    if (w >= 900) camera.setViewOffset(w, h, -w * 0.2, 0, w, h);
    else camera.setViewOffset(w, h, 0, h * 0.14, w, h);
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  // ── Frame loop (only while the scene is on screen) ───────────────────────
  let target = 0;
  let u = 0;
  let raf = 0;
  let onScreen = true;
  const start = performance.now();
  const camPos = new THREE.Vector3();
  const camLook = new THREE.Vector3();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const helper = new THREE.Object3D();
  const flatQ = new THREE.Quaternion();
  const faceQ = new THREE.Quaternion();
  const UP = new THREE.Vector3(0, 1, 0);
  const talking = [0, 0, 0];

  // Development only: open /?debug3d and call window.__tableCam([x,y,z],[x,y,z])
  // in the console to look closely at the models. Ignored for normal visitors.
  let debugCam: { pos: number[]; look: number[] } | null = null;
  if (location.search.includes("debug3d")) {
    (window as unknown as { __tableCam: (p: number[], l: number[]) => void }).__tableCam = (pos, look) => {
      debugCam = { pos, look };
      if (!raf) raf = requestAnimationFrame(frame);
    };
  }

  const io = new IntersectionObserver(([e]) => {
    onScreen = e.isIntersecting;
    if (onScreen && !raf) raf = requestAnimationFrame(frame);
  });
  io.observe(host);

  function frame() {
    raf = 0;
    if (!onScreen || document.hidden) return;
    const t = reduced ? 0 : (performance.now() - start) / 1000;
    u = reduced ? target : u + (target - u) * 0.07;

    // Camera between the two nearest chapters.
    const i0 = Math.min(CAMS.length - 1, Math.floor(u));
    const i1 = Math.min(CAMS.length - 1, i0 + 1);
    const f = smooth(u - i0);
    camPos.set(...(CAMS[i0].pos as [number, number, number])).lerp(a.set(...(CAMS[i1].pos as [number, number, number])), f);
    camLook.set(...(CAMS[i0].look as [number, number, number])).lerp(b.set(...(CAMS[i1].look as [number, number, number])), f);
    if (!reduced) camPos.x += Math.sin(t * 0.15) * 0.15;
    if (pullBack !== 1) camPos.sub(camLook).multiplyScalar(pullBack).add(camLook);
    if (debugCam) {
      camPos.set(debugCam.pos[0], debugCam.pos[1], debugCam.pos[2]);
      camLook.set(debugCam.look[0], debugCam.look[1], debugCam.look[2]);
    }
    camera.position.copy(camPos);
    camera.lookAt(camLook);

    // How far each chapter's change has happened (0 → 1).
    const lift = smooth(range(u, 0.15, 0.85));
    const orbit = smooth(range(u, 1.15, 1.85));
    const clash = smooth(range(u, 2.15, 2.85));
    const draw = smooth(range(u, 3.1, 3.9));
    const over = smooth(range(u, 4.15, 4.85));

    // The AI: an ember at first, rising and glowing while it works.
    const awake = Math.max(orbit, 0.15) * (1 - over * 0.5);
    const coreY = mix(TABLE_Y + 0.25, 2.35, orbit) - draw * 0.35;
    const pulse = reduced ? 1 : 1 + Math.sin(t * 2.4) * 0.06;
    core.position.set(0, coreY, 0);
    core.scale.setScalar(mix(0.6, 1, orbit) * pulse);
    glow.position.copy(core.position);
    glow.scale.setScalar(mix(0.9, 2.6, awake) * pulse);
    aiLight.position.copy(core.position);
    aiLight.intensity = mix(0.4, 2.2, awake);

    // The notes.
    notes.forEach((m, k) => {
      const d = seatDir[k];
      const flat = a.set(d.x * 1.75, TABLE_Y + 0.012, d.z * 1.75);
      const up = b.set(d.x * 1.95, 1.95 + (reduced ? 0 : Math.sin(t * 0.8 + k) * 0.04), d.z * 1.95);
      const pos = flat.clone().lerp(up, lift);
      // Reading: each note takes a spot around the AI (left, back, right), bobbing gently.
      const bob = reduced ? 0 : Math.sin(t * 0.9 + k * 2) * 0.05;
      const slot = k === 0 ? [-1.8, 2.3, 0.3] : k === 2 ? [1.8, 2.3, 0.3] : [0, 3.0, -0.6];
      pos.lerp(helper.position.set(slot[0], slot[1] + bob, slot[2]), orbit);
      const clashAt = k === 0 ? [-1.75, 2.45, 0.1] : k === 2 ? [1.75, 2.45, 0.1] : [0, 3.25, -0.7];
      pos.lerp(helper.position.set(clashAt[0], clashAt[1], clashAt[2]), clash);
      pos.lerp(a.set(d.x * 1.75, TABLE_Y + 0.012, d.z * 1.75), draw);
      m.position.copy(pos);

      // Lying flat (readable from the viewer) ↔ standing, facing the camera.
      helper.rotation.set(-Math.PI / 2, 0, 0);
      flatQ.copy(helper.quaternion);
      helper.position.copy(m.position);
      helper.lookAt(camera.position);
      faceQ.copy(helper.quaternion);
      // The clash: the PM's and the developer's notes turn to face each other.
      if (k !== 1) faceQ.multiply(helper.quaternion.setFromAxisAngle(UP, (k === 0 ? 0.45 : -0.45) * clash));
      const stand = lift * (1 - draw);
      m.quaternion.copy(flatQ).slerp(faceQ, stand);
      m.scale.setScalar(mix(0.85, 1, stand));
      // At the end the decision replaces the notes in front of everyone.
      (m.material as THREE.MeshBasicMaterial).opacity = 1 - over;
      m.visible = over < 0.99;

      // Thread to the AI while it reads and decides.
      const pts = threads[k].geometry.attributes.position as THREE.BufferAttribute;
      pts.setXYZ(0, m.position.x, m.position.y, m.position.z);
      pts.setXYZ(1, core.position.x, core.position.y, core.position.z);
      pts.needsUpdate = true;
    });
    threadMat.opacity = 0.75 * orbit * (1 - draw);
    threads.forEach((l) => (l.visible = threadMat.opacity > 0.01));

    // The scraps disappear once the agent has read everything.
    scraps.forEach((s) => (s.visible = orbit < 0.98));

    // The decision card: appears in the clash, then lies down on the table.
    const dm = decision.material as THREE.MeshBasicMaterial;
    dm.opacity = clash * (1 - over);
    decision.position.set(0, mix(1.75, TABLE_Y + 0.03, draw), mix(1.0, 1.35, draw));
    helper.position.copy(decision.position);
    helper.lookAt(camera.position);
    faceQ.copy(helper.quaternion);
    helper.rotation.set(-Math.PI / 2, 0, 0);
    decision.quaternion.copy(faceQ).slerp(helper.quaternion, draw);
    decision.visible = dm.opacity > 0.01;
    copies.forEach((c) => {
      const cm = c.material as THREE.MeshBasicMaterial;
      cm.opacity = over;
      c.visible = over > 0.01;
    });

    // The screens: drawn up out of the table in orange, then lie down.
    phones.forEach((p, k) => {
      const grow = smooth(clamp01(draw * 1.4 - k * 0.3));
      p.group.visible = grow > 0.01;
      p.group.scale.set(1, Math.max(0.001, grow), 1);
      p.group.rotation.x = -Math.PI / 2 * over;
      p.group.position.z = mix(0.15, 0.9, over); // lie down toward the viewer, clear of the seats
      p.group.position.y = TABLE_Y + 0.03 * over; // just above the tabletop, so they don't flicker into it
      (p.face.material as THREE.MeshBasicMaterial).opacity = grow;
      const em = p.edge.material as THREE.LineBasicMaterial;
      em.color.copy(lin(AI)).lerp(lin(0x2b2a42), smooth(range(draw, 0.7, 1)));
      em.opacity = grow;
    });

    // People: who they look at, whether they talk, how far they lean in.
    //   hero      a conversation: one speaks (hand up), the others watch them
    //   mess      each looks at their own note
    //   reading   everyone watches the AI     clash: the decision; PM and dev argue
    //   screens   everyone watches the screens being drawn
    //   context   heads down at their own copy of the decision, leaning in
    const speaker = reduced ? 0 : Math.floor(t / 3.4) % 3;
    people.forEach((p, k) => {
      const lookAt = a.copy(k === speaker ? headAt[(k + 1) % 3] : headAt[speaker]);
      lookAt.lerp(notes[k].position, lift);
      lookAt.lerp(core.position, orbit);
      lookAt.lerp(decision.position, clash);
      lookAt.lerp(b.set(0, 1.75, 0.3), draw);
      lookAt.lerp(copies[k].position, over);
      const talkWant = (k === speaker ? 1 - lift : 0) * (1 - over) + (k !== 1 ? clash * (1 - draw) * 0.7 : 0);
      talking[k] += (Math.min(1, talkWant) - talking[k]) * (reduced ? 1 : 0.06);
      p.update({ t, lean: 0.1 + 0.06 * orbit + 0.2 * over, look: lookAt, talk: talking[k] });
    });
    // Name tags: there for the introductions, gone once the AI starts reading.
    tags.forEach((s) => {
      const o = 1 - orbit;
      (s.material as THREE.SpriteMaterial).opacity = o;
      s.visible = o > 0.01;
    });

    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  const onVis = () => {
    if (!document.hidden && !raf) raf = requestAnimationFrame(frame);
  };
  document.addEventListener("visibilitychange", onVis);

  return {
    setStop(v) {
      target = v;
      if (!raf && onScreen) raf = requestAnimationFrame(frame);
    },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mat = m.material as (THREE.Material & { map?: THREE.Texture }) | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else {
          mat?.map?.dispose();
          mat?.dispose();
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
