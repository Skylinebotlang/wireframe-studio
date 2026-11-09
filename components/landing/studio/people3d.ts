// ─────────────────────────────────────────────────────────────────────────────
// THE THREE PEOPLE (3D) — sculpted in code for the round table scene
// (table3d.ts). No downloaded models: every shape is built here, so the
// people match the page's palette and there are no licence questions.
//
// Built in real metres (seat on the floor at the origin, the table in front,
// towards +z), then scaled up by the scene. Each person has:
//   • a body with seated proportions: shaped torso, shoulders, neck, head,
//     hips, legs under the table, shoes
//   • a stylised face: nose, ears, eyes, brows, mouth
//   • arms solved every frame (two-joint IK), so the hands rest on the table
//     or lift when the person talks; hands with four fingers and a thumb
//   • an outfit and hair that say who they are, in their role color:
//       PM        charcoal blazer over a white shirt, short hair
//       Designer  rose sweater with a turtleneck, a bun, round glasses
//       Developer grey hoodie (hood bunched behind), headphones on the neck
//   • life: breathing, a head that turns toward what matters in the
//     chapter, a lean toward the table, a talking hand
// An office chair comes with each person.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from "three";

export type Role = "pm" | "designer" | "developer";

export type PersonState = {
  t: number; // seconds (0 when reduced motion is on)
  lean: number; // radians, forward toward the table
  look: THREE.Vector3; // world point the head turns toward
  talk: number; // 0 → 1: right hand lifts, as if explaining
};

export type Person = { root: THREE.Group; meshes: THREE.Mesh[]; update: (s: PersonState) => void };

const lin = (hex: number) => new THREE.Color(hex).convertSRGBToLinear();
const UP = new THREE.Vector3(0, 1, 0);

// ── Geometry helpers ───────────────────────────────────────────────────────

/** A rounded limb along +Y, centred on the origin: radius r1 at the bottom, r2 at the top. */
function limbGeometry(r1: number, r2: number, len: number, seg = 18) {
  const pts: THREE.Vector2[] = [];
  const n = 7;
  for (let i = 0; i <= n; i++) {
    const a = -Math.PI / 2 + (i / n) * (Math.PI / 2);
    pts.push(new THREE.Vector2(r1 * Math.cos(a) + 1e-4, -len / 2 + r1 * Math.sin(a)));
  }
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * (Math.PI / 2);
    pts.push(new THREE.Vector2(r2 * Math.cos(a) + 1e-4, len / 2 + r2 * Math.sin(a)));
  }
  return new THREE.LatheGeometry(pts, seg);
}

/** A lathe shape from [radius, height] pairs. */
function lathe(profile: [number, number][], seg = 40) {
  return new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 1e-4), y)),
    seg,
  );
}

/** Radius of a lathe profile at height y (linear between points). */
function radiusAt(profile: [number, number][], y: number) {
  for (let i = 1; i < profile.length; i++) {
    const [r0, y0] = profile[i - 1];
    const [r1, y1] = profile[i];
    if (y <= y1) return r0 + (r1 - r0) * ((y - y0) / Math.max(1e-6, y1 - y0));
  }
  return 0;
}

/**
 * Hair that hugs a head built from `profile` (same lathe), `offset` metres out.
 * Its lower edge (the hairline) depends on the direction around the head:
 * 0.19 m at the front (+z), about 0.135 m over the ears, 0.06 m at the nape.
 */
function hairShell(profile: [number, number][], offset: number, dome = { y0: 0.13, rx: 0.089, ry: 0.134 }) {
  const top = dome.y0 + dome.ry + offset;
  const shellR = (y: number) => {
    if (y < dome.y0) return radiusAt(profile, y) + offset;
    const k = Math.min(1, (y - dome.y0) / (dome.ry + offset));
    return (dome.rx + offset) * Math.sqrt(Math.max(0, 1 - k * k));
  };
  const AROUND = 64;
  const UPN = 22;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= AROUND; i++) {
    const phi = (i / AROUND) * Math.PI * 2; // 0 = front
    const front = Math.pow((1 + Math.cos(phi)) / 2, 0.8);
    const hairline = 0.06 + (0.19 - 0.06) * front;
    for (let j = 0; j <= UPN; j++) {
      const y = hairline + (top - hairline) * (j / UPN);
      const r = j === UPN ? 0 : shellR(y);
      pos.push(Math.sin(phi) * r, y, Math.cos(phi) * r);
    }
  }
  for (let i = 0; i < AROUND; i++)
    for (let j = 0; j < UPN; j++) {
      const a = i * (UPN + 1) + j;
      const b = (i + 1) * (UPN + 1) + j;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Puts a +Y limb mesh between two points. */
function placeBetween(mesh: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3) {
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  const dir = new THREE.Vector3().subVectors(b, a).normalize();
  mesh.quaternion.setFromUnitVectors(UP, dir);
}

/** Two-joint IK: where the elbow (or knee) goes, bending toward `pole`. */
function solveJoint(s: THREE.Vector3, t: THREE.Vector3, a: number, b: number, pole: THREE.Vector3, outJoint: THREE.Vector3, outEnd: THREE.Vector3) {
  const dir = new THREE.Vector3().subVectors(t, s);
  const d = Math.min(Math.max(dir.length(), 1e-4), a + b - 1e-4);
  dir.normalize();
  outEnd.copy(s).addScaledVector(dir, d);
  const x = (a * a - b * b + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, a * a - x * x));
  const perp = pole.clone().addScaledVector(dir, -pole.dot(dir)).normalize();
  outJoint.copy(s).addScaledVector(dir, x).addScaledVector(perp, h);
}

// ── Looks ──────────────────────────────────────────────────────────────────

type Look = { skin: number; top: number; accent: number; pants: number; hair: number; shoes: number; hairStyle: "short" | "bun" | "messy" };

const LOOKS: Record<Role, Look> = {
  pm: { skin: 0x8d5a3b, top: 0x2c2c31, accent: 0xf8f4f5, pants: 0x1c1c1f, hair: 0x17110e, shoes: 0x101010, hairStyle: "short" },
  designer: { skin: 0xe2b590, top: 0xb4475f, accent: 0x8f2f45, pants: 0x232026, hair: 0x3a2316, shoes: 0x1a1a1a, hairStyle: "bun" },
  developer: { skin: 0x5a3826, top: 0x4c4c50, accent: 0x535356, pants: 0x1d2128, hair: 0x0c0c0c, shoes: 0xe8e8e8, hairStyle: "messy" },
};

export function createPerson(role: Role): Person {
  const L = LOOKS[role];
  const std = (hex: number, roughness = 0.75, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color: lin(hex), roughness, metalness });
  const skin = std(L.skin, 0.55);
  const top = std(L.top, 0.85);
  const accent = std(L.accent, 0.7);
  const pants = std(L.pants, 0.9);
  const hair = std(L.hair, 0.6);
  const shoes = std(L.shoes, 0.5);
  const dark = std(0x111111, 0.4);
  const chairMat = std(0x17162b, 0.6, 0.2);
  const chairMetal = std(0x2b2a42, 0.35, 0.8);

  const root = new THREE.Group();
  const meshes: THREE.Mesh[] = [];
  const add = (parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material) => {
    const m = new THREE.Mesh(geo, mat);
    parent.add(m);
    meshes.push(m);
    return m;
  };

  // ── Chair (office chair, behind/under the person) ───────────────────────
  {
    const seat = add(root, new THREE.BoxGeometry(0.48, 0.07, 0.46), chairMat);
    seat.position.set(0, 0.43, -0.02);
    const back = add(root, new THREE.BoxGeometry(0.46, 0.52, 0.06), chairMat);
    back.position.set(0, 0.76, -0.27);
    back.rotation.x = -0.1;
    const post = add(root, new THREE.CylinderGeometry(0.025, 0.025, 0.32, 12), chairMetal);
    post.position.set(0, 0.24, -0.02);
    const spine = add(root, new THREE.BoxGeometry(0.04, 0.3, 0.03), chairMetal);
    spine.position.set(0, 0.56, -0.25);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const spoke = add(root, new THREE.BoxGeometry(0.03, 0.025, 0.3), chairMetal);
      spoke.position.set(Math.sin(a) * 0.15, 0.07, -0.02 + Math.cos(a) * 0.15);
      spoke.rotation.y = a;
      const wheel = add(root, new THREE.SphereGeometry(0.025, 10, 8), dark);
      wheel.position.set(Math.sin(a) * 0.3, 0.03, -0.02 + Math.cos(a) * 0.3);
    }
  }

  // ── Hips and legs (static: sitting) ─────────────────────────────────────
  const pelvis = add(root, new THREE.SphereGeometry(1, 28, 18), pants);
  pelvis.scale.set(0.17, 0.1, 0.14);
  pelvis.position.set(0, 0.5, 0);
  for (const side of [-1, 1]) {
    const hip = new THREE.Vector3(side * 0.095, 0.5, 0.03);
    const knee = new THREE.Vector3(side * 0.11, 0.52, 0.44);
    const ankle = new THREE.Vector3(side * 0.12, 0.09, 0.5);
    const thigh = add(root, limbGeometry(0.06, 0.075, hip.distanceTo(knee)), pants);
    placeBetween(thigh, knee, hip);
    const shin = add(root, limbGeometry(0.04, 0.055, knee.distanceTo(ankle)), pants);
    placeBetween(shin, ankle, knee);
    const shoe = add(root, new THREE.SphereGeometry(1, 20, 12), shoes);
    shoe.scale.set(0.05, 0.045, 0.12);
    shoe.position.set(ankle.x, 0.045, ankle.z + 0.06);
  }

  // ── Upper body: leans from the hips ─────────────────────────────────────
  const HIP = new THREE.Vector3(0, 0.5, -0.02);
  const upper = new THREE.Group();
  upper.position.copy(HIP);
  root.add(upper);

  const torso = add(
    upper,
    lathe([
      [0, -0.04],
      [0.155, -0.02],
      [0.165, 0.05],
      [0.148, 0.16],
      [0.155, 0.25],
      [0.178, 0.34],
      [0.194, 0.42],
      [0.19, 0.47],
      [0.155, 0.505],
      [0.095, 0.535],
      [0.05, 0.548],
      [0, 0.55],
    ]),
    top,
  );
  torso.scale.set(1, 1, 0.62);
  for (const side of [-1, 1]) {
    const shoulder = add(upper, new THREE.SphereGeometry(0.064, 24, 16), top);
    shoulder.position.set(side * 0.185, 0.455, 0);
  }

  // Outfit details on the chest and neck.
  if (role === "pm") {
    // White shirt in the blazer's V, plus the lapels.
    const v = new THREE.Shape();
    v.moveTo(-0.055, 0.09);
    v.lineTo(0.055, 0.09);
    v.lineTo(0, -0.1);
    v.closePath();
    const shirt = add(upper, new THREE.ShapeGeometry(v), accent);
    shirt.position.set(0, 0.44, 0.124);
    shirt.rotation.x = -0.12;
    for (const side of [-1, 1]) {
      const lapel = add(upper, new THREE.BoxGeometry(0.034, 0.24, 0.012), std(0x3a3a41, 0.75));
      lapel.position.set(side * 0.036, 0.43, 0.129);
      lapel.rotation.set(-0.12, 0, -side * 0.28); // top leans outward, bottom meets at the button
    }
  }
  if (role === "designer") {
    const turtle = add(upper, new THREE.CylinderGeometry(0.058, 0.07, 0.08, 24), top);
    turtle.position.set(0, 0.55, 0);
  }
  if (role === "developer") {
    // Hood bunched behind the neck, drawstrings at the front.
    const hood = add(upper, new THREE.TorusGeometry(0.09, 0.045, 12, 28, Math.PI * 1.15), top);
    hood.position.set(0, 0.52, -0.02);
    hood.rotation.set(Math.PI / 2 + 0.25, 0, Math.PI - Math.PI * 0.075);
    for (const side of [-1, 1]) {
      const cord = add(upper, new THREE.CylinderGeometry(0.004, 0.004, 0.13, 6), std(0xd9d9d9, 0.6));
      cord.position.set(side * 0.035, 0.44, 0.105);
    }
  }

  const neck = add(upper, new THREE.CylinderGeometry(0.052, 0.06, 0.09, 24), skin);
  neck.position.set(0, 0.57, 0.004);

  if (role === "developer") {
    // Headphones resting around the neck.
    const band = add(upper, new THREE.TorusGeometry(0.085, 0.011, 10, 32, Math.PI * 1.25), std(0x1b1b1b, 0.4, 0.3));
    band.position.set(0, 0.565, -0.005);
    band.rotation.set(Math.PI / 2, 0, -Math.PI * 0.125 + Math.PI);
    for (const side of [-1, 1]) {
      const cup = add(upper, new THREE.CylinderGeometry(0.036, 0.036, 0.026, 20), std(0x262626, 0.35, 0.4));
      cup.position.set(side * 0.078, 0.565, 0.012);
      cup.rotation.z = Math.PI / 2;
      const pad = add(upper, new THREE.TorusGeometry(0.026, 0.008, 8, 20), std(0x9b9b9e, 0.6));
      pad.position.set(side * 0.094, 0.565, 0.012);
      pad.rotation.y = Math.PI / 2;
    }
  }

  // ── Head (turns as a unit) ──────────────────────────────────────────────
  const head = new THREE.Group();
  head.position.set(0, 0.598, 0.006);
  upper.add(head);
  const SKULL: [number, number][] = [
    [0, -0.006],
    [0.04, -0.002],
    [0.066, 0.022],
    [0.078, 0.058],
    [0.084, 0.1],
    // Dome: an ellipse from the temples (y 0.13) to the crown (y 0.264).
    ...Array.from({ length: 14 }, (_, i): [number, number] => {
      const y = 0.13 + (0.134 * (i + 1)) / 14;
      const k = (y - 0.13) / 0.134;
      return [0.089 * Math.sqrt(Math.max(0, 1 - k * k)), y];
    }),
  ];
  const skull = add(head, lathe(SKULL), skin);
  skull.scale.set(0.92, 1, 1.08);
  skull.position.z = 0.008;

  const nose = add(head, new THREE.SphereGeometry(1, 16, 12), skin);
  nose.scale.set(0.011, 0.013, 0.012);
  nose.position.set(0, 0.106, 0.104);
  const bridge = add(head, new THREE.SphereGeometry(1, 12, 10), skin);
  bridge.scale.set(0.007, 0.022, 0.008);
  bridge.position.set(0, 0.124, 0.1);
  for (const side of [-1, 1]) {
    const ear = add(head, new THREE.SphereGeometry(0.022, 14, 10), skin);
    ear.scale.set(0.45, 1, 0.75);
    ear.position.set(side * 0.081, 0.13, 0.0);
    const eye = add(head, new THREE.SphereGeometry(0.0105, 14, 10), dark);
    eye.position.set(side * 0.031, 0.137, 0.094);
    const brow = add(head, new THREE.BoxGeometry(0.034, 0.0075, 0.009), hair);
    brow.position.set(side * 0.031, 0.158, 0.099);
    brow.rotation.z = side * -0.12;
  }
  const mouth = add(head, new THREE.BoxGeometry(0.028, 0.004, 0.006), std(0x3d1f1a, 0.6));
  mouth.position.set(0, 0.07, 0.095);

  // Hair.
  // Hair cap: a dome over the crown (higher than the skull top), tilted back so
  // the hairline sits on the forehead, above the brows.
  // Hair: a shell that follows the skull a few millimetres out, with a real
  // hairline: high on the forehead, over the ears at the sides, low at the nape.
  const cap = add(head, hairShell(SKULL, 0.006), hair);
  cap.scale.set(0.92, 1, 1.08);
  cap.position.z = 0.008;
  if (L.hairStyle === "short") {
    const back = add(head, new THREE.SphereGeometry(0.09, 24, 14), hair);
    back.scale.set(0.98, 0.75, 0.9);
    back.position.set(0, 0.125, -0.03);
  }
  if (L.hairStyle === "bun") {
    const back = add(head, new THREE.SphereGeometry(0.092, 24, 14), hair);
    back.scale.set(0.98, 0.9, 0.95);
    back.position.set(0, 0.13, -0.03);
    const bun = add(head, new THREE.SphereGeometry(0.042, 20, 14), hair);
    bun.position.set(0, 0.235, -0.07);
    // Round glasses.
    const frame = std(0x1a1a1a, 0.3, 0.6);
    for (const side of [-1, 1]) {
      const lens = add(head, new THREE.TorusGeometry(0.02, 0.0028, 8, 28), frame);
      lens.position.set(side * 0.031, 0.137, 0.108);
      const arm = add(head, limbGeometry(0.0018, 0.0018, 0.085, 6), frame);
      placeBetween(arm, new THREE.Vector3(side * 0.05, 0.14, 0.104), new THREE.Vector3(side * 0.083, 0.138, 0.012));
    }
    const bridge = add(head, new THREE.BoxGeometry(0.022, 0.003, 0.003), frame);
    bridge.position.set(0, 0.14, 0.11);
  }
  if (L.hairStyle === "messy") {
    const back = add(head, new THREE.SphereGeometry(0.09, 24, 14), hair);
    back.scale.set(0.98, 0.78, 0.9);
    back.position.set(0, 0.13, -0.028);
    // Tight curls spread over the cap (golden-angle spiral, so they never line up).
    const tufts: [number, number, number, number][] = [];
    for (let i = 0; i < 46; i++) {
      const yN = 1 - (i / 45) * 0.85; // from the crown down toward the sides
      const r = Math.sqrt(1 - yN * yN);
      const th = i * 2.39996;
      const x = Math.cos(th) * r;
      const z = Math.sin(th) * r;
      if (z > 0.55 && yN < 0.55) continue; // keep the forehead clear
      tufts.push([x * 0.088, 0.17 + yN * 0.095, z * 0.098 - 0.004, 0.017 + (i % 3) * 0.003]);
    }
    tufts.forEach(([x, y, z, r]) => {
      const tuft = add(head, new THREE.SphereGeometry(r, 14, 10), hair);
      tuft.position.set(x, y, z);
    });
  }

  // ── Arms (solved every frame) ───────────────────────────────────────────
  const UPPER_LEN = 0.29;
  const FORE_LEN = 0.26;
  const arms = [-1, 1].map((side) => {
    const upperArm = add(root, limbGeometry(0.047, 0.056, UPPER_LEN), top);
    const fore = add(root, limbGeometry(0.036, 0.045, FORE_LEN), top);
    const cuff = role === "pm" ? add(root, new THREE.CylinderGeometry(0.038, 0.038, 0.02, 16), accent) : null;
    const hand = new THREE.Group();
    root.add(hand);
    const palm = add(hand, new THREE.SphereGeometry(1, 18, 12), skin);
    palm.scale.set(0.038, 0.016, 0.048);
    palm.position.set(0, 0, 0.035);
    [-0.024, -0.008, 0.008, 0.024].forEach((x, i) => {
      const len = [0.058, 0.07, 0.068, 0.054][i];
      const finger = add(hand, limbGeometry(0.0085, 0.0095, len, 10), skin);
      finger.rotation.x = Math.PI / 2 + 0.12; // lying forward, slightly curled down
      finger.position.set(x, -0.004, 0.075 + len / 2);
    });
    const thumb = add(hand, limbGeometry(0.009, 0.011, 0.045, 10), skin);
    thumb.rotation.set(Math.PI / 2, 0, side * 0.9);
    thumb.position.set(-side * 0.04, -0.004, 0.055);
    return { side, upperArm, fore, cuff, hand };
  });

  // Rest targets (seat space): hands on the table edge, elbows down and out.
  const restWrist = (side: number) => new THREE.Vector3(side * 0.13, 0.775, 0.5);
  const shoulderRest = (side: number) => new THREE.Vector3(side * 0.2, 0.455, 0);
  const pole = (side: number) => new THREE.Vector3(side * 1, -0.7, -0.4).normalize();

  const s = new THREE.Vector3();
  const tgt = new THREE.Vector3();
  const elbow = new THREE.Vector3();
  const wrist = new THREE.Vector3();
  const look = new THREE.Vector3();
  const qRest = new THREE.Quaternion();
  const qLook = new THREE.Quaternion();
  const m4 = new THREE.Matrix4();

  function update({ t, lean, look: lookWorld, talk }: PersonState) {
    // Breathing and lean.
    const breath = Math.sin(t * 1.6) * 0.5 + 0.5;
    torso.scale.set(1 + breath * 0.008, 1 + breath * 0.006, 0.62 + breath * 0.008);
    upper.rotation.x = lean;

    // Head: turn part way toward the look point (heads don't swivel fully).
    root.updateMatrixWorld(true);
    look.copy(lookWorld);
    head.updateMatrixWorld(true);
    const headPos = new THREE.Vector3().setFromMatrixPosition(head.matrixWorld);
    m4.lookAt(look, headPos, UP); // +z of the head points at the target
    qLook.setFromRotationMatrix(m4);
    // Convert to head-local (relative to its parent's world rotation).
    const parentQ = new THREE.Quaternion();
    head.parent!.getWorldQuaternion(parentQ);
    qLook.premultiply(parentQ.invert());
    qRest.identity();
    const want = qRest.slerp(qLook, 0.65);
    head.quaternion.slerp(want, 0.08);

    // Arms: shoulders follow the lean; the right hand lifts to talk.
    arms.forEach(({ side, upperArm, fore, cuff, hand }) => {
      s.copy(shoulderRest(side)).applyAxisAngle(new THREE.Vector3(1, 0, 0), lean).add(HIP);
      tgt.copy(restWrist(side));
      if (side === 1 && talk > 0) {
        const wave = Math.sin(t * 3.2) * 0.02 * talk;
        tgt.lerp(new THREE.Vector3(0.21, 0.98 + wave, 0.4), talk);
      }
      solveJoint(s, tgt, UPPER_LEN, FORE_LEN, pole(side), elbow, wrist);
      placeBetween(upperArm, elbow, s);
      placeBetween(fore, wrist, elbow);
      if (cuff) {
        placeBetween(cuff, wrist, elbow);
        cuff.position.lerpVectors(wrist, elbow, 0.12);
      }
      // Hand: flat on the table, pointing along the forearm; turns upright as it lifts.
      hand.position.copy(wrist);
      const dir = new THREE.Vector3().subVectors(wrist, elbow);
      const yaw = Math.atan2(dir.x, dir.z);
      const lift = side === 1 ? talk : 0;
      // +x tilt points the fingertips down onto the table; lifting turns them up.
      hand.rotation.set(0.1 - lift * 1.1, yaw, side * lift * 0.6, "YXZ");
    });
  }

  meshes.forEach((m) => {
    m.castShadow = true;
    m.receiveShadow = true;
  });
  update({ t: 0, lean: 0.12, look: new THREE.Vector3(0, 1.2, 0), talk: 0 });
  return { root, meshes, update };
}
