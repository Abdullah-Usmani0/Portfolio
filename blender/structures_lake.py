"""
The stage on the lake (scene "voice"), modelled from the numbers the site draws it with
(src/world/scenery/lakeLayout.ts): the stepped stone stage and the screen's frame on it (the
site plays the voice on the screen itself, over the render), and the truss its lamps hang
from (the site lights them).
"""
from __future__ import annotations

import math

import bpy

from structures_kit import KX, KZ, Kit, ashlar, at_screen, box, cylinder, glass, paint, rod


class LakeKit:
    def __init__(self) -> None:
        self.stone = ashlar("stage-stone", "#a29c93", 12.0, 5.5)
        self.coping = ashlar("stage-coping", "#bbb5ab", 18.0, 2.5)
        self.bezel = paint("bezel", "#26272c", 0.4, 0.4)
        self.alu = paint("truss-alu", "#9ea3a8", 0.35, 0.85)
        self.black = paint("can-black", "#1c1d21", 0.5, 0.5)
        self.footlight = glass("footlight", "#ffd9a0", 9.0)


_KIT: LakeKit | None = None


def lake_kit() -> LakeKit:
    global _KIT
    if _KIT is None:
        _KIT = LakeKit()
    return _KIT


def build_stage(kit: Kit, s: dict):
    """Three steps of dressed stone, each drawn where the site paints it with its tread above
    it, the screen's frame standing on the top one on two legs, footlights along its edge."""
    lk = lake_kit()
    p = s["p"]
    ax, y0, rise = p["x"], p["y"], p["rise"]
    sx, sy, sw, sh = p["screen"]
    back = 70.0
    # Each step stands this far behind the one below: its tread shows above the face below.
    tread = 2.5 / KZ
    obs = []
    for k, w in enumerate(p["steps"]):
        d = k * tread
        ox, oz = -KX * d, -KZ * d
        z0, z1 = y0 + rise * k, y0 + rise * k + rise - 2.5
        obs.append(box(f"step{k}", ax - w / 2 + ox, ax + w / 2 + ox, d, back, z0 + oz - (3.0 if k else 0.0), z1 + oz, lk.stone, 0.4))
        obs.append(box(f"coping{k}", ax - w / 2 - 1.2 + ox, ax + w / 2 + 1.2 + ox, d - 1.2, back + 1.2, z1 + oz - 1.6, z1 + oz, lk.coping, 0.3))
    # Footlights along the top step's edge.
    top_d = 2 * tread
    for i in range(9):
        fx = ax - 76 + i * 19
        lx, lz = at_screen(fx, y0 + 3 * rise - 2.5, top_d + 2.0)
        obs.append(box(f"foot{i}", lx - 2.2, lx + 2.2, top_d + 0.6, top_d + 3.4, lz, lz + 1.6, lk.black, 0.2))
        obs.append(box(f"foot-light{i}", lx - 1.6, lx + 1.6, top_d + 0.3, top_d + 0.8, lz + 0.3, lz + 1.4, lk.footlight, group="windows"))
    # The screen: a dark bezel round the picture the site plays, on two legs.
    d = 40.0
    ox, oz = -KX * d, -KZ * d
    obs.append(box("bezel", sx - sw / 2 + ox, sx + sw / 2 + ox, d, d + 5.0, sy - sh / 2 + oz, sy + sh / 2 + oz, lk.bezel, 0.8))
    obs.append(box("bezel-lip", sx - sw / 2 - 1.0 + ox, sx + sw / 2 + 1.0 + ox, d + 0.5, d + 4.5, sy - sh / 2 - 1.0 + oz, sy - sh / 2 + 1.5 + oz, lk.alu, 0.4))
    stand = y0 + 3 * rise - 2.5
    for dx in (-58, 58):
        obs.append(box(f"leg{dx}", sx + dx - 3.5 + ox, sx + dx + 3.5 + ox, d + 1.0, d + 4.0, stand + oz - 2.0, sy - sh / 2 + oz, lk.bezel, 0.3))
        obs.append(box(f"foot{dx}", sx + dx - 7.0 + ox, sx + dx + 7.0 + ox, d - 2.0, d + 7.0, stand + oz - 2.0, stand + oz, lk.alu, 0.3))
    return obs, y0


# The truss: how far back it stands, and its square section.
TRUSS_D = 26.0
HALF = 3.2
CORNERS = [(-HALF, -HALF), (HALF, -HALF), (HALF, HALF), (-HALF, HALF)]


def build_truss(kit: Kit, s: dict):
    """The beam of the truss over the stage, in aluminium tube, a spotlight on a clamp under
    each lamp the site lights, and a cable from the last down to the screen."""
    lk = lake_kit()
    p = s["p"]
    x0, x1, y = p["x0"], p["x1"], p["y"]
    d = TRUSS_D
    ox, oz = -KX * d, -KZ * d
    half = HALF
    corners = CORNERS
    obs = []
    # The beam: four chords, braced in zigzags on every side.
    for dz, dd in corners:
        obs.append(rod("chord", (x0 + ox, d + dd, y + dz + oz), (x1 + ox, d + dd, y + dz + oz), 0.55, lk.alu, 8))
    n = int((x1 - x0) / 6.4)
    for i in range(n):
        a = x0 + (x1 - x0) * i / n + ox
        b = x0 + (x1 - x0) * (i + 1) / n + ox
        for (za, da), (zb, db) in ((corners[0], corners[3]), (corners[1], corners[2]), (corners[0], corners[1]), (corners[3], corners[2])):
            flip = i % 2
            pa = (a, d + (da if not flip else db), y + (za if not flip else zb) + oz)
            pb = (b, d + (db if not flip else da), y + (zb if not flip else za) + oz)
            obs.append(rod("brace", pa, pb, 0.3, lk.alu, 6))
    # Under each lamp the site lights: a clamp, a yoke and a spotlight can facing the eye.
    lamps = p["lamps"]
    for k in range(0, len(lamps), 2):
        lx, ly = lamps[k], lamps[k + 1]
        cx, cz = at_screen(lx, ly, d - 4.0)
        obs.append(box(f"clamp{k}", lx - 1.6 + ox, lx + 1.6 + ox, d - 1.6, d + 1.6, y - half - 1.6 + oz, y - half + oz, lk.black, 0.2))
        obs.append(rod(f"hanger{k}", (lx + ox, d, y - half + oz), (cx, d - 4.0, cz + 4.0), 0.5, lk.black, 6))
        obs.append(cylinder(f"can{k}", cx, d - 2.0, cz - 4.6, cz + 4.6, 5.0, 4.4, lk.black, 20))
    dx, dy = p["drop"]
    top = at_screen(dx, y - half, d)
    obs.append(rod("cable", (top[0], d, top[1]), (dx + ox, d, dy + oz), 0.4, lk.black, 6))
    return obs, dy + oz, {"shadow": False}


def build_tower(kit: Kit, s: dict):
    """One of the truss's two towers, from its base plate on the shore up to the beam."""
    lk = lake_kit()
    p = s["p"]
    tx, foot, y = p["x"], p["foot"], p["y"]
    d = TRUSS_D
    ox, oz = -KX * d, -KZ * d
    z0, z1 = foot + oz, y - HALF + oz
    obs = []
    for dx, dd in CORNERS:
        obs.append(rod("tower-chord", (tx + dx + ox, d + dd, z0), (tx + dx + ox, d + dd, z1), 0.55, lk.alu, 8))
    m = int((z1 - z0) / 6.4)
    for i in range(m):
        za = z0 + (z1 - z0) * i / m
        zb = z0 + (z1 - z0) * (i + 1) / m
        for (xa, da), (xb, db) in ((CORNERS[0], CORNERS[1]), (CORNERS[1], CORNERS[2]), (CORNERS[3], CORNERS[2]), (CORNERS[0], CORNERS[3])):
            flip = i % 2
            pa = (tx + (xa if not flip else xb) + ox, d + (da if not flip else db), za)
            pb = (tx + (xb if not flip else xa) + ox, d + (db if not flip else da), zb)
            obs.append(rod("tower-brace", pa, pb, 0.3, lk.alu, 6))
    obs.append(box("base-plate", tx - 7 + ox, tx + 7 + ox, d - 7, d + 7, z0 - 1.0, z0, lk.black, 0.3))
    return obs, z0 - 1.0, {"shadow": False}


BUILDERS = {"stage": build_stage, "truss": build_truss, "truss-tower": build_tower}
