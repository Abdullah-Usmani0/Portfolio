"""K2 as a panorama of layered skylines, from the same terrain data as mountain.py.

The viewer stands on the glacier south of K2 (towards Concordia) and turns through a wide
arc. For each degree-slice of that arc a ray marches through the heightfield; within each
distance band the highest elevation angle is that band's skyline. The site paints the bands
far to near as flat, layered silhouettes: the real mountain, drawn like an illustration.

    /home/user/.venvs/blender/bin/python blender/k2_panorama.py

Out: src/world/data/k2.json — per band, the skyline as elevation angles (degrees) sampled
evenly across the arc (x = 0 at the left edge, 1 at the right), far band first.
Attribution: Terrain Tiles (Mapzen / AWS Open Data), see mountain.py.
"""
from __future__ import annotations

import json
import math
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mountain import mosaic  # noqa: E402

ARC_DEG = 124.0
COLUMNS = 1400
STEP_M = 12.0
EYE_ABOVE_GROUND_M = 320.0
EYE_DISTANCE_KM = 11.0  # roughly Concordia, where the classic view of K2 is
# Near → far (km). The last band holds K2 itself.
BANDS_KM = [(0.3, 1.5), (1.5, 3.0), (3.0, 5.5), (5.5, 9.0), (9.0, 40.0)]
EARTH_R = 6_371_000.0
REFRACTION = 0.13
TOLERANCE_DEG = 0.025
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src", "world", "data", "k2.json")


def bilinear(dem: np.ndarray, r: np.ndarray, c: np.ndarray) -> np.ndarray:
    h, w = dem.shape
    r0 = np.clip(np.floor(r).astype(int), 0, h - 2)
    c0 = np.clip(np.floor(c).astype(int), 0, w - 2)
    fr = np.clip(r - r0, 0, 1)
    fc = np.clip(c - c0, 0, 1)
    top = dem[r0, c0] * (1 - fc) + dem[r0, c0 + 1] * fc
    bot = dem[r0 + 1, c0] * (1 - fc) + dem[r0 + 1, c0 + 1] * fc
    return top * (1 - fr) + bot * fr


def simplify(points: list[tuple[float, float]], tol: float) -> list[tuple[float, float]]:
    """Ramer–Douglas–Peucker on (x, angle) pairs, x scaled to degrees so tol is isotropic."""
    if len(points) < 3:
        return points
    (x0, y0), (x1, y1) = points[0], points[-1]
    dx, dy = (x1 - x0) * ARC_DEG, y1 - y0
    norm = math.hypot(dx, dy) or 1.0
    best, idx = 0.0, 0
    for i in range(1, len(points) - 1):
        px, py = points[i][0] * ARC_DEG, points[i][1]
        d = abs(dy * (px - x0 * ARC_DEG) - dx * (py - y0)) / norm
        if d > best:
            best, idx = d, i
    if best <= tol:
        return [points[0], points[-1]]
    return simplify(points[: idx + 1], tol)[:-1] + simplify(points[idx:], tol)


def main() -> None:
    dem, m_per_px, (sr, sc) = mosaic("k2", 12, 1)
    rows, cols = dem.shape
    summit_m = float(dem[sr, sc])

    # The eye: on the glacier south of K2 (the lowest ground across the valley at that
    # distance), a little above the ice.
    er = float(min(rows - 2, sr + round(EYE_DISTANCE_KM * 1000 / m_per_px)))
    lo, hi = max(0, sc - 200), min(cols, sc + 200)
    ec = float(lo + int(np.argmin(dem[int(er), lo:hi])))
    eye_h = float(bilinear(dem, np.array([er]), np.array([ec]))[0]) + EYE_ABOVE_GROUND_M
    bearing_summit = math.atan2(sc - ec, -(sr - er))  # radians from north, east positive

    xs = np.linspace(0.0, 1.0, COLUMNS)
    az = bearing_summit + np.radians((xs - 0.5) * ARC_DEG)
    dists = np.arange(STEP_M, 40_000.0, STEP_M)
    rr = er - np.cos(az)[:, None] * dists[None, :] / m_per_px
    cc = ec + np.sin(az)[:, None] * dists[None, :] / m_per_px
    inside = (rr >= 0) & (rr <= rows - 1) & (cc >= 0) & (cc <= cols - 1)
    heights = bilinear(dem, rr, cc)
    drop = (dists**2) / (2 * EARTH_R) * (1 - REFRACTION)
    angle = np.degrees(np.arctan2(heights - drop[None, :] - eye_h, dists[None, :]))
    angle = np.where(inside, angle, -90.0)

    layers = []
    for near, far in BANDS_KM:
        band = (dists >= near * 1000) & (dists < far * 1000)
        sky = angle[:, band].max(axis=1)
        floor = float(np.percentile(sky[sky > -89], 2)) if np.any(sky > -89) else 0.0
        sky = np.where(sky < -89, floor, sky)  # no terrain in this band: rest on its floor
        pts = simplify([(float(x), float(a)) for x, a in zip(xs, sky)], TOLERANCE_DEG)
        layers.append(
            {
                "near_km": near,
                "far_km": min(far, 30.0),
                "x": [round(p[0], 4) for p in pts],
                "deg": [round(p[1], 3) for p in pts],
            }
        )
    layers.reverse()  # far first, for painting order

    summit_deg = max(layers[0]["deg"])
    out = {
        "arc_deg": ARC_DEG,
        "summit": {"x": 0.5, "deg": round(summit_deg, 3), "elevation_m": round(summit_m)},
        "eye": {"elevation_m": round(eye_h), "distance_km": round(math.hypot(sr - er, sc - ec) * m_per_px / 1000, 1)},
        "layers": layers,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as fh:
        json.dump(out, fh, separators=(",", ":"))
    print(
        f"[k2] summit {summit_m:.0f} m at {summit_deg:.1f} deg, eye {eye_h:.0f} m {out['eye']['distance_km']} km away, "
        f"points per layer {[len(l['x']) for l in layers]}, {os.path.getsize(OUT) / 1024:.0f} KB -> {OUT}"
    )


if __name__ == "__main__":
    main()
