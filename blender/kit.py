"""Zero Valley — shared Blender toolkit (headless, bpy 5.0).

Everything in the world is built from these helpers so the look stays
consistent: low-poly bmesh primitives, per-face vertex colours (linear
FLOAT_COLOR on the CORNER domain), one shared vertex-colour material, a
distance-haze node group for atmospheric perspective, sky/world presets,
Cycles rendering and glTF export.

Run any script with:  /home/user/.venvs/blender/bin/python blender/<script>.py
"""
from __future__ import annotations

import math
import os
import random
from dataclasses import dataclass
from typing import Callable, Iterable, Sequence

import bpy  # must precede bmesh/mathutils when bpy is a pip module
import bmesh
from mathutils import Matrix, Vector, noise

ROOT = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(ROOT)
CACHE = os.path.join(ROOT, ".cache")
OUT = os.path.join(ROOT, "out")
PUBLIC_MODELS = os.path.join(REPO, "public", "models")
for _d in (CACHE, OUT, PUBLIC_MODELS):
    os.makedirs(_d, exist_ok=True)

Color = tuple[float, float, float]


# --------------------------------------------------------------------------- colour


def srgb_to_linear(c: float) -> float:
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_lin(h: str) -> Color:
    """'#aabbcc' -> linear RGB tuple."""
    h = h.lstrip("#")
    r, g, b = (int(h[i : i + 2], 16) / 255.0 for i in (0, 2, 4))
    return (srgb_to_linear(r), srgb_to_linear(g), srgb_to_linear(b))


def mix(a: Color, b: Color, t: float) -> Color:
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t)


def jitter_color(c: Color, rng: random.Random, amount: float = 0.06) -> Color:
    k = 1.0 + rng.uniform(-amount, amount)
    return (max(0.0, c[0] * k), max(0.0, c[1] * k), max(0.0, c[2] * k))


# The storybook palette (sRGB hex, converted once).
PAL = {
    "grass_a": hex_lin("#5f9a3c"),
    "grass_b": hex_lin("#78ad45"),
    "grass_c": hex_lin("#4c8236"),
    "grass_dry": hex_lin("#b4b862"),
    "meadow": hex_lin("#93bd4f"),
    "dirt": hex_lin("#b98f62"),
    "path": hex_lin("#d2b48a"),
    "sand": hex_lin("#e3d3a4"),
    "rock": hex_lin("#8a8c8f"),
    "rock_dark": hex_lin("#5e6166"),
    "snow": hex_lin("#f4f7fb"),
    "glacier": hex_lin("#cfe3ee"),
    "water": hex_lin("#2b8fb5"),
    "water_deep": hex_lin("#2a6f93"),
    "pine": hex_lin("#2f6b47"),
    "pine_b": hex_lin("#3b7d4f"),
    "leaf": hex_lin("#5f9e47"),
    "leaf_b": hex_lin("#76b04f"),
    "leaf_autumn": hex_lin("#d99a3e"),
    "trunk": hex_lin("#6e4a32"),
    "wall_cream": hex_lin("#f2e6cf"),
    "wall_white": hex_lin("#f5f1ea"),
    "wall_sage": hex_lin("#c9d6b9"),
    "wall_sky": hex_lin("#c8dceb"),
    "roof_terracotta": hex_lin("#c8634a"),
    "roof_slate": hex_lin("#5b6b84"),
    "roof_moss": hex_lin("#5f7d4e"),
    "wood": hex_lin("#8a5a3b"),
    "wood_light": hex_lin("#b9875a"),
    "barn": hex_lin("#b8423a"),
    "wheat": hex_lin("#e3c25e"),
    "crop": hex_lin("#6fae3f"),
    "soil": hex_lin("#8a6243"),
    "hay": hex_lin("#e7c66a"),
    "white": hex_lin("#ffffff"),
    "black": hex_lin("#141414"),
    "cheek": hex_lin("#f2a3a3"),
    "skin_a": hex_lin("#f3cfb3"),
    "skin_b": hex_lin("#d9a47e"),
    "skin_c": hex_lin("#a8714f"),
    "lime": hex_lin("#c6ff3d"),
    "amber": hex_lin("#ffb547"),
    "window_warm": hex_lin("#ffcf7a"),
}


# --------------------------------------------------------------------------- scene


def reset_scene() -> bpy.types.Scene:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    return scene


def collection(name: str) -> bpy.types.Collection:
    col = bpy.data.collections.get(name)
    if col is None:
        col = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(col)
    return col


def obj_from_bmesh(bm: bmesh.types.BMesh, name: str, col: bpy.types.Collection | None = None) -> bpy.types.Object:
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    ob = bpy.data.objects.new(name, mesh)
    (col or bpy.context.scene.collection).objects.link(ob)
    return ob


# --------------------------------------------------------------------------- colour attributes


def ensure_color_attr(mesh: bpy.types.Mesh, name: str = "Col") -> bpy.types.Attribute:
    attr = mesh.color_attributes.get(name)
    if attr is None:
        attr = mesh.color_attributes.new(name=name, type="FLOAT_COLOR", domain="CORNER")
    mesh.color_attributes.active_color = attr
    try:
        mesh.color_attributes.render_color_index = list(mesh.color_attributes).index(attr)
    except Exception:  # noqa: BLE001 — older API names; non-fatal
        pass
    return attr


def paint_faces(ob: bpy.types.Object, color_fn: Callable[[bpy.types.MeshPolygon], Color], name: str = "Col") -> None:
    """Give every face one colour: the flat, faceted storybook look."""
    mesh = ob.data
    attr = ensure_color_attr(mesh, name)
    data = attr.data
    for poly in mesh.polygons:
        r, g, b = color_fn(poly)
        for li in poly.loop_indices:
            data[li].color = (r, g, b, 1.0)


def paint_solid(ob: bpy.types.Object, c: Color, name: str = "Col") -> None:
    paint_faces(ob, lambda _p: c, name)


def flat(ob: bpy.types.Object) -> None:
    for p in ob.data.polygons:
        p.use_smooth = False


def smooth(ob: bpy.types.Object) -> None:
    for p in ob.data.polygons:
        p.use_smooth = True


# --------------------------------------------------------------------------- bmesh primitives


def bm_new() -> bmesh.types.BMesh:
    return bmesh.new()


def bm_transform(bm: bmesh.types.BMesh, verts: Iterable, mat: Matrix) -> None:
    bmesh.ops.transform(bm, matrix=mat, verts=list(verts))


def add_box(bm, size: Sequence[float], loc: Sequence[float] = (0, 0, 0), rot_z: float = 0.0):
    res = bmesh.ops.create_cube(bm, size=1.0)
    verts = res["verts"]
    m = Matrix.Translation(Vector(loc)) @ Matrix.Rotation(rot_z, 4, "Z") @ Matrix.Diagonal((*size, 1.0))
    bm_transform(bm, verts, m)
    return verts


def add_cylinder(bm, radius: float, depth: float, loc=(0, 0, 0), segments: int = 8, radius_top: float | None = None, rot: Matrix | None = None):
    res = bmesh.ops.create_cone(
        bm, cap_ends=True, cap_tris=False, segments=segments,
        radius1=radius, radius2=radius if radius_top is None else radius_top, depth=depth,
    )
    verts = res["verts"]
    m = Matrix.Translation(Vector(loc)) @ (rot or Matrix.Identity(4)) @ Matrix.Translation((0, 0, depth / 2))
    bm_transform(bm, verts, m)
    return verts


def add_cone(bm, radius: float, depth: float, loc=(0, 0, 0), segments: int = 7):
    return add_cylinder(bm, radius, depth, loc, segments, radius_top=0.0)


def add_ico(bm, radius: float, loc=(0, 0, 0), subdiv: int = 1, scale=(1, 1, 1)):
    res = bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=radius)
    verts = res["verts"]
    m = Matrix.Translation(Vector(loc)) @ Matrix.Diagonal((*scale, 1.0))
    bm_transform(bm, verts, m)
    return verts


def add_uvsphere(bm, radius: float, loc=(0, 0, 0), u: int = 16, v: int = 10, scale=(1, 1, 1)):
    res = bmesh.ops.create_uvsphere(bm, u_segments=u, v_segments=v, radius=radius)
    verts = res["verts"]
    m = Matrix.Translation(Vector(loc)) @ Matrix.Diagonal((*scale, 1.0))
    bm_transform(bm, verts, m)
    return verts


def add_prism_roof(bm, width: float, depth: float, height: float, loc=(0, 0, 0), rot_z: float = 0.0, overhang: float = 0.35):
    """A gable roof: a triangular prism along local X."""
    w, d, h = width / 2 + overhang, depth / 2 + overhang, height
    pts = [(-w, -d, 0), (w, -d, 0), (w, d, 0), (-w, d, 0), (-w, 0, h), (w, 0, h)]
    vs = [bm.verts.new(p) for p in pts]
    faces = [(0, 1, 5, 4), (2, 3, 4, 5), (0, 4, 3), (1, 2, 5), (0, 3, 2, 1)]
    for f in faces:
        bm.faces.new([vs[i] for i in f])
    m = Matrix.Translation(Vector(loc)) @ Matrix.Rotation(rot_z, 4, "Z")
    bm_transform(bm, vs, m)
    return vs


def jitter(verts, rng: random.Random, amount: float) -> None:
    for v in verts:
        v.co += Vector((rng.uniform(-amount, amount), rng.uniform(-amount, amount), rng.uniform(-amount, amount)))


# --------------------------------------------------------------------------- materials


def _haze_group() -> bpy.types.NodeTree:
    """Atmospheric perspective: mix a surface towards a haze colour by camera distance.

    inputs: Shader, HazeColor, MaxHaze, Distance(scale m)  -> output Shader
    haze = MaxHaze * (1 - exp(-dist / Distance))
    """
    name = "ZV_Haze"
    if name in bpy.data.node_groups:
        return bpy.data.node_groups[name]
    g = bpy.data.node_groups.new(name, "ShaderNodeTree")
    iface = g.interface
    iface.new_socket("Shader", in_out="INPUT", socket_type="NodeSocketShader")
    s = iface.new_socket("HazeColor", in_out="INPUT", socket_type="NodeSocketColor")
    s.default_value = (0.7, 0.8, 0.9, 1)
    s = iface.new_socket("MaxHaze", in_out="INPUT", socket_type="NodeSocketFloat")
    s.default_value = 0.5
    s = iface.new_socket("Distance", in_out="INPUT", socket_type="NodeSocketFloat")
    s.default_value = 1500.0
    iface.new_socket("Shader", in_out="OUTPUT", socket_type="NodeSocketShader")
    n, l = g.nodes, g.links
    gi = n.new("NodeGroupInput")
    go = n.new("NodeGroupOutput")
    cam = n.new("ShaderNodeCameraData")
    div = n.new("ShaderNodeMath"); div.operation = "DIVIDE"
    neg = n.new("ShaderNodeMath"); neg.operation = "MULTIPLY"; neg.inputs[1].default_value = -1.0
    ex = n.new("ShaderNodeMath"); ex.operation = "EXPONENT"
    one = n.new("ShaderNodeMath"); one.operation = "SUBTRACT"; one.inputs[0].default_value = 1.0
    mul = n.new("ShaderNodeMath"); mul.operation = "MULTIPLY"
    emis = n.new("ShaderNodeEmission")
    mixs = n.new("ShaderNodeMixShader")
    l.new(cam.outputs["View Distance"], div.inputs[0])
    l.new(gi.outputs["Distance"], div.inputs[1])
    l.new(div.outputs[0], neg.inputs[0])
    l.new(neg.outputs[0], ex.inputs[0])
    l.new(ex.outputs[0], one.inputs[1])
    l.new(one.outputs[0], mul.inputs[0])
    l.new(gi.outputs["MaxHaze"], mul.inputs[1])
    l.new(gi.outputs["HazeColor"], emis.inputs["Color"])
    l.new(mul.outputs[0], mixs.inputs["Fac"])
    l.new(gi.outputs["Shader"], mixs.inputs[1])
    l.new(emis.outputs[0], mixs.inputs[2])
    l.new(mixs.outputs[0], go.inputs["Shader"])
    return g


HAZE_NODES: list[bpy.types.Node] = []


def _wrap_haze(mat: bpy.types.Material, shader_out) -> None:
    nt = mat.node_tree
    grp = nt.nodes.new("ShaderNodeGroup")
    grp.node_tree = _haze_group()
    out = nt.nodes.get("Material Output") or nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(shader_out, grp.inputs["Shader"])
    nt.links.new(grp.outputs["Shader"], out.inputs["Surface"])
    HAZE_NODES.append(grp)


def set_haze(color: Color, max_haze: float, distance: float) -> None:
    for grp in HAZE_NODES:
        grp.inputs["HazeColor"].default_value = (*color, 1.0)
        grp.inputs["MaxHaze"].default_value = max_haze
        grp.inputs["Distance"].default_value = distance


def _fresh_material(name: str) -> bpy.types.Material:
    mat = bpy.data.materials.new(name)
    try:
        mat.use_nodes = True
    except Exception:  # noqa: BLE001 — always-nodes in newer Blender
        pass
    nt = mat.node_tree
    for node in list(nt.nodes):
        if node.type != "OUTPUT_MATERIAL":
            nt.nodes.remove(node)
    if not any(n.type == "OUTPUT_MATERIAL" for n in nt.nodes):
        nt.nodes.new("ShaderNodeOutputMaterial")
    return mat


def vc_material(name: str = "ZV_VertexColor", roughness: float = 0.88, attr: str = "Col") -> bpy.types.Material:
    """Matte storybook material: base colour from the per-face colour attribute."""
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    mat = _fresh_material(name)
    nt = mat.node_tree
    vc = nt.nodes.new("ShaderNodeVertexColor")
    vc.layer_name = attr
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Roughness"].default_value = roughness
    nt.links.new(vc.outputs["Color"], bsdf.inputs["Base Color"])
    _wrap_haze(mat, bsdf.outputs["BSDF"])
    return mat


def snow_material(name: str = "ZV_Mountain") -> bpy.types.Material:
    """Vertex colours plus a little sheen so snow catches alpenglow."""
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    mat = _fresh_material(name)
    nt = mat.node_tree
    vc = nt.nodes.new("ShaderNodeVertexColor")
    vc.layer_name = "Col"
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Roughness"].default_value = 0.7
    nt.links.new(vc.outputs["Color"], bsdf.inputs["Base Color"])
    _wrap_haze(mat, bsdf.outputs["BSDF"])
    return mat


def water_material(name: str = "ZV_Water") -> bpy.types.Material:
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    mat = _fresh_material(name)
    nt = mat.node_tree
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = (*PAL["water"], 1)
    bsdf.inputs["Roughness"].default_value = 0.08
    try:
        bsdf.inputs["Coat Weight"].default_value = 0.3
    except KeyError:
        pass
    _wrap_haze(mat, bsdf.outputs["BSDF"])
    return mat


def cloud_material(name: str = "ZV_Cloud") -> bpy.types.Material:
    """Bright, soft clouds that keep their shape in every light."""
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    mat = _fresh_material(name)
    nt = mat.node_tree
    vc = nt.nodes.new("ShaderNodeVertexColor")
    vc.layer_name = "Col"
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Roughness"].default_value = 1.0
    nt.links.new(vc.outputs["Color"], bsdf.inputs["Base Color"])
    try:
        bsdf.inputs["Subsurface Weight"].default_value = 0.0
        bsdf.inputs["Emission Color"].default_value = (1, 1, 1, 1)
        bsdf.inputs["Emission Strength"].default_value = 0.12
    except KeyError:
        pass
    _wrap_haze(mat, bsdf.outputs["BSDF"])
    return mat


EMISSIVE: dict[str, bpy.types.Node] = {}


def emissive_material(name: str, color: Color, strength: float = 6.0) -> bpy.types.Material:
    """Windows, lanterns, fireflies. Strength is animated per time of day via set_emission()."""
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    mat = _fresh_material(name)
    nt = mat.node_tree
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (*color, 1)
    em.inputs["Strength"].default_value = strength
    diff = nt.nodes.new("ShaderNodeBsdfDiffuse")
    diff.inputs["Color"].default_value = (*mix(color, (0.15, 0.15, 0.15), 0.6), 1)
    add = nt.nodes.new("ShaderNodeAddShader")
    nt.links.new(diff.outputs[0], add.inputs[0])
    nt.links.new(em.outputs[0], add.inputs[1])
    out = nt.nodes.get("Material Output")
    nt.links.new(add.outputs[0], out.inputs["Surface"])
    EMISSIVE[name] = em
    return mat


def set_emission(name: str, strength: float) -> None:
    if name in EMISSIVE:
        EMISSIVE[name].inputs["Strength"].default_value = strength


def assign(ob: bpy.types.Object, mat: bpy.types.Material) -> None:
    ob.data.materials.clear()
    ob.data.materials.append(mat)


# --------------------------------------------------------------------------- noise


def fbm(x: float, y: float, octaves: int = 4, scale: float = 1.0, seed: float = 0.0) -> float:
    """Fractal noise in roughly [-1, 1]."""
    total, amp, freq, norm = 0.0, 1.0, 1.0, 0.0
    for _ in range(octaves):
        total += amp * noise.noise(Vector((x * freq * scale + seed, y * freq * scale - seed, seed * 0.37)))
        norm += amp
        amp *= 0.5
        freq *= 2.0
    return total / norm


def smoothstep(e0: float, e1: float, x: float) -> float:
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


# --------------------------------------------------------------------------- scatter


def poisson_scatter(
    rng: random.Random,
    bounds: tuple[float, float, float, float],
    min_dist: float,
    accept: Callable[[float, float], bool],
    max_points: int,
    tries: int = 30000,
) -> list[tuple[float, float]]:
    """Dart-throwing Poisson disc on a grid; deterministic for a seeded rng."""
    x0, y0, x1, y1 = bounds
    cell = min_dist / math.sqrt(2)
    grid: dict[tuple[int, int], tuple[float, float]] = {}
    pts: list[tuple[float, float]] = []
    for _ in range(tries):
        if len(pts) >= max_points:
            break
        x, y = rng.uniform(x0, x1), rng.uniform(y0, y1)
        if not accept(x, y):
            continue
        gx, gy = int((x - x0) / cell), int((y - y0) / cell)
        ok = True
        for i in range(gx - 2, gx + 3):
            for j in range(gy - 2, gy + 3):
                q = grid.get((i, j))
                if q and (q[0] - x) ** 2 + (q[1] - y) ** 2 < min_dist * min_dist:
                    ok = False
                    break
            if not ok:
                break
        if ok:
            grid[(gx, gy)] = (x, y)
            pts.append((x, y))
    return pts


# --------------------------------------------------------------------------- sky / light / camera


def _sky_type_items() -> list[str]:
    node_rna = bpy.types.ShaderNodeTexSky.bl_rna.properties["sky_type"]
    return [e.identifier for e in node_rna.enum_items]


@dataclass
class Look:
    """One time of day."""

    name: str
    sun_elev: float  # degrees
    sun_azim: float  # degrees (0 = +Y, 90 = +X)
    sun_color: Color
    sun_strength: float
    sky_strength: float
    haze_color: Color
    haze_max: float
    haze_dist: float
    exposure: float
    window: float  # emission strength for windows
    lantern: float
    firefly: float
    night: bool = False
    air: float = 1.0
    dust: float = 1.0


def build_world(look: Look) -> None:
    scene = bpy.context.scene
    world = scene.world or bpy.data.worlds.new("ZV_World")
    scene.world = world
    try:
        world.use_nodes = True
    except Exception:  # noqa: BLE001
        pass
    nt = world.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    if not look.night:
        sky = nt.nodes.new("ShaderNodeTexSky")
        items = _sky_type_items()
        for pref in ("MULTIPLE_SCATTERING", "NISHITA", "SINGLE_SCATTERING", "HOSEK_WILKIE"):
            if pref in items:
                sky.sky_type = pref
                break
        for attr, val in (
            ("sun_elevation", math.radians(look.sun_elev)),
            ("sun_rotation", math.radians(look.sun_azim)),
            ("air_density", look.air),
            ("dust_density", look.dust),
            ("aerosol_density", look.dust),
            ("altitude", 300.0),
            ("sun_disc", True),
            ("sun_intensity", 0.4),
        ):
            if hasattr(sky, attr):
                try:
                    setattr(sky, attr, val)
                except Exception:  # noqa: BLE001
                    pass
        nt.links.new(sky.outputs["Color"], bg.inputs["Color"])
        bg.inputs["Strength"].default_value = look.sky_strength
    else:
        # A calm night: deep gradient plus a field of stars.
        tc = nt.nodes.new("ShaderNodeTexCoord")
        sep = nt.nodes.new("ShaderNodeSeparateXYZ")
        nt.links.new(tc.outputs["Generated"], sep.inputs[0])
        ramp = nt.nodes.new("ShaderNodeValToRGB")
        cr = ramp.color_ramp
        cr.elements[0].position = 0.0
        cr.elements[0].color = (*hex_lin("#2b3e6b"), 1)
        cr.elements[1].position = 0.35
        cr.elements[1].color = (*hex_lin("#0a1022"), 1)
        nt.links.new(sep.outputs["Z"], ramp.inputs["Fac"])
        wn = nt.nodes.new("ShaderNodeTexWhiteNoise")
        wn.noise_dimensions = "3D"
        sc = nt.nodes.new("ShaderNodeVectorMath"); sc.operation = "SCALE"; sc.inputs["Scale"].default_value = 700.0
        nt.links.new(tc.outputs["Generated"], sc.inputs[0])
        flo = nt.nodes.new("ShaderNodeVectorMath"); flo.operation = "FLOOR"
        nt.links.new(sc.outputs[0], flo.inputs[0])
        nt.links.new(flo.outputs[0], wn.inputs["Vector"])
        thr = nt.nodes.new("ShaderNodeMath"); thr.operation = "GREATER_THAN"; thr.inputs[1].default_value = 0.9965
        nt.links.new(wn.outputs["Value"], thr.inputs[0])
        above = nt.nodes.new("ShaderNodeMath"); above.operation = "GREATER_THAN"; above.inputs[1].default_value = 0.02
        nt.links.new(sep.outputs["Z"], above.inputs[0])
        stars = nt.nodes.new("ShaderNodeMath"); stars.operation = "MULTIPLY"
        nt.links.new(thr.outputs[0], stars.inputs[0])
        nt.links.new(above.outputs[0], stars.inputs[1])
        starscale = nt.nodes.new("ShaderNodeMath"); starscale.operation = "MULTIPLY"; starscale.inputs[1].default_value = 3.0
        nt.links.new(stars.outputs[0], starscale.inputs[0])
        add = nt.nodes.new("ShaderNodeMixRGB"); add.blend_type = "ADD"; add.inputs["Fac"].default_value = 1.0
        nt.links.new(ramp.outputs["Color"], add.inputs["Color1"])
        nt.links.new(starscale.outputs[0], add.inputs["Color2"])
        nt.links.new(add.outputs["Color"], bg.inputs["Color"])
        bg.inputs["Strength"].default_value = look.sky_strength
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])


def sun(look: Look) -> bpy.types.Object:
    data = bpy.data.lights.get("ZV_Sun") or bpy.data.lights.new("ZV_Sun", type="SUN")
    data.color = look.sun_color
    data.energy = look.sun_strength
    data.angle = math.radians(2.5 if not look.night else 1.0)
    ob = bpy.data.objects.get("ZV_Sun") or bpy.data.objects.new("ZV_Sun", data)
    if ob.name not in bpy.context.scene.collection.objects:
        bpy.context.scene.collection.objects.link(ob)
    elev, az = math.radians(look.sun_elev), math.radians(look.sun_azim)
    direction = Vector((math.sin(az) * math.cos(elev), math.cos(az) * math.cos(elev), math.sin(elev)))
    ob.rotation_euler = direction.to_track_quat("Z", "Y").to_euler()
    return ob


def camera(name: str, loc, target, lens: float = 35.0, dof_dist: float | None = None, fstop: float = 2.8) -> bpy.types.Object:
    data = bpy.data.cameras.get(name) or bpy.data.cameras.new(name)
    data.lens = lens
    data.clip_start = 0.5
    data.clip_end = 20000
    if dof_dist:
        data.dof.use_dof = True
        data.dof.focus_distance = dof_dist
        data.dof.aperture_fstop = fstop
    ob = bpy.data.objects.get(name) or bpy.data.objects.new(name, data)
    if ob.name not in bpy.context.scene.collection.objects:
        bpy.context.scene.collection.objects.link(ob)
    ob.location = Vector(loc)
    direction = Vector(target) - Vector(loc)
    ob.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = ob
    return ob


def setup_cycles(width: int, height: int, samples: int, exposure: float = 0.0) -> None:
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    try:
        scene.cycles.denoiser = "OPENIMAGEDENOISE"
    except Exception:  # noqa: BLE001
        pass
    scene.cycles.max_bounces = 4
    scene.cycles.diffuse_bounces = 2
    scene.cycles.glossy_bounces = 2
    scene.cycles.transmission_bounces = 2
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    try:
        scene.view_settings.view_transform = "AgX"
        scene.view_settings.look = "AgX - Punchy"
    except Exception:  # noqa: BLE001
        scene.view_settings.view_transform = "Standard"
    scene.view_settings.exposure = exposure
    scene.render.threads_mode = "AUTO"


def render_to(path: str) -> None:
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


# --------------------------------------------------------------------------- export


def export_glb(path: str, objects: Sequence[bpy.types.Object]) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    for ob in objects:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    kwargs = dict(filepath=path, export_format="GLB", use_selection=True, export_apply=True, export_yup=True)
    props = bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
    if "export_vertex_color" in props:
        kwargs["export_vertex_color"] = "ACTIVE"
    if "export_all_vertex_colors" in props:
        kwargs["export_all_vertex_colors"] = False
    if "export_extras" in props:
        kwargs["export_extras"] = True
    if "export_materials" in props:
        kwargs["export_materials"] = "EXPORT"
    bpy.ops.export_scene.gltf(**kwargs)
