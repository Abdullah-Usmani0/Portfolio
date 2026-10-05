"""Cut a bust from the MakeHuman base mesh (CC0) for the Mind Garden's firefly bust.

The browser samples firefly points on this surface at load time, so only a small mesh is
shipped (never a point cloud, never anyone's likeness — the MakeHuman base is a neutral
average human, released CC0 in 2020).

Out: src/assets/bust_m0.bin
  'ZVB1' | u32 vertex count | u32 triangle count | f32 xyz… | u16 indices…
  Units: the bust's height is 1.0; origin at the centre of its base; it faces +Z.

Pure Python (no bpy): python3 blender/bust_mesh.py
"""
from __future__ import annotations

import os
import struct
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, ".cache", "bust", "base.obj")
OUT = os.path.join(HERE, "..", "src", "assets", "bust_m0.bin")
URL = "https://raw.githubusercontent.com/makehumancommunity/makehuman/master/makehuman/data/3dobjs/base.obj"

KEEP_GROUPS = {"body", "helper-l-eye", "helper-r-eye"}
CUT_Y = 3.4  # MakeHuman decimetres: a little below the collarbones
MAX_ABS_X = 2.6  # drop the arms, keep the shoulders


def load_obj(path: str) -> tuple[list[tuple[float, float, float]], list[list[int]]]:
    verts: list[tuple[float, float, float]] = []
    faces: list[list[int]] = []
    group = None
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            if line.startswith("v "):
                x, y, z = (float(t) for t in line.split()[1:4])
                verts.append((x, y, z))
            elif line.startswith("g "):
                group = line.split(None, 1)[1].strip()
            elif line.startswith("f ") and group in KEEP_GROUPS:
                faces.append([int(t.split("/")[0]) - 1 for t in line.split()[1:]])
    return verts, faces


def main() -> None:
    if not os.path.exists(CACHE):
        os.makedirs(os.path.dirname(CACHE), exist_ok=True)
        urllib.request.urlretrieve(URL, CACHE)
    verts, faces = load_obj(CACHE)
    keep = [f for f in faces if all(verts[i][1] > CUT_Y and abs(verts[i][0]) < MAX_ABS_X for i in f)]
    tris: list[tuple[int, int, int]] = []
    for f in keep:  # fan-triangulate quads
        tris += [(f[0], f[k], f[k + 1]) for k in range(1, len(f) - 1)]
    used = sorted({i for t in tris for i in t})
    remap = {old: new for new, old in enumerate(used)}
    pts = [verts[i] for i in used]
    ys = [p[1] for p in pts]
    y0, y1 = min(ys), max(ys)
    h = y1 - y0
    cx = (min(p[0] for p in pts) + max(p[0] for p in pts)) / 2
    cz = (min(p[2] for p in pts) + max(p[2] for p in pts)) / 2
    norm = [((x - cx) / h, (y - y0) / h, (z - cz) / h) for x, y, z in pts]
    assert len(norm) < 65536
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "wb") as fh:
        fh.write(b"ZVB1")
        fh.write(struct.pack("<II", len(norm), len(tris)))
        for p in norm:
            fh.write(struct.pack("<3f", *p))
        for t in tris:
            fh.write(struct.pack("<3H", *(remap[i] for i in t)))
    print(f"[bust] {len(norm)} verts, {len(tris)} tris, {os.path.getsize(OUT) / 1024:.0f} KB -> {OUT}")


if __name__ == "__main__":
    main()
