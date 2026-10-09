"""
The village of AI coworkers (scene "npcs"): houses with their gables to the river.
"""
from __future__ import annotations

import math

import bpy
import numpy as np

from structures_kit import Kit, at_screen, box, prism


def window(kit: Kit, name: str, x: float, z: float, w: float, h: float, frame: float = 1.0, shutters=None, flowers=None) -> list[bpy.types.Object]:
    """Glass in a painted frame, with a stone sill; shutters either side and a box of
    flowers under it if given."""
    obs = [box(f"{name}-glass", x, x + w, -0.15, 0.4, z, z + h, kit.glass, group="windows")]
    f = frame
    obs.append(box(f"{name}-top", x - f, x + w + f, -0.8, 0.4, z + h, z + h + f, kit.frame, 0.15))
    obs.append(box(f"{name}-left", x - f, x, -0.8, 0.4, z, z + h, kit.frame, 0.15))
    obs.append(box(f"{name}-right", x + w, x + w + f, -0.8, 0.4, z, z + h, kit.frame, 0.15))
    obs.append(box(f"{name}-mullion", x + w / 2 - 0.3, x + w / 2 + 0.3, -0.5, 0.4, z, z + h, kit.frame))
    obs.append(box(f"{name}-transom", x, x + w, -0.5, 0.4, z + h * 0.62 - 0.3, z + h * 0.62 + 0.3, kit.frame))
    obs.append(box(f"{name}-sill", x - f - 0.6, x + w + f + 0.6, -1.6, 0.4, z - 1.2, z, kit.sill, 0.2))
    if shutters is not None:
        sw = w * 0.5 + 0.4
        obs.append(box(f"{name}-shutter-l", x - f - sw, x - f - 0.2, -1.0, -0.2, z - 0.3, z + h + 0.3, shutters, 0.12))
        obs.append(box(f"{name}-shutter-r", x + w + f + 0.2, x + w + f + sw, -1.0, -0.2, z - 0.3, z + h + 0.3, shutters, 0.12))
    if flowers is not None:
        obs.append(box(f"{name}-planter", x - 0.4, x + w + 0.4, -3.2, -1.2, z - 3.6, z - 1.2, kit.beam, 0.15))
        rng = np.random.default_rng(abs(hash(name)) % 2**32)
        for k in range(int(w * 1.4)):
            px = x + rng.uniform(0, w)
            pz = z - 1.4 + rng.uniform(0, 1.6)
            r = rng.uniform(0.6, 1.0)
            obs.append(box(f"{name}-leaf{k}", px - r, px + r, -3.4, -1.6, pz - r * 0.6, pz + r * 0.6, kit.leaves, 0.3))
            if rng.random() < 0.6:
                obs.append(box(f"{name}-bloom{k}", px - r * 0.6, px + r * 0.6, -3.6, -2.4, pz + 0.2, pz + r, flowers, 0.25))
    return obs


def build_house(kit: Kit, s: dict) -> tuple[list[bpy.types.Object], float]:
    """A house with its gable to the river: plastered walls on a stone plinth, a tiled roof
    overhanging every side, a door, windows with sills, and a chimney where the site's smoke
    rises from."""
    p = s["p"]
    x0, w, h, roof, base = p["x0"], p["w"], p["h"], p["roof"], p["base"]
    seed = int(p["seed"])
    depth = round(w * 0.7 + 6)
    wall = kit.walls[seed % len(kit.walls)]
    tile = kit.roofs[(seed * 7) % len(kit.roofs)]
    top = base + h
    ridge = top + roof
    obs = [
        box("plinth", x0 - 0.8, x0 + w + 0.8, -0.8, depth + 0.8, base - 3, base + 2.5, kit.plinth, 0.3),
        box("walls", x0, x0 + w, 0, depth, base, top, wall, 0.25),
        # The gable under the roof.
        prism("gable", [(x0, top), (x0 + w, top), (x0 + w / 2, ridge - 1.2)], 0, depth, wall),
    ]
    # The roof: two slopes of tiles, over the eaves and the gables.
    over = 6.0
    t = 1.6
    run = math.hypot(w / 2 + over, roof)
    nx, nz = roof / run, (w / 2 + over) / run
    left = [(x0 - over, top), (x0 + w / 2, ridge), (x0 + w / 2 - nx * t, ridge + nz * t), (x0 - over - nx * t, top + nz * t)]
    right = [(x0 + w / 2, ridge), (x0 + w + over, top), (x0 + w + over + nx * t, top + nz * t), (x0 + w / 2 + nx * t, ridge + nz * t)]
    obs.append(prism("roof-left", left, -3.0, depth + 3.0, tile, 0.2))
    obs.append(prism("roof-right", right, -3.0, depth + 3.0, tile, 0.2))
    obs.append(prism("ridge", [(x0 + w / 2 - 1.6, ridge - 0.6), (x0 + w / 2 + 1.6, ridge - 0.6), (x0 + w / 2, ridge + 2.0)], -3.4, depth + 3.4, kit.chimney, 0.2))
    # Fascia boards along the gable's edge, so the roof reads as having thickness.
    obs.append(prism("fascia-left", [(x0 - over, top - 1.0), (x0 + w / 2, ridge - 1.0), (x0 + w / 2, ridge), (x0 - over, top)], -3.6, -2.6, kit.door))
    obs.append(prism("fascia-right", [(x0 + w / 2, ridge - 1.0), (x0 + w + over, top - 1.0), (x0 + w + over, top), (x0 + w / 2, ridge)], -3.6, -2.6, kit.door))
    # The door: a recess with a lintel and a step.
    d, dw, dh = p["door"], p["doorW"], p["doorH"]
    obs.append(box("door", d - dw, d + dw, -0.3, 0.6, base, base + dh, kit.door))
    obs.append(box("lintel", d - dw - 1.4, d + dw + 1.4, -1.0, 0.6, base + dh, base + dh + 1.6, kit.sill, 0.2))
    obs.append(box("step", d - dw - 1.6, d + dw + 1.6, -2.4, 0.6, base - 0.5, base + 0.9, kit.sill, 0.2))
    win = p["windows"]
    shutters = None if p["studio"] or p["hall"] else kit.shutters[seed % len(kit.shutters)]
    flowers = kit.flowers[seed % len(kit.flowers)] if seed % 3 != 1 and not p["studio"] else None
    for k in range(0, len(win), 4):
        obs += window(kit, f"window{k}", win[k], win[k + 1], win[k + 2], win[k + 3], 1.6 if p["studio"] else 1.0, shutters, flowers)
    # The plain houses wear their timbers in the gable.
    if not p["hall"] and not p["studio"] and seed % 2 == 1:
        g0, g1, gt = x0 + 1.0, x0 + w - 1.0, ridge - 2.0
        beams = [(x0 + w / 2 - 0.7, x0 + w / 2 + 0.7, top, gt)]
        for u in (0.25, 0.75):
            bx = x0 + w * u
            bh = top + (gt - top) * (1 - abs(u - 0.5) * 2) - 1.0
            beams.append((bx - 0.6, bx + 0.6, top, bh))
        for bx0, bx1, bz0, bz1 in beams:
            obs.append(box("beam", bx0, bx1, -0.6, 0.3, bz0, bz1, kit.beam))
        obs.append(box("beam-sill", g0, g1, -0.7, 0.3, top - 0.6, top + 0.8, kit.beam))
    # A big house gets a little roof over its door.
    if p["hall"]:
        hood = [(d - dw - 5, base + dh + 2), (d + dw + 5, base + dh + 2), (d, base + dh + 9)]
        obs.append(prism("hood", hood, -7.0, 0.4, tile, 0.2))
        for px in (d - dw - 4.2, d + dw + 3.4):
            obs.append(box("post", px, px + 0.8, -6.6, -5.8, base, base + dh + 2, kit.beam))
    if p["chimney"]:
        cx, cy0, cy1 = p["chimney"]
        # Set back on the roof, but drawn where the painted one stood, so the smoke rises from it.
        back = depth * 0.45
        sx, sz = at_screen(cx, cy1, back)
        obs.append(box("chimney", sx, sx + 7, back - 3.5, back + 3.5, sz - roof - 6, sz, kit.chimney, 0.3))
        obs.append(box("chimney-cap", sx - 0.8, sx + 7.8, back - 4.3, back + 4.3, sz, sz + 1.4, kit.sill, 0.2))
    return obs, base


BUILDERS = {"house": build_house}
