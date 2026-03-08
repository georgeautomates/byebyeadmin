import * as THREE from 'three';

export interface LorryLine {
  tier: string;
  points: THREE.Vector3[];
}

// ── Coordinate helper ─────────────────────────────────────────────────────────
// Blender convention: X=width, Y=depth (positive=front/camera), Z=height (up)
// Three.js inner-local:  x=width, y=height, z=-depth
// After inner.rotation.y=π the lorry front correctly faces the camera.
function bv(bx: number, by: number, bz: number): THREE.Vector3 {
  return new THREE.Vector3(bx, bz, -by);
}

// ── Curve helpers (all inputs in Blender convention → output Three.js Vector3) ─

function bez3(
  p0: [number, number, number], p1: [number, number, number],
  p2: [number, number, number], p3: [number, number, number],
  n = 24,
): THREE.Vector3[] {
  const curve = new THREE.CubicBezierCurve3(
    bv(...p0), bv(...p1), bv(...p2), bv(...p3),
  );
  return curve.getPoints(n);
}

function arc(
  p0: [number, number, number], ctrl: [number, number, number],
  p1: [number, number, number], n = 12,
): THREE.Vector3[] {
  const curve = new THREE.QuadraticBezierCurve3(
    bv(...p0), bv(...ctrl), bv(...p1),
  );
  return curve.getPoints(n);
}

function seg(p0: [number, number, number], p1: [number, number, number]): THREE.Vector3[] {
  return [bv(...p0), bv(...p1)];
}

// Circle in Blender YZ plane, centered at (cx, cy, cz), radius r
// Produces a wheel-face disc perpendicular to the Blender X axis.
function circleYZ(cx: number, cy: number, cz: number, r: number, n = 28): THREE.Vector3[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return bv(cx, cy + Math.sin(a) * r, cz + Math.cos(a) * r);
  });
}

// Concatenate path segments into one continuous polyline
function join(...segs: THREE.Vector3[][]): THREE.Vector3[] {
  return segs.flat();
}

// ── Lorry constants (Blender convention, matching generate_lorry.py) ──────────
const HW     = 1.25;   // cab half-width
const CH     = 1.10;   // chassis rail / cab floor height
const Y1     = 3.80;   // cab roof height
const YF     = 1.90;   // cab front Y (positive = toward camera)
const YS     = 0.90;   // windscreen top / roofline Y depth
const ZS     = 2.20;   // windscreen base / grille top height
const WS_HW  = 1.00;   // windscreen half-width at roof (trapezoid)
const YB     = -1.60;  // cab rear Y
const WR     = 0.50;   // wheel radius
const TYF    = -1.90;  // trailer front Y
const TYB    = -14.40; // trailer rear Y
const TZ0    = 1.20;   // trailer floor height
const TZ1    = 4.00;   // trailer roof height
const TLEN   = Math.abs(TYB - TYF); // trailer length = 12.50m

// ── Wheel helper ──────────────────────────────────────────────────────────────
// Adds outer tyre, rim ring, hub, and 8 spokes for one wheel face.
// cx = Blender X (lateral), cy = Blender Y (depth along lorry).
// Wheel centre is always at Blender Z = WR (sitting on ground at Z=0).
function addWheelFace(lines: LorryLine[], cx: number, cy: number): void {
  lines.push({ tier: 'wheel', points: circleYZ(cx, cy, WR, WR, 28) });          // outer tyre
  lines.push({ tier: 'wheel', points: circleYZ(cx, cy, WR, WR * 0.55, 20) });  // rim ring
  lines.push({ tier: 'wheel', points: circleYZ(cx, cy, WR, WR * 0.20, 12) });  // hub
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const sy = Math.sin(a), sz = Math.cos(a);
    lines.push({
      tier: 'wheel', points: [
        bv(cx, cy + sy * WR * 0.20, WR + sz * WR * 0.20),  // hub ring point
        bv(cx, cy + sy * WR * 0.55, WR + sz * WR * 0.55),  // rim ring point
      ],
    });
  }
}

// ── Main export ───────────────────────────────────────────────────────────────
export function createLorryLines(): LorryLine[] {
  const lines: LorryLine[] = [];
  const add = (tier: string, points: THREE.Vector3[]): void => {
    if (points.length >= 2) lines.push({ tier, points });
  };

  // ════════════════════════════════════════════════════════════════════════════
  // CAB SHELL — ACCENT orange, Tier 1 heavy structural silhouette
  // ════════════════════════════════════════════════════════════════════════════

  // Path 1: Cab body outline — full front grille perimeter + A-pillars + roof.
  // One continuous bezier path with rounded corners at every transition.
  add('cab_shell', join(
    seg([-HW, YF, CH],        [HW, YF, CH]),              // grille base (floor level)
    seg([HW, YF, CH],         [HW, YF, ZS - 0.35]),       // right grille side
    arc(                                                    // upper-right grille→A-pillar arc
      [HW, YF, ZS - 0.35],
      [HW, YF, ZS],
      [HW - 0.04, YF - 0.14, ZS + 0.28], 12),
    bez3(                                                   // right A-pillar (bows outward)
      [HW - 0.04, YF - 0.14, ZS + 0.28],
      [HW + 0.08, YF - 0.45, ZS + 0.75],
      [WS_HW + 0.08, YS + 0.35, Y1 - 0.50],
      [WS_HW, YS, Y1], 24),
    arc(                                                    // roof-right corner arc
      [WS_HW, YS, Y1],
      [WS_HW - 0.15, YS, Y1 + 0.02],
      [WS_HW - 0.40, YS, Y1], 8),
    bez3(                                                   // roof top (gentle central peak)
      [WS_HW - 0.40, YS, Y1],
      [WS_HW * 0.5, YS - 0.02, Y1 + 0.06],
      [-WS_HW * 0.5, YS - 0.02, Y1 + 0.06],
      [-WS_HW + 0.40, YS, Y1], 16),
    arc(                                                    // roof-left corner arc
      [-WS_HW + 0.40, YS, Y1],
      [-WS_HW + 0.15, YS, Y1 + 0.02],
      [-WS_HW, YS, Y1], 8),
    bez3(                                                   // left A-pillar (mirror of right)
      [-WS_HW, YS, Y1],
      [-(WS_HW + 0.08), YS + 0.35, Y1 - 0.50],
      [-(HW + 0.08), YF - 0.45, ZS + 0.75],
      [-(HW - 0.04), YF - 0.14, ZS + 0.28], 24),
    arc(                                                    // upper-left corner arc
      [-(HW - 0.04), YF - 0.14, ZS + 0.28],
      [-HW, YF, ZS],
      [-HW, YF, ZS - 0.35], 12),
    seg([-HW, YF, ZS - 0.35], [-HW, YF, CH]),             // left grille side
  ));

  // Path 2: Panel break — windscreen base / grille top bold horizontal
  add('cab_shell', seg([-HW, YF, ZS], [HW, YF, ZS]));

  // Path 3: Roofbar — horizontal bar above roofline, full cab width
  add('cab_shell', seg([-HW - 0.10, YS - 0.05, Y1 + 0.14], [HW + 0.10, YS - 0.05, Y1 + 0.14]));

  // Paths 4-7: Bumper — bold lower bar with curved corner wraps
  // Top edge of bumper at chassis floor height (most prominent horizontal)
  add('cab_shell', join(
    seg([-HW - 0.05, YF - 0.25, CH], [-HW - 0.05, YF - 0.02, CH]),  // left side approach
    arc(                                                                 // left corner round
      [-HW - 0.05, YF - 0.02, CH],
      [-HW - 0.05, YF + 0.20, CH],
      [-HW + 0.10, YF + 0.20, CH], 10),
    seg([-HW + 0.10, YF + 0.20, CH], [HW - 0.10, YF + 0.20, CH]),   // main front top
    arc(                                                                 // right corner round
      [HW - 0.10, YF + 0.20, CH],
      [HW + 0.05, YF + 0.20, CH],
      [HW + 0.05, YF - 0.02, CH], 10),
    seg([HW + 0.05, YF - 0.02, CH], [HW + 0.05, YF - 0.25, CH]),    // right side approach
  ));
  // Bottom edge of bumper (near ground)
  add('cab_shell', seg([-HW - 0.05, YF + 0.20, 0.10], [HW + 0.05, YF + 0.20, 0.10]));
  // Vertical side stubs (left and right)
  add('cab_shell', seg([-HW - 0.05, YF + 0.20, 0.10], [-HW - 0.05, YF + 0.20, CH]));
  add('cab_shell', seg([HW + 0.05,  YF + 0.20, 0.10], [HW + 0.05,  YF + 0.20, CH]));

  // Paths 8-10: Visible cab side face (Blender +X = driver side facing camera)
  add('cab_shell', seg([HW, YF, CH],       [HW, YB, CH]));           // bottom sill
  add('cab_shell', seg([HW, YB, CH],       [HW, YB, Y1 * 0.78]));   // rear pillar
  add('cab_shell', seg([HW, YF, Y1*0.78],  [HW, YB, Y1 * 0.78]));  // top rail

  // ════════════════════════════════════════════════════════════════════════════
  // CAB DETAILS — TEAL, Tier 3 fine interior structure
  // ════════════════════════════════════════════════════════════════════════════

  // Windscreen centre pillar (X=0, from grille top to roof)
  add('cab_details', seg([0, YF, ZS], [0, YS, Y1]));

  // Six horizontal grille bars (evenly spaced between CH and ZS)
  for (let i = 0; i < 6; i++) {
    const gz = CH + (ZS - CH) * (i + 1) / 7;
    add('cab_details', seg([-HW + 0.06, YF + 0.04, gz], [HW - 0.06, YF + 0.04, gz]));
  }

  // Door outline — 4 edges forming the door rectangle on the cab side
  const doorY0 = YB + 0.84, doorY1 = YF - 0.06;
  const doorZ0 = CH + 0.10, doorZ1 = 3.00;
  add('cab_details', seg([HW, doorY0, doorZ0], [HW, doorY1, doorZ0]));  // bottom
  add('cab_details', seg([HW, doorY0, doorZ1], [HW, doorY1, doorZ1]));  // top
  add('cab_details', seg([HW, doorY1, doorZ0], [HW, doorY1, doorZ1]));  // front edge
  add('cab_details', seg([HW, doorY0, doorZ0], [HW, doorY0, doorZ1]));  // rear edge

  // Door window — inset rectangle in upper 45% of door
  const winZ0 = doorZ0 + (doorZ1 - doorZ0) * 0.55;
  const winZ1 = doorZ1 - 0.10;
  add('cab_details', seg([HW, doorY0 + 0.08, winZ0],  [HW, doorY1 - 0.06, winZ0]));  // bottom
  add('cab_details', seg([HW, doorY0 + 0.08, winZ1],  [HW, doorY1 - 0.06, winZ1]));  // top
  add('cab_details', seg([HW, doorY1 - 0.06, winZ0],  [HW, doorY1 - 0.06, winZ1]));  // front
  add('cab_details', seg([HW, doorY0 + 0.08, winZ0],  [HW, doorY0 + 0.08, winZ1]));  // rear

  // Wing mirror arm (extends outward from upper cab side)
  add('cab_details', seg([HW, YF - 0.05, 2.90], [HW + 0.50, YF - 0.20, 2.90]));

  // Mirror glass rectangle at arm end
  add('cab_details', seg([HW + 0.50, YF - 0.20, 2.72], [HW + 0.58, YF - 0.20, 2.72]));  // bottom
  add('cab_details', seg([HW + 0.50, YF - 0.20, 3.06], [HW + 0.58, YF - 0.20, 3.06]));  // top
  add('cab_details', seg([HW + 0.50, YF - 0.20, 2.72], [HW + 0.50, YF - 0.20, 3.06]));  // left
  add('cab_details', seg([HW + 0.58, YF - 0.20, 2.72], [HW + 0.58, YF - 0.20, 3.06]));  // right

  // Airlines — three catenary curves spanning cab rear → trailer front
  const airlineParams: Array<[number, number]> = [[-0.28, 0.16], [0, 0.20], [0.28, 0.16]];
  for (const [ax, drop] of airlineParams) {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 10; i++) {
      const frac = i / 10;
      const gy = YB + (TYF - YB) * frac;
      const gz = 1.98 - Math.sin(frac * Math.PI) * drop;
      pts.push(bv(ax, gy, gz));
    }
    add('cab_details', pts);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // HEADLIGHTS — pure white, enormous bloom
  // ════════════════════════════════════════════════════════════════════════════

  // Two headlight rectangles on the front face (Blender Y = YF+0.04 plane)
  const hZ0 = 1.21, hZ1 = 1.55;
  for (const sx of [-1, 1]) {
    const x0 = sx * 0.54, x1 = sx * 1.01;
    const [xL, xR] = x0 < x1 ? [x0, x1] : [x1, x0];
    add('headlight', [
      bv(xL, YF + 0.04, hZ0), bv(xR, YF + 0.04, hZ0),
      bv(xR, YF + 0.04, hZ1), bv(xL, YF + 0.04, hZ1),
      bv(xL, YF + 0.04, hZ0),  // close the rectangle
    ]);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // MARKER LIGHTS — amber, 5 dots across roofbar width
  // ════════════════════════════════════════════════════════════════════════════

  const mxPositions = [-1.00, -0.50, 0.00, 0.50, 1.00];
  const mY = YS - 0.03, mZlo = Y1 + 0.14, mZhi = Y1 + 0.24, mhw = 0.05;
  for (const mx of mxPositions) {
    add('marker', [
      bv(mx - mhw, mY, mZlo), bv(mx + mhw, mY, mZlo),
      bv(mx + mhw, mY, mZhi), bv(mx - mhw, mY, mZhi),
      bv(mx - mhw, mY, mZlo),  // close the square
    ]);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // TRAILER SHELL — ACCENT orange, heavy structural frame
  // ════════════════════════════════════════════════════════════════════════════

  // Top rectangle (roof perimeter)
  add('trailer_shell', seg([-HW, TYF, TZ1], [HW, TYF, TZ1]));   // front top
  add('trailer_shell', seg([-HW, TYF, TZ1], [-HW, TYB, TZ1]));  // left top rail
  add('trailer_shell', seg([HW,  TYF, TZ1], [HW,  TYB, TZ1]));  // right top rail
  add('trailer_shell', seg([-HW, TYB, TZ1], [HW,  TYB, TZ1]));  // rear top

  // Trailer front face
  add('trailer_shell', seg([-HW, TYF, TZ0], [HW,  TYF, TZ0]));  // front bottom
  add('trailer_shell', seg([-HW, TYF, TZ0], [-HW, TYF, TZ1]));  // left front post
  add('trailer_shell', seg([HW,  TYF, TZ0], [HW,  TYF, TZ1]));  // right front post

  // Rear door frame — outer
  add('trailer_shell', seg([-HW, TYB, TZ0], [HW,  TYB, TZ0]));  // rear bottom
  add('trailer_shell', seg([-HW, TYB, TZ0], [-HW, TYB, TZ1]));  // left rear post
  add('trailer_shell', seg([HW,  TYB, TZ0], [HW,  TYB, TZ1]));  // right rear post

  // Rear door frame — inner (inset 0.08m)
  const ins = 0.08;
  add('trailer_shell', seg([-(HW - ins), TYB, TZ0 + ins], [HW - ins,  TYB, TZ0 + ins]));  // bottom
  add('trailer_shell', seg([-(HW - ins), TYB, TZ1 - ins], [HW - ins,  TYB, TZ1 - ins]));  // top
  add('trailer_shell', seg([-(HW - ins), TYB, TZ0 + ins], [-(HW-ins), TYB, TZ1 - ins]));  // left
  add('trailer_shell', seg([HW - ins,    TYB, TZ0 + ins], [HW - ins,  TYB, TZ1 - ins]));  // right
  add('trailer_shell', seg([0,            TYB, TZ0 + ins], [0,          TYB, TZ1 - ins]));  // centre split

  // ════════════════════════════════════════════════════════════════════════════
  // TRAILER DETAILS — TEAL, fine structure
  // ════════════════════════════════════════════════════════════════════════════

  // Curtain posts — 8 per side, evenly spaced along trailer length
  for (let i = 0; i < 8; i++) {
    const py = TYF + (TYB - TYF) * (i + 0.5) / 8;
    add('trailer_details', seg([-HW, py, TZ0], [-HW, py, TZ1]));  // left side
    add('trailer_details', seg([HW,  py, TZ0], [HW,  py, TZ1]));  // right side
  }

  // Landing legs (just behind the fifth-wheel coupling area)
  const llX = HW - 0.18;
  add('trailer_details', seg([-llX, TYF + 1.20, 0],    [-llX, TYF + 1.20, TZ0]));
  add('trailer_details', seg([llX,  TYF + 1.20, 0],    [llX,  TYF + 1.20, TZ0]));
  add('trailer_details', seg([-llX, TYF + 1.20, TZ0 * 0.30], [llX, TYF + 1.20, TZ0 * 0.30]));  // cross-bar

  // ════════════════════════════════════════════════════════════════════════════
  // CHASSIS — ACCENT orange, Tier 2 structural rails
  // ════════════════════════════════════════════════════════════════════════════

  const cRailZ = CH - 0.12;  // rail height = 0.98m
  const cRailX = 0.82;
  // Left and right chassis rails (full length, cab rear to trailer rear)
  add('chassis', seg([-cRailX, YB - 0.04, cRailZ], [-cRailX, TYB + 0.04, cRailZ]));
  add('chassis', seg([cRailX,  YB - 0.04, cRailZ], [cRailX,  TYB + 0.04, cRailZ]));

  // Cross-members (7 evenly spaced between cab rear and trailer rear)
  const railY0 = YB - 0.04;
  const railY1 = TYB + 0.04;
  for (let i = 0; i < 7; i++) {
    const py = railY0 + (railY1 - railY0) * (i / 6);
    add('chassis', seg([-cRailX, py, cRailZ], [cRailX, py, cRailZ]));
  }

  // ════════════════════════════════════════════════════════════════════════════
  // WHEELS — TEAL, smooth circles
  // ════════════════════════════════════════════════════════════════════════════

  // Front steer axle (single wheel each side)
  const frontAxleY = YF - 1.0;  // 0.90m — under cab, 1m behind front face
  addWheelFace(lines, -(HW + 0.13), frontAxleY);
  addWheelFace(lines,  (HW + 0.13), frontAxleY);

  // Drive axles (dual wheels each side — inner + outer)
  for (const axleY of [YB - 0.50, YB - 1.15]) {
    for (const sx of [-1, 1]) {
      addWheelFace(lines, sx * (HW - 0.02), axleY);   // inner
      addWheelFace(lines, sx * (HW + 0.24), axleY);   // outer
    }
  }

  // Trailer axles (dual wheels each side)
  for (const axleY of [TYB + 3.0, TYB + 1.8]) {
    for (const sx of [-1, 1]) {
      addWheelFace(lines, sx * (HW - 0.02), axleY);   // inner
      addWheelFace(lines, sx * (HW + 0.24), axleY);   // outer
    }
  }

  return lines;
}
