"""
The proving grounds (scene "learners"), modelled from the numbers the site draws them with
(src/world/scenery/provingLayout.ts): the gorge (its back wall and the two shoulders the
trail runs over), the arch bridge (its two missing planks a render of their own, which the
scene shows once they are mended), the carved owl on its post, the grader's desk and lamp,
and the flags along the trail.

The rock is a grid laid over the painted outline in screen space and pushed back and forth
in depth, so it has real relief for the low suns to catch while its outline, where the
learners walk, stays exactly where the site draws it.
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
    ball,
    bar_xz,
    box,
    cylinder,
    darker,
    disc_y,
    glass,
    lin,
    paint,
    prism,
    rod,
    stone,
    wood,
)


# ——— Noise, for the rock ———

def _hash(ix: np.ndarray, iy: np.ndarray, seed: int) -> np.ndarray:
    h = (ix * 374761393 + iy * 668265263 + seed * 1013904223) & 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((h ^ (h >> 16)) & 0xFFFF) / 65535.0


def _value(x: np.ndarray, y: np.ndarray, seed: int) -> np.ndarray:
    ix, iy = np.floor(x).astype(np.int64), np.floor(y).astype(np.int64)
    fx, fy = x - ix, y - iy
    u, v = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    a, b = _hash(ix, iy, seed), _hash(ix + 1, iy, seed)
    c, d = _hash(ix, iy + 1, seed), _hash(ix + 1, iy + 1, seed)
    return (a + (b - a) * u) + ((c + (d - c) * u) - (a + (b - a) * u)) * v


def fbm2(x: np.ndarray, y: np.ndarray, octaves: int = 5, seed: int = 1) -> np.ndarray:
    """Fractal value noise in [0, 1]."""
    total, amp, freq, norm = 0.0, 0.5, 1.0, 0.0
    for o in range(octaves):
        total = total + amp * _value(x * freq, y * freq, seed + o)
        norm += amp
        amp *= 0.5
        freq *= 2.0
    return total / norm


# ——— Materials ———

def rock(name: str, colour: str = "#7a6c5f") -> bpy.types.Material:
    """Bedded rock: layers along the face, weathered paler in patches, lichen in places."""
    s = Shader(name)
    c = lin(colour)
    # Beds a few units thick, running along the face, each its own shade.
    beds = s.noise(0.04, 2, 0.4, vec=s.mapping((0.08, 0.08, 1.0)))
    col = s.mix(s.ramp(beds, 0.3, 0.7), darker(c, 0.7), c)
    # Paler where it has weathered, in broad patches; darker streaks run down from ledges.
    col = s.mix(s.op("MULTIPLY", s.ramp(s.noise(0.045, 3), 0.55, 0.75), 0.7), col, lin("#9a8e80"))
    col = s.mix(s.op("MULTIPLY", s.ramp(s.noise(0.09, 3, vec=s.mapping((1.0, 1.0, 0.15))), 0.62, 0.75), 0.5), col, darker(c, 0.55))
    col = s.mix(s.op("MULTIPLY", s.ramp(s.noise(0.12, 3), 0.72, 0.8), 0.45), col, lin("#6d7550"))
    return s.surface(col, 0.92, bump=s.noise(0.9, 4, 0.5), strength=0.35)


def trail(name: str, front: float, depth: float) -> bpy.types.Material:
    """The top of a shoulder: grass, with the trail worn bare along its middle."""
    s = Shader(name)
    g = lin("#6b7a3d")
    grass = s.mix(s.ramp(s.noise(0.25, 5), 0.35, 0.7), darker(g, 0.75), g)
    back = s.op("SUBTRACT", s.axis("Y"), front)
    path = s.op("MULTIPLY", s.ramp(back, depth * 0.22, depth * 0.34), s.op("SUBTRACT", 1.0, s.ramp(back, depth * 0.62, depth * 0.76)))
    path = s.op("MULTIPLY", path, s.ramp(s.noise(0.3, 3), 0.25, 0.45))
    col = s.mix(path, grass, lin("#86705a"))
    return s.surface(col, 0.95, bump=s.noise(1.3, 4), strength=0.4)


def carved(name: str, colour: str) -> bpy.types.Material:
    """Carved wood: one block, its grain in fine wavy lines, darker in the hollows."""
    s = Shader(name)
    c = lin(colour)
    grain = s.n("ShaderNodeTexWave")
    grain.wave_type = "RINGS"
    grain.inputs["Scale"].default_value = 0.35
    grain.inputs["Distortion"].default_value = 6.0
    grain.inputs["Detail"].default_value = 3.0
    s.link(s.coord.outputs["Object"], grain.inputs["Vector"])
    col = s.mix(s.ramp(grain.outputs["Fac"], 0.3, 0.8), darker(c, 0.78), c)
    col = s.mix(s.op("MULTIPLY", s.ramp(s.noise(0.15, 3), 0.55, 0.8), 0.5), col, darker(c, 0.6))
    return s.surface(col, 0.7, bump=grain.outputs["Fac"], strength=0.2)


class ProvingKit:
    def __init__(self) -> None:
        self.rock = rock("gorge-rock")
        self.rock_dark = rock("gorge-rock-dark", "#5e544c")
        self.timber = wood("bridge-timber", "#7a5233", 2.4, vertical=False)
        self.plank = wood("bridge-plank", "#8a6340", 2.0)
        self.post = wood("post", "#6a4a30", 1.6)
        self.carved = carved("owl-wood", "#8a6a4f")
        self.carved_light = carved("owl-face", "#b8986f")
        self.socket = paint("owl-socket", "#2b221c", 0.9)
        self.beak = paint("owl-beak", "#c9a35a", 0.6)
        self.iron = paint("proving-iron", "#2e3034", 0.5, 0.6)
        self.brass = paint("proving-brass", "#a8824c", 0.35, 0.8)
        self.lantern = glass("lantern", "#ffd27a", 6.0)
        self.cloth = paint("pennant", "#e8c95a", 0.8)
        self.paper = paint("proving-paper", "#f2ece0", 0.7)
        self.desk = wood("desk", "#7a5233", 1.6)
        self.desk_top = wood("desk-top", "#5f3f27", 1.2, vertical=False)
        self.stone = stone("abutment", "#8a8078", 3.0)


_KIT: ProvingKit | None = None


def proving_kit() -> ProvingKit:
    global _KIT
    if _KIT is None:
        _KIT = ProvingKit()
    return _KIT


# ——— The gorge ———

def rock_face(name: str, xs: np.ndarray, tops: np.ndarray, bottom: float, front: float, relief: float, mat, seed: int, top_depth: float = 0.0, top_mat=None) -> list[bpy.types.Object]:
    """A face of rock over the outline (xs, tops) down to `bottom`, seen from the front: a grid
    in screen space whose points are pushed toward the eye by up to `relief`, each moved
    across and down so it is still drawn where it was. With `top_depth`, a flat top runs back
    from its upper edge that far (and `top_mat` covers it)."""
    rows = 64
    v = np.linspace(0.0, 1.0, rows + 1)
    X = np.repeat(xs[:, None], rows + 1, 1)
    Z = bottom + (tops[:, None] - bottom) * v[None, :]
    bulge = fbm2(X / 22.0, Z / 22.0, 5, seed) * 0.75 + fbm2(X / 6.0, Z / 6.0, 3, seed + 9) * 0.25
    # Softer at the very top edge, so the outline is the painted one.
    edge = np.clip((tops[:, None] - Z) / 6.0, 0.0, 1.0)
    D = front - relief * bulge * (0.35 + 0.65 * edge)
    WX, WZ = X - KX * D, Z - KZ * D
    nx, nz = X.shape
    verts = np.stack([WX, D, WZ], -1).reshape(-1, 3)
    faces = []
    for i in range(nx - 1):
        for j in range(nz - 1):
            a = i * nz + j
            faces.append((a, a + nz, a + nz + 1, a + 1))
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts.tolist(), [], faces)
    me.shade_smooth()
    me.materials.append(mat)
    obs = [bpy.data.objects.new(name, me)]
    if top_depth > 0:
        # The top: level, from the face's upper edge back.
        steps = 6
        tv = []
        for i in range(nx):
            d0 = D[i, -1]
            z = Z[i, -1] - KZ * d0
            for k in range(steps + 1):
                d = d0 + (front + top_depth - d0) * k / steps
                tv.append((X[i, -1] - KX * d, d, z))
        tf = []
        for i in range(nx - 1):
            for k in range(steps):
                a = i * (steps + 1) + k
                tf.append((a, a + steps + 1, a + steps + 2, a + 1))
        tm = bpy.data.meshes.new(name + "-top")
        tm.from_pydata(tv, [], tf)
        tm.materials.append(top_mat or mat)
        obs.append(bpy.data.objects.new(name + "-top", tm))
    return obs


def build_wall(kit: Kit, s: dict):
    pk = proving_kit()
    p = s["p"]
    xs, tops = np.array(p["xs"]), np.array(p["top"])
    obs = rock_face("wall", xs, tops, p["bottom"], 80.0, 14.0, pk.rock_dark, 3)
    return obs, p["bottom"], {"shadow": False}


SHOULDER_TOP = 6.0 / KZ


def build_shoulders(kit: Kit, s: dict):
    pk = proving_kit()
    p = s["p"]
    front = 20.0
    top = trail("trail", front, SHOULDER_TOP)
    obs = []
    for k, side in enumerate(("left", "right")):
        xs, tops = np.array(p[side]), np.array(p[side + "Top"])
        obs += rock_face(f"shoulder-{side}", xs, tops, p["bottom"], front, 9.0, pk.rock, 11 + k, SHOULDER_TOP, top)
    return obs, p["bottom"], {"shadow": False}


# ——— The bridge ———

def build_bridge(kit: Kit, s: dict):
    """A timber footbridge on a gentle arch: planks across two arched stringers, a post at
    each corner, and a handrail on either side over its balusters. The fix is just the two
    planks the scene lays when the bridge is mended."""
    pk = proving_kit()
    p = s["p"]
    left, right, deck_y, arch, S = p["left"], p["right"], p["deckY"], p["arch"], p["scale"]
    span = right - left
    deck = lambda x: deck_y + math.sin(math.pi * (x - left) / span) * arch  # noqa: E731
    width = 26.0
    obs = []
    w = span / 8 - 2
    for k in p["planks"]:
        px = left + (k + 0.5) * span / 8
        a, b = px - w / 2, px + w / 2
        outline = [(a, deck(a) - 3.0), (b, deck(b) - 3.0), (b, deck(b) + 0.6), (a, deck(a) + 0.6)]
        obs.append(prism(f"plank{k}", outline, -1.0, width + 1.0, pk.plank, 0.25))
        # A nail at each end, into the stringer under it.
        for u in (a + 1.2, b - 1.8):
            obs.append(box(f"nail{k}-{u:.0f}", u, u + 0.6, -1.15, -0.9, deck(u) - 0.9, deck(u) - 0.3, pk.iron))
    if p.get("fix"):
        return obs, deck_y - 6, {"shadow": False}
    # Two arched stringers under the planks.
    n = 24
    xs = [left - 6 + (span + 12) * i / n for i in range(n + 1)]
    for depth0, depth1, nm in ((-2.4, 1.0, "front"), (width - 1.0, width + 2.4, "back")):
        for i in range(n):
            a, b = xs[i], xs[i + 1]
            obs.append(bar_xz(f"stringer-{nm}{i}", (a, deck(min(max(a, left), right)) - 6.0), (b, deck(min(max(b, left), right)) - 6.0), 6.0, depth0, depth1, pk.timber))
    # Posts at the four corners, standing on stone abutments.
    for x in (left - 3.0, right + 3.0):
        obs.append(box("abutment", x - 10, x + 10, -6.0, width + 6.0, deck_y - 26.0, deck_y - 6.0, pk.stone, 0.4))
        for d in (-1.5, width + 1.5):
            obs.append(box("post", x - 2.7, x + 2.7, d - 2.7, d + 2.7, deck_y - 6.0, deck_y + 32.0, pk.post, 0.3))
            obs.append(box("post-cap", x - 3.4, x + 3.4, d - 3.4, d + 3.4, deck_y + 32.0, deck_y + 34.0, pk.timber, 0.3))
            obs.append(ball("post-knob", (x, d, deck_y + 35.6), 2.0, pk.timber))
    # The handrails over their balusters, front and back, following the arch.
    rail = lambda x: deck(min(max(x, left), right)) + 15.5 * S  # noqa: E731
    pts = [left + span * i / 16 for i in range(17)]
    for d, nm in ((0.0, "front"), (width, "back")):
        for i in range(16):
            obs.append(bar_xz(f"rail-{nm}{i}", (pts[i], rail(pts[i])), (pts[i + 1], rail(pts[i + 1])), 2.6, d - 1.4, d + 1.4, pk.timber))
        for k in range(1, 8):
            x = left + k * span / 8
            obs.append(box(f"baluster-{nm}{k}", x - 1.4, x + 1.4, d - 1.0, d + 1.0, deck(x) + 0.6, rail(x) - 1.0, pk.post))
        # Between each pair of balusters, braces up to the rail and down again.
        for k in range(8):
            x0, x1 = left + k * span / 8, left + (k + 1) * span / 8
            mid = (x0 + x1) / 2
            obs.append(bar_xz(f"x-{nm}{k}a", (x0 + 1.4, deck(x0) + 1.5), (mid, rail(mid) - 2.5), 0.9, d - 0.6, d + 0.6, pk.post))
            obs.append(bar_xz(f"x-{nm}{k}b", (mid, rail(mid) - 2.5), (x1 - 1.4, deck(x1) + 1.5), 0.9, d - 0.6, d + 0.6, pk.post))
    return obs, deck_y - 26.0, {"shadow": False}


# ——— The owl ———

def ellipsoid(name: str, at: tuple[float, float, float], r: tuple[float, float, float], mat, segs: int = 24) -> bpy.types.Object:
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=segs // 2, radius=1.0)
    for v in bm.verts:
        v.co = Vector((at[0] + v.co.x * r[0], at[1] + v.co.y * r[1], at[2] + v.co.z * r[2]))
    return _object(name, bm, mat)


def build_owl(kit: Kit, s: dict):
    """The owl that watches every stage: carved from one log on top of its post. Its eyes are
    the site's, so they can blink and glow; here they are two dark sockets."""
    pk = proving_kit()
    p = s["p"]
    x, y, S = p["x"], p["y"], p["scale"]
    yc = 9.0 * S
    at = lambda u, v, d=0.0: (x + u * S - KX * (yc + d), yc + d, y + v * S - KZ * (yc + d))  # noqa: E731
    obs = [
        box("post", at(-2.2, 0)[0], at(2.2, 0)[0], yc - 2.2 * S, yc + 2.2 * S, at(0, -2)[2], at(0, 40)[2], pk.post, 0.4),
        ellipsoid("body", at(0, 52), (10.6 * S, 8.4 * S, 13.4 * S), pk.carved),
        ellipsoid("breast", at(0, 50, -4.0 * S), (6.6 * S, 4.6 * S, 9.8 * S), pk.carved_light),
        ellipsoid("wing-l", at(-8.4, 53, 0.5 * S), (3.4 * S, 6.6 * S, 10.6 * S), pk.carved),
        ellipsoid("wing-r", at(8.4, 53, 0.5 * S), (3.4 * S, 6.6 * S, 10.6 * S), pk.carved),
        ellipsoid("head", at(0, 68), (9.6 * S, 8.4 * S, 8.6 * S), pk.carved),
        ellipsoid("face", at(0, 68, -4.6 * S), (7.6 * S, 4.4 * S, 6.6 * S), pk.carved_light),
    ]
    for sx in (-1, 1):
        base = Vector(at(sx * 5.6, 73.5))
        tip = Vector(at(sx * 8.4, 82.0))
        obs.append(rod(f"ear{sx}", tuple(base), tuple(tip), 2.0 * S, pk.carved, 8))
        eye = at(sx * 3.6, 69, -8.8 * S)
        obs.append(disc_y(f"socket{sx}", eye[0], eye[2], yc - 9.4 * S, yc - 8.2 * S, 3.4 * S, pk.socket, 20))
        # Talons over the edge of the post.
        for k in range(3):
            obs.append(ball(f"talon{sx}{k}", at(sx * (1.4 + k * 1.3), 40.6, -2.2 * S), 0.9 * S, pk.beak))
    beak = Vector(at(0, 64.5, -9.0 * S))
    obs.append(rod("beak", tuple(beak + Vector((0, 1.0 * S, 1.6 * S))), tuple(beak + Vector((0, -1.6 * S, -1.4 * S))), 1.3 * S, pk.beak, 8))
    return obs, y


# ——— The grader's desk and lamp, and the flags ———

def build_desk(kit: Kit, s: dict):
    pk = proving_kit()
    p = s["p"]
    x, y, S = p["x"], p["y"], p["scale"]
    w, h, d = 26 * S, 13 * S, 20.0
    obs = [
        box("desk", x - w / 2, x + w / 2, 0.0, d, y, y + h - 1.0, pk.desk, 0.3),
        box("desk-top", x - 15 * S, x + 15 * S, -2.0, d + 2.0, y + h - 1.0, y + h + 1.4 * S, pk.desk_top, 0.4),
        box("panel-l", x - w / 2 + 3, x - 1.5, -0.6, 0.4, y + 3, y + h - 4, pk.desk_top, 0.2),
        box("panel-r", x + 1.5, x + w / 2 - 3, -0.6, 0.4, y + 3, y + h - 4, pk.desk_top, 0.2),
        box("papers", x - 8, x + 4, 5.0, 14.0, y + h + 1.4 * S, y + h + 1.4 * S + 2.0, pk.paper, 0.2),
        cylinder("ink", x + 9, 9.0, y + h + 1.4 * S, y + h + 1.4 * S + 3.0, 1.6, 1.4, pk.iron, 12),
    ]
    return obs, y


def build_lamp(kit: Kit, s: dict):
    pk = proving_kit()
    p = s["p"]
    x, y, S = p["x"], p["y"], p["scale"]
    d = 6.0
    lx = x - KX * d
    lz = -KZ * d
    top = y + 33 * S + lz
    obs = [
        cylinder("base", lx, d, y + lz, y + 2.4 + lz, 3.6, 3.0, pk.iron, 16),
        cylinder("pole", lx, d, y + 2.4 + lz, top, 0.9, 0.7, pk.iron, 10),
        cylinder("lantern-base", lx, d, top, top + 1.2, 3.4, 3.4, pk.iron, 12),
        cylinder("lantern", lx, d, top + 1.2, top + 7.6, 2.8, 2.8, pk.lantern, 12, group="windows"),
        cylinder("lantern-cap", lx, d, top + 7.6, top + 10.6, 3.8, 0.4, pk.iron, 12),
        ball("lantern-ring", (lx, d, top + 11.2), 0.8, pk.iron),
    ]
    return obs, y + lz


def build_flag(kit: Kit, s: dict):
    pk = proving_kit()
    p = s["p"]
    x, y, S = p["x"], p["y"], p["scale"]
    tip = y + 34 * S
    obs = [
        cylinder("pole", x, 1.2, y, tip + 1.0, 1.3, 1.0, pk.post, 10),
        ball("finial", (x, 1.2, tip + 2.0), 1.4, pk.brass),
    ]
    # The pennant, a little wavy, out to the right from the pole's top.
    n = 8
    bm = bmesh.new()
    top, bot = [], []
    for i in range(n + 1):
        u = i / n
        px = x + 1.0 + u * 16 * S
        wave = math.sin(u * math.pi * 1.6) * 1.6 * u
        half = (1 - u) * 5 * S
        mid = tip - 5 * S
        top.append(bm.verts.new((px, 1.2 + wave, mid + half)))
        bot.append(bm.verts.new((px, 1.2 + wave, mid - half)))
    for i in range(n):
        bm.faces.new((bot[i], bot[i + 1], top[i + 1], top[i]))
    obs.append(_object("pennant", bm, pk.cloth))
    return obs, y


BUILDERS = {
    "gorge-wall": build_wall,
    "gorge-shoulders": build_shoulders,
    "bridge": build_bridge,
    "owl": build_owl,
    "desk": build_desk,
    "lamp": build_lamp,
    "flag": build_flag,
}
