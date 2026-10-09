"""
Pines for the foreground renders (foreground_render.py): a spruce built from its trunk and
whorls of drooping branches, each branch a few ragged clumps of needles. A tree is made one
unit tall and one unit wide at its lowest branches, so the renders can stretch it to the size
of the pine it replaces in the painted layer.
"""
from __future__ import annotations

import math

import bpy
import numpy as np

# One clump: an icosahedron split twice, then roughed up so its outline is broken, not round.
_ICO: tuple[np.ndarray, np.ndarray] | None = None


def _icosphere() -> tuple[np.ndarray, np.ndarray]:
    global _ICO
    if _ICO is not None:
        return _ICO
    t = (1 + math.sqrt(5)) / 2
    v = [(-1, t, 0), (1, t, 0), (-1, -t, 0), (1, -t, 0), (0, -1, t), (0, 1, t), (0, -1, -t), (0, 1, -t), (t, 0, -1), (t, 0, 1), (-t, 0, -1), (-t, 0, 1)]
    f = [(0, 11, 5), (0, 5, 1), (0, 1, 7), (0, 7, 10), (0, 10, 11), (1, 5, 9), (5, 11, 4), (11, 10, 2), (10, 7, 6), (7, 1, 8), (3, 9, 4), (3, 4, 2), (3, 2, 6), (3, 6, 8), (3, 8, 9), (4, 9, 5), (2, 4, 11), (6, 2, 10), (8, 6, 7), (9, 8, 1)]
    verts = [np.array(p, dtype=np.float64) / np.linalg.norm(p) for p in v]
    faces = f
    for _ in range(2):
        cache: dict[tuple[int, int], int] = {}

        def mid(a: int, b: int) -> int:
            key = (min(a, b), max(a, b))
            if key not in cache:
                m = verts[a] + verts[b]
                verts.append(m / np.linalg.norm(m))
                cache[key] = len(verts) - 1
            return cache[key]

        nf = []
        for a, b, c in faces:
            ab, bc, ca = mid(a, b), mid(b, c), mid(c, a)
            nf += [(a, ab, ca), (b, bc, ab), (c, ca, bc), (ab, bc, ca)]
        faces = nf
    _ICO = (np.array(verts), np.array(faces, dtype=np.int32))
    return _ICO


def spruce(name: str, seed: int, whorls: int = 22) -> bpy.types.Object:
    """A spruce one unit tall: a narrow trunk, and whorls of branches that droop more the
    lower they hang, shortest at the top, so the crown tapers to a spire. Vertex attribute
    `height` (0 at the foot, 1 at the tip) lets the renders mark how far each part sways."""
    rng = np.random.default_rng(seed)
    ico_v, ico_f = _icosphere()
    verts: list[np.ndarray] = []
    faces: list[np.ndarray] = []
    shade: list[np.ndarray] = []
    count = 0

    def add(v: np.ndarray, f: np.ndarray, s: float) -> None:
        nonlocal count
        verts.append(v)
        faces.append(f + count)
        shade.append(np.full(len(v), s, dtype=np.float32))
        count += len(v)

    # Trunk: a tapered octagonal column, mostly hidden by the branches.
    sides = 8
    rings = np.array([0.0, 0.25, 0.6, 1.0])
    ang = np.linspace(0, 2 * math.pi, sides, endpoint=False)
    tv = []
    for z in rings:
        r = 0.022 * (1 - z) + 0.002
        tv += [(r * math.cos(a), r * math.sin(a), z) for a in ang]
    tf = []
    for k in range(len(rings) - 1):
        for i in range(sides):
            j = (i + 1) % sides
            a, b = k * sides + i, k * sides + j
            tf += [(a, b, b + sides), (a, b + sides, a + sides)]
    add(np.array(tv), np.array(tf, dtype=np.int32), 0.0)

    lean = rng.normal(0, 0.012, 2)
    crown_base = 0.1 + rng.uniform(0, 0.06)
    phase = rng.uniform(0, 2 * math.pi)
    for k in range(whorls):
        # Whorls bunch towards the top, where the growth is young.
        u = (k + rng.uniform(-0.3, 0.3)) / whorls
        z = crown_base + (1 - crown_base) * (1 - (1 - u) ** 1.25)
        z = min(z, 0.985)
        up = (z - crown_base) / (1 - crown_base)
        reach = 0.5 * (1 - up) ** 0.92 + 0.012
        n_branch = 5 + int(rng.integers(0, 3)) if up < 0.85 else 4
        for b in range(n_branch):
            az = phase + k * 2.39996 + b * 2 * math.pi / n_branch + rng.normal(0, 0.25)
            length = reach * rng.uniform(0.78, 1.12)
            # Lower branches sweep down at their tips; the young ones at the top reach up.
            droop = 0.06 + 0.22 * (1 - up)
            d = np.array([math.cos(az), math.sin(az)])
            n_clumps = max(1, int(round(length / 0.055)))
            for c in range(n_clumps):
                s = (c + 0.6) / n_clumps
                # Along the branch: out from the trunk, sagging towards the tip.
                along = length * s
                cx, cy = d * along + lean * z
                cz = max(0.03, z - droop * along * s + rng.normal(0, 0.004))
                size = (0.045 + 0.05 * length) * (1.15 - 0.45 * s) * rng.uniform(0.8, 1.2)
                v = ico_v.copy()
                # Rough: lumps and spikes, so the clump's edge is needle-ragged.
                rough = 1 + 0.32 * rng.standard_normal(len(v)) * np.abs(v[:, 2] * 0.5 + 0.7)
                v = v * rough[:, None]
                # Flattened, longer along the branch than across it.
                v[:, 0] *= size * 1.3
                v[:, 1] *= size * 1.0
                v[:, 2] *= size * 0.42
                ca, sa = math.cos(az), math.sin(az)
                # Tip the clump down along the branch's sag.
                tilt = -math.atan(droop * s * 1.2)
                ct, st = math.cos(tilt), math.sin(tilt)
                x, zz = v[:, 0] * ct - v[:, 2] * st, v[:, 0] * st + v[:, 2] * ct
                v = np.stack([x * ca - v[:, 1] * sa, x * sa + v[:, 1] * ca, zz], axis=1)
                v += (cx, cy, cz)
                # Inner clumps are darker: less sky reaches the middle of the crown.
                add(v, ico_f, 0.35 + 0.65 * s)
    # A spire of a few clumps at the very top.
    for k in range(4):
        v = ico_v.copy() * np.array([0.022, 0.022, 0.05]) * (1 - 0.18 * k)
        v[:, :2] += lean * 1.0
        v[:, 2] += 0.93 + 0.022 * k
        add(v, ico_f, 1.0)

    v = np.concatenate(verts).astype(np.float32)
    f = np.concatenate(faces).astype(np.int32)
    me = bpy.data.meshes.new(name)
    me.vertices.add(len(v))
    me.vertices.foreach_set("co", v.ravel())
    me.loops.add(len(f) * 3)
    me.loops.foreach_set("vertex_index", f.ravel())
    me.polygons.add(len(f))
    me.polygons.foreach_set("loop_start", np.arange(0, len(f) * 3, 3, dtype=np.int32))
    me.update()
    me.shade_smooth()
    height = me.attributes.new("height", "FLOAT", "POINT")
    height.data.foreach_set("value", np.clip(v[:, 2], 0, 1))
    inner = me.attributes.new("inner", "FLOAT", "POINT")
    inner.data.foreach_set("value", np.concatenate(shade))
    ob = bpy.data.objects.new(name, me)
    return ob


def pine_material() -> bpy.types.Material:
    """Needles: dark green, a little light through them, olive where the sun catches the tips,
    darker towards the trunk; the trunk itself grey-brown bark."""
    mat = bpy.data.materials.new("pine")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    height = nt.nodes.new("ShaderNodeAttribute")
    height.attribute_name = "height"
    inner = nt.nodes.new("ShaderNodeAttribute")
    inner.attribute_name = "inner"
    coord = nt.nodes.new("ShaderNodeTexCoord")
    # Needle texture: fine noise in the object's own space (the same on every copy of a tree).
    fine = nt.nodes.new("ShaderNodeTexNoise")
    fine.inputs["Scale"].default_value = 220.0
    fine.inputs["Detail"].default_value = 3.0
    nt.links.new(coord.outputs["Object"], fine.inputs["Vector"])
    patch = nt.nodes.new("ShaderNodeTexNoise")
    patch.inputs["Scale"].default_value = 9.0
    nt.links.new(coord.outputs["Object"], patch.inputs["Vector"])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.25
    ramp.color_ramp.elements[0].color = (0.012, 0.03, 0.016, 1)
    ramp.color_ramp.elements[1].position = 0.8
    ramp.color_ramp.elements[1].color = (0.05, 0.085, 0.035, 1)
    mix_in = nt.nodes.new("ShaderNodeMath")
    mix_in.operation = "MULTIPLY_ADD"
    # ramp position: fine noise, lifted on the outer clumps and in sunlit patches.
    nt.links.new(fine.outputs["Fac"], mix_in.inputs[0])
    mix_in.inputs[1].default_value = 0.7
    lift = nt.nodes.new("ShaderNodeMath")
    lift.operation = "MULTIPLY_ADD"
    nt.links.new(inner.outputs["Fac"], lift.inputs[0])
    lift.inputs[1].default_value = 0.35
    nt.links.new(patch.outputs["Fac"], lift.inputs[2])
    nt.links.new(lift.outputs[0], mix_in.inputs[2])
    shift = nt.nodes.new("ShaderNodeMath")
    shift.operation = "SUBTRACT"
    nt.links.new(mix_in.outputs[0], shift.inputs[0])
    shift.inputs[1].default_value = 0.42
    nt.links.new(shift.outputs[0], ramp.inputs["Fac"])
    bark = nt.nodes.new("ShaderNodeRGB")
    bark.outputs[0].default_value = (0.06, 0.045, 0.035, 1)
    is_trunk = nt.nodes.new("ShaderNodeMath")
    is_trunk.operation = "LESS_THAN"
    nt.links.new(inner.outputs["Fac"], is_trunk.inputs[0])
    is_trunk.inputs[1].default_value = 0.01
    color = nt.nodes.new("ShaderNodeMix")
    color.data_type = "RGBA"
    nt.links.new(is_trunk.outputs[0], color.inputs["Factor"])
    nt.links.new(ramp.outputs["Color"], color.inputs["A"])
    nt.links.new(bark.outputs[0], color.inputs["B"])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.9
    bump.inputs["Distance"].default_value = 0.004
    nt.links.new(fine.outputs["Fac"], bump.inputs["Height"])
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(color.outputs["Result"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.7
    bsdf.inputs["Specular IOR Level"].default_value = 0.25
    # Light through the needles where the sun is behind them.
    trans = nt.nodes.new("ShaderNodeBsdfTranslucent")
    nt.links.new(color.outputs["Result"], trans.inputs["Color"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    nt.links.new(bump.outputs["Normal"], trans.inputs["Normal"])
    both = nt.nodes.new("ShaderNodeMixShader")
    both.inputs["Fac"].default_value = 0.22
    nt.links.new(bsdf.outputs[0], both.inputs[1])
    nt.links.new(trans.outputs[0], both.inputs[2])
    nt.links.new(both.outputs[0], out.inputs["Surface"])
    # How far each part of the tree sways: none at the foot, most at the tip.
    sway = nt.nodes.new("ShaderNodeOutputAOV")
    sway.aov_name = "sway"
    curve = nt.nodes.new("ShaderNodeMath")
    curve.operation = "POWER"
    nt.links.new(height.outputs["Fac"], curve.inputs[0])
    curve.inputs[1].default_value = 1.6
    nt.links.new(curve.outputs[0], sway.inputs["Value"])
    return mat


def shrub(name: str, seed: int) -> bpy.types.Object:
    """A low bush one unit across: a mound of the same ragged needle clumps, densest in the
    middle. It shares the pines' material (`height` and `inner` as theirs)."""
    rng = np.random.default_rng(seed)
    ico_v, ico_f = _icosphere()
    verts, faces, inner = [], [], []
    count = 0
    n = int(rng.integers(7, 13))
    for k in range(n):
        a = rng.uniform(0, 2 * math.pi)
        r = 0.32 * math.sqrt(rng.uniform(0, 1))
        cx, cy = r * math.cos(a), r * math.sin(a)
        cz = 0.08 + 0.32 * (1 - r / 0.32) * rng.uniform(0.6, 1.0)
        size = rng.uniform(0.16, 0.26)
        v = ico_v.copy()
        v = v * (1 + 0.3 * rng.standard_normal(len(v)))[:, None]
        v[:, 0] *= size * 1.1
        v[:, 1] *= size * 1.1
        v[:, 2] *= size * 0.75
        v += (cx, cy, cz)
        verts.append(v)
        faces.append(ico_f + count)
        inner.append(np.full(len(v), 0.45 + 0.55 * cz / 0.4, dtype=np.float32))
        count += len(v)
    v = np.concatenate(verts).astype(np.float32)
    f = np.concatenate(faces).astype(np.int32)
    me = bpy.data.meshes.new(name)
    me.vertices.add(len(v))
    me.vertices.foreach_set("co", v.ravel())
    me.loops.add(len(f) * 3)
    me.loops.foreach_set("vertex_index", f.ravel())
    me.polygons.add(len(f))
    me.polygons.foreach_set("loop_start", np.arange(0, len(f) * 3, 3, dtype=np.int32))
    me.update()
    me.shade_smooth()
    me.attributes.new("height", "FLOAT", "POINT").data.foreach_set("value", np.clip(v[:, 2] * 0.6, 0, 1))
    me.attributes.new("inner", "FLOAT", "POINT").data.foreach_set("value", np.clip(np.concatenate(inner), 0.02, 1))
    return bpy.data.objects.new(name, me)
