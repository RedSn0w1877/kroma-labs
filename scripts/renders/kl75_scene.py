# © 2026 HVNF Studios. All rights reserved. Portfolio sample — do not redistribute.
"""KL-75 Monolith scene builder for Blender 5.0 / Cycles. Imported by render.py.

Everything is built from the site's own layout (export-geo.mjs writes .cache/kl75_slots.json and
.cache/kl75_caps.obj), in three.js units: KEY_UNIT 0.19 = 19.05 mm, so 1 unit is about 100 mm.

Coordinates: Blender is Z-up. The "deck" frame is the keycap-base plane, tilted 7.2 degrees (the
typing angle is machined into the case, the board sits flat). Its origin is where the validated
hero prototype had its keys, so the solved hero camera carries over. In deck space +y is the back
of the board and +z is the plate normal, so a key press is a move along -z.

The six exploded layers (case, brass, pcb, plate, switches, keycaps) each hang off their own
world-aligned root empty, so the Inside shot can lift a layer straight up in world Z.
"""
import json
import math
import os

import bmesh
import bpy
from mathutils import Matrix, Vector, kdtree

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, ".cache")
BRASS_LINES = ("KROMA \u00b7 KL-75 MONOLITH", "\u00a9 2026 HVNF STUDIOS \u00b7 DO NOT REDISTRIBUTE")
SILK_LINES = ("KL75-PCB REV C", "\u00a9 2026 HVNF STUDIOS")
MACRO_MARK = "KROMA \u00b7 KL-75 \u00b7 \u00a9 2026 HVNF STUDIOS"

INCLINE = math.radians(7.2)
DECK_ORIGIN = Vector((0.0, -0.3 * math.sin(INCLINE), 0.3 * math.cos(INCLINE)))
DECK = Matrix.Translation(DECK_ORIGIN) @ Matrix.Rotation(INCLINE, 4, "X")

# Vertical stack in deck space (z = 0 is the keycap-base plane, which is also the rim).
RIM_Z = 0.0
TOP_UNDER_Z = -0.050      # underside of the top frame; the gaskets press up against it
HOUSING_TOP_Z = -0.008
STEM_TOP_Z = 0.012        # must stay below the lowest pressed keycap top (0.074 - PRESS_DEPTH)
PLATE_TOP = -0.066
PLATE_T = 0.018
SHELF_Z = -0.094          # the gaskets sit on this ledge
PCB_TOP = -0.114
PCB_T = 0.035
BRASS_TOP = -0.155
BRASS_T = 0.05
FRONT_H = 0.185           # case front height (18.5 mm); rear works out to about 0.37
CHAMFER = 0.012
FLOOR_T = 0.02
PAD = (0.11, 0.11, 0.008)
PRESS_DEPTH = 0.04        # 4 mm of travel, along the plate normal

LAYER_IDS = ("case", "brass", "pcb", "plate", "switches", "keycaps")

# Calibrated base colours (sRGB hex). Red and cream were solved in the hero view so the AgX render
# samples at the CSS tokens: red #700300 renders #CA2F1D (dE2000 0.7 vs the #C8341F order key), cream
# #D7C8A5 renders #EFEAE2 (dE 2.0 vs #ECE7DB). encode.mjs --verify re-checks this on every hero
# encode. AgX can't reach a saturated #F2C200 at cap-top exposure: it pulls bright yellows toward
# cream. A probe of 22 bases in the build camera (2026-11-07) found every base at or above #C0A000
# rendering pastel peach (#E3A400 sampled #F4D3A4); a dark, slightly green-leaning #8C7400 keeps the
# most chroma and the right hue, sampling #D3B86E, a deep yolk-gold that reads as yellow on the mat.
CAP_COLOURS = {
    "cream": "#D7C8A5",
    "graphite": "#393A40",
    "red": "#700300",
    "yolk": "#8C7400",
}
LEGEND_INK = {"cream": "#141414", "graphite": "#ECE7DB", "red": "#F4EFE6", "yolk": "#141414"}
KEYSETS = {
    # tone -> cap colour name
    "classic": {"alpha": "cream", "mod": "graphite", "accent": "red"},
    "yolk": {"alpha": "cream", "mod": "cream", "accent": "yolk"},
}
FINISHES = {
    "graphite": ("#3A3B40", 0.40),
    "silver": ("#B4B4BB", 0.45),
    "black": ("#1E1F22", 0.38),
}


def srgb(hex_colour):
    h = hex_colour.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)


def datafiles(*parts):
    base = bpy.utils.system_resource("DATAFILES")
    return os.path.join(base, *parts)


def load_slots(cache=CACHE):
    with open(os.path.join(cache, "kl75_slots.json"), encoding="utf-8") as f:
        return json.load(f)


# ------------------------------------------------------------------------------------- materials
def principled(name, hex_colour, rough=0.5, metal=0.0, **inputs):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*srgb(hex_colour), 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    for key, value in inputs.items():
        b.inputs[key].default_value = value
    return m


def set_base(material, hex_colour, rough=None):
    b = material.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*srgb(hex_colour), 1)
    if rough is not None:
        b.inputs["Roughness"].default_value = rough


def knurl_material(name, hex_colour, rough):
    """Anodized aluminium with a fine procedural knurl bump on the cylinder's side only."""
    m = principled(name, hex_colour, rough, 1.0)
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["Object"], sep.inputs[0])
    ang = nt.nodes.new("ShaderNodeMath")
    ang.operation = "ARCTAN2"
    nt.links.new(sep.outputs["Y"], ang.inputs[0])
    nt.links.new(sep.outputs["X"], ang.inputs[1])
    scale = nt.nodes.new("ShaderNodeMath")
    scale.operation = "MULTIPLY"
    scale.inputs[1].default_value = 72 / (2 * math.pi)
    nt.links.new(ang.outputs[0], scale.inputs[0])
    wave = nt.nodes.new("ShaderNodeMath")
    wave.operation = "PINGPONG"
    wave.inputs[1].default_value = 0.5
    nt.links.new(scale.outputs[0], wave.inputs[0])
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    nsep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(geo.outputs["Normal"], nsep.inputs[0])
    side = nt.nodes.new("ShaderNodeMath")
    side.operation = "LESS_THAN"
    side.inputs[1].default_value = 0.5
    absz = nt.nodes.new("ShaderNodeMath")
    absz.operation = "ABSOLUTE"
    nt.links.new(nsep.outputs["Z"], absz.inputs[0])
    nt.links.new(absz.outputs[0], side.inputs[0])
    mask = nt.nodes.new("ShaderNodeMath")
    mask.operation = "MULTIPLY"
    nt.links.new(wave.outputs[0], mask.inputs[0])
    nt.links.new(side.outputs[0], mask.inputs[1])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.6
    bump.inputs["Distance"].default_value = 0.002
    nt.links.new(mask.outputs[0], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], b.inputs["Normal"])
    return m


def make_materials():
    M = {
        "case": principled("anodized", FINISHES["graphite"][0], FINISHES["graphite"][1], 1.0),
        "chamfer": principled("chamfer_polished", "#C9C9CE", 0.12, 1.0),
        "port": principled("port_dark", "#0C0C0F", 0.6, 0.3),
        "rubber": principled("rubber", "#121214", 0.9),
        "brass": principled("brass_polished", "#CAA55A", 0.10, 1.0),
        # Paint-filled engraving (black enamel wiped into the cut, as on machined maker plates). Bare
        # rough brass in the cut read as a faint emboss in the Inside view; the second line was illegible.
        "brass_engraved": principled("brass_engraved", "#17130F", 0.55, 0.0),
        # Soldermask: the spec base and roughness, but a lower specular level. At full sheen the 26 degree
        # Inside view mirrored the bright studio and the FR4 read as flat grey instead of green.
        "pcb": principled("fr4", "#14231C", 0.55, 0.0, **{"Specular IOR Level": 0.25}),
        "gold": principled("gold_pad", "#E2B85C", 0.28, 1.0),
        "hole": principled("pad_hole", "#050505", 0.7),
        "silk": principled("silkscreen", "#E9E9EC", 0.6),
        "encoder": principled("encoder", "#18181B", 0.5, 0.2),
        "plate": principled("plate", "#2A2A2E", 0.6),
        "gasket": principled("urethane_gasket", "#3B3B42", 0.95),
        "housing": principled("pc_housing", "#E4E4EC", 0.35, 0.0, **{"Transmission Weight": 0.6, "IOR": 1.585}),
        "nylon": principled("nylon_bottom", "#232427", 0.55),
        "stem": principled("stem_red", "#D43A2C", 0.45),
        "knob": knurl_material("knob", FINISHES["graphite"][0], 0.32),
    }
    for colour_name, hex_colour in CAP_COLOURS.items():
        # Dye-sub PBT is very matte. With the default specular, the big key light's sheen alone adds
        # ~0.13 linear to every channel of the cap tops, which no base colour can take back out.
        M["cap_" + colour_name] = principled(
            "pbt_" + colour_name, hex_colour, 0.62, 0.0,
            **{"Subsurface Weight": 0.05, "Subsurface Scale": 0.01, "Specular IOR Level": 0.1},
        )
    for colour_name, hex_colour in LEGEND_INK.items():
        M["ink_" + colour_name] = principled("ink_on_" + colour_name, hex_colour, 0.7)
    return M


# ----------------------------------------------------------------------------------- mesh helpers
def link(obj, parent=None):
    bpy.context.scene.collection.objects.link(obj)
    if parent is not None:
        obj.parent = parent
    return obj


def empty(name, matrix=None, parent=None):
    o = bpy.data.objects.new(name, None)
    link(o, parent)
    if matrix is not None:
        o.matrix_basis = matrix
    return o


def mesh_object(name, bm, materials, parent=None, smooth=False):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for m in materials:
        me.materials.append(m)
    if smooth:
        for p in me.polygons:
            p.use_smooth = True
    return link(bpy.data.objects.new(name, me), parent)


def bm_box(bm, x0, x1, y0, y1, z0, z1, mat_index=0):
    v = [bm.verts.new(c) for c in (
        (x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
        (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1))]
    faces = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    out = [bm.faces.new([v[i] for i in f]) for f in faces]
    for f in out:
        f.material_index = mat_index
    return out


def bm_frustum(bm, cx, cy, half0, half1, z0, z1, mat_index=0):
    """Square frustum: half-width half0 at z0 tapering to half1 at z1."""
    v = [bm.verts.new(c) for c in (
        (cx - half0, cy - half0, z0), (cx + half0, cy - half0, z0), (cx + half0, cy + half0, z0), (cx - half0, cy + half0, z0),
        (cx - half1, cy - half1, z1), (cx + half1, cy - half1, z1), (cx + half1, cy + half1, z1), (cx - half1, cy + half1, z1))]
    faces = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    for f in faces:
        bm.faces.new([v[i] for i in f]).material_index = mat_index


def bm_disc(bm, cx, cy, r, z0, z1, segments=24, mat_index=0):
    ring0 = [bm.verts.new((cx + r * math.cos(a), cy + r * math.sin(a), z0)) for a in
             (2 * math.pi * i / segments for i in range(segments))]
    ring1 = [bm.verts.new((v.co.x, v.co.y, z1)) for v in ring0]
    bm.faces.new(list(reversed(ring0))).material_index = mat_index
    bm.faces.new(ring1).material_index = mat_index
    for i in range(segments):
        j = (i + 1) % segments
        bm.faces.new((ring0[i], ring0[j], ring1[j], ring1[i])).material_index = mat_index


def bevel(obj, width, segments=3, limit="ANGLE", harden=False, angle=40):
    mod = obj.modifiers.new("bevel", "BEVEL")
    mod.width = width
    mod.segments = segments
    mod.limit_method = limit
    if limit == "ANGLE":
        mod.angle_limit = math.radians(angle)
    mod.harden_normals = harden
    return mod


def apply_modifiers(obj):
    """Bake an object's modifier stack into its mesh (used before making linked duplicates)."""
    dg = bpy.context.evaluated_depsgraph_get()
    ev = obj.evaluated_get(dg)
    me = bpy.data.meshes.new_from_object(ev)
    old = obj.data
    obj.modifiers.clear()
    obj.data = me
    bpy.data.meshes.remove(old)
    return obj


def text_curve(name, body, font, size, align_x="CENTER", align_y="CENTER", extrude=0.0):
    cu = bpy.data.curves.new(name, "FONT")
    cu.body = body
    cu.font = font
    cu.size = size
    cu.align_x = align_x
    cu.align_y = align_y
    cu.extrude = extrude
    return cu


def text_mesh(name, body, font, size, extrude, align_x="CENTER"):
    """A closed mesh of extruded text (for boolean engraving cutters)."""
    cu = text_curve(name + "_curve", body, font, size, align_x, "CENTER", extrude)
    tmp = link(bpy.data.objects.new(name + "_tmp", cu))
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(tmp.evaluated_get(dg))
    bpy.data.objects.remove(tmp)
    bpy.data.curves.remove(cu)
    return me


def load_font():
    for path in (datafiles("fonts", "DejaVuSansMono.woff2"),
                 "C:/Program Files/Blender Foundation/Blender 5.0/5.0/datafiles/fonts/DejaVuSansMono.woff2",
                 "C:/Windows/Fonts/consolab.ttf"):
        if os.path.exists(path):
            return bpy.data.fonts.load(path)
    raise RuntimeError("no static monospace font found for the legends")


# ------------------------------------------------------------------------------------------- case
def deck_to_world(x, y, z):
    return DECK @ Vector((x, y, z))


def case_geometry(data):
    BW, BD = data["BOARD_WIDTH"], data["BOARD_DEPTH"]
    CW, CD = BW + 0.30, BD + 0.30
    front_top = deck_to_world(0, -CD / 2, RIM_Z)
    back_top = deck_to_world(0, CD / 2, RIM_Z)
    bottom_z = front_top.z - FRONT_H
    return {
        "BW": BW, "BD": BD, "CW": CW, "CD": CD,
        "yF": front_top.y, "zF": front_top.z, "yB": back_top.y, "zB": back_top.z,
        "bottom_z": bottom_z, "floor_z": bottom_z + FLOOR_T, "desk_z": bottom_z - PAD[2],
        "rear_h": back_top.z - bottom_z,
    }


def build_case(data, M, root):
    """The monolith: one solid wedge with a pocket, built ring by ring in world space."""
    g = case_geometry(data)
    BW, BD, CW, CD = g["BW"], g["BD"], g["CW"], g["CD"]
    yF, zF, yB, zB, zb = g["yF"], g["zF"], g["yB"], g["zB"], g["bottom_z"]
    c = CHAMFER
    UX, UY = BW / 2 + 0.036, BD / 2 + 0.051         # upper cavity (plate + gaskets live here)
    LX, LY = BW / 2 + 0.026, BD / 2 + 0.026          # lower cavity (PCB + brass)

    def floor_point(x, y):
        """Deck-space (x, y) pushed down along the plate normal until it meets the flat floor."""
        p0 = deck_to_world(x, y, 0)
        n = DECK.to_3x3() @ Vector((0, 0, 1))
        t = (g["floor_z"] - p0.z) / n.z
        return p0 + n * t

    def quad_ring(x, y, z):
        return [deck_to_world(sx * x, sy * y, z) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]

    rings = {
        "B": [Vector((sx * CW / 2, yy, zb)) for sx, yy in ((-1, yF), (1, yF), (1, yB), (-1, yB))],
        "S": [Vector((sx * CW / 2, yy, zz - c)) for sx, yy, zz in ((-1, yF, zF), (1, yF, zF), (1, yB, zB), (-1, yB, zB))],
        "T": quad_ring(CW / 2 - c, CD / 2 - c, RIM_Z),
        "P": quad_ring(BW / 2, BD / 2, RIM_Z),
        "P1": quad_ring(BW / 2, BD / 2, TOP_UNDER_Z),
        "P1o": quad_ring(UX, UY, TOP_UNDER_Z),
        "P2": quad_ring(UX, UY, SHELF_Z),
        "Q": quad_ring(LX, LY, SHELF_Z),
        "Q2": [floor_point(sx * LX, sy * LY) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))],
    }
    order = ["B", "S", "T", "P", "P1", "P1o", "P2", "Q", "Q2"]
    bm = bmesh.new()
    verts = {k: [bm.verts.new(p) for p in rings[k]] for k in order}
    bm.faces.new(list(reversed(verts["B"])))
    for a, b in zip(order, order[1:]):
        for i in range(4):
            j = (i + 1) % 4
            f = bm.faces.new((verts[a][i], verts[a][j], verts[b][j], verts[b][i]))
            f.material_index = 1 if (a, b) == ("S", "T") else 0
    bm.faces.new(verts["Q2"])
    bm.normal_update()
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    case = mesh_object("case", bm, [M["case"], M["chamfer"]], root)

    # USB-C: a rounded slot through the back wall at the PCB's height. The cut is baked into the mesh
    # BEFORE the bevel, so the bevel's hardened normals are the last thing in the stack.
    usb_z = deck_to_world(0, BD / 2, (PCB_TOP + PCB_TOP - PCB_T) / 2).z
    bm = bmesh.new()
    bm_box(bm, -0.045, 0.045, yB - 0.25, yB + 0.08, usb_z - 0.016, usb_z + 0.016)
    cutter = mesh_object("usb_cutter", bm, [M["case"]], root)
    bev = cutter.modifiers.new("round", "BEVEL")
    bev.width = 0.0155
    bev.segments = 6
    bev.limit_method = "ANGLE"
    bev.angle_limit = math.radians(60)
    bev.affect = "EDGES"
    apply_modifiers(cutter)
    cutter.hide_render = True
    cut = case.modifiers.new("usb", "BOOLEAN")
    cut.operation = "DIFFERENCE"
    cut.solver = "EXACT"
    cut.object = cutter
    apply_modifiers(case)

    # Re-find the edges to round from their known corner points (the cut never moves them).
    wanted = []
    for i in range(4):
        j = (i + 1) % 4
        wanted += [
            (rings["B"][i], rings["S"][i], 1.0),     # outer vertical corners
            (rings["B"][i], rings["B"][j], 1.0),     # bottom perimeter
            (rings["S"][i], rings["T"][i], 1.0),     # chamfer corners follow the round
            (rings["P"][i], rings["P"][j], 0.25),    # rim opening: a small machined break
            (rings["P"][i], rings["P1"][i], 0.6),    # pocket corners: the end-mill radius
        ]
    bm = bmesh.new()
    bm.from_mesh(case.data)
    bm.verts.ensure_lookup_table()
    tree = kdtree.KDTree(len(bm.verts))
    for i, v in enumerate(bm.verts):
        tree.insert(v.co, i)
    tree.balance()

    def vert_at(p):
        _, index, dist = tree.find(p)
        return bm.verts[index] if dist < 1e-4 else None

    weights = {}
    for a, b, w in wanted:
        va, vb = vert_at(a), vert_at(b)
        e = bm.edges.get((va, vb)) if va and vb else None
        if e is not None:
            weights[e] = w
    if len(weights) != len(wanted):
        print(f"kl75_scene: WARNING found {len(weights)} of {len(wanted)} case edges to round")
    layer = bm.edges.layers.float.new("bevel_weight_edge")
    for e in bm.edges:
        w = weights.get(e, 0.0)
        e[layer] = w
        e.smooth = w > 0 or e.calc_face_angle(0) < math.radians(20)
    for f in bm.faces:
        f.smooth = True
    bm.to_mesh(case.data)
    bm.free()
    mod = case.modifiers.new("bevel", "BEVEL")
    mod.width = 0.02
    mod.segments = 3
    mod.limit_method = "WEIGHT"
    mod.harden_normals = True
    mod.material = -1

    # Four rubber pads under the flat bottom.
    bm = bmesh.new()
    for sx in (-1, 1):
        for yy in (yF + 0.21, yB - 0.21):
            x = sx * (CW / 2 - 0.24)
            bm_box(bm, x - PAD[0] / 2, x + PAD[0] / 2, yy - PAD[1] / 2, yy + PAD[1] / 2, zb - PAD[2], zb + 0.002)
    pads = mesh_object("pads", bm, [M["rubber"]], root)
    bevel(pads, 0.003, 2)
    return [case, pads], cutter, g


# ------------------------------------------------------------------------------- internal layers
def slot_xy(s):
    return s["x"], -s["z"]


def build_plate(data, M, deck):
    BW, BD = data["BOARD_WIDTH"], data["BOARD_DEPTH"]
    bm = bmesh.new()
    bm_box(bm, -(BW + 0.02) / 2, (BW + 0.02) / 2, -(BD + 0.02) / 2, (BD + 0.02) / 2, PLATE_TOP - PLATE_T, PLATE_TOP)
    plate = mesh_object("plate", bm, [M["plate"]], deck)
    bm = bmesh.new()
    for s in data["slots"]:
        x, y = slot_xy(s)
        bm_box(bm, x - 0.07, x + 0.07, y - 0.07, y + 0.07, PLATE_TOP - 0.05, PLATE_TOP + 0.03)
    # Two flex-cut slots between the qwerty and home rows, and the encoder opening under the knob.
    row_y = lambda r: -((r + 0.25 + 0.5) * data["KEY_UNIT"] - BD / 2)  # noqa: E731
    flex_y = (row_y(2) + row_y(3)) / 2
    for x0, x1 in ((-1.30, -0.40), (0.40, 1.30)):
        bm_box(bm, x0, x1, flex_y - 0.007, flex_y + 0.007, PLATE_TOP - 0.05, PLATE_TOP + 0.03)
    # The encoder opening is wider than the knob, so in the exploded view the knob (which rides on the
    # PCB) can pass up through the plate instead of colliding with it.
    kx, ky = data["KNOB_X"], -data["KNOB_Z"]
    bm_box(bm, kx - 0.095, kx + 0.095, ky - 0.095, ky + 0.095, PLATE_TOP - 0.05, PLATE_TOP + 0.03)
    cutter = mesh_object("plate_cutter", bm, [M["plate"]], deck)
    cutter.hide_render = True
    cut = plate.modifiers.new("cutouts", "BOOLEAN")
    cut.operation = "DIFFERENCE"
    cut.solver = "EXACT"
    cut.object = cutter

    # Twelve urethane gaskets: six x-positions on each of the front and back edges.
    bm = bmesh.new()
    edge_y = (BD + 0.02) / 2
    for x in (-1.25, -0.75, -0.25, 0.25, 0.75, 1.25):
        for sy in (-1, 1):
            y0, y1 = sorted((sy * (edge_y - 0.014), sy * (edge_y + 0.035)))
            bm_box(bm, x - 0.08, x + 0.08, y0, y1, SHELF_Z, TOP_UNDER_Z)
    gaskets = mesh_object("gaskets", bm, [M["gasket"]], deck, smooth=True)
    bevel(gaskets, 0.008, 3, harden=True)
    return [plate, gaskets], [cutter]


def build_switches(data, M, deck):
    bm = bmesh.new()
    bm_frustum(bm, 0, 0, 0.075, 0.059, PLATE_TOP, HOUSING_TOP_Z, 0)                    # frosted PC top
    bm_box(bm, -0.07, 0.07, -0.07, 0.07, PLATE_TOP - PLATE_T - 0.030, PLATE_TOP - PLATE_T, 1)  # nylon bottom
    # Stem cross. Our keycaps are solid, so the stem must stay buried inside a fully pressed cap: the
    # lowest pressed cap top is 0.074 - 0.04 = +0.034, and the stem stops at +0.012.
    bm_box(bm, -0.0205, 0.0205, -0.0065, 0.0065, HOUSING_TOP_Z - 0.004, STEM_TOP_Z, 2)
    bm_box(bm, -0.0065, 0.0065, -0.0205, 0.0205, HOUSING_TOP_Z - 0.004, STEM_TOP_Z, 2)
    proto = mesh_object("switch_proto", bm, [M["housing"], M["nylon"], M["stem"]], deck)
    bevel(proto, 0.004, 2, angle=30)
    apply_modifiers(proto)
    switches = []
    for s in data["slots"]:
        x, y = slot_xy(s)
        o = link(bpy.data.objects.new(f"switch_{s['i']:02d}", proto.data), deck)
        o.location = (x, y, 0)
        switches.append(o)
    bpy.data.objects.remove(proto)
    return switches


def build_pcb(data, M, deck, font):
    BW, BD = data["BOARD_WIDTH"], data["BOARD_DEPTH"]
    bm = bmesh.new()
    bm_box(bm, -(BW + 0.04) / 2, (BW + 0.04) / 2, -(BD + 0.04) / 2, (BD + 0.04) / 2, PCB_TOP - PCB_T, PCB_TOP)
    pcb = mesh_object("pcb", bm, [M["pcb"]], deck)
    bevel(pcb, 0.004, 2)

    # One gold pad cluster per switch (centre post + two pins), linked duplicates of one mesh.
    bm = bmesh.new()
    for cx, cy, r, hole in ((0, 0, 0.022, 0.0155), (-0.0381, 0.0254, 0.012, 0.0072), (0.0254, 0.0508, 0.012, 0.0072)):
        bm_disc(bm, cx, cy, r, PCB_TOP, PCB_TOP + 0.0012, 28, 0)
        bm_disc(bm, cx, cy, hole, PCB_TOP + 0.0012, PCB_TOP + 0.0016, 20, 1)
    pad_mesh = bpy.data.meshes.new("pad_cluster")
    bm.to_mesh(pad_mesh)
    bm.free()
    pad_mesh.materials.append(M["gold"])
    pad_mesh.materials.append(M["hole"])
    pads = []
    for s in data["slots"]:
        x, y = slot_xy(s)
        o = link(bpy.data.objects.new(f"pad_{s['i']:02d}", pad_mesh), deck)
        o.location = (x, y, 0)
        pads.append(o)

    # Silkscreen in the free area under the spacebar, left of its switch.
    space = data["slots"][75]
    sx, sy = slot_xy(space)
    silk = []
    for k, line in enumerate(SILK_LINES):
        cu = text_curve(f"silk_{k}", line, font, 0.042, "LEFT", "CENTER")
        o = link(bpy.data.objects.new(f"silk_{k}", cu), deck)
        o.data.materials.append(M["silk"])
        o.location = (sx - space["width"] * data["KEY_UNIT"] / 2 + 0.03, sy + 0.032 - k * 0.064, PCB_TOP + 0.0008)
        o.visible_shadow = False
        silk.append(o)

    # The rotary encoder and its knob (machined to match the case) stand on the PCB.
    kx, ky = data["KNOB_X"], -data["KNOB_Z"]
    bm = bmesh.new()
    bm_box(bm, kx - 0.06, kx + 0.06, ky - 0.065, ky + 0.065, PCB_TOP, PCB_TOP + 0.062)
    encoder = mesh_object("encoder", bm, [M["encoder"]], deck)
    bm = bmesh.new()
    bm_disc(bm, kx, ky, 0.012, PCB_TOP + 0.062, -0.004, 20)
    shaft = mesh_object("encoder_shaft", bm, [M["chamfer"]], deck, smooth=True)
    bm = bmesh.new()
    bm_disc(bm, 0, 0, 0.082, -0.004, 0.086, 96)  # centred on its own origin: the knurl is object-space
    knob = mesh_object("knob", bm, [M["knob"]], deck, smooth=True)
    knob.location = (kx, ky, 0)
    bevel(knob, 0.008, 3, angle=30, harden=True)
    return [pcb, *pads, *silk, encoder, shaft, knob], knob


def build_brass(data, M, deck, font):
    BW, BD = data["BOARD_WIDTH"], data["BOARD_DEPTH"]
    bm = bmesh.new()
    bm_box(bm, -BW * 0.43, BW * 0.43, -BD * 0.3, BD * 0.3, BRASS_TOP - BRASS_T, BRASS_TOP)
    # Flat-shaded on purpose: a mirror finish shows any interpolated normal as a warped reflection.
    brass = mesh_object("brass", bm, [M["brass"], M["brass_engraved"]], deck)
    bevel(brass, 0.012, 4, angle=30)
    # Engraving: text converted to a closed mesh and subtracted 0.0015 deep. The cut faces take the
    # cutter's matte material, so the letters read against the polished face.
    me = bpy.data.meshes.new("brass_engraving")
    bm = bmesh.new()
    for k, (line, size, y) in enumerate(((BRASS_LINES[0], 0.075, -0.06), (BRASS_LINES[1], 0.05, -0.17))):
        tm = text_mesh(f"brass_line_{k}", line, font, size, 0.004)
        tm.transform(Matrix.Translation((0, y, BRASS_TOP - 0.0015 + 0.004)))
        bm.from_mesh(tm)
        bpy.data.meshes.remove(tm)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(M["brass_engraved"])
    cutter = link(bpy.data.objects.new("brass_cutter", me), deck)
    cutter.hide_render = True
    cut = brass.modifiers.new("engrave", "BOOLEAN")
    cut.operation = "DIFFERENCE"
    cut.solver = "EXACT"
    cut.object = cutter
    cut.material_mode = "TRANSFER"
    return [brass], [cutter]


# ---------------------------------------------------------------------------------------- keycaps
WORDS = {"Esc": "esc", "Del": "del", "Bksp": "bksp", "Home": "home", "Tab": "tab", "PgUp": "pgup",
         "Caps": "caps", "Enter": "enter", "PgDn": "pgdn", "Shift": "shift", "End": "end", "Ctrl": "ctrl",
         "Win": "win", "Alt": "alt", "Fn": "fn"}
ARROWS = {"\u2191", "\u2193", "\u2190", "\u2192"}


def import_caps(cache):
    bpy.ops.wm.obj_import(filepath=os.path.join(cache, "kl75_caps.obj"), forward_axis="Y", up_axis="Z")
    meshes = {}
    for o in list(bpy.context.selected_objects):
        meshes[o.name] = o.data
        bpy.data.objects.remove(o)
    return meshes


def legend_specs(s, data):
    """(text, size, (x, y)) for each legend on a cap. Everything is lowercase."""
    label, sub = s["label"], s["sub"]
    if label == "":
        return []
    if label in ARROWS:
        return [(label, 0.05, (0, 0))]
    if sub:
        return [(sub, 0.036, (0, 0.028)), (label.lower(), 0.042, (0, -0.022))]
    if len(label) == 1:
        return [(label.lower(), 0.056, (0, 0))]
    word = WORDS.get(label, label.lower())
    return [(word, 0.03 if len(word) <= 4 else 0.027, (0, 0))]


def build_keycaps(data, M, deck, font, cache):
    meshes = import_caps(cache)
    caps = []
    for s in data["slots"]:
        prof = data["ROW_PROFILE"][s["row"]]
        h, tilt = prof["height"], prof["tilt"]
        o = link(bpy.data.objects.new(f"key_{s['i']:02d}", meshes[s["cap"]]), deck)
        x, y = slot_xy(s)
        o.location = (x, y, h / 2)
        o.rotation_euler.x = math.radians(tilt)
        if not o.data.materials:
            o.data.materials.append(M["cap_cream"])
        o.material_slots[0].link = "OBJECT"
        o["rest"] = (x, y, h / 2)
        legends = []
        for k, (body, size, (lx, ly)) in enumerate(legend_specs(s, data)):
            cu = text_curve(f"leg_{s['i']:02d}_{k}", body, font, size)
            t = link(bpy.data.objects.new(cu.name, cu), o)
            t.location = (lx, ly, h / 2 + 0.0012)
            t.data.materials.append(M["ink_cream"])
            t.material_slots[0].link = "OBJECT"
            t.visible_shadow = False
            legends.append(t)
        # No side print on the spacebar (polish round): the copyright reads as a stock watermark on the
        # product. The page carries it as a corner mark beside the board; the brass engraving and the PCB
        # silkscreen keep theirs.
        caps.append({"obj": o, "slot": s, "legends": legends, "h": h})
    return caps


def apply_keyset(caps, M, keyset):
    tones = KEYSETS[keyset]
    for c in caps:
        colour = tones[c["slot"]["tone"]]
        c["obj"].material_slots[0].material = M["cap_" + colour]
        for t in c["legends"]:
            t.material_slots[0].material = M["ink_" + colour]


def apply_finish(M, finish):
    hex_colour, rough = FINISHES[finish]
    set_base(M["case"], hex_colour, rough)
    set_base(M["knob"], hex_colour, rough - 0.08)


def press(caps, slots, depth=PRESS_DEPTH):
    """Move the given slot indices down along the plate normal; everything else returns to rest."""
    down = set(slots)
    for c in caps:
        x, y, z = c["obj"]["rest"]
        c["obj"].location = (x, y, z - (depth if c["slot"]["i"] in down else 0.0))


# ----------------------------------------------------------------------------------- the whole board
def build(cache=CACHE, keyset="classic", finish="graphite"):
    """Builds the KL-75 and returns a dict of its parts. Call after read_factory_settings."""
    data = load_slots(cache)
    M = make_materials()
    font = load_font()
    roots, decks = {}, {}
    for lid in LAYER_IDS:
        roots[lid] = empty(f"layer_{lid}")
        decks[lid] = empty(f"deck_{lid}", DECK.copy(), roots[lid])
    layers = {lid: [] for lid in LAYER_IDS}
    helpers = []

    case_objs, usb_cutter, geom = build_case(data, M, roots["case"])
    layers["case"] += case_objs
    helpers.append(usb_cutter)
    brass_objs, cutters = build_brass(data, M, decks["brass"], font)
    layers["brass"] += brass_objs
    helpers += cutters
    pcb_objs, knob = build_pcb(data, M, decks["pcb"], font)
    layers["pcb"] += pcb_objs
    plate_objs, cutters = build_plate(data, M, decks["plate"])
    layers["plate"] += plate_objs
    helpers += cutters
    layers["switches"] += build_switches(data, M, decks["switches"])
    caps = build_keycaps(data, M, decks["keycaps"], font, cache)
    for c in caps:
        layers["keycaps"].append(c["obj"])
        layers["keycaps"] += c["legends"]

    bpy.ops.mesh.primitive_plane_add(size=60, location=(0, 0, geom["desk_z"]))
    catcher = bpy.context.active_object
    catcher.name = "desk_catcher"
    catcher.is_shadow_catcher = True

    apply_keyset(caps, M, keyset)
    apply_finish(M, finish)
    return {
        "data": data, "M": M, "font": font, "roots": roots, "decks": decks, "layers": layers,
        "caps": caps, "catcher": catcher, "geom": geom, "knob": knob, "helpers": helpers,
    }


def lift(board, lifts):
    """World-Z lift per layer id (missing ids go back to rest)."""
    for lid, root in board["roots"].items():
        root.location = (0, 0, lifts.get(lid, 0.0))


def show_only(board, layer_ids, catcher=True):
    for lid, objs in board["layers"].items():
        for o in objs:
            o.hide_render = lid not in layer_ids
    board["catcher"].hide_render = not catcher


def camera_only(board, layer_ids, catcher=True):
    """Every layer stays in the scene (shadows, reflections, bounce light) but only `layer_ids` are
    seen by the camera, so a single layer's image carries the shadows the others cast on it."""
    for lid, objs in board["layers"].items():
        for o in objs:
            o.hide_render = False
            o.visible_camera = lid in layer_ids
    board["catcher"].hide_render = not catcher


def holdout_material():
    m = bpy.data.materials.new("holdout")
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(nt.nodes.new("ShaderNodeHoldout").outputs[0], out.inputs["Surface"])
    return m


def case_lip(board):
    """Turn every case face into a holdout except the exterior the front-left camera sees in front of
    the internals: the outer front and left walls, their chamfers and the front/left rim strips. A
    render of that is the 'lip' that hides parts still inside the case in the Inside stack."""
    g = board["geom"]
    case = board["layers"]["case"][0]
    if case.data.materials.find("holdout") < 0:
        case.data.materials.append(holdout_material())
    hold = case.data.materials.find("holdout")
    to_deck = DECK.inverted()
    deck_z = DECK.to_3x3() @ Vector((0, 0, 1))
    kept = 0
    for f in case.data.polygons:
        n, c = f.normal, f.center
        cl = to_deck @ c
        keep = (
            (n.y < -0.95 and c.y < g["yF"] + 0.005)                                   # outer front wall
            or (n.x < -0.95 and c.x < -g["CW"] / 2 + 0.005)                           # outer left wall
            or (f.material_index == 1 and (n.y < -0.5 or n.x < -0.5))                 # front/left chamfer
            or (n.dot(deck_z) > 0.99 and abs(cl.z) < 1e-4
                and (cl.y < -g["BD"] / 2 + 1e-5 or cl.x < -g["BW"] / 2 + 1e-5))      # front/left rim strips
        )
        if keep:
            kept += 1
        else:
            f.material_index = hold
    return kept


# ------------------------------------------------------------------------------- lights and render
def add_area(name, loc, size, energy, colour=(1, 1, 1), target=(0, 0.1, 0)):
    ld = bpy.data.lights.new(name, "AREA")
    ld.energy = energy
    ld.size = size
    ld.color = colour
    o = link(bpy.data.objects.new(name, ld))
    o.location = loc
    o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    return o


def studio_lights(world_strength=0.35):
    lights = [
        add_area("key", (-3.0, -1.6, 5.0), 4.0, 1400),
        add_area("fill", (4.5, -3.5, 2.5), 3.0, 260, (0.95, 0.97, 1.0)),
        add_area("rim", (0.5, 4.5, 2.8), 3.0, 520, (1.0, 0.98, 0.95)),
    ]
    scene = bpy.context.scene
    world = bpy.data.worlds.new("studio")
    scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    env = nt.nodes.new("ShaderNodeTexEnvironment")
    env.image = bpy.data.images.load(datafiles("studiolights", "world", "studio.exr"))
    nt.nodes["Background"].inputs["Strength"].default_value = world_strength
    nt.links.new(env.outputs["Color"], nt.nodes["Background"].inputs["Color"])
    return lights


def setup_render(width, height, samples, transparent=True):
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    cy = scene.cycles
    cy.device = "CPU"
    cy.samples = samples
    cy.use_adaptive_sampling = True
    cy.adaptive_threshold = 0.02
    cy.use_denoising = True
    cy.denoiser = "OPENIMAGEDENOISE"
    cy.seed = 0
    cy.use_animated_seed = False
    # One tile per frame: the rest render and the border-cropped press renders must sample and
    # denoise identically, and different tile layouts would break that at tile edges.
    cy.use_auto_tile = False
    cy.max_bounces = 8
    cy.diffuse_bounces = 3
    cy.glossy_bounces = 4
    cy.transmission_bounces = 8
    cy.transparent_max_bounces = 8
    cy.caustics_reflective = False
    cy.caustics_refractive = False
    cy.blur_glossy = 1.0
    scene.render.use_persistent_data = True
    scene.render.film_transparent = transparent
    scene.render.resolution_x, scene.render.resolution_y = width, height
    scene.render.resolution_percentage = 100
    scene.render.use_border = False
    scene.render.use_crop_to_border = False
    st = scene.render.image_settings
    st.file_format = "PNG"
    st.color_mode = "RGBA"
    st.color_depth = "8"
    st.compression = 15
    scene.view_settings.view_transform = "AgX"
    for look in ("AgX - Medium High Contrast", "Medium High Contrast"):
        try:
            scene.view_settings.look = look
            break
        except TypeError:
            continue
    return scene


def make_camera(name="cam", lens=55.0):
    cd = bpy.data.cameras.new(name)
    cd.lens = lens
    cd.clip_start = 0.05
    cd.clip_end = 20000
    cam = link(bpy.data.objects.new(name, cd))
    bpy.context.scene.camera = cam
    return cam


def aim(cam, target, azimuth_deg, elevation_deg, dist):
    """Place the camera on a sphere around target. Azimuth 0 = straight in front (-y), positive = to
    the camera's right of the board (front-right), negative = front-left."""
    a, e = math.radians(azimuth_deg), math.radians(elevation_deg)
    direction = Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)))
    cam.location = Vector(target) + direction * dist
    cam.rotation_euler = (Vector(target) - cam.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.view_layer.update()
