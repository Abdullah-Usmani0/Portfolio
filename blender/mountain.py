"""K2 from real terrain data (AWS Terrain Tiles, terrarium encoding).

    elevation_m = (R * 256 + G + B / 256) - 32768

Tiles are fetched once into blender/.cache/dem/ and the built meshes are
committed, so a normal build never touches the network.

Attribution: Terrain Tiles (Mapzen / AWS Open Data) — sources include SRTM,
ETOPO1, GMTED and others; see https://github.com/tilezen/joerd/blob/master/docs/attribution.md
"""
from __future__ import annotations

import math
import os
import subprocess
import sys

import bpy  # must precede bmesh/mathutils when bpy is a pip module
import bmesh
import numpy as np
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit  # noqa: E402

TILE_URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
DEM_DIR = os.path.join(kit.CACHE, "dem")
os.makedirs(DEM_DIR, exist_ok=True)

PEAKS = {
    "k2": (35.8825, 76.5133),
    "everest": (27.9881, 86.9250),
}


def lonlat_to_tile(lat: float, lon: float, z: int) -> tuple[float, float]:
    n = 2**z
    x = (lon + 180.0) / 360.0 * n
    y = (1.0 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2.0 * n
    return x, y


def fetch_tile(z: int, x: int, y: int) -> str:
    path = os.path.join(DEM_DIR, f"{z}_{x}_{y}.png")
    if not os.path.exists(path) or os.path.getsize(path) < 1000:
        url = TILE_URL.format(z=z, x=x, y=y)
        subprocess.run(["curl", "-sSf", "--max-time", "60", "-o", path, url], check=True)
    return path


def decode_tile(path: str) -> np.ndarray:
    """PNG -> (256, 256) metres, row 0 = north."""
    img = bpy.data.images.load(path, check_existing=False)
    img.colorspace_settings.name = "Non-Color"
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    bpy.data.images.remove(img)
    px = px.reshape(h, w, 4)[::-1]  # Blender stores bottom row first
    rgb = np.round(px[:, :, :3] * 255.0)
    return rgb[:, :, 0] * 256.0 + rgb[:, :, 1] + rgb[:, :, 2] / 256.0 - 32768.0


def mosaic(peak: str = "k2", z: int = 12, radius_tiles: int = 1) -> tuple[np.ndarray, float, tuple[int, int]]:
    """Stitched DEM around a peak. Returns (heights[m], metres_per_px, summit_rc)."""
    lat, lon = PEAKS[peak]
    fx, fy = lonlat_to_tile(lat, lon, z)
    cx, cy = int(fx), int(fy)
    rows = []
    for ty in range(cy - radius_tiles, cy + radius_tiles + 1):
        row = [decode_tile(fetch_tile(z, tx, ty)) for tx in range(cx - radius_tiles, cx + radius_tiles + 1)]
        rows.append(np.concatenate(row, axis=1))
    dem = np.concatenate(rows, axis=0)
    m_per_px = 40075016.686 * math.cos(math.radians(lat)) / (2**z) / 256.0
    r, c = np.unravel_index(np.argmax(dem), dem.shape)
    return dem, m_per_px, (int(r), int(c))


def build_mountain(
    name: str = "K2",
    peak: str = "k2",
    grid: int = 220,
    span_m: float = 19000.0,
    scale: float = 0.25,
    falloff_start_m: float = 3800.0,
    falloff_end_m: float = 9000.0,
    falloff_keep: float = 0.32,
    col: bpy.types.Collection | None = None,
) -> bpy.types.Object:
    """A faceted, coloured massif centred on the summit (summit at local x=y=0)."""
    dem, mpp, (sr, sc) = mosaic(peak)
    base = float(np.percentile(dem, 8))
    half_px = span_m / mpp / 2.0
    xs = np.linspace(-half_px, half_px, grid + 1)
    # bilinear sample helper
    def sample(rf: float, cf: float) -> float:
        r0 = int(np.clip(math.floor(rf), 0, dem.shape[0] - 2))
        c0 = int(np.clip(math.floor(cf), 0, dem.shape[1] - 2))
        tr, tc = rf - r0, cf - c0
        a = dem[r0, c0] * (1 - tc) + dem[r0, c0 + 1] * tc
        b = dem[r0 + 1, c0] * (1 - tc) + dem[r0 + 1, c0 + 1] * tc
        return float(a * (1 - tr) + b * tr)

    bm = bmesh.new()
    verts = []
    heights = np.zeros((grid + 1, grid + 1), dtype=np.float32)
    for j, dy in enumerate(xs):  # dy: +north in px
        row = []
        for i, dx in enumerate(xs):
            h = sample(sr - dy, sc + dx)
            r_m = math.hypot(dx, dy) * mpp
            w = 1.0 - (1.0 - falloff_keep) * kit.smoothstep(falloff_start_m, falloff_end_m, r_m)
            hh = base + (h - base) * w
            heights[j, i] = hh
            row.append(bm.verts.new((dx * mpp * scale, dy * mpp * scale, (hh - base) * scale)))
        verts.append(row)
    for j in range(grid):
        for i in range(grid):
            a, b, c, d = verts[j][i], verts[j][i + 1], verts[j + 1][i + 1], verts[j + 1][i]
            if (i + j) % 2 == 0:
                bm.faces.new((a, b, c)); bm.faces.new((a, c, d))
            else:
                bm.faces.new((a, b, d)); bm.faces.new((b, c, d))
    ob = kit.obj_from_bmesh(bm, name, col)
    kit.flat(ob)
    ob["zv_peak"] = peak
    ob["zv_summit_m"] = float(dem.max())
    ob["zv_scale"] = scale

    snowline = base + 0.42 * (float(dem.max()) - base)
    rock, rock_dark, snow, glacier = kit.PAL["rock"], kit.PAL["rock_dark"], kit.PAL["snow"], kit.PAL["glacier"]
    moraine = kit.hex_lin("#9a8a78")
    zscale = scale

    def color(poly: bpy.types.MeshPolygon) -> kit.Color:
        z = poly.center.z / zscale + base
        nz = poly.normal.z
        n = kit.fbm(poly.center.x * 0.004, poly.center.y * 0.004, 3)
        if z > snowline + n * 180 and nz > 0.42:
            return kit.mix(snow, glacier, max(0.0, 0.25 - nz * 0.2))
        if nz > 0.9 and z < snowline:
            return kit.mix(glacier, moraine, kit.smoothstep(0.0, 1.0, n * 0.5 + 0.5))
        t = kit.smoothstep(0.35, 0.8, nz)
        c = kit.mix(rock_dark, rock, t * 0.7 + 0.15 * n)
        if z > snowline - 250 and nz > 0.55:
            c = kit.mix(c, snow, 0.55)
        return c

    kit.paint_faces(ob, color)
    kit.assign(ob, kit.snow_material())
    return ob


if __name__ == "__main__":
    kit.reset_scene()
    dem, mpp, (sr, sc) = mosaic("k2")
    print(f"DEM {dem.shape} {mpp:.1f} m/px, max {dem.max():.0f} m at {(sr, sc)}, min {dem.min():.0f} m")
