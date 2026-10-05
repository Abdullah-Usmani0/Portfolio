"""Heightfield of the foreground hill, for placing grass blades in the browser.

Samples the same terrain function the meshes use, so blades sit exactly on the ground.
Out: public/models/hill_height_m0.bin  (Int16 centimetres, row-major, rows along three's +z)
     metadata is merged into public/models/valley_m0.json under "heightfield".
Coordinates: three frame (x, z) where z = -blender_y.
"""
from __future__ import annotations

import json
import os
import struct
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402,F401  (initialises the bundled modules)

import kit  # noqa: E402
import lookdev_m0 as L  # noqa: E402

X0, X1 = -210.0, 70.0          # three x
Z0, Z1 = 70.0, 350.0           # three z  (= -blender y): covers the hill around the camera
STEP = 1.0


def main() -> None:
    nx = int((X1 - X0) / STEP) + 1
    nz = int((Z1 - Z0) / STEP) + 1
    data = bytearray()
    for j in range(nz):
        z3 = Z0 + j * STEP
        for i in range(nx):
            x3 = X0 + i * STEP
            cm = round(L.terrain_h(x3, -z3) * 100.0)
            data += struct.pack("<h", max(-32768, min(32767, cm)))
    path = os.path.join(kit.PUBLIC_MODELS, "hill_height_m0.bin")
    with open(path, "wb") as fh:
        fh.write(data)
    meta_path = os.path.join(kit.PUBLIC_MODELS, "valley_m0.json")
    with open(meta_path) as fh:
        meta = json.load(fh)
    meta["heightfield"] = {"url": "/models/hill_height_m0.bin", "x0": X0, "z0": Z0, "step": STEP, "nx": nx, "nz": nz, "encoding": "int16-cm"}
    with open(meta_path, "w") as fh:
        json.dump(meta, fh, separators=(",", ":"))
    print(f"[web] hill_height_m0.bin {nx}x{nz} = {len(data) / 1024:.0f} KB")


if __name__ == "__main__":
    main()
