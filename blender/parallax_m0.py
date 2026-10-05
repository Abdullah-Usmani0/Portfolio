"""K2 as layered parallax plates: the 2D fallback for low tiers, mobile and no-WebGL.

Renders the same world as the look-dev, one depth layer at a time, from a shot that puts
K2 in the upper third:

  sky     the world only (opaque)
  far     K2, the ridges and the moon (transparent)
  clouds  the cloud bank (transparent)
  valley  everything near: terrain, river, trees, village, villagers (transparent)

scripts/parallax.sh then slides the plates at different speeds (Firewatch-style), breathes
the alpenglow and loops it. Plates are rendered wider than the frame to leave room to pan.

  python blender/parallax_m0.py -- --look dusk --width 1760 --height 900 --samples 64
"""
from __future__ import annotations

import argparse
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402

import kit  # noqa: E402
import lookdev_m0 as L  # noqa: E402

FAR = {"K2", "Ridges", "Moon"}
CLOUDS = {"Clouds"}
# The plates reproduce the establish shot exactly (28 mm, shift -0.07 at 16:9), only wider:
# the sensor is fitted vertically so extra width adds room to pan, not a different framing.
LENS = 28.0
SENSOR_H = 36.0 * 9 / 16


def only(names: set[str] | None) -> None:
    """Render only objects whose name is in `names` (None = render nothing but the world)."""
    for ob in bpy.data.objects:
        if ob.type in {"CAMERA", "LIGHT"}:
            continue
        ob.hide_render = names is None or ob.name not in names


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--look", default="dusk")
    ap.add_argument("--width", type=int, default=1760)
    ap.add_argument("--height", type=int, default=900)
    ap.add_argument("--samples", type=int, default=64)
    ap.add_argument("--quick", action="store_true")
    args = ap.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:])

    kit.reset_scene()
    t = time.time()
    L.build_world(args.quick)
    print(f"[parallax] world built in {time.time() - t:.1f}s")
    cam = (L.CAM_LOC[0], L.CAM_LOC[1], L.terrain_h(L.CAM_LOC[0], L.CAM_LOC[1]) + 3.0)
    cam_ob = kit.camera("Cam", cam, L.CAM_TARGET, lens=LENS)
    cam_ob.data.sensor_fit = "VERTICAL"
    cam_ob.data.sensor_height = SENSOR_H
    # Blender measures shift in the larger frame dimension; keep the 16:9 shift in pixels.
    cam_ob.data.shift_y = -0.07 * (16 / 9) * args.height / args.width
    kit.setup_cycles(args.width, args.height, args.samples)
    L.apply_look(L.LOOKS[args.look])

    out_dir = os.path.join(kit.OUT, "parallax")
    os.makedirs(out_dir, exist_ok=True)
    everything = {ob.name for ob in bpy.data.objects if ob.type not in {"CAMERA", "LIGHT"}}
    near = everything - FAR - CLOUDS
    scene = bpy.context.scene
    for layer, names, transparent in (
        ("sky", None, False),
        ("far", FAR, True),
        ("clouds", CLOUDS, True),
        ("valley", near, True),
    ):
        only(names)
        scene.render.film_transparent = transparent
        scene.render.image_settings.color_mode = "RGBA" if transparent else "RGB"
        path = os.path.join(out_dir, f"{args.look}_{layer}.png")
        t = time.time()
        kit.render_to(path)
        print(f"[parallax] {layer}: {time.time() - t:.1f}s -> {path}")


if __name__ == "__main__":
    main()
