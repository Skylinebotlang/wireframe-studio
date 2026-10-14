"use client";

// ─────────────────────────────────────────────────────────────────────────────
// 3D CORE LOGO — the spinning "Core" logo (variation 04 from
// wireframe-studio-logo.html), in our palette, drawn with three.js.
//
//   • Three blades fade navy → wine → soft white along their length.
//   • The glowing triangle in the middle is the AI, so it's ORANGE.
//   • It spins on its own (eases in and out, ~7 s per turn). Dragging
//     anywhere on `dragTarget` spins it by hand; let go and it keeps the
//     momentum, then settles back into the idle spin.
//
// The blade outlines live in lib/logo-core.json (copied from the HTML file).
// ─────────────────────────────────────────────────────────────────────────────

import { RefObject, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import LOGO from "@/lib/logo-core.json";

type Pt = number[];
type Seg = { contours: Pt[][]; axis: number[] };

// Gradient along each blade: 0 = narrow end, 1 = sharp tip.
const STOPS: [number, string][] = [
  [0, "#191A2F"],
  [0.55, "#681E2E"],
  [1, "#F8F4F5"],
];
const AI_COLOR = "#FF6B2C"; // orange = the agent only
const TURN = 7; // seconds per idle turn

export function LogoCore3D({
  dragTarget,
  className,
}: {
  dragTarget: RefObject<HTMLElement | null>;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Some computers can't do 3D (WebGL off or unsupported): show the 2D logo.
  const [no3d, setNo3d] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const target = dragTarget.current;
    if (!canvas || !target) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)");

    // ── Renderer, camera, lights (same studio setup as the HTML file) ──────
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    } catch {
      // No WebGL on this device: fall back to the flat logo (runs once).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNo3d(true);
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.setClearColor(0x000000, 0); // transparent: the page shows through
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
    camera.position.set(0, 0, 6);

    // A tiny "photo studio" of bright panels, used only for reflections.
    const env = new THREE.Scene();
    env.background = new THREE.Color(0x07060f);
    const panel = (c: THREE.Color, w: number, h: number, p: [number, number, number]) => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide })
      );
      m.position.set(...p);
      m.lookAt(0, 0, 0);
      env.add(m);
    };
    panel(new THREE.Color(4, 4, 4), 6, 2, [0, 5, 4]);
    panel(new THREE.Color(1.4, 1.5, 2.2), 2, 6, [-6, 1, -2]);
    panel(new THREE.Color(1.2, 1.2, 1.2), 4, 1, [3, -4, 5]);
    panel(new THREE.Color(0.6, 0.6, 0.7), 8, 8, [0, 0, -8]);
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(env, 0.04).texture;
    const key = new THREE.DirectionalLight(0xffffff, 1.0);
    key.position.set(3, 4, 5);
    const rim = new THREE.DirectionalLight(0x9fb0ff, 1.4);
    rim.position.set(-4, 2, -4);
    scene.add(key, rim, new THREE.AmbientLight(0xffffff, 0.15));

    // ── Materials ──────────────────────────────────────────────────────────
    const stops = STOPS.map(([o, c]) => [o, new THREE.Color(c).convertSRGBToLinear()] as const);
    const grad = (t: number) => {
      t = Math.max(0, Math.min(1, t));
      for (let i = 1; i < stops.length; i++)
        if (t <= stops[i][0]) {
          const [o0, c0] = stops[i - 1];
          const [o1, c1] = stops[i];
          return c0.clone().lerp(c1, (t - o0) / (o1 - o0));
        }
      return stops[stops.length - 1][1].clone();
    };
    const bladeMat = new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      metalness: 0.85,
      roughness: 0.32,
      clearcoat: 0.4,
      clearcoatRoughness: 0.12,
    });
    // Convert to linear so the core shows the true brand orange, not a pale one.
    const ai = new THREE.Color(AI_COLOR).convertSRGBToLinear();
    const aiMat = new THREE.MeshStandardMaterial({
      color: ai,
      emissive: ai,
      emissiveIntensity: 0.35,
      metalness: 0.1,
      roughness: 0.2,
    });

    // ── Geometry: extrude each outline into a bevelled 3D blade ────────────
    const toShape = (c: Pt[][]) => {
      const s = new THREE.Shape(c[0].map((p) => new THREE.Vector2(p[0], p[1])));
      for (let i = 1; i < c.length; i++)
        s.holes.push(new THREE.Path(c[i].map((p) => new THREE.Vector2(p[0], p[1]))));
      return s;
    };
    const bevel = { bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.022, bevelSegments: 4, curveSegments: 10 };
    const root = new THREE.Group();
    scene.add(root);

    (LOGO.segs as Seg[]).forEach((s) => {
      const depth = 0.17;
      const geo = new THREE.ExtrudeGeometry(toShape(s.contours), { depth, ...bevel });
      geo.translate(0, 0, -depth / 2);
      const [mx, my, cx, cy] = s.axis;
      const ax = cx - mx;
      const ay = cy - my;
      const L2 = ax * ax + ay * ay;
      const pos = geo.attributes.position;
      const colors = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        const t = ((pos.getX(i) - mx) * ax + (pos.getY(i) - my) * ay) / L2;
        // Weave: each blade's narrow end dips under the next blade.
        pos.setZ(i, pos.getZ(i) - 0.17 + 0.34 * Math.max(0, Math.min(1, t)));
        const c = grad(t);
        colors.set([c.r, c.g, c.b], i * 3);
      }
      geo.computeVertexNormals();
      geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      root.add(new THREE.Mesh(geo, bladeMat));
    });
    // The glowing AI core in the middle.
    const coreGeo = new THREE.ExtrudeGeometry(toShape([LOGO.core as Pt[]]), { depth: 0.12, ...bevel });
    coreGeo.translate(0, 0, -0.06);
    root.add(new THREE.Mesh(coreGeo, aiMat));

    // ── Size the canvas to its box ─────────────────────────────────────────
    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect();
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    // ── Motion: idle spin + drag to spin with momentum ─────────────────────
    let angle = 0, vel = 0, tilt = 0, t = 0;
    let dragging = false, lastX = 0, lastY = 0, lastT = 0;
    const down = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      lastT = performance.now();
      vel = 0;
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      const now = performance.now();
      const dt = Math.max(1, now - lastT) / 1000;
      const dx = (e.clientX - lastX) * 0.012;
      angle += dx;
      vel = vel * 0.5 + (dx / dt) * 0.5;
      tilt = Math.max(-0.6, Math.min(0.6, tilt + (e.clientY - lastY) * 0.004));
      lastX = e.clientX;
      lastY = e.clientY;
      lastT = now;
    };
    const up = () => {
      if (!dragging) return;
      dragging = false;
      if (performance.now() - lastT > 80) vel = 0; // held still before letting go
      vel = Math.max(-40, Math.min(40, vel));
    };
    target.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);

    let raf = 0;
    let prev = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;
      t += dt;
      const still = reduce.matches;
      const idle = still ? 0 : ((2 * Math.PI) / TURN) * (1 - 0.75 * Math.cos((t * 2 * Math.PI) / TURN));
      if (!dragging) {
        if (still) {
          const goal = Math.round(angle / (2 * Math.PI)) * 2 * Math.PI;
          angle += (goal - angle) * (1 - Math.exp(-dt * 4));
          vel = 0;
        } else {
          vel += (idle - vel) * (1 - Math.exp(-dt * (Math.abs(vel) > idle * 1.5 ? 0.9 : 2.5)));
          angle += vel * dt;
        }
        tilt *= Math.exp(-dt * 2.5);
      }
      const wob = still ? 0 : 0.09;
      root.rotation.set(-0.08 + tilt + wob * Math.sin(t * 1.1), angle, wob * 0.4 * Math.sin(t * 0.8 + 1));
      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    // ── Clean up when the splash goes away ─────────────────────────────────
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      target.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
      bladeMat.dispose();
      aiMat.dispose();
      pmrem.dispose();
      renderer.dispose();
    };
  }, [dragTarget]);

  if (no3d)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src="/logo-2d.png" alt="" draggable={false} className={className} />;
  return <canvas ref={canvasRef} aria-hidden className={className} />;
}
