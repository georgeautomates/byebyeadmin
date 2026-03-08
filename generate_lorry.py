#!/usr/bin/env python3
"""
generate_lorry.py — Blender headless script: European cab-over HGV for ByeByeAdmin.

Run:  blender --background --python generate_lorry.py

Coordinate system (Blender native, Z-up):
  X  = vehicle width  (left –X, right +X)
  Y  = vehicle depth  (rear –Y, front +Y)
  Z  = vehicle height (ground 0, chassis 1.10)

After GLTF export with +Y Up mode:
  Blender Y → Three.js  –Z
  Blender Z → Three.js   Y
  (Front of lorry, Blender +Y, appears at Three.js –Z)

In loadLorry() callback add:  loaded.rotation.y = Math.PI
so the lorry's front faces the Three.js +Z route direction.
"""

import bpy
import bmesh
import math
from mathutils import Matrix

OUTPUT = '/Users/george/byebyeadmin/public/models/lorry.glb'

# ── Proportions (match ThreeHero.tsx units) ───────────────────────────────────
HW   = 1.25    # half-width
CH   = 1.10    # chassis top / cab floor                   (Blender Z)
Y1   = 3.80    # cab roof                                  (Blender Z)
YF   = 1.90    # cab front face (was 1.60 — deeper cab)    (Blender Y, +forward)
YS   = 0.90    # windscreen top Y (setback 1.00 from YF)   (Blender Y)
ZS   = 2.20    # windscreen base height (was 2.50)          (Blender Z)
WS_HW = 1.00   # windscreen top half-width (was HW=1.25) — trapezoid A-pillars
YB   = -1.60   # cab rear                                  (Blender Y)
WR   = 0.50    # wheel radius
WW   = 0.36    # wheel width (cylinder length)

# Trailer
TYF  = -1.90   # trailer front Y
TYB  = -14.40  # trailer rear Y
TZ0  = 1.20    # trailer floor Z
TZ1  = 4.00    # trailer roof  Z
TH   = TZ1 - TZ0
TLEN = abs(TYB - TYF)


# ── Scene helpers ──────────────────────────────────────────────────────────────
def clear():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    for m in list(bpy.data.meshes):
        bpy.data.meshes.remove(m)


def link_bm(name: str, bm: bmesh.types.BMesh) -> bpy.types.Object:
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def simple_box(name: str, cx: float, cy: float, cz: float,
               w: float, d: float, h: float) -> bpy.types.Object:
    """Axis-aligned box: w=X, d=Y (depth/forward), h=Z (height)."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x = v.co.x * w + cx
        v.co.y = v.co.y * d + cy
        v.co.z = v.co.z * h + cz
    return link_bm(name, bm)


def simple_cylinder(name: str, cx: float, cy: float, cz: float,
                    r: float, depth: float, segs: int = 20,
                    axis: str = 'Z') -> bpy.types.Object:
    """Cylinder whose long axis is 'X', 'Y', or 'Z'."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False,
                          segments=segs, radius1=r, radius2=r, depth=depth)
    if axis == 'X':
        mat = Matrix.Rotation(math.pi / 2, 3, 'Y')
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=mat)
    elif axis == 'Y':
        mat = Matrix.Rotation(math.pi / 2, 3, 'X')
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=mat)
    for v in bm.verts:
        v.co.x += cx
        v.co.y += cy
        v.co.z += cz
    return link_bm(name, bm)


def join_to(base: bpy.types.Object, others: list) -> bpy.types.Object:
    """Join all objects in 'others' into 'base'. Returns the merged object."""
    bpy.ops.object.select_all(action='DESELECT')
    base.select_set(True)
    for o in others:
        o.select_set(True)
    bpy.context.view_layer.objects.active = base
    bpy.ops.object.join()
    return bpy.context.view_layer.objects.active


# ── CAB ───────────────────────────────────────────────────────────────────────
def create_cab() -> bpy.types.Object:
    """
    European cab-over HGV cab with correct 37° windscreen rake.
    Headlight_L/R and Marker_0..4 are separate scene objects
    (not joined into Cab_Details) for special bloom treatment in ThreeHero.
    Cab_Shell_Roofbar has Cab_Shell_* prefix → ACCENT Tier 1 in ThreeHero.

    Silhouette vertices:
      Floor ring:        Z = CH,  Y = YB..YF
      Grille top:        Z = ZS,  Y = YF   (windscreen base)
      Windscreen top:    Z = Y1,  Y = YS   (setback 1.0 unit from grille)
      Roof rear:         Z = Y1,  Y = YB
    """
    bm = bmesh.new()

    v00 = bm.verts.new((-HW, YB, CH))   # rear-left-bottom
    v01 = bm.verts.new(( HW, YB, CH))
    v02 = bm.verts.new(( HW, YF, CH))
    v03 = bm.verts.new((-HW, YF, CH))
    v04 = bm.verts.new((-HW, YF, ZS))
    v05 = bm.verts.new(( HW, YF, ZS))
    v06 = bm.verts.new((-WS_HW, YS, Y1))   # narrower at top → trapezoid windscreen
    v07 = bm.verts.new(( WS_HW, YS, Y1))
    v08 = bm.verts.new(( HW, YB, Y1))
    v09 = bm.verts.new((-HW, YB, Y1))
    bm.verts.ensure_lookup_table()

    bm.faces.new([v00, v01, v02, v03])          # floor
    bm.faces.new([v03, v00, v09, v06, v04])     # left side pentagon
    bm.faces.new([v02, v05, v07, v08, v01])     # right side pentagon
    bm.faces.new([v00, v01, v08, v09])          # rear face
    bm.faces.new([v03, v04, v05, v02])          # front grille (flat, Y=YF)
    bm.faces.new([v04, v06, v07, v05])          # windscreen (RAKED)
    bm.faces.new([v06, v09, v08, v07])          # roof

    bm.normal_update()
    link_bm('Cab_Shell', bm)

    # ── Separate top-level objects (NOT joined into Cab_Details) ──────────────
    # Roofbar: Cab_Shell_* prefix → ACCENT + Tier 1 in ThreeHero
    simple_box('Cab_Shell_Roofbar', 0, YS - 0.05, Y1 + 0.13,
               HW * 2 + 0.26, 0.24, 0.10)

    # Headlights: 'Headlight_*' → Tier 0 massive white bloom in ThreeHero
    # Z=1.38 centres them in the lower grille area (above chassis floor CH=1.10)
    for side, sx in [('L', -0.78), ('R', 0.78)]:
        simple_box(f'Headlight_{side}', sx, YF + 0.04, 1.38, 0.46, 0.12, 0.34)

    # Roof marker lights: 'Marker_*' → amber bloom in ThreeHero
    # Spread across cab WIDTH (X axis) on the roofbar — not depth-spread (Y axis)
    for i in range(5):
        mx = -HW + (HW * 2) * (i + 0.5) / 5   # = -1.00, -0.50, 0.00, +0.50, +1.00
        simple_box(f'Marker_{i}', mx, YS - 0.03, Y1 + 0.19, 0.10, 0.10, 0.08)

    # ── Bumper: Cab_Shell_* → ACCENT orange Tier 1 (coreW=3.0, haloW=24) ───────
    # Spans ground (Z=0) to chassis floor (Z=CH). Bold, heavy structural element.
    simple_box('Cab_Shell_Bumper', 0, YF + 0.16, CH / 2,
               HW * 2 + 0.10, 0.22, CH)
    for sx, suf in [(-1, 'L'), (1, 'R')]:
        simple_box(f'Cab_Shell_BumperCorner{suf}',
                   sx * (HW + 0.05), YF - 0.05, CH / 2,
                   0.09, 0.30, CH)

    # ── Cab_Details ───────────────────────────────────────────────────────────
    details = []

    # 6 horizontal grille bars (lower front face, between CH and ZS)
    for i in range(6):
        gz = CH + (ZS - CH) * (i + 1) / 7
        details.append(simple_box('_gr', 0, YF + 0.04, gz,
                                  HW * 2 - 0.14, 0.06, 0.055))

    # Door outline (thin box on each cab side face)
    door_y0, door_y1 = YB + 0.84, YF - 0.06
    door_cy  = (door_y0 + door_y1) / 2
    door_len = door_y1 - door_y0
    door_z0, door_z1 = CH + 0.10, 3.00
    door_cz  = (door_z0 + door_z1) / 2
    door_h   = door_z1 - door_z0
    for sx in [-HW, HW]:
        details.append(simple_box('_dr', sx, door_cy, door_cz,
                                  0.04, door_len, door_h))

    # Door window (smaller rectangle in upper door area)
    win_z0  = door_z0 + door_h * 0.55
    win_cz  = (win_z0 + door_z1 - 0.12) / 2
    win_h   = (door_z1 - 0.12) - win_z0
    for sx in [-HW, HW]:
        details.append(simple_box('_win', sx, door_cy, win_cz,
                                  0.03, door_len - 0.30, win_h))

    # Windscreen centre pillar (divides windscreen into 2 panes)
    details.append(simple_box('_wsp', 0, (YF + YS) / 2, (ZS + Y1) / 2,
                              0.05, YF - YS, Y1 - ZS))

    # Fog lights (small boxes at bumper level, outer edges)
    for sx in [-0.58, 0.58]:
        details.append(simple_box('_fgl', sx, YF + 0.16, CH + 0.12,
                                  0.22, 0.06, 0.14))

    det_base = details[0]
    det_base.name = 'Cab_Details'
    join_to(det_base, details[1:])
    det_base.name = 'Cab_Details'
    return det_base


# ── TRAILER ───────────────────────────────────────────────────────────────────
def create_trailer() -> bpy.types.Object:
    cy_z = (TZ0 + TZ1) / 2
    cy_y = (TYF + TYB) / 2
    simple_box('Trailer_Shell', 0, cy_y, cy_z, HW * 2, TLEN, TH)
    details = []

    # ── Rear corner posts ─────────────────────────────────────────────────────
    for sx in [-HW, HW]:
        details.append(simple_box('_rcp', sx, TYB, cy_z,
                                  0.05, 0.04, TH))

    # ── Rear underrun bar ─────────────────────────────────────────────────────
    details.append(simple_box('_rub', 0, TYB - 0.03, TZ0 + 0.04,
                              HW * 2 + 0.04, 0.05, 0.06))

    # ── Landing legs ──────────────────────────────────────────────────────────
    for sx in [-(HW - 0.18), (HW - 0.18)]:
        ly = TYF + 1.20
        details.append(simple_box('_ll', sx, ly, TZ0 / 2,
                                  0.06, 0.04, TZ0))

    # ── 8 curtain posts along each side (makes trailer read as curtainsider) ──
    for i in range(8):
        py = TYF + TLEN * (i + 0.5) / 8
        for sx in [-HW, HW]:
            details.append(simple_box('_cp', sx, py, cy_z,
                                      0.035, 0.025, TH - 0.04))

    # ── Top and bottom horizontal side rails ──────────────────────────────────
    for sx in [-HW, HW]:
        details.append(simple_box('_tr', sx, cy_y, TZ1 + 0.04, 0.03, TLEN, 0.08))
        details.append(simple_box('_br', sx, cy_y, TZ0 - 0.06, 0.03, TLEN, 0.08))

    # ── Rear centre door post ─────────────────────────────────────────────────
    details.append(simple_box('_rdp', 0, TYB - 0.03, cy_z, 0.06, 0.04, TH))

    # ── Rear door hinges — 2 per side ─────────────────────────────────────────
    for sx in [-HW, HW]:
        for hz in [TZ0 + TH * 0.25, TZ0 + TH * 0.75]:
            details.append(simple_box('_rdh', sx, TYB - 0.02, hz,
                                      0.04, 0.03, 0.12))

    det_base = details[0]
    det_base.name = 'Trailer_Details'
    join_to(det_base, details[1:])
    det_base.name = 'Trailer_Details'
    return det_base


# ── WHEEL ─────────────────────────────────────────────────────────────────────
def create_wheel(name: str, cx: float, cy: float, cz: float) -> bpy.types.Object:
    """
    Wheel: outer tyre + bead ring (40% R) + rim ring (55% R) + hub (20% R) + 8 spokes.
    4 concentric rings visible. Spokes are separate bmesh objects WITH faces.
    Long axis along X.
    """
    bm = bmesh.new()

    # ── Outer tyre cylinder (24 segments → 2 circular cap edges) ────────────
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False,
                          segments=24, radius1=WR, radius2=WR, depth=WW)
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0),
                     matrix=Matrix.Rotation(math.pi / 2, 3, 'Y'))

    # ── Rim ring (55% R, 16 segments) — was 70%, corrected for HGV proportions
    bm3 = bmesh.new()
    bmesh.ops.create_cone(bm3, cap_ends=True, cap_tris=False,
                          segments=16, radius1=WR * 0.55, radius2=WR * 0.55,
                          depth=WW * 0.55)
    bmesh.ops.rotate(bm3, verts=bm3.verts, cent=(0, 0, 0),
                     matrix=Matrix.Rotation(math.pi / 2, 3, 'Y'))
    for v in bm3.verts:
        bm.verts.new(v.co)
    bm3.free()

    # ── Bead ring (40% R, 14 segments) — NEW: tyre-to-rim bead seat ─────────
    bm5 = bmesh.new()
    bmesh.ops.create_cone(bm5, cap_ends=True, cap_tris=False,
                          segments=14, radius1=WR * 0.40, radius2=WR * 0.40,
                          depth=WW * 0.65)
    bmesh.ops.rotate(bm5, verts=bm5.verts, cent=(0, 0, 0),
                     matrix=Matrix.Rotation(math.pi / 2, 3, 'Y'))
    for v in bm5.verts:
        bm.verts.new(v.co)
    bm5.free()

    # ── Hub cap (20% R, 10 segments) ────────────────────────────────────────
    bm4 = bmesh.new()
    bmesh.ops.create_cone(bm4, cap_ends=True, cap_tris=False,
                          segments=10, radius1=WR * 0.20, radius2=WR * 0.20,
                          depth=WW * 0.50)
    bmesh.ops.rotate(bm4, verts=bm4.verts, cent=(0, 0, 0),
                     matrix=Matrix.Rotation(math.pi / 2, 3, 'Y'))
    for v in bm4.verts:
        bm.verts.new(v.co)
    bm4.free()

    # Translate all ring vertices to wheel centre
    bm.verts.ensure_lookup_table()
    for v in bm.verts:
        v.co.x += cx; v.co.y += cy; v.co.z += cz
    wheel_obj = link_bm(name, bm)

    # ── 8 spokes (was 5) — separate bmesh objects WITH faces ─────────────────
    # EdgesGeometry requires adjacent face pairs; isolated verts produce no edges.
    # spoke_r: 52% to reach rim ring at 55% — was 82% (too long)
    spoke_r = WR * 0.52
    t = 0.035   # half-thickness along wheel axis (X) — was 0.025
    spoke_obs = []
    for s in range(8):   # was range(5)
        ang = (s / 8) * math.pi * 2
        dy  = math.sin(ang) * spoke_r
        dz  = math.cos(ang) * spoke_r
        bms = bmesh.new()
        v0 = bms.verts.new((cx - t, cy,      cz     ))
        v1 = bms.verts.new((cx + t, cy,      cz     ))
        v2 = bms.verts.new((cx + t, cy + dy, cz + dz))
        v3 = bms.verts.new((cx - t, cy + dy, cz + dz))
        bms.verts.ensure_lookup_table()
        bms.faces.new([v0, v1, v2, v3])
        spoke_obs.append(link_bm(f'_spk{s}', bms))

    wheel_obj = join_to(wheel_obj, spoke_obs)
    wheel_obj.name = name
    return wheel_obj


# ── CHASSIS ───────────────────────────────────────────────────────────────────
def create_chassis() -> bpy.types.Object:
    """Chassis rails + cross-members + air tanks + battery box + 5th wheel."""
    RAIL_Y0 = YB - 0.04
    RAIL_YB = TYB + 0.04
    RAIL_LEN = abs(RAIL_YB - RAIL_Y0)
    RAIL_CY  = (RAIL_Y0 + RAIL_YB) / 2

    # Chassis rails
    ch_obj = simple_box('Chassis', -0.82, RAIL_CY, CH - 0.12,
                        0.12, RAIL_LEN, 0.15)
    details = []
    details.append(simple_box('_cr', 0.82, RAIL_CY, CH - 0.12,
                              0.12, RAIL_LEN, 0.15))

    # Cross-members (7)
    xmem_ys = [
        YF - 0.28, -0.04,
        YB - 0.42,
        (TYF + TYB) / 2 - 3.0,
        (TYF + TYB) / 2,
        (TYF + TYB) / 2 + 3.0,
        TYB + 1.8,
    ]
    for cy in xmem_ys:
        details.append(simple_box('_xm', 0, cy, CH - 0.10,
                                  1.64, 0.10, 0.05))

    # Air tanks (2 horizontal cylinders, driver/right side)
    for aty in [YB - 0.80, YB - 1.70]:
        details.append(simple_cylinder('_at', 0.68, aty, CH - 0.10,
                                       0.16, 0.82, segs=10, axis='Y'))

    # Battery box (passenger/left side)
    details.append(simple_box('_bb', -0.68, YB - 0.80, CH - 0.12,
                              0.28, 0.50, 0.22))

    # Fifth wheel coupling
    details.append(simple_cylinder('_fw', 0, YB - 0.18, CH + 0.04,
                                   0.55, 0.09, segs=14, axis='Z'))

    # Exhaust stack
    details.append(simple_cylinder('_ex', HW - 0.10, YB - 0.08, 2.10,
                                   0.07, 1.40, segs=8, axis='Z'))

    ch_obj = join_to(ch_obj, details)
    ch_obj.name = 'Chassis'
    return ch_obj


# ── ARTICULATION AIRLINES ──────────────────────────────────────────────────────
def create_airlines() -> bpy.types.Object:
    """3 catenary-curved pneumatic cables in the articulation gap."""
    GAP_YA = YB - 0.02
    GAP_YB = TYF + 0.02
    AIR_Z  = TZ0 + 0.78

    bm = bmesh.new()
    for ax, drop in [(-0.28, 0.18), (0.0, 0.24), (0.28, 0.18)]:
        pts = []
        for j in range(9):
            frac = j / 8
            gy = GAP_YA + (GAP_YB - GAP_YA) * frac
            gz = AIR_Z - math.sin(frac * math.pi) * drop
            pts.append((ax, gy, gz))
        for i in range(len(pts) - 1):
            # Thin quad segment WITH face (was missing bm.faces.new → airlines invisible)
            t = 0.015
            p0, p1 = pts[i], pts[i + 1]
            v0 = bm.verts.new((p0[0] - t, p0[1], p0[2]))
            v1 = bm.verts.new((p0[0] + t, p0[1], p0[2]))
            v2 = bm.verts.new((p1[0] + t, p1[1], p1[2]))
            v3 = bm.verts.new((p1[0] - t, p1[1], p1[2]))
            bm.verts.ensure_lookup_table()
            bm.faces.new([v0, v1, v2, v3])

    return link_bm('Airlines', bm)


# ── MIRRORS ───────────────────────────────────────────────────────────────────
def create_mirrors() -> None:
    """Wing mirror arm + head for each side."""
    for sx, sign in [(-HW, -1), (HW, 1)]:
        arm  = simple_box(f'Mirror_{"L" if sign < 0 else "R"}',
                          sx + sign * 0.06, 1.72, 2.90,   # was Y=0.90, Z=2.60
                          0.06, 0.42, 0.05)
        head = simple_box('_mh',
                          sx + sign * 0.24, 1.55, 2.90,   # was Y=0.74, Z=2.60
                          0.16, 0.10, 0.34)
        join_to(arm, [head])
        arm.name = f'Mirror_{"L" if sign < 0 else "R"}'


# ── EXPORT ────────────────────────────────────────────────────────────────────
def export_glb(path: str) -> None:
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format='GLB',
        use_selection=False,
        export_apply=True,
        export_yup=True,      # Blender Z-up → GLTF Y-up
    )
    print(f'[generate_lorry] Exported → {path}')


# ── MAIN ──────────────────────────────────────────────────────────────────────
if __name__ == '__main__' or True:
    clear()

    create_cab()
    create_trailer()
    create_chassis()
    create_airlines()
    create_mirrors()

    # ── Wheels ──────────────────────────────────────────────────────────────
    WY = WR   # wheel centre height = wheel radius (sits on ground)

    # Front steer axle (single wheel each side)
    for sx, side in [(-1, 'L'), (1, 'R')]:
        create_wheel(f'Wheel_Front{side}',
                     sx * (HW + 0.13), YF - 1.0, WY)

    # Drive axle tandem (0.5 behind cab rear, 2 axles 0.65 apart)
    for a in [0, 1]:
        wy = YB - 0.50 - a * 0.65
        for sx, side in [(-1, 'L'), (1, 'R')]:
            create_wheel(f'Wheel_DriveO{side}_{a}',
                         sx * (HW + 0.24), wy, WY)
            create_wheel(f'Wheel_DriveI{side}_{a}',
                         sx * (HW - 0.02), wy, WY)

    # Trailer tandem axles (measured from trailer rear)
    for fromRear in [3.0, 1.8]:
        wy = TYB + fromRear
        suffix = str(fromRear).replace('.', 'p')
        for sx, side in [(-1, 'L'), (1, 'R')]:
            create_wheel(f'Wheel_TrailO{side}_{suffix}',
                         sx * (HW + 0.24), wy, WY)
            create_wheel(f'Wheel_TrailI{side}_{suffix}',
                         sx * (HW - 0.02), wy, WY)

    # ── Mudflaps (thin boxes behind each axle group) ─────────────────────────
    for yw, sx in [(YF - 1.0, -1), (YF - 1.0, 1)]:
        simple_box('Mudflap', sx * (HW + 0.14),
                   yw + WR + 0.10, WY + 0.02,
                   0.08, 0.14, 0.28)
    for a in [0, 1]:
        yw = YB - 0.50 - a * 0.65
        for sx in [-1, 1]:
            simple_box('Mudflap', sx * (HW + 0.26),
                       yw + WR + 0.10, WY + 0.02,
                       0.08, 0.14, 0.28)
    for fromRear in [3.0, 1.8]:
        yw = TYB + fromRear
        for sx in [-1, 1]:
            simple_box('Mudflap', sx * (HW + 0.26),
                       yw + WR + 0.10, WY + 0.02,
                       0.08, 0.14, 0.28)

    export_glb(OUTPUT)
    print('[generate_lorry] DONE')
