"""
The council town (scene "councils"): one building per council of agents, modelled from the
numbers the site paints them with (src/world/scenery/councilsLayout.ts).

The site draws the people at work behind every window over the render, at exactly the
windows' rectangles; so a window here is its glass, the frame standing out round it and a
sill, all kept outside that rectangle, and the room is left to the site. A storey set back
from the facade is moved so that, seen in the oblique view, its front still stands where the
painted one does, and its windows with it.
"""
from __future__ import annotations

import math

import bpy
import bmesh
from mathutils import Matrix, Vector

from structures_kit import (
    KX,
    KZ,
    Kit,
    _object,
    ashlar,
    at_screen,
    ball,
    box,
    brick,
    corrugated,
    cylinder,
    disc_y,
    dome,
    glass,
    obox,
    paint,
    plaster,
    prism,
    pyramid,
    ring,
    rod,
    stone,
    tiles,
    verdigris,
)


class CouncilKit:
    """The town's materials, made once (after the scene is set up)."""

    def __init__(self) -> None:
        self.limestone = ashlar("limestone", "#ddd2bf", 7.0, 3.4)
        self.ashlar = ashlar("ashlar-warm", "#e6dbc8", 9.0, 3.6)
        self.marble = paint("marble", "#efe9df", 0.45)
        self.trim = stone("trim", "#d2c7b3", 3.0)
        self.plinth = stone("plinth-grey", "#8c8478", 5.0)
        self.stucco = plaster("stucco", "#ece0cb", 0.25)
        self.render = plaster("render", "#e3ddd3", 0.18)
        self.terracotta = paint("terracotta", "#b8674c", 0.75)
        self.roof_tiles = tiles("tiles-terracotta", "#a95b3d")
        self.lead = tiles("lead", "#5d666c", 1.8)
        self.brick = brick("brick", "#9b5843")
        self.steel = corrugated("steel", "#6f7f99")
        self.glass = glass("council-glass")
        self.lamp = glass("lamp", "#fff1cc", 14.0)
        self.iron = paint("iron", "#2e3136", 0.5, 0.6)
        self.frame = paint("frame-stone", "#ebe4d6", 0.6)
        self.white = paint("lh-white", "#ebe6dc", 0.55)
        self.red = paint("lh-red", "#a63a2f", 0.5)
        self.gilt = paint("gilt", "#d2a54a", 0.3, 0.85)
        self.frieze = paint("frieze", "#c49d4c", 0.5, 0.25)
        self.purple = paint("trim-purple", "#7c62a8", 0.45)
        self.metal = paint("metal-light", "#b5b9be", 0.4, 0.5)
        self.dish = paint("dish", "#d9d6cf", 0.55)
        self.brass = paint("brass", "#a8824c", 0.35, 0.8)
        self.slit = paint("slit", "#17191c", 0.8)
        self.door = paint("door-dark", "#3a2f2a", 0.6)


_KIT: CouncilKit | None = None


def council_kit() -> CouncilKit:
    global _KIT
    if _KIT is None:
        _KIT = CouncilKit()
    return _KIT


def _panes(p: dict) -> list[tuple[float, float, float, float]]:
    w = p["windows"]
    return [tuple(w[k : k + 4]) for k in range(0, len(w), 4)]


def pane(ck: CouncilKit, name: str, x: float, z: float, w: float, h: float, depth: float = 0.0, frame=None, f: float = 1.4, out: float = 1.0, sill: bool = True, hood: bool = False) -> list[bpy.types.Object]:
    """A window drawn at screen (x, z) on a wall whose face is `depth` back: its glass, a frame
    standing out round it, a sill under it, and a small cornice over it if `hood`."""
    x, z = at_screen(x, z, depth)
    d = depth
    frame = frame or ck.frame
    obs = [box(f"{name}-glass", x, x + w, d - 0.2, d + 0.6, z, z + h, ck.glass, group="windows")]
    obs.append(box(f"{name}-top", x - f, x + w + f, d - out, d + 0.6, z + h, z + h + f, frame, 0.15))
    obs.append(box(f"{name}-bottom", x - f, x + w + f, d - out, d + 0.6, z - f, z, frame, 0.15))
    obs.append(box(f"{name}-left", x - f, x, d - out, d + 0.6, z, z + h, frame, 0.15))
    obs.append(box(f"{name}-right", x + w, x + w + f, d - out, d + 0.6, z, z + h, frame, 0.15))
    if sill:
        obs.append(box(f"{name}-sill", x - f - 1.0, x + w + f + 1.0, d - out - 1.2, d + 0.6, z - f - 1.4, z - f + 0.2, ck.trim, 0.2))
    if hood:
        obs.append(box(f"{name}-hood", x - f - 1.2, x + w + f + 1.2, d - out - 1.4, d + 0.6, z + h + f, z + h + f + 1.6, ck.trim, 0.2))
    return obs


def quoins(ck: CouncilKit, x0: float, x1: float, z0: float, z1: float, depth: float, mat) -> list[bpy.types.Object]:
    """Big stones at a facade's two front corners, long and short in turn, wrapping round."""
    obs = []
    z, k = z0, 0
    while z + 5.0 <= z1:
        long = k % 2 == 0
        a, b = (7.0, 4.0) if long else (4.0, 7.0)
        obs.append(box(f"quoin-l{k}", x0 - 0.6, x0 + a, -0.6, 0.4, z, z + 5.0, mat, 0.25))
        obs.append(box(f"quoin-r{k}", x1 - a, x1 + 0.6, -0.6, b, z, z + 5.0, mat, 0.25))
        z += 5.6
        k += 1
    return obs


# ——— Research: an observatory under a verdigris dome ———

def build_observatory(kit: Kit, s: dict) -> tuple[list[bpy.types.Object], float]:
    ck = council_kit()
    p = s["p"]
    x, y, w, h = p["x"], p["y"], p["w"], p["h"]
    depth = 76.0
    obs = [
        box("plinth", x - 1.6, x + w + 1.6, -1.6, depth + 1.6, y - 3, y + 5, ck.plinth, 0.3),
        box("walls", x, x + w, 0, depth, y, y + h, ck.limestone, 0.3),
        box("course", x - 0.8, x + w + 0.8, -0.8, depth + 0.8, y + 37, y + 39.4, ck.trim, 0.2),
        box("frieze", x - 1.6, x + w + 1.6, -1.6, depth + 1.6, y + h - 3.0, y + h, ck.trim, 0.2),
        box("cornice", x - 4, x + w + 4, -4, depth + 4, y + h, y + h + 4.4, ck.trim, 0.4),
        box("cornice-top", x - 3, x + w + 3, -3, depth + 3, y + h + 4.4, y + h + 6, ck.limestone, 0.3),
    ]
    obs += quoins(ck, x, x + w, y + 5, y + h - 3, 0, ck.trim)
    # The drum and the dome, over the middle of the roof.
    top = y + h + 6
    dx, dy = x + w / 2, depth / 2
    r = 33.5
    obs.append(cylinder("drum", dx, dy, top, top + 9, r, r, ck.limestone, 72))
    obs.append(cylinder("drum-cap", dx, dy, top + 9, top + 10.6, r + 1.6, r + 1.6, ck.trim, 72))
    zd = top + 10.6
    obs.append(dome("dome", dx, dy, zd, r, verdigris("verdigris", dx, dy)))
    # Its shutter, open: a dark slot from the drum to the crown, facing front right, with the
    # telescope looking out of it.
    a0, a1 = math.radians(-74), math.radians(-62)
    bm = bmesh.new()
    rows = []
    for i in range(15):
        e = math.radians(88 * i / 14)
        rows.append([bm.verts.new((dx + (r + 0.25) * math.cos(e) * math.cos(a), dy + (r + 0.25) * math.cos(e) * math.sin(a), zd + (r + 0.25) * math.sin(e))) for a in (a0, a1)])
    for i in range(14):
        bm.faces.new((rows[i][0], rows[i][1], rows[i + 1][1], rows[i + 1][0]))
    obs.append(_object("slot", bm, ck.slit))
    for k, a in enumerate((a0 - math.radians(1.6), a1 + math.radians(1.6))):
        pts = [(dx + (r + 0.6) * math.cos(math.radians(88 * i / 10)) * math.cos(a), dy + (r + 0.6) * math.cos(math.radians(88 * i / 10)) * math.sin(a), zd + (r + 0.6) * math.sin(math.radians(88 * i / 10))) for i in range(11)]
        for i in range(10):
            obs.append(rod(f"shutter-rail{k}-{i}", pts[i], pts[i + 1], 0.7, ck.iron))
    am, el = (a0 + a1) / 2, math.radians(34)
    direction = (math.cos(el) * math.cos(am), math.cos(el) * math.sin(am), math.sin(el))
    at = lambda t: (dx + direction[0] * t, dy + direction[1] * t, zd + direction[2] * t)  # noqa: E731
    obs.append(rod("telescope", at(r * 0.4), at(r + 10), 3.0, ck.brass, 16))
    obs.append(rod("telescope-hood", at(r + 7.5), at(r + 11.5), 3.6, ck.iron, 16))
    obs.append(rod("finial", (dx, dy, zd + r - 0.5), (dx, dy, zd + r + 6), 0.5, ck.gilt))
    obs.append(ball("finial-ball", (dx, dy, zd + r + 6.5), 1.4, ck.gilt))
    for k, (wx, wy, ww, wh) in enumerate(_panes(p)):
        obs += pane(ck, f"w{k}", wx, wy, ww, wh, 0, f=1.6, out=1.2, hood=True)
    return obs, y


# ——— Design: a terraced drafting tower ———

def build_tower(kit: Kit, s: dict) -> tuple[list[bpy.types.Object], float]:
    ck = council_kit()
    p = s["p"]
    t = p["tiers"]
    tiers = [t[k : k + 4] for k in range(0, len(t), 4)]
    ledge = p["ledge"]
    sx0, sx1, sy, apex = p["spire"]
    # How far back each storey's front stands, and its back.
    depths = [(0.0, 64.0), (9.0, 55.0), (18.0, 46.0)]
    obs = []
    for k, ((x0, x1, y0, y1), (d0, d1)) in enumerate(zip(tiers, depths)):
        ox, oz = -KX * d0, -KZ * d0
        obs.append(box(f"storey{k}", x0 + ox, x1 + ox, d0, d1, y0 + oz - (3.0 if k else 0.0), y1 + oz, ck.stucco, 0.3))
        obs.append(box(f"ledge{k}", x0 - 4 + ox, x1 + 4 + ox, d0 - 4, d1 + 4, y1 + oz, y1 + ledge + oz, ck.terracotta, 0.4))
        obs.append(box(f"ledge-lip{k}", x0 - 4.6 + ox, x1 + 4.6 + ox, d0 - 4.6, d1 + 4.6, y1 + ledge - 1.6 + oz, y1 + ledge + oz, ck.trim, 0.2))
        if k < len(tiers) - 1:
            # A railing round the terrace the next storey steps back from.
            rz = y1 + ledge + oz
            n = int((x1 - x0 + 4) // 5.5)
            for i in range(n + 1):
                px = x0 - 2.5 + ox + i * (x1 - x0 + 5) / n
                obs.append(box(f"rail-post{k}-{i}", px - 0.35, px + 0.35, d0 - 3.0, d0 - 2.3, rz, rz + 5.0, ck.iron))
            obs.append(box(f"rail{k}", x0 - 2.5 + ox, x1 + 2.5 + ox, d0 - 3.1, d0 - 2.2, rz + 4.6, rz + 5.4, ck.iron))
            obs.append(box(f"rail-side{k}", x1 + 2.2 + ox, x1 + 2.9 + ox, d0 - 3.0, d1 + 2.4, rz + 4.6, rz + 5.4, ck.iron))
    # The spire: a tiled point over the top storey.
    d0, d1 = depths[-1]
    dm = (d0 + d1) / 2
    ox, oz = -KX * dm, -KZ * dm
    obs.append(pyramid("spire", sx0 + ox, sx1 + ox, d0 - 1.5, d1 + 1.5, sy + oz, apex + oz, ck.roof_tiles))
    cx = (sx0 + sx1) / 2 + ox
    obs.append(rod("spire-finial", (cx, dm, apex + oz - 1), (cx, dm, apex + oz + 7), 0.45, ck.gilt))
    obs.append(ball("spire-ball", (cx, dm, apex + oz + 7.6), 1.3, ck.gilt))
    # The windows, each on its storey's front.
    for k, (wx, wy, ww, wh) in enumerate(_panes(p)):
        level = next(i for i, (_, _, y0, y1) in enumerate(tiers) if y0 <= wy <= y1)
        obs += pane(ck, f"w{k}", wx, wy, ww, wh, depths[level][0], frame=ck.iron, f=1.1, out=0.9)
    return obs, tiers[0][2]


# ——— Implementation: a long brick workshop under a sawtooth roof ———

def build_workshop(kit: Kit, s: dict) -> tuple[list[bpy.types.Object], float]:
    ck = council_kit()
    p = s["p"]
    x, y, w, h = p["x"], p["y"], p["w"], p["h"]
    n, tw, rise = int(p["teeth"]), p["tooth"], p["rise"]
    depth = 74.0
    top = y + h
    obs = [
        box("plinth", x - 1.2, x + w + 1.2, -1.2, depth + 1.2, y - 3, y + 6, ck.plinth, 0.3),
        box("walls", x, x + w, 0, depth, y, top, ck.brick, 0.2),
        box("band", x - 0.8, x + w + 0.8, -0.8, depth + 0.8, top - 3.2, top, ck.trim, 0.2),
        box("course", x - 0.5, x + w + 0.5, -0.5, depth + 0.5, y + 33.2, y + 35.0, ck.trim, 0.15),
    ]
    run = math.hypot(tw, rise)
    ux, uz = tw / run, rise / run
    nx, nz = -uz, ux
    th = 1.3
    for k in range(n):
        sx = x + k * tw
        # The brick under each tooth: its slope rising to the right, its glazed face on the right.
        obs.append(prism(f"gable{k}", [(sx, top), (sx + tw, top), (sx + tw, top + rise)], 0, depth, ck.brick))
        a = (sx - ux * 1.8, top - uz * 1.8)
        b = (sx + tw + ux * 0.6, top + rise + uz * 0.6)
        sheet = [a, b, (b[0] + nx * th, b[1] + nz * th), (a[0] + nx * th, a[1] + nz * th)]
        obs.append(prism(f"sheet{k}", sheet, -2.2, depth + 2.2, ck.steel, 0.15))
        # The north light: glass down the tooth's upright face, between steel mullions.
        gx = sx + tw
        obs.append(box(f"light{k}", gx - 0.5, gx + 0.25, 1.5, depth - 1.5, top + 1.2, top + rise - 1.6, ck.glass, group="windows"))
        for i in range(11):
            yy = 1.5 + i * (depth - 3.0) / 10
            obs.append(box(f"mullion{k}-{i}", gx - 0.2, gx + 0.7, yy - 0.45, yy + 0.45, top, top + rise - 0.8, ck.iron))
        obs.append(box(f"transom{k}", gx - 0.2, gx + 0.7, 1.0, depth - 1.0, top + rise * 0.48, top + rise * 0.48 + 0.8, ck.iron))
    # Ventilators on two of the slopes, and a tall chimney at the back.
    for k in (1, 4):
        vx, vz = x + k * tw + tw * 0.45, top + rise * 0.45 + 1.0
        obs.append(cylinder(f"vent{k}", vx, depth * 0.45, vz, vz + 6.5, 2.4, 2.4, ck.metal, 16))
        obs.append(cylinder(f"vent-cap{k}", vx, depth * 0.45, vz + 6.5, vz + 9.5, 3.6, 0.4, ck.metal, 16))
    obs.append(box("chimney", x + w - 22, x + w - 12, depth - 18, depth - 8, top - 4, top + rise + 30, ck.brick, 0.2))
    obs.append(box("chimney-cap", x + w - 23, x + w - 11, depth - 19, depth - 7, top + rise + 28, top + rise + 31, ck.trim, 0.2))
    for k, (wx, wy, ww, wh) in enumerate(_panes(p)):
        obs += pane(ck, f"w{k}", wx, wy, ww, wh, 0, frame=ck.iron, f=1.0, out=0.8)
        # A stone lintel over each.
        obs.append(box(f"lintel{k}", wx - 2.2, wx + ww + 2.2, -1.0, 0.6, wy + wh + 1.0, wy + wh + 3.2, ck.trim, 0.2))
    return obs, y


# ——— Audit: a lighthouse, the tallest thing in town ———

def build_lighthouse(kit: Kit, s: dict) -> tuple[list[bpy.types.Object], float]:
    ck = council_kit()
    p = s["p"]
    y, h = p["y"], p["h"]
    n = int(p["stripes"])
    rb, rt, cx = p["halfBottom"], p["halfTop"], p["cx"]
    # Its axis stands this far back, moved so that, seen obliquely, it is centred where the
    # painted one is.
    yc = rb + 2.0
    ax = cx - KX * yc
    radius = lambda z: rb - (rb - rt) * (z - y) / h  # noqa: E731
    obs = [cylinder("plinth", ax, yc, y - 3, y + 5, rb + 4.0, rb + 3.4, ck.plinth, 72)]
    for k in range(n):
        z0 = max(y + 5, y + h * k / n)
        z1 = y + h * (k + 1) / n
        obs.append(cylinder(f"band{k}", ax, yc, z0, z1, radius(z0), radius(z1), ck.red if k % 2 else ck.white, 96))
    # The point on the tower drawn where the painted windows are: a little round to the right
    # of facing straight out, so that the oblique view brings it to the middle.
    th = math.atan2(-1.0, KX)

    def on_tower(zs: float, out: float) -> tuple[float, float, float]:
        r = radius(zs) + out
        wx, wy = ax + r * math.cos(th), yc + r * math.sin(th)
        return wx, wy, zs - KZ * wy

    turn = th + math.pi / 2
    scale = 1 / (-math.sin(th) + KX * math.cos(th))
    for k, (wx, wy, ww, wh) in enumerate(_panes(p)):
        zc = wy + wh / 2
        obs.append(obox(f"w{k}-frame", on_tower(zc, 0.4), ((ww + 3.2) * scale, 1.6, wh + 3.2), turn, ck.frame, 0.2))
        obs.append(obox(f"w{k}-glass", on_tower(zc, 1.0), (ww * scale, 1.0, wh), turn, ck.glass, group="windows"))
        obs.append(obox(f"w{k}-sill", on_tower(zc - wh / 2 - 1.9, 1.0), ((ww + 5) * scale, 2.4, 1.4), turn, ck.trim, 0.2))
    # A door at its foot.
    obs.append(obox("door-frame", on_tower(y + 14, 0.4), (14 * scale, 1.6, 21), turn, ck.trim, 0.2))
    obs.append(obox("door", on_tower(y + 13, 0.9), (9.5 * scale, 1.0, 17), turn, ck.door))
    # The gallery round the top, on a flared stone collar, with its railing.
    zt = y + h
    obs.append(cylinder("collar", ax, yc, zt - 6, zt, rt + 0.4, rt + 5.6, ck.trim, 72))
    obs.append(cylinder("gallery", ax, yc, zt, zt + 2.4, 24.5, 24.5, ck.iron, 72))
    for i in range(40):
        a = 2 * math.pi * i / 40
        obs.append(cylinder(f"post{i}", ax + 23.6 * math.cos(a), yc + 23.6 * math.sin(a), zt + 2.4, zt + 8.6, 0.32, 0.32, ck.iron, 6))
    obs.append(ring("rail", ax, yc, zt + 8.2, zt + 9.0, 23.6, ck.iron, 72))
    obs.append(ring("rail-mid", ax, yc, zt + 5.2, zt + 5.7, 23.6, ck.iron, 72))
    # The lantern: a low wall, glass all round between iron bars, and its red cap.
    zl = zt + 2.4
    obs.append(cylinder("lantern-wall", ax, yc, zl, zl + 4.0, 16.5, 16.5, ck.iron, 48))
    obs.append(cylinder("lantern", ax, yc, zl + 4.0, zl + 24.0, 15.0, 15.0, ck.lamp, 48, group="windows"))
    for i in range(12):
        a = 2 * math.pi * i / 12 + 0.12
        obs.append(obox(f"bar{i}", (ax + 15.3 * math.cos(a), yc + 15.3 * math.sin(a), zl + 14.0), (1.1, 1.1, 20.0), a + math.pi / 2, ck.iron))
    obs.append(cylinder("lantern-ring", ax, yc, zl + 24.0, zl + 25.6, 16.8, 16.8, ck.iron, 48))
    obs.append(cylinder("cap", ax, yc, zl + 25.6, zl + 43.0, 19.0, 0.0, ck.red, 64))
    obs.append(cylinder("vent", ax, yc, zl + 41.0, zl + 45.0, 2.0, 1.5, ck.iron, 16))
    obs.append(ball("vent-ball", (ax, yc, zl + 46.2), 2.4, ck.iron))
    obs.append(rod("lightning-rod", (ax, yc, zl + 48.0), (ax, yc, zl + 56.0), 0.3, ck.iron))
    return obs, y


# ——— Training: an academy with pilasters and a pediment ———

def build_academy(kit: Kit, s: dict) -> tuple[list[bpy.types.Object], float]:
    ck = council_kit()
    p = s["p"]
    x, y, w, h = p["x"], p["y"], p["w"], p["h"]
    depth = 72.0
    obs = [
        box("plinth", x - 2, x + w + 2, -2, depth + 2, y - 3, y + 4, ck.plinth, 0.3),
        box("walls", x, x + w, 0, depth, y, y + h, ck.ashlar, 0.3),
    ]
    # Pilasters between the bays of windows.
    cols = 6
    g0, gw = x + 10, (w - 20) / cols
    for c in range(cols + 1):
        px = g0 + c * gw
        obs.append(box(f"pilaster{c}", px - 2.6, px + 2.6, -1.6, 0.5, y + 4, y + h - 1, ck.marble, 0.2))
        obs.append(box(f"pilaster-base{c}", px - 3.4, px + 3.4, -2.2, 0.5, y + 4, y + 7, ck.marble, 0.2))
        obs.append(box(f"capital{c}", px - 3.8, px + 3.8, -2.5, 0.5, y + h - 4.2, y + h - 1, ck.marble, 0.2))
    # The entablature: architrave, a gilded frieze, the cornice.
    obs += [
        box("architrave", x - 2, x + w + 2, -2.6, depth + 2, y + h - 1, y + h + 2.5, ck.marble, 0.2),
        box("frieze", x - 1.6, x + w + 1.6, -2.2, depth + 1.6, y + h + 2.5, y + h + 6, ck.frieze, 0.2),
        box("cornice", x - 6, x + w + 6, -6, depth + 6, y + h + 6, y + h + 8, ck.marble, 0.3),
    ]
    # The pediment: a stone gable framed by raking cornices, an oculus in its middle, and a
    # lead roof running back from it.
    zb, apex, cx = y + h + 8, y + h + 42, x + w / 2
    obs.append(prism("tympanum", [(x - 4, zb), (x + w + 4, zb), (cx, apex - 3)], -1.0, 3.0, ck.ashlar))
    half = w / 2 + 6
    run = math.hypot(half, apex - zb)
    ux, uz = half / run, (apex - zb) / run
    for sgn, name in ((-1, "left"), (1, "right")):
        e = (cx + sgn * half, zb)
        # The slope's outward normal: up and away from the middle.
        nx, nz = (-uz if sgn < 0 else uz), ux
        strip = [e, (cx, apex), (cx + nx * 3.4, apex + nz * 3.4), (e[0] + nx * 3.4, e[1] + nz * 3.4)]
        obs.append(prism(f"raking-{name}", strip, -6.0, 3.0, ck.marble, 0.2))
        roof = [(e[0] + nx * 3.0, e[1] + nz * 3.0), (cx + nx * 3.0, apex + nz * 3.0), (cx + nx * 4.6, apex + nz * 4.6), (e[0] + nx * 4.6, e[1] + nz * 4.6)]
        obs.append(prism(f"roof-{name}", roof, -4.0, depth + 6.0, ck.lead, 0.15))
    obs.append(prism("ridge", [(cx - 1.4, apex + 3.0), (cx + 1.4, apex + 3.0), (cx, apex + 5.8)], -4.4, depth + 6.4, ck.iron))
    oz = zb + 13.0
    obs.append(disc_y("oculus-ring", cx, oz, -2.0, -0.8, 7.0, ck.marble, 40))
    obs.append(disc_y("oculus", cx, oz, -2.4, -1.6, 5.0, ck.glass, 40, group="windows"))
    for k in range(4):
        a = math.pi / 4 + k * math.pi / 2
        obs.append(rod(f"oculus-bar{k}", (cx, -2.5, oz), (cx + 5 * math.cos(a), -2.5, oz + 5 * math.sin(a)), 0.4, ck.marble))
    # Gilded ornaments at the apex and the two corners.
    obs.append(ball("acroterion", (cx, -2.0, apex + 6.5), 2.2, ck.gilt))
    for sgn in (-1, 1):
        ex = cx + sgn * (half - 3)
        obs.append(box(f"plinth-orn{sgn}", ex - 2.4, ex + 2.4, -4.0, 0.0, zb + 0.5, zb + 4.0, ck.marble, 0.2))
        obs.append(ball(f"urn{sgn}", (ex, -2.0, zb + 6.0), 2.2, ck.gilt))
    for k, (wx, wy, ww, wh) in enumerate(_panes(p)):
        obs += pane(ck, f"w{k}", wx, wy, ww, wh, 0, f=1.5, out=1.2, hood=True)
    return obs, y


# ——— Media: a studio with a lattice radio mast ———

def build_studio(kit: Kit, s: dict) -> tuple[list[bpy.types.Object], float]:
    ck = council_kit()
    p = s["p"]
    x, y, w, h = p["x"], p["y"], p["w"], p["h"]
    mx, my0, my1 = p["mast"]
    depth = 66.0
    zr = y + h + 8
    obs = [
        box("plinth", x - 1, x + w + 1, -1, depth + 1, y - 3, y + 3, ck.plinth, 0.2),
        box("walls", x, x + w, 0, depth, y, y + h, ck.render, 0.2),
        box("band", x - 4, x + w + 4, -4, depth + 4, y + h, zr, ck.purple, 0.3),
        box("coping", x - 4.4, x + w + 4.4, -4.4, depth + 4.4, zr, zr + 1.0, ck.iron, 0.2),
    ]
    panes = _panes(p)
    # A sunshade over each row of windows.
    for k, wy in enumerate(sorted({round(v[1] + v[3], 2) for v in panes})):
        obs.append(box(f"shade{k}", x + 3, x + w - 3, -3.4, 0.4, wy + 1.8, wy + 2.6, ck.iron, 0.1))
    for k, (wx, wy, ww, wh) in enumerate(panes):
        obs += pane(ck, f"w{k}", wx, wy, ww, wh, 0, frame=ck.iron, f=0.9, out=0.6, sill=False)
    # On the roof: two air-handling units and a dish.
    for k, (ux0, uy0) in enumerate(((x + 10, 12.0), (x + 32, 40.0))):
        obs.append(box(f"unit{k}", ux0, ux0 + 16, uy0, uy0 + 14, zr + 1, zr + 8, ck.metal, 0.3))
        obs.append(cylinder(f"fan{k}", ux0 + 8, uy0 + 7, zr + 8, zr + 8.6, 4.5, 4.5, ck.iron, 24))
    # A dish on a short post, its bowl turned up to the sky and a little towards the eye, the
    # receiver held out on an arm at its focus.
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=40, v_segments=20, radius=12.0)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z > -8.5], context="VERTS")
    bmesh.ops.translate(bm, verts=list(bm.verts), vec=(0.0, 0.0, 12.0))
    aim = Vector((-0.45, -0.55, 0.70)).normalized()
    turn = aim.to_track_quat("Z", "Y").to_matrix().to_4x4()
    centre = Vector((x + 26.0, 30.0, zr + 9.5))
    bmesh.ops.transform(bm, matrix=turn, verts=list(bm.verts))
    bmesh.ops.translate(bm, verts=list(bm.verts), vec=centre)
    obs.append(_object("dish", bm, ck.dish))
    obs.append(rod("dish-post", (centre.x + 1.5, centre.y + 2.5, zr + 1), tuple(centre + aim * 0.5), 0.9, ck.iron))
    feed = centre + aim * 7.0
    obs.append(rod("dish-arm", tuple(centre + aim * 2.0), tuple(feed), 0.3, ck.iron))
    obs.append(ball("dish-feed", tuple(feed), 0.9, ck.iron))
    # The mast, standing on the roof but drawn where the painted one is.
    dm = depth / 2
    ax = mx - KX * dm
    oz = -KZ * dm
    zt = my0 + 104 + oz
    legs = [math.radians(a) for a in (90, 210, 330)]
    levels = 12
    rb, rt = 11.0, 1.6
    pt = lambda a, i: (ax + (rb + (rt - rb) * i / levels) * math.cos(a), dm + (rb + (rt - rb) * i / levels) * math.sin(a), zr + (zt - zr) * i / levels)  # noqa: E731
    for i in range(levels):
        mat = ck.red if (i // 2) % 2 else ck.white
        for j, a in enumerate(legs):
            b = legs[(j + 1) % 3]
            obs.append(rod(f"leg{j}-{i}", pt(a, i), pt(a, i + 1), 0.55, mat))
            obs.append(rod(f"brace{j}-{i}", pt(a, i), pt(b, i + 1), 0.28, mat))
            obs.append(rod(f"ring{j}-{i}", pt(a, i + 1), pt(b, i + 1), 0.28, mat))
    obs.append(cylinder("platform", ax, dm, zt, zt + 0.8, 3.4, 3.4, ck.iron, 16))
    obs.append(rod("pole", (ax, dm, zt), (ax, dm, my1 + oz), 0.75, ck.white, 8))
    for k, zz in enumerate((zt + 8, zt + 16)):
        obs.append(rod(f"dipole{k}", (ax - 6, dm, zz), (ax + 6, dm, zz), 0.3, ck.iron))
    return obs, y


BUILDERS = {
    "observatory": build_observatory,
    "tower": build_tower,
    "workshop": build_workshop,
    "lighthouse": build_lighthouse,
    "academy": build_academy,
    "studio": build_studio,
}
