"""Export the M0 valley for the browser.

Web rules (different from the Cycles look-dev):
  * Shared vertices + per-vertex colour (POINT domain) and NO normals: three.js
    recomputes faceted normals in the shader (flatShading), so files stay small.
  * Trees are instanced: a few prototype meshes + a scatter table, not 2,600 copies.
  * Villagers are split into jointed parts (origins at hips/shoulders/neck) so code
    can animate idle / walk / wave / talk.
  * glTF is Y-up: Blender (x, y, z) -> three (x, z, -y). JSON written here is already
    in three's frame.

Run:  /home/user/.venvs/blender/bin/python blender/export_web_m0.py
Out:  public/models/valley_m0.glb, k2_m0.glb, trees_m0.glb, villagers_m0.glb
      public/models/valley_m0.json (tree scatter, camera, anchors)
"""
from __future__ import annotations

import json
import math
import os
import random
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
import bmesh  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

import kit  # noqa: E402
import mountain  # noqa: E402
import lookdev_m0 as L  # noqa: E402
import bake_light  # noqa: E402

P = kit.PAL
OUT = kit.PUBLIC_MODELS


def to_three(x: float, y: float, z: float) -> list[float]:
    return [round(x, 3), round(z, 3), round(-y, 3)]


def corner_to_point_colors(ob: bpy.types.Object, name: str = "Col") -> None:
    """Average each vertex's face-corner colours into a POINT-domain attribute (shared vertices)."""
    mesh = ob.data
    src = mesh.color_attributes.get(name)
    if src is None or src.domain == "POINT":
        return
    n = len(mesh.vertices)
    acc = [[0.0, 0.0, 0.0, 0.0] for _ in range(n)]
    for loop in mesh.loops:
        c = src.data[loop.index].color
        a = acc[loop.vertex_index]
        a[0] += c[0]; a[1] += c[1]; a[2] += c[2]; a[3] += 1.0
    mesh.color_attributes.remove(src)
    dst = mesh.color_attributes.new(name=name, type="FLOAT_COLOR", domain="POINT")
    for i, a in enumerate(acc):
        k = a[3] or 1.0
        dst.data[i].color = (a[0] / k, a[1] / k, a[2] / k, 1.0)
    mesh.color_attributes.active_color = dst


def web_ready(ob: bpy.types.Object) -> bpy.types.Object:
    """Weld duplicate verts, move colours to vertices, and mark smooth (normals are dropped on export)."""
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.001)
    bm.to_mesh(ob.data)
    bm.free()
    corner_to_point_colors(ob)
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob


def export(path: str, objects: list[bpy.types.Object]) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    for ob in objects:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    kwargs = dict(filepath=path, export_format="GLB", use_selection=True, export_apply=True, export_yup=True)
    props = bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
    for k, v in (
        ("export_normals", False),
        ("export_texcoords", True),
        ("export_vertex_color", "NAME"),
        ("export_vertex_color_name", "Col"),
        ("export_all_vertex_colors", False),
        ("export_materials", "PLACEHOLDER"),
        ("export_extras", True),
        ("export_attributes", True),
        ("export_tangents", False),
    ):
        if k in props:
            kwargs[k] = v
    bpy.ops.export_scene.gltf(**kwargs)
    print(f"[web] {os.path.basename(path)}: {os.path.getsize(path) / 1024:.0f} KB")


def river_with_uv(col) -> bpy.types.Object:
    """River ribbon with UVs (u across, v along metres) for the flowing water shader."""
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    prev = None
    y, v = -360.0, 0.0
    while y <= 1500.0:
        cx = L.river_x(y)
        tx = L.river_x(y + 1.0) - cx
        nlen = math.hypot(1.0, tx)
        nxv, nyv = 1.0 / nlen, -tx / nlen
        z = L.terrain_h(cx, y) + 3.6
        w = 8.5
        left = bm.verts.new((cx - nxv * w, y - nyv * w, z))
        right = bm.verts.new((cx + nxv * w, y + nyv * w, z))
        if prev:
            f = bm.faces.new((prev[0], prev[1], right, left))
            for loop, (uu, vv) in zip(f.loops, ((0, prev[2]), (1, prev[2]), (1, v), (0, v))):
                loop[uv].uv = (uu, vv / 40.0)
        prev = (left, right, v)
        y += 4.0
        v += 4.0
    ob = kit.obj_from_bmesh(bm, "River", col)
    kit.paint_solid(ob, P["water"])
    return ob


def tree_prototypes(col) -> list[bpy.types.Object]:
    """Unit-scale prototypes at the origin; crowns are white so instances tint them."""
    out = []
    for kind in ("pine", "round"):
        rng = random.Random(3)
        for part in ("trunk", "crown"):
            bm = bmesh.new()
            if kind == "pine":
                if part == "trunk":
                    kit.add_cylinder(bm, 0.35, 1.6, (0, 0, 0), segments=5)
                else:
                    vs = []
                    for r, h, oz in [(2.6, 3.4, 1.0), (2.0, 3.0, 2.6), (1.35, 2.6, 4.0)]:
                        vs += kit.add_cone(bm, r, h, (0, 0, oz), segments=7)
                    kit.jitter(vs, rng, 0.12)
            else:
                if part == "trunk":
                    kit.add_cylinder(bm, 0.3, 2.2, (0, 0, 0), segments=5)
                else:
                    vs = kit.add_ico(bm, 2.3, (0, 0, 3.6), subdiv=1, scale=(1, 1, 0.9))
                    kit.jitter(vs, rng, 0.35)
            ob = kit.obj_from_bmesh(bm, f"tree_{kind}_{part}", col)
            kit.paint_solid(ob, P["trunk"] if part == "trunk" else (1.0, 1.0, 1.0))
            out.append(web_ready(ob))
    return out


def tree_scatter() -> list[list[float]]:
    """[x, y, z, scale, rotY, type(0 pine / 1 round), r, g, b] in three's frame; same rule set as the look-dev."""
    rng = random.Random(L.RNG_SEED + 1)

    def accept(x, y):
        if abs(x - L.river_x(y)) < 26 or L.in_field(x, y, 8):
            return False
        if math.hypot(x - L.VILLAGE[0], y - L.VILLAGE[1]) < L.VILLAGE[2] * 0.75:
            return False
        if math.hypot(x - L.FARM[0], y - L.FARM[1]) < L.FARM[2] * 0.7:
            return False
        if math.hypot(x - L.HILL[0], y - L.HILL[1]) < 60 or L.dist_to_polyline(x, y, L.path_points()) < 8:
            return False
        if math.hypot(x - L.KNOLL[0], y - L.KNOLL[1]) < 22:
            return False
        h = L.terrain_h(x, y)
        forest = kit.fbm(x * 0.008, y * 0.008, 2, seed=4.4)
        return h > -1 and (h > 22 or forest > 0.15 or rng.random() < 0.18)

    pts = kit.poisson_scatter(rng, (-510, -350, 510, 1290), 7.5, accept, 2600, tries=60000)
    rows = []
    for (x, y) in pts:
        z = L.terrain_h(x, y) - 0.3
        s = rng.uniform(0.8, 1.35)
        pine = z > 45 or rng.random() < 0.45
        if pine:
            c = kit.jitter_color(rng.choice([P["pine"], P["pine_b"]]), rng, 0.08)
        else:
            c = kit.jitter_color(rng.choice([P["leaf"], P["leaf_b"], P["leaf"], P["leaf_autumn"]]), rng, 0.08)
        rows.append([*to_three(x, y, z), round(s, 3), round(rng.uniform(0, math.tau), 3), 0 if pine else 1,
                     *(round(v, 4) for v in c)])
    return rows


def villager_rig(col, style: dict, name: str, scarf=None) -> list[bpy.types.Object]:
    """Jointed parts with origins at their pivots, parented under an empty at the feet."""
    root = bpy.data.objects.new(name, None)
    col.objects.link(root)
    shirt = kit.hex_lin(style["shirt"])
    skin = P[style["skin"]]
    pants, boots = kit.hex_lin("#3d405b"), kit.hex_lin("#5a3d2b")
    parts: list[bpy.types.Object] = []

    def part(pname: str, pivot, build):
        b = L.Builder(f"{name}_{pname}")
        build(b)
        ob = b.build(col, kit.vc_material("ZV_Character", roughness=0.6), flat=False)
        # move geometry so the object origin sits at the joint
        ob.data.transform(Matrix.Translation(-Vector(pivot)))
        ob.location = pivot
        ob.parent = root
        # Mesh quantization re-centres node origins on each part's bounds, so the joint
        # travels as glTF extras and the runtime rebuilds the pivot from it.
        ob["pivot"] = [round(v, 4) for v in to_three(*pivot)]
        parts.append(web_ready(ob))

    for side, tag in ((1, "R"), (-1, "L")):
        part(f"leg{tag}", (0.16 * side, 0, 0.55), lambda b, side=side: (
            b.part(kit.add_cylinder, pants, 0.12, 0.5, (0.16 * side, 0, 0.08), 10),
            b.part(kit.add_uvsphere, boots, 0.15, (0.16 * side, -0.05, 0.08), 12, 8, (1.0, 1.35, 0.6))))
    part("body", (0, 0, 0.6), lambda b: b.part(kit.add_uvsphere, shirt, 0.4, (0, 0, 0.98), 24, 14, (1.0, 0.86, 1.18)))

    def head(b):
        b.part(kit.add_uvsphere, skin, 0.33, (0, 0, 1.72), 24, 14)
        for side in (1, -1):
            b.part(kit.add_uvsphere, P["black"], 0.05, (0.11 * side, -0.296, 1.77), 10, 8)
            b.part(kit.add_uvsphere, P["white"], 0.016, (0.12 * side, -0.338, 1.79), 6, 4)
            b.part(kit.add_uvsphere, P["cheek"], 0.06, (0.2 * side, -0.26, 1.66), 10, 6, (1, 0.4, 0.7))
        b.part(kit.add_uvsphere, kit.hex_lin("#7a3b33"), 0.045, (0, -0.315, 1.63), 10, 6, (1.3, 0.3, 0.45))
        acc = style["acc"]
        if acc == "hat" and style["hat"]:
            hc = kit.hex_lin(style["hat"])
            b.part(kit.add_cylinder, hc, 0.48, 0.05, (0, 0, 1.96), 20)
            b.part(kit.add_cylinder, hc, 0.25, 0.24, (0, 0, 1.98), 20)
            b.part(kit.add_cylinder, shirt, 0.255, 0.07, (0, 0, 2.0), 20)
        elif acc == "beanie" and style["hat"]:
            cap = b.part(kit.add_uvsphere, kit.hex_lin(style["hat"]), 0.345, (0, 0, 1.8), 18, 9)
            for v in cap:
                v.co.z = max(v.co.z, 1.85)
            b.part(kit.add_uvsphere, kit.hex_lin("#f4f1de"), 0.08, (0, 0, 2.15), 8, 6)
        elif acc == "glasses":
            for side in (1, -1):
                b.part(kit.add_cylinder, P["black"], 0.085, 0.03, (0.11 * side, -0.31, 1.77), 14, None,
                       Matrix.Rotation(math.pi / 2, 4, "X"))
        sc = scarf or (kit.hex_lin("#ffd166") if acc == "scarf" else None)
        if sc:
            b.part(kit.add_cylinder, sc, 0.33, 0.13, (0, 0, 1.36), 20)
            b.part(kit.add_box, sc, (0.12, 0.05, 0.34), (0.12, -0.33, 1.24), 0.0)

    part("head", (0, 0, 1.4), head)
    for side, tag in ((1, "R"), (-1, "L")):
        shoulder = (0.37 * side, 0, 1.28)

        def arm(b, side=side, shoulder=shoulder):
            b.part(kit.add_cylinder, shirt, 0.1, 0.5, shoulder, 10, 0.085,
                   Matrix.Rotation(math.radians(180 + 8 * side), 4, "Y"))
            b.part(kit.add_uvsphere, skin, 0.11, (shoulder[0] + 0.07 * side, 0, shoulder[2] - 0.56), 12, 8)

        part(f"arm{tag}", shoulder, arm)
    return [root, *parts]


def with_tree_light(rows: list[list[float]], bvh, suns) -> list[list[float]]:
    """Append each tree's sun visibility for the five looks (three -> Blender: x, -z, y)."""
    pts = [Vector((r[0], -r[2], r[1])) for r in rows]
    vis = bake_light.bake_points(pts, bvh, suns, seed=L.RNG_SEED + 23)
    return [[*r, *(round(v, 2) for v in vv)] for r, vv in zip(rows, vis)]


def ground(x: float, y: float) -> list[float]:
    return [round(v, 3) for v in to_three(x, y, L.terrain_h(x, y))]


def cam_meta(loc, target, lens: float, shift_x: float = 0.0, shift_y: float = 0.0) -> dict:
    """A Blender camera in terms three can reproduce: 36 mm sensor, AUTO fit, shift in sensor widths."""
    return {
        "position": [round(v, 3) for v in to_three(*loc)],
        "target": [round(v, 3) for v in to_three(*target)],
        "lensMm": lens,
        "sensorMm": 36.0,
        "shiftX": shift_x,
        "shiftY": shift_y,
        "fovDeg": round(2 * math.degrees(math.atan(18 * 9 / 16 / lens)), 3),  # vertical, at 16:9
    }


def main() -> None:
    kit.reset_scene()
    col = kit.collection("Web")
    statics: list[bpy.types.Object] = []
    terrain = web_ready(L.build_terrain(6.0, col))
    ridges = web_ready(L.build_ridges(col))
    statics += [terrain, web_ready(river_with_uv(col)), ridges]

    # Bake sun visibility (five looks) and sky occlusion into the land, for the web shader.
    t0 = time.time()
    suns = [bake_light.sun_vector(L.LOOKS[n].sun_elev, L.LOOKS[n].sun_azim) for n in bake_light.LOOK_ORDER]
    bvh = bake_light.build_bvh([terrain, ridges])
    bake_light.bake_mesh(terrain, bvh, suns, seed=L.RNG_SEED + 21)
    bake_light.bake_mesh(ridges, bvh, suns, seed=L.RNG_SEED + 22)
    print(f"[web] light bake: {len(terrain.data.vertices) + len(ridges.data.vertices)} verts in {time.time() - t0:.1f}s")
    statics.append(web_ready(L.build_rocks(col, lambda x, y: abs(x - L.river_x(y)) > 14 and not L.in_field(x, y, 6) and L.terrain_h(x, y) > 6)))
    windows, lanterns = L.Builder("Windows"), L.Builder("Lanterns")
    for fn in (L.build_village, L.build_observatory):
        statics.append(web_ready(fn(col, windows)))
    statics += [web_ready(o) for o in L.build_farm(col, windows)]
    statics.append(web_ready(L.build_bridge(col)))
    statics.append(web_ready(L.build_clouds(col)))
    statics.append(web_ready(L.build_flowers(col)))
    statics.append(web_ready(L.build_lanterns(col, lanterns)))
    statics.append(web_ready(windows.build(col)))
    statics.append(web_ready(lanterns.build(col)))
    rng = random.Random(L.RNG_SEED + 9)
    ff = L.Builder("Fireflies")
    for _ in range(90):
        x, y = rng.uniform(-120, 40), rng.uniform(-200, -40)
        ff.part(kit.add_ico, P["lime"], 0.16, (x, y, L.terrain_h(x, y) + rng.uniform(0.8, 4.5)), 1)
    statics.append(web_ready(ff.build(col)))
    export(os.path.join(OUT, "valley_m0.glb"), statics)

    k2 = mountain.build_mountain(grid=150, scale=0.42, col=col)
    k2.location = (150, 5400, 60)
    bpy.context.view_layer.update()
    summit = max((k2.matrix_world @ v.co for v in k2.data.vertices), key=lambda c: c.z)
    export(os.path.join(OUT, "k2_m0.glb"), [web_ready(k2)])

    export(os.path.join(OUT, "trees_m0.glb"), tree_prototypes(col))

    rig_objs: list[bpy.types.Object] = []
    rig_objs += villager_rig(col, L.VILLAGER_STYLES[0], "Hero", scarf=P["lime"])
    for k, st in enumerate(L.VILLAGER_STYLES[1:]):
        rig_objs += villager_rig(col, st, f"Villager{k}")
    export(os.path.join(OUT, "villagers_m0.glb"), rig_objs)

    hx, hy = L.hero_spot()
    cam = (L.CAM_LOC[0], L.CAM_LOC[1], L.terrain_h(L.CAM_LOC[0], L.CAM_LOC[1]) + 3.0)
    meta = {
        "frame": "three (y-up, metres)",
        "camera": {"establish": cam_meta(cam, L.CAM_TARGET, 28, shift_y=-0.07),
                   "hero": cam_meta(L.hero_cam(), L.hero_target(), 26, shift_x=0.17, shift_y=0.02)},
        "hero": {"position": to_three(hx, hy, L.terrain_h(hx, hy) - 0.05),
                 "faceK2": math.atan2(L.CAM_TARGET[0] - hx, -(L.CAM_TARGET[1] - hy))},
        "villagers": [{"name": f"Villager{k}", "position": to_three(vx, vy, L.terrain_h(vx, vy) - 0.05), "rotY": r}
                      for k, (vx, vy, r) in enumerate([(-30, -118, 0.4), (-24, -108, -2.4), (60, -20, 1.0), (88, 4, 2.6)])],
        "landmarks": {
            "village": ground(L.VILLAGE[0], L.VILLAGE[1]),
            "farm": ground(L.FARM[0], L.FARM[1]),
            "observatory": ground(*L.KNOLL),
            "bridge": ground(L.river_x(-52.0), -52.0),
            "k2Summit": [round(v, 2) for v in to_three(*summit)],
        },
        "pathWalk": [to_three(x, y, L.terrain_h(x, y)) for (x, y) in L.path_points()],
        "trees": with_tree_light(tree_scatter(), bvh, suns),
        "riverY": [[*to_three(L.river_x(y), y, L.terrain_h(L.river_x(y), y) + 3.6)] for y in range(-360, 1501, 20)],
    }
    with open(os.path.join(OUT, "valley_m0.json"), "w") as fh:
        json.dump(meta, fh, separators=(",", ":"))
    print(f"[web] valley_m0.json: {os.path.getsize(os.path.join(OUT, 'valley_m0.json')) / 1024:.0f} KB, {len(meta['trees'])} trees")


if __name__ == "__main__":
    main()
