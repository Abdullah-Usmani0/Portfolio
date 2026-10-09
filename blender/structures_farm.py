"""
The farm (scene "scenarios"), modelled from the numbers the site draws it with
(src/world/scenery/farmLayout.ts): the barn, the silo, the windmill and its sails, the dock,
and the hill they stand on, its crops grown in terraces.

The hill is terraced so that, seen in the oblique view, each terrace's crops fill exactly the
band the site paints for its row, and the bank of grass under it the gap between two rows:
a terrace TERRACE deep shows KZ·TERRACE of its floor, and crops CROP tall stand on it; the
next terrace down sits in front of it, a riser lower. So the farmers, the cart and the crates
the site moves over the fields still walk, roll and slide where they always have.
"""
from __future__ import annotations

import math

import bpy
import bmesh
import numpy as np
from mathutils import Matrix, Vector

from structures_kit import (
    KX,
    KZ,
    Kit,
    Shader,
    _object,
    at_screen,
    ball,
    bar_xz,
    box,
    corrugated,
    cylinder,
    darker,
    disc_y,
    dome,
    glass,
    lin,
    obox,
    paint,
    prism,
    ring,
    rod,
    stone,
    tiles,
    wood,
)

# Every structure's numbers, set by structures_render.py: the farm's buildings cast their
# shadows on the fields' own terraces.
ITEMS: list[dict] = []

TERRACE = 15.0
# The hilltop's own terrace: its front edge 3 under the crest, where the barn stands.
PLATEAU = 3.0 / KZ
# How tall the crops stand: enough to fill a row's band (10 high, less the floor seen under
# them), and a little more, so they lean over the bank behind.
CROP = 10.0 - KZ * TERRACE + 1.6


def soil(name: str) -> bpy.types.Material:
    """Tilled earth: furrows along the terrace, darker and damp in the hollows."""
    s = Shader(name)
    c = lin("#5b4633")
    furrow = s.op("SINE", s.op("MULTIPLY", s.axis("Y"), 2 * math.pi / 2.6))
    col = s.mix(s.ramp(furrow, -0.6, 0.8), darker(c, 0.7), c)
    col = s.mix(s.ramp(s.noise(0.15, 4), 0.4, 0.7), col, lin("#6c5640"))
    return s.surface(col, 0.95, bump=furrow, strength=0.35)


def grass(name: str, colour: str = "#6a7d3c") -> bpy.types.Material:
    """Grass on the banks: patchy, lighter where it dries, a little earth showing."""
    s = Shader(name)
    c = lin(colour)
    col = s.mix(s.ramp(s.noise(0.2, 5), 0.35, 0.7), darker(c, 0.75), c)
    col = s.mix(s.ramp(s.noise(0.05, 3), 0.55, 0.75), col, lin("#8f9550"))
    col = s.mix(s.op("MULTIPLY", s.ramp(s.noise(0.4, 3), 0.68, 0.76), 0.6), col, lin("#5f4b36"))
    return s.surface(col, 0.95, bump=s.noise(1.6, 4), strength=0.5)


def track(name: str) -> bpy.types.Material:
    """The hilltop the cart has worn: packed earth with ruts, grass left in the middle."""
    s = Shader(name)
    dirt = lin("#7c6448")
    patch = s.ramp(s.noise(0.08, 4), 0.55, 0.68)
    col = s.mix(s.ramp(s.noise(0.5, 4), 0.3, 0.7), dirt, darker(dirt, 0.8))
    col = s.mix(patch, col, lin("#6f7f3f"))
    return s.surface(col, 0.95, bump=s.noise(1.2, 4), strength=0.4)


def ribbed_dome(name: str, cx: float, cy: float, light: str, dark: str, ribs: int, metallic: float) -> bpy.types.Material:
    """Sheet metal over a dome on (cx, cy), in panels between ribs from the rim to the crown."""
    s = Shader(name)
    az = s.op("ARCTAN2", s.op("SUBTRACT", s.axis("Y"), cy), s.op("SUBTRACT", s.unsheared_x(), cx))
    k = s.op("FRACT", s.op("MULTIPLY", az, ribs / (2 * math.pi)))
    rib = s.ramp(s.op("ABSOLUTE", s.op("SUBTRACT", k, 0.5)), 0.44, 0.5)
    col = s.mix(s.ramp(s.noise(0.3, 4, vec=s.mapping((1.0, 1.0, 0.1))), 0.3, 0.7), lin(light), lin(dark))
    col = s.mix(s.op("MULTIPLY", rib, 0.4), col, darker(lin(dark), 0.8))
    return s.surface(col, 0.45, bump=rib, strength=0.5, metallic=metallic)


class FarmKit:
    """The farm's materials, made once (after the scene is set up)."""

    def __init__(self) -> None:
        self.red = wood("barn-red", "#9a3a2f", 3.2)
        self.red_dark = wood("barn-red-dark", "#7c2e26", 3.2)
        self.white = paint("trim-white", "#efe9de", 0.55)
        self.roof = corrugated("barn-roof", "#57565c", 1.3)
        self.stone = stone("farm-stone", "#8d8478", 3.5)
        self.dark = paint("opening", "#1f1b1c", 0.9)
        self.glass = glass("farm-glass")
        self.iron = paint("farm-iron", "#2f3134", 0.5, 0.6)
        self.galv = paint("galvanized", "#a7abae", 0.35, 0.75)
        self.mill = wood("mill-boards", "#7a5b43", 2.2, vertical=False)
        self.mill_cap = tiles("mill-cap", "#5e2f28", 1.6)
        self.timber = wood("timber", "#6b4a32", 2.0)
        self.canvas = paint("canvas", "#ece0c4", 0.85)
        self.deck = wood("deck", "#8a6a4a", 1.8, vertical=False)
        self.pile = wood("pile", "#4b3828", 1.2)
        self.soil = soil("soil")
        self.grass = grass("bank-grass")
        self.crest = grass("crest-grass", "#7b8642")
        self.straw = paint("straw", "#d9b866", 0.8)
        self.coat = paint("coat", "#5f5191", 0.8)
        self.hat = paint("hat", "#2a2433", 0.8)
        self.paper = paint("paper", "#f4efe4", 0.7)
        crops = {
            "wheat": ("#c9a24e", "#e2bd62"),
            "barley": ("#b88e45", "#d4a95a"),
            "oats": ("#cdb57a", "#e6d29a"),
            "maize": ("#7f9d47", "#d8c27a"),
            "cabbage": ("#6f9a4e", "#a9c27a"),
            "leaf": ("#4f7a46", "#6f9a5e"),
            "potato": ("#4f7038", "#6a8c48"),
            "sunflower": ("#5f7d38", "#f0b21e"),
        }
        # Each crop's stalk and head, a little different plant to plant.
        self.crop = {k: (paint(f"{k}-stalk", a, 0.8), paint(f"{k}-head", b, 0.75)) for k, (a, b) in crops.items()}
        self.seed = paint("sunflower-seed", "#4a3220", 0.9)
        self.bloom = paint("potato-bloom", "#f1ece0", 0.8)
        self.blade = paint("grass-blade", "#5f7a34", 0.85)
        self.flowers = [paint("flower-white", "#f3efe2", 0.8), paint("flower-yellow", "#e8c33a", 0.8), paint("flower-violet", "#8b6bb8", 0.8)]
        self.track = track("track")


_KIT: FarmKit | None = None


def farm_kit() -> FarmKit:
    global _KIT
    if _KIT is None:
        _KIT = FarmKit()
    return _KIT


# ——— The hill and its terraces ———

class Hill:
    """The terraced hill, from the fields' numbers: where each terrace's floor is, and the
    hill's surface as a mesh."""

    def __init__(self, p: dict):
        self.xs = np.array(p["xs"], float)
        self.top = np.array(p["top"], float)
        self.ground = np.array(p["ground"], float)
        self.rows = list(p["rows"])
        # One terrace per row of crops, and a plain one at the foot.
        self.tops = self.rows + [self.rows[-1] + 16]
        self.n = len(self.tops)
        self.front = [(self.n - 1 - k) * TERRACE for k in range(self.n)]
        self.crest = self.n * TERRACE

    def at(self, arr: np.ndarray, x: float) -> float:
        return float(np.interp(x, self.xs, arr))

    def floor(self, k: int, x: float) -> float:
        """World height of terrace k's floor at x, clamped where it would lie under the valley."""
        h = self.at(self.top, x) - (self.tops[k] + 10) - KZ * self.front[k]
        return max(h, self.at(self.ground, x) - 2 - KZ * self.front[k])

    def planted(self, k: int, x: float) -> bool:
        """Whether terrace k has room for its crops at x (the site's band is not squeezed away)."""
        return self.at(self.top, x) - (self.tops[k] + 10) > self.at(self.ground, x) + 1

    def plateau(self, x: float) -> float:
        return self.at(self.top, x) - 3 - KZ * self.crest

    def surface(self, fk: FarmKit) -> bpy.types.Object:
        """The hill: a skirt at the foot, each terrace's floor and the grassy bank behind it,
        the hilltop, and a steep fall behind the crest that the eye never sees."""
        bm = bmesh.new()
        cols = []
        mats = []
        for i, x in enumerate(self.xs):
            g = self.ground[i]
            pts = [(0.0, g - 14.0)]
            kinds = []
            for k in range(self.n - 1, -1, -1):
                h = self.floor(k, x)
                d = self.front[k]
                pts.append((d, h))
                kinds.append("bank")
                pts.append((d + TERRACE, h))
                kinds.append("floor" if k < self.n - 1 else "bank")
            hp = self.plateau(x)
            pts.append((self.crest, hp))
            kinds.append("bank")
            pts.append((self.crest + PLATEAU, hp))
            kinds.append("crest")
            pts.append((self.crest + PLATEAU + 2.0, g - 30.0))
            kinds.append("bank")
            # Each point moved so that, sheared, it is drawn on this column.
            cols.append([bm.verts.new((x - KX * d, d, z)) for d, z in pts])
            mats = kinds
        # Faces wound so they look out of the hill: risers to the eye, floors up.
        for i in range(len(cols) - 1):
            a, b = cols[i], cols[i + 1]
            for j in range(len(a) - 1):
                f = bm.faces.new((a[j], b[j], b[j + 1], a[j + 1]))
                f.material_index = {"bank": 0, "floor": 1, "crest": 2}[mats[j]]
        me = bpy.data.meshes.new("hill")
        bm.to_mesh(me)
        bm.free()
        for m in (fk.grass, fk.soil, fk.track):
            me.materials.append(m)
        return bpy.data.objects.new("hill", me)


# ——— Crops ———

def _template(make) -> tuple[np.ndarray, list[tuple[int, ...]]]:
    bm = bmesh.new()
    make(bm)
    vs = np.array([v.co[:] for v in bm.verts], float)
    fs = [tuple(v.index for v in f.verts) for f in bm.faces]
    bm.free()
    return vs, fs


_SPHERES: dict[int, tuple[np.ndarray, list[tuple[int, ...]]]] = {}
_CIRCLES: dict[int, tuple[np.ndarray, list[tuple[int, ...]]]] = {}


def _sphere(segs: int):
    if segs not in _SPHERES:
        _SPHERES[segs] = _template(lambda bm: bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=max(4, segs // 2 + 1), radius=1.0))
    return _SPHERES[segs]


def _circle(segs: int):
    if segs not in _CIRCLES:
        _CIRCLES[segs] = _template(lambda bm: bmesh.ops.create_circle(bm, cap_ends=True, segments=segs, radius=1.0))
    return _CIRCLES[segs]


class Crops:
    """Plants gathered by part (stalks, heads, …) as plain vertex and face lists, each part
    made one object at the end: thousands of small shapes, built quickly."""

    def __init__(self) -> None:
        self.parts: dict[str, tuple[list[np.ndarray], list[tuple[int, ...]], list[int]]] = {}

    def _add(self, part: str, vs: np.ndarray, fs: list[tuple[int, ...]]) -> None:
        verts, faces, count = self.parts.setdefault(part, ([], [], [0]))
        base = count[0]
        verts.append(vs)
        faces.extend(tuple(i + base for i in f) for f in fs)
        count[0] += len(vs)

    def card(self, part: str, base: Vector, up: Vector, w: float, taper: float = 0.25) -> None:
        """A flat blade facing the eye, from base along up, w wide at the foot."""
        b, u = np.array(base[:]), np.array(up[:])
        side = np.array((w / 2, 0.0, 0.0))
        self._add(part, np.array([b - side, b + side, b + u + side * taper, b + u - side * taper]), [(0, 1, 2, 3)])

    def blob(self, part: str, centre: Vector, r: float, squash: float = 1.0, segs: int = 8) -> None:
        vs, fs = _sphere(segs)
        self._add(part, vs * np.array((r, r, r * squash)) + np.array(centre[:]), fs)

    def disc(self, part: str, centre: Vector, r: float, normal: Vector, segs: int = 12) -> None:
        vs, fs = _circle(segs)
        rot = np.array(normal.to_track_quat("Z", "Y").to_matrix())
        self._add(part, (vs * r) @ rot.T + np.array(centre[:]), fs)

    def objects(self, mats: dict[str, bpy.types.Material]) -> list[bpy.types.Object]:
        obs = []
        for part, (verts, faces, _) in self.parts.items():
            me = bpy.data.meshes.new(part)
            me.from_pydata(np.concatenate(verts).tolist(), [], faces)
            me.materials.append(mats[part])
            obs.append(bpy.data.objects.new(part, me))
        self.parts = {}
        return obs


def tuft(c: Crops, x: float, y: float, z: float, rng: np.random.Generator) -> None:
    """A clump of grass on a bank, sometimes with a flower in it."""
    for _ in range(rng.integers(3, 6)):
        up = Vector((rng.normal(0, 0.45), 0.0, 1.0)).normalized() * rng.uniform(1.6, 3.4)
        c.card("grass-blade", Vector((x + rng.uniform(-0.8, 0.8), y, z)), up, 0.4, 0.15)
    if rng.random() < 0.12:
        c.blob(f"flower-{rng.integers(0, 3)}", Vector((x + rng.uniform(-0.6, 0.6), y - 0.4, z + rng.uniform(2.0, 3.2))), 0.42, 1.0, 5)


def grow(c: Crops, crop: str, x: float, y: float, z: float, rng: np.random.Generator) -> None:
    """One plant of `crop` standing at (x, y, z)."""
    h = CROP * rng.uniform(0.86, 1.04)
    lean = lambda s: Vector((rng.normal(0, s), 0.0, 1.0))  # noqa: E731
    if crop in ("wheat", "barley", "oats"):
        for _ in range(rng.integers(3, 6)):
            bx = x + rng.uniform(-0.6, 0.6)
            up = lean(0.08).normalized() * h * rng.uniform(0.88, 1.0)
            base = Vector((bx, y + rng.uniform(-1.5, 1.5), z))
            c.card(f"{crop}-stalk", base, up, 0.22, 0.6)
            tip = base + up
            if crop == "wheat":
                c.card(f"{crop}-head", tip - up.normalized() * 1.6, up.normalized() * 2.0, 0.62, 0.45)
            elif crop == "barley":
                nod = Vector((rng.uniform(0.6, 1.2) * (1 if rng.random() < 0.5 else -1), 0, -0.5)).normalized()
                c.card(f"{crop}-head", tip, nod * 2.2, 0.55, 0.3)
            else:
                for _ in range(4):
                    d = Vector((rng.uniform(-1, 1), 0, rng.uniform(-1.4, -0.4))).normalized()
                    c.card(f"{crop}-head", tip + Vector((0, 0, -rng.uniform(0, 1.6))), d * 1.1, 0.32, 0.4)
    elif crop == "maize":
        base = Vector((x, y, z))
        up = lean(0.03).normalized() * (h * 1.08)
        c.card("maize-stalk", base, up, 0.55, 0.5)
        for k in range(4):
            at = base + up * rng.uniform(0.3, 0.8)
            s = 1 if k % 2 else -1
            d1 = Vector((s * rng.uniform(1.0, 1.6), 0, rng.uniform(0.5, 1.2))).normalized() * 2.4
            d2 = Vector((s * 1.6, 0, rng.uniform(-1.2, -0.3))).normalized() * 2.2
            c.card("maize-stalk", at, d1, 0.7, 0.6)
            c.card("maize-stalk", at + d1, d2, 0.45, 0.1)
        c.card("maize-head", base + up, Vector((0, 0, 1.4)), 0.5, 0.2)
    elif crop == "cabbage":
        r = rng.uniform(1.9, 2.5)
        for _ in range(5):
            a = rng.uniform(0, 2 * math.pi)
            c.blob("leaf-stalk", Vector((x + math.cos(a) * r * 0.9, y + math.sin(a) * r * 0.7, z + r * 0.55)), r * 0.95, 0.55, 8)
        c.blob("cabbage-head", Vector((x, y, z + 0.9 + r * 0.75)), r, 0.85, 10)
    elif crop == "potato":
        for _ in range(rng.integers(9, 14)):
            c.blob("potato-stalk", Vector((x + rng.uniform(-2.2, 2.2), y + rng.uniform(-1.4, 1.4), z + rng.uniform(1.2, 6.2))), rng.uniform(0.9, 1.4), 0.75, 6)
        for _ in range(rng.integers(0, 3)):
            c.blob("potato-bloom", Vector((x + rng.uniform(-1.6, 1.6), y - 1.4, z + rng.uniform(5.6, 7.0))), 0.5, 1.0, 5)
    elif crop == "sunflower":
        base = Vector((x, y, z))
        up = lean(0.02).normalized() * (h * 1.02)
        c.card("sunflower-stalk", base, up, 0.5, 0.6)
        for k in range(3):
            at = base + up * (0.3 + 0.2 * k)
            s = 1 if k % 2 else -1
            c.card("sunflower-stalk", at, Vector((s * 1.4, 0, 0.5)).normalized() * 2.0, 1.4, 0.2)
        face = Vector((rng.uniform(-0.2, 0.2), -1.0, 0.35)).normalized()
        centre = base + up + Vector((0, -0.3, 0.2))
        c.disc("sunflower-head", centre, 1.75, face, 16)
        c.disc("sunflower-seed", centre - face * 0.15, 0.95, face, 12)


CROP_MATS = {
    "wheat": ("wheat", "wheat"),
    "barley": ("barley", "barley"),
    "oats": ("oats", "oats"),
    "maize": ("maize", "maize"),
    "cabbage": ("cabbage", "cabbage"),
    "potato": ("potato", "potato"),
    "sunflower": ("sunflower", "sunflower"),
}
# Plants per unit along a row, and how many rows a terrace carries.
SPACING = {"wheat": 1.1, "barley": 1.1, "oats": 1.2, "maize": 2.2, "cabbage": 4.2, "potato": 3.4, "sunflower": 2.8}
LINES = {"wheat": 4, "barley": 4, "oats": 4, "maize": 3, "cabbage": 3, "potato": 3, "sunflower": 2}
CROPS = ["wheat", "cabbage", "barley", "maize", "oats", "potato", "sunflower"]


def _crop_materials(fk: FarmKit) -> dict[str, bpy.types.Material]:
    mats = {}
    for crop, (a, b) in fk.crop.items():
        mats[f"{crop}-stalk"] = a
        mats[f"{crop}-head"] = b
    mats["sunflower-seed"] = fk.seed
    mats["potato-bloom"] = fk.bloom
    mats["grass-blade"] = fk.blade
    for k, m in enumerate(fk.flowers):
        mats[f"flower-{k}"] = m
    return mats


def scarecrow(fk: FarmKit, x: float, y: float, z: float) -> list[bpy.types.Object]:
    """The critic: a scarecrow in a purple coat, keeping notes on a clipboard."""
    k = 1.3
    obs = [
        box("sc-pole", x - 1.0, x + 1.0, y - 1.0, y + 1.0, z, z + 46 * k, fk.timber),
        box("sc-arms", x - 16 * k, x + 16 * k, y - 0.9, y + 0.9, z + 33.4 * k, z + 35 * k, fk.timber),
        prism("sc-coat", [(x - 9 * k, z + 16 * k), (x + 9 * k, z + 16 * k), (x + 7 * k, z + 36 * k), (x - 7 * k, z + 36 * k)], y - 3.0, y + 3.0, fk.coat, 0.4),
        bar_xz("sc-sleeve-l", (x - 15 * k, z + 33 * k), (x - 6 * k, z + 34.5 * k), 4.6, y - 2.2, y + 2.2, fk.coat, 0.3),
        bar_xz("sc-sleeve-r", (x + 6 * k, z + 34.5 * k), (x + 15 * k, z + 33 * k), 4.6, y - 2.2, y + 2.2, fk.coat, 0.3),
        ball("sc-head", (x, y, z + 42 * k), 6.0, fk.straw),
        cylinder("sc-brim", x, y, z + 45 * k, z + 45 * k + 1.0, 9.0, 9.0, fk.hat, 24),
        cylinder("sc-crown", x, y, z + 45 * k + 1.0, z + 57 * k, 5.2, 0.6, fk.hat, 24),
        box("sc-board", x + 17, x + 26, y - 4.0, y - 3.0, z + 30, z + 43, fk.paper, 0.2),
        box("sc-clip", x + 20, x + 23, y - 4.4, y - 3.6, z + 41.5, z + 44, fk.iron),
    ]
    # Straw poking out at the cuffs and the hem.
    for sx in (-1, 1):
        for i in range(5):
            a = Vector((x + sx * (15.5 * k + i * 0.3), y - 1.0, z + 33 * k + i * 0.5))
            obs.append(rod(f"sc-straw{sx}{i}", tuple(a), tuple(a + Vector((sx * 2.2, 0, -1.2 + i * 0.5))), 0.25, fk.straw, 4))
    return obs


def chute(fk: FarmKit, hill: Hill, pts: list[float], x1: float, depth: float) -> list[bpy.types.Object]:
    """The trough the crates slide down, on posts, drawn along the site's own path."""
    path = [at_screen(pts[k], pts[k + 1], depth) for k in range(0, len(pts), 2)]
    obs = []
    for k in range(len(path) - 1):
        a, b = path[k], path[k + 1]
        lo_a, lo_b = (a[0], a[1] - 3.2), (b[0], b[1] - 3.2)
        obs.append(bar_xz(f"chute-front{k}", lo_a, lo_b, 8.6, depth - 4.0, depth - 3.0, fk.timber))
        obs.append(bar_xz(f"chute-back{k}", lo_a, lo_b, 8.6, depth + 3.0, depth + 4.0, fk.timber))
        obs.append(bar_xz(f"chute-floor{k}", (a[0], a[1] - 6.6), (b[0], b[1] - 6.6), 1.4, depth - 3.0, depth + 3.0, fk.timber))
    sx, sz = at_screen(0.0, 0.0, depth)
    for k in range(4, len(path) - 1, 5):
        px, pz = pts[2 * k], pts[2 * k + 1]
        foot = hill.at(hill.top, px) - 2 if px <= x1 else hill.at(hill.ground, px) - 2
        for dy in (-3.4, 3.4):
            obs.append(box(f"chute-post{k}{dy}", px + sx - 0.9, px + sx + 0.9, depth + dy - 0.9, depth + dy + 0.9, foot + sz, pz - 6 + sz, fk.pile))
    return obs


def build_fields(kit: Kit, s: dict):
    fk = farm_kit()
    p = s["p"]
    hill = Hill(p)
    obs = [hill.surface(fk)]
    rng = np.random.default_rng(17)
    c = Crops()
    for k, crop_k in enumerate(p["crops"]):
        crop = CROPS[crop_k]
        lines = LINES[crop]
        step = SPACING[crop]
        for j in range(lines):
            d = hill.front[k] + 2.0 + (TERRACE - 4.0) * (j + 0.5) / lines
            x = hill.xs[0] + rng.uniform(0, step)
            while x < hill.xs[-1]:
                if hill.planted(k, x):
                    dd = d + rng.uniform(-0.8, 0.8)
                    grow(c, crop, x - KX * dd, dd, hill.floor(k, x), rng)
                x += step * rng.uniform(0.8, 1.2)
    # Grass along the top of every bank, the part the eye sees between two rows.
    for k in range(hill.n):
        d = hill.front[k] - 0.6
        x = hill.xs[0] + rng.uniform(0, 1.4)
        while x < hill.xs[-1]:
            top = hill.floor(k, x)
            low = hill.floor(k + 1, x) if k + 1 < hill.n else top - 14
            if top - low > 1.0:
                tuft(c, x - KX * d, d, top - rng.uniform(0.0, min(6.5, top - low)), rng)
            x += rng.uniform(0.9, 1.9)
    obs += c.objects(_crop_materials(fk))
    sx, sb = p["scarecrow"]
    d = hill.front[1] + 4.0
    obs += scarecrow(fk, sx - KX * d, d, hill.floor(1, sx))
    obs += chute(fk, hill, p["chute"], float(hill.xs[-1]), hill.crest + 8.0)
    return obs, float(hill.ground.min()) - 14.0, {"px": 2.5, "shadow": False}


def ground_for_farm() -> list[bpy.types.Object]:
    """The fields' hill, bare, for a farm building to cast its shadows on: moved forward (and
    across and down, so it is drawn just where it was) until its hilltop lies under the
    building, whose front stands at depth 0."""
    p = next(s for s in ITEMS if s["kind"] == "fields")["p"]
    hill = Hill(p)
    ob = hill.surface(farm_kit())
    ob.data.transform(Matrix.Translation((KX * hill.crest, -hill.crest, KZ * hill.crest)))
    return [ob]


# ——— The barn ———

def build_barn(kit: Kit, s: dict):
    fk = farm_kit()
    p = s["p"]
    x, y, w, h = p["x"], p["y"], p["w"], p["h"]
    depth = 116.0
    cx = x + w / 2
    eave, knee, ridge = y + h, y + h + 30, y + h + 50
    obs = [
        box("plinth", x - 1.2, x + w + 1.2, -1.2, depth + 1.2, y - 3, y + 4, fk.stone, 0.3),
        box("walls", x, x + w, 0, depth, y + 4, eave, fk.red, 0.2),
        # The gambrel gable the front wall rises into.
        prism("gable", [(x, eave), (x + w, eave), (x + w - 20, knee - 2), (cx, ridge - 2), (x + 20, knee - 2)], 0, depth, fk.red),
    ]
    # The roof: four slopes of corrugated iron, standing a little proud of the gable.
    slope = [(x - 6, eave), (x + 20, knee), (cx, ridge), (x + w - 20, knee), (x + w + 6, eave)]
    for k in range(4):
        a, b = slope[k], slope[k + 1]
        dx, dz = b[0] - a[0], b[1] - a[1]
        n = math.hypot(dx, dz)
        nx, nz = -dz / n, dx / n
        if nz < 0:
            nx, nz = -nx, -nz
        th = 1.6
        strip = [(a[0], a[1]), (b[0], b[1]), (b[0] + nx * th, b[1] + nz * th), (a[0] + nx * th, a[1] + nz * th)]
        obs.append(prism(f"roof{k}", strip, -4.0, depth + 4.0, fk.roof, 0.1))
        obs.append(bar_xz(f"fascia{k}", a, b, 3.2, -4.6, -3.2, fk.white, 0.15))
    obs.append(bar_xz("ridge-cap", (cx - 4, ridge + 0.6), (cx + 4, ridge + 0.6), 2.2, -4.4, depth + 4.4, fk.galv, 0.2))
    # Corner boards, white.
    for x0, x1 in ((x - 0.4, x + 4), (x + w - 4, x + w + 0.4)):
        obs.append(box("corner", x0, x1, -0.8, 0.4, y + 4, eave, fk.white, 0.15))
    obs.append(box("corner-side", x + w - 0.4, x + w + 0.8, 0.0, depth, y + 4, y + 7, fk.white, 0.15))
    obs.append(box("corner-back", x + w - 0.4, x + w + 0.8, depth - 4, depth + 0.4, y + 4, eave, fk.white, 0.15))
    # The big doors: two X-braced leaves in a white frame, on a rail.
    obs.append(box("door-frame", cx - 29, cx + 29, -1.0, 0.4, y + 4, y + 52, fk.white, 0.15))
    for a, b in ((cx - 27, cx - 1.2), (cx + 1.2, cx + 27)):
        obs.append(box("door-leaf", a, b, -1.6, -0.6, y + 4, y + 50, fk.red_dark, 0.1))
        for u, v in (((a + 1.5, y + 5.5), (b - 1.5, y + 48.5)), ((a + 1.5, y + 48.5), (b - 1.5, y + 5.5))):
            obs.append(bar_xz("door-brace", u, v, 2.2, -2.2, -1.4, fk.white, 0.1))
        obs.append(box("door-rim", a, b, -2.2, -1.4, y + 47.5, y + 50, fk.white, 0.1))
        obs.append(box("door-rim", a, b, -2.2, -1.4, y + 4, y + 6.5, fk.white, 0.1))
    obs.append(box("door-rail", cx - 32, cx + 32, -2.6, -0.6, y + 52, y + 54, fk.iron, 0.2))
    # The hayloft door, with a hood and a hay beam over it.
    obs.append(box("loft-frame", cx - 10.5, cx + 10.5, -1.0, 0.4, eave + 5, eave + 27.5, fk.white, 0.15))
    obs.append(box("loft-door", cx - 9, cx + 9, -1.4, -0.4, eave + 6, eave + 26, fk.red_dark, 0.1))
    obs.append(bar_xz("loft-brace", (cx - 7.5, eave + 7.5), (cx + 7.5, eave + 24.5), 1.8, -2.0, -1.2, fk.white, 0.1))
    obs.append(prism("hood", [(cx - 12, eave + 29), (cx + 12, eave + 29), (cx, eave + 36)], -9.0, 0.5, fk.roof, 0.1))
    obs.append(box("hay-beam", cx - 1.2, cx + 1.2, -12.0, 0.4, eave + 28, eave + 30.4, fk.timber, 0.15))
    obs.append(rod("hay-rope", (cx, -11.0, eave + 28), (cx, -11.0, eave + 16), 0.25, fk.iron, 4))
    # The hatch the crates leave by.
    obs.append(box("hatch-frame", x + w - 11.5, x + w + 0.2, -1.0, 0.4, y + 10.5, y + 31.5, fk.white, 0.15))
    obs.append(box("hatch", x + w - 10, x + w - 1, -1.2, -0.2, y + 12, y + 30, fk.dark))
    # Windows down the side, and a cupola on the ridge.
    for k, d in enumerate((30.0, 58.0, 86.0)):
        obs.append(box(f"side-glass{k}", x + w - 0.3, x + w + 0.5, d - 5, d + 5, y + 22, y + 36, fk.glass, group="windows"))
        obs.append(box(f"side-frame{k}", x + w - 0.2, x + w + 1.0, d - 6.2, d + 6.2, y + 20.8, y + 37.2, fk.white, 0.1))
        obs.append(box(f"side-mullion{k}", x + w + 0.4, x + w + 1.1, d - 0.4, d + 0.4, y + 22, y + 36, fk.white))
        obs.append(box(f"side-transom{k}", x + w + 0.4, x + w + 1.1, d - 5, d + 5, y + 28.6, y + 29.4, fk.white))
    cd = depth / 2
    obs.append(box("cupola", cx - 6, cx + 6, cd - 6, cd + 6, ridge - 4, ridge + 9, fk.white, 0.2))
    for i in range(4):
        obs.append(box(f"louvre{i}", cx - 4.5, cx + 4.5, cd - 6.4, cd - 5.8, ridge + 1 + i * 1.8, ridge + 2.0 + i * 1.8, fk.dark))
    obs.append(prism("cupola-roof", [(cx - 8, ridge + 9), (cx + 8, ridge + 9), (cx, ridge + 15)], cd - 8, cd + 8, fk.roof, 0.1))
    obs.append(rod("vane-rod", (cx, cd, ridge + 15), (cx, cd, ridge + 24), 0.3, fk.iron, 6))
    obs.append(prism("vane", [(cx - 6, ridge + 21.2), (cx + 4, ridge + 21.2), (cx + 6, ridge + 22.0), (cx + 4, ridge + 22.8), (cx - 6, ridge + 22.8), (cx - 4.6, ridge + 22.0)], cd - 0.2, cd + 0.2, fk.iron))
    return obs, y, {"ground": ground_for_farm}


# ——— The silo ———

def build_silo(kit: Kit, s: dict):
    fk = farm_kit()
    p = s["p"]
    x, y, w, h = p["x"], p["y"], p["w"], p["h"]
    # Round, so seen obliquely it is a little wider than it is: this radius fills the painted width.
    r = (w / 2) / math.hypot(1.0, KX)
    yc = r + 4.0
    ax = x + w / 2 - KX * yc
    sh = Shader("silo-staves")
    c = lin("#cfc9bf")
    st = sh.n("ShaderNodeTexBrick")
    st.inputs["Color1"].default_value = (*c, 1)
    st.inputs["Color2"].default_value = (*darker(c, 0.9), 1)
    st.inputs["Mortar"].default_value = (*darker(c, 0.75), 1)
    st.inputs["Scale"].default_value = 1.0
    st.inputs["Mortar Size"].default_value = 0.04
    st.inputs["Brick Width"].default_value = 3.0
    st.inputs["Row Height"].default_value = 2.4
    sh.link(sh.round_uv(ax, yc, r), st.inputs["Vector"])
    col = sh.mix(sh.ramp(sh.noise(0.08, 4, vec=sh.mapping((1.0, 1.0, 0.2))), 0.4, 0.75), st.outputs["Color"], lin("#a59e92"))
    staves = sh.surface(col, 0.85, bump=st.outputs["Fac"], strength=0.4)
    obs = [
        cylinder("footing", ax, yc, y - 3, y + 3, r + 2.0, r + 2.0, fk.stone, 64),
        cylinder("silo", ax, yc, y + 3, y + h, r, r, staves, 64),
    ]
    for k, yy in enumerate(range(int(y + 20), int(y + h), 20)):
        obs.append(ring(f"hoop{k}", ax, yc, yy, yy + 1.6, r + 0.35, fk.galv, 64))
    rd = (w / 2 + 2) / math.hypot(1.0, KX)
    obs.append(cylinder("rim", ax, yc, y + h - 0.6, y + h + 1.0, rd + 0.4, rd + 0.4, fk.galv, 64))
    obs.append(dome("dome", ax, yc, y + h + 1.0, rd, ribbed_dome("silo-dome", ax, yc, "#b9bdbf", "#8e9396", 24, 0.7)))
    obs.append(cylinder("vent", ax, yc, y + h + rd - 1, y + h + rd + 3.5, 2.2, 2.2, fk.galv, 16))
    obs.append(cylinder("vent-cap", ax, yc, y + h + rd + 3.5, y + h + rd + 5.5, 3.4, 0.5, fk.galv, 16))
    # The ladder up its left side, where the site's climber goes, in a cage of hoops.
    ld = yc - r * 0.2
    lx = x - 4.5 - KX * ld
    lz = -KZ * ld
    for dx in (-2.5, 2.5):
        obs.append(box(f"rail{dx}", lx + dx - 0.4, lx + dx + 0.4, ld - 0.4, ld + 0.4, y + lz, y + h + lz + 2, fk.iron))
    for i, yy in enumerate(np.arange(y + 6, y + h, 7.0)):
        obs.append(box(f"rung{i}", lx - 2.5, lx + 2.5, ld - 0.25, ld + 0.25, yy + lz, yy + 0.6 + lz, fk.iron))
    for i, yy in enumerate(np.arange(y + 40, y + h, 12.0)):
        obs.append(ring(f"cage{i}", lx - 1.0, ld - 0.5, yy + lz, yy + 0.6 + lz, 4.2, fk.iron, 16))
    return obs, y, {"ground": ground_for_farm}


# ——— The windmill and its sails ———

def build_mill(kit: Kit, s: dict):
    fk = farm_kit()
    p = s["p"]
    x, base, h, half, top = p["x"], p["base"], p["h"], p["half"], p["top"]
    r0, r1 = half / math.hypot(1.0, KX), top / math.hypot(1.0, KX)
    yc = r0 + 3.0
    ax = x - KX * yc
    radius = lambda z: r0 + (r1 - r0) * (z - base) / h  # noqa: E731
    obs = [
        cylinder("base", ax, yc, base - 4, base + 20, r0 + 2.5, r0 + 1.6, fk.stone, 8),
        cylinder("tower", ax, yc, base + 20, base + h, radius(base + 20), r1, fk.mill, 8),
    ]
    # Rotate the octagon so a face, not an edge, looks out.
    for ob in obs:
        ob.data.transform(Matrix.Translation((ax, yc, 0)) @ Matrix.Rotation(math.pi / 8, 4, "Z") @ Matrix.Translation((-ax, -yc, 0)))
    th = math.atan2(-1.0, KX)
    turn = th + math.pi / 2
    scale = 1 / (-math.sin(th) + KX * math.cos(th))

    def on(zs: float, out: float) -> tuple[float, float, float]:
        rr = radius(zs) * math.cos(math.pi / 8) + out
        px, py = ax + rr * math.cos(th), yc + rr * math.sin(th)
        return px, py, zs - KZ * py

    obs.append(obox("door-frame", on(base + 10, 0.6), (15 * scale, 1.6, 22), turn, fk.timber, 0.2))
    obs.append(obox("door", on(base + 9.5, 1.2), (11 * scale, 1.0, 19), turn, fk.dark))
    for k, (zc, hw, hh) in enumerate(((base + 63, 4, 10), (base + 102.5, 3, 9))):
        obs.append(obox(f"win-frame{k}", on(zc, 0.6), ((2 * hw + 3) * scale, 1.6, hh + 3), turn, fk.white, 0.2))
        obs.append(obox(f"win{k}", on(zc, 1.2), (2 * hw * scale, 1.0, hh), turn, fk.glass, group="windows"))
    # The stage round the top, on brackets, with a rail.
    zs = base + h - 4
    obs.append(cylinder("stage", ax, yc, zs, zs + 2.0, r1 + 7.0, r1 + 7.0, fk.timber, 24))
    for i in range(16):
        a = 2 * math.pi * i / 16
        obs.append(cylinder(f"stage-post{i}", ax + (r1 + 6.4) * math.cos(a), yc + (r1 + 6.4) * math.sin(a), zs + 2.0, zs + 7.0, 0.35, 0.35, fk.timber, 6))
        obs.append(rod(f"bracket{i}", (ax + r1 * math.cos(a), yc + r1 * math.sin(a), zs - 6), (ax + (r1 + 6) * math.cos(a), yc + (r1 + 6) * math.sin(a), zs), 0.4, fk.timber, 4))
    obs.append(ring("stage-rail", ax, yc, zs + 6.4, zs + 7.2, r1 + 6.4, fk.timber, 24))
    # The cap, its windshaft out to the sails' hub (drawn where the site turns them).
    zc = base + h
    obs.append(cylinder("curb", ax, yc, zc, zc + 2.0, r1 + 1.2, r1 + 1.2, fk.timber, 24))
    obs.append(cylinder("cap", ax, yc, zc + 2.0, zc + 26.0, r1 + 7.0, 0.8, fk.mill_cap, 32))
    obs.append(ball("finial", (ax, yc, zc + 27.0), 1.6, fk.white))
    hub_d = yc - r1 - 9.0
    hx, hz = at_screen(x, base + h + 6, hub_d)
    obs.append(rod("windshaft", (hx, yc - r1 * 0.4, hz), (hx, hub_d, hz), 2.2, fk.timber, 12))
    return obs, base, {"ground": ground_for_farm}


def build_sails(kit: Kit, s: dict):
    """The four sails, square on to the eye round the hub, which the site turns: the frame is
    centred on the hub, and the suns' light is evened out so it reads at any angle."""
    fk = farm_kit()
    p = s["p"]
    hx, hy, sail = p["x"], p["y"], p["sail"]
    d = -12.0
    cx, cz = at_screen(hx, hy, d)
    obs = []
    for k in range(4):
        a = k * math.pi / 2
        ca, sa = math.cos(a), math.sin(a)
        pt = lambda r, off: (cx + ca * r - sa * off, cz + sa * r + ca * off)  # noqa: E731
        # The whip, out from the hub, tapering.
        obs.append(prism(f"whip{k}", [pt(0, -2.4), pt(sail, -1.4), pt(sail, 1.4), pt(0, 2.4)], d - 1.4, d + 1.4, fk.timber, 0.15))
        # Canvas behind the lattice.
        obs.append(prism(f"cloth{k}", [pt(16, 2.4), pt(sail - 1, 2.4), pt(sail - 1, 19.5), pt(22, 17)], d + 0.6, d + 1.0, fk.canvas))
        # The lattice: bars across, a hemlath along the edge.
        r = 26.0
        while r < sail:
            obs.append(bar_xz(f"bar{k}-{int(r)}", pt(r, 2.4), pt(r, 19.6), 1.1, d - 0.6, d + 0.6, fk.timber))
            r += 12.0
        obs.append(bar_xz(f"hemlath{k}", pt(16, 19.6), pt(sail, 19.6), 1.4, d - 0.7, d + 0.7, fk.timber))
        obs.append(bar_xz(f"inner{k}", pt(16, 2.6), pt(sail, 2.6), 0.9, d - 0.5, d + 0.5, fk.timber))
    obs.append(disc_y("hub-boss", cx, cz, d - 3.0, d + 1.5, 6.5, fk.timber, 24))
    obs.append(disc_y("hub-cap", cx, cz, d - 3.8, d - 2.8, 3.0, fk.iron, 16))
    m = sail + 24.0
    frame = {"x0": hx - m, "x1": hx + m, "y0": hy - m, "y1": hy + m}
    return obs, hy - m, {"frame": frame, "shadow": False, "even": True}


# ——— The dock ———

def build_dock(kit: Kit, s: dict):
    """A timber pier on the far bank: its deck seen from above as it runs from the bank out
    over the water, its front edge where the site paints it, piles down into the river."""
    fk = farm_kit()
    p = s["p"]
    x0, x1, top = p["x0"], p["x1"], p["top"]
    # Deep enough that the crates the site sets on it, and its inspector, stand on its boards.
    depth = 20.0 / KZ
    zd = top - 12.0
    water = zd - 5.0
    obs = [box("beam-front", x0, x1, -0.6, 2.4, zd - 3.2, zd - 0.6, fk.pile, 0.2)]
    # Boards across the pier, front to back, with gaps between.
    yy = 0.4
    k = 0
    while yy < depth - 0.5:
        obs.append(box(f"board{k}", x0, x1, yy, yy + 2.1, zd - 0.6, zd + 0.5, fk.deck, 0.08))
        yy += 2.4
        k += 1
    for px in (x0 + 6, x0 + 40, x0 + 74, x1 - 6):
        obs.append(cylinder(f"pile{px:.0f}", px, 2.0, water - 1.0, zd + 1.4, 1.7, 1.7, fk.pile, 12))
        obs.append(cylinder(f"pile-back{px:.0f}", px, depth - 2.0, water - 1.0, zd - 0.6, 1.7, 1.7, fk.pile, 12))
    obs.append(box("beam-side", x1 - 0.6, x1 + 0.6, 0.0, depth, zd - 3.2, zd - 0.6, fk.pile, 0.2))
    obs.append(cylinder("bollard", x1 - 8.5, 5.0, zd + 0.5, zd + 6.0, 1.9, 1.7, fk.iron, 16))
    obs.append(ball("bollard-top", (x1 - 8.5, 5.0, zd + 6.2), 2.1, fk.iron))
    obs.append(ring("rope", x1 - 8.5, 5.0, zd + 2.4, zd + 3.4, 2.15, fk.straw, 16))
    return obs, water, {"shadow": False}


BUILDERS = {
    "fields": build_fields,
    "barn": build_barn,
    "silo": build_silo,
    "mill": build_mill,
    "sails": build_sails,
    "dock": build_dock,
}
