"""Bake sun visibility and ambient occlusion into vertex attributes for the web.

Realtime shadows across a 2 km valley would need cascaded shadow maps; instead we bake
what the light *does* for each of the five looks. Per vertex:

  _VISA = (dawn, day, golden, dusk)  sun visibility in [0, 1], softened by jittered rays
  _VISB = (night, ao, 0, 1)          moon visibility and sky occlusion

The browser blends the visibilities with the same weights it blends the lights with, and
multiplies them into the direct and indirect light of the Lambert shader. Everything is
deterministic (seeded) so `npm run assets` reproduces the same bytes.
"""
from __future__ import annotations

import math
import random
from collections.abc import Iterable, Sequence

import bpy  # noqa: F401  (must load before mathutils in a bpy module install)
from mathutils import Vector
from mathutils.bvhtree import BVHTree

LOOK_ORDER = ("dawn", "day", "golden", "dusk", "night")


def sun_vector(elev_deg: float, azim_deg: float) -> Vector:
    """Unit vector towards the sun, Blender frame (x right, y up-valley, z up)."""
    el, az = math.radians(elev_deg), math.radians(azim_deg)
    return Vector((math.sin(az) * math.cos(el), math.cos(az) * math.cos(el), math.sin(el)))


def build_bvh(objects: Iterable[bpy.types.Object]) -> BVHTree:
    verts: list[Vector] = []
    polys: list[list[int]] = []
    for ob in objects:
        mw = ob.matrix_world
        base = len(verts)
        verts.extend(mw @ v.co for v in ob.data.vertices)
        polys.extend([base + i for i in p.vertices] for p in ob.data.polygons)
    return BVHTree.FromPolygons(verts, polys, all_triangles=False, epsilon=0.0)


def _jittered(d: Vector, radius_deg: float, n: int, rng: random.Random) -> list[Vector]:
    """n directions inside a cone around d — soft penumbrae from a sun of finite size."""
    if n <= 1:
        return [d]
    t = d.orthogonal().normalized()
    b = d.cross(t).normalized()
    r = math.tan(math.radians(radius_deg))
    out = []
    for k in range(n):
        a = (k + rng.random()) / n * math.tau
        rr = r * math.sqrt((k + 0.5) / n)
        out.append((d + t * (math.cos(a) * rr) + b * (math.sin(a) * rr)).normalized())
    return out


def _hemisphere(n: int) -> list[Vector]:
    """Cosine-weighted directions around +Z (a spiral, so they are evenly spread)."""
    golden = math.pi * (3 - math.sqrt(5))
    out = []
    for k in range(n):
        u = (k + 0.5) / n
        r = math.sqrt(u)
        phi = k * golden
        out.append(Vector((r * math.cos(phi), r * math.sin(phi), math.sqrt(max(0.0, 1 - u)))))
    return out


def visibility_at(
    bvh: BVHTree,
    point: Vector,
    normal: Vector,
    suns: Sequence[Vector],
    rng: random.Random,
    *,
    sun_rays: int = 4,
    ao_dirs: Sequence[Vector] = (),
    ao_dist: float = 140.0,
    offset: float = 0.3,
) -> tuple[list[float], float]:
    origin = point + normal * offset
    vis = []
    for s in suns:
        if normal.dot(s) <= -0.05:
            vis.append(0.0)
            continue
        hits = sum(1 for d in _jittered(s, 1.2, sun_rays, rng) if bvh.ray_cast(origin, d, 20000.0)[0] is not None)
        vis.append(1.0 - hits / sun_rays)
    if not ao_dirs:
        return vis, 1.0
    # Rotate the fixed hemisphere into the normal's frame, with a random spin per vertex.
    z = normal.normalized()
    x = z.orthogonal().normalized()
    y = z.cross(x)
    spin = rng.random() * math.tau
    c, s_ = math.cos(spin), math.sin(spin)
    open_ = 0
    for d in ao_dirs:
        dx, dy = d.x * c - d.y * s_, d.x * s_ + d.y * c
        w = (x * dx + y * dy + z * d.z).normalized()
        if bvh.ray_cast(origin, w, ao_dist)[0] is None:
            open_ += 1
    return vis, open_ / len(ao_dirs)


def bake_mesh(ob: bpy.types.Object, bvh: BVHTree, suns: Sequence[Vector], *, seed: int, ao_rays: int = 16) -> None:
    """Write _VISA/_VISB point attributes on ob (expects POINT-domain, welded geometry)."""
    me = ob.data
    me.update()
    mw = ob.matrix_world
    nm = mw.to_3x3().inverted().transposed()
    rng = random.Random(seed)
    dirs = _hemisphere(ao_rays)
    a_vals: list[float] = []
    b_vals: list[float] = []
    for v in me.vertices:
        p = mw @ v.co
        n = (nm @ v.normal).normalized()
        vis, ao = visibility_at(bvh, p, n, suns, rng, ao_dirs=dirs)
        a_vals.extend(vis[:4])
        b_vals.extend((vis[4], ao, 0.0, 1.0))
    for name, vals in (("_VISA", a_vals), ("_VISB", b_vals)):
        if name in me.attributes:
            me.attributes.remove(me.attributes[name])
        attr = me.attributes.new(name, "FLOAT_COLOR", "POINT")
        attr.data.foreach_set("color", vals)


def bake_points(points: Iterable[Vector], bvh: BVHTree, suns: Sequence[Vector], *, seed: int, lift: float = 2.5) -> list[list[float]]:
    """Sun visibility for points (e.g. tree crowns), five looks each."""
    rng = random.Random(seed)
    up = Vector((0, 0, 1))
    return [visibility_at(bvh, p + up * lift, up, suns, rng, sun_rays=3)[0] for p in points]


__all__ = ["LOOK_ORDER", "sun_vector", "build_bvh", "bake_mesh", "bake_points"]
