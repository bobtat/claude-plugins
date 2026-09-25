# jewelcraft plugin helpers.
# Run this whole file once per Blender session through the Blender MCP's
# execute_blender_code tool. It registers the helpers in
#     bpy.app.driver_namespace["JC"]
# and later calls use:  H = bpy.app.driver_namespace["JC"]
# Nothing in this file changes the user's scene except temporary objects that
# are created in a temporary collection and removed before each helper returns.

import bpy
import bmesh
import json
import math
import sys
import importlib
import addon_utils
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

# The skills compare the loaded copy against this line, so bump it with every change.
HELPERS_VERSION = "0.2.0"

# Densities (g/cm3) and compositions from JewelCraft 2.18.1's default weighting list;
# used only when the current scene's list is empty. The composition matters: other
# alloys sold under the same name differ by several percent (Pt950/Ir is 21.45).
DEFAULT_DENSITIES = [
    ("Yellow Gold 24K", 19.32, "Au 99.9%"),
    ("Yellow Gold 22K", 17.86, "Au 91.6%, Ag 4.9%, Cu 3.5%"),
    ("Yellow Gold 18K", 15.53, "Au 75.3%, Ag 16.5%, Cu 6.7%, Zn 1.5%"),
    ("Yellow Gold 14K", 13.05, "Au 58.4%, Ag 9.8%, Cu 28%, Zn 3.8%"),
    ("Yellow Gold 10K", 11.47, "Au 41.7%, Ag 11.2%, Cu 40.5%, Zn 6.6%"),
    ("White Gold 18K Pd", 15.66, "Au 78.7%, Cu 8.3%, Pd 13%"),
    ("White Gold 18K Ni", 14.69, "Au 75.15%, Cu 8.75%, Ni 12%, Zn 4.1%"),
    ("White Gold 14K Pd", 14.60, "Au 58.55%, Cu 7.2%, Ag 20%, Pd 13.5%, Zn 0.75%"),
    ("White Gold 14K Ni", 12.61, "Au 58.43%, Cu 21%, Ni 12.73%, Zn 7.84%"),
    ("White Gold 10K", 10.99, "Au 41.7%, Cu 35.7%, Ni 10.3%, Zn 12.3%"),
    ("Rose Gold 18K", 15.02, "Au 75.3%, Cu 23.3%, Ag 1.2%, Zn 0.2%"),
    ("Rose Gold 14K", 13.03, "Au 58.4%, Cu 39.2%, Ag 2%, Zn 0.4%"),
    ("Rose Gold 10K", 11.52, "Au 41.5%, Cu 55%, Ag 3%, Zn 0.5%"),
    ("Platinum 950", 20.70, "Pt 95%, Ru 5%"),
    ("Platinum 900", 21.54, "Pt 90%, Ir 10%"),
    ("Palladium 950", 12.16, "Pd 95%, Ru 5%"),
    ("Silver Sterling", 10.36, "Ag 92.5%, Cu 7.5%"),
]


# ---------------------------------------------------------------- add-on / context

def addon_name():
    """Module name of JewelCraft, preferring the enabled copy when a legacy add-on and
    an extension are both installed."""
    def is_jc(name):
        return name.rsplit(".", 1)[-1].lower() == "jewelcraft"
    enabled = [k for k in bpy.context.preferences.addons.keys() if is_jc(k)]
    if enabled:
        return enabled[0]
    return next((m.__name__ for m in addon_utils.modules() if is_jc(m.__name__)), None)


def jc(sub):
    """Import a JewelCraft submodule, e.g. jc('.lib.gemlib')."""
    name = addon_name()
    if not name:
        raise RuntimeError("JewelCraft is not installed in this Blender.")
    return importlib.import_module(name + sub)


def jc_version():
    name = addon_name()
    if not name or name not in sys.modules:
        return None
    return tuple(addon_utils.module_bl_info(sys.modules[name])["version"])


def ctx():
    """Override dict for operators that need a 3D Viewport, or None."""
    for w in bpy.context.window_manager.windows:
        for a in w.screen.areas:
            if a.type == 'VIEW_3D':
                r = next((r for r in a.regions if r.type == 'WINDOW'), None)
                if r:
                    return dict(window=w, area=a, region=r)
    return None


def select_only(*obs, active=None):
    vl = bpy.context.view_layer
    for o in vl.objects:
        o.select_set(False)
    for o in obs:
        o.select_set(True)
    vl.objects.active = active or obs[0]


def get(name):
    ob = bpy.data.objects.get(name)
    if ob is None:
        raise KeyError(f"No object named {name!r}")
    return ob


# ---------------------------------------------------------------- geometry basics

def eval_bm(ob, matrix=None):
    """BMesh of the evaluated object (mesh, curve, text or metaball), transformed by
    `matrix` (default: world)."""
    dg = bpy.context.evaluated_depsgraph_get()
    ob_eval = ob.evaluated_get(dg)
    bm = bmesh.new()
    me = ob_eval.to_mesh()
    if me is not None:
        bm.from_mesh(me)
    ob_eval.to_mesh_clear()
    m = matrix if matrix is not None else ob.matrix_world
    bm.transform(m)
    # A mirroring matrix turns the faces inside out; flip them back so normals and
    # signed volume describe the shape, not the transform.
    if m.to_3x3().determinant() < 0:
        bmesh.ops.reverse_faces(bm, faces=bm.faces[:])
    return bm


def volume_nm(ob):
    """(volume mm3, signed volume, non-manifold edge count) of the evaluated mesh."""
    bm = eval_bm(ob)
    v = bm.calc_volume(signed=False)
    vs = bm.calc_volume(signed=True)
    nm = sum(1 for e in bm.edges if not e.is_manifold)
    bm.free()
    return v, vs, nm


def min_wall(ob):
    """Minimum wall thickness: ray from each face centre inward to the opposite wall.
    Needs outward normals. Samples face centres only."""
    bm = eval_bm(ob)
    bm.normal_update()
    tree = BVHTree.FromBMesh(bm)
    best, where = None, None
    for f in bm.faces:
        c, n = f.calc_center_median(), f.normal
        hit = tree.ray_cast(c - n * 1e-4, -n)
        if hit[0] is not None:
            d = (hit[0] - c).length
            if best is None or d < best:
                best, where = d, tuple(round(x, 3) for x in c)
    bm.free()
    return best, where


def hull2d(pts):
    P = sorted(set((round(p[0], 6), round(p[1], 6)) for p in pts))
    if len(P) < 3:
        return P

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


def dist_to_hull(pt, H):
    """Signed distance from a 2D point to a convex hull: + outside, - inside."""
    best, inside = 1e9, True
    n = len(H)
    for i in range(n):
        a, b = H[i], H[(i + 1) % n]
        ax, ay = b[0] - a[0], b[1] - a[1]
        px, py = pt[0] - a[0], pt[1] - a[1]
        if ax * py - ay * px < 0:
            inside = False
        t = max(0.0, min(1.0, (px * ax + py * ay) / (ax * ax + ay * ay)))
        best = min(best, math.hypot(px - t * ax, py - t * ay))
    return -best if inside else best


def gem_frame(gem):
    """Gem location + rotation, no scale. Gem girdle lies on this frame's z=0."""
    loc, rot, _ = gem.matrix_world.decompose()
    return Matrix.LocRotScale(loc, rot, None)


def slice_components(ob, frame, z=0.0):
    """Cut `ob` with the plane z (in `frame` coordinates). Returns a list of point
    lists, one per connected cross-section loop."""
    bm = eval_bm(ob, frame.inverted() @ ob.matrix_world)
    res = bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:],
                                 plane_co=(0, 0, z), plane_no=(0, 0, 1))
    cut_verts = [g for g in res["geom_cut"] if isinstance(g, bmesh.types.BMVert)]
    cut_edges = [g for g in res["geom_cut"] if isinstance(g, bmesh.types.BMEdge)]
    idx = {v: i for i, v in enumerate(cut_verts)}
    parent = list(range(len(cut_verts)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for e in cut_edges:
        a, b = e.verts
        if a in idx and b in idx:
            parent[find(idx[a])] = find(idx[b])
    groups = {}
    for v, i in idx.items():
        groups.setdefault(find(i), []).append((v.co.x, v.co.y))
    bm.free()
    return list(groups.values())


def girdle_hull(gem):
    bm = eval_bm(gem, gem_frame(gem).inverted() @ gem.matrix_world)
    pts = [(v.co.x, v.co.y) for v in bm.verts]
    bm.free()
    return hull2d(pts)


# ---------------------------------------------------------------- temporary objects

class TempObjects:
    """Context manager: evaluated copies in a temporary collection, removed on exit."""

    def __enter__(self):
        self.coll = bpy.data.collections.new("JC_TMP")
        bpy.context.scene.collection.children.link(self.coll)
        self.obs, self.colls = [], []
        return self

    def copy_eval(self, ob, name="JC_TMP", matrix=None, coll=None):
        """Mesh copy of the evaluated object with its world transform baked in, so
        shear from parents and mirroring survive the copy."""
        bm = eval_bm(ob, matrix)
        me = bpy.data.meshes.new(name)
        bm.to_mesh(me)
        bm.free()
        c = bpy.data.objects.new(name, me)
        (coll or self.coll).objects.link(c)
        self.obs.append(c)
        return c

    def sub_collection(self, name="JC_TMP_OPERANDS"):
        coll = bpy.data.collections.new(name)
        self.coll.children.link(coll)
        self.colls.append(coll)
        return coll

    def copy_without_cutter(self, ob, cutter, name="JC_TMP"):
        """Copy of `ob` that keeps its modifiers (curve wrap, Solidify, Mirror...) except
        the Booleans that cut with `cutter`."""
        c = ob.copy()
        c.data = ob.data.copy()
        c.name = name
        for md in list(c.modifiers):
            if md.type == 'BOOLEAN' and (md.object == cutter or (
                    md.operand_type == 'COLLECTION' and md.collection is not None
                    and cutter.name in md.collection.all_objects)):
                c.modifiers.remove(md)
        self.coll.objects.link(c)
        self.obs.append(c)
        return c

    def __exit__(self, *exc):
        datas = [o.data for o in self.obs if o.data is not None]
        for o in self.obs:
            bpy.data.objects.remove(o, do_unlink=True)
        bpy.data.batch_remove([d for d in datas if d.users == 0])
        for coll in self.colls:
            bpy.data.collections.remove(coll)
        bpy.data.collections.remove(self.coll)
        # Without this, view_layer.objects can briefly yield None entries.
        bpy.context.view_layer.update()
        return False


def _boolean(target, op, other=None, collection=None):
    md = target.modifiers.new("JC_" + op, 'BOOLEAN')
    md.operation = op
    md.solver = 'EXACT'
    # Without self-intersection handling, a part that overlaps itself (a head joined
    # into the band) is counted twice or gives an undefined result.
    md.use_self = True
    if collection is not None:
        md.operand_type = 'COLLECTION'
        md.collection = collection
    else:
        md.object = other
    return md


def overlap_volume(a, b, matrix_a=None, matrix_b=None):
    """Volume (mm3) of a ∩ b, using evaluated copies. 0 = no collision."""
    with TempObjects() as t:
        ca, cb = t.copy_eval(a, matrix=matrix_a), t.copy_eval(b, matrix=matrix_b)
        cb.hide_set(True)
        _boolean(ca, 'INTERSECT', other=cb)
        bpy.context.view_layer.update()
        v, _, _ = volume_nm(ca)
    return v


def union_stats(obs):
    """(volume, non-manifold edges) of the union of evaluated copies of `obs`. Also
    resolves overlaps inside each object, including when there is only one."""
    with TempObjects() as t:
        base = t.copy_eval(obs[0])
        ops = t.sub_collection()
        for o in obs[1:]:
            t.copy_eval(o, coll=ops).hide_set(True)
        _boolean(base, 'UNION', collection=ops)
        bpy.context.view_layer.update()
        v, _, nm = volume_nm(base)
    return v, nm


# ---------------------------------------------------------------- actions

def check_setup():
    s = bpy.context.scene
    u = s.unit_settings
    issues, notes = [], []
    name = addon_name()
    ver = jc_version()
    enabled = bool(name) and addon_utils.check(name)[1]
    if not name:
        issues.append("JewelCraft is not installed.")
    elif not enabled:
        issues.append("JewelCraft is installed but not enabled.")
    elif ver and ver[0] >= 3:
        issues.append("JewelCraft 3.x: use the 3.x notes (references/jewelcraft-3x.md); "
                      "the 2.18 prong/cutter recipe will not work.")
    mm_ok = (u.system == 'METRIC' and abs(u.scale_length - 0.001) < 1e-7)
    if not mm_ok:
        issues.append("Scene units are not 1 unit = 1 mm (metric, scale 0.001).")
    if not bpy.data.is_saved:
        issues.append("The file has never been saved: ask the user to save before experiments.")
    elif bpy.data.is_dirty:
        # Creating and removing the helpers' own temporary objects can set this too, so
        # it can't block every check; the skills ask once per session instead.
        notes.append("The file has unsaved changes (the helpers' temporary objects can also "
                     "mark it modified).")
    if bpy.context.mode != 'OBJECT':
        issues.append(f"Blender is in {bpy.context.mode} mode: measurements read the last "
                      "Object Mode state. Ask the user to switch to Object Mode.")
    if ctx() is None:
        issues.append("No 3D Viewport found: operators that need one will fail.")
    wm = []
    try:
        wm = list(s.jewelcraft.weighting_materials.coll)
    except Exception:
        pass
    if name and not wm:
        issues.append("This scene has no weighting materials; weights will use built-in defaults.")
    gems = [o for o in s.objects if "gem" in o]
    return {
        "blender": bpy.app.version_string,
        "jewelcraft": {"module": name, "version": ver, "enabled": enabled},
        "file": {"path": bpy.data.filepath, "saved": bpy.data.is_saved, "dirty": bpy.data.is_dirty},
        "units": {"system": u.system, "length_unit": u.length_unit,
                  "scale_length": round(u.scale_length, 6), "one_unit_is_mm": mm_ok},
        "scene": s.name, "gems_in_scene": len(gems), "weighting_materials": len(wm),
        "helpers_version": HELPERS_VERSION, "issues": issues, "notes": notes,
    }


def _gems():
    """(label, gem object, world matrix) for every visible gem, including gems placed
    by collection, particle or geometry-node instancing. Mirrors JewelCraft's own
    iter_gems, so both see the same stones."""
    out = []
    for dup in bpy.context.evaluated_depsgraph_get().object_instances:
        if dup.is_instance:
            ob, instancer = dup.instance_object.original, dup.parent.original
        else:
            ob = instancer = dup.object.original
        if "gem" not in ob or ob.type != 'MESH' or not instancer.visible_get():
            continue
        label = ob.name if not dup.is_instance else f"{ob.name} [{instancer.name} #{dup.persistent_id[0]}]"
        out.append((label, ob, dup.matrix_world.copy()))
    return out


def _gem_dims(ob, M):
    bb = ob.bound_box
    s = M.to_scale()
    return Vector(((bb[4][0] - bb[0][0]) * abs(s.x), (bb[3][1] - bb[0][1]) * abs(s.y),
                   (bb[1][2] - bb[0][2]) * abs(s.z)))


def gems_in_scene():
    gemlib = jc(".lib.gemlib")
    out = []
    for label, o, M in _gems():
        cut, stone = o["gem"]["cut"], o["gem"]["stone"]
        d = tuple(round(x, 2) for x in _gem_dims(o, M))
        out.append({"name": label, "cut": cut, "stone": stone, "dims_xyz": d,
                    "ct": gemlib.ct_calc(stone, cut, d),
                    "location": tuple(round(x, 3) for x in M.translation)})
    return out


def stone_overlaps(threshold=0.1):
    """Pairs of stones that overlap or are closer than `threshold` mm, measured on the
    meshes. JewelCraft's own check treats each stone as a circle of half its larger
    side, which misses the corners of square and emerald cuts, and it only compares
    stones whose centres are within 4 mm."""
    gems = _gems()
    trees, bms, rads = [], [], []
    for _, o, M in gems:
        bm = eval_bm(o, M)
        trees.append(BVHTree.FromBMesh(bm))
        bms.append(bm)
        rads.append(_gem_dims(o, M).length / 2)
    flagged = []
    for i in range(len(gems)):
        for j in range(i + 1, len(gems)):
            dist = (gems[i][2].translation - gems[j][2].translation).length
            if dist > rads[i] + rads[j] + threshold:
                continue
            row = {"a": gems[i][0], "b": gems[j][0], "centre_distance_mm": round(dist, 3)}
            if trees[i].overlap(trees[j]):
                row["overlap_mm3"] = round(overlap_volume(gems[i][1], gems[j][1],
                                                          gems[i][2], gems[j][2]), 4)
                flagged.append(row)
                continue
            gap = min(min(t.find_nearest(v.co)[3] for v in bm.verts)
                      for t, bm in ((trees[j], bms[i]), (trees[i], bms[j])))
            if gap < threshold:
                row["gap_mm"] = round(gap, 4)
                flagged.append(row)
    for bm in bms:
        bm.free()
    return flagged


def stone_report(check_overlaps=True):
    """JewelCraft's design-report data without writing a file or opening a browser,
    plus a mesh-based overlap check that covers what JewelCraft's own check misses."""
    rg = jc(".operators.design_report.report_get")
    rf = jc(".operators.design_report.report_fmt")
    gt = jc(".lib.gettext")
    rep = rg.data_collect(show_warnings=True)
    rf.data_format(rep, gt.GetText("en_US").gettext, False)
    data = rep.asdict()
    result = {"warnings": list(data.get("warnings", [])),
              "gems": data.get("gems", []),
              "total_ct": round(sum(g["ct_sum"] for g in data.get("gems", [])), 3)}
    if check_overlaps:
        result["stone_overlaps"] = stone_overlaps()
    return result


# Notch (seat) depth as a fraction of prong thickness. Bench guidance is 30-50%
# (Stuller); JewelCraft's own square-cushion preset gives 23.5%, below that range.
MIN_BITE_FRAC = 0.30


def corner_prong_settings(L, W, d, bite_frac=0.33):
    """position/intersection for 4 corner prongs (number=2, use_symmetry=True) on a
    cushion stretched to L (Y) x W (X), giving each prong a notch of bite_frac x d."""
    bite = bite_frac * d
    theta = math.atan(W / L)
    R = 0.3945 * math.hypot(L, W) + d / 2 - bite
    return {"position_rad": theta, "position_deg": round(math.degrees(theta), 2),
            "intersection": round((L / 2 + d / 2 - R) / d * 100, 2), "bite_mm": round(bite, 3)}


def prong_report(gem, prongs, prong_diameter=None):
    """How each prong meets the stone's girdle. bite > 0 = prong overlaps the girdle
    (the notch depth); bite < 0 = gap. Bench guidance is 30-50% of the prong's
    thickness. `prong_diameter` (the prong setting) is used for the suggested corner
    settings; tapered prongs are thicker at the girdle than their setting."""
    gem, prongs = (get(gem) if isinstance(gem, str) else gem), (get(prongs) if isinstance(prongs, str) else prongs)
    frame = gem_frame(gem)
    hull = girdle_hull(gem)
    rows = []
    for pts in slice_components(prongs, frame, 0.0):
        if len(pts) < 3:
            continue
        cx = sum(p[0] for p in pts) / len(pts)
        cy = sum(p[1] for p in pts) / len(pts)
        r = sum(math.hypot(p[0] - cx, p[1] - cy) for p in pts) / len(pts)
        dd = dist_to_hull((cx, cy), hull)
        rows.append({"centre": (round(cx, 3), round(cy, 3)),
                     "angle_from_+Y_deg": round(math.degrees(math.atan2(cx, cy)), 1),
                     "diameter_mm": round(2 * r, 3), "bite_mm": round(r - dd, 3),
                     "bite_pct_of_diameter": round((r - dd) / (2 * r) * 100, 1)})
    rows.sort(key=lambda x: x["angle_from_+Y_deg"])
    out = {"gem": gem.name, "gem_dims_xyz": tuple(round(x, 3) for x in gem.dimensions),
           "prongs_at_girdle": rows}
    notes = []
    if not rows:
        notes.append("No prong crosses the girdle plane.")
    elif any(r["bite_mm"] <= 0 for r in rows):
        notes.append("At least one prong does not touch the girdle.")
    elif any(r["bite_pct_of_diameter"] < MIN_BITE_FRAC * 100 for r in rows):
        notes.append("At least one prong grips less than 30% of its thickness, under the "
                     "30-50% bench range.")
    if rows:
        bm = eval_bm(gem, frame.inverted() @ gem.matrix_world)
        crown = max(v.co.z for v in bm.verts)
        bm.free()
        bm = eval_bm(prongs, frame.inverted() @ prongs.matrix_world)
        for r in rows:
            r["tip_above_girdle_mm"] = 0.0
        for v in bm.verts:
            if v.co.z > 0:
                r = min(rows, key=lambda r: math.hypot(v.co.x - r["centre"][0],
                                                       v.co.y - r["centre"][1]))
                r["tip_above_girdle_mm"] = max(r["tip_above_girdle_mm"], round(v.co.z, 3))
        bm.free()
        out["crown_height_mm"] = round(crown, 3)
        if any(r["tip_above_girdle_mm"] < crown / 2 for r in rows):
            notes.append("At least one prong tip is below halfway up the crown, too short to "
                         "fold over the stone.")
    if notes:
        out["note"] = " ".join(notes)
    L, W = gem.dimensions.y, gem.dimensions.x
    if gem["gem"]["cut"] == "CUSHION" and rows:
        d = prong_diameter or sum(r["diameter_mm"] for r in rows) / len(rows)
        out["suggested_corner_settings"] = corner_prong_settings(L, W, d)
    return out


def seat_report(gem, cutter, metal=None):
    """Checks a cutter against its stone and, if given, the seated metal."""
    gem = get(gem) if isinstance(gem, str) else gem
    cutter = get(cutter) if isinstance(cutter, str) else cutter
    frame = gem_frame(gem)
    ghull = girdle_hull(gem)
    comps = slice_components(cutter, frame, 0.0)
    pts = [p for c in comps for p in c]
    out = {"gem": gem.name, "cutter": cutter.name}
    if len(pts) < 3:
        out["note"] = "Cutter does not cross the girdle plane."
        return out
    chull = hull2d(pts)
    xs, ys = [p[0] for p in chull], [p[1] for p in chull]
    gem_out = max(dist_to_hull(p, chull) for p in ghull)
    gaps = [dist_to_hull(p, ghull) for p in chull]
    out["cutter_at_girdle_W_L"] = (round(max(xs) - min(xs), 3), round(max(ys) - min(ys), 3))
    out["gem_W_L"] = (round(gem.dimensions.x, 3), round(gem.dimensions.y, 3))
    out["stone_inside_cutter"] = gem_out <= 0
    out["min_clearance_mm"] = round(-gem_out, 3)
    out["max_gap_mm"] = round(max(gaps), 3)
    ratio_c = out["cutter_at_girdle_W_L"][0] / out["cutter_at_girdle_W_L"][1]
    ratio_g = gem.dimensions.x / gem.dimensions.y
    if abs(ratio_c - ratio_g) > 0.05:
        out["note"] = (f"Cutter proportions ({ratio_c:.2f}) don't match the stone ({ratio_g:.2f}). "
                       "For a stretched square-shaped cut, scale the cutter's X by W/L.")
    if metal is not None:
        metal = get(metal) if isinstance(metal, str) else metal
        v, _, nm = volume_nm(metal)
        out["metal_volume_mm3"] = round(v, 3)
        out["metal_nonmanifold_edges"] = nm
        out["stone_metal_overlap_mm3"] = round(overlap_volume(gem, metal), 4)
        with TempObjects() as t:
            raw = t.copy_without_cutter(metal, cutter)
            raw.hide_set(True)
            bpy.context.view_layer.update()
            out["control_overlap_without_seat_mm3"] = round(overlap_volume(gem, raw), 4)
    return out


def densities():
    try:
        coll = list(bpy.context.scene.jewelcraft.weighting_materials.coll)
    except Exception:
        coll = []
    if coll:
        return [(m.name, m.density, getattr(m, "composition", ""))
                for m in coll if m.enabled], "scene"
    return DEFAULT_DENSITIES, "built-in defaults"


def weigh(objs, union=True):
    obs = [get(o) if isinstance(o, str) else o for o in objs]
    parts = []
    for o in obs:
        v, vs, nm = volume_nm(o)
        parts.append({"name": o.name, "volume_mm3": round(v, 3), "nonmanifold_edges": nm,
                      "inside_out": vs < 0})
    raw = sum(p["volume_mm3"] for p in parts)
    if union:
        vol, nm = union_stats(obs)
    else:
        vol, nm = raw, sum(p["nonmanifold_edges"] for p in parts)
    dens, src = densities()
    return {"parts": parts, "sum_of_parts_mm3": round(raw, 3),
            "volume_mm3": round(vol, 3), "overlap_counted_twice_mm3": round(raw - vol, 3),
            "result_nonmanifold_edges": nm, "densities_from": src,
            "weights_g": [{"alloy": n, "composition": c, "g": round(vol * d / 1000, 2)}
                          for n, d, c in dens]}


def _fit_circle(S):
    import numpy as np
    A = np.c_[2 * S, np.ones(len(S))]
    sol, *_ = np.linalg.lstsq(A, (S ** 2).sum(1), rcond=None)
    c = sol[:2]
    return c, math.sqrt(max(sol[2] + c @ c, 0.0))


def _inner_circle(Q, nb=180):
    """Circle through the innermost point of each angular bin of the 2D points Q.
    Bins the band leaves empty get filled by head or prong points, so outliers are
    rejected repeatedly, not once: after one pass the centre is still pulled toward
    the head and the head points survive."""
    import numpy as np
    c = (Q.max(0) + Q.min(0)) / 2
    for _ in range(10):
        d = Q - c
        ang = np.arctan2(d[:, 1], d[:, 0])
        rad = np.hypot(d[:, 0], d[:, 1])
        bins = ((ang + np.pi) / (2 * np.pi) * nb).astype(int) % nb
        S = np.array([Q[m[np.argmin(rad[m])]]
                      for m in (np.where(bins == b)[0] for b in range(nb)) if len(m)])
        keep = np.ones(len(S), bool)
        for _ in range(30):
            cf, r = _fit_circle(S[keep])
            res = np.abs(np.hypot(*(S - cf).T) - r)
            new = res < max(3 * float(np.median(res[keep])), 0.02)
            if new.sum() < 12 or (new == keep).all():
                break
            keep = new
        moved = float(np.hypot(*(cf - c)))
        c = cf
        if moved < 1e-6:
            break
    res = np.abs(np.hypot(*(S[keep] - c).T) - r)
    return c, r, S, keep, float(np.median(res))


def _ring_fit(band):
    """Best inner-circle fit over candidate ring axes (the object's local axes and
    the principal axes of its vertices). A wrong axis projects the band edge-on and
    fits badly, so the candidate with the smallest median residual wins."""
    import numpy as np
    bm = eval_bm(band)
    P = np.array([v.co[:] for v in bm.verts])
    bm.free()
    M = band.matrix_world.to_3x3()
    cands = [np.array(M.col[k].normalized()) for k in range(3) if M.col[k].length > 1e-9]
    _, V = np.linalg.eigh(np.cov((P - P.mean(0)).T))
    for k in range(3):
        v = V[:, k]
        if all(abs(v @ w) < 0.9999 for w in cands):
            cands.append(v)
    best = None
    for n in cands:
        u = np.cross(n, [1.0, 0, 0] if abs(n[0]) < 0.9 else [0, 1.0, 0])
        u /= np.linalg.norm(u)
        w = np.cross(n, u)
        Q = P @ np.c_[u, w]
        c, r, S, keep, med = _inner_circle(Q)
        if best is None or med < best["median_residual"] - 1e-9:
            rad_all = np.hypot(*(Q - c).T)
            centre = u * c[0] + w * c[1] + n * float(np.median(P @ n))
            best = {"axis": n, "centre": centre, "r": r, "median_residual": med,
                    "max_dev": float(np.max(np.abs(np.hypot(*(S[keep] - c).T) - r))),
                    "rejected": int((~keep).sum()), "min_opening_r": float(rad_all.min())}
    return best


def finger_clearance(ob, band):
    """How far `ob` (a stone's culet, a gallery) stays outside the finger hole of `band`.
    Negative = it reaches into the hole and will touch the finger."""
    import numpy as np
    ob, band = (get(x) if isinstance(x, str) else x for x in (ob, band))
    f = _ring_fit(band)
    bm = eval_bm(ob)
    P = np.array([v.co[:] for v in bm.verts])
    bm.free()
    d = P - f["centre"]
    radial = np.linalg.norm(d - np.outer(d @ f["axis"], f["axis"]), axis=1)
    i = int(radial.argmin())
    return {"object": ob.name, "band": band.name,
            "clearance_mm": round(float(radial[i]) - f["r"], 3),
            "closest_point": tuple(round(float(x), 3) for x in P[i])}


# Japanese sizes (JCS): 1 = 13.00 mm inside diameter, +1/3 mm per size. JewelCraft 2.18's
# JP table goes through US sizes and drifts up to 0.5 mm from this above size 16.
def _jp_from_diameter(dia):
    n = 3 * (dia - 13.0) + 1
    return round(n, 2) if n >= 1 else None


def _diameter_from_jp(n):
    return 13.0 + (n - 1) / 3


def ring_size(band, formats=("US", "UK", "CH", "JP", "HK")):
    """Inner diameter of a band, fitted to its inner surface, and the matching sizes."""
    rs = jc(".lib.ringsizelib")
    band = get(band) if isinstance(band, str) else band
    f = _ring_fit(band)
    dia = 2 * f["r"]
    cir = math.pi * dia
    sizes = {k: _jp_from_diameter(dia) if k == "JP" else rs.to_size_fmt(cir, k)
             for k in formats}
    out = {"band": band.name, "axis": tuple(round(float(x), 4) for x in f["axis"]),
           "centre": tuple(round(float(x), 3) for x in f["centre"]),
           "inner_diameter_mm": round(dia, 3), "inner_circumference_mm": round(cir, 3),
           "sizes": sizes, "roundness_max_dev_mm": round(f["max_dev"], 4),
           "points_rejected": f["rejected"],
           "min_opening_diameter_mm": round(2 * f["min_opening_r"], 3),
           "note": "JP is the JCS scale, to two decimals. HK returns None unless within "
                   "~0.1 mm of a listed size."}
    if dia - 2 * f["min_opening_r"] > 0.05:
        out["warning"] = ("Something reaches into the finger hole: the smallest opening is "
                          f"{2 * f['min_opening_r']:.3f} mm, not the fitted {dia:.3f} mm.")
    return out


def size_to_diameter(size, fmt="US"):
    if fmt == "JP":
        cir = math.pi * _diameter_from_jp(size)
    else:
        cir = jc(".lib.ringsizelib").to_cir(size, fmt)
    return {"size": size, "format": fmt, "circumference_mm": round(cir, 3),
            "diameter_mm": round(cir / math.pi, 4)}


def stl_bbox(path):
    return stl_info(path)["bbox"]


def stl_info(path):
    """Bounding-box size and triangle count of a binary STL."""
    import struct
    data = open(path, "rb").read()
    n = struct.unpack("<I", data[80:84])[0]
    pts = [struct.unpack("<3f", data[84 + i * 50 + 12 + k * 12: 84 + i * 50 + 24 + k * 12])
           for i in range(n) for k in range(3)]
    return {"bbox": [round(max(p[a] for p in pts) - min(p[a] for p in pts), 4) for a in range(3)],
            "triangles": n}


def _export_stl(obs, path):
    """Export exactly `obs`, restoring the user's selection and active object even if
    selecting or exporting fails."""
    vl = bpy.context.view_layer
    prev_sel = [o for o in vl.objects if o.select_get()]
    prev_act = vl.objects.active
    try:
        select_only(*obs)
        missing = [o.name for o in obs if not o.select_get()]
        if missing:
            raise RuntimeError(f"Could not select {missing} for export (hidden or excluded).")
        c = ctx()
        kw = dict(filepath=path, export_selected_objects=True, ascii_format=False,
                  apply_modifiers=True)
        if c:
            with bpy.context.temp_override(**c):
                bpy.ops.wm.stl_export(**kw)
        else:
            bpy.ops.wm.stl_export(**kw)
    finally:
        for o in vl.objects:
            o.select_set(o in prev_sel)
        vl.objects.active = prev_act


def print_check(objs, min_wall_mm=None, parts_that_must_not_touch=(), stl_path=None):
    obs = [get(o) if isinstance(o, str) else o for o in objs]
    u = bpy.context.scene.unit_settings
    rows, problems, warnings = [], [], []
    for o in obs:
        v, vs, nm = volume_nm(o)
        t, where = min_wall(o)
        row = {"name": o.name, "volume_mm3": round(v, 3), "nonmanifold_edges": nm,
               "inside_out": vs < 0, "min_wall_mm": round(t, 3) if t else None,
               "thinnest_near": where, "scale": tuple(round(x, 4) for x in o.scale)}
        rows.append(row)
        if nm:
            problems.append(f"{o.name}: {nm} non-manifold edges (not a closed mesh).")
        if vs < 0:
            problems.append(f"{o.name}: normals point inward.")
        if min_wall_mm and t and t < min_wall_mm:
            problems.append(f"{o.name}: thinnest wall {t:.3f} mm < {min_wall_mm} mm near {where}.")
        if any(abs(s - 1) > 1e-6 for s in o.scale):
            warnings.append(f"{o.name}: scale not applied {row['scale']}. Harmless for the "
                            "export; it only makes Solidify and similar thicknesses uneven.")
    collisions = []
    for a, b in parts_that_must_not_touch:
        a, b = (get(x) if isinstance(x, str) else x for x in (a, b))
        v = overlap_volume(a, b)
        collisions.append({"a": a.name, "b": b.name, "overlap_mm3": round(v, 4)})
        if v > 1e-6:
            problems.append(f"{a.name} and {b.name} overlap by {v:.4f} mm3.")
    out = {"objects": rows, "collisions": collisions,
           "units_mm": u.system == 'METRIC' and abs(u.scale_length - 0.001) < 1e-7}
    if not out["units_mm"]:
        problems.append("Scene is not 1 unit = 1 mm; STL numbers will not be millimetres.")
    if stl_path:
        hidden = [o.name for o in obs if not o.visible_get()]
        if hidden:
            problems.append(f"Not exported: {hidden} hidden in the viewport would be left out "
                            "of the STL. Unhide them, or leave them out on purpose.")
        else:
            _export_stl(obs, stl_path)
            info = stl_info(stl_path)
            pts, tris = [], 0
            for o in obs:
                bm = eval_bm(o)
                pts += [v.co.copy() for v in bm.verts]
                tris += len(bm.calc_loop_triangles())
                bm.free()
            exp = [round(max(p[k] for p in pts) - min(p[k] for p in pts), 4) for k in range(3)]
            out["stl"] = {"path": stl_path, "stl_bbox": info["bbox"], "model_bbox_mm": exp,
                          "stl_triangles": info["triangles"], "model_triangles": tris,
                          "matches": all(abs(a - b) < 0.01 for a, b in zip(info["bbox"], exp))
                          and info["triangles"] == tris}
            if not out["stl"]["matches"]:
                problems.append("STL does not match the model (size or triangle count): a part "
                                "is missing or the export scale is wrong.")
    out["problems"] = problems
    out["warnings"] = warnings
    return out


bpy.app.driver_namespace["JC"] = {k: v for k, v in globals().items()
                                  if callable(v) and not k.startswith("_") or k in (
                                      "HELPERS_VERSION", "DEFAULT_DENSITIES")}
result = {"registered": sorted(bpy.app.driver_namespace["JC"].keys()),
          "helpers_version": HELPERS_VERSION}
# Some Blender MCP servers return only printed output, not a `result` variable.
print(json.dumps(result))
