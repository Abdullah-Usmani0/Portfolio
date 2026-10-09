"""Detail finer than the elevation data, for the rendered K2 layers.

The data's cells are 31 m across; a face seen from 11 km needs detail down to a few metres.
This invents it the way a mountain gets it: gullies and ribs running straight down the fall
line (traced along the real slope, so they bend with it), rock ledges in layers, and snow
lying where the ground is gentle enough or hollow enough to hold it.

Pure numpy/scipy, so it can be tried without Blender. Every field lives on one regular grid
(rows along +y, columns along +x, `spacing` metres apart) and is defined in world metres,
so grids of different spacing draw the same large features where they meet.
"""
from __future__ import annotations

import math

import numpy as np
from scipy import ndimage


def dem_heights(dem: np.ndarray, r: np.ndarray, c: np.ndarray) -> np.ndarray:
    """Smooth (cubic spline) heights between the data's samples, at fractional row/column."""
    return ndimage.map_coordinates(dem.astype(np.float64), [r, c], order=3, mode="nearest")


def relax(dem: np.ndarray, cell_m: float, max_deg: float, iters: int = 1500, rate: float = 0.45) -> np.ndarray:
    """Thermal erosion: rock steeper than `max_deg` slumps onto the ground below it until no
    slope is steeper, keeping its volume. The elevation data has walls no mountain has
    (filled-in gaps in the radar on the steepest faces drop K2's south side 1,300 m in under
    200 m of ground); this brings them back to a face rock can stand at."""
    h = dem.astype(np.float64).copy()
    talus = math.tan(math.radians(max_deg)) * cell_m
    rows, cols = h.shape
    nb = [(-1, 0, 1.0), (1, 0, 1.0), (0, -1, 1.0), (0, 1, 1.0), (-1, -1, 2**0.5), (-1, 1, 2**0.5), (1, -1, 2**0.5), (1, 1, 2**0.5)]
    for _ in range(iters):
        p = np.pad(h, 1, mode="edge")
        ex = []
        for dr, dc, dist in nb:
            e = h - p[1 + dr : 1 + dr + rows, 1 + dc : 1 + dc + cols] - talus * dist
            ex.append(np.maximum(e, 0.0))
        total = sum(ex)
        most = np.maximum.reduce(ex)
        if most.max() < 0.5:
            break
        # Each cell gives a share of its largest excess, split between the neighbours by theirs.
        give = np.where(total > 0, rate * most / np.maximum(total, 1e-12), 0.0)
        dh = -rate * most
        for (dr, dc, _), e in zip(nb, ex):
            sent = e * give
            r0, r1 = max(0, dr), rows + min(0, dr)
            c0, c1 = max(0, dc), cols + min(0, dc)
            dh[r0:r1, c0:c1] += sent[r0 - dr : r1 - dr, c0 - dc : c1 - dc]
        h += dh
    return h


def smoothstep(e0: float, e1: float, x: np.ndarray) -> np.ndarray:
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def _hash(ix: np.ndarray, iy: np.ndarray, seed: int) -> np.ndarray:
    h = (ix * 374761393 + iy * 668265263 + seed * 2246822519) & 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    return h ^ (h >> 16)


def perlin(x: np.ndarray, y: np.ndarray, seed: int) -> np.ndarray:
    """2D gradient noise in about −1…1, one wavelength per unit."""
    xi = np.floor(x).astype(np.int64)
    yi = np.floor(y).astype(np.int64)
    xf = (x - xi).astype(np.float32)
    yf = (y - yi).astype(np.float32)

    def corner(dx: int, dy: int) -> np.ndarray:
        a = (_hash(xi + dx, yi + dy, seed) & 1023).astype(np.float32) * np.float32(2 * math.pi / 1024)
        return np.cos(a) * (xf - dx) + np.sin(a) * (yf - dy)

    u = xf * xf * xf * (xf * (xf * 6 - 15) + 10)
    v = yf * yf * yf * (yf * (yf * 6 - 15) + 10)
    top = corner(0, 0) * (1 - u) + corner(1, 0) * u
    bot = corner(0, 1) * (1 - u) + corner(1, 1) * u
    return (top * (1 - v) + bot * v) * np.float32(1.41)


def ridged(x: np.ndarray, y: np.ndarray, longest: float, shortest: float, seed: int = 17) -> np.ndarray:
    """Ridged multifractal height (metres): knobbly crests, each wavelength's height a fixed
    share of its length, from `longest` down to `shortest`."""
    out = np.zeros(x.shape, dtype=np.float32)
    weight = np.ones(x.shape, dtype=np.float32)
    lam = longest
    k = 0
    while lam >= shortest:
        n = 1.0 - np.abs(perlin(x / lam, y / lam, seed + k))
        n = n * n * weight
        weight = np.clip(n * 1.6, 0.0, 1.0)
        out += (n - 0.33) * np.float32(lam * 0.075)
        lam *= 0.5
        k += 1
    return out


def fall_line(h: np.ndarray, spacing: float, sigma_m: float) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """The downhill direction (unit x, y) of the ground smoothed over `sigma_m`, and its slope in degrees."""
    hs = ndimage.gaussian_filter(h, max(0.5, sigma_m / spacing), mode="nearest")
    gy, gx = np.gradient(hs, spacing)
    n = np.hypot(gx, gy)
    inv = 1.0 / (n + 1e-9)
    return (-gx * inv).astype(np.float32), (-gy * inv).astype(np.float32), np.degrees(np.arctan(n)).astype(np.float32)


def lic(field: np.ndarray, ux: np.ndarray, uy: np.ndarray, half_cells: float, steps: int) -> np.ndarray:
    """Line integral convolution: each cell averages `field` along the streamline of (ux, uy)
    through it, `half_cells` each way, so whatever pattern `field` has is drawn out into
    streaks that follow the direction field."""
    rows, cols = field.shape
    r0, c0 = np.mgrid[0:rows, 0:cols].astype(np.float32)
    acc = field.astype(np.float32).copy()
    wsum = np.ones_like(acc)
    dt = np.float32(half_cells / steps)
    for sgn in (1.0, -1.0):
        r, c = r0.copy(), c0.copy()
        for k in range(1, steps + 1):
            coords = np.stack([r, c])
            vx = ndimage.map_coordinates(ux, coords, order=1, mode="nearest")
            vy = ndimage.map_coordinates(uy, coords, order=1, mode="nearest")
            r += np.float32(sgn) * dt * vy
            c += np.float32(sgn) * dt * vx
            w = np.float32(0.5 + 0.5 * math.cos(math.pi * k / (steps + 1)))
            acc += w * ndimage.map_coordinates(field, np.stack([r, c]), order=1, mode="nearest")
            wsum += w
    return acc / wsum


def streaks(x: np.ndarray, y: np.ndarray, ux: np.ndarray, uy: np.ndarray, spacing: float, lam_min: float, lam_max: float, seed: int = 101, length: float = 2.2) -> list[tuple[float, np.ndarray]]:
    """Streaks along the fall line at wavelengths `lam_min`…`lam_max` (each double the last),
    as unit-variance fields on the full grid. Each is worked out on a grid coarsened to suit
    its wavelength, then brought back up, so the wide ones cost almost nothing."""
    out: list[tuple[float, np.ndarray]] = []
    lam = lam_min
    k = 0
    while lam <= lam_max * 1.001:
        f = max(1, int(lam / (3.0 * spacing)))
        xs, ys = x[::f, ::f], y[::f, ::f]
        n = perlin(xs / lam, ys / lam, seed + k)
        z = lic(n, ux[::f, ::f], uy[::f, ::f], half_cells=length * lam / (spacing * f), steps=6)
        z = (z - z.mean()) / (z.std() + 1e-9)
        if f > 1:
            rr, cc = np.mgrid[0 : x.shape[0], 0 : x.shape[1]].astype(np.float32)
            z = ndimage.map_coordinates(z, np.stack([rr / f, cc / f]), order=1, mode="nearest")
        out.append((lam, z.astype(np.float32)))
        lam *= 2.0
        k += 1
    return out


def carve(h0: np.ndarray, x: np.ndarray, y: np.ndarray, spacing: float) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """The data's ground with gullies and ribs cut down every steep face, and a little rough
    relief elsewhere. Returns the heights, the ribs (unit spread, positive along a crest,
    negative down a gully) and the streak pattern for the rock's stains."""
    ux, uy, slope = fall_line(h0, spacing, sigma_m=110.0)
    lam_min = max(3.0 * spacing, 4.0)
    fields = streaks(x, y, ux, uy, spacing, lam_min, 170.0)
    cut = np.zeros_like(h0, dtype=np.float32)
    ribs = np.zeros_like(h0, dtype=np.float32)
    stain = np.zeros_like(h0, dtype=np.float32)
    for k, (lam, z) in enumerate(fields):
        # Sharp-crested ribs between rounded gullies, deeper the wider they are, each
        # deepening and fading along its course.
        rib = np.float32(1.0) - np.abs(np.tanh(z * 0.9))
        depth = np.float32(0.55) + np.float32(0.45) * perlin(x / (2.5 * lam), y / (2.5 * lam), 60 + k)
        cut += (rib - np.float32(0.45)) * depth * np.float32(0.16 * lam * (1.0 - 0.3 * lam / 170.0))
        ribs += (rib - np.float32(0.45)) * np.float32((lam / 170.0) ** 0.25)
        stain += z * np.float32((lam / 170.0) ** 0.4)
    steep = smoothstep(16.0, 42.0, slope)
    # Crags: knobbly relief, a little everywhere and most on the steepest walls.
    crag = smoothstep(45.0, 65.0, slope)
    rough = ridged(x, y, 520.0, max(4.0, 4.0 * spacing)) * np.float32(0.6)
    h = h0 + cut * steep + rough * (np.float32(0.25) + np.float32(0.6) * steep + np.float32(2.0) * crag)
    h = terrace(h, x, y, spacing, smoothstep(30.0, 50.0, slope))
    return h.astype(np.float64), ribs / (ribs.std() + 1e-9), stain / (stain.std() + 1e-9)


def terrace(h: np.ndarray, x: np.ndarray, y: np.ndarray, spacing: float, where: np.ndarray) -> np.ndarray:
    """Rock in layers: steep ground stepped into ledges and short cliffs, the layers warped
    and unevenly thick, stronger in some places than others. Snow then settles on the ledges
    of its own accord, because they are gentler."""
    warp = perlin(x / 600.0, y / 600.0, 21) * 55.0 + perlin(x / 170.0, y / 170.0, 22) * 12.0
    thick = 46.0 * (1.0 + 0.5 * perlin(x / 700.0, y / 700.0, 23))
    v = (h + warp) / thick
    base = np.floor(v)
    stepped = (base + smoothstep(0.62, 0.98, v - base)) * thick - warp
    strength = where * smoothstep(0.0, 0.6, perlin(x / 450.0, y / 450.0, 24)) * 0.4
    if thick.min() < 2.5 * spacing:  # layers thinner than the mesh can draw would only alias
        strength = strength * smoothstep(2.5 * spacing, 4.0 * spacing, thick)
    return h + (stepped - h) * strength


def surface(h: np.ndarray, x: np.ndarray, y: np.ndarray, spacing: float, ribs: np.ndarray, stain: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """From the carved ground: how readily snow lies (above 0.5 it does; the renderer draws
    the exact edge, finer than the mesh), how pale the bare rock is (0–1), and how dull the
    white is (0 fresh snow, 1 old glacier ice).

    Snow holds on anything gentle; on a steep face it fills the gullies and the ribs between
    stand out bare, and the steepest walls hold almost none. Below about 5,500 m it thins out
    to bare rock and scree. The low, gentle ground is glacier: grey ice, striped with the dark
    moraines it carries down from every junction, drawn out along its flow."""
    hs = ndimage.gaussian_filter(h, 0.8, mode="nearest")
    gy, gx = np.gradient(hs, spacing)
    slope = np.degrees(np.arctan(np.hypot(gx, gy)))
    steep_area = slope > 35
    # Hollow (positive) or crest (negative), at two scales, each in its own units.
    hollow = np.zeros_like(h, dtype=np.float32)
    for sigma_m, weight in ((14.0, 0.2), (40.0, 0.15)):
        c = ndimage.gaussian_laplace(h, max(0.8, sigma_m / spacing), mode="nearest")
        c = c / (np.std(c[steep_area]) + 1e-9) if steep_area.any() else c * 0
        hollow += np.float32(weight) * np.tanh(c * 0.8).astype(np.float32)
    gentle = smoothstep(64.0, 42.0, slope)
    wall = smoothstep(66.0, 80.0, slope)
    # Some faces are plastered white, others scoured to their ribs: more so on the big
    # crests, where the wind strips them.
    crest = ndimage.gaussian_laplace(h, max(0.8, 150.0 / spacing), mode="nearest")
    crest = crest / (np.std(crest[steep_area]) + 1e-9) if steep_area.any() else crest * 0
    exposed = smoothstep(-0.5, 0.7, perlin(x / 700.0, y / 700.0, 12) + 0.25 * perlin(x / 230.0, y / 230.0, 13) - 0.55 * np.tanh(crest))
    ribbed = 0.5 - 0.5 * np.tanh(ribs * 1.2)
    on_steep = (1.0 - exposed) * 0.8 + exposed * ribbed
    potential = 0.1 + 0.9 * gentle + (1.0 - gentle) * on_steep + hollow - 0.35 * wall
    # The snow line, ragged.
    line = h + perlin(x / 400.0, y / 400.0, 14) * 160.0 + perlin(x / 90.0, y / 90.0, 15) * 40.0
    potential = potential - 0.6 * smoothstep(5500.0, 4950.0, line)
    # Glacier: the low, gentle ground, judged over a few hundred metres.
    flat = ndimage.gaussian_filter(slope, max(0.8, 60.0 / spacing), mode="nearest")
    glacier = smoothstep(17.0, 9.0, flat) * smoothstep(5650.0, 5250.0, h)
    dull = np.zeros_like(h, dtype=np.float32)
    if glacier.max() > 0.01:
        fx, fy, _ = fall_line(h, spacing, sigma_m=450.0)
        lam = max(70.0, 6.0 * spacing)
        (_, flow), = streaks(x, y, fx, fy, spacing, lam, lam, seed=303, length=7.0)
        moraine = smoothstep(0.7, 1.3, flow + 0.35 * perlin(x / 300.0, y / 300.0, 16))
        potential = potential * (1.0 - glacier) + glacier * (0.95 - 1.1 * moraine)
        dull = glacier * 0.75
    band = perlin(x / 300.0, y / 300.0, 7) * 18.0
    layers = 0.5 + 0.5 * np.sin((h + band) * (2 * math.pi / 37.0))
    broad = perlin(x / 900.0, y / 900.0, 11)
    mid = perlin(x / 240.0, y / 240.0, 17) * 0.6 + perlin(x / 70.0, y / 70.0, 18) * 0.4
    tone = 0.52 + 0.22 * np.tanh(stain * 0.9) - 0.08 * layers + 0.16 * broad + 0.14 * mid
    return potential.astype(np.float32), np.clip(tone, 0.0, 1.0).astype(np.float32), dull.astype(np.float32)
