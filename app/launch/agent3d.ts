// ─────────────────────────────────────────────────────────────────────────────
// THE AI CHARACTER (3D) — the Wireframe Studio agent as a small floating
// robot, built entirely in code with Three.js (no model file to download).
//
// What it looks like:
//   • A round ORANGE head with a dark visor and two soft-white eyes, an
//     antenna with an orange status light, an orange pebble body, two
//     floating hands, and a pen in the right hand.
//   • It is the AI, and in Wireframe Studio orange always means the AI.
//     (Orange is never used for people.)
//
// What it does:
//   • While the site loads, its orange outline draws in from the bottom up,
//     showing real loading progress. Then it turns solid.
//   • Its head and eyes follow your mouse. It blinks. It floats.
//   • On command (app/launch/bus.ts): waves hello, draws with its pen,
//     or looks at a spot on the screen (the hero tells it where the action is).
//   • Reduced motion: no floating, no blinking, no following. A still,
//     finished pose, redrawn only when something changes.
//
// This file is loaded on demand by app/launch/CharacterDock.tsx, so the
// 3D code never slows down the first paint.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from "three";
import type { AgentCommand } from "./bus";

const NAVY_0 = 0x090719;
const NAVY_1 = 0x131224;
const INK = 0xf8f4f5;
const AI = 0xff6b2c;

// Colors are written in sRGB (like CSS); Three.js lights in linear space.
const lin = (hex: number) => new THREE.Color(hex).convertSRGBToLinear();

export type AgentHandle = {
  command: (cmd: AgentCommand) => void;
  dispose: () => void;
};

export function createAgent(host: HTMLElement, opts: { reduced: boolean }): AgentHandle {
  const reduced = opts.reduced;

  // ── Renderer, scene, camera ────────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.localClippingEnabled = true;
  renderer.setClearColor(0x000000, 0);
  host.appendChild(renderer.domElement);
  renderer.domElement.setAttribute("aria-hidden", "true");

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  camera.position.set(0, 0.15, 6.6);
  camera.lookAt(0, 0.05, 0);

  // Light: soft white from the front-right, navy from below, and an orange
  // rim from behind so the dark figure separates from the dark page.
  scene.add(new THREE.HemisphereLight(lin(INK), lin(NAVY_0), 0.7));
  const key = new THREE.DirectionalLight(lin(INK), 1.3);
  key.position.set(2.5, 3, 4);
  scene.add(key);
  const rim = new THREE.PointLight(lin(AI), 3.2, 9, 2);
  rim.position.set(-2.2, 1.4, -2.2);
  scene.add(rim);
  const rim2 = new THREE.PointLight(lin(AI), 1.4, 8, 2);
  rim2.position.set(2.4, -0.6, -1.8);
  scene.add(rim2);

  // ── Materials ──────────────────────────────────────────────────────────────
  // While loading, everything is clipped by a plane that rises with progress,
  // so the orange outline appears to draw in from the bottom.
  const clip = new THREE.Plane(new THREE.Vector3(0, -1, 0), -2);
  const clipping = [clip];

  const solids: THREE.Material[] = [];
  const solid = (color: number, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) => {
    const m = new THREE.MeshStandardMaterial({
      color: lin(color),
      roughness: 0.42,
      metalness: 0.18,
      transparent: true,
      opacity: 0,
      clippingPlanes: clipping,
      ...extra,
    });
    solids.push(m);
    return m;
  };
  const faceMat = solid(NAVY_0, { roughness: 0.2, metalness: 0.4 });
  const eyeMat = solid(INK, { emissive: lin(INK), emissiveIntensity: 0.55, roughness: 0.3 });
  const coreMat = solid(AI, { emissive: lin(AI), emissiveIntensity: 0.25, roughness: 0.45 });
  const penMat = solid(INK, { roughness: 0.5 });
  const handMat = solid(NAVY_1);

  const edgeMat = new THREE.LineBasicMaterial({
    color: lin(AI),
    transparent: true,
    opacity: 1,
    clippingPlanes: clipping,
  });

  // Every visible part gets a mesh plus its orange edge lines.
  function part(geo: THREE.BufferGeometry, mat: THREE.Material, edges = true, threshold = 28) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(geo, mat));
    if (edges) g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, threshold), edgeMat));
    return g;
  }

  // ── Build the figure: a small round ORANGE robot (papi's pick) ──────────
  // A rounded orange head with a dark visor and two soft-white eyes, an
  // antenna with an orange status light, a pebble-shaped orange body, two
  // floating hands, and a pen in the right hand.
  const root = new THREE.Group(); // floats up and down
  scene.add(root);

  // An ellipse line loop (the orange "wireframe" outline while drawing in).
  function ring(rx: number, ry: number, z: number, y = 0) {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * rx, y + Math.sin(a) * ry, z));
    }
    return new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), edgeMat);
  }
  // A squashed sphere with its orange outline rings.
  function blob(r: number, sx: number, sy: number, sz: number, mat: THREE.Material) {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 40, 30), mat);
    m.scale.set(sx, sy, sz);
    g.add(m, ring(r * sx, r * sy, 0), ring(r * sx * 0.82, r * sy * 0.82, r * sz * 0.57));
    return g;
  }

  // Head
  const head = new THREE.Group();
  head.position.set(0, 0.5, 0);
  root.add(head);
  head.add(blob(0.78, 1.2, 0.95, 1, coreMat));
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.78, 40, 30), faceMat);
  face.scale.set(0.95, 0.6, 0.55);
  face.position.z = 0.42;
  head.add(face);
  head.add(ring(0.7, 0.44, 0.86)); // visor rim

  // Eyes: soft-white pills that slide toward what the agent is looking at.
  const eyes = new THREE.Group();
  eyes.position.set(0, 0.02, 0.84);
  head.add(eyes);
  const eyeGeo = new THREE.SphereGeometry(0.1, 16, 12);
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.x = -0.25;
  eyeR.position.x = 0.25;
  eyes.add(eyeL, eyeR);

  // Antenna with the orange status light on top
  const stalk = part(new THREE.CylinderGeometry(0.025, 0.025, 0.36, 10), faceMat, false);
  stalk.position.set(0, 0.88, 0);
  head.add(stalk);
  const tip = part(new THREE.SphereGeometry(0.09, 16, 12), coreMat);
  tip.position.set(0, 1.1, 0);
  head.add(tip);

  // Body: an orange pebble
  const body = new THREE.Group();
  body.position.set(0, -0.62, 0);
  root.add(body);
  body.add(blob(0.56, 1, 0.8, 0.85, coreMat));

  // Hands (floating, like a cursor's companion) and the pen
  const handGeo = new THREE.SphereGeometry(0.13, 24, 16);
  const handL = part(handGeo, handMat, false);
  const handR = new THREE.Group();
  handR.add(part(handGeo, handMat, false));
  const pen = new THREE.Group();
  pen.add(part(new THREE.CylinderGeometry(0.035, 0.035, 0.5, 12), penMat, false));
  const nib = part(new THREE.ConeGeometry(0.035, 0.12, 12), coreMat, false);
  nib.position.y = -0.31;
  nib.rotation.x = Math.PI;
  pen.add(nib);
  pen.position.set(0.02, -0.02, 0.12);
  pen.rotation.set(0.2, 0, -0.7);
  handR.add(pen);
  root.add(handL, handR);
  const HAND_L = new THREE.Vector3(-0.8, -0.6, 0.25);
  const HAND_R = new THREE.Vector3(0.8, -0.6, 0.25);
  handL.position.copy(HAND_L);
  handR.position.copy(HAND_R);

  // Heights used by the "draw in" clip (bottom of the body → top of the antenna).
  const Y_MIN = -1.15;
  const Y_MAX = 1.75;

  // ── State ──────────────────────────────────────────────────────────────────
  let progress = 0; // shown (smoothed) draw-in progress
  let progressTarget = 0;
  let solidT = 0; // 0 → 1 while turning solid
  let solidOn = false;
  let waveStart = -1;
  let drawing = false;
  let focus = false;
  let lookOverride: { x: number; y: number; until: number } | null = null;
  const pointer = { x: 0, y: 0 }; // -1..1 relative to the character
  const look = { x: 0, y: 0 }; // smoothed
  let nextBlink = 2.2;
  let blinkStart = -1;
  let running = true;
  let needsRender = true;

  // Turn a screen point into a -1..1 look direction relative to the character.
  function toLook(px: number, py: number) {
    const r = host.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height * 0.4;
    const sx = Math.max(window.innerWidth * 0.45, 320);
    const sy = Math.max(window.innerHeight * 0.45, 320);
    return {
      x: THREE.MathUtils.clamp((px - cx) / sx, -1, 1),
      y: THREE.MathUtils.clamp((py - cy) / sy, -1, 1),
    };
  }

  const onPointer = (e: PointerEvent) => {
    if (reduced) return;
    const l = toLook(e.clientX, e.clientY);
    pointer.x = l.x;
    pointer.y = l.y;
  };
  window.addEventListener("pointermove", onPointer, { passive: true });

  function command(cmd: AgentCommand) {
    needsRender = true;
    switch (cmd.type) {
      case "progress":
        progressTarget = Math.max(progressTarget, Math.min(1, cmd.p));
        if (reduced) progress = progressTarget;
        break;
      case "solid":
        solidOn = true;
        progressTarget = 1;
        if (reduced) {
          progress = 1;
          solidT = 1;
        }
        break;
      case "wave":
        if (!reduced) waveStart = now();
        break;
      case "draw":
        drawing = cmd.on;
        break;
      case "look": {
        const l = toLook(cmd.x, cmd.y);
        lookOverride = { ...l, until: now() + (cmd.ms ?? 900) / 1000 };
        break;
      }
      case "mood":
        focus = cmd.mood === "focus";
        break;
    }
  }

  // ── Size ───────────────────────────────────────────────────────────────────
  function resize() {
    const w = Math.max(1, host.clientWidth);
    const h = Math.max(1, host.clientHeight);
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    needsRender = true;
  }
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  // ── Animation loop ─────────────────────────────────────────────────────────
  const t0 = performance.now();
  const now = () => (performance.now() - t0) / 1000;
  let last = 0;
  const ease = (x: number) => 1 - Math.pow(1 - x, 3);
  let raf = 0;

  // Phones run two 3D views (this robot + the world), so the robot draws at
  // half rate there.
  const halfRate = window.innerWidth < 720;
  let skip = 0;
  function frame() {
    raf = requestAnimationFrame(frame);
    if (!running) return;
    if (halfRate && skip++ % 2) return;
    const t = now();
    const dt = Math.min(Math.max(t - last, 0), 0.05);
    last = t;

    // Draw-in: the clip plane rises with (smoothed) progress.
    if (!reduced) progress += (progressTarget - progress) * Math.min(1, dt * 6);
    clip.constant = Y_MIN + (Y_MAX - Y_MIN) * (solidT >= 1 ? 1.2 : progress) + 0.02;

    // Outline → solid.
    if (solidOn && solidT < 1) solidT = reduced ? 1 : Math.min(1, solidT + dt / 0.6);
    const s = ease(solidT);
    for (const m of solids) m.opacity = s;
    edgeMat.opacity = 1 - 0.62 * s;
    if (solidT >= 1) {
      for (const m of solids) m.transparent = false;
    }

    if (!reduced) {
      // Float.
      root.position.y = Math.sin(t * 1.5) * 0.06;
      root.rotation.z = Math.sin(t * 0.7) * 0.02;

      // Look: an override from the hero wins for a moment; else the mouse.
      const target = lookOverride && t < lookOverride.until ? lookOverride : pointer;
      look.x += (target.x - look.x) * Math.min(1, dt * 5);
      look.y += (target.y - look.y) * Math.min(1, dt * 5);
      head.rotation.y = look.x * 0.55;
      head.rotation.x = look.y * 0.32 + (focus ? 0.08 : 0);
      body.rotation.y = look.x * 0.2;
      eyes.position.x = look.x * 0.12;
      eyes.position.y = 0.04 - look.y * 0.08;

      // Blink.
      if (t > nextBlink && blinkStart < 0) blinkStart = t;
      let eyeY = focus ? 0.7 : 1;
      if (blinkStart >= 0) {
        const b = (t - blinkStart) / 0.14;
        eyeY = b < 1 ? Math.abs(1 - b * 2) * eyeY + 0.08 : eyeY;
        if (b >= 1) {
          blinkStart = -1;
          nextBlink = t + 2.4 + Math.random() * 2.8;
        }
      }
      eyeL.scale.y = eyeR.scale.y = eyeY;

      // Left hand bobs gently.
      handL.position.set(HAND_L.x, HAND_L.y + Math.sin(t * 2.1 + 1) * 0.05, HAND_L.z);

      // Right hand: wave, draw, or rest.
      const w = waveStart >= 0 ? (t - waveStart) / 1.3 : 2;
      if (w < 1) {
        const up = Math.sin(Math.min(1, w * 1.4) * Math.PI * 0.5) * (1 - Math.max(0, w - 0.8) * 5);
        handR.position.set(HAND_R.x + 0.12 * up, HAND_R.y + 0.95 * up, HAND_R.z + 0.1 * up);
        handR.rotation.z = Math.sin(w * Math.PI * 6) * 0.45 * up;
      } else if (drawing) {
        handR.position.set(
          HAND_R.x + 0.28 + Math.cos(t * 9) * 0.07,
          HAND_R.y + 0.32 + Math.sin(t * 13) * 0.05,
          HAND_R.z + 0.35
        );
        handR.rotation.z = -0.25 + Math.sin(t * 9) * 0.1;
      } else {
        handR.position.lerp(
          new THREE.Vector3(HAND_R.x, HAND_R.y + Math.sin(t * 2.1) * 0.05, HAND_R.z),
          Math.min(1, dt * 6)
        );
        handR.rotation.z += (0 - handR.rotation.z) * Math.min(1, dt * 6);
      }
      renderer.render(scene, camera);
    } else if (needsRender) {
      renderer.render(scene, camera);
      needsRender = false;
    }
  }
  raf = requestAnimationFrame(frame);

  // Pause when the tab is hidden.
  const onVis = () => {
    running = !document.hidden;
    last = now();
  };
  document.addEventListener("visibilitychange", onVis);

  return {
    command,
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("visibilitychange", onVis);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      });
      for (const m of solids) m.dispose();
      edgeMat.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
