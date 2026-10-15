// ─────────────────────────────────────────────────────────────────────────────
// THE CANVAS WORLD (3D) — one continuous scene behind the whole landing page.
// Scrolling flies a camera through it, so the page feels like one journey
// across a giant shared canvas instead of a stack of flat sections.
//
// The stops (u = which section you are on; 0 = hero … 6 = the end):
//   0  Hero     an endless dotted canvas floor fading into the dark, and the
//               AI's dark visor (orange rim) waiting on the left.
//   0→1 Dive    the camera flies INTO the visor; it fills the screen, then we
//               come out inside the canvas.
//   1  Problem  three frames float far apart in the fog, each with a person's
//               cursor (wine) and its own, different screen.
//   1→2 Fix     the frames are pulled together, their boxes fly apart and
//               the orange AI cursor puts them back as ONE screen.
//   2  How      the camera pulls up: that screen is one of hundreds of small
//               frames on one huge board, with cursors moving everywhere.
//   3  Live     activity cards ("Priya added a note") float past in depth.
//   4  Try it   Gemini, Claude, OpenAI and the free AI orbit an orange core.
//   5  End      every frame on the board streams into one point and becomes
//               our logo.
//
// Colors: navy space, wine = people, ORANGE = the AI only.
// Loaded on demand by app/launch/World.tsx (after the hero has started).
// Reduced motion: the camera jumps between finished stops, nothing drifts.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from "three";

const NAVY_0 = 0x090719;
const NAVY_1 = 0x131224;
const NAVY_2 = 0x191a2f;
const INK = 0xf8f4f5;
const WINE = 0x681e2e;
const ROSE = 0xe0607e; // a person's cursor (wine family)
const AI = 0xff6b2c;

const lin = (hex: number) => new THREE.Color(hex).convertSRGBToLinear();
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const range = (u: number, a: number, b: number) => clamp01((u - a) / (b - a));
const smooth = (x: number) => x * x * (3 - 2 * x);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

export type WorldHandle = {
  setStop: (u: number) => void; // where the scroll is (0 … 6, fractional)
  dispose: () => void;
};

// A text card drawn on a canvas, used as a texture (activity cards, AI tags).
function label(text: string, opts: { color: string; border: string; who?: string; whoColor?: string; w?: number }) {
  const w = opts.w ?? 640;
  const h = 128;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  g.fillStyle = "#131224";
  g.beginPath();
  g.roundRect(4, 4, w - 8, h - 8, 22);
  g.fill();
  g.lineWidth = 4;
  g.strokeStyle = opts.border;
  g.stroke();
  g.textBaseline = "middle";
  let x = 36;
  if (opts.who) {
    g.font = "600 36px 'IBM Plex Mono', ui-monospace, monospace";
    g.fillStyle = opts.whoColor ?? opts.color;
    g.fillText(opts.who, x, h / 2);
    x += g.measureText(opts.who).width + 22;
  }
  g.font = "400 36px 'IBM Plex Sans', system-ui, sans-serif";
  g.fillStyle = opts.color;
  g.fillText(text, x, h / 2);
  const tex = new THREE.CanvasTexture(c);
  tex.encoding = THREE.sRGBEncoding;
  tex.anisotropy = 4;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w / 128, h / 128),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
  );
  return mesh;
}

// A rounded-rectangle outline as a line loop.
function rectLine(w: number, h: number, r: number, color: THREE.Color) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  const geo = new THREE.BufferGeometry().setFromPoints(s.getPoints(6));
  return new THREE.LineLoop(geo, new THREE.LineBasicMaterial({ color, transparent: true }));
}

// A cursor arrow (flat triangle shape).
function cursorMesh(color: number) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(0, -0.62);
  s.lineTo(0.16, -0.47);
  s.lineTo(0.3, -0.72);
  s.lineTo(0.4, -0.67);
  s.lineTo(0.27, -0.42);
  s.lineTo(0.48, -0.42);
  s.closePath();
  return new THREE.Mesh(new THREE.ShapeGeometry(s), new THREE.MeshBasicMaterial({ color: lin(color), side: THREE.DoubleSide }));
}

// The three different screens (the problem), as box layouts inside a 4 × 6 frame.
// [x, y, w, h] in frame units (centre origin).
const LAYOUTS: number[][][] = [
  // Priya: one big Pay button
  [[0, 2.3, 3.2, 0.5], [0, 1.4, 3.2, 0.3], [0, 0.2, 3.2, 1.6], [0, -2.2, 3.2, 0.9]],
  // Leo: a grid of cards
  [[0, 2.3, 3.2, 0.5], [-0.85, 0.9, 1.5, 1.6], [0.85, 0.9, 1.5, 1.6], [-0.85, -1.0, 1.5, 1.6], [0.85, -1.0, 1.5, 1.6]],
  // Sam: tabs and a list
  [[0, 2.3, 3.2, 0.4], [-1.1, 1.6, 0.9, 0.35], [0, 1.6, 0.9, 0.35], [1.1, 1.6, 0.9, 0.35], [0, 0.8, 3.2, 0.5], [0, 0.1, 3.2, 0.5], [0, -0.6, 3.2, 0.5]],
];
// The merged screen: Sam's tabs, Leo's cards, Priya's one-step pay.
const MERGED: number[][] = [
  [0, 2.3, 3.2, 0.5],
  [-1.1, 1.6, 0.9, 0.35],
  [0, 1.6, 0.9, 0.35],
  [1.1, 1.6, 0.9, 0.35],
  [-0.85, 0.3, 1.5, 1.4],
  [0.85, 0.3, 1.5, 1.4],
  [0, -1.2, 3.2, 0.3],
  [0, -2.2, 3.2, 0.9],
];

// Camera keyframes per stop: [position, look-at].
type Key = { p: [number, number, number]; t: [number, number, number] };
const KEYS: Key[] = [
  { p: [0, 0, 12], t: [0, -0.5, 0] }, // 0 hero
  { p: [0, 0.5, -16], t: [0, 0, -34] }, // 1 problem
  { p: [0, 26, -18], t: [0, 0, -38] }, // 2 how (looking down at the board)
  { p: [-6, 3, -54], t: [2, 0, -76] }, // 3 live
  { p: [0, 0.5, -96], t: [0, 0, -112] }, // 4 try
  { p: [0, 0, -128], t: [0, 0, -142] }, // 5 end
  { p: [0, 0, -132], t: [0, 0, -142] }, // 6 footer
];

const VISOR = new THREE.Vector3(-5.2, 1.2, -6);
const MERGE_AT = new THREE.Vector3(0, 0, -34);
const BOARD_Z = -38;
const LOGO_AT = new THREE.Vector3(0, 0, -142); // moved per screen size below

export function createWorld(host: HTMLElement, opts: { reduced: boolean; small: boolean }): WorldHandle {
  const { reduced, small } = opts;
  const renderer = new THREE.WebGLRenderer({ antialias: !small, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.setClearColor(lin(NAVY_0), 1);
  host.appendChild(renderer.domElement);
  renderer.domElement.setAttribute("aria-hidden", "true");

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(lin(NAVY_0), 10, 60);
  const camera = new THREE.PerspectiveCamera(small ? 62 : 50, 1, 0.1, 400);

  // ── Floor: the dotted canvas, endless ───────────────────────────────────
  {
    const pts: number[] = [];
    const step = small ? 2 : 1.4;
    for (let x = -60; x <= 60; x += step) for (let z = 20; z >= -170; z -= step) pts.push(x, -6, z);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    scene.add(
      new THREE.Points(g, new THREE.PointsMaterial({ color: lin(0x4a4766), size: small ? 0.09 : 0.07, sizeAttenuation: true }))
    );
  }

  // ── Dust: soft particles everywhere, so motion is always felt ──────────
  const dust = (() => {
    const n = small ? 500 : 1400;
    const pts = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pts[i * 3] = (Math.random() - 0.5) * 70;
      pts[i * 3 + 1] = (Math.random() - 0.3) * 30;
      pts[i * 3 + 2] = 20 - Math.random() * 180;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pts, 3));
    const p = new THREE.Points(g, new THREE.PointsMaterial({ color: lin(INK), size: 0.05, transparent: true, opacity: 0.5 }));
    scene.add(p);
    return p;
  })();

  // ── The visor (the dive) ────────────────────────────────────────────────
  const visor = new THREE.Group();
  visor.position.copy(VISOR);
  scene.add(visor);
  const visorDisk = new THREE.Mesh(
    new THREE.CircleGeometry(1, 64),
    new THREE.MeshBasicMaterial({ color: lin(0x05040f), transparent: true, fog: false })
  );
  visorDisk.scale.set(2.4, 1.5, 1);
  visor.add(visorDisk);
  const visorRim = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(
      Array.from({ length: 80 }, (_, i) => {
        const a = (i / 80) * Math.PI * 2;
        return new THREE.Vector3(Math.cos(a) * 2.4, Math.sin(a) * 1.5, 0.01);
      })
    ),
    new THREE.LineBasicMaterial({ color: lin(AI), transparent: true, fog: false })
  );
  visor.add(visorRim);
  const eyeMat = new THREE.MeshBasicMaterial({ color: lin(INK), transparent: true, fog: false });
  for (const x of [-0.75, 0.75]) {
    const e = new THREE.Mesh(new THREE.CircleGeometry(0.22, 24), eyeMat);
    e.scale.y = 1.4;
    e.position.set(x, 0.1, 0.02);
    visor.add(e);
  }

  // ── The three frames (problem → fix) ────────────────────────────────────
  type Box = { mesh: THREE.Mesh; from: THREE.Vector3; fromS: THREE.Vector2; to: THREE.Vector3; toS: THREE.Vector2; scatter: THREE.Vector3 };
  const frames: { group: THREE.Group; line: THREE.LineLoop; start: THREE.Vector3; cursor: THREE.Mesh; tag: THREE.Mesh }[] = [];
  const boxes: Box[] = [];
  const boxMat = new THREE.MeshBasicMaterial({ color: lin(NAVY_2) });
  const boxEdge = new THREE.MeshBasicMaterial({ color: lin(0x34324f) });
  const STARTS = [new THREE.Vector3(-9, 0.4, -32), new THREE.Vector3(0.5, -0.4, -40), new THREE.Vector3(9.5, 0.6, -36)];
  const NAMES = ["Priya’s AI", "Leo’s AI", "Sam’s AI"];
  STARTS.forEach((start, i) => {
    const group = new THREE.Group();
    group.position.copy(start);
    group.rotation.y = [0.25, 0, -0.25][i];
    scene.add(group);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(4, 6), new THREE.MeshBasicMaterial({ color: lin(NAVY_1) }));
    group.add(back);
    const line = rectLine(4, 6, 0.3, lin(WINE));
    line.position.z = 0.01;
    group.add(line);
    const cursor = cursorMesh(ROSE);
    cursor.position.set(1.2, -0.6, 0.3);
    group.add(cursor);
    const tag = label(NAMES[i], { color: "#F8F4F5", border: "#681E2E", w: 420 });
    tag.scale.setScalar(0.55);
    tag.position.set(0, 3.6, 0);
    group.add(tag);
    frames.push({ group, line, start, cursor, tag });
    for (const [x, y, w, h] of LAYOUTS[i]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), boxMat);
      const edge = new THREE.Mesh(new THREE.PlaneGeometry(1.04, 1.04), boxEdge);
      edge.position.z = -0.005;
      m.add(edge);
      scene.add(m);
      boxes.push({
        mesh: m,
        from: new THREE.Vector3(),
        fromS: new THREE.Vector2(w, h),
        to: new THREE.Vector3(),
        toS: new THREE.Vector2(1, 1),
        scatter: new THREE.Vector3((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 9, (Math.random() - 0.5) * 6),
      });
      (m.userData as { local: THREE.Vector3; frame: number }).local = new THREE.Vector3(x, y, 0.05);
      (m.userData as { frame: number }).frame = i;
    }
  });
  // Each box gets a slot in the merged screen (extra boxes fold away).
  boxes.forEach((b, i) => {
    const slot = MERGED[i % MERGED.length];
    const spare = i >= MERGED.length;
    b.to.set(MERGE_AT.x + slot[0], MERGE_AT.y + slot[1], MERGE_AT.z + 0.05 + (spare ? -0.02 : 0));
    b.toS.set(spare ? 0.001 : slot[2], spare ? 0.001 : slot[3]);
  });
  // The merged frame + the AI's orange cursor.
  const merged = new THREE.Group();
  merged.position.copy(MERGE_AT);
  scene.add(merged);
  const mergedBack = new THREE.Mesh(new THREE.PlaneGeometry(4, 6), new THREE.MeshBasicMaterial({ color: lin(NAVY_1), transparent: true }));
  mergedBack.position.z = -0.02;
  merged.add(mergedBack);
  const mergedLine = rectLine(4, 6, 0.3, lin(AI));
  merged.add(mergedLine);
  const aiCursor = cursorMesh(AI);
  aiCursor.position.z = 0.4;
  merged.add(aiCursor);

  // ── The board: hundreds of small frames (how it works → the end) ────────
  const BOARD_N = small ? 220 : 520;
  const boardFill = new THREE.InstancedMesh(new THREE.PlaneGeometry(4, 6), new THREE.MeshBasicMaterial({ color: lin(NAVY_1) }), BOARD_N);
  const boardEdge = new THREE.InstancedMesh(new THREE.PlaneGeometry(4.2, 6.2), new THREE.MeshBasicMaterial({ color: lin(0x2b2a42) }), BOARD_N);
  const boardPos: THREE.Vector3[] = [];
  const boardRot: number[] = [];
  for (let i = 0, k = 0; k < BOARD_N; i++) {
    const gx = (i % 31) - 15;
    const gz = Math.floor(i / 31) - 9;
    if (gx === 0 && gz === 0) continue; // the merged frame's own spot
    boardPos.push(new THREE.Vector3(gx * 5.4 + (Math.random() - 0.5), -0.2, BOARD_Z + gz * 7.6 + (Math.random() - 0.5)));
    boardRot.push((Math.random() - 0.5) * 0.08);
    k++;
  }
  scene.add(boardEdge, boardFill);
  const dummy = new THREE.Object3D();
  // Cursors roaming the board (mostly people, a few AI).
  const roamers = Array.from({ length: small ? 10 : 24 }, (_, i) => {
    const m = cursorMesh(i % 6 === 0 ? AI : ROSE);
    m.rotation.x = -Math.PI / 2;
    m.scale.setScalar(1.6);
    scene.add(m);
    return { m, cx: (Math.random() - 0.5) * 60, cz: BOARD_Z + (Math.random() - 0.5) * 50, r: 2 + Math.random() * 6, sp: 0.2 + Math.random() * 0.5, ph: Math.random() * 6 };
  });

  // ── Live: activity cards floating in depth ──────────────────────────────
  const FEED: [string, string, string][] = [
    ["Priya", "added a note: “summary on top”", "#E0607E"],
    ["Leo", "moved the hero image", "#E0607E"],
    ["Agent", "drew 2 screens", "#FF6B2C"],
    ["Sam", "renamed the button “Start”", "#E0607E"],
    ["Agent", "merged 3 requests into one", "#FF6B2C"],
    ["Leo", "picked his version of the cards", "#E0607E"],
    ["Priya", "joined the room", "#E0607E"],
    ["Agent", "explained why: “one-step pay wins”", "#FF6B2C"],
  ];
  const cards = FEED.map(([who, what, c], i) => {
    const m = label(what, { who, whoColor: c, color: "#C9C4CF", border: c === "#FF6B2C" ? "#FF6B2C" : "#3A3856", w: 900 });
    const side = i % 2 ? 1 : -1;
    const base = new THREE.Vector3(side * (3.5 + (i % 3) * 2.4), 2.4 - (i % 4) * 1.5, -68 - i * 3.6);
    m.position.copy(base);
    m.scale.setScalar(small ? 0.45 : 0.6);
    m.rotation.y = -side * 0.25;
    scene.add(m);
    return { m, base, ph: Math.random() * 6 };
  });

  // ── Try it: AI choices orbit an orange core ─────────────────────────────
  const TRY_AT = new THREE.Vector3(0, 0, -112);
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(1.2, 40, 30),
    new THREE.MeshBasicMaterial({ color: lin(AI) })
  );
  core.position.copy(TRY_AT);
  scene.add(core);
  const halo = new THREE.Mesh(
    new THREE.RingGeometry(1.5, 1.56, 80),
    new THREE.MeshBasicMaterial({ color: lin(AI), transparent: true, opacity: 0.5, side: THREE.DoubleSide })
  );
  halo.position.copy(TRY_AT);
  scene.add(halo);
  const tags = ["Gemini", "Claude", "OpenAI", "Free built-in"].map((t, i) => {
    const m = label(t, { color: "#F8F4F5", border: i === 3 ? "#FF6B2C" : "#3A3856", w: 420 });
    m.scale.setScalar(0.7);
    scene.add(m);
    return m;
  });

  // ── The end: our logo ───────────────────────────────────────────────────
  const logoTex = new THREE.TextureLoader().load("/logo-2d.png");
  logoTex.encoding = THREE.sRGBEncoding;
  const logo = new THREE.Mesh(
    new THREE.PlaneGeometry(5, 5),
    new THREE.MeshBasicMaterial({ map: logoTex, transparent: true, opacity: 0, depthWrite: false, fog: false })
  );
  // Beside the final words on laptops; below them on phones.
  LOGO_AT.set(small ? 0 : 4.2, small ? -3.2 : 0, LOGO_AT.z);
  logo.position.copy(LOGO_AT);
  if (small) logo.scale.setScalar(0.7);
  scene.add(logo);

  // ── Size ────────────────────────────────────────────────────────────────
  function resize() {
    const w = Math.max(1, host.clientWidth);
    const h = Math.max(1, host.clientHeight);
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  // ── Per-frame update ────────────────────────────────────────────────────
  let target = 0; // where the scroll says we are
  let u = 0; // smoothed
  const mouse = { x: 0, y: 0 };
  const onMouse = (e: PointerEvent) => {
    mouse.x = e.clientX / innerWidth - 0.5;
    mouse.y = e.clientY / innerHeight - 0.5;
  };
  if (!reduced) addEventListener("pointermove", onMouse, { passive: true });

  const camP = new THREE.Vector3();
  const camT = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const t0 = performance.now();
  let raf = 0;
  let running = true;

  function cameraAt(uu: number) {
    const i = Math.min(KEYS.length - 2, Math.floor(uu));
    const f = smooth(clamp01(uu - i));
    camP.set(...KEYS[i].p).lerp(a.set(...KEYS[i + 1].p), f);
    camT.set(...KEYS[i].t).lerp(b.set(...KEYS[i + 1].t), f);
    // The dive: from the hero, swing through the visor on the way down.
    if (uu < 1) {
      const d = smooth(range(uu, 0.05, 0.55));
      const out = smooth(range(uu, 0.55, 1));
      const into = tmp.copy(VISOR).add(a.set(0, 0, 0.6));
      camP.set(...KEYS[0].p).lerp(into, d).lerp(a.set(...KEYS[1].p), out);
      camT.set(...KEYS[0].t).lerp(b.copy(VISOR).add(tmp.set(0, 0, -6)), d).lerp(a.set(...KEYS[1].t), out);
    }
  }

  function frame() {
    raf = requestAnimationFrame(frame);
    if (!running) return;
    const t = (performance.now() - t0) / 1000;
    u = reduced ? target : u + (target - u) * 0.08;

    cameraAt(u);
    if (!reduced) {
      camP.x += mouse.x * 0.8;
      camP.y -= mouse.y * 0.5;
    }
    camera.position.copy(camP);
    camera.lookAt(camT);

    // Fog: close and thick in the problem (nobody sees the others), opens wide on the board.
    const fog = scene.fog as THREE.Fog;
    const board = smooth(range(u, 1.6, 2.2)) * (1 - smooth(range(u, 2.6, 3.1)));
    fog.near = mix(8, 30, board);
    fog.far = mix(u > 0.9 && u < 1.6 ? 30 : 60, 140, board);

    // Visor: fades once we are through it.
    // It only appears once you start scrolling (the robot itself is the hero).
    const vis = range(u, 0.06, 0.25) * (1 - range(u, 0.6, 0.75));
    visor.visible = vis > 0;
    (visorDisk.material as THREE.MeshBasicMaterial).opacity = vis;
    (visorRim.material as THREE.LineBasicMaterial).opacity = vis;
    eyeMat.opacity = vis * (1 - range(u, 0.28, 0.4)); // eyes close as we dive in

    // Problem → fix: frames slide together, boxes scatter, then rebuild as one.
    const pull = smooth(range(u, 1.25, 1.55));
    const scat = Math.sin(Math.PI * range(u, 1.4, 1.8));
    const build = smooth(range(u, 1.5, 1.85));
    frames.forEach((f, i) => {
      f.group.position.copy(f.start).lerp(MERGE_AT, pull);
      f.group.rotation.y = [0.25, 0, -0.25][i] * (1 - pull);
      const show = 1 - smooth(range(u, 1.45, 1.6));
      f.group.visible = show > 0.01;
      f.group.scale.setScalar(0.6 + 0.4 * show);
      if (!reduced) {
        f.cursor.position.x = 1.2 + Math.sin(t * 1.3 + i * 2) * 0.9;
        f.cursor.position.y = -0.6 + Math.cos(t * 1.1 + i) * 1.4;
      }
    });
    boxes.forEach((bx) => {
      const ud = bx.mesh.userData as { local: THREE.Vector3; frame: number };
      const fg = frames[ud.frame].group;
      fg.updateMatrixWorld();
      bx.from.copy(ud.local).applyMatrix4(fg.matrixWorld);
      tmp.copy(bx.from).lerp(bx.to, build).addScaledVector(bx.scatter, scat);
      bx.mesh.position.copy(tmp);
      bx.mesh.rotation.y = fg.rotation.y * (1 - build);
      bx.mesh.rotation.z = scat * bx.scatter.x * 0.04;
      bx.mesh.scale.set(mix(bx.fromS.x, bx.toS.x, build) * fg.scale.x, mix(bx.fromS.y, bx.toS.y, build) * fg.scale.y, 1);
    });
    const mergedOn = smooth(range(u, 1.5, 1.7));
    merged.visible = mergedOn > 0.01;
    (mergedBack.material as THREE.MeshBasicMaterial).opacity = mergedOn;
    // Orange while the AI draws, then it settles into a normal frame.
    const aiDraw = range(u, 1.5, 1.95);
    (mergedLine.material as THREE.LineBasicMaterial).color.copy(lin(AI)).lerp(lin(0x2b2a42), smooth(range(u, 2.0, 2.3)));
    aiCursor.visible = aiDraw > 0 && aiDraw < 1;
    const slot = MERGED[Math.min(MERGED.length - 1, Math.floor(aiDraw * MERGED.length))];
    aiCursor.position.set(slot[0] + slot[2] * 0.3, slot[1] - slot[3] * 0.3, 0.4);

    // Board: rises in on "how", then streams into the logo at the end.
    const boardIn = smooth(range(u, 1.7, 2.2));
    const stream = smooth(range(u, 4.6, 5.3));
    for (let i = 0; i < boardPos.length; i++) {
      const p = boardPos[i];
      const delay = (i % 17) / 17;
      const k = smooth(clamp01(stream * 1.6 - delay * 0.6));
      dummy.position.copy(p).lerp(LOGO_AT, k);
      dummy.position.y = mix(p.y - 3 * (1 - boardIn), LOGO_AT.y, k);
      dummy.rotation.set(-Math.PI / 2 * (1 - k), 0, boardRot[i] + k * 3);
      dummy.scale.setScalar(Math.max(0.0001, boardIn * (1 - k * 0.92)));
      dummy.updateMatrix();
      boardFill.setMatrixAt(i, dummy.matrix);
      dummy.position.y -= 0.01;
      dummy.updateMatrix();
      boardEdge.setMatrixAt(i, dummy.matrix);
    }
    boardFill.instanceMatrix.needsUpdate = true;
    boardEdge.instanceMatrix.needsUpdate = true;
    // The merged frame lies down onto the board as the camera pulls up.
    const lay = smooth(range(u, 1.9, 2.3)) * (1 - stream);
    merged.rotation.x = -Math.PI / 2 * lay;
    merged.position.set(MERGE_AT.x, mix(MERGE_AT.y, -0.15, lay), MERGE_AT.z);
    boxes.forEach((bx) => {
      if (lay > 0) {
        tmp.copy(bx.mesh.position).sub(MERGE_AT);
        bx.mesh.position.set(MERGE_AT.x + tmp.x, mix(MERGE_AT.y + tmp.y, -0.1, lay), MERGE_AT.z + mix(tmp.z, -tmp.y, lay));
        bx.mesh.rotation.x = -Math.PI / 2 * lay;
      } else bx.mesh.rotation.x = 0;
      bx.mesh.visible = stream < 0.5;
    });
    merged.visible = merged.visible && stream < 0.5;
    roamers.forEach((r) => {
      const ang = reduced ? r.ph : t * r.sp + r.ph;
      r.m.position.set(r.cx + Math.cos(ang) * r.r, 0.1, r.cz + Math.sin(ang) * r.r);
      r.m.visible = boardIn > 0.5 && stream < 0.3;
    });

    // Live cards drift gently.
    cards.forEach((c, i) => {
      c.m.position.copy(c.base);
      if (!reduced) c.m.position.y += Math.sin(t * 0.6 + c.ph) * 0.25;
      c.m.visible = u > 2.4 && u < 4;
      c.m.lookAt(i % 2 ? camera.position.x + 6 : camera.position.x - 6, camera.position.y, camera.position.z);
    });

    // Try: the AI choices orbit the core.
    const tryOn = u > 3.3 && u < 4.9;
    core.visible = halo.visible = tryOn;
    halo.lookAt(camera.position);
    if (!reduced) core.scale.setScalar(1 + Math.sin(t * 2) * 0.04);
    tags.forEach((m, i) => {
      const ang = (reduced ? 0 : t * 0.35) + (i / tags.length) * Math.PI * 2;
      m.position.set(TRY_AT.x + Math.cos(ang) * 4.2, TRY_AT.y + Math.sin(ang * 1.0) * 1.6, TRY_AT.z + Math.sin(ang) * 2.4);
      m.lookAt(camera.position);
      m.visible = tryOn;
    });

    // The end: the logo appears where the board streamed in.
    (logo.material as THREE.MeshBasicMaterial).opacity = smooth(range(u, 5.0, 5.5));
    logo.lookAt(camera.position);
    if (!reduced) logo.rotation.z = Math.sin(t * 0.5) * 0.04;

    if (!reduced) dust.rotation.y = t * 0.004;
    renderer.render(scene, camera);
  }
  raf = requestAnimationFrame(frame);

  const onVis = () => (running = !document.hidden);
  document.addEventListener("visibilitychange", onVis);

  return {
    setStop(v) {
      target = v;
    },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      removeEventListener("pointermove", onMouse);
      document.removeEventListener("visibilitychange", onVis);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
