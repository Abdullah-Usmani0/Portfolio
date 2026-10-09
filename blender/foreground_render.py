"""
The valley's nearer layers, rendered: the two forested ridges across the valley, the valley
floor with the cliff the waterfall pours down, and the near bank that climbs to the summit.

Each is built in 3D from the very shapes the site paints (`npm run scenery` writes them to
blender/out/scenery.json), so the words and the set pieces sit exactly where they did. A layer
is seen side-on by an orthographic camera tipped a few degrees down, one pixel per world unit,
in tiles TILE units wide. A tile is rendered once, lit three ways at once by light groups: a
low sun from the left, one from the right, and the open sky. The site mixes the three for
the hour, as it does the mountains (src/world/gl/strip.ts).

  python blender/foreground_render.py                         # every layer, then the textures
  python blender/foreground_render.py --layer=bank --tiles=2,3 --test   # a quick look
  python blender/foreground_render.py --export                # the textures from the last renders

Run it with the Blender-as-a-module Python (see blender/requirements.txt).
"""
from __future__ import annotations

import json
import math
import os
import subprocess
import sys
import time

import bpy
import numpy as np
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pines  # noqa: E402
from scipy import ndimage  # noqa: E402
import k2_render  # noqa: E402
from terrain_detail import carve, perlin, ridged, smoothstep, surface  # noqa: E402

ROOT = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(ROOT)
SCENERY = os.path.join(ROOT, "out", "scenery.json")
WORK = os.path.join(ROOT, "out", "foreground")
TEXTURES = os.path.join(REPO, "src", "world", "textures", "foreground")
DATA = os.path.join(REPO, "src", "world", "data", "foregroundRender.json")


def arg(name: str, default: str = "") -> str:
    return next((a.split("=", 1)[1] for a in sys.argv if a.startswith(f"--{name}=")), default)


TEST = "--test" in sys.argv
EXPORT = "--export" in sys.argv
ONLY_LAYERS = [s for s in arg("layer").split(",") if s]
ONLY_TILES = [int(s) for s in arg("tiles").split(",") if s]
SAMPLES = int(arg("samples", "16" if TEST else "40"))

# Tiles are this many world units wide, one pixel per unit; each is rendered with BORDER
# more pixels all round, cropped away, so the denoiser sees past the tile's edges and
# neighbouring tiles meet without a seam.
TILE = 512
BORDER = 24
# Rows of nothing between the images stacked in a texture (as the mountains' textures).
PAD = 8
LIGHTS = ("left", "right", "sky")
SUN_ENERGY = 3.2


# ——— Layers ———

class Layer:
    def __init__(self, name: str, tilt_deg: float, below: float):
        self.name = name
        self.tilt = math.radians(tilt_deg)
        # How far below its edge the layer is rendered; the painted fill carries on beneath.
        self.below = below

    @property
    def sin(self) -> float:
        return math.sin(self.tilt)

    @property
    def cos(self) -> float:
        return math.cos(self.tilt)

    def z_at(self, sy: np.ndarray | float, y: np.ndarray | float) -> np.ndarray | float:
        """The height a point `y` deep must stand at to be seen at screen height `sy`."""
        return (sy - y * self.sin) / self.cos


def profile(xs: list[float], ys: list[float]):
    xa = np.asarray(xs, dtype=np.float64)
    ya = np.asarray(ys, dtype=np.float64)
    return lambda x: np.interp(x, xa, ya)


# ——— Meshes ———

def grid_mesh(name: str, X: np.ndarray, Y: np.ndarray, Z: np.ndarray, attrs: dict[str, np.ndarray] | None = None, groups: dict[str, np.ndarray] | None = None) -> bpy.types.Object:
    """A mesh over a grid of points (rows × columns), rows running from the front back, so
    every face points up and towards the eye."""
    rows, cols = X.shape
    verts = np.stack([X, Y, Z], axis=-1).reshape(-1, 3).astype(np.float32)
    idx = np.arange(rows * cols).reshape(rows, cols)
    a = idx[:-1, :-1].ravel()
    quads = np.stack([a, a + 1, a + 1 + cols, a + cols], axis=1).astype(np.int32)
    me = bpy.data.meshes.new(name)
    me.vertices.add(len(verts))
    me.vertices.foreach_set("co", verts.ravel())
    me.loops.add(len(quads) * 4)
    me.loops.foreach_set("vertex_index", quads.ravel())
    me.polygons.add(len(quads))
    me.polygons.foreach_set("loop_start", np.arange(0, len(quads) * 4, 4, dtype=np.int32))
    me.update()
    me.shade_smooth()
    for key, val in (attrs or {}).items():
        at = me.attributes.new(key, "FLOAT", "POINT")
        at.data.foreach_set("value", np.asarray(val, dtype=np.float32).ravel())
    ob = bpy.data.objects.new(name, me)
    for key, val in (groups or {}).items():
        vg = ob.vertex_groups.new(name=key)
        level = np.round(np.clip(np.asarray(val, dtype=np.float32).ravel(), 0, 1) * 16).astype(np.int32)
        for k in range(1, 17):
            idx = np.nonzero(level == k)[0]
            if len(idx):
                vg.add(idx.tolist(), k / 16, "REPLACE")
    return ob


def cell_area(X: np.ndarray, Y: np.ndarray, Z: np.ndarray) -> np.ndarray:
    """The ground each grid point stands for: its spacing across times its spacing along."""
    across = np.gradient(X, axis=1)
    along = np.hypot(np.gradient(Y, axis=0), np.gradient(Z, axis=0))
    return np.abs(across) * along


def depth_rows(far: float, count: int, power: float) -> np.ndarray:
    """Distances in from an edge, close together at the edge and spreading out."""
    return far * (np.arange(count + 1) / count) ** power


# ——— Materials ———

def _nodes(mat: bpy.types.Material):
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    return nt, nt.nodes.new, nt.links.new


def ground_material(name: str, grass: tuple, dry: tuple, soil: tuple, rock: tuple, wet_x: float | None = None, streaks: bool = False) -> bpy.types.Material:
    """Ground: turf mottled green to dry, bare earth in patches, rock where the `rock`
    attribute says, snow on what faces up where the `snow` attribute allows it, and a dark
    wet streak at `wet_x` (the waterfall). Fine bumps in every part."""
    mat = bpy.data.materials.new(name)
    nt, n, link = _nodes(mat)
    out = n("ShaderNodeOutputMaterial")
    tex = n("ShaderNodeTexCoord")
    geo = n("ShaderNodeNewGeometry")

    def attr(key: str):
        a = n("ShaderNodeAttribute")
        a.attribute_name = key
        return a.outputs["Fac"]

    def noise(scale: float, detail: float = 3.0, rough: float = 0.55):
        t = n("ShaderNodeTexNoise")
        t.inputs["Scale"].default_value = scale
        t.inputs["Detail"].default_value = detail
        t.inputs["Roughness"].default_value = rough
        link(tex.outputs["Object"], t.inputs["Vector"])
        return t.outputs["Fac"]

    def mix(fac, a, b):
        m = n("ShaderNodeMix")
        m.data_type = "RGBA"
        link(fac, m.inputs["Factor"])
        for sock, v in (("A", a), ("B", b)):
            if isinstance(v, tuple):
                m.inputs[sock].default_value = (*v, 1.0)
            else:
                link(v, m.inputs[sock])
        return m.outputs["Result"]

    def ramp(fac, lo: float, hi: float):
        r = n("ShaderNodeMapRange")
        r.interpolation_type = "SMOOTHSTEP"
        link(fac, r.inputs["Value"])
        r.inputs["From Min"].default_value = lo
        r.inputs["From Max"].default_value = hi
        return r.outputs["Result"]

    def math_op(op: str, a, b):
        m = n("ShaderNodeMath")
        m.operation = op
        for i, v in enumerate((a, b)):
            if isinstance(v, (int, float)):
                m.inputs[i].default_value = v
            else:
                link(v, m.inputs[i])
        return m.outputs[0]

    turf = mix(ramp(noise(0.035, 4), 0.42, 0.62), grass, dry)
    earth = ramp(noise(0.06, 4), 0.6, 0.7)
    base = mix(earth, turf, soil)
    mottle = noise(0.09, 3)
    rock_col = mix(ramp(mottle, 0.3, 0.75), tuple(c * 0.6 for c in rock), rock)
    if streaks:
        # Water stains running down the rock from its ledges, and pale lichen in patches.
        stretch = n("ShaderNodeMapping")
        stretch.inputs["Scale"].default_value = (1 / 14.0, 1.0, 1 / 170.0)
        link(tex.outputs["Object"], stretch.inputs["Vector"])
        stain = n("ShaderNodeTexNoise")
        stain.inputs["Scale"].default_value = 1.0
        stain.inputs["Detail"].default_value = 3.0
        link(stretch.outputs["Vector"], stain.inputs["Vector"])
        rock_col = mix(ramp(stain.outputs["Fac"], 0.5, 0.68), rock_col, tuple(c * 0.45 for c in rock))
        rock_col = mix(ramp(noise(0.07, 4), 0.68, 0.76), rock_col, (0.13, 0.14, 0.085))
    rocky = ramp(math_op("ADD", attr("rock"), math_op("MULTIPLY", noise(0.05, 3), 0.25)), 0.55, 0.75)
    col = mix(rocky, base, rock_col)
    # Snow lies on what faces up enough, where it is cold enough to lie at all.
    sep = n("ShaderNodeSeparateXYZ")
    link(geo.outputs["Normal"], sep.inputs["Vector"])
    holds = math_op("ADD", sep.outputs["Z"], math_op("MULTIPLY", math_op("SUBTRACT", noise(0.018, 4), 0.5), 0.7))
    lying = math_op("ADD", math_op("MULTIPLY", attr("snow"), 1.2), math_op("MULTIPLY", math_op("SUBTRACT", noise(0.03, 3), 0.5), 0.5))
    snow = math_op("MULTIPLY", ramp(holds, 0.45, 0.6), ramp(lying, 0.45, 0.75))
    col = mix(snow, col, (0.78, 0.8, 0.84))
    if wet_x is not None:
        sep2 = n("ShaderNodeSeparateXYZ")
        link(tex.outputs["Object"], sep2.inputs["Vector"])
        dx = math_op("ABSOLUTE", math_op("SUBTRACT", sep2.outputs["X"], wet_x), 0)
        wet = ramp(math_op("ADD", dx, math_op("MULTIPLY", noise(0.05, 2), 18.0)), 44.0, 22.0)
        col = mix(wet, col, (0.02, 0.022, 0.024))
    bsdf = n("ShaderNodeBsdfPrincipled")
    link(col, bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.85
    bsdf.inputs["Specular IOR Level"].default_value = 0.3
    bump = n("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.7
    bump.inputs["Distance"].default_value = 1.2
    link(noise(0.4, 4, 0.6), bump.inputs["Height"])
    link(bump.outputs["Normal"], bsdf.inputs["Normal"])
    link(bsdf.outputs[0], out.inputs["Surface"])
    return mat


def grass_material(name: str, dark: tuple, light: tuple) -> bpy.types.Material:
    """Grass blades: darker at the root, lighter towards the tip, each blade its own shade;
    a little light through them. The tips sway a little in the site's wind."""
    mat = bpy.data.materials.new(name)
    nt, n, link = _nodes(mat)
    out = n("ShaderNodeOutputMaterial")
    info = n("ShaderNodeHairInfo")
    shade = n("ShaderNodeMix")
    shade.data_type = "RGBA"
    shade.inputs["A"].default_value = (*dark, 1)
    shade.inputs["B"].default_value = (*light, 1)
    along = n("ShaderNodeMath")
    along.operation = "MULTIPLY_ADD"
    link(info.outputs["Intercept"], along.inputs[0])
    along.inputs[1].default_value = 0.75
    link(info.outputs["Random"], along.inputs[2])
    mul = n("ShaderNodeMath")
    mul.operation = "MULTIPLY"
    link(along.outputs[0], mul.inputs[0])
    mul.inputs[1].default_value = 0.62
    link(mul.outputs[0], shade.inputs["Factor"])
    bsdf = n("ShaderNodeBsdfPrincipled")
    link(shade.outputs["Result"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.6
    bsdf.inputs["Specular IOR Level"].default_value = 0.3
    trans = n("ShaderNodeBsdfTranslucent")
    link(shade.outputs["Result"], trans.inputs["Color"])
    both = n("ShaderNodeMixShader")
    both.inputs["Fac"].default_value = 0.25
    link(bsdf.outputs[0], both.inputs[1])
    link(trans.outputs[0], both.inputs[2])
    link(both.outputs[0], out.inputs["Surface"])
    sway = n("ShaderNodeOutputAOV")
    sway.aov_name = "sway"
    tip = n("ShaderNodeMath")
    tip.operation = "MULTIPLY"
    link(info.outputs["Intercept"], tip.inputs[0])
    tip.inputs[1].default_value = 0.12
    link(tip.outputs[0], sway.inputs["Value"])
    return mat


def add_grass(ob: bpy.types.Object, mat: bpy.types.Material, area: float, per_unit: float, length: float, seed: int) -> None:
    """Hair grass over the mesh, as thick as its `meadow` vertex group says: tufts of blades
    that stand up from the slope, bent and of uneven length."""
    ob.data.materials.append(mat)
    mod = ob.modifiers.new("grass", "PARTICLE_SYSTEM")
    psys = mod.particle_system
    psys.seed = seed
    psys.vertex_group_density = "meadow"
    ps = psys.settings
    ps.type = "HAIR"
    ps.use_advanced_hair = True
    ps.count = max(1, int(area * per_unit / 8))
    ps.hair_length = length
    ps.emit_from = "FACE"
    ps.use_emit_random = True
    ps.use_even_distribution = True
    ps.normal_factor = 0.35
    ps.object_align_factor = (0.0, 0.0, 1.0)
    ps.factor_random = 0.45
    ps.child_type = "INTERPOLATED"
    ps.rendered_child_count = 8
    ps.child_percent = 1
    ps.child_length = 0.65
    ps.child_length_threshold = 0.4
    ps.clump_factor = 0.35
    ps.roughness_1 = 0.25
    ps.roughness_1_size = 0.7
    ps.roughness_endpoint = 0.12
    ps.roughness_2 = 0.2
    ps.roughness_2_threshold = 0.5
    ps.render_type = "PATH"
    ps.render_step = 3
    ps.display_step = 1
    ps.root_radius = 0.28
    ps.tip_radius = 0.0
    ps.radius_scale = 1.0
    ps.material_slot = mat.name


# ——— Pines ———

_PROTOS: dict[str, list[bpy.types.Object]] = {}


def protos(kind: str) -> list[bpy.types.Object]:
    """A few spruces to copy: detailed for the near bank, plainer for the far ridges."""
    if kind not in _PROTOS:
        mat = pines.pine_material()
        made = []
        for k in range(6 if kind == "near" else 4):
            ob = pines.spruce(f"spruce-{kind}{k}", 101 + k * 7 + (0 if kind == "near" else 50), whorls=22 if kind == "near" else 14)
            ob.data.materials.append(mat)
            made.append(ob)
        _PROTOS[kind] = made
    return _PROTOS[kind]


def plant(kind: str, x: float, y: float, z: float, h: float, w: float, rng: np.random.Generator, layer: Layer) -> bpy.types.Object:
    proto = protos(kind)[int(rng.integers(0, len(protos(kind))))]
    ob = bpy.data.objects.new("pine", proto.data)
    # Stretched to the painted pine's size on screen (the camera's tip shortens it a little).
    ob.location = (x, y, z)
    ob.scale = (w, w, h / layer.cos)
    ob.rotation_euler = (0, 0, rng.uniform(0, 2 * math.pi))
    return ob


# ——— Boulders and bushes ———

_KIT: dict[str, list[bpy.types.Object]] = {}


def boulders() -> list[bpy.types.Object]:
    """A few boulders one unit across, lumpy and faceted, sitting a little sunk in the ground."""
    if "boulders" not in _KIT:
        mat = ground_material("boulder", grass=(0.03, 0.04, 0.02), dry=(0.06, 0.06, 0.03), soil=(0.05, 0.04, 0.03), rock=(0.115, 0.108, 0.1))
        made = []
        ico_v, ico_f = pines._icosphere()
        for k in range(5):
            v = ico_v.copy()
            dirs = v / np.linalg.norm(v, axis=1)[:, None]
            lump = 1 + 0.25 * perlin(dirs[:, 0] * 1.3 + 7 * k, dirs[:, 1] * 1.3 + dirs[:, 2], 61 + k) + 0.1 * perlin(dirs[:, 1] * 4 + k, dirs[:, 2] * 4, 71 + k)
            v = v * lump[:, None] * 0.5
            # Broken faces: a few planes shear the lump, so it reads as split rock, not a pebble.
            rng = np.random.default_rng(91 + k)
            for _ in range(4):
                nrm = rng.normal(size=3)
                nrm[2] = abs(nrm[2]) * 0.6
                nrm /= np.linalg.norm(nrm)
                cut = rng.uniform(0.28, 0.4)
                over = v @ nrm - cut
                v -= np.maximum(over, 0)[:, None] * nrm[None, :]
            v[:, 2] = v[:, 2] * 0.6 + 0.08
            me = bpy.data.meshes.new(f"boulder{k}")
            me.vertices.add(len(v))
            me.vertices.foreach_set("co", v.astype(np.float32).ravel())
            me.loops.add(len(ico_f) * 3)
            me.loops.foreach_set("vertex_index", ico_f.ravel())
            me.polygons.add(len(ico_f))
            me.polygons.foreach_set("loop_start", np.arange(0, len(ico_f) * 3, 3, dtype=np.int32))
            me.update()
            for key, val in (("rock", 1.0), ("snow", 0.0)):
                me.attributes.new(key, "FLOAT", "POINT").data.foreach_set("value", np.full(len(v), val, dtype=np.float32))
            me.materials.append(mat)
            made.append(bpy.data.objects.new(f"boulder{k}", me))
        _KIT["boulders"] = made
    return _KIT["boulders"]


def bushes() -> list[bpy.types.Object]:
    if "bushes" not in _KIT:
        mat = pines.pine_material()
        made = []
        for k in range(5):
            ob = pines.shrub(f"bush{k}", 301 + k)
            ob.data.materials.append(mat)
            made.append(ob)
        _KIT["bushes"] = made
    return _KIT["bushes"]


def scatter(kit: list[bpy.types.Object], X: np.ndarray, Y: np.ndarray, Z: np.ndarray, weight: np.ndarray, per_unit: float, size: tuple[float, float], rng: np.random.Generator, sink: float = 0.2, squash: float = 1.0) -> list[bpy.types.Object]:
    """Copies of the kit over a grid of ground, as many per unit of ground as `per_unit` times
    `weight` there, each its own size and turn."""
    area = cell_area(X, Y, Z) * np.clip(weight, 0, None)
    total = float(area.sum())
    n = int(rng.poisson(total * per_unit)) if total > 0 else 0
    if n == 0:
        return []
    pick = rng.choice(area.size, size=n, p=(area / total).ravel())
    r, c = np.unravel_index(pick, X.shape)
    across = np.abs(np.gradient(X, axis=1))[r, c]
    out = []
    for k in range(n):
        s = size[0] * (size[1] / size[0]) ** rng.uniform(0, 1)
        ob = bpy.data.objects.new("prop", kit[int(rng.integers(0, len(kit)))].data)
        ob.location = (float(X[r[k], c[k]] + rng.uniform(-0.5, 0.5) * across[k]), float(Y[r[k], c[k]]), float(Z[r[k], c[k]] - sink * s))
        ob.scale = (s, s * rng.uniform(0.8, 1.2), s * squash * rng.uniform(0.75, 1.15))
        ob.rotation_euler = (rng.normal(0, 0.06), rng.normal(0, 0.06), rng.uniform(0, 2 * math.pi))
        out.append(ob)
    return out


# ——— The near bank ———

def build_bank(data: dict, layer: Layer, x0: float, x1: float) -> list[bpy.types.Object]:
    b = data["bank"]
    xs = np.asarray(b["xs"])
    keep = (xs >= x0) & (xs <= x1)
    x = xs[keep]
    sy_crest = np.asarray(b["ground"])[keep]
    rock = np.asarray(b["rock"])[keep]
    snow = np.asarray(b["snow"])[keep]
    # In front of the crest (d > 0, towards the eye) the bank rolls over and falls away,
    # steeper where it has turned to rock; behind the crest it drops out of sight. It goes
    # down far enough to fill the tile under the highest knoll.
    # Rows every SPACING units down to REGULAR (where rock is carved, on a square grid), then
    # spreading out to the bottom.
    spacing, regular = 3.0, 420.0
    d = np.concatenate([np.arange(0.0, regular + 1e-6, spacing), regular + (1300.0 - regular) * (np.arange(1, 41) / 40) ** 1.5])
    back = np.array([2.0, 6.0, 14.0, 30.0, 60.0, 110.0])
    yrows = np.concatenate([-d[::-1], back])
    X = np.broadcast_to(x[None, :], (len(yrows), len(x))).copy()
    Y = np.broadcast_to(yrows[:, None], X.shape).copy()
    zc = layer.z_at(sy_crest, 0.0)
    # The crest's small breaks (rock towers, chips) belong to the crest: a little way down
    # the face they give way to its broad shape, or every notch would run down it as a groove.
    broad = ndimage.gaussian_filter1d(zc, 14.0, mode="nearest")
    s = 0.85 + 0.9 * rock
    c = 130.0 * (1 - 0.6 * rock)
    dd = np.maximum(-Y, 0.0)
    face = -s[None, :] * (np.sqrt(dd**2 + c[None, :] ** 2) - c[None, :])
    behind = -(0.35 * np.maximum(Y, 0.0) + 0.004 * np.maximum(Y, 0.0) ** 2)
    roll = smoothstep(0.0, 60.0, dd)
    bumps = (14 * perlin(X / 170, dd / 170, 3) + 6 * perlin(X / 52, dd / 52, 4) + 2.2 * perlin(X / 17, dd / 17, 5)) * roll
    # Rock is broken into crags and buttresses in both directions, not ribbed.
    crags = (ridged(X, dd * 1.3 + 3000, 160.0, 5.0, seed=29) * 1.1 + 9.0 * perlin(X / 60, dd / 45, 30)) * smoothstep(0.0, 40.0, dd)
    crest = broad[None, :] + (zc - broad)[None, :] * np.exp(-dd / 30.0)
    Z = crest + face + behind + bumps * (1 - rock[None, :]) + crags * rock[None, :]
    rk = np.broadcast_to(rock[None, :], X.shape)
    # Snow along the crest where it is high enough, a cornice-like band thinning down the face.
    sn = np.broadcast_to(snow[None, :], X.shape) * (0.55 + 0.45 * np.exp(-dd / 25.0))
    # Where the bank has turned to rock it is the mountain's own: gullies and ribs cut down
    # its fall line, and snow lying where it would, as the rendered ranges behind it.
    potential = np.full(X.shape, -1.0, dtype=np.float32)
    tone = np.full(X.shape, 0.5, dtype=np.float32)
    dull = np.zeros(X.shape, dtype=np.float32)
    rocky = rock.max() > 0.02
    if rocky:
        block = (Y <= 0) & (dd <= regular + 1e-6)
        rows = np.nonzero(block[:, 0])[0]
        sl = slice(rows[0], rows[-1] + 1)
        h0 = Z[sl].astype(np.float64)
        carved, ribs, stain = carve(h0, X[sl], Y[sl], spacing)
        w = rk[sl] * smoothstep(6.0, 24.0, dd[sl])
        Z[sl] = h0 + (carved - h0) * w
        pot, tn, dl = surface(Z[sl] + 6000.0, X[sl], Y[sl], spacing, ribs, stain)
        # A cornice of snow along the crest, as the painted ridge has; none where the carved
        # block ends (its edge would read as a hollow).
        cap = 0.95 * np.exp(-dd[sl] / 16.0) * sn[sl]
        potential[sl] = pot - 0.9 * (1.0 - sn[sl]) + cap - smoothstep(regular - 90.0, regular, dd[sl])
        tone[sl] = tn
        dull[sl] = dl
    # Grass on the face and along the crest (where blades break the skyline), thinning on rock.
    meadow = (1 - smoothstep(0.35, 0.7, rk)) * (1 - smoothstep(4.0, 12.0, Y))
    ground = grid_mesh(f"bank{x0:.0f}", X, Y, Z, {"rock": rk, "snow": sn, "potential": potential, "tone": tone, "dull": dull}, {"meadow": meadow})
    ground.data.materials.append(ground_material("bank-ground", grass=(0.035, 0.05, 0.02), dry=(0.075, 0.07, 0.035), soil=(0.05, 0.036, 0.026), rock=(0.16, 0.15, 0.14)))
    if rocky:
        ground.data.materials.append(k2_render.material(spacing))
        # Each face takes the mountain's rock where the bank is rock, the meadow's turf where
        # it is not, the boundary between them ragged.
        cols = X.shape[1]
        a = np.arange((X.shape[0] - 1) * cols).reshape(X.shape[0] - 1, cols)[:, :-1].ravel()
        ragged = rk.ravel()[a] + 0.18 * perlin(X.ravel()[a] / 40, Y.ravel()[a] / 40, 44)
        ground.data.polygons.foreach_set("material_index", (ragged > 0.5).astype(np.int32))
    front = Y < 0
    grass_area = float((cell_area(X, Y, Z) * meadow * front).sum())
    add_grass(ground, grass_material("bank-grass", (0.018, 0.03, 0.012), (0.1, 0.11, 0.04)), grass_area, 0.22, 7.0, seed=int(x0) & 0xFFFF)
    if rocky:
        dice = ground.modifiers.new("dice", "SUBSURF")
        dice.subdivision_type = "SIMPLE"
        dice.use_adaptive_subdivision = True
        dice.adaptive_space = "OBJECT"
        dice.adaptive_object_edge_length = 1.5 * spacing
    out = [ground]
    rng = np.random.default_rng(int(x0 + 100000))
    # Under each scene's words the bank stays quiet: few bushes, fewer stones.
    words = np.zeros_like(X)
    for sc in data["scenes"]:
        words = np.maximum(words, smoothstep(sc["x"] - 1100, sc["x"] - 900, X) * (1 - smoothstep(sc["x"] - 200, sc["x"], X)))
    patches = smoothstep(0.15, 0.55, perlin(X / 260, dd / 260, 41) * 0.5 + 0.5)
    clusters = smoothstep(0.62, 0.8, perlin(X / 70, dd / 70, 42) * 0.5 + 0.5)
    on_face = front * smoothstep(10.0, 40.0, dd)
    out += scatter(bushes(), X, Y, Z, on_face * meadow * (0.08 + clusters) * patches * (1 - 0.8 * words), 1 / 300, (8.0, 34.0), rng, sink=0.15)
    out += scatter(boulders(), X, Y, Z, on_face * (0.08 + 0.25 * clusters) * (1 - 0.7 * words) * (1 - rk), 1 / 3200, (5.0, 28.0), rng, sink=0.45)
    for tx, base, h, w in b["trees"]:
        if x0 - w <= tx <= x1 + w:
            out.append(plant("near", tx, 3.0, layer.z_at(base, 3.0) - 2.0, h, w, rng, layer))
    return out


# ——— The forested ridges ———

def build_ridge(data: dict, index: int, layer: Layer, x0: float, x1: float) -> list[bpy.types.Object]:
    r = data["ridges"][index]
    xs = np.asarray(r["xs"])
    keep = (xs >= x0) & (xs <= x1)
    x = xs[keep][::2]
    sy_crest = np.asarray(r["ground"])[keep][::2]
    d = depth_rows(300.0, 50, 1.4)
    back = np.array([2.0, 8.0, 20.0, 50.0])
    yrows = np.concatenate([-d[::-1], back])
    X = np.broadcast_to(x[None, :], (len(yrows), len(x))).copy()
    Y = np.broadcast_to(yrows[:, None], X.shape).copy()
    dd = np.maximum(-Y, 0.0)
    zc = layer.z_at(sy_crest, 0.0)
    face = -0.75 * (np.sqrt(dd**2 + 30.0**2) - 30.0)
    behind = -0.5 * np.maximum(Y, 0.0)
    bumps = 5 * perlin(X / 90, dd / 90, 7) * smoothstep(0.0, 20.0, dd)
    Z = zc[None, :] + face + behind + bumps
    ground = grid_mesh(f"ridge{index}-{x0:.0f}", X, Y, Z, {"rock": np.zeros_like(X), "snow": np.zeros_like(X)})
    ground.data.materials.append(ground_material("forest-floor", grass=(0.02, 0.028, 0.014), dry=(0.035, 0.03, 0.018), soil=(0.03, 0.022, 0.016), rock=(0.1, 0.1, 0.1)))
    out = [ground]
    rng = np.random.default_rng(index * 7919 + int(x0) + 50000)
    tree_h, tree_w = r["treeH"], r["treeH"] * 0.5
    # The row on the crest is the painted one, pine for pine; the forest goes on down the
    # face in front of it, row behind row, so the slope is all treetops.
    for tx, base, h, w in r["trees"]:
        if x0 - w <= tx <= x1 + w:
            out.append(plant("far", tx, rng.uniform(-1.0, 4.0), layer.z_at(base, 0.0) - 1.5, h, w, rng, layer))
    crest = profile(r["xs"], r["ground"])
    depth = 0.0
    while True:
        depth += tree_w * rng.uniform(0.5, 0.75)
        x = x0 - tree_w + rng.uniform(0, tree_w)
        any_visible = False
        while x < x1 + tree_w:
            zc_here = layer.z_at(crest(x), 0.0)
            z = zc_here - 0.75 * (math.sqrt(depth**2 + 900.0) - 30.0)
            sy_base = z * layer.cos - depth * layer.sin
            if crest(x) - sy_base < layer.below + 20:
                any_visible = True
                h = tree_h * rng.uniform(0.55, 1.25)
                out.append(plant("far", x, -depth, z - 1.0, h, h * rng.uniform(0.42, 0.55), rng, layer))
            x += tree_w * rng.uniform(0.55, 0.95)
        if not any_visible:
            break
    return out


# ——— The valley floor and the falls' cliff ———

def build_valley(data: dict, layer: Layer, x0: float, x1: float) -> list[bpy.types.Object]:
    v = data["valley"]
    ground_y = profile(v["xs"], v["ground"])
    river_top = profile(v["xs"], v["riverTop"])
    river_bottom = profile(v["xs"], v["riverBottom"])
    x = np.arange(x0, x1 + 4.0, 4.0)
    z0 = -262.0 / layer.cos
    deep = lambda sy: (sy - z0 * layer.cos) / layer.sin  # noqa: E731 — the plain's depth seen at screen height sy
    front = -660.0
    far = np.maximum(ground_y(x), river_top(x) + 8.0)
    t = np.linspace(0.0, 1.0, 230)[:, None]
    SY = front + (far[None, :] - front) * t
    X = np.broadcast_to(x[None, :], SY.shape).copy()
    Y = deep(SY)
    # The river's bed, a little below the meadow, with soft banks; the site's water lies over it.
    rt, rb = river_top(x)[None, :], river_bottom(x)[None, :]
    inside = smoothstep(rb - 1.5, rb + 1.5, SY) * (1 - smoothstep(rt - 1.5, rt + 1.5, SY))
    swell = 2.0 * perlin(X / 90, Y / 90, 11) + 0.8 * perlin(X / 25, Y / 25, 12)
    Z = z0 + swell * (1 - inside) - 5.0 * inside
    # One more row behind the far edge, dropped, so the edge is a clean line.
    X = np.concatenate([X, X[-1:]], 0)
    Y = np.concatenate([Y, Y[-1:] + 30.0], 0)
    Z = np.concatenate([Z, Z[-1:] - 40.0], 0)
    near_water = np.concatenate([smoothstep(rb - 5, rb, SY) * (1 - smoothstep(rt, rt + 5, SY)), np.zeros((1, len(x)))], 0)
    meadow = (1 - near_water) * np.concatenate([np.ones_like(SY), np.zeros((1, len(x)))], 0)
    rock = 0.0 * X
    floor = grid_mesh(f"valley{x0:.0f}", X, Y, Z, {"rock": rock, "snow": rock, "wet": near_water}, {"meadow": meadow})
    floor.data.materials.append(ground_material("valley-ground", grass=(0.04, 0.06, 0.022), dry=(0.08, 0.075, 0.035), soil=(0.055, 0.04, 0.028), rock=(0.15, 0.14, 0.13)))
    add_grass(floor, grass_material("valley-grass", (0.02, 0.034, 0.012), (0.11, 0.12, 0.045)), (x1 - x0) * float(np.mean(Y[-2] - Y[0])), 0.06, 4.5, seed=int(x0) & 0xFFFF)
    out = [floor]
    rng = np.random.default_rng(int(x0) + 77777)
    Xp, Yp, Zp = X[:-1], Y[:-1], Z[:-1]
    patches = smoothstep(0.2, 0.6, perlin(Xp / 300, Yp / 300, 51) * 0.5 + 0.5)
    dry_land = 1 - smoothstep(rb - 8, rb - 3, SY) * (1 - smoothstep(rt + 3, rt + 8, SY))
    out += scatter(bushes(), Xp, Yp, Zp, patches * dry_land * (SY < far[None, :] - 2), 1 / 1400, (4.0, 14.0), rng, sink=0.2)
    out += scatter(boulders(), Xp, Yp, Zp, (0.15 + patches) * dry_land, 1 / 6000, (3.0, 10.0), rng, sink=0.35)

    cliff = v["cliff"]
    cx = np.asarray(cliff["xs"])
    if cx[-1] >= x0 and cx[0] <= x1:
        out += build_cliff(data, layer, deep, z0, river_top, max(x0, cx[0]), min(x1, cx[-1]))
        # Scree: rock fallen from the face, heaped along its foot.
        under = (Xp >= cx[0] + 20) & (Xp <= cx[-1] - 20)
        near_foot = smoothstep(rt - 2, rt + 2, SY) * under
        out += scatter(boulders(), Xp, Yp, Zp, near_foot, 1 / 90, (3.0, 12.0), rng, sink=0.3)
    return out


def build_cliff(data: dict, layer: Layer, deep, z0: float, river_top, x0: float, x1: float) -> list[bpy.types.Object]:
    v = data["valley"]
    cliff = v["cliff"]
    rim = profile(cliff["xs"], cliff["ground"])
    x = np.arange(x0, x1 + 2.0, 2.0)
    sy_rim = rim(x)
    # The face stands just behind the river's far bank, from the meadow up to the rim.
    yc = deep(river_top(x)) + 10.0
    foot = z0 - 6.0
    u = np.linspace(0.0, 1.0, 220)[:, None]
    Xf = np.broadcast_to(x[None, :], (len(u), len(x))).copy()

    def set_back(Zf: np.ndarray, up: np.ndarray) -> np.ndarray:
        """How far back of the foot each point of the face stands: granite in bands, each
        stepping back onto a ledge at its top; buttresses standing out of it; joints running
        down it; a lean back overall."""
        # The bands wander up and down along the face, and their ledges come and go.
        t = (Zf - foot) / 52.0 + 0.9 * perlin(Xf / 150, Xf * 0 + 0.5, 36) + 0.3 * perlin(Xf / 40, Zf / 90, 37)
        steps = np.floor(t) + smoothstep(0.8, 1.0, t - np.floor(t))
        ledge = 9.0 * smoothstep(-0.25, 0.45, perlin(Xf / 70, Zf / 160, 38))
        steps = steps * ledge
        # Big blocks standing proud or set back, broken along diagonal fractures.
        blocks = 14.0 * perlin((Xf + 0.45 * Zf) / 120, (Zf - 0.3 * Xf) / 120, 39)
        buttress = 30.0 * np.maximum(0.0, perlin(Xf / 95, Xf * 0 + 1.7, 35)) ** 0.8 * (1 - 0.5 * up)
        joints = 5.0 * np.abs(perlin(Xf / 24, Zf / 240, 31)) + 2.5 * perlin(Xf / 8, Zf / 30, 32) + 1.2 * perlin(Xf / 3, Zf / 6, 40)
        return 0.12 * (Zf - foot) + steps + blocks - buttress + joints

    # The rim is put where the painted line is: solved for, since how far back it stands
    # depends on how high it is.
    z_rim = layer.z_at(sy_rim, yc)
    for _ in range(4):
        Zf = foot + (z_rim[None, :] - foot) * u
        Yf = yc[None, :] + set_back(Zf, u)
        z_rim = layer.z_at(sy_rim, Yf[-1])
    Zf = foot + (z_rim[None, :] - foot) * u
    Yf = yc[None, :] + set_back(Zf, u)
    # Behind the rim the ground drops away out of sight, under the pines.
    back = np.array([3.0, 8.0, 18.0, 40.0, 90.0])[:, None]
    Yb = Yf[-1:] + back
    Zb = z_rim[None, :] - 0.45 * back
    X = np.concatenate([Xf, np.broadcast_to(x[None, :], Yb.shape)], 0)
    Y = np.concatenate([Yf, Yb], 0)
    Z = np.concatenate([Zf, Zb], 0)
    # The face is rock; the rim and the ground behind it carry turf.
    rockiness = np.concatenate([np.ones_like(Zf) * (1 - smoothstep(0.985, 1.0, u)), np.zeros_like(Zb)], 0)
    meadow = np.concatenate([np.zeros_like(Zf), np.ones_like(Zb)], 0)
    ob = grid_mesh(f"cliff{x0:.0f}", X, Y, Z, {"rock": rockiness, "snow": 0 * X}, {"meadow": meadow})
    ob.data.materials.append(ground_material("cliff-rock", grass=(0.03, 0.045, 0.018), dry=(0.06, 0.06, 0.03), soil=(0.045, 0.035, 0.025), rock=(0.22, 0.205, 0.19), wet_x=float(v["falls"]) + 16.0, streaks=True))
    add_grass(ob, grass_material("cliff-grass", (0.02, 0.032, 0.012), (0.09, 0.1, 0.04)), float((cell_area(X, Y, Z) * meadow).sum()), 0.2, 4.0, seed=7)
    out = [ob]
    rng = np.random.default_rng(4242)
    # Bushes on the ledges, and scree fallen to the foot.
    up_facing = np.zeros_like(Zf)
    up_facing[1:-1] = smoothstep(0.6, 1.4, (Yf[2:] - Yf[:-2]) / np.maximum(Zf[2:] - Zf[:-2], 1e-3))
    out += scatter(bushes(), Xf, Yf, Zf, up_facing * (u < 0.95), 1 / 160, (5.0, 13.0), rng, sink=0.3)
    for tx, base, h, w in cliff["trees"]:
        if x0 - w <= tx <= x1 + w:
            ytree = float(np.interp(tx, x, Yf[-1])) + 6.0
            out.append(plant("far", tx, ytree, layer.z_at(base, ytree) - 1.0, h, w, rng, layer))
    return out


# ——— Scene ———

def setup() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = SAMPLES
    sc.cycles.use_adaptive_sampling = True
    sc.cycles.use_denoising = True
    sc.cycles.max_bounces = 4
    sc.cycles.diffuse_bounces = 2
    sc.cycles.glossy_bounces = 1
    sc.cycles.transmission_bounces = 2
    sc.cycles.transparent_max_bounces = 4
    sc.render.film_transparent = True
    sc.render.use_persistent_data = True
    sc.view_settings.view_transform = "Standard"
    sc.cycles_curves.shape = "RIBBONS"
    sc.cycles_curves.subdivisions = 2
    vl = sc.view_layers[0]
    vl.cycles.denoising_store_passes = True
    aov = vl.aovs.add()
    aov.name = "sway"
    aov.type = "VALUE"
    for g in LIGHTS:
        vl.lightgroups.add(name=g)
    world = bpy.data.worlds.new("sky")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (1, 1, 1, 1)
    world.lightgroup = "sky"
    sc.world = world
    for name, side in (("left", -1.0), ("right", 1.0)):
        lamp = bpy.data.lights.new(name, "SUN")
        lamp.energy = SUN_ENERGY
        lamp.angle = math.radians(4)
        ob = bpy.data.objects.new(name, lamp)
        ob.lightgroup = name
        # Off to the side and up, as the mountains are lit, but raking across the layer rather
        # than from beyond it: these layers mostly face the eye, and a light from behind them
        # would leave every face in its own shadow, the relief unseen.
        to = Vector((side * 0.82, 0.05, 0.5)).normalized()
        ob.rotation_euler = (-to).to_track_quat("-Z", "Y").to_euler()
        sc.collection.objects.link(ob)
    cam = bpy.data.cameras.new("eye")
    cam.type = "ORTHO"
    cam.clip_start = 1.0
    cam.clip_end = 50000.0
    co = bpy.data.objects.new("eye", cam)
    sc.collection.objects.link(co)
    sc.camera = co
    # Each light, denoised on its own with the render's albedo and normals, then written out
    # with the coverage and the sway.
    ng = bpy.data.node_groups.new("out", "CompositorNodeTree")
    sc.compositing_node_group = ng
    sc.render.use_compositing = True
    rl = ng.nodes.new("CompositorNodeRLayers")
    fo = ng.nodes.new("CompositorNodeOutputFile")
    fo.name = "tile"
    fo.directory = WORK
    fo.format.media_type = "MULTI_LAYER_IMAGE"
    fo.format.file_format = "OPEN_EXR_MULTILAYER"
    fo.format.color_depth = "32"
    fo.file_output_items.clear()
    for g in LIGHTS:
        dn = ng.nodes.new("CompositorNodeDenoise")
        ng.links.new(rl.outputs[f"Combined_{g}"], dn.inputs["Image"])
        ng.links.new(rl.outputs["Denoising Normal"], dn.inputs["Normal"])
        ng.links.new(rl.outputs["Denoising Albedo"], dn.inputs["Albedo"])
        fo.file_output_items.new("RGBA", g)
        ng.links.new(dn.outputs["Image"], fo.inputs[g])
    for key, sock in (("alpha", "Alpha"), ("sway", "sway")):
        fo.file_output_items.new("FLOAT", key)
        ng.links.new(rl.outputs[sock], fo.inputs[key])


def aim(layer: Layer, cx: float, cy: float, w: int, h: int) -> None:
    """Point the camera at screen point (cx, cy) of the layer, framing w × h units plus the border."""
    sc = bpy.context.scene
    co = sc.camera
    up = Vector((0.0, layer.sin, layer.cos))
    fwd = Vector((0.0, layer.cos, -layer.sin))
    co.location = Vector((cx, 0.0, 0.0)) + up * cy - fwd * 20000.0
    co.rotation_euler = (math.pi / 2 - layer.tilt, 0.0, 0.0)
    sc.render.resolution_x = w + 2 * BORDER
    sc.render.resolution_y = h + 2 * BORDER
    sc.render.resolution_percentage = 100
    co.data.ortho_scale = float(max(w, h) + 2 * BORDER)


# ——— Tiles ———

LAYERS = {
    "ridge0": Layer("ridge0", 5.0, 150.0),
    "ridge1": Layer("ridge1", 5.0, 150.0),
    "valley": Layer("valley", 12.0, 0.0),
    "bank": Layer("bank", 8.0, 520.0),
}


def tiles_for(name: str, data: dict) -> list[dict]:
    """The layer cut into TILE-wide tiles, each just tall enough for its edge, pines included."""
    if name == "bank":
        b = data["bank"]
        xs, tops, lows = np.asarray(b["xs"]), np.asarray(b["ys"]), np.asarray(b["ground"])
        trees = b["trees"]
        x_lo, x_hi = xs[0], xs[-1]
    elif name.startswith("ridge"):
        r = data["ridges"][int(name[-1])]
        xs, tops, lows = np.asarray(r["xs"]), np.asarray(r["ys"]), np.asarray(r["ground"])
        trees = r["trees"]
        x_lo, x_hi = xs[0], xs[-1]
    else:
        v = data["valley"]
        xs = np.asarray(v["xs"], dtype=np.float64)
        far = np.maximum(np.asarray(v["ground"]), np.asarray(v["riverTop"]) + 8.0)
        cx = np.asarray(v["cliff"]["xs"])
        tops = np.maximum(far, np.interp(xs, cx, np.asarray(v["cliff"]["ys"]), left=-1e9, right=-1e9))
        lows = np.full_like(xs, -620.0 + LAYERS["valley"].below)
        trees = v["cliff"]["trees"]
        x_lo, x_hi = xs[0], xs[-1]
    layer = LAYERS[name]
    out = []
    x0 = math.floor(x_lo / TILE) * TILE
    i = 0
    while x0 < x_hi:
        x1 = x0 + TILE
        inside = (xs >= x0 - 8) & (xs <= x1 + 8)
        if inside.any():
            top = float(tops[inside].max())
            for tx, base, h, w in trees:
                if x0 - w <= tx <= x1 + w:
                    top = max(top, base + h * 1.08)
            top += 14.0
            low = float(lows[inside].min()) - layer.below
            y1 = math.ceil(top / 8) * 8
            y0 = math.floor(low / 8) * 8
            out.append({"i": i, "x0": x0, "x1": x1, "y0": y0, "y1": y1})
            i += 1
        x0 = x1
    return out


BUILDERS = {
    "bank": lambda data, layer, x0, x1: build_bank(data, layer, x0, x1),
    "ridge0": lambda data, layer, x0, x1: build_ridge(data, 0, layer, x0, x1),
    "ridge1": lambda data, layer, x0, x1: build_ridge(data, 1, layer, x0, x1),
    "valley": lambda data, layer, x0, x1: build_valley(data, layer, x0, x1),
}
# How much ground to build either side of a group of tiles: enough for the longest shadow.
MARGIN = {"bank": 560.0, "ridge0": 120.0, "ridge1": 140.0, "valley": 420.0}
GROUP = {"bank": 3, "ridge0": 8, "ridge1": 8, "valley": 6}


def render_layer(name: str, data: dict) -> list[dict]:
    layer = LAYERS[name]
    tiles = tiles_for(name, data)
    todo = [t for t in tiles if not ONLY_TILES or t["i"] in ONLY_TILES]
    fo = bpy.context.scene.compositing_node_group.nodes["tile"]
    for g in range(0, len(todo), GROUP[name]):
        group = todo[g : g + GROUP[name]]
        gx0 = min(t["x0"] for t in group) - MARGIN[name]
        gx1 = max(t["x1"] for t in group) + MARGIN[name]
        t0 = time.time()
        obs = BUILDERS[name](data, layer, gx0, gx1)
        for ob in obs:
            bpy.context.scene.collection.objects.link(ob)
        print(f"[fg] {name} tiles {group[0]['i']}–{group[-1]['i']}: {len(obs)} objects built in {time.time() - t0:.0f}s", flush=True)
        for t in group:
            w, h = t["x1"] - t["x0"], t["y1"] - t["y0"]
            aim(layer, (t["x0"] + t["x1"]) / 2, (t["y0"] + t["y1"]) / 2, w, h)
            fo.file_name = f"{name}-{t['i']:02d}"
            t1 = time.time()
            bpy.ops.render.render(write_still=False)
            print(f"[fg] {name} tile {t['i']} ({w}×{h}) rendered in {time.time() - t1:.0f}s", flush=True)
            if TEST:
                preview(os.path.join(WORK, f"{name}-{t['i']:02d}.exr"), os.path.join(WORK, f"test-{name}-{t['i']:02d}.png"))
        for ob in obs:
            me = ob.data
            bpy.data.objects.remove(ob)
            if me is not None and me.users == 0:
                bpy.data.meshes.remove(me)
        for ps in list(bpy.data.particles):
            if ps.users == 0:
                bpy.data.particles.remove(ps)
    return tiles


# ——— Reading the renders back ———

def read_tile(path: str) -> dict[str, np.ndarray]:
    import OpenEXR

    out: dict[str, np.ndarray] = {}
    with OpenEXR.File(path) as f:
        for part in f.parts:
            ch = next(iter(part.channels.values()))
            out[part.name()] = np.array(ch.pixels, dtype=np.float32)
    b = BORDER
    return {k: v[b:-b, b:-b] for k, v in out.items()}


def _lin(hexs: str) -> np.ndarray:
    c = np.array([int(hexs[i : i + 2], 16) / 255 for i in (1, 3, 5)])
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def _srgb(c: np.ndarray) -> np.ndarray:
    c = np.clip(c, 0, None)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)


def preview(src: str, out: str) -> None:
    """Dawn (sun from the left) above afternoon (sun from the right), over the hour's sky."""
    t = read_tile(src)
    a = t["alpha"][..., None]
    rows = []
    for sun, k, sky, ks, left, bg in (("#ffe3c6", 0.85, "#7d7fb4", 0.5, 0.78, "#f7c2a2"), ("#fff0d4", 1.3, "#76a2d0", 0.55, 0.14, "#eedec4")):
        c = _lin(sun) * k * (left * t["left"][..., :3] + (1 - left) * t["right"][..., :3]) + _lin(sky) * ks * t["sky"][..., :3]
        rows.append(_srgb(c / np.maximum(a, 1e-3)) * a + _srgb(_lin(bg)) * (1 - a))
    write_image(np.concatenate(rows, 0), out)


def write_image(img: np.ndarray, out: str, quality: int = 92) -> None:
    """An RGB or grey image (0–1 floats) to PNG or WebP, through ImageMagick."""
    h, w = img.shape[:2]
    grey = img.ndim == 2
    raw = out + (".pgm" if grey else ".ppm")
    with open(raw, "wb") as fh:
        fh.write(f"{'P5' if grey else 'P6'} {w} {h} 255\n".encode())
        fh.write((np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8).tobytes())
    cmd = ["convert", raw]
    if out.endswith(".webp"):
        cmd += ["-quality", str(quality), "-define", "webp:method=6"]
    subprocess.run(cmd + [out], check=True)
    os.remove(raw)


# ——— The site's textures ———

# Texels per world unit kept for the site: a little under the render's one, which costs little
# sharpness at the sizes the site draws them and a good deal of weight; phones get half that.
STORE = {"": 0.75, "-half": 0.375}


def soften(name: str, data: dict, t: dict, img: np.ndarray) -> np.ndarray:
    """The near ground, out of focus the nearer it is: the bank's face from a little below its
    crest, the valley floor in front of the river. A photograph's foreground goes soft the same
    way; it keeps the words over the bank calm, and soft texture costs a fraction of the bytes."""
    if name not in ("bank", "valley"):
        return img
    h, w = img.shape[:2]
    x = t["x0"] + np.arange(w) + 0.5
    y = t["y1"] - np.arange(h) - 0.5
    if name == "bank":
        edge = np.interp(x, data["bank"]["xs"], data["bank"]["ground"])
        start, full = 80.0, 380.0
    else:
        edge = np.interp(x, data["valley"]["xs"], data["valley"]["riverBottom"])
        start, full = 40.0, 260.0
    weight = smoothstep(start, full, edge[None, :] - y[:, None])
    if weight.max() <= 0:
        return img
    sigma = (3.5, 3.5, 0) if img.ndim == 3 else 3.5
    soft = ndimage.gaussian_filter(img, sigma, mode="nearest")
    blend = weight[..., None] if img.ndim == 3 else weight
    return img * (1 - blend) + soft * blend


def stacked(slots: list[np.ndarray], factor: float, pad: int) -> np.ndarray:
    """Images the same size, each scaled by `factor`, stacked top to bottom `pad` rows apart."""
    from PIL import Image

    out = []
    for k, im in enumerate(slots):
        h, w = im.shape[:2]
        mode = "RGB" if im.ndim == 3 else "L"
        small = Image.fromarray((np.clip(im, 0, 1) * 255 + 0.5).astype(np.uint8), mode).resize((round(w * factor), round(h * factor)), Image.LANCZOS)
        if k:
            out.append(np.zeros((round(pad * factor),) + np.asarray(small).shape[1:], np.uint8))
        out.append(np.asarray(small))
    return np.concatenate(out, 0)


def save_webp(img: np.ndarray, path: str, quality: int) -> None:
    from PIL import Image

    Image.fromarray(img, "RGB" if img.ndim == 3 else "L").save(path, "WEBP", quality=quality, method=6)


def export(tiles: dict[str, list[dict]]) -> None:
    """Per tile: a light texture (the three lights stacked, square roots of linear light
    over the layer's scale, as the mountains') and a mask texture (coverage, sway), at the
    site's two sizes (STORE); and the index the site reads."""
    with open(SCENERY) as fh:
        data = json.load(fh)
    os.makedirs(TEXTURES, exist_ok=True)
    index = {"pad": PAD, "layers": {}}
    if os.path.exists(DATA):
        with open(DATA) as fh:
            index["layers"] = json.load(fh).get("layers", {})
    total = 0
    for name, layer_tiles in tiles.items():
        layer = LAYERS[name]
        loaded = {t["i"]: read_tile(os.path.join(WORK, f"{name}-{t['i']:02d}.exr")) for t in layer_tiles}
        values = np.concatenate([np.concatenate([got[g][..., :3][got["alpha"] > 0.5].ravel() for g in LIGHTS]) for got in loaded.values()])
        scale = float(np.percentile(values, 99.9)) if len(values) else 1.0
        entries = []
        for t in layer_tiles:
            got = loaded[t["i"]]
            light = [soften(name, data, t, np.sqrt(np.clip(got[g][..., :3] / scale, 0, 1))) for g in LIGHTS]
            # Sway only needs to be smooth: blurred, it costs a fraction of the bytes.
            mask = [np.clip(got["alpha"], 0, 1), np.clip(ndimage.gaussian_filter(got["sway"], 1.5), 0, 1)]
            base = os.path.join(TEXTURES, f"{name}-{t['i']:02d}")
            for size, factor in STORE.items():
                save_webp(stacked(light, factor, PAD), base + f"-light{size}.webp", 80)
                save_webp(stacked(mask, factor, PAD), base + f"-mask{size}.webp", 84)
                total += os.path.getsize(base + f"-light{size}.webp") + os.path.getsize(base + f"-mask{size}.webp")
            entries.append({"i": t["i"], "x0": t["x0"], "x1": t["x1"], "y0": t["y0"], "y1": t["y1"]})
        index["layers"][name] = {"scale": round(scale, 5), "tilt": math.degrees(layer.tilt), "tiles": entries}
        print(f"[fg] {name}: {len(entries)} tiles exported, light scale {scale:.4f}", flush=True)
    with open(DATA, "w") as fh:
        json.dump(index, fh, indent=1)
    print(f"[fg] {total / 1e6:.1f} MB written", flush=True)


def main() -> None:
    with open(SCENERY) as fh:
        data = json.load(fh)
    os.makedirs(WORK, exist_ok=True)
    names = ONLY_LAYERS or list(LAYERS)
    if EXPORT:
        export({n: tiles_for(n, data) for n in names})
        return
    setup()
    done = {}
    for name in names:
        done[name] = render_layer(name, data)
    if not TEST and not ONLY_TILES:
        export(done)


if __name__ == "__main__":
    main()
