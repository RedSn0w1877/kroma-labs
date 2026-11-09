# © 2026 HVNF Studios. All rights reserved. Portfolio sample — do not redistribute.
"""Render the KL-75 shots (spec 11.6). Run it through Blender 5.0:

    blender -b --factory-startup --python-exit-code 1 -P render.py -- <shot> <outDir> [samples] [--rest-only]

shots: draft | hero | phone | inside | build | brass
Every shot writes its PNGs plus <shot>.json (camera, key polygons in pixels, field crop, colour sample
regions, layer offsets) to outDir. encode.mjs turns those into public/renders/* and src/data/*.json.
"""
import json
import math
import os
import sys
import time

sys.dont_write_bytecode = True  # no __pycache__ next to the scripts
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bmesh  # noqa: E402
import bpy  # noqa: E402
import numpy as np  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

import kl75_scene as S  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
if len(argv) < 2:
    raise SystemExit("usage: render.py -- <draft|hero|phone|inside|build|brass> <outDir> [samples] [--rest-only]")
SHOT, OUT = argv[0], os.path.abspath(argv[1])
SAMPLES = int(argv[2]) if len(argv) > 2 and argv[2].isdigit() else None
REST_ONLY = "--rest-only" in argv
os.makedirs(OUT, exist_ok=True)
T0 = time.time()


def log(*parts):
    print(f"[render {SHOT} {time.time() - T0:6.1f}s]", *parts, flush=True)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


# ---------------------------------------------------------------------------------- projection
def world_points(objs):
    dg = bpy.context.evaluated_depsgraph_get()
    out = []
    for o in objs:
        ev = o.evaluated_get(dg)
        me = ev.to_mesh()
        if me is not None and len(me.vertices):
            co = np.empty(len(me.vertices) * 3, dtype=np.float64)
            me.vertices.foreach_get("co", co)
            co = co.reshape(-1, 3)
            mw = np.array(ev.matrix_world)
            out.append(co @ mw[:3, :3].T + mw[:3, 3])
        ev.to_mesh_clear()
    return np.vstack(out) if out else np.zeros((0, 3))


def projector(cam):
    """Vectorised world_to_camera_view: returns f(P) -> (N, 2) normalised frame coords, y down."""
    scene = bpy.context.scene
    bpy.context.view_layer.update()
    m = np.array(cam.matrix_world.normalized().inverted())
    frame = cam.data.view_frame(scene=scene)
    ortho = cam.data.type == "ORTHO"
    d0 = -frame[0].z
    min_x, max_x = frame[2].x, frame[1].x
    min_y, max_y = frame[1].y, frame[0].y

    def proj(P):
        L = P @ m[:3, :3].T + m[:3, 3]
        x, y = L[:, 0], L[:, 1]
        if not ortho:
            z = -L[:, 2]
            x, y = x * d0 / z, y * d0 / z
        return np.stack([(x - min_x) / (max_x - min_x), 1 - (y - min_y) / (max_y - min_y)], axis=1)

    return proj


def bbox2(P):
    return float(P[:, 0].min()), float(P[:, 0].max()), float(P[:, 1].min()), float(P[:, 1].max())


# ----------------------------------------------------------------------------- polygon geometry
def cross(o, a, b):
    return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])


def convex_hull(points):
    pts = sorted(set((round(float(x), 3), round(float(y), 3)) for x, y in points))
    if len(pts) <= 2:
        return pts
    lo, hi = [], []
    for p in pts:
        while len(lo) >= 2 and cross(lo[-2], lo[-1], p) <= 0:
            lo.pop()
        lo.append(p)
    for p in reversed(pts):
        while len(hi) >= 2 and cross(hi[-2], hi[-1], p) <= 0:
            hi.pop()
        hi.append(p)
    return lo[:-1] + hi[:-1]  # counter-clockwise in a y-up sense (shoelace area > 0)


def area(poly):
    return 0.5 * sum(poly[i][0] * poly[(i + 1) % len(poly)][1] - poly[(i + 1) % len(poly)][0] * poly[i][1]
                     for i in range(len(poly)))


def intersect(p, d, q, e):
    den = d[0] * e[1] - d[1] * e[0]
    if abs(den) < 1e-12:
        return None
    t = ((q[0] - p[0]) * e[1] - (q[1] - p[1]) * e[0]) / den
    return (p[0] + d[0] * t, p[1] + d[1] * t)


def lines_of(poly):
    n = len(poly)
    return [(poly[i], (poly[(i + 1) % n][0] - poly[i][0], poly[(i + 1) % n][1] - poly[i][1])) for i in range(n)]


def vertices_of(lines):
    n = len(lines)
    return [intersect(*lines[i - 1], *lines[i]) for i in range(n)]


def simplify_outward(poly, k=8, fixed=frozenset()):
    """Visvalingam-style reduction to <= k vertices that only ever grows the polygon.

    Removing an edge extends its two neighbours to their intersection, which adds the triangle
    between them; the cheapest edge goes first. Every remaining edge is a supporting line of the
    original hull, so the result always contains the key (a vertex-removing Visvalingam would cut
    corners off it). Edges listed in `fixed` (frame borders) are never removed."""
    lines = lines_of(poly)
    tags = [i in fixed for i in range(len(lines))]
    while len(lines) > k:
        verts = vertices_of(lines)
        best, best_cost = None, float("inf")
        n = len(lines)
        for i in range(n):
            if tags[i]:
                continue
            (p0, d0), (p1, d1), (p2, d2) = lines[i - 1], lines[i], lines[(i + 1) % n]
            X = intersect(p0, d0, p2, d2)
            if X is None:
                continue
            vi, vj = verts[i], verts[(i + 1) % n]
            # X must lie ahead of both ends and outside the removed edge, or the extension diverges.
            if (X[0] - vi[0]) * d0[0] + (X[1] - vi[1]) * d0[1] < -1e-9:
                continue
            if (X[0] - vj[0]) * d2[0] + (X[1] - vj[1]) * d2[1] > 1e-9:
                continue
            cost = abs(cross(vi, X, vj)) / 2
            if cost < best_cost:
                best, best_cost = i, cost
        if best is None:
            break
        del lines[best]
        del tags[best]
    return vertices_of(lines), lines, tags


def offset_lines(lines, tags, dist):
    out = []
    for (p, d), fixed in zip(lines, tags):
        if fixed:
            out.append((p, d))
            continue
        ln = math.hypot(*d)
        nx, ny = d[1] / ln, -d[0] / ln  # outward (right-hand) normal of a counter-clockwise polygon
        out.append(((p[0] + nx * dist, p[1] + ny * dist), d))
    return vertices_of(out)


def clip_to_rect(poly, W, H):
    """Sutherland–Hodgman against the frame; returns the clipped polygon and which edges lie on a border."""
    def clip(pts, inside, cut):
        out = []
        for i in range(len(pts)):
            a, b = pts[i - 1], pts[i]
            if inside(b):
                if not inside(a):
                    out.append(cut(a, b))
                out.append(b)
            elif inside(a):
                out.append(cut(a, b))
        return out

    def at_x(x0):
        return lambda a, b: (x0, a[1] + (b[1] - a[1]) * (x0 - a[0]) / (b[0] - a[0]))

    def at_y(y0):
        return lambda a, b: (a[0] + (b[0] - a[0]) * (y0 - a[1]) / (b[1] - a[1]), y0)

    pts = list(poly)
    for inside, cut in ((lambda p: p[0] >= 0, at_x(0)), (lambda p: p[0] <= W, at_x(W)),
                        (lambda p: p[1] >= 0, at_y(0)), (lambda p: p[1] <= H, at_y(H))):
        pts = clip(pts, inside, cut)
        if not pts:
            return [], frozenset()
    return tidy(pts), None


def tidy(pts):
    """Drop duplicate and collinear vertices (the clipper can leave both on a frame border)."""
    out = list(pts)
    changed = True
    while changed and len(out) > 3:
        changed = False
        for i in range(len(out)):
            a, b, c = out[i - 1], out[i], out[(i + 1) % len(out)]
            if math.hypot(b[0] - a[0], b[1] - a[1]) < 1e-6 or abs(cross(a, b, c)) < 1e-6:
                del out[i]
                changed = True
                break
    return out


def border_edges(poly, W, H):
    fixed = set()
    for i in range(len(poly)):
        a, b = poly[i], poly[(i + 1) % len(poly)]
        if (abs(a[0]) < 1e-6 and abs(b[0]) < 1e-6) or (abs(a[0] - W) < 1e-6 and abs(b[0] - W) < 1e-6) or \
           (abs(a[1]) < 1e-6 and abs(b[1]) < 1e-6) or (abs(a[1] - H) < 1e-6 and abs(b[1] - H) < 1e-6):
            fixed.add(i)
    return frozenset(fixed)


def key_polygons(board, proj, W, H, offset_px=3.0, min_inside=0.0):
    """Per key: hull of the cap + legends at rest and pressed, reduced to <= 8 vertices, offset outward."""
    n = S.DECK.to_3x3() @ Vector((0, 0, 1))
    normal = np.array(n) * S.PRESS_DEPTH
    keys = []
    for c in board["caps"]:
        P = world_points([c["obj"], *c["legends"]])
        both = np.vstack([P, P - normal])
        px = proj(both) * np.array([W, H])
        hull = convex_hull(px)
        full_area = abs(area(hull))
        clipped, _ = clip_to_rect(hull, W, H)
        if len(clipped) < 3:
            continue
        inside = abs(area(clipped)) / full_area if full_area else 0
        if inside < min_inside:
            continue
        if area(clipped) < 0:
            clipped = clipped[::-1]
        _, lines, tags = simplify_outward(clipped, 8, border_edges(clipped, W, H))
        poly = offset_lines(lines, tags, offset_px)
        poly = [(min(max(x, 0.0), W), min(max(y, 0.0), H)) for x, y in poly]
        s = c["slot"]
        keys.append({"s": s["i"], "c": s["cls"], "t": s["text"], "p": [[round(x, 2), round(y, 2)] for x, y in poly],
                     "inside": round(inside, 3)})
    return keys


def field_rect(keys, W, H, margin=8, snap=(2, 2)):
    xs = [p[0] for k in keys for p in k["p"]]
    ys = [p[1] for k in keys for p in k["p"]]
    sx, sy = snap
    x0 = max(0, int(math.floor((min(xs) - margin) / sx)) * sx)
    y0 = max(0, int(math.floor((min(ys) - margin) / sy)) * sy)
    x1 = min(W, int(math.ceil((max(xs) + margin) / sx)) * sx)
    y1 = min(H, int(math.ceil((max(ys) + margin) / sy)) * sy)
    return [x0, y0, x1 - x0, y1 - y0]


def sample_region(board, proj, W, H, slot, fx, fy):
    """Pixel rect inside a cap's top face, given as fractions of the face (x across, y front→back)."""
    c = board["caps"][slot]
    s, U, GAP = c["slot"], board["data"]["KEY_UNIT"], board["data"]["KEY_GAP"]
    tw = (s["width"] * U - GAP) * 0.8
    td = (U - GAP) * 0.8
    mw = c["obj"].matrix_world
    pts = [mw @ Vector((x * tw, y * td, c["h"] / 2)) for x in fx for y in fy]
    px = proj(np.array([tuple(p) for p in pts])) * np.array([W, H])
    x0, x1, y0, y1 = bbox2(px)
    return [round(x0), round(y0), round(x1), round(y1)]


# ----------------------------------------------------------------------------------- rendering
def render_to(path, border=None):
    scene = bpy.context.scene
    r = scene.render
    if border:
        W, H = r.resolution_x, r.resolution_y
        x, y, w, h = border
        r.use_border = True
        r.use_crop_to_border = True
        # Blender truncates border * size to whole pixels, so nudge each edge a quarter pixel in.
        r.border_min_x = min(1.0, (x + 0.25) / W)
        r.border_max_x = min(1.0, (x + w + 0.25) / W)
        r.border_min_y = min(1.0, (H - y - h + 0.25) / H)
        r.border_max_y = min(1.0, (H - y + 0.25) / H)
    else:
        r.use_border = False
        r.use_crop_to_border = False
    r.filepath = path
    t = time.time()
    bpy.ops.render.render(write_still=True)
    log("wrote", os.path.basename(path), f"in {time.time() - t:.1f}s")


def write_json(name, payload):
    payload = {"_copyright": "© 2026 HVNF Studios. All rights reserved. Portfolio sample — do not redistribute.", **payload}
    with open(os.path.join(OUT, name), "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=1, ensure_ascii=False)
    log("wrote", name)


# ------------------------------------------------------------------------------- shot A: hero
HERO_TARGET = Vector((0, 0.05, 0.2))
U_GRID = 17.884                       # 16 key columns + 2 margins, minus one key gap
XL, XR = 1 / U_GRID, (U_GRID - 1) / U_GRID


def place_front(cam, target, elev, dist, shift_x=0.0, shift_y=0.0):
    S.aim(cam, target, 0.0, elev, dist)
    cam.data.shift_x = shift_x
    cam.data.shift_y = shift_y
    bpy.context.view_layer.update()


def solve_hero(board, cam, W, H):
    cam.data.lens = 55
    caps = board["caps"]
    P = {i: world_points([caps[i]["obj"]]) for i in (44, 57, 75)}
    lo, hi = 2.0, 14.0
    for _ in range(48):
        mid = (lo + hi) / 2
        place_front(cam, HERO_TARGET, 40, mid)
        proj = projector(cam)
        span = bbox2(proj(P[57]))[1] - bbox2(proj(P[44]))[0]
        lo, hi = (mid, hi) if span > XR - XL else (lo, mid)
    dist = (lo + hi) / 2
    place_front(cam, HERO_TARGET, 40, dist)
    space_bottom = bbox2(projector(cam)(P[75]))[3]
    shift_y = (0.84 - space_bottom) * H / W
    place_front(cam, HERO_TARGET, 40, dist, 0.0, shift_y)
    return {"lens": 55, "elev": 40, "target": list(HERO_TARGET), "dist": round(dist, 5), "shift_y": round(shift_y, 5)}


def report(board, proj):
    caps = board["caps"]
    rep = {}
    for name, i in (("esc", 0), ("del", 13), ("caps", 44), ("pgdn", 57), ("ctrlL", 72), ("space", 75), ("right", 81)):
        rep[name] = [round(v, 4) for v in bbox2(proj(world_points([caps[i]["obj"]])))]
    rep["case"] = [round(v, 4) for v in bbox2(proj(world_points(board["layers"]["case"][:1])))]
    rep["knob"] = [round(v, 4) for v in bbox2(proj(world_points([board["knob"]])))]
    return rep


def board_shot(kind):
    """Shots A (hero), F (draft) and B (phone)."""
    reset()
    board = S.build()
    S.studio_lights()
    if kind == "draft":
        W, H, spp = 720, 300, SAMPLES or 8
    elif kind == "hero":
        W, H, spp = 2880, 1200, SAMPLES or 40
    else:
        W, H, spp = 1170, 1100, SAMPLES or 40
    S.setup_render(W, H, spp)
    cam = S.make_camera("pov", 55)
    if kind == "phone":
        camera = solve_phone(board, cam, W, H)
    else:
        camera = solve_hero(board, cam, W, H)
    proj = projector(cam)
    log("camera", camera)
    rep = report(board, proj)
    log("report", rep)
    # Outward offset of each key polygon. The spec's 3 px only covers antialiasing; a pressed key also
    # relights its neighbours' facing walls and the gaps around it, so a hard clip leaves a faint
    # outline. 10 px (2880 space; 8 px on the phone, whose keys are ~15% smaller) gives encode.mjs room
    # to feather each pressed crop's alpha from opaque at the key's hull to clear at the polygon edge.
    offset_px = {"draft": 10.0 * W / 2880, "hero": 10.0, "phone": 8.0}[kind]
    keys = key_polygons(board, proj, W, H, offset_px, min_inside=0.3 if kind == "phone" else 0.0)
    snap = (36, 6) if kind == "hero" else (2, 2)
    field = field_rect(keys, W, H, 8 if kind != "draft" else 2, snap)
    samples = {
        "enter": sample_region(board, proj, W, H, 56, (-0.40, -0.24), (-0.22, 0.22)),
        "alpha": sample_region(board, proj, W, H, 49, (-0.42, -0.26), (0.08, 0.36)),
    }
    classes = {c: [k["s"] for k in keys if k["c"] == c] for c in range(4)}
    write_json(f"{kind}.json", {"w": W, "h": H, "samples_per_pixel": spp, "camera": camera, "report": rep,
                                "offset_px": offset_px, "field": field, "classes": classes,
                                "colour_samples": samples, "keys": keys})
    render_to(os.path.join(OUT, "rest.png"))
    if REST_ONLY or kind == "draft":
        return
    for c in range(4):
        S.press(board["caps"], classes[c])
        render_to(os.path.join(OUT, f"press-{c}.png"), border=field)
    S.press(board["caps"], [])


PHONE_ELEV = 52.0


def solve_phone(board, cam, W, H):
    """Right half of the board: x = 0 (8u, through J) at 16/390 of the width and PgDn's right edge at
    374/390, so every visible key is >= 44 CSS px wide at 390 px; the bottom row's front at 0.86 H.

    The spec also asks for the F-row top at ~0.08 H by tuning the elevation, but with that width
    mapping the board's 6.25u depth spans only ~0.65 H at 52 degrees (and ~0.73 H even at 70, near a
    plan view), so both vertical targets can't hold in a 1170x1100 frame. The elevation stays at the
    spec's 52 degrees for the under-your-hands perspective; the F-row lands where it lands (reported)."""
    cam.data.lens = 55
    caps = board["caps"]
    shift_x = 0.5 - 16 / 390          # camera sits at x = 0; shifting the frame right by s puts x = 0 at 0.5 - s
    P_pgdn = world_points([caps[57]["obj"]])
    P_bottom = world_points([caps[81]["obj"]])
    P_frow = world_points([c["obj"] for c in caps if c["slot"]["row"] == 0 and c["slot"]["x"] > 0])
    lo, hi = 1.0, 12.0
    for _ in range(44):
        mid = (lo + hi) / 2
        place_front(cam, HERO_TARGET, PHONE_ELEV, mid, shift_x, 0.0)
        right = bbox2(projector(cam)(P_pgdn))[1]
        lo, hi = (mid, hi) if right > 374 / 390 else (lo, mid)
    dist = (lo + hi) / 2
    place_front(cam, HERO_TARGET, PHONE_ELEV, dist, shift_x, 0.0)
    bottom = bbox2(projector(cam)(P_bottom))[3]
    shift_y = (0.86 - bottom) * H / max(W, H)
    place_front(cam, HERO_TARGET, PHONE_ELEV, dist, shift_x, shift_y)
    top = bbox2(projector(cam)(P_frow))[2]
    return {"lens": 55, "elev": PHONE_ELEV, "target": list(HERO_TARGET), "dist": round(dist, 5),
            "shift_x": round(shift_x, 6), "shift_y": round(shift_y, 5), "frow_top": round(top, 4)}


# ------------------------------------------------------------------------------ shot C: inside
INSIDE_GAP = 0.16   # clearance between exploded layers, along the plate normal (16 mm). At 10 mm the
                    # layers read as one slab at 26 degrees and the brass sat entirely in the PCB's shadow.


def inside_shot():
    reset()
    board = S.build()
    S.studio_lights()
    # The brass weight is a mirror (roughness .10). Seen from the front-left at 26 degrees, its top
    # reflects a patch of sky 40 degrees right of straight back and 37 degrees up, where the studio
    # rig has nothing, so it read as black glass. One dim card there makes it read as brass; at ~0.2
    # irradiance it barely touches the other layers.
    card = S.add_area("brass_card", (3.1, 3.6, 3.9), 3.0, 30, (1.0, 0.97, 0.92), target=(0, 0, 0.2))
    card.visible_camera = False
    W, H, spp = 1600, 1000, SAMPLES or 40
    S.setup_render(W, H, spp)
    cam = S.make_camera("inside", 90)
    layer_pts = {lid: world_points([o for o in objs if o.type in ("MESH", "FONT")])
                 for lid, objs in board["layers"].items()}
    # Only points near the extremes along the camera's right/up axes can set the framing. The camera
    # never rolls, so a world-Z lift can't change which points those are.
    S.aim(cam, Vector((0, 0, 0)), -35.0, 26.0, 10.0)
    right = np.array(cam.matrix_world.col[0][:3])
    up = np.array(cam.matrix_world.col[1][:3])
    extreme = {}
    for lid, P in layer_pts.items():
        keep = np.zeros(len(P), dtype=bool)
        for axis in (right, up):
            d = P @ axis
            keep |= (d > d.max() - 0.03) | (d < d.min() + 0.03)
        extreme[lid] = P[keep]

    # Lifts. Scaling the spec's lifts (.30/.62/.94/1.26/1.62) by one factor until the stack fills both
    # x .05–.95 and y .06–.94 left the brass, the deepest layer, still under the case rim. So each layer
    # instead floats a fixed clearance GAP (along the plate normal) above the exploded top of the layer
    # below, starting from the case rim, and the framing fits whichever dimension binds.
    origin = np.array(S.DECK_ORIGIN)
    rot = np.array(S.DECK.to_3x3())

    def deck_z(objs):
        z = ((world_points(objs) - origin) @ rot)[:, 2]
        return float(z.min()), float(z.max())

    body = {
        "brass": board["layers"]["brass"][:1],
        "pcb": board["layers"]["pcb"][:1],          # the board itself; the knob may pass up through the plate
        "plate": board["layers"]["plate"],
        "switches": board["layers"]["switches"],
        "keycaps": [c["obj"] for c in board["caps"]],
    }
    cos_tilt = math.cos(S.INCLINE)
    lifts, top = {"case": 0.0}, S.RIM_Z
    for lid in ("brass", "pcb", "plate", "switches", "keycaps"):
        lo_z, hi_z = deck_z(body[lid])
        rise = max(0.0, top + INSIDE_GAP - lo_z)
        lifts[lid] = rise / cos_tilt
        top = hi_z + rise
    P_all = np.vstack([extreme[lid] + np.array([0, 0, lifts[lid]]) for lid in S.LAYER_IDS])
    target = Vector(tuple((P_all.min(axis=0) + P_all.max(axis=0)) / 2))

    def fit(lens):
        cam.data.lens = lens

        def solve(axis, span_wanted):
            lo, hi = 0.5, 8000.0
            for _ in range(64):
                mid = (lo + hi) / 2
                S.aim(cam, target, -35.0, 26.0, mid)
                cam.data.shift_x = cam.data.shift_y = 0.0
                b = bbox2(projector(cam)(P_all))
                span = b[1] - b[0] if axis == "x" else b[3] - b[2]
                lo, hi = (mid, hi) if span > span_wanted else (lo, mid)
            return (lo + hi) / 2

        dist = solve("x", 0.90)
        S.aim(cam, target, -35.0, 26.0, dist)
        x0, x1, y0, y1 = bbox2(projector(cam)(P_all))
        if y1 - y0 > 0.88:
            dist = solve("y", 0.88)
            S.aim(cam, target, -35.0, 26.0, dist)
            x0, x1, y0, y1 = bbox2(projector(cam)(P_all))
        cam.data.shift_x = (x0 + x1) / 2 - 0.5
        cam.data.shift_y = -((y0 + y1) / 2 - 0.5) * H / W
        bpy.context.view_layer.update()
        return dist, x1 - x0, y1 - y0

    def deviation():
        proj = projector(cam)
        worst, dys = 0.0, {}
        for lid in S.LAYER_IDS:
            P = layer_pts[lid]
            lo3, hi3 = P.min(axis=0), P.max(axis=0)
            corners = np.array([[x, y, z] for x in (lo3[0], hi3[0]) for y in (lo3[1], hi3[1]) for z in (lo3[2], hi3[2])])
            centre = (lo3 + hi3) / 2
            up = np.array([0, 0, lifts[lid]])
            rest = proj(np.vstack([corners, centre[None]])) * np.array([W, H])
            lifted = proj(np.vstack([corners + up, (centre + up)[None]])) * np.array([W, H])
            d = lifted - rest
            dy_c = d[-1, 1]
            dys[lid] = -dy_c / H * 100          # % of frame height the layer sits LOWER when assembled
            worst = max(worst, float(np.abs(d[:-1] - np.array([0.0, dy_c])).max()))
        return worst, dys

    lens = 90.0
    for _ in range(40):
        dist, fill_x, fill_y = fit(lens)
        dev, dys = deviation()
        log(f"inside fit: lens {lens:.0f} mm, dist {dist:.2f}, fill x {fill_x:.3f} y {fill_y:.3f}, corner dev {dev:.2f}px")
        if dev < 1.5:
            break
        lens *= 1.6
    camera = {"lens": round(lens, 1), "azimuth": -35, "elev": 26, "dist": round(dist, 3),
              "shift_x": round(cam.data.shift_x, 5), "shift_y": round(cam.data.shift_y, 5)}
    order = ["keycaps", "switches", "plate", "pcb", "brass", "case"]
    write_json("inside.json", {"w": W, "h": H, "camera": camera, "gap": INSIDE_GAP,
                               "lifts": {k: round(v, 4) for k, v in lifts.items()},
                               "fill": {"x": round(fill_x, 4), "y": round(fill_y, 4)},
                               "corner_deviation_px": round(dev, 3),
                               "layers": [{"id": lid, "dy": round(dys[lid], 2)} for lid in order]})

    S.lift(board, {})
    S.camera_only(board, S.LAYER_IDS, catcher=True)
    render_to(os.path.join(OUT, "assembled.png"))
    if REST_ONLY:
        return
    # Each layer alone at its exploded position (spec 11.6 C). With the other layers left in the scene
    # for their shadows, the mirror-polished brass reflected nothing but the PCB's underside and
    # rendered as black glass, and the PCB sat under a blotchy plate shadow that hid its silkscreen.
    # exploded.png below keeps the real inter-layer shadows.
    S.lift(board, lifts)
    for lid in S.LAYER_IDS:
        S.show_only(board, [lid], catcher=lid == "case")
        render_to(os.path.join(OUT, f"layer-{lid}.png"))
    S.camera_only(board, S.LAYER_IDS, catcher=True)
    render_to(os.path.join(OUT, "exploded.png"))
    # The lip: the case's front/left exterior at rest, everything else a holdout. Stacked above the
    # switches and below the keycaps it hides whatever is still inside the case, so the CSS stack's
    # assembled pose matches assembled.png and layers emerge over the rim like the real thing.
    S.lift(board, {})
    log("lip faces kept:", S.case_lip(board))
    # The desk stays in the scene but out of the camera: the metallic walls must still reflect it (with
    # no desk they mirrored the dim world and rendered black), while the lip carries no shadow pixels.
    S.show_only(board, ["case"], catcher=True)
    board["catcher"].visible_camera = False
    render_to(os.path.join(OUT, "lip.png"))
    board["catcher"].visible_camera = True


# ------------------------------------------------------------------------------- shot D: build
def build_shot():
    reset()
    board = S.build()
    S.studio_lights()
    W, H, spp = 1200, 700, SAMPLES or 40
    S.setup_render(W, H, spp)
    cam = S.make_camera("build", 70)
    P = np.vstack([world_points([o for o in board["layers"][lid] if o.type in ("MESH", "FONT")]) for lid in S.LAYER_IDS])
    target = Vector(tuple((P.min(axis=0) + P.max(axis=0)) / 2))
    lo, hi = 0.5, 40.0
    for _ in range(50):
        mid = (lo + hi) / 2
        S.aim(cam, target, 20.0, 32.0, mid)
        x0, x1, _, _ = bbox2(projector(cam)(P))
        lo, hi = (mid, hi) if x1 - x0 > 0.92 else (lo, mid)
    dist = (lo + hi) / 2
    S.aim(cam, target, 20.0, 32.0, dist)
    x0, x1, y0, y1 = bbox2(projector(cam)(P))
    cam.data.shift_x = (x0 + x1) / 2 - 0.5
    cam.data.shift_y = -((y0 + y1) / 2 - 0.5) * H / W
    bpy.context.view_layer.update()
    camera = {"lens": 70, "azimuth": 20, "elev": 32, "dist": round(dist, 4),
              "shift_x": round(cam.data.shift_x, 5), "shift_y": round(cam.data.shift_y, 5)}
    write_json("build.json", {"w": W, "h": H, "camera": camera})

    caps_objs = board["layers"]["keycaps"]
    case_side = [o for lid in ("case", "brass", "pcb", "plate", "switches") for o in board["layers"][lid]]
    # Case renders: keycaps stay in the scene for their shadows but are invisible to the camera.
    for o in caps_objs:
        o.visible_camera = False
    S.show_only(board, S.LAYER_IDS, catcher=True)
    for finish in ("graphite", "silver", "black"):
        S.apply_finish(board["M"], finish)
        render_to(os.path.join(OUT, f"case-{finish}.png"))
        if REST_ONLY:
            return
    # Caps renders: the case side is a holdout (cuts alpha, still shadows and reflects), no desk.
    S.apply_finish(board["M"], "graphite")
    for o in caps_objs:
        o.visible_camera = True
    for o in case_side:
        o.is_holdout = True
    board["catcher"].hide_render = True
    for keyset in ("classic", "yolk"):
        S.apply_keyset(board["caps"], board["M"], keyset)
        render_to(os.path.join(OUT, f"caps-{keyset}.png"))


# ------------------------------------------------------------------------------- shot E: brass
def brushed_brass(M):
    """The macro's brass: the weight's polished brass plus a fine linear grain along x (the last
    machining pass). At 100 mm a perfect mirror reads as flat printed card; streaks in the strip
    light's reflection read as metal. Fine noise stretched ~400:1 drives a faint bump and a little
    roughness variation, so the grain shows in the highlight and vanishes in the dark falloff."""
    m = M["brass"].copy()
    m.name = "brass_brushed"
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mapping = nt.nodes.new("ShaderNodeMapping")
    mapping.inputs["Scale"].default_value = (1.5, 600.0, 1.0)
    nt.links.new(tc.outputs["Object"], mapping.inputs["Vector"])
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 3.0
    noise.inputs["Detail"].default_value = 6.0
    noise.inputs["Roughness"].default_value = 0.6
    nt.links.new(mapping.outputs["Vector"], noise.inputs["Vector"])
    rough = nt.nodes.new("ShaderNodeMapRange")
    rough.inputs["From Min"].default_value = 0.3
    rough.inputs["From Max"].default_value = 0.7
    rough.inputs["To Min"].default_value = 0.07
    rough.inputs["To Max"].default_value = 0.17
    nt.links.new(noise.outputs["Fac"], rough.inputs["Value"])
    nt.links.new(rough.outputs["Result"], b.inputs["Roughness"])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.12
    bump.inputs["Distance"].default_value = 0.0005
    nt.links.new(noise.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], b.inputs["Normal"])
    return m


def brass_shot():
    reset()
    W, H, spp = 1200, 700, SAMPLES or 40
    S.setup_render(W, H, spp)
    M = S.make_materials()
    font = S.load_font()
    frame_w = 1.30                       # brass visible across the frame, in scene units
    frame_h = frame_w * H / W
    # A polished brass field, bigger than the frame.
    bm = bmesh.new()
    S.bm_box(bm, -1.4, 1.4, -1.0, 1.0, -0.05, 0.0)
    slab = S.mesh_object("brass_macro", bm, [M["brass"], M["brass_engraved"]])  # flat: it's a mirror (brushed_brass kept for reference)
    # The fixed maker's mark, small, in the lower-right corner.
    size = 0.026
    me = S.text_mesh("macro_mark", S.MACRO_MARK, font, size, 0.004, align_x="RIGHT")
    me.transform(Matrix.Translation((frame_w / 2 - 0.07, -frame_h / 2 + 0.07, -0.0015 + 0.004)))
    me.materials.append(M["brass_engraved"])
    cutter = S.link(bpy.data.objects.new("macro_cutter", me))
    cutter.hide_render = True
    cut = slab.modifiers.new("engrave", "BOOLEAN")
    cut.operation = "DIFFERENCE"
    cut.solver = "EXACT"
    cut.object = cutter
    cut.material_mode = "TRANSFER"
    # Lights: a long strip softbox overhead whose reflection lays a bright gold band across the
    # engraving field and falls off to darker bronze at the top and bottom (a uniform reflection reads
    # as matte card, not polished metal), plus a raking light from the left at 12 degrees so the
    # engraving's depth reads. The strip's reflection centres just below the field, so the band also
    # reaches toward the corner mark. The raking light can't reflect off the mirror into the camera,
    # but it lights the rough engraved letters, so the mark reads even in the darker falloff.
    # Widened (1.5 -> 2.0) and centred a touch lower so the corner mark sits in the mid-tone shoulder
    # of the band rather than the black falloff, where its letters disappeared.
    # Round 2 (fixer, idc-05): the 8 x 2 strip at z 6 mirrored across the WHOLE frame (from the camera at
    # z 3.6 a reflection covers 3.6 / 9.6 of the light's size), and the world at .35 filled the rest, so
    # the field read as one flat tan card. Now: one narrow strip whose mirror image is a bright band about
    # a third of the frame tall, centred on the engraving field (frame y .43 -> light y +.14), a dim world
    # so everything outside the band falls off to dark bronze, and the polished weight (roughness .10, the
    # copy's "mirror PVD") instead of the brushed grain, so the band's edges grade softly.
    strip = S.add_area("strip", (0.0, 0.14, 6.0), 9.0, 32, target=(0.0, 0.14, 0))
    strip.data.shape = "RECTANGLE"
    strip.data.size_y = 0.62
    # A faint, wide second card high up: a shoulder of mid-tone either side of the band, so the corner
    # mark (lower right) sits in a readable bronze rather than black.
    shoulder = S.add_area("shoulder", (0.0, -0.45, 9.0), 12.0, 34, (1.0, 0.95, 0.86), target=(0.0, -0.25, 0))
    shoulder.data.shape = "RECTANGLE"
    shoulder.data.size_y = 3.2
    S.add_area("raking", (-5.0, -0.4, 5.0 * math.tan(math.radians(12))), 0.8, 1600, (1.0, 0.96, 0.9), target=(0, 0, 0))
    world = bpy.data.worlds.new("studio")
    bpy.context.scene.world = world
    world.use_nodes = True
    env = world.node_tree.nodes.new("ShaderNodeTexEnvironment")
    env.image = bpy.data.images.load(S.datafiles("studiolights", "world", "studio.exr"))
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.06
    world.node_tree.links.new(env.outputs["Color"], world.node_tree.nodes["Background"].inputs["Color"])
    cam = S.make_camera("macro", 100)
    fov = 2 * math.atan(cam.data.sensor_width / 2 / cam.data.lens)
    dist = frame_w / 2 / math.tan(fov / 2)
    cam.location = (0, 0, dist)
    cam.rotation_euler = (0, 0, 0)
    cam.data.dof.use_dof = True
    cam.data.dof.aperture_fstop = 4.0
    cam.data.dof.focus_distance = dist
    bpy.context.view_layer.update()
    # The blank field for the visitor's engraving, and the cap height the CSS text should use: the
    # same physical size as the second line engraved on the real weight (0.05 text, DejaVu caps 0.729).
    cap_units = 0.05 * 0.729
    field = [0.08, 0.24, 0.84, 0.38]
    write_json("brass.json", {"w": W, "h": H, "camera": {"lens": 100, "fstop": 4, "dist": round(dist, 4)},
                              "frame_units": [frame_w, round(frame_h, 4)], "field": field,
                              "capHeight": round(cap_units / frame_h, 4)})
    render_to(os.path.join(OUT, "brass.png"))


# ------------------------------------------------------------------------------------- main
if SHOT in ("draft", "hero", "phone"):
    board_shot(SHOT)
elif SHOT == "inside":
    inside_shot()
elif SHOT == "build":
    build_shot()
elif SHOT == "brass":
    brass_shot()
else:
    raise SystemExit(f"unknown shot {SHOT}")
log("done")
