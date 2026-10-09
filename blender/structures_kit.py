"""
The parts every rendered structure is made of (see structures_render.py): meshes built in
world coordinates and sheared into the site's oblique view, and procedural materials.

Every mesh is built in world coordinates (x right, y away from the eye, z up), its front at
y = 0 or behind, and sheared into the oblique view once the whole structure is built.
"""
from __future__ import annotations

import math

import bpy
import bmesh
import numpy as np
from mathutils import Matrix, Vector

# The oblique view: a unit further back is drawn this far right, and this far up.
KX = 0.32
KZ = 0.18


# ——— Geometry ———

def _object(name: str, bm: bmesh.types.BMesh, mat: bpy.types.Material, group: str = "") -> bpy.types.Object:
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    ob = bpy.data.objects.new(name, me)
    if group:
        ob.lightgroup = group
    return ob


def box(name: str, x0: float, x1: float, y0: float, y1: float, z0: float, z1: float, mat, bevel: float = 0.0, group: str = "") -> bpy.types.Object:
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector(((x0 + x1) / 2 + v.co.x * (x1 - x0), (y0 + y1) / 2 + v.co.y * (y1 - y0), (z0 + z1) / 2 + v.co.z * (z1 - z0)))
    if bevel > 0:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=2, affect="EDGES", profile=0.5)
    return _object(name, bm, mat, group)


def prism(name: str, outline: list[tuple[float, float]], y0: float, y1: float, mat, bevel: float = 0.0, group: str = "") -> bpy.types.Object:
    """A shape drawn in x and z (anticlockwise, as seen from the front), pushed back from y0 to y1."""
    bm = bmesh.new()
    front = [bm.verts.new((x, y0, z)) for x, z in outline]
    back = [bm.verts.new((x, y1, z)) for x, z in outline]
    n = len(outline)
    bm.faces.new(list(reversed(front)))
    bm.faces.new(back)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((front[i], front[j], back[j], back[i]))
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    if bevel > 0:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=2, affect="EDGES", profile=0.5)
    return _object(name, bm, mat, group)


def cylinder(name: str, cx: float, cy: float, z0: float, z1: float, r0: float, r1: float, mat, segments: int = 32, group: str = "") -> bpy.types.Object:
    """Upright, radius r0 at the bottom and r1 at the top (a cone if r1 is 0)."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segments, radius1=r0, radius2=r1, depth=z1 - z0)
    bmesh.ops.translate(bm, verts=list(bm.verts), vec=(cx, cy, (z0 + z1) / 2))
    return _object(name, bm, mat, group)


def dome(name: str, cx: float, cy: float, z: float, r: float, mat, squash: float = 1.0) -> bpy.types.Object:
    """A half sphere on z."""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=40, v_segments=20, radius=r)
    gone = [v for v in bm.verts if v.co.z < -1e-4]
    bmesh.ops.delete(bm, geom=gone, context="VERTS")
    for v in bm.verts:
        v.co = Vector((cx + v.co.x, cy + v.co.y, z + v.co.z * squash))
    return _object(name, bm, mat)


def _place(bm: bmesh.types.BMesh, rot: Matrix | None, at: tuple[float, float, float]) -> None:
    if rot is not None:
        bmesh.ops.transform(bm, matrix=rot, verts=list(bm.verts))
    bmesh.ops.translate(bm, verts=list(bm.verts), vec=at)


def obox(name: str, at: tuple[float, float, float], size: tuple[float, float, float], angle: float, mat, bevel: float = 0.0, group: str = "") -> bpy.types.Object:
    """A box `size` (width, depth, height) centred on `at`, turned `angle` radians about the
    vertical: its width runs that far round from the x axis."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
    if bevel > 0:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=2, affect="EDGES", profile=0.5)
    _place(bm, Matrix.Rotation(angle, 4, "Z"), at)
    return _object(name, bm, mat, group)


def rod(name: str, a: tuple[float, float, float], b: tuple[float, float, float], r: float, mat, segments: int = 6, group: str = "") -> bpy.types.Object:
    """A round bar from a to b."""
    va, vb = Vector(a), Vector(b)
    d = vb - va
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segments, radius1=r, radius2=r, depth=max(d.length, 1e-4))
    _place(bm, d.to_track_quat("Z", "Y").to_matrix().to_4x4(), tuple((va + vb) / 2))
    return _object(name, bm, mat, group)


def ring(name: str, cx: float, cy: float, z0: float, z1: float, r: float, mat, segments: int = 48) -> bpy.types.Object:
    """An open band round an upright axis (a rail, a hoop)."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=False, cap_tris=False, segments=segments, radius1=r, radius2=r, depth=z1 - z0)
    _place(bm, None, (cx, cy, (z0 + z1) / 2))
    return _object(name, bm, mat)


def ball(name: str, at: tuple[float, float, float], r: float, mat, group: str = "") -> bpy.types.Object:
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=10, radius=r)
    _place(bm, None, at)
    return _object(name, bm, mat, group)


def disc_y(name: str, cx: float, cz: float, y0: float, y1: float, r: float, mat, segments: int = 32, group: str = "") -> bpy.types.Object:
    """A disc facing the eye: a short cylinder whose axis runs back from y0 to y1."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segments, radius1=r, radius2=r, depth=y1 - y0)
    _place(bm, Matrix.Rotation(math.pi / 2, 4, "X"), (cx, (y0 + y1) / 2, cz))
    return _object(name, bm, mat, group)


def pyramid(name: str, x0: float, x1: float, y0: float, y1: float, z: float, apex: float, mat) -> bpy.types.Object:
    """A hipped roof coming to a point over the middle of a rectangle."""
    bm = bmesh.new()
    base = [bm.verts.new(c) for c in ((x0, y0, z), (x1, y0, z), (x1, y1, z), (x0, y1, z))]
    top = bm.verts.new(((x0 + x1) / 2, (y0 + y1) / 2, apex))
    bm.faces.new(list(reversed(base)))
    for i in range(4):
        bm.faces.new((base[i], base[(i + 1) % 4], top))
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    return _object(name, bm, mat)


def bar_xz(name: str, a: tuple[float, float], b: tuple[float, float], width: float, y0: float, y1: float, mat, bevel: float = 0.0) -> bpy.types.Object:
    """A straight bar from a to b in the x–z plane (`width` across), from y0 back to y1."""
    dx, dz = b[0] - a[0], b[1] - a[1]
    n = math.hypot(dx, dz) or 1.0
    nx, nz = -dz / n * width / 2, dx / n * width / 2
    outline = [(a[0] + nx, a[1] + nz), (a[0] - nx, a[1] - nz), (b[0] - nx, b[1] - nz), (b[0] + nx, b[1] + nz)]
    return prism(name, outline, y0, y1, mat, bevel)


def shear(obs: list[bpy.types.Object]) -> None:
    """Into the oblique view: x += KX·y, z += KZ·y."""
    m = Matrix(((1.0, KX, 0.0, 0.0), (0.0, 1.0, 0.0, 0.0), (0.0, KZ, 1.0, 0.0), (0.0, 0.0, 0.0, 1.0)))
    for ob in obs:
        if ob.type == "MESH":
            ob.data.transform(m)
            ob.data.update()


def at_screen(x: float, z: float, y: float) -> tuple[float, float]:
    """Where to put a point `y` deep so that, sheared, it is drawn at screen (x, z)."""
    return x - KX * y, z - KZ * y


# ——— Materials ———

def _nodes(mat: bpy.types.Material):
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    return nt, nt.nodes.new, nt.links.new


class Shader:
    """A small helper for building node materials from code."""

    def __init__(self, name: str):
        self.mat = bpy.data.materials.new(name)
        self.nt, self.n, self.link = _nodes(self.mat)
        self.out = self.n("ShaderNodeOutputMaterial")
        self.coord = self.n("ShaderNodeTexCoord")

    def noise(self, scale: float, detail: float = 3.0, rough: float = 0.55, vec=None):
        t = self.n("ShaderNodeTexNoise")
        t.inputs["Scale"].default_value = scale
        t.inputs["Detail"].default_value = detail
        t.inputs["Roughness"].default_value = rough
        self.link(vec if vec is not None else self.coord.outputs["Object"], t.inputs["Vector"])
        return t.outputs["Fac"]

    def mapping(self, scale: tuple[float, float, float], vec=None, rotation: tuple[float, float, float] = (0, 0, 0)):
        m = self.n("ShaderNodeMapping")
        m.inputs["Scale"].default_value = scale
        m.inputs["Rotation"].default_value = rotation
        self.link(vec if vec is not None else self.coord.outputs["Object"], m.inputs["Vector"])
        return m.outputs["Vector"]

    def mix(self, fac, a, b):
        m = self.n("ShaderNodeMix")
        m.data_type = "RGBA"
        self._in(m.inputs["Factor"], fac)
        for sock, v in (("A", a), ("B", b)):
            self._in(m.inputs[sock], v)
        return m.outputs["Result"]

    def ramp(self, fac, lo: float, hi: float):
        r = self.n("ShaderNodeMapRange")
        r.interpolation_type = "SMOOTHSTEP"
        self._in(r.inputs["Value"], fac)
        r.inputs["From Min"].default_value = lo
        r.inputs["From Max"].default_value = hi
        return r.outputs["Result"]

    def op(self, operation: str, a, b=0.0):
        m = self.n("ShaderNodeMath")
        m.operation = operation
        self._in(m.inputs[0], a)
        self._in(m.inputs[1], b)
        return m.outputs[0]

    def axis(self, which: str, vec=None):
        s = self.n("ShaderNodeSeparateXYZ")
        self.link(vec if vec is not None else self.coord.outputs["Object"], s.inputs["Vector"])
        return s.outputs[which]

    def attr(self, name: str):
        """A number the object carries (set by structures_render.py: `base`, its foot)."""
        a = self.n("ShaderNodeAttribute")
        a.attribute_type = "OBJECT"
        a.attribute_name = name
        return a.outputs["Fac"]

    def height(self):
        """World height before the shear (which lifts what lies further back)."""
        return self.op("SUBTRACT", self.axis("Z"), self.op("MULTIPLY", self.axis("Y"), KZ))

    def unsheared_x(self):
        return self.op("SUBTRACT", self.axis("X"), self.op("MULTIPLY", self.axis("Y"), KX))

    def round_uv(self, cx: float, cy: float, r: float):
        """Round a wall standing on (cx, cy): the distance round it, and up it."""
        az = self.op("ARCTAN2", self.op("SUBTRACT", self.axis("Y"), cy), self.op("SUBTRACT", self.unsheared_x(), cx))
        c = self.n("ShaderNodeCombineXYZ")
        self._in(c.inputs["X"], self.op("MULTIPLY", az, r))
        self._in(c.inputs["Y"], self.height())
        return c.outputs["Vector"]

    def wall_uv(self):
        """Across and up a wall, whichever way it faces: along x on a front, along y on a side,
        so courses of stone or brick keep their size on every face."""
        g = self.n("ShaderNodeNewGeometry")
        side = self.ramp(self.op("ABSOLUTE", self.axis("X", g.outputs["Normal"])), 0.6, 0.8)
        across = self.op("ADD", self.op("MULTIPLY", self.unsheared_x(), self.op("SUBTRACT", 1.0, side)), self.op("MULTIPLY", self.axis("Y"), side))
        c = self.n("ShaderNodeCombineXYZ")
        self._in(c.inputs["X"], across)
        self._in(c.inputs["Y"], self.height())
        return c.outputs["Vector"]

    def courses(self, color, mortar, width: float, height: float, mortar_size: float = 0.05, vary: float = 0.84):
        """Blocks laid in courses (stone or brick) over wall_uv: `width` × `height` world units."""
        b = self.n("ShaderNodeTexBrick")
        b.inputs["Color1"].default_value = (*color, 1)
        b.inputs["Color2"].default_value = (*darker(color, vary), 1)
        b.inputs["Mortar"].default_value = (*mortar, 1)
        b.inputs["Scale"].default_value = 1.0
        b.inputs["Mortar Size"].default_value = mortar_size
        b.inputs["Brick Width"].default_value = width
        b.inputs["Row Height"].default_value = height
        b.offset = 0.5
        self.link(self.wall_uv(), b.inputs["Vector"])
        return b

    def _in(self, sock, v):
        if isinstance(v, (int, float)):
            sock.default_value = v
        elif isinstance(v, tuple):
            sock.default_value = (*v, 1.0) if len(v) == 3 else v
        else:
            self.link(v, sock)

    def surface(self, color, rough: float | object = 0.8, bump=None, strength: float = 0.4, metallic: float = 0.0, spec: float = 0.4, emission=None, emit: float = 0.0):
        b = self.n("ShaderNodeBsdfPrincipled")
        self._in(b.inputs["Base Color"], color)
        self._in(b.inputs["Roughness"], rough)
        b.inputs["Metallic"].default_value = metallic
        b.inputs["Specular IOR Level"].default_value = spec
        if bump is not None:
            bn = self.n("ShaderNodeBump")
            bn.inputs["Strength"].default_value = strength
            bn.inputs["Distance"].default_value = 0.6
            self.link(bump, bn.inputs["Height"])
            self.link(bn.outputs["Normal"], b.inputs["Normal"])
        if emission is not None:
            self._in(b.inputs["Emission Color"], emission)
            b.inputs["Emission Strength"].default_value = emit
        self.link(b.outputs[0], self.out.inputs["Surface"])
        return self.mat


def lin(hexs: str) -> tuple[float, float, float]:
    c = [int(hexs[i : i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c)


def darker(c: tuple, k: float) -> tuple:
    return tuple(v * k for v in c)


def plaster(name: str, color: str, grime: float = 0.35) -> bpy.types.Material:
    """Lime plaster: mottled, a little rough, darker and dirtier towards the ground."""
    s = Shader(name)
    c = lin(color)
    mottled = s.mix(s.ramp(s.noise(0.09, 4), 0.35, 0.7), c, darker(c, 0.86))
    patches = s.mix(s.ramp(s.noise(0.025, 3), 0.6, 0.75), mottled, darker(c, 0.93))
    # Grime rising from the ground, ragged.
    up = s.op("SUBTRACT", s.height(), s.attr("base"))
    rag = s.op("ADD", up, s.op("MULTIPLY", s.noise(0.3, 3), 6.0))
    dirty = s.mix(s.op("MULTIPLY", s.ramp(rag, 12.0, 1.0), grime), patches, darker(c, 0.55))
    return s.surface(dirty, 0.9, bump=s.noise(0.8, 4, 0.6), strength=0.25)


def tiles(name: str, color: str, row: float = 2.4) -> bpy.types.Material:
    """Clay roof tiles: rows along the eaves, each tile its own shade, moss in places."""
    s = Shader(name)
    c = lin(color)
    vec = s.mapping((1 / 2.6, 1 / 2.6, 1 / row))
    brick = s.n("ShaderNodeTexBrick")
    brick.inputs["Color1"].default_value = (*c, 1)
    brick.inputs["Color2"].default_value = (*darker(c, 0.78), 1)
    brick.inputs["Mortar"].default_value = (*darker(c, 0.42), 1)
    brick.inputs["Scale"].default_value = 1.0
    brick.inputs["Mortar Size"].default_value = 0.06
    brick.inputs["Brick Width"].default_value = 0.9
    brick.inputs["Row Height"].default_value = 1.0
    brick.offset = 0.5
    s.link(s.mapping((1.0, 1.0, 1.0), vec, rotation=(math.pi / 2, 0, 0)), brick.inputs["Vector"])
    moss = s.mix(s.op("MULTIPLY", s.ramp(s.noise(0.06, 4), 0.62, 0.78), 0.55), brick.outputs["Color"], (0.12, 0.13, 0.06))
    return s.surface(moss, 0.75, bump=brick.outputs["Fac"], strength=0.5)


def wood(name: str, color: str, plank: float = 3.0, vertical: bool = True) -> bpy.types.Material:
    """Painted boards: planks with dark seams, the paint worn in places."""
    s = Shader(name)
    c = lin(color)
    along = s.axis("X" if vertical else "Z")
    seam = s.op("FRACT", s.op("DIVIDE", along, plank))
    seams = s.ramp(s.op("ABSOLUTE", s.op("SUBTRACT", seam, 0.5)), 0.44, 0.5)
    grain = s.mix(s.ramp(s.noise(0.5, 5), 0.3, 0.7), c, darker(c, 0.82))
    worn = s.mix(s.ramp(s.noise(0.12, 4), 0.62, 0.72), grain, darker(c, 0.6))
    col = s.mix(seams, worn, darker(c, 0.35))
    return s.surface(col, 0.7, bump=seams, strength=0.35)


def stone(name: str, color: str, block: float = 4.0) -> bpy.types.Material:
    """Dressed stone in courses."""
    s = Shader(name)
    c = lin(color)
    brick = s.n("ShaderNodeTexBrick")
    brick.inputs["Color1"].default_value = (*c, 1)
    brick.inputs["Color2"].default_value = (*darker(c, 0.84), 1)
    brick.inputs["Mortar"].default_value = (*darker(c, 0.6), 1)
    brick.inputs["Scale"].default_value = 1.0
    brick.inputs["Mortar Size"].default_value = 0.04
    brick.inputs["Brick Width"].default_value = 1.6
    brick.inputs["Row Height"].default_value = 0.8
    s.link(s.mapping((1 / block, 1 / block, 1 / block), rotation=(math.pi / 2, 0, 0)), brick.inputs["Vector"])
    col = s.mix(s.ramp(s.noise(0.2, 4), 0.4, 0.7), brick.outputs["Color"], darker(c, 0.8))
    return s.surface(col, 0.85, bump=brick.outputs["Fac"], strength=0.6)


def paint(name: str, color: str, rough: float = 0.6, metallic: float = 0.0) -> bpy.types.Material:
    s = Shader(name)
    c = lin(color)
    return s.surface(s.mix(s.ramp(s.noise(0.4, 4), 0.4, 0.7), c, darker(c, 0.9)), rough, metallic=metallic, bump=s.noise(1.2, 3), strength=0.1)


def ashlar(name: str, color: str, width: float, height: float) -> bpy.types.Material:
    """Dressed stone in courses that keep their size round every face, each block its own
    shade, weathered in patches."""
    s = Shader(name)
    c = lin(color)
    b = s.courses(c, darker(c, 0.72), width, height, 0.035, 0.9)
    col = s.mix(s.ramp(s.noise(0.12, 4), 0.45, 0.75), b.outputs["Color"], darker(c, 0.82))
    col = s.mix(s.ramp(s.noise(0.03, 3), 0.62, 0.74), col, darker(c, 0.9))
    return s.surface(col, 0.85, bump=b.outputs["Fac"], strength=0.45)


def brick(name: str, color: str) -> bpy.types.Material:
    """Brick in stretcher bond with pale mortar, some bricks darker, sooty in places."""
    s = Shader(name)
    c = lin(color)
    b = s.courses(c, lin("#c8bfb0"), 2.8, 1.0, 0.07, 0.78)
    burnt = s.mix(s.ramp(s.noise(2.2, 2), 0.62, 0.66), b.outputs["Color"], darker(c, 0.62))
    soot = s.mix(s.op("MULTIPLY", s.ramp(s.noise(0.05, 4), 0.55, 0.8), 0.5), burnt, (0.06, 0.05, 0.045))
    return s.surface(soot, 0.88, bump=b.outputs["Fac"], strength=0.55)


def corrugated(name: str, color: str, pitch: float = 1.4) -> bpy.types.Material:
    """Corrugated steel sheet, its ribs running down the slope (and so across the depth),
    dulled and rust-streaked in places."""
    s = Shader(name)
    c = lin(color)
    wave = s.op("SINE", s.op("MULTIPLY", s.axis("Y"), 2 * math.pi / pitch))
    rust = s.mix(s.op("MULTIPLY", s.ramp(s.noise(0.08, 4, vec=s.mapping((1.0, 0.2, 1.0))), 0.6, 0.8), 0.6), s.mix(s.ramp(s.noise(0.3, 3), 0.4, 0.7), c, darker(c, 0.85)), lin("#7a4a2e"))
    return s.surface(rust, 0.5, bump=wave, strength=0.3, metallic=0.55)


def verdigris(name: str, cx: float, cy: float, ribs: int = 16) -> bpy.types.Material:
    """Copper gone green over a dome on (cx, cy): ribs running up from the drum to the crown,
    rain streaks down from them, darker in the seams."""
    s = Shader(name)
    az = s.op("ARCTAN2", s.op("SUBTRACT", s.axis("Y"), cy), s.op("SUBTRACT", s.unsheared_x(), cx))
    k = s.op("FRACT", s.op("MULTIPLY", az, ribs / (2 * math.pi)))
    rib = s.ramp(s.op("ABSOLUTE", s.op("SUBTRACT", k, 0.5)), 0.43, 0.5)
    light, dark = lin("#6fae9d"), lin("#3b6e62")
    streaks = s.noise(0.35, 4, vec=s.mapping((1.0, 1.0, 0.08)))
    col = s.mix(s.ramp(streaks, 0.3, 0.7), light, dark)
    col = s.mix(s.op("MULTIPLY", s.ramp(s.noise(0.06, 3), 0.55, 0.75), 0.6), col, lin("#7c5a3b"))
    col = s.mix(s.op("MULTIPLY", rib, 0.55), col, darker(dark, 0.7))
    return s.surface(col, 0.55, bump=rib, strength=0.6, metallic=0.25)


def glass(name: str, glow: str = "#ffb866", strength: float = 3.0) -> bpy.types.Material:
    """Window glass: dark, a little glossy, and lit from inside (the windows' light group)."""
    s = Shader(name)
    inside = s.mix(s.ramp(s.noise(0.15, 2), 0.3, 0.7), lin(glow), darker(lin(glow), 0.6))
    return s.surface((0.02, 0.025, 0.03), 0.12, spec=0.6, emission=inside, emit=strength)


# ——— Shared materials ———

class Kit:
    """Materials shared by every structure, made once."""

    def __init__(self) -> None:
        self.walls = [plaster("plaster-cream", "#e9dcc4"), plaster("plaster-ochre", "#e3c99c"), plaster("plaster-white", "#efe8dc")]
        self.roofs = [tiles("tiles-clay", "#9a4a34"), tiles("tiles-slate", "#58606b"), tiles("tiles-brown", "#7a4b39")]
        self.door = wood("door", "#5a3a2a")
        self.frame = paint("frame", "#efe9dd", 0.5)
        self.sill = stone("sill", "#b8b0a2", 3.0)
        self.plinth = stone("plinth", "#8f877c", 5.0)
        self.chimney = stone("chimney", "#8a5a46", 2.0)
        self.glass = glass("glass")
        self.ground = Shader("ground").surface(lin("#5d6b3f"), 1.0)
        self.shutters = [wood("shutter-green", "#3f6b4e", 1.2), wood("shutter-blue", "#3d5f80", 1.2), wood("shutter-red", "#8a3b2f", 1.2), wood("shutter-ochre", "#b0863c", 1.2)]
        self.beam = wood("beam", "#3b2a20", 2.0, vertical=False)
        self.flowers = [paint("flowers-red", "#c2413a", 0.7), paint("flowers-pink", "#d9739a", 0.7), paint("flowers-yellow", "#e6b83c", 0.7)]
        self.leaves = paint("leaves", "#3d5a2b", 0.8)
