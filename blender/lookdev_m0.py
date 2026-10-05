"""M0 look-dev: a slice of Zero Valley under K2, rendered at five times of day.

Run:  /home/user/.venvs/blender/bin/python blender/lookdev_m0.py [--quick] [--looks dawn,day,...]
Writes blender/out/m0_<look>.png  (+ blender/out/m0_lookdev.blend)
"""
from __future__ import annotations

import argparse
import math
import os
import random
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
import bmesh  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

import kit  # noqa: E402
import mountain  # noqa: E402

P = kit.PAL
RNG_SEED = 7

# ----------------------------------------------------------------------------- layout

VILLAGE = (78.0, -10.0, 70.0)  # x, y, radius
FARM = (-150.0, 120.0, 100.0)
KNOLL = (185.0, 95.0)
CAM_LOC = (-76.0, -236.0, 0.0)  # z filled from terrain at runtime
CAM_TARGET = (20.0, 700.0, 36.0)


def hero_cam() -> tuple[float, float, float]:
    """The hero reveal: stand just downhill of the villager, who turns to wave with K2 behind them."""
    hx, hy = hero_spot()
    gx, gy = CAM_TARGET[0] - hx, CAM_TARGET[1] - hy
    n = math.hypot(gx, gy)
    gx, gy = gx / n, gy / n
    cx, cy = hx - gx * 4.6 + gy * 1.3, hy - gy * 4.6 - gx * 1.3
    return (cx, cy, terrain_h(cx, cy) + 1.05)


def hero_target() -> tuple[float, float, float]:
    hx, hy = hero_spot()
    return (hx, hy, terrain_h(hx, hy) + 2.05)


def hero_spot() -> tuple[float, float]:
    """9 m ahead of the camera and a little right, so the waving villager sits in the right third."""
    fx, fy = CAM_TARGET[0] - CAM_LOC[0], CAM_TARGET[1] - CAM_LOC[1]
    n = math.hypot(fx, fy)
    fx, fy = fx / n, fy / n
    rx, ry = fy, -fx
    return (CAM_LOC[0] + fx * 14.0 + rx * 4.6, CAM_LOC[1] + fy * 14.0 + ry * 4.6)
HILL = (-70.0, -250.0)
FIELDS = [  # (cx, cy, w, h, kind)
    (-200, 75, 34, 22, "wheat"), (-160, 75, 34, 22, "crop"), (-120, 75, 34, 22, "soil"),
    (-200, 102, 34, 22, "crop"), (-160, 102, 34, 22, "wheat"), (-120, 102, 34, 22, "crop"),
    (-200, 129, 34, 22, "soil"), (-160, 129, 34, 22, "crop"), (-120, 129, 34, 22, "wheat"),
]


def river_x(y: float) -> float:
    return 55 * math.sin(y / 170 + 0.6) + 25 * math.sin(y / 63)


def path_points() -> list[tuple[float, float]]:
    # hill -> bridge -> village square, and bridge -> farm
    return [(-62, -228), (-45, -165), (-25, -105), (-8, -60), (22, -40), (50, -22), (80, -8)]


FARM_PATH = [(-8, -60), (-45, -10), (-85, 40), (-110, 60)]


def dist_to_polyline(x: float, y: float, pts: list[tuple[float, float]]) -> float:
    best = 1e9
    for (ax, ay), (bx, by) in zip(pts, pts[1:]):
        dx, dy = bx - ax, by - ay
        t = max(0.0, min(1.0, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)))
        px, py = ax + t * dx, ay + t * dy
        best = min(best, math.hypot(x - px, y - py))
    return best


def in_field(x: float, y: float, pad: float = 0.0):
    for f in FIELDS:
        cx, cy, w, h, kind = f
        if abs(x - cx) <= w / 2 + pad and abs(y - cy) <= h / 2 + pad:
            return f
    return None


def terrain_h(x: float, y: float) -> float:
    axis = 0.35 * river_x(y)
    d = abs(x - axis)
    walls = kit.smoothstep(100, 440, d) * (130 + 50 * kit.fbm(x * 0.004, y * 0.004, 3, seed=3.1))
    hill = 44 * math.exp(-((x - HILL[0]) ** 2 + (y - HILL[1]) ** 2) / (2 * 85**2))
    knoll = 16 * math.exp(-((x - KNOLL[0]) ** 2 + (y - KNOLL[1]) ** 2) / (2 * 30**2))
    roll = 5.5 * kit.fbm(x * 0.012, y * 0.012, 4, seed=1.7)
    dr = abs(x - river_x(y))
    # the river fades into a mountain stream as the valley head rises toward the glacier
    carve = -5.0 * (1 - kit.smoothstep(5, 24, dr)) * (1 - kit.smoothstep(1200, 1600, y))
    head = kit.smoothstep(650, 1750, y) ** 1.8 * (150 + 35 * kit.fbm(x * 0.005, y * 0.005, 2, seed=6.2))
    h = walls + hill + knoll + roll + carve + head
    for (px, py, pr), level in ((VILLAGE, 2.5), (FARM, 1.5)):
        w = 1 - kit.smoothstep(pr * 0.55, pr, math.hypot(x - px, y - py))
        h = h * (1 - w) + level * w
    return h


# ----------------------------------------------------------------------------- terrain & water


def build_terrain(cell: float, col) -> bpy.types.Object:
    x0, x1, y0, y1 = -560.0, 560.0, -360.0, 1800.0
    nx, ny = int((x1 - x0) / cell), int((y1 - y0) / cell)
    rng = random.Random(RNG_SEED)
    bm = bmesh.new()
    rows = []
    for j in range(ny + 1):
        row = []
        for i in range(nx + 1):
            x = x0 + i * cell + (rng.uniform(-0.3, 0.3) * cell if 0 < i < nx else 0)
            y = y0 + j * cell + (rng.uniform(-0.3, 0.3) * cell if 0 < j < ny else 0)
            row.append(bm.verts.new((x, y, terrain_h(x, y))))
        rows.append(row)
    for j in range(ny):
        for i in range(nx):
            a, b, c, d = rows[j][i], rows[j][i + 1], rows[j + 1][i + 1], rows[j + 1][i]
            if (i + j) % 2:
                bm.faces.new((a, b, c)); bm.faces.new((a, c, d))
            else:
                bm.faces.new((a, b, d)); bm.faces.new((b, c, d))
    ob = kit.obj_from_bmesh(bm, "Terrain", col)
    kit.flat(ob)
    paths = path_points()

    def color(p):
        x, y = p.center.x, p.center.y
        n = kit.fbm(x * 0.02, y * 0.02, 3, seed=9.0)
        dr = abs(x - river_x(y))
        if dr < 9:
            return kit.mix(P["sand"], P["dirt"], 0.3 + 0.2 * n)
        f = in_field(x, y)
        if f:
            kind = f[4]
            stripe = int((y - f[1] + 50) / 2.2) % 2
            if kind == "wheat":
                return kit.mix(P["wheat"], P["hay"], 0.3 * stripe + 0.1 * n)
            if kind == "crop":
                return kit.mix(P["crop"], P["soil"], 0.45 * stripe)
            return kit.mix(P["soil"], P["dirt"], 0.3 * stripe + 0.2 * n)
        if dist_to_polyline(x, y, paths) < 2.6 or dist_to_polyline(x, y, FARM_PATH) < 2.2:
            return kit.mix(P["path"], P["dirt"], 0.25 + 0.2 * n)
        if p.center.z > 215 + 25 * n:
            return kit.mix(P["glacier"], P["snow"], 0.5 + 0.3 * n) if p.normal.z > 0.6 else kit.mix(P["rock"], P["snow"], 0.3)
        if p.center.z > 165 + 20 * n:
            return kit.mix(kit.hex_lin("#8f8576"), P["rock"], 0.5 + 0.3 * n)
        if p.normal.z < 0.6:
            forest_floor = kit.mix(P["grass_c"], P["pine"], 0.55 + 0.2 * n)
            mossy_rock = kit.mix(P["rock"], P["grass_c"], 0.35 + 0.25 * n)
            return kit.mix(forest_floor, mossy_rock, kit.smoothstep(0.42, 0.3, p.normal.z))
        if math.hypot(x - VILLAGE[0], y - VILLAGE[1]) < VILLAGE[2] * 0.5:
            return kit.mix(P["grass_b"], P["meadow"], 0.4 + 0.3 * n)
        t = n * 0.5 + 0.5
        g = kit.mix(P["grass_a"], P["grass_b"], t)
        if n > 0.55:
            g = kit.mix(g, P["grass_dry"], 0.5)
        if p.center.z > 60:
            g = kit.mix(g, P["grass_c"], kit.smoothstep(60, 120, p.center.z))
        return g

    kit.paint_faces(ob, color)
    kit.assign(ob, kit.vc_material())
    return ob


def build_river(col) -> bpy.types.Object:
    bm = bmesh.new()
    prev = None
    y = -360.0
    while y <= 1500.0:
        cx = river_x(y)
        dy = 1.0
        tx = (river_x(y + dy) - cx) / dy
        nlen = math.hypot(1.0, tx)
        nxv, nyv = 1.0 / nlen, -tx / nlen
        z = terrain_h(cx, y) + 3.6
        w = 8.5
        l = bm.verts.new((cx - nxv * w, y - nyv * w, z))
        r = bm.verts.new((cx + nxv * w, y + nyv * w, z))
        if prev:
            bm.faces.new((prev[0], prev[1], r, l))
        prev = (l, r)
        y += 4.0
    ob = kit.obj_from_bmesh(bm, "River", col)
    kit.smooth(ob)
    kit.assign(ob, kit.water_material())
    return ob


def build_ridges(col) -> bpy.types.Object:
    """Layered mid-distance ridges between the valley and K2."""
    bm = bmesh.new()
    x0, x1, y0, y1, cell = -3800.0, 3800.0, 1600.0, 4200.0, 45.0
    nx, ny = int((x1 - x0) / cell), int((y1 - y0) / cell)
    rows = []
    for j in range(ny + 1):
        row = []
        for i in range(nx + 1):
            x, y = x0 + i * cell, y0 + j * cell
            depth = kit.smoothstep(1600, 4200, y)
            ridged = 1 - abs(kit.fbm(x * 0.0011, y * 0.0011, 4, seed=5.5))
            h = (60 + 520 * depth) * ridged ** 2.2 + 30 * kit.fbm(x * 0.004, y * 0.004, 2)
            # open a notch so K2 stays visible above the valley axis
            notch = math.exp(-((x - 260) ** 2) / (2 * 520**2)) * kit.smoothstep(1400, 3600, y)
            h *= 1 - 0.25 * notch
            h = max(h + 200, 230 + 90 * kit.fbm(x * 0.002, y * 0.002, 2, seed=2.2) + 260 * depth)
            h = terrain_h(x, y) - 6 + (h - terrain_h(x, y) + 6) * kit.smoothstep(1650, 2150, y)
            
            row.append(bm.verts.new((x, y, h)))
        rows.append(row)
    for j in range(ny):
        for i in range(nx):
            a, b, c, d = rows[j][i], rows[j][i + 1], rows[j + 1][i + 1], rows[j + 1][i]
            bm.faces.new((a, b, c)); bm.faces.new((a, c, d))
    ob = kit.obj_from_bmesh(bm, "Ridges", col)
    kit.flat(ob)

    def color(p):
        z, nz = p.center.z, p.normal.z
        if z > 640 and nz > 0.5:
            return kit.mix(P["snow"], P["glacier"], 0.2)
        if z > 420:
            return kit.mix(P["rock"], P["rock_dark"], 0.4 if nz < 0.7 else 0.1)
        forest = kit.mix(P["pine"], P["grass_c"], kit.smoothstep(0.6, 0.95, nz) * 0.4)
        return kit.mix(forest, P["rock"], kit.smoothstep(330, 420, z))

    kit.paint_faces(ob, color)
    kit.assign(ob, kit.vc_material())
    return ob


# ----------------------------------------------------------------------------- vegetation


def tree_pine(bm, x, y, z, s, rng):
    add = kit.add_cylinder(bm, 0.35 * s, 1.6 * s, (x, y, z), segments=5)
    tiers = [(2.6, 3.4, 1.0), (2.0, 3.0, 2.6), (1.35, 2.6, 4.0)]
    vs = []
    for r, h, oz in tiers:
        vs += kit.add_cone(bm, r * s, h * s, (x, y, z + oz * s), segments=7)
    kit.jitter(vs, rng, 0.12 * s)
    return add, vs


def tree_round(bm, x, y, z, s, rng):
    trunk = kit.add_cylinder(bm, 0.3 * s, 2.2 * s, (x, y, z), segments=5)
    crown = kit.add_ico(bm, 2.3 * s, (x, y, z + 3.6 * s), subdiv=1, scale=(1, 1, 0.9))
    kit.jitter(crown, rng, 0.35 * s)
    return trunk, crown


def build_trees(col, accept) -> bpy.types.Object:
    rng = random.Random(RNG_SEED + 1)
    pts = kit.poisson_scatter(rng, (-510, -350, 510, 1290), 7.5, accept, 2600, tries=60000)
    bm = bmesh.new()
    face_colors: list[kit.Color] = []
    for (x, y) in pts:
        z = terrain_h(x, y) - 0.3
        s = rng.uniform(0.8, 1.35)
        before = len(bm.faces)
        if z > 45 or rng.random() < 0.45:
            trunk, crown = tree_pine(bm, x, y, z, s, rng)
            crown_c = kit.jitter_color(rng.choice([P["pine"], P["pine_b"]]), rng, 0.08)
        else:
            trunk, crown = tree_round(bm, x, y, z, s, rng)
            crown_c = kit.jitter_color(rng.choice([P["leaf"], P["leaf_b"], P["leaf"], P["leaf_autumn"]]), rng, 0.08)
        bm.faces.ensure_lookup_table()
        trunk_set = set(trunk)
        for f in bm.faces[before:]:
            face_colors.append(P["trunk"] if all(v in trunk_set for v in f.verts) else crown_c)
    ob = kit.obj_from_bmesh(bm, "Trees", col)
    kit.flat(ob)
    cols = iter(face_colors)
    kit.paint_faces(ob, lambda _p: next(cols))
    kit.assign(ob, kit.vc_material())
    return ob


def build_rocks(col, accept) -> bpy.types.Object:
    rng = random.Random(RNG_SEED + 2)
    pts = kit.poisson_scatter(rng, (-510, -350, 510, 1290), 14.0, accept, 180)
    bm = bmesh.new()
    for (x, y) in pts:
        s = rng.uniform(0.6, 2.4)
        vs = kit.add_ico(bm, s, (x, y, terrain_h(x, y) + s * 0.2), subdiv=1, scale=(1.2, 1, 0.7))
        kit.jitter(vs, rng, 0.25 * s)
    ob = kit.obj_from_bmesh(bm, "Rocks", col)
    kit.flat(ob)
    kit.paint_faces(ob, lambda p: kit.mix(P["rock"], P["rock_dark"], 0.5 - 0.5 * p.normal.z))
    kit.assign(ob, kit.vc_material())
    return ob


# ----------------------------------------------------------------------------- buildings


class Builder:
    """Accumulates faces with a colour per part, then emits one object."""

    def __init__(self, name: str):
        self.name = name
        self.bm = bmesh.new()
        self.colors: list[kit.Color] = []

    def part(self, fn, color, *args, **kw):
        before = len(self.bm.faces)
        out = fn(self.bm, *args, **kw)
        self.bm.faces.ensure_lookup_table()
        self.colors += [color] * (len(self.bm.faces) - before)
        return out

    def build(self, col, material=None, flat=True):
        ob = kit.obj_from_bmesh(self.bm, self.name, col)
        (kit.flat if flat else kit.smooth)(ob)
        cols = iter(self.colors)
        kit.paint_faces(ob, lambda _p: next(cols))
        kit.assign(ob, material or kit.vc_material())
        return ob


def build_village(col, windows: Builder) -> bpy.types.Object:
    rng = random.Random(RNG_SEED + 3)
    b = Builder("Village")
    vx, vy, _ = VILLAGE
    spots = [(vx + dx, vy + dy, r) for dx, dy, r in [(-35, -25, 0.3), (-13, 30, -0.2), (23, -18, 0.5), (35, 30, 0.1), (-45, 18, 1.2), (10, 55, 0.9), (45, 2, -0.6), (-5, -45, 0.2)]]
    walls = [P["wall_cream"], P["wall_white"], P["wall_sage"], P["wall_sky"]]
    roofs = [P["roof_terracotta"], P["roof_slate"], P["roof_moss"], P["roof_terracotta"]]
    for (x, y, rot) in spots:
        z = terrain_h(x, y) - 0.2
        w, d, h = rng.uniform(6, 9), rng.uniform(5, 7), rng.uniform(3.6, 5.0)
        b.part(kit.add_box, rng.choice(walls), (w, d, h), (x, y, z + h / 2), rot)
        b.part(kit.add_prism_roof, rng.choice(roofs), w, d, rng.uniform(2.4, 3.4), (x, y, z + h), rot)
        cx = x + math.cos(rot) * w * 0.25
        cy = y + math.sin(rot) * w * 0.25
        b.part(kit.add_box, P["rock"], (0.9, 0.9, 2.6), (cx, cy, z + h + 1.6), rot)
        # door + two windows on the long sides
        fx, fy = -math.sin(rot), math.cos(rot)
        for side in (1, -1):
            for k in (-0.25, 0.25):
                wx = x + math.cos(rot) * w * k + fx * (d / 2 + 0.06) * side
                wy = y + math.sin(rot) * w * k + fy * (d / 2 + 0.06) * side
                windows.part(kit.add_box, P["window_warm"], (1.1, 0.12, 1.1), (wx, wy, z + h * 0.6), rot)
        dx = x + fx * (d / 2 + 0.05)
        dy = y + fy * (d / 2 + 0.05)
        b.part(kit.add_box, P["wood"], (1.2, 0.12, 2.1), (dx, dy, z + 1.05), rot)
    # village well / square marker
    b.part(kit.add_cylinder, P["rock"], 1.6, 1.0, (vx, vy + 5, terrain_h(vx, vy + 5)), 10)
    return b.build(col)


def build_observatory(col, windows: Builder) -> bpy.types.Object:
    """CRC — the Research council: an observatory dome on the knoll."""
    b = Builder("Observatory")
    x, y = KNOLL
    z = terrain_h(x, y) - 0.5
    b.part(kit.add_cylinder, P["wall_white"], 7.0, 8.0, (x, y, z), 16)
    b.part(kit.add_cylinder, P["rock"], 7.4, 0.8, (x, y, z + 8.0), 16)
    dome = b.part(kit.add_uvsphere, kit.hex_lin("#e9edf2"), 6.8, (x, y, z + 8.8), 20, 10)
    for v in dome:
        if v.co.z < z + 8.8:
            v.co.z = z + 8.8
    # telescope slit and tube
    b.part(kit.add_box, kit.hex_lin("#2b3240"), (1.4, 0.6, 6.0), (x, y - 5.6, z + 12.5), 0.0)
    b.part(kit.add_cylinder, kit.hex_lin("#9aa3b0"), 0.7, 6.0, (x, y - 2.0, z + 13.0), 8, None,
           Matrix.Rotation(math.radians(-55), 4, "X"))
    for k in range(10):
        a = k / 10 * math.tau
        windows.part(kit.add_box, P["window_warm"], (1.0, 0.15, 1.3),
                     (x + math.cos(a) * 7.05, y + math.sin(a) * 7.05, z + 4.5), a + math.pi / 2)
    return b.build(col)


def build_farm(col, windows: Builder) -> list[bpy.types.Object]:
    rng = random.Random(RNG_SEED + 4)
    b = Builder("Farm")
    bx, by = FARM[0] + 62.0, FARM[1] - 12.0
    bz = terrain_h(bx, by) - 0.2
    b.part(kit.add_box, P["barn"], (14, 10, 7), (bx, by, bz + 3.5), 0.15)
    b.part(kit.add_prism_roof, kit.hex_lin("#6b4a3a"), 14, 10, 4.5, (bx, by, bz + 7), 0.15, 0.6)
    b.part(kit.add_box, P["white"], (4.2, 0.2, 5.0), (bx - 1.0, by - 5.1, bz + 2.5), 0.15)
    # silo
    sx, sy = bx + 12, by + 3
    sz = terrain_h(sx, sy) - 0.2
    b.part(kit.add_cylinder, kit.hex_lin("#d7dbe0"), 3.2, 15, (sx, sy, sz), 14)
    dome = b.part(kit.add_uvsphere, kit.hex_lin("#9fb0c4"), 3.25, (sx, sy, sz + 15), 14, 8)
    for v in dome:
        if v.co.z < sz + 15:
            v.co.z = sz + 15
    # windmill
    wx, wy = FARM[0] + 30.0, FARM[1] + 50.0
    wz = terrain_h(wx, wy) - 0.3
    b.part(kit.add_cylinder, P["wall_cream"], 4.6, 17, (wx, wy, wz), 10, 2.8)
    b.part(kit.add_cone, P["roof_terracotta"], 3.6, 4.2, (wx, wy, wz + 17), 10)
    hub = Vector((wx, wy - 3.6, wz + 16.5))
    for k in range(4):
        a = k * math.pi / 2 + 0.35
        m = Matrix.Translation(hub) @ Matrix.Rotation(a, 4, "Y") @ Matrix.Translation((0, 0, 6.5))
        vs = b.part(kit.add_box, P["wood_light"], (1.9, 0.25, 13.0), (0, 0, 0), 0.0)
        kit.bm_transform(b.bm, vs, m)
    # fences around fields
    for (cx, cy, w, h, _k) in FIELDS[:3]:
        for t in range(0, int(w) + 1, 4):
            px, py = cx - w / 2 + t, cy - h / 2 - 2.5
            b.part(kit.add_box, P["wood"], (0.3, 0.3, 1.4), (px, py, terrain_h(px, py) + 0.7), 0.0)
    # hay bales
    for _ in range(9):
        hx, hy = rng.uniform(-215, -110), rng.uniform(64, 140)
        if in_field(hx, hy) and in_field(hx, hy)[4] == "wheat":
            b.part(kit.add_cylinder, P["hay"], 1.2, 1.5, (hx, hy, terrain_h(hx, hy) + 0.2), 10, None,
                   Matrix.Rotation(math.pi / 2, 4, "X"))
    farm = b.build(col)
    # sheep in the pasture
    s = Builder("Sheep")
    for _ in range(9):
        px, py = rng.uniform(-75, -30), rng.uniform(150, 205)
        if in_field(px, py, 4):
            continue
        z = terrain_h(px, py)
        rot = rng.uniform(0, math.tau)
        body = s.part(kit.add_ico, P["white"], 0.9, (px, py, z + 1.0), 1, (1.35, 0.9, 0.85))
        kit.jitter(body, rng, 0.08)
        hx, hy = px + math.cos(rot) * 1.3, py + math.sin(rot) * 1.3
        s.part(kit.add_ico, P["black"], 0.42, (hx, hy, z + 1.25), 1)
        for lx, ly in ((0.5, 0.35), (0.5, -0.35), (-0.5, 0.35), (-0.5, -0.35)):
            s.part(kit.add_cylinder, P["black"], 0.12, 0.6, (px + lx, py + ly, z), 5)
    return [farm, s.build(col)]


def build_bridge(col) -> bpy.types.Object:
    b = Builder("Bridge")
    y0 = -52.0
    cx = river_x(y0)
    base = terrain_h(cx - 14, y0)
    for k in range(13):
        t = k / 12
        x = cx - 13 + 26 * t
        z = base + 1.6 + 2.2 * math.sin(math.pi * t)
        b.part(kit.add_box, P["wood_light"], (2.2, 4.0, 0.35), (x, y0, z), 0.0)
        if k % 3 == 0:
            for side in (-1, 1):
                b.part(kit.add_box, P["wood"], (0.3, 0.3, 1.3), (x, y0 + side * 1.9, z + 0.65), 0.0)
    return b.build(col)


def build_lanterns(col, lanterns: Builder) -> bpy.types.Object:
    posts = Builder("LanternPosts")
    pts = path_points()
    for (ax, ay), (bx2, by2) in zip(pts[2:], pts[3:]):
        mx, my = (ax + bx2) / 2 + 3.0, (ay + by2) / 2
        z = terrain_h(mx, my)
        posts.part(kit.add_cylinder, P["wood"], 0.12, 3.0, (mx, my, z), 6)
        lanterns.part(kit.add_box, P["amber"], (0.55, 0.55, 0.7), (mx, my, z + 3.2), 0.4)
    return posts.build(col)


def build_clouds(col) -> bpy.types.Object:
    """Soft low-poly cumulus: clusters of jittered icospheres."""
    rng = random.Random(RNG_SEED + 11)
    b = Builder("Clouds")
    anchors = [(-900, 2200, 620), (700, 1800, 540), (-300, 3600, 900), (1300, 3900, 980), (-1700, 3200, 760),
               (350, 6200, 1650), (-1200, 5600, 1250), (1900, 2600, 700), (-450, 1300, 430)]
    for (ax, ay, az) in anchors:
        n = rng.randint(5, 9)
        for _ in range(n):
            r = rng.uniform(30, 75)
            vs = b.part(kit.add_ico, kit.hex_lin("#ffffff"), r,
                        (ax + rng.uniform(-110, 110), ay + rng.uniform(-50, 50), az + rng.uniform(-10, 35)), 2, (1.5, 1.0, 0.75))
            for v in vs:
                v.co.z = max(v.co.z, az - 12)
            kit.jitter(vs, rng, r * 0.08)
    return b.build(col, kit.cloud_material())


def build_flowers(col) -> bpy.types.Object:
    rng = random.Random(RNG_SEED + 12)
    b = Builder("Flowers")
    colors = [kit.hex_lin(c) for c in ("#ffffff", "#ffe066", "#ff9fb2", "#c9a7ff", "#ffffff")]
    for _ in range(70):
        cx = CAM_LOC[0] + rng.uniform(-40, 50)
        cy = CAM_LOC[1] + rng.uniform(4, 80)
        c = rng.choice(colors)
        for _ in range(rng.randint(4, 10)):
            x, y = cx + rng.uniform(-2.5, 2.5), cy + rng.uniform(-2.5, 2.5)
            b.part(kit.add_ico, c, rng.uniform(0.09, 0.16), (x, y, terrain_h(x, y) + 0.22), 1)
            b.part(kit.add_cylinder, P["grass_c"], 0.02, 0.22, (x, y, terrain_h(x, y)), 4)
    return b.build(col)


# ----------------------------------------------------------------------------- characters


VILLAGER_STYLES = [
    {"shirt": "#2fa3a0", "skin": "skin_a", "hat": "#e2b04a", "acc": "hat"},
    {"shirt": "#e07a5f", "skin": "skin_b", "hat": None, "acc": "scarf"},
    {"shirt": "#8e7cc3", "skin": "skin_c", "hat": "#3d405b", "acc": "beanie"},
    {"shirt": "#e9c46a", "skin": "skin_a", "hat": None, "acc": "glasses"},
    {"shirt": "#81b29a", "skin": "skin_b", "hat": "#f4f1de", "acc": "hat"},
]


def build_villager(col, x, y, rot, style, scale=1.0, wave=False, name="Villager", scarf=None) -> bpy.types.Object:
    """A bean villager: soft body, dot eyes, rosy cheeks, mitten hands, little boots, one accessory.

    Parts are separate sub-meshes in one object here (renders); the web export splits them so
    code can animate idle / walk / wave / talk / stumble.
    """
    b = Builder(name)
    z = terrain_h(x, y) - 0.05
    shirt = kit.hex_lin(style["shirt"])
    skin = P[style["skin"]]
    pants = kit.hex_lin("#3d405b")
    boots = kit.hex_lin("#5a3d2b")
    s = scale
    for side in (1, -1):
        b.part(kit.add_cylinder, pants, 0.12 * s, 0.5 * s, (0.16 * side * s, 0, 0.08 * s), 10)
        b.part(kit.add_uvsphere, boots, 0.15 * s, (0.16 * side * s, -0.05 * s, 0.08 * s), 12, 8, (1.0, 1.35, 0.6))
    b.part(kit.add_uvsphere, shirt, 0.4 * s, (0, 0, 0.98 * s), 24, 14, (1.0, 0.86, 1.18))
    b.part(kit.add_uvsphere, skin, 0.33 * s, (0, 0, 1.72 * s), 24, 14)
    for side in (1, -1):
        b.part(kit.add_uvsphere, P["black"], 0.05 * s, (0.11 * side * s, -0.296 * s, 1.77 * s), 10, 8)
        b.part(kit.add_uvsphere, P["white"], 0.016 * s, (0.12 * side * s, -0.338 * s, 1.79 * s), 6, 4)
        b.part(kit.add_uvsphere, P["cheek"], 0.06 * s, (0.2 * side * s, -0.26 * s, 1.66 * s), 10, 6, (1, 0.4, 0.7))
    # a small smile
    b.part(kit.add_uvsphere, kit.hex_lin("#7a3b33"), 0.045 * s, (0, -0.315 * s, 1.63 * s), 10, 6, (1.3, 0.3, 0.45))
    # arms with mitten hands; the waving arm is raised and angled out
    for side in (1, -1):
        up = wave and side == 1
        ang = math.radians(-145 if up else 10 * side)
        rot_arm = Matrix.Rotation(ang, 4, "Y")
        shoulder = Vector((0.37 * side * s, 0, 1.28 * s))
        b.part(kit.add_cylinder, shirt, 0.1 * s, 0.5 * s, tuple(shoulder), 10, 0.085 * s, rot_arm)
        hand = shoulder + (rot_arm @ Vector((0, 0, 0.56 * s, 1.0))).to_3d()
        b.part(kit.add_uvsphere, skin, 0.11 * s, tuple(hand), 12, 8)
    acc = style["acc"]
    if acc == "hat" and style["hat"]:
        hc = kit.hex_lin(style["hat"])
        b.part(kit.add_cylinder, hc, 0.48 * s, 0.05 * s, (0, 0, 1.96 * s), 20)
        b.part(kit.add_cylinder, hc, 0.25 * s, 0.24 * s, (0, 0, 1.98 * s), 20)
        b.part(kit.add_cylinder, shirt, 0.255 * s, 0.07 * s, (0, 0, 2.0 * s), 20)
    elif acc == "beanie" and style["hat"]:
        cap = b.part(kit.add_uvsphere, kit.hex_lin(style["hat"]), 0.345 * s, (0, 0, 1.8 * s), 18, 9)
        for v in cap:
            v.co.z = max(v.co.z, 1.85 * s)
        b.part(kit.add_uvsphere, kit.hex_lin("#f4f1de"), 0.08 * s, (0, 0, 2.15 * s), 8, 6)
    elif acc == "glasses":
        for side in (1, -1):
            b.part(kit.add_cylinder, P["black"], 0.085 * s, 0.03 * s, (0.11 * side * s, -0.31 * s, 1.77 * s), 14, None,
                   Matrix.Rotation(math.pi / 2, 4, "X"))
    scarf_color = scarf or (kit.hex_lin("#ffd166") if acc == "scarf" else None)
    if scarf_color:
        b.part(kit.add_cylinder, scarf_color, 0.33 * s, 0.13 * s, (0, 0, 1.36 * s), 20)
        b.part(kit.add_box, scarf_color, (0.12 * s, 0.05 * s, 0.34 * s), (0.12 * s, -0.33 * s, 1.24 * s), 0.0)
    ob = b.build(col, kit.vc_material("ZV_Character", roughness=0.6), flat=False)
    ob.location = (x, y, z)
    ob.rotation_euler = (0, 0, rot)
    return ob


# ----------------------------------------------------------------------------- looks


LOOKS = {
    "dawn": kit.Look("dawn", 6, 75, kit.hex_lin("#ffbf94"), 3.2, 0.55, kit.hex_lin("#d9c3d8"), 0.42, 1700, 0.15, 1.2, 2.0, 0.0, air=1.2, dust=1.4),
    "day": kit.Look("day", 48, 145, kit.hex_lin("#fff4e6"), 3.6, 0.55, kit.hex_lin("#a9c8e6"), 0.42, 3200, -1.1, 0.0, 0.0, 0.0),
    "golden": kit.Look("golden", 10, 245, kit.hex_lin("#ffbe6b"), 4.0, 0.6, kit.hex_lin("#ebc595"), 0.42, 1800, 0.0, 0.6, 0.0, 0.0, dust=1.8),
    "dusk": kit.Look("dusk", 1.8, 262, kit.hex_lin("#ff8f8a"), 4.5, 0.32, kit.hex_lin("#8f86b5"), 0.46, 1500, 0.35, 7.0, 9.0, 2.0, dust=2.2),
    "night": kit.Look("night", 30, 215, kit.hex_lin("#b3c4ff"), 0.75, 1.6, kit.hex_lin("#1c2748"), 0.45, 1500, 1.05, 16.0, 18.0, 16.0, night=True),
}


def apply_look(look: kit.Look) -> None:
    kit.build_world(look)
    kit.sun(look)
    kit.set_haze(look.haze_color, look.haze_max, look.haze_dist)
    kit.set_emission("ZV_Window", look.window)
    kit.set_emission("ZV_Lantern", look.lantern)
    kit.set_emission("ZV_Firefly", look.firefly)
    kit.set_emission("ZV_Moon", 6.0 if look.night else 0.0)
    moon = bpy.data.objects.get("Moon")
    if moon:
        moon.hide_render = not look.night
    bpy.context.scene.view_settings.exposure = look.exposure


# ----------------------------------------------------------------------------- main


def build_world(quick: bool, hero_faces_camera: bool = False):
    col = kit.collection("ZeroValley")
    terrain = build_terrain(5.0 if quick else 3.2, col)
    build_river(col)
    build_ridges(col)
    k2 = mountain.build_mountain(grid=150 if quick else 230, scale=0.42, col=col)
    k2.location = (150, 5400, 60)

    def accept_tree(x, y):
        if abs(x - river_x(y)) < 26 or in_field(x, y, 8):
            return False
        if math.hypot(x - VILLAGE[0], y - VILLAGE[1]) < VILLAGE[2] * 0.75:
            return False
        if math.hypot(x - FARM[0], y - FARM[1]) < FARM[2] * 0.7:
            return False
        if math.hypot(x - HILL[0], y - HILL[1]) < 60 or dist_to_polyline(x, y, path_points()) < 8:
            return False
        if math.hypot(x - KNOLL[0], y - KNOLL[1]) < 22:
            return False
        h = terrain_h(x, y)
        forest = kit.fbm(x * 0.008, y * 0.008, 2, seed=4.4)
        return h > -1 and (h > 22 or forest > 0.15 or random.random() < 0.18)

    build_trees(col, accept_tree)
    build_rocks(col, lambda x, y: abs(x - river_x(y)) > 14 and not in_field(x, y, 6) and terrain_h(x, y) > 6)
    windows = Builder("Windows")
    lanterns = Builder("Lanterns")
    build_village(col, windows)
    build_observatory(col, windows)
    build_farm(col, windows)
    build_bridge(col)
    build_clouds(col)
    moon = Builder("Moon")
    moon.part(kit.add_uvsphere, kit.hex_lin("#f4f1e4"), 95.0, (-2600, 7000, 2300), 24, 12)
    moon.build(col, kit.emissive_material("ZV_Moon", kit.hex_lin("#f4f1e4"), 0.0), flat=False)
    build_flowers(col)
    build_lanterns(col, lanterns)
    windows.build(col, kit.emissive_material("ZV_Window", P["window_warm"], 0.0))
    lanterns.build(col, kit.emissive_material("ZV_Lantern", P["amber"], 0.0))
    # fireflies over the meadow below the hill
    rng = random.Random(RNG_SEED + 9)
    ff = Builder("Fireflies")
    for _ in range(90):
        x, y = rng.uniform(-120, 40), rng.uniform(-200, -40)
        ff.part(kit.add_ico, P["lime"], 0.16, (x, y, terrain_h(x, y) + rng.uniform(0.8, 4.5)), 1)
    ff.build(col, kit.emissive_material("ZV_Firefly", P["lime"], 0.0))
    # villagers: the hero on the hilltop, a few by the path and village
    hx, hy = hero_spot()
    # The bean's face points down -Y; rotating by theta points it at (sin theta, -cos theta).
    gaze_x, gaze_y = CAM_TARGET[0] - hx, CAM_TARGET[1] - hy
    face_k2 = math.atan2(gaze_x, -gaze_y)
    turn = (face_k2 + math.pi - 0.25) if hero_faces_camera else (face_k2 - 0.35)
    build_villager(col, hx, hy, turn, VILLAGER_STYLES[0], 1.0, wave=True, name="Hero", scarf=P["lime"])
    for k, (vx, vy, r) in enumerate([(-30, -118, 0.4), (-24, -108, -2.4), (60, -20, 1.0), (88, 4, 2.6)]):
        build_villager(col, vx, vy, r, VILLAGER_STYLES[k + 1], 1.0, name=f"Villager{k}")
    return terrain


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--quick", action="store_true")
    ap.add_argument("--looks", default="dawn,day,golden,dusk,night")
    ap.add_argument("--width", type=int, default=1600)
    ap.add_argument("--height", type=int, default=900)
    ap.add_argument("--samples", type=int, default=96)
    ap.add_argument("--shot", default="establish")
    args = ap.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:])

    kit.reset_scene()
    t = time.time()
    build_world(args.quick, hero_faces_camera=(args.shot == "hero"))
    print(f"[m0] world built in {time.time() - t:.1f}s")
    cam = (CAM_LOC[0], CAM_LOC[1], terrain_h(CAM_LOC[0], CAM_LOC[1]) + 3.0)
    shots = {
        "establish": (cam, CAM_TARGET, 28, 24),
        "hero": (hero_cam(), hero_target(), 26, 4.8),
    }
    loc, target, lens, focus = shots[args.shot]
    cam_ob = kit.camera("Cam", loc, target, lens=lens)
    if args.shot == "establish":
        cam_ob.data.shift_y = -0.07  # keep K2 up top while the hero stands full-length below
    else:
        cam_ob.data.shift_x = 0.17  # hero in the left third, K2 towering on the right
        cam_ob.data.shift_y = 0.02
        cam_ob.data.dof.use_dof = True
        cam_ob.data.dof.focus_distance = focus
        cam_ob.data.dof.aperture_fstop = 1.8
    kit.setup_cycles(args.width, args.height, args.samples)
    for name in args.looks.split(","):
        look = LOOKS[name]
        apply_look(look)
        out = os.path.join(kit.OUT, f"m0_{args.shot}_{name}.png")
        t = time.time()
        kit.render_to(out)
        print(f"[m0] {name}: {time.time() - t:.1f}s -> {out}")
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(kit.OUT, "m0_lookdev.blend"))


if __name__ == "__main__":
    main()
