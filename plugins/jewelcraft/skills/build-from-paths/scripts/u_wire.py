# jewelcraft plugin: the U-wire head, four prongs from two bent wires.
# Run this whole file once per Blender session through the Blender MCP's
# execute_blender_code tool. It registers the functions in
#     bpy.app.driver_namespace["JUW"]
# and later calls use:  U = bpy.app.driver_namespace["JUW"]
#
# Each U-wire runs prong -> elbow -> straight arm -> bottom arc under the culet -> arm ->
# elbow -> prong; the two U-wires cross under the stone with a half-lap. Lines and arcs
# only, so a jeweler can bend it on a printed 1:1 template. The model keeps ONE QUARTER
# of it, "<prefix> Wire", in head-local coordinates (relative to "<prefix> Head Control";
# z = 0 is the stone's girdle plane), and the head's node group mirrors it to four.

import bpy
import json
import math
from mathutils import Vector

# The skill compares the loaded copy against this line, so bump it with every change.
U_WIRE_VERSION = "0.1.0"

ROLES = {"control": "Head Control", "gem": "Gem", "wire": "Wire", "peg": "Peg",
         "gallery": "Gallery", "gallery_profile": "Gallery Profile", "band": "Band",
         "size": "Size", "shoulder_profile": "Shoulder Profile", "head": "Head Wire",
         "casting": "Casting"}


def names(prefix, **override):
    """Object names for a design: "<prefix> <role>" unless overridden."""
    n = {k: f"{prefix} {v}" for k, v in ROLES.items()}
    n.update(override)
    return n


def design(prong_xy, tip_z, zc, wire_d=1.1, bottom_arc_r=2.0, elbow_r=1.2, arm_angle_deg=23.75):
    """Bézier control points (co, handle_left, handle_right) of the quarter path, from the
    centre of the crossing to the prong tip, and the numbers that describe it.

    prong_xy: (x, y) of one prong's axis; tip_z: height of the path's end (the prong tip,
    before the wire's rounded end); zc: height of the crossing's centre line. In the
    diagonal plane (s along the diagonal, z up): an arc of radius bottom_arc_r from the
    crossing, a straight arm arm_angle_deg below horizontal, an arc of radius elbow_r
    turning straight up, and the prong. Arc handles use the 4/3 tan(θ/4) R rule."""
    u = Vector((prong_xy[0], prong_xy[1], 0.0))
    s_a = u.length
    u.normalize()
    m = math.tan(math.radians(arm_angle_deg))
    beta = math.atan(m)
    phi = math.pi / 2 - beta
    rb, re_ = bottom_arc_r, elbow_r
    a_end = (rb * math.sin(beta), zc + rb * (1 - math.cos(beta)))
    e_s = s_a - re_ * (1 - math.cos(phi))
    if e_s <= a_end[0]:
        raise ValueError("The arm is too short for these radii: use a smaller bottom arc or elbow.")
    e_z = a_end[1] + m * (e_s - a_end[0])
    z_s = e_z + re_ * math.sin(phi)
    lp = tip_z - z_s
    if lp <= 0:
        raise ValueError("The elbow would end above the prong tip: use a flatter arm angle.")
    kb = 4 / 3 * math.tan(beta / 4) * rb
    ke = 4 / 3 * math.tan(phi / 4) * re_
    dl = (math.cos(beta), math.sin(beta))
    L = math.hypot(e_s - a_end[0], e_z - a_end[1])

    def P(s, z):
        return Vector((u.x * s, u.y * s, z))
    pts = [((0, zc), (-kb, zc), (kb, zc)),
           (a_end, (a_end[0] - kb * dl[0], a_end[1] - kb * dl[1]),
            (a_end[0] + L / 3 * dl[0], a_end[1] + L / 3 * dl[1])),
           ((e_s, e_z), (e_s - L / 3 * dl[0], e_z - L / 3 * dl[1]), (e_s + ke * dl[0], e_z + ke * dl[1])),
           ((s_a, z_s), (s_a, z_s - ke), (s_a, z_s + lp / 3)),
           ((s_a, tip_z), (s_a, tip_z - lp / 3), (s_a, tip_z + lp / 3))]
    quarter = rb * beta + L + re_ * phi + lp
    info = {"crossing_centre_z": zc, "bend_starts_z": z_s, "elbow_ends_s_z": (e_s, e_z),
            "bottom_arc_ends_s_z": a_end, "straight_arm_len": L, "quarter_path_len": quarter,
            "u_wire_len_tip_to_tip": 2 * (quarter + wire_d / 2), "prong_spacing_on_diagonal": 2 * s_a,
            "crossing_angle_deg": 2 * math.degrees(math.atan2(u.x, u.y))}
    return [tuple(P(*q) for q in p) for p in pts], info


def _lowest_z(ob, control):
    ev = ob.evaluated_get(bpy.context.evaluated_depsgraph_get())
    me = ev.to_mesh()
    M = control.matrix_world.inverted() @ ob.matrix_world
    z = min((M @ v.co).z for v in me.vertices)
    ev.to_mesh_clear()
    return z


def _set_input(obname, modname, name, value):
    ob = bpy.data.objects.get(obname)
    md = ob.modifiers.get(modname) if ob else None
    if md is None or md.node_group is None:
        return False
    it = next((i for i in md.node_group.interface.items_tree
               if getattr(i, "in_out", "") == 'INPUT' and i.name == name), None)
    if it is None:
        return False
    inputs = getattr(getattr(md, "properties", None), "inputs", None)
    if inputs is not None:
        getattr(inputs, it.identifier).value = value
    else:
        md[it.identifier] = value
    ob.update_tag(refresh={'OBJECT', 'DATA'})
    return True


def apply(prefix, culet_clearance=0.30, wire_d=1.1, bottom_arc_r=2.0, elbow_r=1.2, arm_angle_deg=23.75,
          peg_len=0.6, prong_xy=None, tip_z=None, head_modifier="Head", casting_modifier="Casting", **override):
    """Rewrite "<prefix> Wire" (the quarter path) and "<prefix> Peg" from the design numbers,
    and set Wire Diameter on the head's and the casting's modifiers to match.

    The crossing's height comes from culet_clearance (the gap between the top of the wire and
    the stone's culet). The prong's position and tip height are kept from the current wire
    unless prong_xy / tip_z are given (they must be, the first time). Hand edits to the wire
    are replaced. Returns the design numbers, with a warning when the prong bend starts less
    than 0.1 mm under the gallery."""
    n = names(prefix, **override)
    D = bpy.data
    control, gem = D.objects[n["control"]], D.objects[n["gem"]]
    wire = D.objects.get(n["wire"])
    if wire is not None and wire.data.splines and wire.data.splines[0].bezier_points:
        tip = wire.data.splines[0].bezier_points[-1].co.copy()
    elif prong_xy is None or tip_z is None:
        raise ValueError(f"{n['wire']} doesn't exist yet: pass prong_xy and tip_z.")
    else:
        tip = None
    pxy = prong_xy or (tip.x, tip.y)
    tz = tip.z if tip_z is None else tip_z
    zc = _lowest_z(gem, control) - culet_clearance - wire_d / 2
    pts, info = design(pxy, tz, zc, wire_d, bottom_arc_r, elbow_r, arm_angle_deg)
    if wire is None:
        wire = D.objects.new(n["wire"], D.curves.new(n["wire"], 'CURVE'))
        (control.users_collection[0] if control.users_collection else bpy.context.scene.collection).objects.link(wire)
        wire.parent = control
    cu = wire.data
    cu.dimensions = '3D'
    cu.splines.clear()
    sp = cu.splines.new('BEZIER')
    sp.bezier_points.add(len(pts) - 1)
    for bp, (co, hl, hr) in zip(sp.bezier_points, pts):
        bp.handle_left_type = bp.handle_right_type = 'FREE'
        bp.co, bp.handle_left, bp.handle_right = co, hl, hr
        bp.radius = 1.0                       # the node group multiplies this by Wire Diameter / 2
    peg = D.objects.get(n["peg"])
    if peg is None:
        peg = D.objects.new(n["peg"], D.curves.new(n["peg"], 'CURVE'))
        wire.users_collection[0].objects.link(peg)
        peg.parent = control
    pc = peg.data
    pc.dimensions = '3D'
    pc.splines.clear()
    ps = pc.splines.new('BEZIER')
    ps.bezier_points.add(1)
    for bp, z in zip(ps.bezier_points, (zc - 0.25, zc - wire_d / 2 - peg_len)):
        bp.co = (0.0, 0.0, z)
        bp.handle_left_type = bp.handle_right_type = 'VECTOR'
        bp.radius = 1.0
    gal = D.objects.get(n["gallery"])
    if gal is not None:
        info["gallery_bottom_z"] = _lowest_z(gal, control)
        info["bend_below_gallery"] = info["gallery_bottom_z"] - info["bend_starts_z"]
        if info["bend_below_gallery"] < 0.1:
            info["warning"] = ("The prong bend starts inside the gallery: use a flatter arm, a "
                               "smaller elbow or a lower gallery.")
    info["culet_clearance"] = culet_clearance
    info["wire_diameter_set_on"] = [f"{ob} / {md}" for ob, md in ((n["head"], head_modifier), (n["casting"], casting_modifier))
                                    if _set_input(ob, md, "Wire Diameter", wire_d)]
    wire["design"] = json.dumps({"culet_clearance": culet_clearance, "bottom_arc_r": bottom_arc_r, "elbow_r": elbow_r,
                                 "arm_angle_deg": arm_angle_deg, "wire_d": wire_d, "peg_len": peg_len})
    wire.update_tag()
    peg.update_tag()
    bpy.context.view_layer.update()

    def r(v):
        return tuple(round(x, 4) for x in v) if isinstance(v, tuple) else (round(v, 4) if isinstance(v, float) else v)
    return {k: r(v) for k, v in info.items()}


# ---------------------------------------------------------------- geometry for the template

def _bez(ob, matrix):
    return [[[list(matrix @ p.co), list(matrix @ p.handle_left), list(matrix @ p.handle_right)]
             for p in sp.bezier_points] for sp in ob.data.splines]


def _hull2d(pts):
    P = sorted(set((round(p[0], 6), round(p[1], 6)) for p in pts))

    def cr(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lo, up = [], []
    for p in P:
        while len(lo) >= 2 and cr(lo[-2], lo[-1], p) <= 0:
            lo.pop()
        lo.append(p)
    for p in reversed(P):
        while len(up) >= 2 and cr(up[-2], up[-1], p) <= 0:
            up.pop()
        up.append(p)
    return lo[:-1] + up[:-1]


def _points(ob, matrix):
    ev = ob.evaluated_get(bpy.context.evaluated_depsgraph_get())
    me = ev.to_mesh()
    pts = [matrix @ v.co for v in me.vertices]
    ev.to_mesh_clear()
    return pts


def _input(obname, modname, name):
    md = bpy.data.objects[obname].modifiers[modname]
    it = next(i for i in md.node_group.interface.items_tree if getattr(i, "in_out", "") == 'INPUT' and i.name == name)
    inputs = getattr(getattr(md, "properties", None), "inputs", None)
    return getattr(inputs, it.identifier).value if inputs is not None else md[it.identifier]


def geometry(prefix, ring_size=None, alloy=None, band_profile=None, head_modifier="Head", casting_modifier="Casting",
             **override):
    """Everything the template generator draws, in head-local mm (z = 0 at the girdle):
    the wire, peg and gallery paths, the gallery and shoulder profiles, the girdle
    outline, the band, the casting's seat settings and the design numbers recovered from
    the wire. ring_size ("US 8"; the helpers' ring_size() gives it) and band_profile
    ("comfort fit") label the band, alloy ("18K yellow") the cut list. The band is read in
    ring coordinates: centre at the origin, finger along Y, head up Z."""
    n = names(prefix, **override)
    D = bpy.data
    control = D.objects[n["control"]]
    Hinv = control.matrix_world.inverted()
    wire, peg, gal, gem = D.objects[n["wire"]], D.objects[n["peg"]], D.objects[n["gallery"]], D.objects[n["gem"]]
    bp = wire.data.splines[0].bezier_points
    tip, c0, a_end, e_end, bend = bp[-1].co, bp[0].co, bp[1].co, bp[2].co, bp[3].co
    s_a = math.hypot(tip.x, tip.y)
    u = (tip.x / s_a, tip.y / s_a)

    def s_of(p):
        return p.x * u[0] + p.y * u[1]
    m = (e_end.z - a_end.z) / (s_of(e_end) - s_of(a_end))
    beta = math.atan(m)
    phi = math.pi / 2 - beta
    gem_pts = _points(gem, Hinv @ gem.matrix_world)
    gal_pts = _points(gal, Hinv @ gal.matrix_world)
    prof = D.objects[n["gallery_profile"]].data.splines[0]
    gp = [list(p.co[:2]) for p in prof.points]
    sprof = D.objects.get(n["shoulder_profile"])
    band = D.objects.get(n["band"])
    hz = control.matrix_world.translation.z
    wire_d = _input(n["head"], head_modifier, "Wire Diameter")
    data = {
        "title": f"{prefix} wire head", "prefix": prefix, "alloy": alloy,
        "source": bpy.path.basename(bpy.data.filepath),
        "objects": [n["wire"], n["peg"], n["gallery"]],
        "wire": _bez(wire, wire.matrix_local), "peg": _bez(peg, peg.matrix_local),
        "gallery": _bez(gal, Hinv @ gal.matrix_world),
        "gallery_profile": gp,
        "gallery_size": [max(p[0] for p in gp) - min(p[0] for p in gp), max(p[1] for p in gp) - min(p[1] for p in gp)],
        "gallery_z": [min(p.z for p in gal_pts), max(p.z for p in gal_pts)],
        "girdle_hull": [list(p) for p in _hull2d([(p.x, p.y) for p in gem_pts])],
        "gem_z": [min(p.z for p in gem_pts), max(p.z for p in gem_pts)],
        "params": {"zc": c0.z, "Rb": s_of(a_end) / math.sin(beta), "Re": (s_a - s_of(e_end)) / (1 - math.cos(phi)),
                   "m": m, "z_bend": bend.z, "sA": s_a, "u": list(u), "T_z": tip.z},
        "wire_d": wire_d, "peg_d": _input(n["head"], head_modifier, "Peg Diameter"),
        "seat_gap": _input(n["casting"], casting_modifier, "Seat Gap"),
        "allowance": _input(n["casting"], casting_modifier, "Filing Allowance"),
        "dimple_d": _input(n["casting"], casting_modifier, "Dimple Diameter"),
        "dimple_depth": _input(n["casting"], casting_modifier, "Dimple Depth"),
    }
    data["culet_clearance"] = data["gem_z"][0] - (c0.z + wire_d / 2)
    if sprof is not None:
        sp_pts = [p.co for p in sprof.data.splines[0].points]
        data["shoulder_width"] = max(p[0] for p in sp_pts) - min(p[0] for p in sp_pts)
    if band is not None:
        bpts = _points(band, band.matrix_world)
        top = [p for p in bpts if abs(p.x) < 0.5 and p.z > 0]
        r_out = max(math.hypot(p.x, p.z) for p in bpts)
        r_in = min(math.hypot(p.x, p.z) for p in top) if top else None
        data["band"] = {"width": max(p.y for p in bpts) - min(p.y for p in bpts),
                        "thickness_at_top": (r_out - r_in) if r_in else None,
                        "inside_diameter": 2 * r_in if r_in else None, "size": ring_size,
                        "profile": band_profile}
        data["band_top_centre_z"] = r_out - hz
    return data


def export_geometry(path, prefix, ring_size=None, **kw):
    data = geometry(prefix, ring_size=ring_size, **kw)
    with open(path, "w") as f:
        json.dump(data, f, indent=1)
    return {"file": path, "params": {k: round(v, 4) if isinstance(v, float) else v for k, v in data["params"].items()}}


bpy.app.driver_namespace["JUW"] = {
    k: v for k, v in globals().items() if callable(v) and not k.startswith("_")} | {
    "U_WIRE_VERSION": U_WIRE_VERSION, "ROLES": ROLES}
result = {"u_wire_version": U_WIRE_VERSION, "registered": sorted(bpy.app.driver_namespace["JUW"])}
print(result)
