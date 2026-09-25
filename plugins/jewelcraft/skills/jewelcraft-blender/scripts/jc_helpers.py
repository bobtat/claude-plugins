# JewelCraft Toolkit helpers.
# Run this whole file once per Blender session through the Blender MCP's
# execute_blender_code tool. It registers the helpers in
#     bpy.app.driver_namespace["JC"]
# and later calls use:  H = bpy.app.driver_namespace["JC"]
# Nothing in this file changes the user's scene except temporary objects that
# are created in a temporary collection and removed before each helper returns.

import bpy
import bmesh
import math
import sys
import importlib
import addon_utils
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

HELPERS_VERSION = "0.1.0"

# Densities (g/cm3) from JewelCraft 2.18.1's default weighting list; used only
# when the current scene's list is empty.
DEFAULT_DENSITIES = [
    ("Yellow Gold 24K", 19.32), ("Yellow Gold 22K", 17.86), ("Yellow Gold 18K", 15.53),
    ("Yellow Gold 14K", 13.05), ("Yellow Gold 10K", 11.47), ("White Gold 18K Pd", 15.66),
    ("White Gold 18K Ni", 14.69), ("White Gold 14K Pd", 14.60), ("White Gold 14K Ni", 12.61),
    ("White Gold 10K", 10.99), ("Rose Gold 18K", 15.02), ("Rose Gold 14K", 13.03),
    ("Rose Gold 10K", 11.52), ("Platinum 950", 20.70), ("Platinum 900", 21.54),
    ("Palladium 950", 12.16), ("Silver Sterling", 10.36),
]


# ---------------------------------------------------------------- add-on / context

def addon_name():
    for m in addon_utils.modules():
        if "jewelcraft" in m.__name__.lower():
            return m.__name__
    return None


def jc(sub):
    """Import a JewelCraft submodule, e.g. jc('.lib.gemlib')."""
    return importlib.import_module(addon_name() + sub)


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
    """BMesh of the evaluated object, transformed by `matrix` (default: world)."""
    dg = bpy.context.evaluated_depsgraph_get()
    bm = bmesh.new()
    bm.from_object(ob, dg)
    bm.transform(matrix if matrix is not None else ob.matrix_world)
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
        self.obs = []
        return self

    def copy_eval(self, ob, name="JC_TMP"):
        dg = bpy.context.evaluated_depsgraph_get()
        me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
        c = bpy.data.objects.new(name, me)
        self.coll.objects.link(c)
        c.matrix_world = ob.matrix_world.copy()
        self.obs.append(c)
        return c

    def copy_original(self, ob, name="JC_TMP"):
        """Copy of the object's own mesh with no modifiers."""
        c = bpy.data.objects.new(name, ob.data.copy())
        self.coll.objects.link(c)
        c.matrix_world = ob.matrix_world.copy()
        self.obs.append(c)
        return c

    def __exit__(self, *exc):
        for o in self.obs:
            me = o.data
            bpy.data.objects.remove(o, do_unlink=True)
            if me is not None and me.users == 0:
                bpy.data.meshes.remove(me)
        bpy.data.collections.remove(self.coll)
        # Without this, view_layer.objects can briefly yield None entries.
        bpy.context.view_layer.update()
        return False


def _boolean(target, other, op):
    md = target.modifiers.new("JC_" + op, 'BOOLEAN')
    md.operation = op
    md.solver = 'EXACT'
    md.object = other
    return md


def overlap_volume(a, b):
    """Volume (mm3) of a ∩ b, using evaluated copies. 0 = no collision."""
    with TempObjects() as t:
        ca, cb = t.copy_eval(a), t.copy_eval(b)
        cb.hide_set(True)
        _boolean(ca, cb, 'INTERSECT')
        bpy.context.view_layer.update()
        v, _, _ = volume_nm(ca)
    return v


def union_stats(obs):
    """(volume, non-manifold edges) of the union of evaluated copies of `obs`."""
    with TempObjects() as t:
        copies = [t.copy_eval(o) for o in obs]
        base = copies[0]
        for c in copies[1:]:
            c.hide_set(True)
            _boolean(base, c, 'UNION')
        bpy.context.view_layer.update()
        v, _, nm = volume_nm(base)
    return v, nm


# ---------------------------------------------------------------- actions

def check_setup():
    s = bpy.context.scene
    u = s.unit_settings
    issues = []
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
    if not bpy.data.is_saved or bpy.data.is_dirty:
        issues.append("The file has unsaved changes: ask the user to save before experiments.")
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
        "helpers_version": HELPERS_VERSION, "issues": issues,
    }


def gems_in_scene():
    gemlib = jc(".lib.gemlib")
    out = []
    for o in bpy.context.view_layer.objects:
        if "gem" not in o or o.type != 'MESH':
            continue
        cut, stone = o["gem"]["cut"], o["gem"]["stone"]
        d = tuple(round(x, 2) for x in o.dimensions)
        out.append({"name": o.name, "cut": cut, "stone": stone, "dims_xyz": d,
                    "ct": gemlib.ct_calc(stone, cut, d),
                    "location": tuple(round(x, 3) for x in o.matrix_world.translation)})
    return out


def stone_report(check_large_overlaps=True):
    """JewelCraft's design-report data without writing a file or opening a browser,
    plus an overlap check for large stones that JewelCraft's 4 mm search misses."""
    rg = jc(".operators.design_report.report_get")
    rf = jc(".operators.design_report.report_fmt")
    gt = jc(".lib.gettext")
    rep = rg.data_collect(show_warnings=True)
    rf.data_format(rep, gt.GetText("en_US").gettext, False)
    data = rep.asdict()
    result = {"warnings": list(data.get("warnings", [])),
              "gems": data.get("gems", []),
              "total_ct": round(sum(g["ct_sum"] for g in data.get("gems", [])), 3)}
    if check_large_overlaps:
        obs = [o for o in bpy.context.view_layer.objects if "gem" in o and o.type == 'MESH']
        flagged = []
        for i, a in enumerate(obs):
            for b in obs[i + 1:]:
                ra, rb = max(a.dimensions.xy) / 2, max(b.dimensions.xy) / 2
                dist = (a.matrix_world.translation - b.matrix_world.translation).length
                if dist >= 4.0 and dist < ra + rb + 0.1:
                    v = overlap_volume(a, b)
                    if v > 1e-6:
                        flagged.append({"a": a.name, "b": b.name, "overlap_mm3": round(v, 4)})
        result["large_stone_overlaps"] = flagged
    return result


def corner_prong_settings(L, W, d, bite_frac=0.235):
    """position/intersection for 4 corner prongs (number=2, use_symmetry=True) on a
    cushion stretched to L (Y) x W (X), matching JewelCraft's square-cushion bite."""
    bite = bite_frac * d
    theta = math.atan(W / L)
    R = 0.3945 * math.hypot(L, W) + d / 2 - bite
    return {"position_rad": theta, "position_deg": round(math.degrees(theta), 2),
            "intersection": round((L / 2 + d / 2 - R) / d * 100, 2), "bite_mm": round(bite, 3)}


def prong_report(gem, prongs):
    """How each prong meets the stone's girdle. bite > 0 = prong overlaps the girdle
    (holds the stone); bite < 0 = gap. JewelCraft's square-cushion preset gives
    about 23.5% of the prong diameter."""
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
    if not rows:
        out["note"] = "No prong crosses the girdle plane."
    elif any(r["bite_mm"] <= 0 for r in rows):
        out["note"] = "At least one prong does not touch the girdle."
    L, W = gem.dimensions.y, gem.dimensions.x
    if gem["gem"]["cut"] == "CUSHION" and rows:
        d = sum(r["diameter_mm"] for r in rows) / len(rows)
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
            raw = t.copy_original(metal)
            raw.hide_set(True)
            bpy.context.view_layer.update()
            out["control_overlap_without_modifiers_mm3"] = round(overlap_volume(gem, raw), 4)
    return out


def densities():
    try:
        coll = list(bpy.context.scene.jewelcraft.weighting_materials.coll)
    except Exception:
        coll = []
    if coll:
        return [(m.name, m.density) for m in coll if m.enabled], "scene"
    return DEFAULT_DENSITIES, "built-in defaults"


def weigh(objs, union=True):
    obs = [get(o) if isinstance(o, str) else o for o in objs]
    parts = []
    for o in obs:
        v, vs, nm = volume_nm(o)
        parts.append({"name": o.name, "volume_mm3": round(v, 3), "nonmanifold_edges": nm,
                      "inside_out": vs < 0})
    raw = sum(p["volume_mm3"] for p in parts)
    if union and len(obs) > 1:
        vol, nm = union_stats(obs)
    else:
        vol, nm = raw, sum(p["nonmanifold_edges"] for p in parts)
    dens, src = densities()
    return {"parts": parts, "sum_of_parts_mm3": round(raw, 3),
            "volume_mm3": round(vol, 3), "overlap_counted_twice_mm3": round(raw - vol, 3),
            "result_nonmanifold_edges": nm, "densities_from": src,
            "weights_g": [(n, round(vol * d / 1000, 2)) for n, d in dens]}


def ring_size(band, formats=("US", "UK", "CH", "JP", "HK")):
    """Inner diameter of a band, fitted to its inner surface, and the matching sizes."""
    import numpy as np
    rs = jc(".lib.ringsizelib")
    band = get(band) if isinstance(band, str) else band
    bm = eval_bm(band)
    P = np.array([v.co[:] for v in bm.verts])
    bm.free()
    ext = P.max(0) - P.min(0)
    axis = int(np.argmin(ext))                 # ring axis = thinnest direction
    ij = [k for k in range(3) if k != axis]
    Q = P[:, ij]
    c = (Q.max(0) + Q.min(0)) / 2
    nb = 180
    for _ in range(6):
        d = Q - c
        ang = np.arctan2(d[:, 1], d[:, 0])
        rad = np.hypot(d[:, 0], d[:, 1])
        bins = ((ang + np.pi) / (2 * np.pi) * nb).astype(int) % nb
        inner = []
        for b in range(nb):
            m = np.where(bins == b)[0]
            if len(m):
                inner.append(Q[m[np.argmin(rad[m])]])
        S = np.array(inner)
        A = np.c_[2 * S, np.ones(len(S))]
        y = (S ** 2).sum(1)
        sol, *_ = np.linalg.lstsq(A, y, rcond=None)
        c = sol[:2]
        r = math.sqrt(sol[2] + c @ c)
        res = np.abs(np.hypot(*(S - c).T) - r)
        keep = res < max(3 * np.median(res), 1e-4)
        if keep.sum() >= 12 and keep.sum() < len(S):
            S = S[keep]
            A = np.c_[2 * S, np.ones(len(S))]
            y = (S ** 2).sum(1)
            sol, *_ = np.linalg.lstsq(A, y, rcond=None)
            c = sol[:2]
            r = math.sqrt(sol[2] + c @ c)
    dia = 2 * r
    cir = math.pi * dia
    sizes = {f: rs.to_size_fmt(cir, f) for f in formats}
    return {"band": band.name, "axis": "XYZ"[axis], "inner_diameter_mm": round(dia, 3),
            "inner_circumference_mm": round(cir, 3), "sizes": sizes,
            "roundness_max_dev_mm": round(float(np.max(np.abs(np.hypot(*(S - c).T) - r))), 4),
            "note": "JP/HK return None unless within ~0.1 mm of a listed size."}


def size_to_diameter(size, fmt="US"):
    rs = jc(".lib.ringsizelib")
    cir = rs.to_cir(size, fmt)
    return {"size": size, "format": fmt, "circumference_mm": round(cir, 3),
            "diameter_mm": round(cir / math.pi, 4)}


def stl_bbox(path):
    import struct
    data = open(path, "rb").read()
    n = struct.unpack("<I", data[80:84])[0]
    pts = [struct.unpack("<3f", data[84 + i * 50 + 12 + k * 12: 84 + i * 50 + 24 + k * 12])
           for i in range(n) for k in range(3)]
    return [round(max(p[a] for p in pts) - min(p[a] for p in pts), 4) for a in range(3)]


def print_check(objs, min_wall_mm=None, parts_that_must_not_touch=(), stl_path=None):
    obs = [get(o) if isinstance(o, str) else o for o in objs]
    u = bpy.context.scene.unit_settings
    rows, problems = [], []
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
            problems.append(f"{o.name}: scale not applied {row['scale']}.")
    collisions = []
    for a, b in parts_that_must_not_touch:
        v = overlap_volume(get(a), get(b))
        collisions.append({"a": a, "b": b, "overlap_mm3": round(v, 4)})
        if v > 1e-6:
            problems.append(f"{a} and {b} overlap by {v:.4f} mm3.")
    out = {"objects": rows, "collisions": collisions,
           "units_mm": u.system == 'METRIC' and abs(u.scale_length - 0.001) < 1e-7}
    if not out["units_mm"]:
        problems.append("Scene is not 1 unit = 1 mm; STL numbers will not be millimetres.")
    if stl_path:
        vl = bpy.context.view_layer
        prev_sel = [o for o in vl.objects if o.select_get()]
        prev_act = vl.objects.active
        select_only(*obs)
        try:
            bpy.ops.wm.stl_export(filepath=stl_path, export_selected_objects=True,
                                  ascii_format=False, apply_modifiers=True)
        finally:
            for o in vl.objects:
                o.select_set(o in prev_sel)
            vl.objects.active = prev_act
        bb = stl_bbox(stl_path)
        dg = bpy.context.evaluated_depsgraph_get()
        pts = []
        for o in obs:
            bm = eval_bm(o)
            pts += [v.co.copy() for v in bm.verts]
            bm.free()
        exp = [round(max(p[k] for p in pts) - min(p[k] for p in pts), 4) for k in range(3)]
        out["stl"] = {"path": stl_path, "stl_bbox": bb, "model_bbox_mm": exp,
                      "matches": all(abs(a - b) < 0.01 for a, b in zip(bb, exp))}
        if not out["stl"]["matches"]:
            problems.append("STL size does not match the model; check export scale settings.")
    out["problems"] = problems
    return out


bpy.app.driver_namespace["JC"] = {k: v for k, v in globals().items()
                                  if callable(v) and not k.startswith("_") or k in (
                                      "HELPERS_VERSION", "DEFAULT_DENSITIES")}
result = {"registered": sorted(bpy.app.driver_namespace["JC"].keys()),
          "helpers_version": HELPERS_VERSION}
