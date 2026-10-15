// ─────────────────────────────────────────────────────────────────────────────
// THE AI CHARACTER (3D) — the Wireframe Studio agent as a small floating
// robot, built entirely in code with Three.js (no model file to download).
//
// What it looks like:
//   • A rounded navy head with a dark face screen and two soft-white eyes,
//     an antenna topped with the orange triangle from our logo, a small body
//     with the same orange triangle as its "core", two floating hands, and a
//     pen in the right hand.
//   • Thin ORANGE edges trace every part: it is the AI, and in Wireframe
//     Studio orange always means the AI. (Orange is never used for people.)
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
const NAVY_2 = 0x191a2f;
const INK = 0xf8f4f5;
const AI = 0xff6b2c;

// Colors are written in sRGB (like CSS); Three.js lights in linear space.
const lin = (hex: number) => new THREE.Color(hex).convertSRGBToLinear();

// A rounded rectangle outline (used for the head, body, face and eyes).
function roundedRect(w: number, h: number, r: number) {
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
  return s;
}

// A soft-edged box: a rounded rectangle pushed out into 3D with bevelled edges.
function roundedBox(w: number, h: number, d: number, r: number, bevel = 0.08) {
  const geo = new THREE.ExtrudeGeometry(roundedRect(w - bevel * 2, h - bevel * 2, Math.max(0.01, r - bevel)), {
    depth: d - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 4,
    curveSegments: 10,
  });
  geo.center();
  return geo;
}

// The orange triangle from the logo, as a thin solid.
function triangle(size: number, depth: number) {
  const s = new THREE.Shape();
  const h = (size * Math.sqrt(3)) / 2;
  s.moveTo(0, (h * 2) / 3);
  s.lineTo(size / 2, -h / 3);
  s.lineTo(-size / 2, -h / 3);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
  geo.center();
  return geo;
}

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
  const bodyMat = solid(NAVY_2);
  const faceMat = solid(NAVY_0, { roughness: 0.2, metalness: 0.4 });
  const eyeMat = solid(INK, { emissive: lin(INK), emissiveIntensity: 0.55, roughness: 0.3 });
  const coreMat = solid(AI, { emissive: lin(AI), emissiveIntensity: 0.9, roughness: 0.35 });
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

  // A rounded-rectangle line loop at depth z (front or back of a part).
  function outline(w: number, h: number, r: number, z: number) {
    const pts = roundedRect(w, h, r).getPoints(10);
    return new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(pts.map((p) => new THREE.Vector3(p.x, p.y, z))),
      edgeMat
    );
  }

  // ── Build the figure ───────────────────────────────────────────────────────
  const root = new THREE.Group(); // floats up and down
  scene.add(root);

  // Head
  const head = new THREE.Group();
  head.position.set(0, 0.62, 0);
  root.add(head);
  head.add(part(roundedBox(1.72, 1.26, 1.0, 0.34, 0.1), bodyMat));

  // Orange outline of the head, front and back (the "wireframe" look).
  head.add(outline(1.72, 1.26, 0.34, 0.5), outline(1.72, 1.26, 0.34, -0.5));

  const face = new THREE.Mesh(new THREE.ShapeGeometry(roundedRect(1.4, 0.92, 0.26), 8), faceMat);
  face.position.z = 0.505;
  head.add(face);
  // Orange rim around the face screen (always on: the AI's signature).
  const facePts = roundedRect(1.4, 0.92, 0.26).getPoints(12);
  const faceRim = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(facePts.map((p) => new THREE.Vector3(p.x, p.y, 0.51))),
    edgeMat
  );
  head.add(faceRim);

  // Eyes: soft-white pills that slide toward what the agent is looking at.
  const eyes = new THREE.Group();
  eyes.position.set(0, 0.04, 0.53);
  head.add(eyes);
  const eyeGeo = roundedBox(0.2, 0.34, 0.06, 0.1, 0.02);
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.x = -0.27;
  eyeR.position.x = 0.27;
  eyes.add(eyeL, eyeR);

  // Ears
  const earGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.12, 24);
  for (const side of [-1, 1]) {
    const ear = part(earGeo, handMat, true, 40);
    ear.rotation.z = Math.PI / 2;
    ear.position.set(side * 0.9, 0, 0);
    head.add(ear);
  }

  // Antenna with the logo's orange triangle on top
  const stalk = part(new THREE.CylinderGeometry(0.025, 0.025, 0.3, 10), penMat, false);
  stalk.position.set(0, 0.78, 0);
  head.add(stalk);
  const tip = part(triangle(0.26, 0.06), coreMat);
  tip.position.set(0, 1.02, 0);
  head.add(tip);

  // Body with the orange triangle "core"
  const body = new THREE.Group();
  body.position.set(0, -0.58, 0);
  root.add(body);
  body.add(part(roundedBox(1.06, 0.82, 0.76, 0.3, 0.08), bodyMat));
  body.add(outline(1.06, 0.82, 0.3, 0.38), outline(1.06, 0.82, 0.3, -0.38));
  const core = part(triangle(0.3, 0.05), coreMat);
  core.position.set(0, 0.02, 0.4);
  body.add(core);

  // Hands (floating, like a cursor's companion) and the pen
  const handGeo = new THREE.SphereGeometry(0.15, 24, 16);
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
  const HAND_L = new THREE.Vector3(-0.86, -0.56, 0.2);
  const HAND_R = new THREE.Vector3(0.86, -0.56, 0.2);
  handL.position.copy(HAND_L);
  handR.position.copy(HAND_R);

  // Heights used by the "draw in" clip (bottom of the hands → top of the antenna).
  const Y_MIN = -1.15;
  const Y_MAX = 1.85;

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

  function frame() {
    raf = requestAnimationFrame(frame);
    if (!running) return;
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
