'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// ── Brand colours ─────────────────────────────────────────────────────────────
const ACCENT      = 0xE8572A;
const TEAL        = 0x2D8B8B;
const NAVY        = 0x0F1419;
const WARM_W      = 0xF5F2EF;
const GREEN_D     = 0x059669;

// ── Selective bloom via layer ──────────────────────────────────────────────────
const BLOOM_LAYER = 1;

// ── Route ground Y ────────────────────────────────────────────────────────────
const ROUTE_Y = -2.5;

// ── Mix-bloom shader ──────────────────────────────────────────────────────────
const MixBloomShader = {
  uniforms: {
    baseTexture:  { value: null as THREE.Texture | null },
    bloomTexture: { value: null as THREE.Texture | null },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: `
    uniform sampler2D baseTexture;
    uniform sampler2D bloomTexture;
    varying vec2 vUv;
    void main() {
      gl_FragColor = texture2D(baseTexture, vUv) + vec4(texture2D(bloomTexture, vUv).rgb, 0.0);
    }
  `,
};

// ── Delivery stops — FIX 3: spread across full route (15%–90%) ────────────────
const ROUTE_STOPS = [
  { id: 'orders',     t: 0.15, label: 'Order Entry',        value: '47 today',      color: '#E8612D', hex: ACCENT },
  { id: 'pod',        t: 0.30, label: 'POD Matching',       value: '100% matched',  color: '#2D8B8B', hex: TEAL   },
  { id: 'invoice',    t: 0.45, label: 'Invoicing',          value: '£12,450 today', color: '#E8612D', hex: ACCENT },
  { id: 'compliance', t: 0.55, label: 'Compliance',         value: 'All clear',     color: '#2D8B8B', hex: TEAL   },
  { id: 'quoting',    t: 0.68, label: 'Quoting',            value: '< 60 seconds',  color: '#E8612D', hex: ACCENT },
  { id: 'drivers',    t: 0.78, label: 'Driver Scheduling',  value: '0 conflicts',   color: '#2D8B8B', hex: TEAL   },
  { id: 'timesheets', t: 0.90, label: 'Timesheets',         value: 'Auto-filed',    color: '#F5F2EF', hex: WARM_W },
];

// ── Public types & exports (HeroScroll.tsx depends on these) ──────────────────
export interface PinState {
  id: string;
  x: number;
  y: number;
  visible: boolean;
}

export const LORRY_PIN_DEFS = ROUTE_STOPS.map((s) => ({
  id:       s.id,
  localPos: new THREE.Vector3(0, 0, 0),
  label:    s.label,
  value:    s.value,
  color:    s.color,
}));

// ── Route shape ───────────────────────────────────────────────────────────────
const ROUTE_CTRL_PTS = [
  new THREE.Vector3( 5.5, ROUTE_Y,  21.0),
  new THREE.Vector3( 2.5, ROUTE_Y,  10.5),
  new THREE.Vector3(-2.5, ROUTE_Y,   1.5),
  new THREE.Vector3(-4.5, ROUTE_Y,  -9.0),
  new THREE.Vector3(-2.5, ROUTE_Y, -19.5),
  new THREE.Vector3( 3.0, ROUTE_Y, -28.5),
  new THREE.Vector3( 5.5, ROUTE_Y, -39.0),
  new THREE.Vector3( 3.0, ROUTE_Y, -49.5),
  new THREE.Vector3(-0.5, ROUTE_Y, -60.0),
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function clamp01(x: number) { return Math.max(0, Math.min(1, x)); }

// Compute parallel edge line positions (offset ± perpendicular to route)
function computeParallelRoute(
  route: THREE.CatmullRomCurve3,
  offset: number,
  samples: number
): number[] {
  const pts: number[] = [];
  for (let i = 0; i < samples; i++) {
    const t   = i / (samples - 1);
    const pt  = route.getPointAt(t);
    const tgt = route.getTangentAt(t);
    pts.push(
      pt.x - tgt.z * offset,
      ROUTE_Y + 0.01,
      pt.z + tgt.x * offset,
    );
  }
  return pts;
}

// Like computeParallelRoute but also takes a Y-offset above ROUTE_Y
function computeParallelRouteAt(
  route: THREE.CatmullRomCurve3,
  lateralOffset: number,
  yAboveGround: number,
  samples: number
): number[] {
  const pts: number[] = [];
  for (let i = 0; i < samples; i++) {
    const t   = i / (samples - 1);
    const pt  = route.getPointAt(t);
    const tgt = route.getTangentAt(t);
    pts.push(
      pt.x - tgt.z * lateralOffset,
      ROUTE_Y + yAboveGround,
      pt.z + tgt.x * lateralOffset,
    );
  }
  return pts;
}

// ── [legacy buildLorry removed in Phase 7 — replaced by lib/lorryLines.ts] ────
function buildLorryLegacy(disposables: (THREE.BufferGeometry | THREE.Material)[]): THREE.Group {
  const lorryGroup = new THREE.Group();

  function addWire(
    geo: THREE.BufferGeometry,
    color: number,
    opacity: number,
    parent: THREE.Object3D,
    pos: [number, number, number],
    rotZ = 0,
    rotX = 0
  ): THREE.LineSegments {
    const edges = new THREE.EdgesGeometry(geo);
    geo.dispose();
    const mat = new THREE.LineBasicMaterial({
      color, transparent: true, opacity,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const lines = new THREE.LineSegments(edges, mat);
    lines.position.set(...pos);
    if (rotZ) lines.rotation.z = rotZ;
    if (rotX) lines.rotation.x = rotX;
    lines.layers.enable(BLOOM_LAYER);
    parent.add(lines);
    disposables.push(edges, mat);
    return lines;
  }

  function addPrism(
    verts: Float32Array,
    index: Uint16Array,
    color: number,
    opacity: number,
    parent: THREE.Object3D
  ): THREE.LineSegments {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    geo.setIndex(new THREE.BufferAttribute(index, 1));
    geo.computeVertexNormals();
    const edges = new THREE.EdgesGeometry(geo, 1);
    geo.dispose();
    const mat = new THREE.LineBasicMaterial({
      color, transparent: true, opacity,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const lines = new THREE.LineSegments(edges, mat);
    lines.layers.enable(BLOOM_LAYER);
    parent.add(lines);
    disposables.push(edges, mat);
    return lines;
  }

  function addLine(
    pts: THREE.Vector3[],
    color: number,
    opacity: number,
    parent: THREE.Object3D
  ): THREE.Line {
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({
      color, transparent: true, opacity,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const line = new THREE.Line(geo, mat);
    line.layers.enable(BLOOM_LAYER);
    parent.add(line);
    disposables.push(geo, mat);
    return line;
  }

  // ── Dimensions ──────────────────────────────────────────────────────────────
  const HW      = 1.25;   // half width (2.5 total)
  const CHASSIS = 1.10;   // chassis height above ground
  const WR      = 0.50;   // wheel radius
  const WW      = 0.35;   // wheel width

  const CZ_F   = +1.60;   // front face (cab nose)
  const CZ_R   = +1.10;   // top of front face (raked windscreen, 0.50 set-back)
  const CZ_B   = -1.60;   // rear of cab
  const CAB_Y0 = CHASSIS;
  const CAB_Y1 = 3.80;

  // ── CAB ─────────────────────────────────────────────────────────────────────
  const cabGroup = new THREE.Group();
  lorryGroup.add(cabGroup);

  // Main cab body — raked windscreen prism
  addPrism(
    new Float32Array([
      -HW, CAB_Y0, CZ_F,   HW, CAB_Y0, CZ_F,   HW, CAB_Y0, CZ_B,  -HW, CAB_Y0, CZ_B,
      -HW, CAB_Y1, CZ_R,   HW, CAB_Y1, CZ_R,   HW, CAB_Y1, CZ_B,  -HW, CAB_Y1, CZ_B,
    ]),
    new Uint16Array([0,3,2, 0,2,1,  4,5,6, 4,6,7,  0,1,5, 0,5,4,  2,3,7, 2,7,6,  0,4,7, 0,7,3,  1,2,6, 1,6,5]),
    ACCENT, 0.88, cabGroup
  );

  // Roof fairing — rises 0.40 above cab rear roof
  addPrism(
    new Float32Array([
      -HW, CAB_Y1,        0.10,  HW, CAB_Y1,        0.10,  HW, CAB_Y1,        CZ_B,  -HW, CAB_Y1,        CZ_B,
      -HW, CAB_Y1 + 0.40, 0.10,  HW, CAB_Y1 + 0.40, 0.10,  HW, CAB_Y1 + 0.40, CZ_B,  -HW, CAB_Y1 + 0.40, CZ_B,
    ]),
    new Uint16Array([0,3,2, 0,2,1,  4,5,6, 4,6,7,  0,1,5, 0,5,4,  2,3,7, 2,7,6,  0,4,7, 0,7,3,  1,2,6, 1,6,5]),
    ACCENT, 0.52, cabGroup
  );

  // Fairing horizontal ribs (2 structural bands across the fairing face)
  [0.14, 0.30].forEach((yOff) => {
    addLine([
      new THREE.Vector3(-HW, CAB_Y1 + yOff, CZ_B),
      new THREE.Vector3( HW, CAB_Y1 + yOff, CZ_B),
    ], ACCENT, 0.22, cabGroup);
    addLine([
      new THREE.Vector3(-HW, CAB_Y1 + yOff, 0.10),
      new THREE.Vector3( HW, CAB_Y1 + yOff, 0.10),
    ], ACCENT, 0.16, cabGroup);
  });

  // Bumper step (extends 0.15 forward of front face)
  addWire(new THREE.BoxGeometry(HW * 2 + 0.06, CHASSIS, 0.30), ACCENT, 0.68, cabGroup, [0, CHASSIS / 2, CZ_F + 0.15]);

  // Grille slats — 5 horizontal bars spanning the full grille zone
  [1.10, 1.40, 1.70, 2.00, 2.30].forEach((y) => {
    addWire(new THREE.BoxGeometry(HW * 2 - 0.12, 0.055, 0.055), ACCENT, 0.42, cabGroup, [0, y, CZ_F + 0.03]);
  });

  // Windscreen centre divider — vertical bar splitting windscreen into driver/passenger
  addLine([
    new THREE.Vector3(0, CAB_Y0 + 0.48, CZ_F - 0.01),
    new THREE.Vector3(0, CAB_Y1,        CZ_R + 0.02),
  ], WARM_W, 0.32, cabGroup);

  // A-pillars — diagonal from lower front corners to roof windscreen edge
  [-1, 1].forEach((side) => {
    addLine([
      new THREE.Vector3(side * HW * 0.95, CAB_Y0 + 0.40, CZ_F),
      new THREE.Vector3(side * HW * 0.88, CAB_Y1,         CZ_R + 0.15),
    ], ACCENT, 0.55, cabGroup);
  });

  // Sunvisor — horizontal shelf above windscreen (signature UK cab-over feature)
  addWire(new THREE.BoxGeometry(HW * 2, 0.07, 0.44), ACCENT, 0.50, cabGroup, [0, CAB_Y1 + 0.06, CZ_R + 0.17]);
  [-0.62, 0.62].forEach((x) => {
    addLine([
      new THREE.Vector3(x, CAB_Y1 + 0.06, CZ_R + 0.05),
      new THREE.Vector3(x, CAB_Y1,         CZ_R + 0.05),
    ], ACCENT, 0.28, cabGroup);
  });

  // Vertical grille bars (5 bars crossing the 3 horizontal slats)
  [-0.85, -0.45, 0, 0.45, 0.85].forEach((x) => {
    addLine([
      new THREE.Vector3(x, CAB_Y0 + 0.10, CZ_F + 0.03),
      new THREE.Vector3(x, CAB_Y0 + 2.32, CZ_F + 0.03),
    ], ACCENT, 0.22, cabGroup);
  });

  // Cab corner marker lights (teal, UK legal requirement at front corners)
  const mMarker = new THREE.MeshBasicMaterial({ color: TEAL });
  [-HW, HW].forEach((x) => {
    const gMk = new THREE.BoxGeometry(0.04, 0.14, 0.09);
    const mk  = new THREE.Mesh(gMk, mMarker);
    mk.position.set(x + (x > 0 ? 0.02 : -0.02), 1.62, CZ_F + 0.01);
    mk.layers.enable(BLOOM_LAYER);
    cabGroup.add(mk);
    disposables.push(gMk);
  });
  disposables.push(mMarker);

  // Air horns — pair of cylinders on cab roof
  [-0.30, 0.30].forEach((x) => {
    addWire(new THREE.CylinderGeometry(0.05, 0.05, 0.52, 6), WARM_W, 0.28, cabGroup, [x, CAB_Y1 + 0.40 + 0.26, CZ_B + 0.55]);
  });

  // Door outlines — UK cab-over doors span most of the side wall
  [-1, 1].forEach((side) => {
    const dx = side * HW;
    // B-pillar (door front edge, vertical from floor to window base)
    addLine([
      new THREE.Vector3(dx, CAB_Y0 + 0.02, CZ_B + 0.85),
      new THREE.Vector3(dx, 3.02,           CZ_B + 0.85),
    ], ACCENT, 0.36, cabGroup);
    // Door sill (horizontal at step height)
    addLine([
      new THREE.Vector3(dx, CAB_Y0 + 0.36, CZ_B + 0.85),
      new THREE.Vector3(dx, CAB_Y0 + 0.36, CZ_F - 0.06),
    ], ACCENT, 0.26, cabGroup);
    // Window base (horizontal, separates lower door from window glass)
    addLine([
      new THREE.Vector3(dx, 3.02, CZ_B + 0.85),
      new THREE.Vector3(dx, 3.02, CZ_F - 0.06),
    ], ACCENT, 0.30, cabGroup);
    // Grab handle (vertical bar beside door, for climbing in)
    addLine([
      new THREE.Vector3(dx + side * 0.06, CAB_Y0 + 0.88, CZ_F - 0.24),
      new THREE.Vector3(dx + side * 0.06, CAB_Y0 + 1.62, CZ_F - 0.24),
    ], ACCENT, 0.28, cabGroup);
    // Horizontal swage line — mid-height feature crease on cab side
    addLine([
      new THREE.Vector3(dx, 2.62, CZ_B),
      new THREE.Vector3(dx, 2.62, CZ_F - 0.06),
    ], ACCENT, 0.32, cabGroup);
    // Fuel filler cap (small circle indication on rear half of door)
    addWire(new THREE.CylinderGeometry(0.07, 0.07, 0.04, 8), ACCENT, 0.22, cabGroup,
      [dx + side * 0.01, CAB_Y0 + 0.80, CZ_B + 0.40]);
  });

  // Wheel arch arcs — semi-circular cutout on cab side for front steer wheel
  // (One of the most distinctive recognition features of a cab-over HGV)
  const ARCH_Z  = CZ_F - 1.0;   // wheel centre Z
  const ARCH_R  = WR + 0.16;     // arch radius (slightly larger than wheel)
  const WY_ARCH = WR;            // wheel centre Y
  [-1, 1].forEach((side) => {
    const archPts: THREE.Vector3[] = [];
    for (let a = 0; a <= 18; a++) {
      const ang = Math.PI * (a / 18);
      archPts.push(new THREE.Vector3(
        side * HW,
        WY_ARCH + Math.sin(ang) * ARCH_R,
        ARCH_Z   - Math.cos(ang) * ARCH_R,
      ));
    }
    addLine(archPts, ACCENT, 0.48, cabGroup);
    // Mudguard lip — short horizontal lines framing the arch opening
    addLine([
      new THREE.Vector3(side * HW, WY_ARCH, ARCH_Z - ARCH_R - 0.04),
      new THREE.Vector3(side * HW, WY_ARCH, ARCH_Z - ARCH_R + 0.28),
    ], ACCENT, 0.22, cabGroup);
    addLine([
      new THREE.Vector3(side * HW, WY_ARCH, ARCH_Z + ARCH_R - 0.28),
      new THREE.Vector3(side * HW, WY_ARCH, ARCH_Z + ARCH_R + 0.04),
    ], ACCENT, 0.22, cabGroup);
  });

  // Cab rear face — sleeper window (horizontal rectangle behind driver)
  addWire(new THREE.BoxGeometry(HW * 1.10, 0.48, 0.04), WARM_W, 0.32, cabGroup, [0, CAB_Y1 - 0.68, CZ_B - 0.02]);
  // Cab rear face — upper panel line
  addLine([
    new THREE.Vector3(-HW, CAB_Y1 - 0.10, CZ_B),
    new THREE.Vector3( HW, CAB_Y1 - 0.10, CZ_B),
  ], ACCENT, 0.20, cabGroup);

  // LED top bar
  const mLED = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
  const gLED = new THREE.BoxGeometry(HW * 2 - 0.18, 0.03, 0.03);
  const ledBar = new THREE.Mesh(gLED, mLED);
  ledBar.position.set(0, CAB_Y1 - 0.02, CZ_R + 0.02);
  ledBar.layers.enable(BLOOM_LAYER);
  cabGroup.add(ledBar);
  disposables.push(gLED, mLED);

  // Headlights
  const mHL = new THREE.MeshBasicMaterial({ color: 0xDDEEFF });
  [-0.68, 0.68].forEach((x) => {
    const gHL = new THREE.BoxGeometry(0.36, 0.20, 0.04);
    const hl  = new THREE.Mesh(gHL, mHL);
    hl.position.set(x, 0.48, CZ_F + 0.28);
    hl.layers.enable(BLOOM_LAYER);
    cabGroup.add(hl);
    disposables.push(gHL);
  });
  disposables.push(mHL);

  // Headlight inner detail — bright inner housing rectangle
  [-0.68, 0.68].forEach((x) => {
    addWire(new THREE.BoxGeometry(0.22, 0.12, 0.03), WARM_W, 0.50, cabGroup, [x, 0.48, CZ_F + 0.30]);
  });

  // Fog light recesses in lower bumper
  [-0.60, 0.60].forEach((x) => {
    addWire(new THREE.BoxGeometry(0.20, 0.13, 0.04), WARM_W, 0.24, cabGroup, [x, 0.22, CZ_F + 0.28]);
  });
  const mFog = new THREE.MeshBasicMaterial({ color: 0xFFFFCC });
  [-0.60, 0.60].forEach((x) => {
    const gFog = new THREE.BoxGeometry(0.12, 0.07, 0.02);
    const fog  = new THREE.Mesh(gFog, mFog);
    fog.position.set(x, 0.22, CZ_F + 0.30);
    fog.layers.enable(BLOOM_LAYER);
    cabGroup.add(fog);
    disposables.push(gFog);
  });
  disposables.push(mFog);

  // DRL strips (orange)
  const mDRL = new THREE.MeshBasicMaterial({ color: ACCENT });
  [-0.68, 0.68].forEach((x) => {
    const gDRL = new THREE.BoxGeometry(0.36, 0.04, 0.03);
    const drl  = new THREE.Mesh(gDRL, mDRL);
    drl.position.set(x, 0.72, CZ_F + 0.28);
    drl.layers.enable(BLOOM_LAYER);
    cabGroup.add(drl);
    disposables.push(gDRL);
  });
  disposables.push(mDRL);

  // Wing mirrors
  [-1, 1].forEach((side) => {
    addWire(new THREE.BoxGeometry(0.06, 0.04, 0.36), ACCENT, 0.36, cabGroup, [side * (HW + 0.03), 2.60, 0.90]);
    addWire(new THREE.BoxGeometry(0.14, 0.26, 0.08), ACCENT, 0.46, cabGroup, [side * (HW + 0.10), 2.60, 0.74]);
  });

  // Step plates
  [-1, 1].forEach((side) => {
    addWire(new THREE.BoxGeometry(0.12, 0.07, 0.34), ACCENT, 0.24, cabGroup, [side * (HW + 0.06), 0.62, 0.44]);
    addWire(new THREE.BoxGeometry(0.12, 0.07, 0.34), ACCENT, 0.18, cabGroup, [side * (HW + 0.06), 0.34, 0.44]);
  });

  // Headlight road glow (additive bloom plane ahead of cab)
  const hlGlowGeo = new THREE.PlaneGeometry(2.6, 6.0);
  const hlGlowMat = new THREE.MeshBasicMaterial({
    color: 0xCCDDFF, transparent: true, opacity: 0.06,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const hlGlowPlane = new THREE.Mesh(hlGlowGeo, hlGlowMat);
  hlGlowPlane.rotation.x = -Math.PI / 2;
  hlGlowPlane.position.set(0, 0, CZ_F + 3.8);
  hlGlowPlane.layers.enable(BLOOM_LAYER);
  lorryGroup.add(hlGlowPlane);
  disposables.push(hlGlowGeo, hlGlowMat);

  // Fifth wheel coupling
  addWire(new THREE.CylinderGeometry(0.55, 0.55, 0.09, 14), ACCENT, 0.36,
    lorryGroup, [0, CHASSIS + 0.04, CZ_B - 0.18]);

  // ── TRAILER (gap = 0.30 units) ───────────────────────────────────────────────
  const trailerGroup = new THREE.Group();
  lorryGroup.add(trailerGroup);

  const TZ_F  = -1.90;   // = CZ_B - 0.30 gap = -1.60 - 0.30
  const TZ_B  = -14.40;  // 12.5 unit trailer
  const TLEN  = Math.abs(TZ_B - TZ_F);
  const TZC   = (TZ_F + TZ_B) / 2;
  const T_Y0  = CHASSIS + 0.10;
  const T_Y1  = 4.00;
  const TH    = T_Y1 - T_Y0;

  // Trailer main box
  addWire(new THREE.BoxGeometry(HW * 2, TH, TLEN), WARM_W, 0.52, trailerGroup, [0, (T_Y0 + T_Y1) / 2, TZC]);

  // Teal branding stripes (1/3 and 2/3 height on sides)
  [-1, 1].forEach((side) => {
    [T_Y0 + TH * 0.33, T_Y0 + TH * 0.67].forEach((yLine) => {
      addLine([
        new THREE.Vector3(side * HW, yLine, TZ_F),
        new THREE.Vector3(side * HW, yLine, TZ_B),
      ], TEAL, 0.82, trailerGroup);
    });
  });

  // Panel join lines (7 vertical per side — ~2m spacing on a 12.5m trailer)
  [-1, 1].forEach((side) => {
    for (let panel = 1; panel <= 7; panel++) {
      const zPos = TZ_F + (TLEN / 8) * panel;
      addLine([
        new THREE.Vector3(side * HW, T_Y0, zPos),
        new THREE.Vector3(side * HW, T_Y1, zPos),
      ], WARM_W, 0.16, trailerGroup);
    }
  });

  // Horizontal swage line at 60% height (feature crease on trailer sides)
  [-1, 1].forEach((side) => {
    addLine([
      new THREE.Vector3(side * HW, T_Y0 + TH * 0.60, TZ_F),
      new THREE.Vector3(side * HW, T_Y0 + TH * 0.60, TZ_B),
    ], WARM_W, 0.28, trailerGroup);
  });

  // Rub rail — protective horizontal bar along trailer bottom sides
  [-1, 1].forEach((side) => {
    addLine([
      new THREE.Vector3(side * HW, T_Y0 + 0.14, TZ_F),
      new THREE.Vector3(side * HW, T_Y0 + 0.14, TZ_B),
    ], WARM_W, 0.24, trailerGroup);
  });

  // Roof rails — 3 longitudinal ribs running front-to-back across trailer top
  [-0.58, 0.0, 0.58].forEach((x) => {
    addLine([
      new THREE.Vector3(x, T_Y1 - 0.02, TZ_F),
      new THREE.Vector3(x, T_Y1 - 0.02, TZ_B),
    ], WARM_W, 0.13, trailerGroup);
  });

  // Front headboard ribs (3 horizontal bars on trailer front face)
  [0.28, 0.52, 0.76].forEach((frac) => {
    addLine([
      new THREE.Vector3(-HW + 0.06, T_Y0 + TH * frac, TZ_F + 0.02),
      new THREE.Vector3( HW - 0.06, T_Y0 + TH * frac, TZ_F + 0.02),
    ], WARM_W, 0.14, trailerGroup);
  });

  // Trailer side marker lights — 3 amber markers per side (legal requirement)
  const mSideMarker = new THREE.MeshBasicMaterial({ color: 0xFF8800 });
  [-1, 1].forEach((side) => {
    [TZ_F + TLEN * 0.22, TZ_F + TLEN * 0.50, TZ_F + TLEN * 0.78].forEach((mz) => {
      const gSM = new THREE.BoxGeometry(0.04, 0.08, 0.12);
      const sm  = new THREE.Mesh(gSM, mSideMarker);
      sm.position.set(side * (HW + 0.01), T_Y0 + 0.30, mz);
      sm.layers.enable(BLOOM_LAYER);
      trailerGroup.add(sm);
      disposables.push(gSM);
    });
  });
  disposables.push(mSideMarker);

  // Rear door split + latch bar
  addLine([new THREE.Vector3(0, T_Y0, TZ_B), new THREE.Vector3(0, T_Y1, TZ_B)], WARM_W, 0.28, trailerGroup);
  addLine([
    new THREE.Vector3(-HW + 0.06, T_Y0 + TH * 0.60, TZ_B),
    new THREE.Vector3( HW - 0.06, T_Y0 + TH * 0.60, TZ_B),
  ], WARM_W, 0.20, trailerGroup);

  // Rear corner posts — bright vertical edges reinforcing rear corners
  [-1, 1].forEach((side) => {
    addLine([
      new THREE.Vector3(side * HW, T_Y0, TZ_B),
      new THREE.Vector3(side * HW, T_Y1, TZ_B),
    ], WARM_W, 0.42, trailerGroup);
  });

  // Rear door hinges — 3 per door side (small horizontal bars on outer edges)
  [-1, 1].forEach((side) => {
    [T_Y0 + 0.28, T_Y0 + TH * 0.50, T_Y0 + TH * 0.82].forEach((hy) => {
      addWire(new THREE.BoxGeometry(0.10, 0.10, 0.06), WARM_W, 0.20, trailerGroup,
        [side * (HW - 0.05), hy, TZ_B - 0.02]);
    });
  });

  // Rear lock rod (vertical bar offset inside each door half)
  [-0.32, 0.32].forEach((x) => {
    addLine([
      new THREE.Vector3(x, T_Y0 + 0.14, TZ_B - 0.01),
      new THREE.Vector3(x, T_Y0 + TH * 0.92, TZ_B - 0.01),
    ], WARM_W, 0.16, trailerGroup);
  });

  // Rear underrun bar
  addWire(new THREE.BoxGeometry(HW * 2 + 0.04, 0.06, 0.05), WARM_W, 0.22, trailerGroup, [0, T_Y0 + 0.04, TZ_B - 0.03]);

  // Rear lights
  const mRearRed   = new THREE.MeshBasicMaterial({ color: 0xFF1010 });
  const mRearAmber = new THREE.MeshBasicMaterial({ color: 0xFF8800 });
  [-HW + 0.09, HW - 0.09].forEach((x) => {
    const gRL = new THREE.BoxGeometry(0.28, 0.30, 0.04);
    const rl  = new THREE.Mesh(gRL, mRearRed);
    rl.position.set(x, T_Y0 + 0.55, TZ_B - 0.03);
    rl.layers.enable(BLOOM_LAYER);
    trailerGroup.add(rl); disposables.push(gRL);
    const gRA = new THREE.BoxGeometry(0.28, 0.16, 0.04);
    const ra  = new THREE.Mesh(gRA, mRearAmber);
    ra.position.set(x, T_Y0 + 0.18, TZ_B - 0.03);
    ra.layers.enable(BLOOM_LAYER);
    trailerGroup.add(ra); disposables.push(gRA);
  });
  disposables.push(mRearRed, mRearAmber);

  // Chassis rails (full length)
  const RAIL_ZF = CZ_F - 0.04;
  const RAIL_ZB = TZ_B + 0.04;
  const RAIL_LEN = Math.abs(RAIL_ZB - RAIL_ZF);
  const RAIL_CZ  = (RAIL_ZF + RAIL_ZB) / 2;
  [-0.82, 0.82].forEach((x) => {
    addWire(new THREE.BoxGeometry(0.12, 0.15, RAIL_LEN), WARM_W, 0.16, lorryGroup, [x, CHASSIS - 0.12, RAIL_CZ]);
  });

  // Chassis cross-members — 7 horizontal bars spanning between chassis rails
  const XMEM_ZS = [CZ_F - 0.28, -0.04, CZ_B - 0.42, TZC - 3.0, TZC, TZC + 3.0, TZ_B + 1.8];
  XMEM_ZS.forEach((xz) => {
    addLine([
      new THREE.Vector3(-0.82, CHASSIS - 0.10, xz),
      new THREE.Vector3( 0.82, CHASSIS - 0.10, xz),
    ], WARM_W, 0.16, lorryGroup);
  });

  // Air tanks — two horizontal cylinders on chassis rail (driver side)
  [CZ_B - 0.80, CZ_B - 1.70].forEach((atz) => {
    addWire(new THREE.CylinderGeometry(0.16, 0.16, 0.82, 10), WARM_W, 0.22, lorryGroup,
      [0.68, CHASSIS - 0.10, atz], 0, Math.PI / 2);
  });

  // Battery box on chassis rail (passenger side)
  addWire(new THREE.BoxGeometry(0.28, 0.22, 0.50), WARM_W, 0.18, lorryGroup,
    [-0.68, CHASSIS - 0.12, CZ_B - 0.80]);

  // Side skirts — aerodynamic panels along trailer underside
  [-1, 1].forEach((side) => {
    addWire(new THREE.BoxGeometry(0.06, 0.85, TLEN), WARM_W, 0.20, trailerGroup, [side * HW, 0.45, TZC]);
  });

  // Landing legs — fold-down support legs near trailer front
  [-1, 1].forEach((side) => {
    const lx = side * (HW - 0.18);
    const lz = TZ_F + 1.20;
    addLine([
      new THREE.Vector3(lx, T_Y0, lz),
      new THREE.Vector3(lx, 0.02, lz),
    ], WARM_W, 0.28, trailerGroup);
    addLine([
      new THREE.Vector3(lx - 0.10, 0.02, lz),
      new THREE.Vector3(lx + 0.10, 0.02, lz),
    ], WARM_W, 0.22, trailerGroup);
  });

  // ── WHEELS ──────────────────────────────────────────────────────────────────
  const WY = WR;

  // Front steer axle (1.0 unit back from cab front = z=0.60)
  [-1, 1].forEach((side) => {
    addWire(new THREE.CylinderGeometry(WR, WR, WW, 18), WARM_W, 0.32, lorryGroup, [side * (HW + 0.13), WY, CZ_F - 1.0], Math.PI / 2);
  });

  // Drive axles (tandem, 0.5 units behind cab rear)
  [0, 1].forEach((a) => {
    const zPos = CZ_B - 0.50 - a * 0.65;
    [-1, 1].forEach((side) => {
      addWire(new THREE.CylinderGeometry(WR, WR, WW, 18), WARM_W, 0.32, lorryGroup, [side * (HW + 0.24), WY, zPos], Math.PI / 2);
      addWire(new THREE.CylinderGeometry(WR, WR, WW, 18), WARM_W, 0.22, lorryGroup, [side * (HW - 0.02), WY, zPos], Math.PI / 2);
    });
  });

  // Trailer tandem axles
  [3.0, 1.8].forEach((fromRear) => {
    const zPos = TZ_B + fromRear;
    [-1, 1].forEach((side) => {
      addWire(new THREE.CylinderGeometry(WR, WR, WW, 18), WARM_W, 0.32, lorryGroup, [side * (HW + 0.24), WY, zPos], Math.PI / 2);
      addWire(new THREE.CylinderGeometry(WR, WR, WW, 18), WARM_W, 0.22, lorryGroup, [side * (HW - 0.02), WY, zPos], Math.PI / 2);
    });
  });

  // Hub caps — inner accent cylinders concentric with outer wheels
  [-1, 1].forEach((side) => {
    addWire(new THREE.CylinderGeometry(0.20, 0.20, WW + 0.02, 10), ACCENT, 0.28, lorryGroup, [side * (HW + 0.13), WY, CZ_F - 1.0], Math.PI / 2);
  });
  [0, 1].forEach((a) => {
    const zPos = CZ_B - 0.50 - a * 0.65;
    [-1, 1].forEach((side) => {
      addWire(new THREE.CylinderGeometry(0.20, 0.20, WW + 0.02, 10), ACCENT, 0.28, lorryGroup, [side * (HW + 0.24), WY, zPos], Math.PI / 2);
    });
  });
  [3.0, 1.8].forEach((fromRear) => {
    const zPos = TZ_B + fromRear;
    [-1, 1].forEach((side) => {
      addWire(new THREE.CylinderGeometry(0.20, 0.20, WW + 0.02, 10), ACCENT, 0.28, lorryGroup, [side * (HW + 0.24), WY, zPos], Math.PI / 2);
    });
  });

  // Axle bars — horizontal bars connecting L/R wheel pairs
  addLine([new THREE.Vector3(-(HW + 0.13), WY, CZ_F - 1.0), new THREE.Vector3(+(HW + 0.13), WY, CZ_F - 1.0)], WARM_W, 0.20, lorryGroup);
  [0, 1].forEach((a) => {
    const zPos = CZ_B - 0.50 - a * 0.65;
    addLine([new THREE.Vector3(-(HW + 0.24), WY, zPos), new THREE.Vector3(+(HW + 0.24), WY, zPos)], WARM_W, 0.20, lorryGroup);
  });
  [3.0, 1.8].forEach((fromRear) => {
    const zPos = TZ_B + fromRear;
    addLine([new THREE.Vector3(-(HW + 0.24), WY, zPos), new THREE.Vector3(+(HW + 0.24), WY, zPos)], WARM_W, 0.20, lorryGroup);
  });

  // Tyre sidewall rings — inner shoulder ring at 85% wheel radius (r=0.425)
  [-1, 1].forEach((side) => {
    addWire(new THREE.CylinderGeometry(WR * 0.85, WR * 0.85, WW - 0.04, 18), WARM_W, 0.20, lorryGroup, [side * (HW + 0.13), WY, CZ_F - 1.0], Math.PI / 2);
  });
  [0, 1].forEach((a) => {
    const zPos = CZ_B - 0.50 - a * 0.65;
    [-1, 1].forEach((side) => {
      addWire(new THREE.CylinderGeometry(WR * 0.85, WR * 0.85, WW - 0.04, 18), WARM_W, 0.20, lorryGroup, [side * (HW + 0.24), WY, zPos], Math.PI / 2);
      addWire(new THREE.CylinderGeometry(WR * 0.85, WR * 0.85, WW - 0.04, 18), WARM_W, 0.14, lorryGroup, [side * (HW - 0.02), WY, zPos], Math.PI / 2);
    });
  });
  [3.0, 1.8].forEach((fromRear) => {
    const zPos = TZ_B + fromRear;
    [-1, 1].forEach((side) => {
      addWire(new THREE.CylinderGeometry(WR * 0.85, WR * 0.85, WW - 0.04, 18), WARM_W, 0.20, lorryGroup, [side * (HW + 0.24), WY, zPos], Math.PI / 2);
      addWire(new THREE.CylinderGeometry(WR * 0.85, WR * 0.85, WW - 0.04, 18), WARM_W, 0.14, lorryGroup, [side * (HW - 0.02), WY, zPos], Math.PI / 2);
    });
  });

  // Rim edge rings — the steel rim at 70% radius (r=0.35)
  [-1, 1].forEach((side) => {
    addWire(new THREE.CylinderGeometry(WR * 0.70, WR * 0.70, WW * 0.60, 16), WARM_W, 0.28, lorryGroup, [side * (HW + 0.13), WY, CZ_F - 1.0], Math.PI / 2);
  });
  [0, 1].forEach((a) => {
    const zPos = CZ_B - 0.50 - a * 0.65;
    [-1, 1].forEach((side) => {
      addWire(new THREE.CylinderGeometry(WR * 0.70, WR * 0.70, WW * 0.60, 16), WARM_W, 0.28, lorryGroup, [side * (HW + 0.24), WY, zPos], Math.PI / 2);
      addWire(new THREE.CylinderGeometry(WR * 0.70, WR * 0.70, WW * 0.60, 16), WARM_W, 0.18, lorryGroup, [side * (HW - 0.02), WY, zPos], Math.PI / 2);
    });
  });
  [3.0, 1.8].forEach((fromRear) => {
    const zPos = TZ_B + fromRear;
    [-1, 1].forEach((side) => {
      addWire(new THREE.CylinderGeometry(WR * 0.70, WR * 0.70, WW * 0.60, 16), WARM_W, 0.28, lorryGroup, [side * (HW + 0.24), WY, zPos], Math.PI / 2);
      addWire(new THREE.CylinderGeometry(WR * 0.70, WR * 0.70, WW * 0.60, 16), WARM_W, 0.18, lorryGroup, [side * (HW - 0.02), WY, zPos], Math.PI / 2);
    });
  });

  // Mudflaps — behind each axle group
  [-1, 1].forEach((side) => {
    addWire(new THREE.BoxGeometry(0.08, 0.28, 0.14), WARM_W, 0.18, lorryGroup,
      [side * (HW + 0.14), WY + 0.02, CZ_F - 1.0 + WR + 0.10]);
  });
  [0, 1].forEach((a) => {
    const zPos = CZ_B - 0.50 - a * 0.65;
    [-1, 1].forEach((side) => {
      addWire(new THREE.BoxGeometry(0.08, 0.28, 0.14), WARM_W, 0.18, lorryGroup,
        [side * (HW + 0.26), WY + 0.02, zPos + WR + 0.10]);
    });
  });
  [3.0, 1.8].forEach((fromRear) => {
    const zPos = TZ_B + fromRear;
    [-1, 1].forEach((side) => {
      addWire(new THREE.BoxGeometry(0.08, 0.28, 0.14), WARM_W, 0.18, lorryGroup,
        [side * (HW + 0.26), WY + 0.02, zPos + WR + 0.10]);
    });
  });

  // Exhaust stack
  addWire(new THREE.CylinderGeometry(0.06, 0.08, 1.40, 8), ACCENT, 0.34, lorryGroup, [HW - 0.10, 2.10, CZ_B - 0.08]);

  // Windscreen wipers — two blades in parked (crossed) position at windscreen base
  // Windscreen rake: z decreases linearly from CZ_F (bottom) to CZ_R (top)
  const WIPER_Y0 = CAB_Y0 + 0.44;
  const WIPER_Z0 = CZ_F - 0.07;
  const WIPER_Y1 = CAB_Y0 + 1.12;
  const WIPER_Z1 = CZ_F - 0.20;
  addLine([new THREE.Vector3(-0.44, WIPER_Y0, WIPER_Z0), new THREE.Vector3( 0.10, WIPER_Y1, WIPER_Z1)], ACCENT, 0.28, cabGroup);
  addLine([new THREE.Vector3( 0.44, WIPER_Y0, WIPER_Z0), new THREE.Vector3(-0.10, WIPER_Y1, WIPER_Z1)], ACCENT, 0.24, cabGroup);

  // Wheel spokes — 5 per visible outer wheel (Y-Z plane at wheel X position)
  const addWheelSpokesAt = (wx: number, wy: number, wz: number) => {
    for (let s = 0; s < 5; s++) {
      const ang = (s / 5) * Math.PI * 2;
      addLine([
        new THREE.Vector3(wx, wy, wz),
        new THREE.Vector3(wx, wy + Math.sin(ang) * WR * 0.86, wz + Math.cos(ang) * WR * 0.86),
      ], WARM_W, 0.14, lorryGroup);
    }
  };
  [-1, 1].forEach((side) => addWheelSpokesAt(side * (HW + 0.13), WY, CZ_F - 1.0));
  [0, 1].forEach((a) => {
    const zPos = CZ_B - 0.50 - a * 0.65;
    [-1, 1].forEach((side) => {
      addWheelSpokesAt(side * (HW + 0.24), WY, zPos);
      addWheelSpokesAt(side * (HW - 0.02), WY, zPos);
    });
  });
  [3.0, 1.8].forEach((fromRear) => {
    [-1, 1].forEach((side) => {
      addWheelSpokesAt(side * (HW + 0.24), WY, TZ_B + fromRear);
      addWheelSpokesAt(side * (HW - 0.02), WY, TZ_B + fromRear);
    });
  });

  // Articulation gap air lines — catenary-curved pneumatic/electrical cables
  const GAP_ZA = CZ_B - 0.02;
  const GAP_ZB = TZ_F + 0.02;
  const AIR_BASE_Y = T_Y0 + 0.78;
  ([ [-0.28, 0.18], [0.0, 0.24], [0.28, 0.18] ] as [number, number][]).forEach(([ax, dropAmt]) => {
    const airPts: THREE.Vector3[] = [];
    for (let j = 0; j <= 8; j++) {
      const frac = j / 8;
      airPts.push(new THREE.Vector3(ax, AIR_BASE_Y - Math.sin(frac * Math.PI) * dropAmt, GAP_ZA + (GAP_ZB - GAP_ZA) * frac));
    }
    addLine(airPts, TEAL, 0.38, lorryGroup);
  });

  return lorryGroup;
}

// ── Build AI hub node ──────────────────────────────────────────────────────────
function buildAIHub(disposables: (THREE.BufferGeometry | THREE.Material)[]): { hub: THREE.Mesh; glow: THREE.Mesh } {
  const hubGeo  = new THREE.SphereGeometry(0.22, 20, 20);
  const hubMat  = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const hub     = new THREE.Mesh(hubGeo, hubMat);
  hub.layers.enable(BLOOM_LAYER);

  const glowGeo = new THREE.SphereGeometry(0.22 * 3.5, 16, 16);
  const glowMat = new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false });
  const glow    = new THREE.Mesh(glowGeo, glowMat);
  glow.layers.enable(BLOOM_LAYER);

  disposables.push(hubGeo, hubMat, glowGeo, glowMat);
  return { hub, glow };
}

// ── Real truck GLTF loader — renders model as-is with original materials ──
async function loadLorry(
  disposables: (THREE.BufferGeometry | THREE.Material)[],
  lorryRef:    { current: THREE.Group },
  scene:       THREE.Scene,
  lineMats:    LineMaterial[],
  resolution:  THREE.Vector2,
): Promise<void> {
  if (!lorryRef.current) return;

  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync('/models/lorry.glb');

  // Guard: component may have unmounted during the async load
  if (!lorryRef.current) return;

  const outer = new THREE.Group();
  const inner = new THREE.Group();
  outer.add(inner);

  // ── Scale normalization ───────────────────────────────────────────────────
  const rawBbox = new THREE.Box3().setFromObject(gltf.scene);
  const rawSize = rawBbox.getSize(new THREE.Vector3());
  gltf.scene.scale.setScalar(3.8 / rawSize.y);
  gltf.scene.updateMatrixWorld(true);

  // Re-centre: bottom of model at Y=0, centred in XZ
  const scaledBbox = new THREE.Box3().setFromObject(gltf.scene);
  const scCenter = scaledBbox.getCenter(new THREE.Vector3());
  gltf.scene.position.set(-scCenter.x, -scaledBbox.min.y, -scCenter.z);

  // Rotation: model's natural orientation faces the camera
  gltf.scene.rotation.y = 0;
  gltf.scene.updateMatrixWorld(true);

  // Configure all GLTF meshes: shadows, hide interior, seal glass
  gltf.scene.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    obj.castShadow    = true;
    obj.receiveShadow = true;

    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];

    // Hide interior geometry (cabin interior, seats, etc.)
    const hasInsideMat = mats.some((m) => (m.name || '').toLowerCase().includes('inside'));
    if (hasInsideMat || obj.name.toLowerCase().includes('steer')) {
      obj.visible = false;
      return;
    }

    // Make glass fully opaque — prevents seeing through windscreen into cab
    for (const mat of mats) {
      if ((mat.name || '').toLowerCase().includes('glass')) {
        (mat as THREE.MeshStandardMaterial).transparent = false;
        (mat as THREE.MeshStandardMaterial).opacity     = 1.0;
        (mat as THREE.MeshStandardMaterial).color.set(0x1a1a1a);
        (mat as THREE.MeshStandardMaterial).roughness   = 0.1;
        (mat as THREE.MeshStandardMaterial).metalness   = 0.2;
      }
    }
  });

  // ── Depth occluder — stops route lines bleeding through model gaps ─────────
  const finalBbox = new THREE.Box3().setFromObject(gltf.scene);
  const fSize   = finalBbox.getSize(new THREE.Vector3());
  const fCenter = finalBbox.getCenter(new THREE.Vector3());
  const occGeo  = new THREE.BoxGeometry(fSize.x * 0.88, fSize.y, fSize.z * 0.88);
  occGeo.translate(fCenter.x, fCenter.y, fCenter.z);
  const occMat  = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true });
  gltf.scene.add(new THREE.Mesh(occGeo, occMat));
  disposables.push(occGeo, occMat);

  inner.add(gltf.scene);

  // ── Replace placeholder with real geometry ────────────────────────────────
  outer.position.copy(lorryRef.current.position);
  outer.rotation.y = lorryRef.current.rotation.y;
  lorryRef.current.removeFromParent();
  scene.add(outer);
  lorryRef.current = outer;
}

// ── Props ──────────────────────────────────────────────────────────────────────
interface ThreeHeroProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  onPinsUpdate?: (pins: PinState[]) => void;
  scrollProgress?: React.MutableRefObject<number>;
  onReady?: () => void;
}

export function ThreeHero({ containerRef, onPinsUpdate, onReady }: ThreeHeroProps) {
  const mountRef   = useRef<HTMLDivElement>(null);
  const miniMapRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    // ── onReady: call once when model loads, or after 4s fallback ─────────────
    let onReadyCalled = false;
    const callOnReady = () => { if (!onReadyCalled) { onReadyCalled = true; onReady?.(); } };
    const readyFallback = setTimeout(callOnReady, 4000);

    const isMobile = window.innerWidth < 768;
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

    // ── Renderer ──────────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: !isMobile });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.setClearColor(0xECE7E0, 1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
    mountRef.current.appendChild(renderer.domElement);

    // ── Scene ─────────────────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xECE7E0, isMobile ? 0.028 : 0.022);

    const W0 = mountRef.current.clientWidth;
    const H0 = mountRef.current.clientHeight;
    const camera = new THREE.PerspectiveCamera(isMobile ? 62 : 52, W0 / H0, 0.1, 300);
    const lookAtTarget = new THREE.Vector3(2.7, -0.3, 5.6);

    const disposables: (THREE.BufferGeometry | THREE.Material)[] = [];

    // ── Lighting ──────────────────────────────────────────────────────────────
    const keyLight = new THREE.DirectionalLight(0xFFF5E8, 2.2);
    keyLight.position.set(-5, 8, 4);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.left   = -20;
    keyLight.shadow.camera.right  =  20;
    keyLight.shadow.camera.top    =  20;
    keyLight.shadow.camera.bottom = -20;
    keyLight.shadow.camera.near   =  0.5;
    keyLight.shadow.camera.far    =  60;
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xC8DEFF, 0.5);
    fillLight.position.set(6, 2, -2);
    scene.add(fillLight);
    const hemLight = new THREE.HemisphereLight(0xFFFFFF, 0xEEEEEE, 1.0);
    scene.add(hemLight);

    // ── Route curve ───────────────────────────────────────────────────────────
    const route = new THREE.CatmullRomCurve3(ROUTE_CTRL_PTS, false, 'catmullrom', 0.5);
    const ROUTE_SAMPLES = isMobile ? 200 : 400;
    const routeSamples: THREE.Vector3[] = route.getPoints(ROUTE_SAMPLES - 1);

    const stopWorldPositions = ROUTE_STOPS.map((s) => {
      const pt = route.getPointAt(s.t);
      return new THREE.Vector3(pt.x, ROUTE_Y, pt.z);
    });

    // ── Road lines (edge lines + dashes) ──────────────────────────────────────

    // Bold road edge lines (parallel, ±3.50 units — wide enough for lorry at all corners)
    const EDGE_SAMPLES = 250;

    const edgeLeftGeo = new LineGeometry();
    edgeLeftGeo.setPositions(computeParallelRoute(route, 3.50, EDGE_SAMPLES));
    const edgeLeftMat = new LineMaterial({
      color: ACCENT, linewidth: 4.0,
      transparent: true, opacity: 0.80,
      worldUnits: false, resolution: new THREE.Vector2(W0, H0),
    });
    const edgeLeftLine = new Line2(edgeLeftGeo, edgeLeftMat);
    edgeLeftLine.computeLineDistances();
    edgeLeftLine.layers.enable(BLOOM_LAYER);
    scene.add(edgeLeftLine);
    disposables.push(edgeLeftGeo, edgeLeftMat);

    const edgeRightGeo = new LineGeometry();
    edgeRightGeo.setPositions(computeParallelRoute(route, -3.50, EDGE_SAMPLES));
    const edgeRightMat = new LineMaterial({
      color: ACCENT, linewidth: 4.0,
      transparent: true, opacity: 0.80,
      worldUnits: false, resolution: new THREE.Vector2(W0, H0),
    });
    const edgeRightLine = new Line2(edgeRightGeo, edgeRightMat);
    edgeRightLine.computeLineDistances();
    edgeRightLine.layers.enable(BLOOM_LAYER);
    scene.add(edgeRightLine);
    disposables.push(edgeRightGeo, edgeRightMat);

    // Animated centre dashes — white, subtle
    const routeMarkMat = new LineMaterial({
      color: WARM_W, linewidth: 1.5,
      transparent: true, opacity: 0.40,
      dashed: true, dashSize: 0.7, gapSize: 0.9,
      worldUnits: false, resolution: new THREE.Vector2(W0, H0),
    });
    const routeMarkPts: number[] = [];
    routeSamples.forEach((p) => routeMarkPts.push(p.x, ROUTE_Y + 0.03, p.z));
    const routeMarkGeo = new LineGeometry();
    routeMarkGeo.setPositions(routeMarkPts);
    const routeMarkLine = new Line2(routeMarkGeo, routeMarkMat);
    routeMarkLine.computeLineDistances();
    routeMarkLine.layers.enable(BLOOM_LAYER);
    scene.add(routeMarkLine);
    disposables.push(routeMarkMat, routeMarkGeo);

    // Subtle warm path-ahead on road (headlight illumination feel)
    const routeGlowMat = new LineMaterial({
      color: ACCENT, linewidth: 3.5,
      transparent: true, opacity: 0.15,
      dashed: true, dashSize: 1.2, gapSize: 0.0,
      worldUnits: false, resolution: new THREE.Vector2(W0, H0),
    });
    const routeGlowGeo = new LineGeometry();
    const initGlowPts: number[] = [];
    for (let i = 0; i < Math.min(55, ROUTE_SAMPLES); i++) {
      initGlowPts.push(routeSamples[i].x, ROUTE_Y + 0.02, routeSamples[i].z);
    }
    routeGlowGeo.setPositions(initGlowPts);
    const routeGlowLine = new Line2(routeGlowGeo, routeGlowMat);
    routeGlowLine.computeLineDistances();
    scene.add(routeGlowLine);
    disposables.push(routeGlowMat, routeGlowGeo);

    // All Line2 materials for resize handler
    const allLine2Mats: LineMaterial[] = [
      edgeLeftMat, edgeRightMat, routeMarkMat, routeGlowMat,
    ];

    // ── Delivery stop markers ──────────────────────────────────────────────────
    type StopState = {
      visible: boolean; completed: boolean;
      pulseScale: number; pulsing: boolean;
      group: THREE.Group;
      pulseRing: THREE.Mesh; pinHead: THREE.Mesh; pinShaft: THREE.Line;
      pinHeadMat: THREE.MeshBasicMaterial; ringMat: THREE.MeshBasicMaterial;
    };

    const stopStates: StopState[] = ROUTE_STOPS.map((stop, i) => {
      const worldPos = stopWorldPositions[i];
      const group = new THREE.Group();
      group.position.copy(worldPos);
      group.visible = false;
      scene.add(group);

      const shaftPts = [new THREE.Vector3(0, 0.02, 0), new THREE.Vector3(0, 2.8, 0)];
      const shaftGeo = new THREE.BufferGeometry().setFromPoints(shaftPts);
      const shaftMat = new THREE.LineBasicMaterial({ color: stop.hex, transparent: true, opacity: 0.70 });
      const pinShaft = new THREE.Line(shaftGeo, shaftMat);
      group.add(pinShaft);
      disposables.push(shaftGeo, shaftMat);

      const headGeo    = new THREE.SphereGeometry(0.22, 12, 12);
      const pinHeadMat = new THREE.MeshBasicMaterial({ color: stop.hex });
      const pinHead    = new THREE.Mesh(headGeo, pinHeadMat);
      pinHead.position.y = 2.8;
      group.add(pinHead);
      disposables.push(headGeo, pinHeadMat);

      const ringGeo = new THREE.RingGeometry(0.08, 0.55, 24);
      const ringMat = new THREE.MeshBasicMaterial({ color: stop.hex, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
      const pulseRing = new THREE.Mesh(ringGeo, ringMat);
      pulseRing.rotation.x = -Math.PI / 2;
      pulseRing.position.y = 0.02;
      group.add(pulseRing);
      disposables.push(ringGeo, ringMat);

      return { visible: false, completed: false, pulseScale: 0, pulsing: false, group, pulseRing, pinHead, pinShaft, pinHeadMat, ringMat };
    });

    // ── Lorry ─────────────────────────────────────────────────────────────────
    // Placeholder group — holds driver silhouette + aiHub immediately.
    // buildLorry() replaces it with explicit 3D bezier-curve geometry.
    const lorryPlaceholder = new THREE.Group();
    const routeStart = route.getPointAt(0);
    lorryPlaceholder.position.set(routeStart.x, ROUTE_Y, routeStart.z);
    lorryPlaceholder.rotation.y = Math.atan2(route.getTangentAt(0).x, route.getTangentAt(0).z);
    scene.add(lorryPlaceholder);
    const lorryRef: { current: THREE.Group } = { current: lorryPlaceholder };

    const { hub: aiHub, glow: aiGlow } = buildAIHub(disposables);
    aiHub.position.set(0, 3.80, -0.20);
    aiGlow.position.set(0, 3.80, -0.20);
    lorryRef.current.add(aiHub);
    lorryRef.current.add(aiGlow);

    // ── Load real GLTF lorry model ────────────────────────────────────────────
    loadLorry(disposables, lorryRef, scene, allLine2Mats, new THREE.Vector2(W0, H0))
      .then(() => {
        lorryRef.current.add(aiHub);
        lorryRef.current.add(aiGlow);
        clearTimeout(readyFallback);
        callOnReady();
      })
      .catch(() => { callOnReady(); /* model load failed — fire ready anyway */ });

    // ── Road surface: curved strip following the route (snaking ribbon) ──────
    const ROAD_STRIP_N   = isMobile ? 80 : 160;
    const ROAD_HALF_W    = 3.6;   // slightly wider than edge-line offset (3.5)
    const EXT_N    = 14;          // extra straight samples appended at each end
    const EXT_DIST = 45;          // world units — enough to disappear into fog

    const pt0  = route.getPointAt(0);  const tgt0 = route.getTangentAt(0);
    const pt1  = route.getPointAt(1);  const tgt1 = route.getTangentAt(1);

    const stripVerts: number[] = [];
    const stripIndices: number[] = [];

    // near-end extension — reversed so vertices flow from farthest → t=0
    for (let i = EXT_N; i >= 1; i--) {
      const d = (i / EXT_N) * EXT_DIST;
      const ex = pt0.x - tgt0.x * d;  const ez = pt0.z - tgt0.z * d;
      stripVerts.push(ex - tgt0.z * ROAD_HALF_W, ROUTE_Y, ez + tgt0.x * ROAD_HALF_W);
      stripVerts.push(ex + tgt0.z * ROAD_HALF_W, ROUTE_Y, ez - tgt0.x * ROAD_HALF_W);
    }
    // main route
    for (let i = 0; i < ROAD_STRIP_N; i++) {
      const t   = i / (ROAD_STRIP_N - 1);
      const pt  = route.getPointAt(t);
      const tgt = route.getTangentAt(t);
      stripVerts.push(pt.x - tgt.z * ROAD_HALF_W, ROUTE_Y, pt.z + tgt.x * ROAD_HALF_W);
      stripVerts.push(pt.x + tgt.z * ROAD_HALF_W, ROUTE_Y, pt.z - tgt.x * ROAD_HALF_W);
    }
    // far-end extension — continues from t=1 onward
    for (let i = 1; i <= EXT_N; i++) {
      const d = (i / EXT_N) * EXT_DIST;
      const ex = pt1.x + tgt1.x * d;  const ez = pt1.z + tgt1.z * d;
      stripVerts.push(ex - tgt1.z * ROAD_HALF_W, ROUTE_Y, ez + tgt1.x * ROAD_HALF_W);
      stripVerts.push(ex + tgt1.z * ROAD_HALF_W, ROUTE_Y, ez - tgt1.x * ROAD_HALF_W);
    }
    const totalStripSamples = EXT_N + ROAD_STRIP_N + EXT_N;
    for (let i = 0; i < totalStripSamples - 1; i++) {
      const b = i * 2;
      stripIndices.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
    }
    const roadStripGeo = new THREE.BufferGeometry();
    roadStripGeo.setAttribute('position', new THREE.Float32BufferAttribute(stripVerts, 3));
    roadStripGeo.setIndex(stripIndices);
    roadStripGeo.computeVertexNormals();
    const roadStripMat = new THREE.MeshStandardMaterial({
      color: 0x1A1410, roughness: 0.92, metalness: 0.0, transparent: true, opacity: 0.82,
    });
    const roadStrip = new THREE.Mesh(roadStripGeo, roadStripMat);
    roadStrip.receiveShadow = true;
    scene.add(roadStrip);
    disposables.push(roadStripGeo, roadStripMat);

    // ── Roadside landscape: trees + pylons + cables ───────────────────────────
    // Placed in world space so they move with the scene as camera follows lorry.
    // Color is dark warm brown at low opacity; FogExp2 fades distant objects
    // toward cream, giving the "barely perceptible at the periphery" mood.
    const envMat = new THREE.MeshBasicMaterial({
      color: 0x483E32, transparent: true, opacity: 0.28, depthWrite: false,
    });
    disposables.push(envMat);

    const addTree = (tx: number, tz: number, h: number) => {
      const grp = new THREE.Group();
      grp.position.set(tx, ROUTE_Y, tz);
      // trunk
      const trunkGeo = new THREE.CylinderGeometry(h * 0.03, h * 0.06, h * 0.32, 5);
      const trunk = new THREE.Mesh(trunkGeo, envMat);
      trunk.position.y = h * 0.16;
      grp.add(trunk);
      disposables.push(trunkGeo);
      // canopy — three overlapping spheres scaled into ellipsoids
      const r = h * 0.36;
      const canopyY = h * 0.32 + r;
      const offsets: [number, number, number, number][] = [
        [ 0,     0,   1.00, 1.20],
        [-0.35,  0.2, 0.65, 0.75],
        [ 0.35,  0.2, 0.65, 0.75],
      ];
      offsets.forEach(([dx, dy, sx, sy]) => {
        const sGeo = new THREE.SphereGeometry(r, 6, 5);
        const s = new THREE.Mesh(sGeo, envMat);
        s.position.set(dx * r, canopyY + dy * r, 0);
        s.scale.set(sx, sy, 1.0);
        grp.add(s);
        disposables.push(sGeo);
      });
      scene.add(grp);
    };

    const addPylon = (px: number, pz: number, h: number): number => {
      const grp = new THREE.Group();
      grp.position.set(px, ROUTE_Y, pz);
      // tapered body
      const bodyGeo = new THREE.CylinderGeometry(h * 0.02, h * 0.09, h, 4);
      const body = new THREE.Mesh(bodyGeo, envMat);
      body.position.y = h * 0.5;
      grp.add(body);
      disposables.push(bodyGeo);
      // upper crossarm
      const arm1Geo = new THREE.BoxGeometry(h * 0.55, h * 0.025, h * 0.025);
      const arm1 = new THREE.Mesh(arm1Geo, envMat);
      arm1.position.y = h * 0.82;
      grp.add(arm1);
      disposables.push(arm1Geo);
      // lower crossarm
      const arm2Geo = new THREE.BoxGeometry(h * 0.44, h * 0.025, h * 0.025);
      const arm2 = new THREE.Mesh(arm2Geo, envMat);
      arm2.position.y = h * 0.70;
      grp.add(arm2);
      disposables.push(arm2Geo);
      scene.add(grp);
      return ROUTE_Y + h;
    };

    const addCable = (x1: number, z1: number, y1: number, x2: number, z2: number, y2: number) => {
      const dist = Math.sqrt((x2 - x1) * (x2 - x1) + (z2 - z1) * (z2 - z1));
      const sagY = Math.min(y1, y2) - dist * 0.07;
      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(x1, y1, z1),
        new THREE.Vector3((x1 + x2) / 2, sagY, (z1 + z2) / 2),
        new THREE.Vector3(x2, y2, z2),
      );
      const tubeGeo = new THREE.TubeGeometry(curve, 20, 0.04, 3, false);
      scene.add(new THREE.Mesh(tubeGeo, envMat));
      disposables.push(tubeGeo);
    };

    // LEFT side — trees and pylons spread along route Z range
    addTree(-13, 16, 4.5); addTree(-17, 10, 3.8); addTree(-12,  4, 5.2);
    addTree(-16, -2, 3.5); addTree(-14, -8, 4.8); addTree(-11,-14, 3.9);
    addTree(-15,-20, 4.3); addTree(-13,-26, 3.6); addTree(-16,-32, 5.0);
    addTree(-12,-38, 3.7); addTree(-14,-44, 4.6); addTree(-11,-50, 3.4);
    const lp1top = addPylon(-14, -10, 9.0);
    const lp2top = addPylon(-13, -34, 9.5);
    addCable(-14, -10, lp1top, -13, -34, lp2top);

    // RIGHT side
    addTree( 14, 18, 4.0); addTree( 11, 12, 4.8); addTree( 15,  6, 3.6);
    addTree( 12,  0, 5.1); addTree( 16, -6, 3.8); addTree( 13,-12, 4.5);
    addTree( 11,-18, 3.5); addTree( 15,-24, 4.9); addTree( 12,-30, 3.7);
    addTree( 14,-36, 4.4); addTree( 11,-42, 5.2); addTree( 15,-48, 3.3);
    const rp1top = addPylon( 14, -13, 9.2);
    const rp2top = addPylon( 12, -37, 9.8);
    addCable( 14, -13, rp1top,  12, -37, rp2top);

    // ── Blob shadow under lorry ───────────────────────────────────────────────
    const blobCanvas = document.createElement('canvas');
    blobCanvas.width  = 128;
    blobCanvas.height = 128;
    const blobCtx = blobCanvas.getContext('2d')!;
    const blobGrad = blobCtx.createRadialGradient(64, 64, 0, 64, 64, 62);
    blobGrad.addColorStop(0,   'rgba(60,40,25, 0.38)');
    blobGrad.addColorStop(0.5, 'rgba(60,40,25, 0.18)');
    blobGrad.addColorStop(1,   'rgba(60,40,25, 0)');
    blobCtx.fillStyle = blobGrad;
    blobCtx.fillRect(0, 0, 128, 128);
    const blobTex  = new THREE.CanvasTexture(blobCanvas);
    const blobGeoM = new THREE.PlaneGeometry(14, 8);
    const blobMat  = new THREE.MeshBasicMaterial({
      map: blobTex, transparent: true, depthWrite: false, opacity: 1.0,
    });
    const blobMesh = new THREE.Mesh(blobGeoM, blobMat);
    blobMesh.rotation.x = -Math.PI / 2;
    blobMesh.position.y  = ROUTE_Y + 0.015;
    scene.add(blobMesh);
    disposables.push(blobGeoM, blobMat);

    // ── Ambient particles ─────────────────────────────────────────────────────
    const AMB_COUNT = isMobile ? 35 : 85;
    const ambPos = new Float32Array(AMB_COUNT * 3);
    const ambVel = new Float32Array(AMB_COUNT * 3);
    for (let i = 0; i < AMB_COUNT; i++) {
      ambPos[i*3]   = (Math.random() - 0.5) * 30;
      ambPos[i*3+1] = Math.random() * 9 + ROUTE_Y;
      ambPos[i*3+2] = Math.random() * 90 - 65;
      ambVel[i*3]   = (Math.random() - 0.5) * 0.003;
      ambVel[i*3+1] = (Math.random() - 0.5) * 0.002;
      ambVel[i*3+2] = (Math.random() - 0.5) * 0.003;
    }
    const ambGeo = new THREE.BufferGeometry();
    ambGeo.setAttribute('position', new THREE.BufferAttribute(ambPos, 3));
    const ambMat = new THREE.PointsMaterial({ size: 0.07, color: 0x3A3530, transparent: true, opacity: 0.12, blending: THREE.NormalBlending, depthWrite: false, sizeAttenuation: true });
    scene.add(new THREE.Points(ambGeo, ambMat));
    disposables.push(ambGeo, ambMat);

    // ── Selective bloom ────────────────────────────────────────────────────────
    let bloomComposer: EffectComposer | null = null;
    let finalComposer: EffectComposer | null = null;
    let bloomPass: UnrealBloomPass | null = null;
    const darkMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const matCache: Record<string, THREE.Material | THREE.Material[]> = {};

    if (!isSafari && !isMobile) {
      bloomPass = new UnrealBloomPass(new THREE.Vector2(W0, H0), 0.8, 0.6, 0.85);
      bloomComposer = new EffectComposer(renderer,
        new THREE.WebGLRenderTarget(W0, H0, { type: THREE.HalfFloatType }));
      bloomComposer.renderToScreen = false;
      bloomComposer.addPass(new RenderPass(scene, camera));
      bloomComposer.addPass(bloomPass);

      const mixPass = new ShaderPass(new THREE.ShaderMaterial({
        uniforms: { baseTexture: { value: null }, bloomTexture: { value: bloomComposer.renderTarget2.texture } },
        vertexShader:   MixBloomShader.vertexShader,
        fragmentShader: MixBloomShader.fragmentShader,
        defines: {},
      }), 'baseTexture');
      mixPass.needsSwap = true;

      finalComposer = new EffectComposer(renderer);
      finalComposer.addPass(new RenderPass(scene, camera));
      finalComposer.addPass(mixPass);
      finalComposer.addPass(new OutputPass());
    }

    function restoreMaterials() {
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh && matCache[obj.uuid]) {
          obj.material = matCache[obj.uuid] as THREE.Material;
          delete matCache[obj.uuid];
        }
      });
    }
    function darkenNonBloomed() {
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh && !obj.layers.isEnabled(BLOOM_LAYER)) {
          matCache[obj.uuid] = obj.material;
          obj.material = darkMaterial;
        }
      });
    }

    // ── FIX 2: Camera state — Act 0 is FACE-ON (camera in front of lorry) ─────
    // At lorryT=0, lorryPt=(3.5,-2.5,7.0), lorry faces direction≈(-0.5,0,-0.87).
    // Camera is placed IN FRONT of lorry (in direction lorry faces, i.e. at lower z).
    // cam.z = -7.0 → camera at world z = 7.0 + (-7.0) = 0, which is ahead of lorry.
    // cam.lz = -1.4 → look-at z = 7.0 + (-1.4) = 5.6 = lorry's front face.
    const cam = {
      x: -2.0, y: 5.5, z: -11.0,      // face-on: raised above lorry roof to avoid Act 0→1 clip
      lx: -0.6, ly: 2.0, lz: -3.5,    // look at front face / grille height (adjusted for elevated start)
      fov: isMobile ? 62 : 52,
      bloom: 0.3,
      morph: 0,
      bgT: 1,               // always light scene
      fogDensity: isMobile ? 0.028 : 0.022,
      lorryT: 0,
      miniMapOpacity: 0,
    };

    // Initialise camera at Act 0 position
    const initLorryPt = route.getPointAt(0);
    camera.position.set(initLorryPt.x + cam.x, ROUTE_Y + cam.y, initLorryPt.z + cam.z);
    lookAtTarget.set(initLorryPt.x + cam.lx, ROUTE_Y + cam.ly, initLorryPt.z + cam.lz);
    camera.lookAt(lookAtTarget);
    camera.updateProjectionMatrix();

    let gsapCtx: gsap.Context | null = null;
    if (containerRef.current) {
      gsapCtx = gsap.context(() => {
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: containerRef.current,
            start: 'top top',
            end: 'bottom bottom',
            scrub: 4,
            // Snap to the boundary of each act so the user always pauses
            // long enough to read the content before moving on.
            snap: {
              snapTo: [0, 0.16, 0.33, 0.50, 0.68, 0.85, 1.0],
              duration: { min: 0.5, max: 1.2 },
              delay: 0.1,
              ease: 'power2.inOut',
              inertia: false,
              directional: true,
            },
          },
        });

        // Act 0→1 (0–16%): dramatic 180° orbit from face-on → 3/4 following shot
        tl.to(cam, { lorryT: 0.08, x: 4.0, y: 6.0, z: 9.0, lx: 0, ly: 2.0, lz: -3.0, fov: 62, bloom: 0.3, duration: 0.16 }, 0);

        // Act 1→2 (16–33%): following shot, mini-map appears, first stops reveal
        tl.to(cam, { lorryT: 0.25, x: 3.5, y: 5.0, z: 9.0, lx: 0, ly: 1.5, lz: -2.0, fov: 61, bloom: 0.3, morph: 0.25, miniMapOpacity: 1, duration: 0.17 }, 0.16);

        // Act 2→3 (33–50%): activation close-up
        tl.to(cam, { lorryT: 0.44, x: 2.0, y: 3.5, z: 3.0, lx: 0, ly: 2.5, lz: 0.0, fov: 50, bloom: 0.3, morph: 0.95, duration: 0.17 }, 0.33);

        // Act 3→4 (50–68%): side tracking shot
        tl.to(cam, { lorryT: 0.63, x: -9.0, y: 4.0, z: -1.0, lx: 2.5, ly: 1.5, lz: -3.0, fov: 60, bloom: 0.2, morph: 1.0, duration: 0.18 }, 0.50);

        // Act 4→5 (68–85%): pull-back
        tl.to(cam, { lorryT: 0.83, x: 5.0, y: 9.0, z: 10.0, lx: 0, ly: 1.0, lz: -2.0, fov: 67, bloom: 0.1, duration: 0.17 }, 0.68);

        // Act 5 (85–100%): god's eye
        tl.to(cam, { lorryT: 1.0, x: 1.0, y: 24.0, z: 14.0, lx: 1.0, ly: 0.0, lz: 14.0, fov: 60, bloom: 0.0, fogDensity: 0.012, duration: 0.15 }, 0.85);
      });
    }

    // ── Mouse parallax ────────────────────────────────────────────────────────
    const mouse = { x: 0, y: 0 };
    const onMouseMove = (e: MouseEvent) => {
      mouse.x = (e.clientX / window.innerWidth  - 0.5) * 2;
      mouse.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('mousemove', onMouseMove);

    // ── Mini-map ──────────────────────────────────────────────────────────────
    const MM_W = 130, MM_H = 90;
    const MM_X_MIN = -8.0, MM_X_MAX = 9.0, MM_Z_MIN = -63.0, MM_Z_MAX = 24.0;
    function worldToMM(wx: number, wz: number): [number, number] {
      return [
        (wx - MM_X_MIN) / (MM_X_MAX - MM_X_MIN) * MM_W,
        (1 - (wz - MM_Z_MIN) / (MM_Z_MAX - MM_Z_MIN)) * MM_H,
      ];
    }
    function drawMiniMap() {
      const canvas = miniMapRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, MM_W, MM_H);

      ctx.beginPath(); ctx.strokeStyle = 'rgba(232,97,45,0.40)'; ctx.lineWidth = 1.5;
      routeSamples.forEach((pt, i) => { const [mx, my] = worldToMM(pt.x, pt.z); i === 0 ? ctx.moveTo(mx, my) : ctx.lineTo(mx, my); });
      ctx.stroke();

      const lorryIdx = Math.floor(clamp01(cam.lorryT) * (ROUTE_SAMPLES - 1));
      ctx.beginPath(); ctx.strokeStyle = 'rgba(232,97,45,0.85)'; ctx.lineWidth = 2;
      for (let i = 0; i <= lorryIdx; i++) { const [mx, my] = worldToMM(routeSamples[i].x, routeSamples[i].z); i === 0 ? ctx.moveTo(mx, my) : ctx.lineTo(mx, my); }
      ctx.stroke();

      ROUTE_STOPS.forEach((stop, i) => {
        if (!stopStates[i].visible) return;
        const [mx, my] = worldToMM(stopWorldPositions[i].x, stopWorldPositions[i].z);
        ctx.beginPath(); ctx.arc(mx, my, 2.8, 0, Math.PI * 2);
        ctx.fillStyle = stopStates[i].completed ? '#059669' : stop.color;
        ctx.fill();
      });

      const lp = route.getPointAt(clamp01(cam.lorryT));
      const [lx, ly] = worldToMM(lp.x, lp.z);
      ctx.beginPath(); ctx.arc(lx, ly, 4, 0, Math.PI * 2); ctx.fillStyle = '#E8612D'; ctx.fill();
      ctx.beginPath(); ctx.arc(lx, ly, 4, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(245,242,239,0.5)'; ctx.lineWidth = 1; ctx.stroke();
    }

    // ── Resize ────────────────────────────────────────────────────────────────
    function onResize() {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      bloomComposer?.setSize(w, h);
      finalComposer?.setSize(w, h);
      if (bloomPass) bloomPass.resolution.set(w, h);
      allLine2Mats.forEach((m) => m.resolution.set(w, h));
    }
    window.addEventListener('resize', onResize);

    // ── Pin projection ────────────────────────────────────────────────────────
    function updatePins() {
      if (!onPinsUpdate) return;
      const rect = renderer.domElement.getBoundingClientRect();
      const v = new THREE.Vector3();
      const pins: PinState[] = ROUTE_STOPS.map((stop, i) => {
        v.set(stopWorldPositions[i].x, ROUTE_Y + 2.0, stopWorldPositions[i].z);
        v.project(camera);
        return {
          id: stop.id,
          x: (v.x * 0.5 + 0.5) * rect.width + rect.left,
          y: (v.y * -0.5 + 0.5) * rect.height + rect.top,
          visible: stopStates[i].completed && v.z < 1.0 && cam.lorryT > stop.t + 0.08,
        };
      });
      onPinsUpdate(pins);
    }

    // ── Pre-allocated colours for background transition ────────────────────────
    const bgDark       = new THREE.Color(0xECE7E0);   // always light — dark end = same light colour
    const bgLight      = new THREE.Color(0xECE7E0);   // warm medium grey
    const bgCurrent    = new THREE.Color(0xECE7E0);
    const hemSkyDark   = new THREE.Color(0x334466);
    const hemSkyLight  = new THREE.Color(0xFFFFFF);
    const hemGndDark   = new THREE.Color(0x0B1120);
    const hemGndLight  = new THREE.Color(0xEEEEEE);
    const ambColDark   = new THREE.Color(0xF5F2EF);
    const ambColLight  = new THREE.Color(0x222222);

    // ── RAF loop ──────────────────────────────────────────────────────────────
    let rafId: number;
    let t = 0;

    function animate() {
      rafId = requestAnimationFrame(animate);
      t += 0.008;

      // Lorry position + orientation — scroll-driven via cam.lorryT
      const lorryT  = clamp01(cam.lorryT);
      const lorryPt = route.getPointAt(lorryT);
      const bounceY = Math.sin(t * Math.PI * 0.9) * 0.018;
      lorryRef.current.position.set(lorryPt.x, ROUTE_Y + bounceY, lorryPt.z);
      const tgt = route.getTangentAt(lorryT);
      tgt.y = 0; tgt.normalize();
      lorryRef.current.rotation.y = Math.atan2(tgt.x, tgt.z);

      // Blob shadow follows lorry
      blobMesh.position.x = lorryPt.x;
      blobMesh.position.z = lorryPt.z;
      blobMesh.rotation.z = -Math.atan2(tgt.x, tgt.z);

      // Camera — scroll-driven 6-act system
      const godEyeBlend = clamp01((lorryT - 0.83) / 0.17);
      const mouseScale  = 1 - godEyeBlend * 0.9;
      camera.position.x += (lorryPt.x + cam.x + mouse.x * 0.5 * mouseScale - camera.position.x) * 0.04;
      camera.position.y += (ROUTE_Y + cam.y - mouse.y * 0.35 * mouseScale   - camera.position.y) * 0.04;
      camera.position.z += (lorryPt.z + cam.z                               - camera.position.z) * 0.05;
      lookAtTarget.lerp(new THREE.Vector3(lorryPt.x + cam.lx, ROUTE_Y + cam.ly, lorryPt.z + cam.lz), 0.05);
      camera.lookAt(lookAtTarget);
      camera.fov += (cam.fov - camera.fov) * 0.04;
      camera.updateProjectionMatrix();

      // Fog density + bloom
      (scene.fog as THREE.FogExp2).density += (cam.fogDensity - (scene.fog as THREE.FogExp2).density) * 0.03;
      if (bloomPass) bloomPass.strength += (cam.bloom - bloomPass.strength) * 0.06;

      // ── Dark → light background transition ────────────────────────────────
      bgCurrent.copy(bgDark).lerp(bgLight, cam.bgT);
      renderer.setClearColor(bgCurrent, 1);
      (scene.fog as THREE.FogExp2).color.copy(bgCurrent);
      hemLight.color.copy(hemSkyDark).lerp(hemSkyLight, cam.bgT);
      hemLight.groundColor.copy(hemGndDark).lerp(hemGndLight, cam.bgT);

      // Route glow segment update (with noise in early acts)
      const lorryIdx  = Math.floor(lorryT * (ROUTE_SAMPLES - 1));
      const glowStart = Math.max(0, lorryIdx - 4);
      const glowEnd   = Math.min(ROUTE_SAMPLES - 1, lorryIdx + 55);
      const noiseAmt  = (1 - clamp01(cam.morph / 0.85)) * 0.22;
      const glowPts: number[] = [];
      for (let i = glowStart; i <= glowEnd; i++) {
        const pt = routeSamples[i];
        let nx = 0, nz = 0;
        if (noiseAmt > 0.01 && i > lorryIdx + 2) {
          const fadeAmt = Math.min(1, (i - lorryIdx) / 20);
          nx = Math.sin(i * 2.3 + t * 2.8) * noiseAmt * fadeAmt;
          nz = Math.cos(i * 1.9 + t * 3.1) * noiseAmt * 0.5 * fadeAmt;
        }
        glowPts.push(pt.x + nx, ROUTE_Y + 0.02, pt.z + nz);
      }
      if (glowPts.length >= 6) {
        routeGlowGeo.setPositions(glowPts);
        routeGlowLine.computeLineDistances();
      }

      // Animate centre dashes
      routeMarkMat.dashOffset -= 0.009;
      routeMarkMat.opacity = 0.40;

      // ── Road edge lines: always vivid ──────────────────────────────────────
      edgeLeftMat.opacity  = 0.80;
      edgeRightMat.opacity = 0.80;


      // ── Stop markers ──────────────────────────────────────────────────────
      const isEarlyActs = cam.morph < 0.55;
      ROUTE_STOPS.forEach((stop, i) => {
        const state = stopStates[i];
        const dist  = cam.lorryT - stop.t;

        // FIX 3: reveal stops when lorry is within 20% of route ahead of them
        if (!state.visible && dist > -0.20) { state.visible = true; }
        state.group.visible = state.visible;

        if (!state.completed && dist > 0.05) {
          state.completed = true;
          state.pinHeadMat.color.setHex(isEarlyActs ? ROUTE_STOPS[i].hex : GREEN_D);
        }

        if (!state.completed && Math.abs(dist) < 0.04 && dist > -0.04) state.pulsing = true;

        if (state.pulsing) {
          state.pulseScale += 0.055;
          if (state.pulseScale > 1) { state.pulseScale = 0; if (state.completed) state.pulsing = false; }
          const ringColor = (!state.completed && isEarlyActs) ? 0xEF4444 : (state.completed ? GREEN_D : stop.hex);
          state.ringMat.color.setHex(ringColor);
          state.ringMat.opacity = (1 - state.pulseScale) * 0.85;
          state.pulseRing.scale.set(1 + state.pulseScale * 4, 1 + state.pulseScale * 4, 1);
        } else {
          state.ringMat.opacity *= 0.88;
        }

        const hubMat = aiGlow.material as THREE.MeshBasicMaterial;
        hubMat.opacity = clamp01(cam.morph - 0.2) * 0.12 + Math.sin(t * 2.0) * 0.03 * cam.morph;
      });

      // ── Ambient particles ─────────────────────────────────────────────────
      const ambPosArr = ambGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < AMB_COUNT; i++) {
        ambPosArr[i*3]   += ambVel[i*3];
        ambPosArr[i*3+1] += ambVel[i*3+1];
        ambPosArr[i*3+2] += ambVel[i*3+2];
        if (ambPosArr[i*3]   > 15)  ambPosArr[i*3]   -= 30;
        if (ambPosArr[i*3]   < -15) ambPosArr[i*3]   += 30;
        if (ambPosArr[i*3+1] > ROUTE_Y + 9) ambPosArr[i*3+1] = ROUTE_Y;
        if (ambPosArr[i*3+2] < -68) ambPosArr[i*3+2] += 90;
      }
      ambGeo.attributes.position.needsUpdate = true;

      // ── Mini-map ──────────────────────────────────────────────────────────
      if (miniMapRef.current) {
        let mmOpacity = cam.miniMapOpacity;
        if (godEyeBlend > 0.5) mmOpacity *= (1 - (godEyeBlend - 0.5) * 2);
        miniMapRef.current.style.opacity = String(mmOpacity);
        if (mmOpacity > 0.05) drawMiniMap();
      }

      if (Math.floor(t * 125) % 2 === 0) updatePins();

      // ── Render ────────────────────────────────────────────────────────────
      if (bloomComposer && finalComposer) {
        darkenNonBloomed();
        bloomComposer.render();
        restoreMaterials();
        finalComposer.render();
      } else {
        renderer.render(scene, camera);
      }
    }

    animate();

    // ── Cleanup ───────────────────────────────────────────────────────────────
    function cleanup() {
      clearTimeout(readyFallback);
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mousemove', onMouseMove);
      gsapCtx?.revert();
      disposables.forEach((d) => d.dispose());
      darkMaterial.dispose();
      bloomComposer?.dispose();
      finalComposer?.dispose();
      renderer.dispose();
      if (mountRef.current?.contains(renderer.domElement)) {
        mountRef.current.removeChild(renderer.domElement);
      }
    }

    return cleanup;
  }, [containerRef, onPinsUpdate, onReady]);

  return (
    <>
      <div
        ref={mountRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', touchAction: 'pan-y' }}
      />
      {/* Horizon mist — covers sky and fades at horizon, well above lorry */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '55%',
          background: 'linear-gradient(to bottom, #ece7e0 0%, #ece7e0 30%, rgba(236,231,224,0) 100%)',
          pointerEvents: 'none',
          zIndex: 5,
        }}
      />
      {/* Subtle orange road glow in lower third */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '38%',
          background: 'radial-gradient(ellipse 70% 60% at 50% 100%, rgba(232,87,42,0.06) 0%, transparent 100%)',
          pointerEvents: 'none',
          zIndex: 4,
        }}
      />
      <canvas
        ref={miniMapRef}
        width={130}
        height={90}
        style={{
          position: 'absolute',
          bottom: 160,
          right: 24,
          zIndex: 15,
          borderRadius: 8,
          border: '1px solid rgba(245,242,239,0.1)',
          background: 'rgba(15,20,25,0.6)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          opacity: 0,
          pointerEvents: 'none',
          transition: 'opacity 0.3s ease',
        }}
      />
    </>
  );
}
