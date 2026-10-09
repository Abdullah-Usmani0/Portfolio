"""
The valley's buildings, rendered: the village of AI coworkers, the council town, the farm and
its fields, the proving grounds and the stage on the lake.

Each is modelled from the numbers the site draws it with (src/world/scenery/structures.ts,
written to blender/out/structures.json by `npm run scenery`), so its windows, doors and
chimneys stand exactly where the scene's own animation expects them. It is seen from the
front in a light oblique view: everything a unit further back is drawn KX units to the right
and KZ up (the model is sheared, then seen straight on by an orthographic camera), so its
front stays exactly where the painted one stood while its side and roof show. Like the
valley's other layers, it is lit three ways at once by light groups (a low sun from the left,
one from the right, the open sky), and a fourth group holds the glow of its windows; the
site mixes them for the hour. A second render sees only the ground around it, so the shadows
it casts there can be laid over the site's ground as darkening.

  python blender/structures_render.py                       # every structure, then the textures
  python blender/structures_render.py --only=village-04 --test   # one, with a quick look
  python blender/structures_render.py --export              # the textures from the last renders

Run it with the Blender-as-a-module Python (see blender/requirements.txt).
"""
from __future__ import annotations

import json
import math
import os
import sys
import time

import bpy
import bmesh
import numpy as np
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from scipy import ndimage  # noqa: E402

import structures_councils  # noqa: E402
import structures_farm  # noqa: E402
import structures_lake  # noqa: E402
import structures_proving  # noqa: E402
import structures_village  # noqa: E402
from structures_kit import KX, KZ, Kit, _object, shear  # noqa: E402

ROOT = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(ROOT)
SOURCE = os.path.join(ROOT, "out", "structures.json")
WORK = os.path.join(ROOT, "out", "structures")
TEXTURES = os.path.join(REPO, "src", "world", "textures", "structures")
DATA = os.path.join(REPO, "src", "world", "data", "structuresRender.json")


def arg(name: str, default: str = "") -> str:
    return next((a.split("=", 1)[1] for a in sys.argv if a.startswith(f"--{name}=")), default)


TEST = "--test" in sys.argv
EXPORT = "--export" in sys.argv
ONLY = [s for s in arg("only").split(",") if s]
SAMPLES = int(arg("samples", "24" if TEST else "96"))

# Rendered texels per world unit: a dive flies in close, and the buildings are small.
PX = 3.0
# The shadows a structure casts on the ground are soft, and long when the sun is low: they
# get their own wider, coarser render.
SHADOW_PX = 1.0
# Rows between the images stacked in a texture (at full size), filled with their edges.
PAD = 8
SHADOW_PAD = 4
LIGHTS = ("left", "right", "sky")
GROUPS = LIGHTS + ("windows",)
SUN_ENERGY = 3.2
# Kept for the site: full size, and half for phones.
STORE = {"": 1.0, "-half": 0.5}


# ——— Builders, by kind, from every scene's module ———

_SCENES = (structures_village, structures_councils, structures_farm, structures_proving, structures_lake)
BUILDERS = {kind: build for m in _SCENES for kind, build in m.BUILDERS.items()}
assert len(BUILDERS) == sum(len(m.BUILDERS) for m in _SCENES), "two scenes build the same kind"


# ——— Rendering ———

def setup() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = SAMPLES
    sc.cycles.use_adaptive_sampling = True
    sc.cycles.use_denoising = True
    sc.cycles.max_bounces = 6
    sc.cycles.diffuse_bounces = 3
    sc.cycles.glossy_bounces = 2
    sc.render.film_transparent = True
    sc.render.filter_size = 1.2
    sc.view_settings.view_transform = "Standard"
    vl = sc.view_layers[0]
    vl.cycles.denoising_store_passes = True
    for g in GROUPS:
        vl.lightgroups.add(name=g)
    world = bpy.data.worlds.new("sky")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (1, 1, 1, 1)
    world.lightgroup = "sky"
    sc.world = world
    for name, side in (("left", -1.0), ("right", 1.0)):
        lamp = bpy.data.lights.new(name, "SUN")
        lamp.energy = SUN_ENERGY
        lamp.angle = math.radians(3)
        ob = bpy.data.objects.new(name, lamp)
        ob.lightgroup = name
        # Low, off to the side, and a little in front: a facade facing the eye catches it.
        to = Vector((side * 0.72, -0.42, 0.55)).normalized()
        ob.rotation_euler = (-to).to_track_quat("-Z", "Y").to_euler()
        sc.collection.objects.link(ob)
    cam = bpy.data.cameras.new("eye")
    cam.type = "ORTHO"
    cam.clip_start = 1.0
    cam.clip_end = 100000.0
    co = bpy.data.objects.new("eye", cam)
    co.rotation_euler = (math.pi / 2, 0.0, 0.0)
    sc.collection.objects.link(co)
    sc.camera = co
    ng = bpy.data.node_groups.new("out", "CompositorNodeTree")
    sc.compositing_node_group = ng
    sc.render.use_compositing = True
    rl = ng.nodes.new("CompositorNodeRLayers")
    fo = ng.nodes.new("CompositorNodeOutputFile")
    fo.name = "out"
    fo.directory = WORK
    fo.format.media_type = "MULTI_LAYER_IMAGE"
    fo.format.file_format = "OPEN_EXR_MULTILAYER"
    fo.format.color_depth = "32"
    fo.file_output_items.clear()
    for g in GROUPS:
        dn = ng.nodes.new("CompositorNodeDenoise")
        ng.links.new(rl.outputs[f"Combined_{g}"], dn.inputs["Image"])
        ng.links.new(rl.outputs["Denoising Normal"], dn.inputs["Normal"])
        ng.links.new(rl.outputs["Denoising Albedo"], dn.inputs["Albedo"])
        fo.file_output_items.new("RGBA", g)
        ng.links.new(dn.outputs["Image"], fo.inputs[g])
    fo.file_output_items.new("FLOAT", "alpha")
    ng.links.new(rl.outputs["Alpha"], fo.inputs["alpha"])


def _extent(obs: list[bpy.types.Object]) -> tuple[float, float, float, float]:
    """The sheared structure's outline on screen (x0, x1, top) and how deep it reaches."""
    xs, zs, ys = [], [], []
    for ob in obs:
        if ob.type != "MESH":
            continue
        for v in ob.data.vertices:
            xs.append(v.co.x)
            zs.append(v.co.z)
            ys.append(v.co.y)
    return min(xs), max(xs), max(zs), max(ys)


def _snap(f: dict, px: float) -> dict:
    return {"x0": math.floor(f["x0"] * px) / px, "x1": math.ceil(f["x1"] * px) / px, "y0": math.floor(f["y0"] * px) / px, "y1": math.ceil(f["y1"] * px) / px}


def frame(obs: list[bpy.types.Object], base: float) -> dict:
    """The region the structure itself is rendered in, in screen units: its sheared outline
    and a little room, snapped to whole texels."""
    x0, x1, z1, _ = _extent(obs)
    return _snap({"x0": x0 - 2.0, "x1": x1 + 2.0, "y0": base - 4.0, "y1": z1 + 3.0}, PX)


# Where the low suns throw a shadow, per unit of height: a sun on the left throws it this far
# right (on screen) and this far back; the one on the right this far left.
SHADOW_RIGHT = (0.72 + KX * 0.42) / 0.55
SHADOW_LEFT = (0.72 - KX * 0.42) / 0.55
SHADOW_BACK = 0.42 / 0.55


def shadow_frame(obs: list[bpy.types.Object], base: float, slope: bool = False) -> dict:
    """The ground the structure can shade: as far as its longest shadows reach either side,
    and as far back as they fall (and on a hillside, down it too), snapped to whole shadow
    texels."""
    x0, x1, z1, deep = _extent(obs)
    tall = max(1.0, z1 - base)
    y0 = base - (0.6 * tall if slope else 8.0)
    return _snap({"x0": x0 - SHADOW_LEFT * tall - 12.0, "x1": x1 + SHADOW_RIGHT * tall + 12.0, "y0": y0, "y1": base + KZ * (deep + SHADOW_BACK * tall) + 10.0}, SHADOW_PX)


def aim(f: dict, px: float) -> None:
    sc = bpy.context.scene
    w = round((f["x1"] - f["x0"]) * px)
    h = round((f["y1"] - f["y0"]) * px)
    sc.render.resolution_x = w
    sc.render.resolution_y = h
    sc.render.resolution_percentage = 100
    co = sc.camera
    co.location = ((f["x0"] + f["x1"]) / 2, -5000.0, (f["y0"] + f["y1"]) / 2)
    co.data.ortho_scale = max(f["x1"] - f["x0"], f["y1"] - f["y0"])


def ground_plane(f: dict, base: float, kit: Kit) -> bpy.types.Object:
    """Flat ground at the structure's foot, from a little in front of it to past where its
    shadows can reach, under the whole of the shadow frame once sheared."""
    back = max(400.0, (f["y1"] - base) / KZ + 60.0)
    margin = KX * back + 60.0
    bm = bmesh.new()
    vs = [bm.verts.new(c) for c in ((f["x0"] - margin, -10.0, base), (f["x1"] + 60.0, -10.0, base), (f["x1"] + 60.0, back, base), (f["x0"] - margin, back, base))]
    bm.faces.new(vs)
    return _object("ground", bm, kit.ground)


def render_structure(kit: Kit, s: dict) -> dict:
    """Render one structure: itself (A), then the ground around it with only its shadows (B).
    A builder returns its parts and where they stand, and may add options: its own `frame`
    (screen units), its own texel density `px`, and `shadow: False` for none."""
    t0 = time.time()
    built = BUILDERS[s["kind"]](kit, s)
    obs, base = built[0], built[1]
    opts = built[2] if len(built) > 2 else {}
    for ob in obs:
        ob["base"] = base
    shear(obs)
    px = opts.get("px", PX)
    f = _snap(opts["frame"], px) if "frame" in opts else frame(obs, base)
    if px != PX:
        f = _snap(f, px)
    cast = opts.get("shadow", True)
    own = opts.get("ground")
    sf = shadow_frame(obs, base, slope=own is not None) if cast else None
    grounds = (own() if own else [ground_plane(sf, base, kit)]) if cast else []
    shear(grounds)
    sc = bpy.context.scene
    for ob in obs + grounds:
        sc.collection.objects.link(ob)
    fo = sc.compositing_node_group.nodes["out"]
    # The structure, the ground unseen (it still lights and shades it).
    aim(f, px)
    for g in grounds:
        g.visible_camera = False
    fo.file_name = f"{s['id']}-A"
    bpy.ops.render.render(write_still=False)
    size = f"{sc.render.resolution_x}×{sc.render.resolution_y}"
    if grounds:
        # The ground, the structure unseen: only the shadows it casts there.
        aim(sf, SHADOW_PX)
        for g in grounds:
            g.visible_camera = True
        for ob in obs:
            ob.visible_camera = False
        sc.cycles.samples = max(16, SAMPLES // 3)
        fo.file_name = f"{s['id']}-B"
        bpy.ops.render.render(write_still=False)
        if own:
            # Uneven ground shades itself: the same ground with no structure at all, to divide by.
            for ob in obs:
                ob.hide_render = True
            fo.file_name = f"{s['id']}-C"
            bpy.ops.render.render(write_still=False)
        sc.cycles.samples = SAMPLES
    for ob in obs + grounds:
        me = ob.data
        bpy.data.objects.remove(ob)
        if me is not None and me.users == 0:
            bpy.data.meshes.remove(me)
    print(f"[st] {s['id']} ({s['kind']}): {len(obs)} parts, {size} in {time.time() - t0:.0f}s", flush=True)
    return {"id": s["id"], **f, "px": px, "shadow": sf, "divide": bool(own), "even": bool(opts.get("even"))}


# ——— Reading the renders back, and the site's textures ———

def read(path: str) -> dict[str, np.ndarray]:
    import OpenEXR

    out: dict[str, np.ndarray] = {}
    with OpenEXR.File(path) as fh:
        for part in fh.parts:
            ch = next(iter(part.channels.values()))
            out[part.name()] = np.array(ch.pixels, dtype=np.float32)
    return out


def shadows(b: dict[str, np.ndarray], c: dict[str, np.ndarray] | None = None) -> list[np.ndarray]:
    """How much of each light the ground still gets (1 in the open), from the ground-only
    render: against open ground at the frame's sides, or (on uneven ground) against the same
    ground rendered without the structure. Faded to 1 at the frame's edges, so a shadow never
    ends in a hard line."""
    h, w = b["alpha"].shape
    edge = np.zeros((h, w), bool)
    k = max(2, w // 16)
    edge[:, :k] = edge[:, -k:] = True
    seen = b["alpha"] > 0.5
    x = np.arange(w, dtype=np.float32)
    fade = np.clip(np.minimum(x, w - 1 - x) / max(1.0, 0.06 * w), 0, 1)
    fade = fade * fade * (3 - 2 * fade)
    if c is not None:
        y = np.arange(h, dtype=np.float32)
        down = np.clip((h - 1 - y) / max(1.0, 0.1 * h), 0, 1)
        fade = fade[None, :] * (down * down * (3 - 2 * down))[:, None]
    else:
        fade = fade[None, :]
    out = []
    for g in LIGHTS:
        v = b[g][..., :3].mean(-1)
        if c is not None:
            alone = c[g][..., :3].mean(-1)
            r = np.where(seen & (alone > 1e-5), v / np.maximum(alone, 1e-5), 1.0)
        else:
            ref = np.median(v[edge & seen]) if (edge & seen).any() else max(1e-6, float(v.max()))
            r = np.where(seen, v / max(ref, 1e-6), 1.0)
        r = np.clip(ndimage.gaussian_filter(r, 0.7), 0, 1)
        out.append(1 - (1 - r) * fade)
    return out


def _resize(im: np.ndarray, factor: float) -> np.ndarray:
    """8-bit image scaled by `factor`, each channel on its own (the colour is premultiplied
    by the alpha already, and must not be multiplied again)."""
    from PIL import Image

    if factor == 1.0:
        return im
    h, w = im.shape[:2]
    size = (max(1, round(w * factor)), max(1, round(h * factor)))
    chans = [im] if im.ndim == 2 else [im[..., c] for c in range(im.shape[2])]
    out = [np.asarray(Image.fromarray(c).resize(size, Image.LANCZOS)) for c in chans]
    return out[0] if im.ndim == 2 else np.stack(out, -1)


def stacked(slots: list[np.ndarray], factor: float, pad: int) -> np.ndarray:
    """Images the same size, scaled by `factor`, stacked top to bottom `pad` rows apart; each
    gap is filled half with the last row above it and half with the first row below, so a
    filtered (or mipmapped) read at an image's edge finds that edge, not a dark seam."""
    imgs = [_resize((np.clip(im, 0, 1) * 255 + 0.5).astype(np.uint8), factor) for im in slots]
    gap = round(pad * factor)
    out = []
    for k, im in enumerate(imgs):
        if k:
            out += [np.repeat(imgs[k - 1][-1:], gap // 2, 0), np.repeat(im[:1], gap - gap // 2, 0)]
        out.append(im)
    return np.concatenate(out, 0)


def save_webp(img: np.ndarray, path: str, quality: int) -> None:
    from PIL import Image

    Image.fromarray(img).save(path, "WEBP", quality=quality, method=6, exact=True)


def export(items: list[dict]) -> None:
    """Every rendered structure's textures, and the index the site reads. Per structure: a
    light texture (left, right, sky and windows, stacked, as square roots of linear light
    over one scale for every structure, premultiplied by the structure's coverage, which is
    its alpha) at full size and half; and a shadow texture (how much of the left sun, the
    right sun and the sky the ground around it still gets, stacked) over the wider ground
    its shadows can reach. Re-exports them all, so the shared scale stays true."""
    os.makedirs(TEXTURES, exist_ok=True)
    done = []
    for s in items:
        if os.path.exists(os.path.join(WORK, f"{s['id']}-A.exr")) and os.path.exists(os.path.join(WORK, f"{s['id']}.json")):
            with open(os.path.join(WORK, f"{s['id']}.json")) as fh:
                d = json.load(fh)
            if "shadow" in d:
                done.append(d)
    renders = {d["id"]: (read(os.path.join(WORK, f"{d['id']}-A.exr")), read(os.path.join(WORK, f"{d['id']}-B.exr")) if d["shadow"] else None) for d in done}
    alone = {d["id"]: read(os.path.join(WORK, f"{d['id']}-C.exr")) for d in done if d.get("divide")}
    values = np.concatenate([np.concatenate([a[g][..., :3][a["alpha"] > 0.5].ravel() for g in LIGHTS]) for a, _ in renders.values()]) if renders else np.ones(1)
    scale = float(np.percentile(values, 99.9))
    index = {"pad": PAD, "shadowPad": SHADOW_PAD, "px": PX, "shadowPx": SHADOW_PX, "scale": round(scale, 5), "ground": {"sun": 1.0, "sky": 1.0}, "structures": {}}
    # How bright open ground is under each light (the shadows are measured against it): the
    # site weighs the suns' shadows against the sky's by these.
    open_ground = {g: [] for g in LIGHTS}
    for key, (_, b) in renders.items():
        if b is None or key in alone:
            continue
        h, w = b["alpha"].shape
        k = max(2, w // 16)
        for g in LIGHTS:
            v = b[g][..., :3].mean(-1)
            open_ground[g].append(float(np.median(np.concatenate([v[:, :k].ravel(), v[:, -k:].ravel()]))))
    if renders:
        index["ground"] = {"sun": round(float(np.median(open_ground["left"] + open_ground["right"])), 5), "sky": round(float(np.median(open_ground["sky"])), 5)}
    meta = {s["id"]: s for s in items}
    written = set()
    total = 0
    for d in done:
        a, b = renders[d["id"]]
        cover = np.clip(a["alpha"], 0, 1)
        lit = {g: a[g][..., :3] for g in GROUPS}
        if d.get("even"):
            # Turned by the site: the same light from either side, so it reads at any angle.
            lit["left"] = lit["right"] = (lit["left"] + lit["right"]) / 2
        light = [np.concatenate([np.sqrt(np.clip(lit[g] / scale, 0, 1)), cover[..., None]], -1) for g in GROUPS]
        base = os.path.join(TEXTURES, d["id"])
        for size, factor in STORE.items():
            save_webp(stacked(light, factor, PAD), base + f"-light{size}.webp", 86)
            written.add(f"{d['id']}-light{size}.webp")
        h, w = cover.shape
        src = meta[d["id"]]
        entry = {"scene": src["scene"], "building": src["building"], "x0": d["x0"], "x1": d["x1"], "y0": d["y0"], "y1": d["y1"], "rows": h, "cols": w, "shadow": None}
        if b is not None:
            save_webp(stacked(shadows(b, alone.get(d["id"])), 1.0, SHADOW_PAD), base + "-shadow.webp", 90)
            written.add(f"{d['id']}-shadow.webp")
            sh, sw = b["alpha"].shape
            sf = d["shadow"]
            entry["shadow"] = {"x0": sf["x0"], "x1": sf["x1"], "y0": sf["y0"], "y1": sf["y1"], "rows": sh, "cols": sw}
        index["structures"][d["id"]] = entry
    # What an earlier export wrote and this one did not is stale.
    for name in os.listdir(TEXTURES):
        if name.endswith(".webp") and name not in written:
            os.remove(os.path.join(TEXTURES, name))
    total = sum(os.path.getsize(os.path.join(TEXTURES, n)) for n in written)
    with open(DATA, "w") as fh:
        json.dump(index, fh, indent=1)
    print(f"[st] {len(done)} structures exported, light scale {scale:.4f}, {total / 1e6:.2f} MB", flush=True)


def preview(d: dict, out: str) -> None:
    """The structure on its ground at dawn (sun from the left), midday, and night with its
    windows lit, over the shadow frame's extent when it casts shadows."""
    a = read(os.path.join(WORK, f"{d['id']}-A.exr"))
    b = read(os.path.join(WORK, f"{d['id']}-B.exr")) if d["shadow"] else None
    c = read(os.path.join(WORK, f"{d['id']}-C.exr")) if d.get("divide") else None
    px = d.get("px", PX)
    sf = d["shadow"] or d
    u = {"x0": min(sf["x0"], d["x0"]), "x1": max(sf["x1"], d["x1"]), "y0": min(sf["y0"], d["y0"]), "y1": max(sf["y1"], d["y1"])}
    H, W = round((u["y1"] - u["y0"]) * px), round((u["x1"] - u["x0"]) * px)

    def paste(img: np.ndarray, f: dict, fill: float) -> np.ndarray:
        out = np.full((H, W) + img.shape[2:], fill, np.float32)
        oy, ox = round((u["y1"] - f["y1"]) * px), round((f["x0"] - u["x0"]) * px)
        h, w = min(img.shape[0], H - oy), min(img.shape[1], W - ox)
        out[oy : oy + h, ox : ox + w] = img[:h, :w]
        return out

    if b is not None:
        rl, rr, rs = (paste(ndimage.zoom(r, px / SHADOW_PX, order=1), sf, 1.0) for r in shadows(b, c))
    else:
        rl = rr = rs = np.ones((H, W), np.float32)
    cover = paste(np.clip(a["alpha"], 0, 1)[..., None], d, 0.0)
    lights = {g: paste(a[g][..., :3], d, 0.0) for g in GROUPS}
    rows = []
    for sun, k, sky, ks, left, win, bg in (
        ((1.0, 0.82, 0.62), 1.4, (0.35, 0.36, 0.55), 0.5, 0.8, 0.0, (0.55, 0.42, 0.36)),
        ((1.0, 0.95, 0.86), 1.75, (0.42, 0.55, 0.75), 0.55, 0.5, 0.0, (0.36, 0.42, 0.25)),
        ((0.55, 0.6, 0.75), 0.25, (0.05, 0.06, 0.12), 0.14, 0.5, 1.0, (0.05, 0.06, 0.08)),
    ):
        c = np.array(sun) * k * (left * lights["left"] + (1 - left) * lights["right"]) + np.array(sky) * ks * lights["sky"] + win * lights["windows"] * np.array([1.0, 0.75, 0.45])
        ratio = (k * (left * rl + (1 - left) * rr) + ks * rs) / (k + ks)
        ground = np.array(bg) ** 2.2 * (0.25 + 0.75 * ratio[..., None])
        img = c + ground * (1 - cover)
        rows.append(np.clip(img, 0, 1) ** (1 / 2.2))
    from PIL import Image

    Image.fromarray((np.concatenate(rows, 0) * 255).astype(np.uint8)).save(out)


def main() -> None:
    with open(SOURCE) as fh:
        items = json.load(fh)
    structures_farm.ITEMS[:] = items
    todo = [s for s in items if not ONLY or s["id"] in ONLY or s["scene"] in ONLY]
    os.makedirs(WORK, exist_ok=True)
    if EXPORT:
        export(items)
        return
    setup()
    kit = Kit()
    done = []
    for s in todo:
        d = render_structure(kit, s)
        with open(os.path.join(WORK, f"{s['id']}.json"), "w") as fh:
            json.dump(d, fh)
        done.append(d)
        if TEST:
            preview(d, os.path.join(WORK, f"test-{s['id']}.png"))
    if not TEST:
        export(items)


if __name__ == "__main__":
    main()
