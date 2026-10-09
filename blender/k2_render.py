"""K2's layers, rendered: the real terrain, with rock and snow, lit three ways.

The site draws K2's range as five layers at different depths (see k2_panorama.py). This
renders each layer for real in Cycles: the elevation data, sharpened with procedural ridges
and gullies finer than the data can hold, under a snow and rock material, seen from the same
eye through a panoramic camera whose image maps angle to pixel exactly as the site does.
Each layer is clipped to its own band of distance, so nearer layers never hide it, and is
lit three ways at once, each light in its own light group: a low sun from the left, one from
the right, and the open sky. The site mixes the three for the hour.

    /home/user/.venvs/blender/bin/python blender/k2_render.py [--test] [--only=0,1]

    /home/user/.venvs/blender/bin/python blender/k2_render.py --export   # textures from the last render
    blender/render_k2.sh   # every layer, one process each (memory), then the export

Out, per layer i (0 the farthest): src/world/textures/k2-{i}-light.webp (the three lights,
stacked top to bottom in one grey image) and k2-{i}-mask.webp (coverage, distance through the
layer, bare rock, stacked the same way), each also at half size (-half) for phones; and
src/world/data/k2Render.json, which places them. Attribution: Terrain Tiles (Mapzen / AWS
Open Data).
"""
from __future__ import annotations

import json
import math
import os
import subprocess
import sys

import bpy  # must precede bmesh/mathutils when bpy is a pip module
import numpy as np
from scipy import ndimage

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from k2_panorama import BANDS_KM, EARTH_R, EYE_ABOVE_GROUND_M, EYE_DISTANCE_KM, REFRACTION, bilinear  # noqa: E402
from mountain import mosaic  # noqa: E402
from terrain_detail import carve, dem_heights, smoothstep, surface  # noqa: E402

ROOT = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(ROOT)
TEXTURES = os.path.join(REPO, "src", "world", "textures")
DATA = os.path.join(REPO, "src", "world", "data", "k2Render.json")
WORK = os.path.join(ROOT, "out", "k2render")

TEST = "--test" in sys.argv
EXPORT = "--export" in sys.argv  # write the site's textures from the last render's EXRs
ONLY = next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--only=")), "")

RADIUS = 2  # DEM tiles either side of K2's: wide enough for the far layer to the arc's ends
# Pixels per degree, each way: K2's own layer is the centre of the picture, so it gets more.
PX_PER_DEG = 20
BAND_PX = [30, 20, 20, 20, 20]
# Each layer's arc, far layer first, in degrees either side of the line to the summit. A
# layer slides by its parallax times the camera's travel (src/world/scenery/mountains.ts:
# PARALLAX, journey GAP × 8), so nearer layers need more to the right, where the journey
# goes; on the left, half of the widest (21:9) screen.
BAND_LON = [(-58.0, 70.0), (-58.0, 84.0), (-58.0, 98.0), (-58.0, 113.0), (-58.0, 127.0)]
TEST_LON = tuple(float(v) for v in next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--lon=")), "-16,16").split(","))
SAMPLES = 24 if TEST else 48
BELOW_DEG = 7.0
LIGHTS = ("left", "right", "sky")
# True displacement on adaptively diced geometry, so steep walls get relief a heightfield
# cannot hold. Diced by edge length on the ground (this share of the ring's mesh spacing), not
# by pixels: the mesh already matches the pixels where the ground is flat, so only the quads
# a steep wall stretches tall are split, and memory stays predictable.
DISPLACE = "--no-displace" not in sys.argv
DICE_EDGE = 1.5


# ——— Terrain ———

# One pixel, in radians, at the base resolution (meshes are sized by it, whatever a layer's own).
PX_RAD = math.radians(1.0 / PX_PER_DEG)
# Mesh spacing at a ring's near edge, in pixels there.
VERT_PX = 1.3


def rings(near_m: float, far_m: float) -> list[tuple[float, float, float]]:
    """A layer's distance split into rings, each twice as far as the last and meshed twice as
    coarsely, so a vertex covers about the same few pixels everywhere."""
    out = []
    r0 = near_m
    while r0 < far_m - 1:
        r1 = min(far_m, r0 * 2.0)
        if far_m - r1 < r0 * 0.4:  # no sliver of a ring at the end
            r1 = far_m
        out.append((r0, r1, r0 * PX_RAD * VERT_PX))
        r0 = r1
    return out


def ring_mesh(name: str, dem: np.ndarray, mpp: float, eye: tuple[float, float, float], bearing: float, lon: tuple[float, float], lo_m: float, hi_m: float, spacing: float, floor_deg: float, skirt: tuple[float, float] | None = None, curtain_m: float | None = None) -> list[bpy.types.Object]:
    """The ground between two distances, over the layer's arc, carved and snowed. `skirt`
    (from, to) metres: where this ring overlaps the finer ring in front, it is let down
    under it, so the finer ring's detail is what shows. `curtain_m`: hang a curtain there
    (see `curtain`)."""
    er, ec, eye_h = eye
    rows, cols = dem.shape
    az = np.radians(np.linspace(lon[0] - 6, lon[1] + 6, 96)) + bearing
    pts = np.concatenate([np.stack([np.sin(az) * d, np.cos(az) * d], axis=1) for d in (lo_m, hi_m)] + [np.zeros((1, 2))])
    x0, y0 = pts.min(axis=0)
    x1, y1 = pts.max(axis=0)
    # Keep inside the data.
    x0 = max(x0, (0 - ec) * mpp)
    x1 = min(x1, (cols - 1 - ec) * mpp)
    y0 = max(y0, (er - (rows - 1)) * mpp)
    y1 = min(y1, er * mpp)
    if x1 <= x0 or y1 <= y0:
        return []
    nx = int((x1 - x0) / spacing) + 1
    ny = int((y1 - y0) / spacing) + 1
    gx, gy = np.meshgrid(np.linspace(x0, x1, nx), np.linspace(y0, y1, ny))
    d = np.hypot(gx, gy)
    ang = (np.degrees(np.arctan2(gx, gy) - bearing) + 180) % 360 - 180
    keep = (d >= lo_m) & (d <= hi_m) & (ang >= lon[0] - 6) & (ang <= lon[1] + 6)
    if not keep.any():
        return []
    h0 = dem_heights(dem, er - gy / mpp, ec + gx / mpp)
    h, ribs, stain = carve(h0, gx, gy, spacing)
    potential, tone, dull = surface(h, gx, gy, spacing, ribs, stain)
    drop = d * d / (2 * EARTH_R) * (1 - REFRACTION)
    z = h - drop - eye_h
    if skirt:
        z -= 3.0 * spacing * smoothstep(skirt[1], skirt[0], d)
    # Ground far below the layer's lowest row can never be seen in it.
    keep &= np.degrees(np.arctan2(z, d)) >= floor_deg - 3.0
    idx = np.arange(nx * ny).reshape(ny, nx)
    k4 = keep[:-1, :-1] & keep[1:, :-1] & keep[:-1, 1:] & keep[1:, 1:]
    a = idx[:-1, :-1][k4]
    if len(a) == 0:
        return []
    quads = np.stack([a, a + 1, a + 1 + nx, a + nx], axis=1)
    # Only the vertices the quads use.
    used = np.zeros(nx * ny, dtype=bool)
    used[quads.ravel()] = True
    remap = np.cumsum(used) - 1
    quads = remap[quads]
    verts = np.stack([gx, gy, z], axis=-1).reshape(-1, 3)[used].astype(np.float32)
    me = bpy.data.meshes.new(name)
    me.vertices.add(len(verts))
    me.vertices.foreach_set("co", verts.ravel())
    me.loops.add(len(quads) * 4)
    me.loops.foreach_set("vertex_index", quads.ravel().astype(np.int32))
    me.polygons.add(len(quads))
    me.polygons.foreach_set("loop_start", np.arange(0, len(quads) * 4, 4, dtype=np.int32))
    me.update()
    me.shade_smooth()
    for key, val in (("potential", potential), ("tone", tone), ("dull", dull)):
        attr = me.attributes.new(key, "FLOAT", "POINT")
        attr.data.foreach_set("value", val.ravel()[used].astype(np.float32))
    ob = bpy.data.objects.new(name, me)
    print(f"[k2render] {name}: {lo_m / 1000:.1f}-{hi_m / 1000:.1f} km at {spacing:.1f} m, {len(verts) / 1e6:.2f}M verts", flush=True)
    out = [ob]
    if curtain_m is not None:
        def sample(grid: np.ndarray, px: np.ndarray, py: np.ndarray) -> np.ndarray:
            rc = np.stack([(py - y0) / (y1 - y0) * (ny - 1), (px - x0) / (x1 - x0) * (nx - 1)])
            return ndimage.map_coordinates(grid, rc, order=1, mode="nearest")

        out.append(curtain(f"{name}.curtain", lambda px, py: sample(z, px, py), lambda px, py: sample(tone, px, py), lambda px, py: sample(potential, px, py), bearing, lon, curtain_m, spacing, (x0, x1, y0, y1)))
    return out


def curtain(name: str, ground, tone, potential, bearing: float, lon: tuple[float, float], r: float, spacing: float, box: tuple[float, float, float, float]) -> bpy.types.Object:
    """A wall of rock hanging from just under the ground, at the distance the camera starts
    to see from: the mountain cut through where the layer begins. A line of sight that starts
    inside a hill there meets this face, instead of travelling on underground to light on
    some farther ground in total darkness, or on nothing. It is hidden behind the nearer
    layer while the two line up; when that layer slides away with its parallax, the face is
    what shows under the ridge, never the sky. Only the camera sees it: it casts no shadow."""
    az = np.radians(np.arange(lon[0] - 6, lon[1] + 6, 0.05)) + bearing
    px, py = np.sin(az) * r, np.cos(az) * r
    x0, x1, y0, y1 = box
    inside = (px >= x0) & (px <= x1) & (py >= y0) & (py <= y1)
    px, py = px[inside], py[inside]
    # Its top a little over the ground, as high as the displacement can raise it: a line of
    # sight that passes under the ground's edge at all meets the curtain, never a gap above it.
    top = ground(px, py) + 1.2 * spacing
    n = len(px)
    verts = np.concatenate([np.stack([px, py, top], 1), np.stack([px, py, top - 4000.0], 1)]).astype(np.float32)
    i = np.arange(n - 1)
    # Wound to face the eye (it shares the ground's material, which shows a back face as nothing).
    quads = np.stack([i, n + i, n + i + 1, i + 1], 1)
    me = bpy.data.meshes.new(name)
    me.vertices.add(len(verts))
    me.vertices.foreach_set("co", verts.ravel())
    me.loops.add(len(quads) * 4)
    me.loops.foreach_set("vertex_index", quads.ravel().astype(np.int32))
    me.polygons.add(len(quads))
    me.polygons.foreach_set("loop_start", np.arange(0, len(quads) * 4, 4, dtype=np.int32))
    me.update()
    # Rock with a dusting of snow, leaning to the ground above it but evened out along the
    # face (a colour sampled along its top alone would run down it in stripes); it glows with
    # the light such a face would get (see CURTAIN_GLOW), so it reads as the mountain's face.
    even = lambda v: ndimage.gaussian_filter1d(v, 60.0, mode="nearest")  # noqa: E731 — 3° along the arc
    shade = np.clip(0.45 + 0.4 * (even(tone(px, py)) - 0.45), 0.0, 1.0).astype(np.float32)
    snow = np.clip(0.3 + 0.3 * even(potential(px, py)), 0.3, 0.55).astype(np.float32)
    for key, val in (("potential", np.concatenate([snow, snow])), ("tone", np.concatenate([shade, shade])), ("dull", np.zeros(2 * n, np.float32))):
        attr = me.attributes.new(key, "FLOAT", "POINT")
        attr.data.foreach_set("value", val)
    ob = bpy.data.objects.new(name, me)
    for ray in ("visible_shadow", "visible_diffuse", "visible_glossy", "visible_transmission", "visible_volume_scatter"):
        setattr(ob, ray, False)
    ob.lightgroup = "sky"
    return ob


# ——— Scene ———

# The curtain (see `curtain`) hangs under ground the camera cannot see past, so in the
# render the hill above it would shade it from the sun and the sky alike, and it would come
# out black. It shades itself instead: it glows, in the sky's light group, with about the light
# a face of rock sloping at 55° towards the eye and open to the sky would get, with a share
# taken off for its own nooks. The suns' light it is given afterwards, from the slope above
# it (see `relight_curtain`).
CURTAIN_GLOW = 0.55


def material(spacing: float, curtain: bool = False) -> bpy.types.Material:
    """Snow wherever the terrain's snow potential, roughened by fine noise, passes a half: the
    edge is drawn per pixel, finer than the mesh. Bare rock pale to dark, mottled; a fine
    grain, rougher in the rock; and a pass that says which is rock, so the site can warm it.
    A `curtain` takes the same colours, self-lit (see CURTAIN_GLOW)."""
    mat = bpy.data.materials.new(f"k2-{spacing:.1f}{'-curtain' if curtain else ''}")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    n = nt.nodes.new
    link = nt.links.new
    out = n("ShaderNodeOutputMaterial")
    geo = n("ShaderNodeNewGeometry")
    tex = n("ShaderNodeTexCoord")
    potential = n("ShaderNodeAttribute")
    potential.attribute_name = "potential"
    tone = n("ShaderNodeAttribute")
    tone.attribute_name = "tone"

    def noise(wavelength: float, detail: float = 2.0) -> bpy.types.Node:
        t = n("ShaderNodeTexNoise")
        t.inputs["Scale"].default_value = 1.0 / wavelength
        t.inputs["Detail"].default_value = detail
        t.inputs["Roughness"].default_value = 0.55
        link(tex.outputs["Object"], t.inputs["Vector"])
        return t

    def madd(a: bpy.types.NodeSocket, mul: float, add_socket: bpy.types.NodeSocket | None, add: float = 0.0) -> bpy.types.NodeSocket:
        m = n("ShaderNodeMath")
        m.operation = "MULTIPLY_ADD"
        link(a, m.inputs[0])
        m.inputs[1].default_value = mul
        if add_socket is None:
            m.inputs[2].default_value = add
        else:
            link(add_socket, m.inputs[2])
        return m.outputs[0]

    # The snow's edge, ragged at two scales finer than the mesh.
    rag1 = noise(2.3 * spacing)
    rag2 = noise(0.9 * spacing)
    v = madd(rag1.outputs["Fac"], 0.42, potential.outputs["Fac"])
    v = madd(rag2.outputs["Fac"], 0.24, v)
    snow = n("ShaderNodeMapRange")
    snow.interpolation_type = "SMOOTHSTEP"
    # Centred: each noise is about 0.5 on average, adding 0.33 in all.
    snow.inputs["From Min"].default_value = 0.79
    snow.inputs["From Max"].default_value = 0.87
    link(v, snow.inputs["Value"])
    # Bare rock: pale granite to dark streaks, mottled finer than the mesh.
    mottle = noise(3.5 * spacing, 4.0)
    shade = n("ShaderNodeMapRange")
    shade.inputs["To Min"].default_value = 0.6
    shade.inputs["To Max"].default_value = 1.4
    link(mottle.outputs["Fac"], shade.inputs["Value"])
    rock = n("ShaderNodeMapRange")
    rock.inputs["To Min"].default_value = 0.05
    rock.inputs["To Max"].default_value = 0.26
    link(tone.outputs["Fac"], rock.inputs["Value"])
    rock_mottled = n("ShaderNodeMath")
    rock_mottled.operation = "MULTIPLY"
    link(rock.outputs["Result"], rock_mottled.inputs[0])
    link(shade.outputs["Result"], rock_mottled.inputs[1])
    # Fresh snow, or the duller grey of old glacier ice.
    dull = n("ShaderNodeAttribute")
    dull.attribute_name = "dull"
    white = n("ShaderNodeMix")
    white.data_type = "RGBA"
    white.inputs["A"].default_value = (0.86, 0.88, 0.91, 1)
    white.inputs["B"].default_value = (0.5, 0.53, 0.56, 1)
    link(dull.outputs["Fac"], white.inputs["Factor"])
    col = n("ShaderNodeMix")
    col.data_type = "RGBA"
    link(snow.outputs["Result"], col.inputs["Factor"])
    link(rock_mottled.outputs[0], col.inputs["A"])
    link(white.outputs["Result"], col.inputs["B"])
    # Grain finer than the mesh: a little in the snow, more in the rock.
    grain = noise(1.8 * spacing, 4.0)
    rough = n("ShaderNodeMapRange")
    rough.inputs["To Min"].default_value = 1.0
    rough.inputs["To Max"].default_value = 0.3
    link(snow.outputs["Result"], rough.inputs["Value"])
    bump = n("ShaderNodeBump")
    bump.inputs["Distance"].default_value = 0.35 * spacing
    link(rough.outputs["Result"], bump.inputs["Strength"])
    link(grain.outputs["Fac"], bump.inputs["Height"])
    bsdf = n("ShaderNodeBsdfDiffuse")
    bsdf.inputs["Roughness"].default_value = 0.5
    link(col.outputs["Result"], bsdf.inputs["Color"])
    link(bump.outputs["Normal"], bsdf.inputs["Normal"])
    if curtain:
        # Crags and grain shade it, as relief would.
        crag = noise(12.0 * spacing, 5.0)
        crag.noise_type = "RIDGED_MULTIFRACTAL"
        crag.inputs["Offset"].default_value = 1.0
        crag.inputs["Gain"].default_value = 2.0
        relief = n("ShaderNodeMapRange")
        relief.inputs["From Max"].default_value = 2.2
        relief.inputs["To Min"].default_value = 0.45
        relief.inputs["To Max"].default_value = 1.35
        link(crag.outputs["Fac"], relief.inputs["Value"])
        both = n("ShaderNodeMath")
        both.operation = "MULTIPLY_ADD"
        link(grain.outputs["Fac"], both.inputs[0])
        both.inputs[1].default_value = 0.22
        link(relief.outputs["Result"], both.inputs[2])
        texture = n("ShaderNodeMath")
        texture.operation = "SUBTRACT"
        link(both.outputs[0], texture.inputs[0])
        texture.inputs[1].default_value = 0.11
        tinted = n("ShaderNodeMix")
        tinted.data_type = "RGBA"
        tinted.blend_type = "MULTIPLY"
        tinted.inputs["Factor"].default_value = 1.0
        link(col.outputs["Result"], tinted.inputs["A"])
        link(texture.outputs[0], tinted.inputs["B"])
        bsdf = n("ShaderNodeEmission")
        link(tinted.outputs["Result"], bsdf.inputs["Color"])
        bsdf.inputs["Strength"].default_value = CURTAIN_GLOW
    elif DISPLACE:
        # Real relief finer than the mesh (it is diced to a pixel or so): sharp-crested crags
        # and knobbly noise; in the snow, only a soft swell.
        crags = noise(9.0 * spacing, 6.0)
        crags.noise_type = "RIDGED_MULTIFRACTAL"
        crags.inputs["Roughness"].default_value = 0.62
        crags.inputs["Offset"].default_value = 1.0
        crags.inputs["Gain"].default_value = 2.0
        sharp = n("ShaderNodeMapRange")
        sharp.inputs["From Max"].default_value = 2.2
        link(crags.outputs["Fac"], sharp.inputs["Value"])
        knobs = noise(2.6 * spacing, 5.0)
        relief = n("ShaderNodeMath")
        relief.operation = "MULTIPLY_ADD"
        relief.inputs[1].default_value = 0.45
        link(knobs.outputs["Fac"], relief.inputs[0])
        link(sharp.outputs["Result"], relief.inputs[2])
        amount = n("ShaderNodeMapRange")
        amount.inputs["To Min"].default_value = 1.0
        amount.inputs["To Max"].default_value = 0.2
        link(snow.outputs["Result"], amount.inputs["Value"])
        disp = n("ShaderNodeDisplacement")
        disp.space = "OBJECT"
        disp.inputs["Midlevel"].default_value = 0.6
        disp.inputs["Scale"].default_value = 0.7 * spacing
        link(relief.outputs[0], disp.inputs["Height"])
        scaled = n("ShaderNodeVectorMath")
        scaled.operation = "SCALE"
        link(disp.outputs["Displacement"], scaled.inputs[0])
        link(amount.outputs["Result"], scaled.inputs["Scale"])
        link(scaled.outputs["Vector"], out.inputs["Displacement"])
        mat.displacement_method = "BOTH"
        mat.max_vertex_displacement = 1.2 * spacing
    # A line of sight that starts past nearer ground is already under it: the underside
    # it meets is nothing this layer should show.
    under = n("ShaderNodeHoldout")
    side = n("ShaderNodeMixShader")
    link(geo.outputs["Backfacing"], side.inputs["Fac"])
    link(bsdf.outputs[0], side.inputs[1])
    link(under.outputs[0], side.inputs[2])
    link(side.outputs[0], out.inputs["Surface"])
    bare = n("ShaderNodeMath")
    bare.operation = "SUBTRACT"
    bare.inputs[0].default_value = 1.0
    link(snow.outputs["Result"], bare.inputs[1])
    aov = n("ShaderNodeOutputAOV")
    aov.aov_name = "rock"
    link(bare.outputs[0], aov.inputs["Value"])
    return mat


def sun(name: str, side: float) -> bpy.types.Object:
    """A low sun off to one side, a little beyond the mountains, as the site's sun is: in the
    sky in front of the eye, moving left to right through the day."""
    lamp = bpy.data.lights.new(name, "SUN")
    lamp.energy = 3.2
    lamp.angle = math.radians(4)
    ob = bpy.data.objects.new(name, lamp)
    return ob


def aim_sun(ob: bpy.types.Object, side: float, bearing: float) -> None:
    # Towards the light, in world axes: off to the side, a little beyond the mountains, and up.
    right = np.array([math.cos(bearing), -math.sin(bearing), 0.0])
    forward = np.array([math.sin(bearing), math.cos(bearing), 0.0])
    to_light = side * 0.82 * right + 0.25 * forward + np.array([0, 0, 0.5])
    to_light /= np.linalg.norm(to_light)
    from mathutils import Vector

    ob.rotation_euler = Vector(-to_light).to_track_quat("-Z", "Y").to_euler()


def setup(bearing: float) -> tuple[bpy.types.Object, dict[str, bpy.types.Object]]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = SAMPLES
    scene.cycles.use_adaptive_sampling = True
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 4
    scene.cycles.diffuse_bounces = 3
    scene.render.use_persistent_data = False
    scene.render.film_transparent = True
    scene.view_settings.view_transform = "Standard"
    layer = scene.view_layers[0]
    layer.use_pass_z = True
    layer.cycles.denoising_store_passes = True
    aov = layer.aovs.add()
    aov.name = "rock"
    aov.type = "VALUE"
    for g in LIGHTS:
        layer.lightgroups.add(name=g)
    world = bpy.data.worlds.new("sky")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (1, 1, 1, 1)
    world.lightgroup = "sky"
    scene.world = world
    # Each light, denoised on its own with the render's albedo and normals, written out with
    # the coverage, the distance and the rock.
    ng = bpy.data.node_groups.new("out", "CompositorNodeTree")
    scene.compositing_node_group = ng
    scene.render.use_compositing = True
    rl = ng.nodes.new("CompositorNodeRLayers")
    fo = ng.nodes.new("CompositorNodeOutputFile")
    fo.name = "band"
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
    for key, sock in (("alpha", "Alpha"), ("depth", "Depth"), ("rock", "rock")):
        fo.file_output_items.new("FLOAT", key)
        ng.links.new(rl.outputs[sock], fo.inputs[key])
    cam = bpy.data.cameras.new("eye")
    cam.type = "PANO"
    cam.panorama_type = "EQUIRECTANGULAR"
    co = bpy.data.objects.new("eye", cam)
    co.rotation_euler = (math.radians(90), 0, -bearing)
    scene.collection.objects.link(co)
    scene.camera = co
    suns = {}
    for name, side in (("left", -1.0), ("right", 1.0)):
        ob = sun(name, side)
        aim_sun(ob, side, bearing)
        ob.lightgroup = name
        scene.collection.objects.link(ob)
        suns[name] = ob
    return co, suns


def read_exr(path: str) -> dict[str, np.ndarray]:
    """Every channel of a multilayer EXR, by name (e.g. "ViewLayer.Combined.R"), rows top-down."""
    import OpenEXR

    out: dict[str, np.ndarray] = {}
    with OpenEXR.File(path) as f:
        for part in f.parts:
            for name, ch in part.channels.items():
                px = np.array(ch.pixels, dtype=np.float32)
                if px.ndim == 3:  # grouped R, G, B(, A)
                    for k in range(px.shape[2]):
                        out[f"{name}.{'RGBA'[k]}"] = px[..., k]
                else:
                    out[name] = px
    return out


def passes(i: int, band: dict) -> dict[str, np.ndarray]:
    """One layer's three lights (luminance), coverage, distance through the layer (0–1) and
    rock, from its rendered EXR, with its curtain relit (see `relight_curtain`)."""
    chans = read_exr(os.path.join(WORK, f"band{i}.exr"))
    got: dict[str, np.ndarray] = {}
    for which in LIGHTS:
        rgb = np.stack([pick(chans, f"{which}.R"), pick(chans, f"{which}.G"), pick(chans, f"{which}.B")], axis=-1)
        got[which] = rgb @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    got["alpha"] = pick(chans, "alpha.V", "alpha")
    depth = pick(chans, "depth.V", "depth")
    near, far = band["near_km"] * 1000, band["far_km"] * 1000
    got["dist"] = np.clip((depth - near) / (far - near), 0, 1)
    got["rock"] = np.clip(pick(chans, "rock.V", "rock"), 0, 1)
    relight_curtain(got, depth, band)
    return got


# How far up the slope above it the curtain takes its light from (pixels), and over how
# many pixels along the arc that is evened out (about 1.5°, so one sunlit knob or shaded
# gully above it does not run down it as a stripe).
CURTAIN_LOOK = 40
CURTAIN_EVEN = 30
# The curtain a touch darker than the slope it continues (it is the face under the ridge),
# and darker still the farther down it, by up to CURTAIN_FALL over CURTAIN_FALL_DEG.
CURTAIN_SHADE = 0.85
CURTAIN_FALL = 0.3
CURTAIN_FALL_DEG = 6.0
# Its top stands a little over the ground (see `curtain`); where the ground before it shows
# again below that, the top is a strip this many pixels thin or less, drawn as the ground.
CURTAIN_LIP = 3


def relight_curtain(got: dict[str, np.ndarray], depth: np.ndarray, band: dict) -> None:
    """The curtain glows in the sky's light alone (see CURTAIN_GLOW), so the site would light
    it by the open sky and never by the sun or the moon: at night, when the moon lights every
    slope above it, it would be a black hole under the ridge. Here it takes the suns' light
    too, in the share the slope just above it does in each, against the sky's; so at every
    hour it answers as the mountain it continues. Its snow line, which flickers about its
    threshold from pixel to pixel, is evened out to a fraction (in its light and its rock),
    and its top, where it shows as a thin line between two slopes, is drawn as the ground."""
    h, w = depth.shape
    lat = np.radians(np.linspace(band["top_deg"], band["bottom_deg"], h))
    # Along the ground: the curtain hangs at one distance from the eye (see `curtain`).
    flat = depth * np.cos(lat)[:, None]
    near = band["near_km"] * 1000
    covered = got["alpha"] > 0.5
    hist, edges = np.histogram(flat[covered], bins=1000, range=(near * 0.95, near * 1.2))
    k = int(np.argmax(hist))
    if hist[k] < 0.01 * covered.sum():
        return  # this layer hangs none
    peak = covered & (flat >= edges[k]) & (flat <= edges[k + 1])
    r = float(np.median(flat[peak]))
    # It stands within a few centimetres of that; ground within a metre is a line at most.
    there = covered & (np.abs(flat - r) < 1.0)
    ground = covered & ~there & (got["alpha"] > 0.99)
    # Its top, where it stands over the ground with more ground showing just below: filled
    # from the ground on either side, row by row.
    up = np.zeros((h, w), np.int32)
    down = np.zeros((h, w), np.int32)
    for k in range(CURTAIN_LIP, 0, -1):
        above = np.zeros_like(ground)
        above[k:] = ground[:-k]
        below = np.zeros_like(ground)
        below[:-k] = ground[k:]
        up = np.where(above, k, up)
        down = np.where(below, k, down)
    lip = there & (up > 0) & (down > 0)
    ys, xs = np.nonzero(lip)
    a, b = ys - up[lip], ys + down[lip]
    t = (up[lip] / (up[lip] + down[lip])).astype(np.float32)
    for key in (*LIGHTS, "rock", "dist"):
        v = got[key]
        v[ys, xs] = v[a, xs] * (1 - t) + v[b, xs] * t
    there &= ~lip
    sun = got["left"] + got["right"]
    sky = got["sky"]
    # The curtain is never lit by the suns; rock that happens to stand at its distance is,
    # and so are its pixels along the slope's edge, where the denoiser lends it a little.
    curtain = there & (sun < 0.05 * sky + 1e-3)
    if not curtain.any():
        return
    # Each column's share of each sun against the sky, on the slope just above the curtain.
    top = np.where(curtain.any(axis=0), curtain.argmax(axis=0), -1)
    rows = np.arange(h)[:, None]
    slope = ground & (rows < top[None, :]) & (rows >= top[None, :] - CURTAIN_LOOK)
    under = (sky * slope).sum(axis=0)
    seen = (slope.sum(axis=0) >= 5) & (under > 1e-3)
    if not seen.any():
        return
    cols = np.arange(w)
    share = {}
    for which in ("left", "right"):
        raw = np.where(seen, (got[which] * slope).sum(axis=0) / np.maximum(under, 1e-6), 0.0)
        filled = np.interp(cols, cols[seen], raw[seen])
        share[which] = np.clip(ndimage.gaussian_filter1d(filled, CURTAIN_EVEN, mode="nearest"), 0.0, 2.0)

    def even(v: np.ndarray, sigma: float) -> np.ndarray:
        # Blurred within the curtain only, so the slope above never bleeds into it.
        m = curtain.astype(np.float32)
        return ndimage.gaussian_filter(v * m, sigma) / np.maximum(ndimage.gaussian_filter(m, sigma), 1e-6)

    below = np.clip((rows - top[None, :]) / (CURTAIN_FALL_DEG * band["pxPerDeg"]), 0.0, 1.0)
    glow = even(sky, 3.0) * (1.0 - CURTAIN_FALL * below * below * (3 - 2 * below))
    got["sky"] = np.where(curtain, glow, sky)
    for which in ("left", "right"):
        lit = share[which][None, :] * CURTAIN_SHADE
        # Along its edge, never darker in the sun than the curtain under it.
        got[which] = np.where(curtain, glow * lit, np.where(there, np.maximum(got[which], sky * lit), got[which]))
    got["rock"] = np.where(curtain, np.clip(even(got["rock"], 2.5), 0, 1), got["rock"])
    print(f"[k2render] curtain at {r:.0f} m: {curtain.sum()} px, its top drawn as ground for {lip.sum()} px; sun share left {np.median(share['left']):.2f} right {np.median(share['right']):.2f}", flush=True)


# Rows of nothing between the three images stacked in a texture, so filtering one never
# reaches into the next.
PAD = 8


def export(bands: list[dict], images: dict[int, dict[str, np.ndarray]]) -> None:
    """The site's textures: per layer, its light (the left, right and sky renders) and its
    mask (coverage, distance through the layer, rock), each three images stacked top to
    bottom in one greyscale picture (lossy WebP keeps colour at half size, which would smear
    the differences between three channels; brightness it keeps whole), and the data that
    places them."""
    # Every layer's light shares one scale, kept as its square root (more steps in the shade).
    scale = float(np.percentile(np.concatenate([images[i][k][images[i]["alpha"] > 0.5].ravel() for i in images for k in LIGHTS]), 99.8))
    os.makedirs(TEXTURES, exist_ok=True)
    for i, got in images.items():
        h, w = got["alpha"].shape
        bands[i]["size"] = [w, h]
        gap = np.zeros((PAD, w), dtype=np.float32)

        def stack(planes: list[np.ndarray]) -> np.ndarray:
            return np.concatenate([planes[0], gap, planes[1], gap, planes[2]], axis=0)

        light = stack([np.sqrt(np.clip(got[k] / scale, 0, 1)) for k in LIGHTS])
        mask = stack([got["alpha"], got["dist"], got["rock"]])
        for key, img, quality in (("light", light, "92"), ("mask", mask, "95")):
            ppm = os.path.join(WORK, f"k2-{i}-{key}.pgm")
            with open(ppm, "wb") as fh:
                fh.write(f"P5 {w} {img.shape[0]} 255\n".encode())
                fh.write((np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8).tobytes())
            # Full size, and half for phones.
            for suffix, resize in (("", []), ("-half", ["-resize", "50%"])):
                webp = os.path.join(TEXTURES, f"k2-{i}-{key}{suffix}.webp")
                subprocess.run(["convert", ppm, *resize, "-quality", quality, "-define", "webp:method=6", webp], check=True)
                print(f"[k2render] band {i} {key}{suffix}: {os.path.getsize(webp) / 1024:.0f} KB", flush=True)
    meta = {"pxPerDeg": PX_PER_DEG, "lightScale": round(scale, 5), "pad": PAD, "bands": [bands[i] for i in sorted(images)]}
    with open(DATA, "w") as fh:
        json.dump(meta, fh, indent=1)
        fh.write("\n")
    print("[k2render] exported", flush=True)


def pick(chans: dict[str, np.ndarray], *ends: str) -> np.ndarray:
    for name, px in chans.items():
        if any(name.endswith(e) for e in ends):
            return px
    raise KeyError(f"{ends} not in {list(chans)}")


def main() -> None:
    dem, mpp, (sr, sc) = mosaic("k2", 12, RADIUS)
    rows, cols = dem.shape
    # The same eye as k2_panorama.py: on the glacier 11 km south, a little above the ice.
    er = float(min(rows - 2, sr + round(EYE_DISTANCE_KM * 1000 / mpp)))
    lo, hi = max(0, sc - 200), min(cols, sc + 200)
    ec = float(lo + int(np.argmin(dem[int(er), lo:hi])))
    eye_h = float(bilinear(dem, np.array([er]), np.array([ec]))[0]) + EYE_ABOVE_GROUND_M
    bearing = math.atan2(sc - ec, -(sr - er))
    eye = (er, ec, eye_h)

    def skyline(lon: tuple[float, float], near: float, far: float) -> np.ndarray:
        """The highest angle of the data's ground in [near, far] km, along the arc."""
        az = np.radians(np.linspace(lon[0], lon[1], 600)) + bearing
        dists = np.arange(near * 1000, far * 1000, max(4.0, near * 4))
        rr = er - np.cos(az)[:, None] * dists[None, :] / mpp
        cc = ec + np.sin(az)[:, None] * dists[None, :] / mpp
        inside = (rr >= 0) & (rr <= rows - 1) & (cc >= 0) & (cc <= cols - 1)
        hh = bilinear(dem, np.clip(rr, 0, rows - 1), np.clip(cc, 0, cols - 1))
        drop = dists**2 / (2 * EARTH_R) * (1 - REFRACTION)
        angle = np.where(inside, np.degrees(np.arctan2(hh - drop[None, :] - eye_h, dists[None, :])), -90.0)
        return angle.max(axis=1)

    os.makedirs(WORK, exist_ok=True)
    if EXPORT:
        found = {}
        for i, (near, far) in enumerate(reversed(BANDS_KM)):
            with open(os.path.join(WORK, f"band{i}.json")) as fh:
                found[i] = json.load(fh)
        export([found[i] for i in sorted(found)], {i: passes(i, b) for i, b in found.items()})
        return
    co, _ = setup(bearing)
    scene = bpy.context.scene
    only = ONLY.split(",") if ONLY else (["0"] if TEST else [])
    bands = []
    images: dict[int, dict[str, np.ndarray]] = {}
    for i, (near, far) in enumerate(reversed(BANDS_KM)):  # far first, as the site paints them
        lon = TEST_LON if TEST else BAND_LON[i]
        sky = skyline(lon, near, far)
        valid = sky > -89
        top = float(sky[valid].max()) + 0.6
        bottom = float(np.percentile(sky[valid], 2)) - BELOW_DEG
        px = PX_PER_DEG if TEST else BAND_PX[i]
        width = int(round((lon[1] - lon[0]) * px))
        n_rows = int(math.ceil((top - bottom) * px))
        bands.append({"near_km": near, "far_km": far, "lon": list(lon), "top_deg": round(top, 3), "bottom_deg": round(bottom, 3), "pxPerDeg": px, "size": [width, n_rows]})
        with open(os.path.join(WORK, f"band{i}.json"), "w") as fh:
            json.dump(bands[-1], fh)
        if only and str(i) not in only:
            continue
        spans = rings(near * 1000, far * 1000)
        obs = []
        for j, (r0, r1, spacing) in enumerate(spans):
            # Each ring overlaps its neighbours a little, so no seam can open between them.
            lo_m = r0 * (0.85 if j == 0 else 0.98)
            hi_m = r1 * (1.08 if j == len(spans) - 1 else 1.02)
            skirt = None if j == 0 else (r0 * 0.98, r0 * 1.02)
            # The first ring with any ground hangs the curtain (see `curtain`).
            hang = max(near * 1000 * 1.002, lo_m * 1.001) if not obs else None
            made = ring_mesh(f"band{i}.{j}", dem, mpp, eye, bearing, lon, lo_m, hi_m, spacing, bottom, skirt, hang)
            if not made:
                continue
            ob = made[0]
            mat = material(spacing)
            ob.data.materials.append(mat)
            for o in made[1:]:
                o.data.materials.append(material(spacing, curtain=True))
            if DISPLACE:
                sub = ob.modifiers.new("dice", "SUBSURF")
                sub.subdivision_type = "SIMPLE"
                sub.use_adaptive_subdivision = True
                sub.adaptive_space = "OBJECT"
                sub.adaptive_object_edge_length = DICE_EDGE * spacing
            for o in made:
                scene.collection.objects.link(o)
                obs.append(o)
        cam = co.data
        cam.longitude_min = math.radians(lon[0])
        cam.longitude_max = math.radians(lon[1])
        cam.latitude_min = math.radians(bottom)
        cam.latitude_max = math.radians(top)
        cam.clip_start = near * 1000
        cam.clip_end = far * 1000 * 1.05
        scene.render.resolution_x = width
        scene.render.resolution_y = n_rows
        scene.compositing_node_group.nodes["band"].file_name = f"band{i}"
        bpy.ops.render.render(write_still=False)
        print(f"[k2render] band {i} ({near}-{far} km) done", flush=True)
        images[i] = passes(i, bands[-1])
        for ob in obs:
            me = ob.data
            bpy.data.objects.remove(ob)
            bpy.data.meshes.remove(me)

    if TEST:
        # A quick look: the three lights mixed for a morning sun from the left, over a pale sky.
        for i, got in images.items():
            mix = got["left"] * 0.85 + got["right"] * 0.08 + got["sky"] * 0.42
            a = got["alpha"][..., None]
            warm = 1 - 0.25 * got["rock"][..., None] * np.array([0.0, 0.08, 0.2])
            img = mix[..., None] * np.array([1.0, 0.97, 0.93]) * warm
            img = img * a + np.array([0.62, 0.7, 0.82]) ** 2.2 * (1 - a)
            img = np.clip(img, 0, 1) ** (1 / 2.2)
            out = os.path.join(WORK, f"test{i}.ppm")
            h, w = mix.shape
            with open(out, "wb") as fh:
                fh.write(f"P6 {w} {h} 255\n".encode())
                fh.write((img * 255 + 0.5).astype(np.uint8).tobytes())
            print(f"[k2render] test -> {out}", flush=True)
        return

    # One layer at a time (--only) leaves its EXRs for a later --export of them all.
    if not ONLY:
        export(bands, images)


if __name__ == "__main__":
    main()
