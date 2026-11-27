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
HELPERS_VERSION = "0.4.0"

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
    # A legacy install can sit in a folder such as "jewelcraft-master".
    def is_jc(name):
        return "jewelcraft" in name.rsplit(".", 1)[-1].lower()
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


# ---------------------------------------------------------------- Geometry Nodes inputs

def _gn_modifier(ob, modifier=None):
    ob = get(ob) if isinstance(ob, str) else ob
    mods = [m for m in ob.modifiers if m.type == 'NODES' and m.node_group is not None
            and (modifier is None or m.name == modifier)]
    if not mods:
        raise KeyError(f"{ob.name} has no Geometry Nodes modifier"
                       + (f" named {modifier!r}" if modifier else ""))
    if len(mods) > 1:
        raise ValueError(f"{ob.name} has several Geometry Nodes modifiers "
                         f"{[m.name for m in mods]}: pass modifier=")
    return ob, mods[0]


def _gn_items(md):
    return [it for it in md.node_group.interface.items_tree
            if getattr(it, "item_type", "SOCKET") == 'SOCKET' and it.in_out == 'INPUT'
            and it.socket_type != 'NodeSocketGeometry']


def _gn_slot(md, identifier):
    """Where a modifier input's value lives. Blender 5.2 keeps it in
    modifier.properties.inputs.<identifier>.value, and the modifier no longer takes ID
    properties (modifier["Socket_2"] raises TypeError) [verified]; older versions use the
    ID property. Returns None for the ID-property case."""
    props = getattr(md, "properties", None)
    inputs = getattr(props, "inputs", None) if props is not None else None
    return getattr(inputs, identifier, None) if inputs is not None else None


def _plain(v):
    if isinstance(v, bpy.types.ID):
        return v.name
    if hasattr(v, "__len__") and not isinstance(v, str):
        return [round(x, 6) if isinstance(x, float) else x for x in v]
    return round(v, 6) if isinstance(v, float) else v


def node_inputs(ob, modifier=None):
    """{input name: value} of an object's Geometry Nodes modifier (the only one, or the
    one named `modifier`). Objects and collections come back as names."""
    ob, md = _gn_modifier(ob, modifier)
    out = {}
    for it in _gn_items(md):
        slot = _gn_slot(md, it.identifier)
        out[it.name] = _plain(slot.value if slot is not None else md.get(it.identifier))
    return out


def set_node_inputs(ob, modifier=None, values=None, **kw):
    """Set Geometry Nodes modifier inputs by name: set_node_inputs("R1 Head Wire", "Head",
    {"Wire Diameter": 1.0}). Objects and collections can be given by name. Returns the
    values they had before, so a change can be undone."""
    ob, md = _gn_modifier(ob, modifier)
    values = dict(values or {}, **kw)
    items = {it.name: it for it in _gn_items(md)}
    unknown = [k for k in values if k not in items]
    if unknown:
        raise KeyError(f"{ob.name} / {md.name} has no input {unknown}; it has {sorted(items)}")
    before = {}
    for k, v in values.items():
        it = items[k]
        if isinstance(v, str) and it.socket_type == 'NodeSocketObject':
            v = get(v)
        elif isinstance(v, str) and it.socket_type == 'NodeSocketCollection':
            v = bpy.data.collections[v]
        slot = _gn_slot(md, it.identifier)
        before[k] = _plain(slot.value if slot is not None else md.get(it.identifier))
        if slot is not None:
            slot.value = v
        else:
            md[it.identifier] = v
    ob.update_tag(refresh={'OBJECT', 'DATA'})
    bpy.context.view_layer.update()
    return {"object": ob.name, "modifier": md.name, "previous": before}


# ---------------------------------------------------------------- geometry basics

def eval_bm(ob, matrix=None):
    """BMesh of the evaluated object (mesh, curve, text or metaball), transformed by
    `matrix` (default: world)."""
    if ob.type not in {'MESH', 'CURVE', 'SURFACE', 'FONT', 'META'}:
        raise ValueError(f"{ob.name} is a {ob.type.lower()}, with no geometry to measure. "
                         "Pass the mesh objects themselves.")
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
    """Minimum wall thickness: a ray from each face centre straight inward to where it
    leaves the solid on the other side. Needs outward normals. Samples face centres only.

    Only a real exit counts. The ray skips, and carries on past, a hit on the face it
    started from (a non-planar quad's centre can sit a hair outside one of its own
    triangles, which read as a wall of almost nothing), a face whose normal points back
    along the ray (the ray is outside the solid there), and hits closer than 1e-5 mm."""
    bm = eval_bm(ob)
    bm.normal_update()
    bm.faces.index_update()
    tree = BVHTree.FromBMesh(bm)
    best, where = None, None
    for f in bm.faces:
        c, n = f.calc_center_median(), f.normal
        if n.length < 0.5:
            continue
        d = -n
        o = c - n * 1e-4
        for _ in range(16):
            loc, nrm, idx, dist = tree.ray_cast(o, d)
            if loc is None:
                break
            if idx == f.index or nrm.dot(d) <= 0 or (loc - o).length < 1e-5:
                o = loc + d * 1e-5
                continue
            t = (loc - c).length
            if best is None or t < best:
                best, where = t, tuple(round(x, 3) for x in c)
            break
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

    def copy_without(self, ob, drop, name="JC_TMP"):
        """Copy of `ob` that keeps its modifiers (curve wrap, Solidify, Mirror...) except
        those for which drop(modifier) is true. Returns (copy, dropped names)."""
        c = ob.copy()
        c.data = ob.data.copy()
        c.name = name
        dropped = []
        for md in list(c.modifiers):
            if drop(md):
                dropped.append(md.name)
                c.modifiers.remove(md)
        self.coll.objects.link(c)
        self.obs.append(c)
        return c, dropped

    def copy_without_cutter(self, ob, cutter, name="JC_TMP"):
        """Copy of `ob` without the Booleans that cut with `cutter`."""
        return self.copy_without(ob, lambda md: md.type == 'BOOLEAN' and (
            md.object == cutter or (md.operand_type == 'COLLECTION' and md.collection is not None
                                    and cutter.name in md.collection.all_objects)), name)[0]

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


# ---------------------------------------------------------------- mesh statistics (numpy)

def _np_mesh(me):
    """Vertex positions (N x 3), edges (E x 2), how many faces use each edge, and which
    vertices belong to a face, as numpy arrays."""
    import numpy as np
    co = np.empty(len(me.vertices) * 3, np.float32)
    me.vertices.foreach_get("co", co)
    E = np.empty(len(me.edges) * 2, np.int32)
    me.edges.foreach_get("vertices", E)
    le = np.empty(len(me.loops), np.int32)
    me.loops.foreach_get("edge_index", le)
    lv = np.empty(len(me.loops), np.int32)
    me.loops.foreach_get("vertex_index", lv)
    used = np.zeros(len(me.vertices), bool)
    used[lv] = True
    return (co.reshape(-1, 3).astype(np.float64), E.reshape(-1, 2).astype(np.int64),
            np.bincount(le, minlength=len(me.edges)), used)


def _labels(n, E):
    """Connected-piece label of each of `n` vertices: a vectorised union-find over the
    edges. Each pass hooks every root onto the smallest root it shares an edge with, then
    flattens the trees."""
    import numpy as np
    par = np.arange(n)
    while len(E):
        pu, pv = par[E[:, 0]], par[E[:, 1]]
        if np.array_equal(pu, pv):
            break
        np.minimum.at(par, np.maximum(pu, pv), np.minimum(pu, pv))
        while True:
            pp = par[par]
            if np.array_equal(pp, par):
                break
            par = pp
    return par


def _mesh_info(me):
    """Non-manifold edges (edges without exactly two faces), pieces (groups of faces
    joined through edges), each piece's bounding box, and the vertex arrays."""
    import numpy as np
    co, E, fpe, used = _np_mesh(me)
    lab = _labels(len(co), E)
    roots, inv = np.unique(lab[used], return_inverse=True)
    lo = np.full((len(roots), 3), np.inf)
    hi = np.full((len(roots), 3), -np.inf)
    if len(roots):
        np.minimum.at(lo, inv.ravel(), co[used])
        np.maximum.at(hi, inv.ravel(), co[used])
    return {"nonmanifold": int((fpe != 2).sum()), "pieces": len(roots), "lo": lo, "hi": hi,
            "roots": roots, "labels": lab, "co": co, "used": used}


def _np_tris(me):
    import numpy as np
    me.calc_loop_triangles()
    T = np.empty(len(me.loop_triangles) * 3, np.int32)
    me.loop_triangles.foreach_get("vertices", T)
    return T.reshape(-1, 3).astype(np.int64)


def _tri_volumes(co, T):
    """Signed volume each triangle contributes (summed, the mesh's volume)."""
    import numpy as np
    if not len(T):
        return np.zeros(0)
    A, B, C = co[T[:, 0]], co[T[:, 1]], co[T[:, 2]]
    return np.einsum("ij,ij->i", A, np.cross(B, C)) / 6.0


class _EvalMesh:
    """`with _EvalMesh(ob) as me:` the evaluated mesh of `ob`, in its local space."""

    def __init__(self, ob):
        if ob.type not in {'MESH', 'CURVE', 'SURFACE', 'FONT', 'META'}:
            raise ValueError(f"{ob.name} is a {ob.type.lower()}, with no geometry to measure. "
                             "Pass the mesh objects themselves.")
        self.ev = ob.evaluated_get(bpy.context.evaluated_depsgraph_get())

    def __enter__(self):
        return self.ev.to_mesh()

    def __exit__(self, *exc):
        self.ev.to_mesh_clear()
        return False


# ---------------------------------------------------------------- Booleans

# The Boolean modifier's solvers [docs]: Exact handles overlapping geometry but is slow;
# Manifold is usually fastest but only works on closed (manifold) meshes. On dense meshes,
# such as Geometry Nodes SDF output with hundreds of thousands of faces, Exact can take
# minutes where Manifold takes seconds. Measured in Blender 5.2.2 [verified]: Manifold
# matched Exact for separate closed cubes that overlap, coincide or only touch; it left two
# overlapping cubes joined in one mesh unmerged (2000 mm3 instead of 1500), and gave a
# wrong volume on an open mesh. So it is used only when every mesh is closed and no two
# of its pieces' bounding boxes meet, and its result is checked.
MANIFOLD_SOLVER = "MANIFOLD" in {
    i.identifier for i in bpy.types.BooleanModifier.bl_rna.properties["solver"].enum_items}


def _manifold_safe(info):
    """True when the Manifold solver gives Exact's answer for this mesh: it is closed,
    and no two of its pieces' bounding boxes meet, so no piece can overlap another."""
    import numpy as np
    k = info["pieces"]
    if info["nonmanifold"] or k == 0 or k > 200:
        return False
    if k == 1:
        return True
    lo, hi = info["lo"], info["hi"]
    meet = np.all((lo[:, None] <= hi[None, :] + 1e-6) & (lo[None, :] <= hi[:, None] + 1e-6), axis=2)
    np.fill_diagonal(meet, False)
    return not bool(meet.any())


def _boolean(target, op, other=None, collection=None, solver="EXACT"):
    md = target.modifiers.new("JC_" + op, 'BOOLEAN')
    md.operation = op
    md.solver = solver
    if solver == "EXACT":
        # Without self-intersection handling, a part that overlaps itself (a head joined
        # into the band) is counted twice or gives an undefined result.
        md.use_self = True
    if collection is not None:
        md.operand_type = 'COLLECTION'
        md.collection = collection
    else:
        md.object = other
    return md


def _apply_boolean(target, op, operands, collection=None, solver="AUTO"):
    """Boolean `op` ('UNION' or 'INTERSECT') on the temporary copy `target` with the
    temporary copies `operands` (one object, or the members of `collection`). Leaves the
    modifier on `target`, so its evaluated mesh is the result, and returns the solver used.

    solver="AUTO" picks Manifold when it is safe for every mesh (see MANIFOLD_SOLVER) and
    checks the result: one that isn't closed, or whose volume the operation can't produce
    (a union smaller than its largest part or bigger than all parts together, an
    intersection bigger than its smallest part), is redone with Exact."""
    copies = [target] + list(operands)
    if solver == "AUTO":
        infos = [_mesh_info(c.data) for c in copies]
        safe = MANIFOLD_SOLVER and all(_manifold_safe(i) for i in infos)
        tries = ["MANIFOLD", "EXACT"] if safe else ["EXACT"]
    else:
        infos, tries = None, [solver]
    for s in tries:
        md = _boolean(target, op, other=None if collection is not None else copies[1],
                      collection=collection, solver=s)
        bpy.context.view_layer.update()
        if s != "MANIFOLD" or len(tries) == 1:
            return s
        vols = [abs(float(_tri_volumes(i["co"], _np_tris(c.data)).sum())) for i, c in zip(infos, copies)]
        with _EvalMesh(target) as me:
            res = _mesh_info(me)
            v = float(_tri_volumes(res["co"], _np_tris(me)).sum())
        tol = 1e-4 * sum(vols) + 1e-6
        if op == 'UNION':
            ok = max(vols) - tol <= v <= sum(vols) + tol
        else:
            ok = -tol <= v <= min(vols) + tol
        if ok and res["nonmanifold"] == 0:
            return s
        target.modifiers.remove(md)
    return tries[-1]


def overlap_volume(a, b, matrix_a=None, matrix_b=None, solver="AUTO"):
    """Volume (mm3) of a ∩ b, using evaluated copies. 0 = no collision."""
    with TempObjects() as t:
        ca, cb = t.copy_eval(a, matrix=matrix_a), t.copy_eval(b, matrix=matrix_b)
        cb.hide_set(True)
        _apply_boolean(ca, 'INTERSECT', [cb], solver=solver)
        v, _, _ = volume_nm(ca)
    return v


def union_stats(obs):
    """(volume, non-manifold edges) of the union of evaluated copies of `obs`. Also
    resolves overlaps inside each object, including when there is only one."""
    v, nm, _, _ = _union(obs)
    return v, nm


def _union(obs, solver="AUTO"):
    """(volume, non-manifold edges, separate pieces, solver used) of the union of `obs`."""
    with TempObjects() as t:
        base = t.copy_eval(obs[0])
        ops = t.sub_collection()
        operands = []
        for o in obs[1:]:
            c = t.copy_eval(o, coll=ops)
            c.hide_set(True)
            operands.append(c)
        used = _apply_boolean(base, 'UNION', operands, collection=ops, solver=solver)
        v, _, nm = volume_nm(base)
        with _EvalMesh(base) as me:
            shells = _mesh_info(me)["pieces"]
    return v, nm, shells, used


def pieces(ob):
    """How many separate pieces the evaluated object is made of: groups of faces joined
    through shared edges. Loose vertices and edges don't count."""
    ob = get(ob) if isinstance(ob, str) else ob
    with _EvalMesh(ob) as me:
        return _mesh_info(me)["pieces"] if me is not None else 0


def overlap_islands(a, b, frame=None, min_mm3=1e-6):
    """Where two parts overlap: the volume of a ∩ b split into separate islands, largest
    first, each with its volume and centre (world space, or in `frame`, a Matrix). A stone
    held by four notched prongs gives four islands, one per seat; a head that should meet
    a casting only at its peg gives one. Islands under `min_mm3` (faces that only touch)
    are left out."""
    import numpy as np
    a, b = (get(x) if isinstance(x, str) else x for x in (a, b))
    with TempObjects() as t:
        ca, cb = t.copy_eval(a), t.copy_eval(b)
        cb.hide_set(True)
        solver = _apply_boolean(ca, 'INTERSECT', [cb])
        with _EvalMesh(ca) as me:
            info = _mesh_info(me)
            T = _np_tris(me)
        co, lab = info["co"], info["labels"]
        islands = []
        if len(T):
            # Each triangle and the origin make a tetrahedron; summed per island, their
            # signed volumes give its volume and their volume-weighted centres its centroid.
            isl = np.searchsorted(info["roots"], lab[T[:, 0]])
            tv = _tri_volumes(co, T)
            tc = (co[T[:, 0]] + co[T[:, 1]] + co[T[:, 2]]) / 4.0
            k = len(info["roots"])
            vol = np.bincount(isl, weights=tv, minlength=k)
            mom = np.stack([np.bincount(isl, weights=tv * tc[:, j], minlength=k) for j in range(3)], 1)
            F = np.array(frame) if frame is not None else None
            for i in range(k):
                if abs(vol[i]) < min_mm3:
                    continue
                c = mom[i] / vol[i]
                if F is not None:
                    c = F[:3, :3] @ c + F[:3, 3]
                islands.append({"mm3": round(float(vol[i]), 4),
                                "centre": [round(float(x), 3) for x in c]})
    islands.sort(key=lambda d: -d["mm3"])
    return {"a": a.name, "b": b.name, "total_mm3": round(sum(i["mm3"] for i in islands), 4),
            "islands": islands, "solver": solver}


def thin_spots(ob, min_mm=0.5, voxel=None, threshold=None, step=None, cell_mm=1.0, frame=None):
    """Where a part is thinner than `min_mm`, by an opening test: the evaluated part is
    turned into a signed-distance volume, shrunk by r = min_mm / 2 and grown back by r
    (Geometry Nodes Mesh to SDF Grid and Grid to Mesh, on a temporary object). Anything
    thinner than min_mm disappears; everything else comes back, apart from sharp edges,
    which come back rounded: a 90° edge sinks 0.41 r, the corner of a cube 0.73 r, an
    edge of angle θ r(1 / sin(θ/2) - 1), so 1.0 r at 60°. Surface points that end up
    more than `threshold` (default 0.85 r) from the opened shape are reported, grouped
    into cells of `cell_mm` (world space, or `frame`), deepest first.

    Unlike min_wall this measures a thickness the part keeps in every direction, so thin
    wires and narrow fins show up, and it reports every thin place, not just the thinnest.
    Needs the SDF grid nodes (Blender 5.x). `voxel` defaults to r / 8."""
    import numpy as np
    ob = get(ob) if isinstance(ob, str) else ob
    if not hasattr(bpy.types, "GeometryNodeMeshToSDFGrid"):
        raise RuntimeError("thin_spots needs Geometry Nodes' SDF grid nodes (Blender 5.x).")
    r = min_mm / 2.0
    vox = voxel or max(r / 8.0, 0.005)
    thr = 0.85 * r if threshold is None else threshold
    band = int(math.ceil(r / vox)) + 3
    with _EvalMesh(ob) as me:
        co, _, _, used = _np_mesh(me)
    M = np.array(ob.matrix_world)
    P = co[used] @ M[:3, :3].T + M[:3, 3]
    step = step or max(1, len(P) // 150000)
    ng = bpy.data.node_groups.new("JC_TMP_opening", 'GeometryNodeTree')
    try:
        ng.interface.new_socket("Geometry", in_out='OUTPUT', socket_type='NodeSocketGeometry')
        N, L = ng.nodes.new, ng.links.new
        info = N('GeometryNodeObjectInfo')
        info.transform_space = 'RELATIVE'
        info.inputs["Object"].default_value = ob
        geo = info.outputs["Geometry"]
        for level in (-r, r):          # shrink, then grow back
            sdf = N('GeometryNodeMeshToSDFGrid')
            L(geo, sdf.inputs["Mesh"])
            sdf.inputs["Voxel Size"].default_value = vox
            sdf.inputs["Band Width"].default_value = band
            surf = N('GeometryNodeGridToMesh')
            L(sdf.outputs[0], surf.inputs["Grid"])
            surf.inputs["Threshold"].default_value = level
            geo = surf.outputs["Mesh"]
        L(geo, N('NodeGroupOutput').inputs[0])
        with TempObjects() as t:
            tmp = bpy.data.objects.new("JC_TMP_opening", bpy.data.meshes.new("JC_TMP_opening"))
            t.coll.objects.link(tmp)
            t.obs.append(tmp)
            tmp.modifiers.new("Opening", 'NODES').node_group = ng
            bpy.context.view_layer.update()
            opened = tmp.evaluated_get(bpy.context.evaluated_depsgraph_get())
            empty = len(opened.data.polygons) == 0
            far = []
            for p in P[::step]:
                v = Vector(p)
                ok, loc, _, _ = (False, None, None, None) if empty else opened.closest_point_on_mesh(v)
                d = (v - loc).length if ok else None
                if d is None or d > thr:
                    far.append((d, p))
    finally:
        bpy.data.node_groups.remove(ng)
    F = np.array(frame) if frame is not None else None
    cells = {}
    for d, p in far:
        q = p if F is None else F[:3, :3] @ p + F[:3, 3]
        c = cells.setdefault(tuple(np.floor(q / cell_mm).astype(int)), [0, 0.0, np.zeros(3), False])
        c[0] += 1
        c[2] += q
        if d is None:
            c[3] = True
        else:
            c[1] = max(c[1], d)
    spots = [{"centre": [round(float(x), 2) for x in s / n], "points": n,
              "depth_mm": None if gone else round(dep, 3),
              "depth_r": None if gone else round(dep / r, 2)}
             for n, dep, s, gone in cells.values()]
    spots.sort(key=lambda s: -(s["depth_mm"] if s["depth_mm"] is not None else 1e9))
    out = {"object": ob.name, "min_mm": min_mm, "r": r, "voxel": vox, "threshold_mm": round(thr, 4),
           "sampled": len(P[::step]), "flagged_points": len(far), "spots": spots[:20],
           "more_spots": max(0, len(spots) - 20)}
    if empty:
        out["note"] = f"Nothing survives the opening: the whole part is thinner than {min_mm} mm."
    return out


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
        notes.append("This scene has no weighting materials; weights will use built-in defaults.")
    gems = _gems() if name else []
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
        # Geometry-nodes instances all share persistent_id[0]; the index is further in,
        # followed by 0x7fffffff padding.
        pid = ".".join(str(i) for i in dup.persistent_id if i != 2147483647)
        label = ob.name if not dup.is_instance else f"{ob.name} [{instancer.name} #{pid}]"
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


def _inside(bm, tree):
    """Whether bm's first vertex is inside the closed convex mesh behind `tree`."""
    co = next(iter(bm.verts)).co
    loc, normal, _, _ = tree.find_nearest(co)
    return loc is not None and (co - loc).dot(normal) < 0


def _clip_volume(bm_a, bm_b):
    """Volume of a ∩ b by clipping a with every face plane of b. Exact when b is convex,
    as JewelCraft's gems are apart from the heart's notch. Done in bmesh because a
    Boolean on temporary objects costs a full scene re-evaluation per pair: about 1 s
    each in a ring whose seat Boolean holds 150 cutters."""
    c = bm_a.copy()
    for f in bm_b.faces:
        if not c.verts:
            break
        res = bmesh.ops.bisect_plane(c, geom=c.verts[:] + c.edges[:] + c.faces[:],
                                     plane_co=f.calc_center_median(), plane_no=f.normal,
                                     clear_outer=True)
        cut = [e for e in res["geom_cut"] if isinstance(e, bmesh.types.BMEdge)]
        if cut:
            bmesh.ops.holes_fill(c, edges=cut, sides=0)
    v = 0.0
    if c.faces:
        bmesh.ops.recalc_face_normals(c, faces=c.faces[:])
        v = c.calc_volume(signed=False)
    c.free()
    return v


def stone_overlaps(threshold=0.1):
    """Pairs of stones that overlap or are closer than `threshold` mm, measured on the
    meshes. JewelCraft's own check treats each stone as a circle of half its larger
    side, which misses the corners of square and emerald cuts, and it only compares
    stones whose centres are within 4 mm."""
    from mathutils.kdtree import KDTree
    gems = _gems()
    trees, bms, rads = [], [], []
    kd = KDTree(len(gems))
    for i, (_, o, M) in enumerate(gems):
        bm = eval_bm(o, M)
        trees.append(BVHTree.FromBMesh(bm))
        bms.append(bm)
        rads.append(_gem_dims(o, M).length / 2)
        kd.insert(M.translation, i)
    kd.balance()
    flagged = []
    for i in range(len(gems)):
        reach = rads[i] + (max(rads) if rads else 0) + threshold
        for _, j, dist in sorted(kd.find_range(gems[i][2].translation, reach), key=lambda x: x[1]):
            if j <= i or dist > rads[i] + rads[j] + threshold:
                continue
            row = {"a": gems[i][0], "b": gems[j][0], "centre_distance_mm": round(dist, 3)}
            if trees[i].overlap(trees[j]) or _inside(bms[i], trees[j]) or _inside(bms[j], trees[i]):
                v = _clip_volume(bms[i], bms[j])
                # Faces that only touch register as intersecting triangles.
                row["overlap_mm3" if v > 1e-6 else "gap_mm"] = round(v, 4) if v > 1e-6 else 0.0
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
    settings; tapered prongs are thicker at the girdle than their setting.

    Pre-notched prongs are measured without their Difference Booleans: with the notch
    cut, the girdle section stops short of the stone and would read as a gap."""
    gem, prongs = (get(gem) if isinstance(gem, str) else gem), (get(prongs) if isinstance(prongs, str) else prongs)
    with TempObjects() as t:
        plain, dropped = t.copy_without(
            prongs, lambda md: md.type == 'BOOLEAN' and md.operation == 'DIFFERENCE')
        plain.hide_set(True)
        bpy.context.view_layer.update()
        out = _prong_rows(gem, plain, prong_diameter)
    if dropped:
        out["measured_without_notches"] = dropped
    out["prongs"] = prongs.name
    return out


def _prong_rows(gem, prongs, prong_diameter):
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
    if any(r["bite_mm"] <= 0 for r in rows):
        notes.append("At least one prong does not touch the girdle.")
    if any(0 < r["bite_pct_of_diameter"] < MIN_BITE_FRAC * 100 for r in rows):
        notes.append("At least one prong grips less than 30% of its thickness, under the "
                     "30-50% bench range.")
    if rows:
        bm = eval_bm(gem, frame.inverted() @ gem.matrix_world)
        crown = max(v.co.z for v in bm.verts)
        bm.free()
        bm = eval_bm(prongs, frame.inverted() @ prongs.matrix_world)
        # Each prong's tip is the highest point of the connected piece of mesh that
        # crosses the girdle at that prong, so other geometry joined into the same object
        # (a halo rim, a gallery) doesn't count as a tip.
        bm.verts.index_update()
        parent = list(range(len(bm.verts)))

        def find(i):
            while parent[i] != i:
                parent[i] = parent[parent[i]]
                i = parent[i]
            return i
        for e in bm.edges:
            parent[find(e.verts[0].index)] = find(e.verts[1].index)
        top = {}
        for v in bm.verts:
            k = find(v.index)
            top[k] = max(top.get(k, v.co.z), v.co.z)
        for r in rows:
            near = min(bm.verts, key=lambda v: math.hypot(v.co.x - r["centre"][0],
                                                          v.co.y - r["centre"][1]) + abs(v.co.z))
            r["tip_above_girdle_mm"] = round(max(top[find(near.index)], 0.0), 3)
        bm.free()
        out["crown_height_mm"] = round(crown, 3)
        if any(r["tip_above_girdle_mm"] < crown / 2 for r in rows):
            notes.append("At least one prong tip is below halfway up the crown, too short to "
                         "fold over the stone.")
    if notes:
        out["note"] = " ".join(notes)
    L, W = gem.dimensions.y, gem.dimensions.x
    if (gem.get("gem") or {}).get("cut") == "CUSHION" and rows:
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
    enabled = [(m.name, m.density, getattr(m, "composition", "")) for m in coll if m.enabled]
    if enabled:
        return enabled, "scene"
    if coll:
        return DEFAULT_DENSITIES, "built-in defaults (the scene's list has none enabled)"
    return DEFAULT_DENSITIES, "built-in defaults"


def weigh(objs, union=True):
    obs = [get(o) if isinstance(o, str) else o for o in objs]
    parts = []
    for o in obs:
        v, vs, nm = volume_nm(o)
        parts.append({"name": o.name, "volume_mm3": round(v, 3), "nonmanifold_edges": nm,
                      "inside_out": vs < 0})
    raw = sum(p["volume_mm3"] for p in parts)
    solver = None
    if union:
        vol, nm, _, solver = _union(obs)
    else:
        vol, nm = raw, sum(p["nonmanifold_edges"] for p in parts)
    dens, src = densities()
    return {"parts": parts, "sum_of_parts_mm3": round(raw, 3),
            "volume_mm3": round(vol, 3), "overlap_counted_twice_mm3": round(raw - vol, 3),
            "result_nonmanifold_edges": nm, "union_solver": solver, "densities_from": src,
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
    Bins the band leaves empty get filled by head, bezel or prong points. On a coarse
    band there are enough of them to drag a least-squares fit, and then dropping
    outliers never removes them. So the fit starts from the circle through three points
    that the most points agree with (the band's vertices lie exactly on one), and
    only then keeps every point within 3x the median residual. That start is used only
    if its points reach round as far as the band does; on an oval band it would lock
    onto one arc."""
    import numpy as np
    c = (Q.max(0) + Q.min(0)) / 2
    for _ in range(10):
        d = Q - c
        rad = np.hypot(d[:, 0], d[:, 1])
        bins = ((np.arctan2(d[:, 1], d[:, 0]) + np.pi) / (2 * np.pi) * nb).astype(int) % nb
        order = np.lexsort((rad, bins))
        b = bins[order]
        idx = order[np.r_[True, b[1:] != b[:-1]]]
        S = Q[idx]
        keep = np.ones(len(S), bool)
        rng = np.random.RandomState(0)
        for _ in range(300 if len(S) >= 12 else 0):
            c3, r3 = _fit_circle(S[rng.choice(len(S), 3, replace=False)])
            inl = np.abs(np.hypot(*(S - c3).T) - r3) < 0.05
            if inl.sum() >= max(12, keep.sum() if keep.sum() < len(S) else 0) and \
                    RING_RADIUS_MM[0] <= r3 <= RING_RADIUS_MM[1]:
                keep = inl
        sector = ((np.arctan2(*(S - c).T[::-1]) + np.pi) / (2 * np.pi) * 24).astype(int)
        if len(set(sector[keep].tolist())) < 0.8 * len(set(sector.tolist())):
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
    return c, r, S, keep, float(np.median(res)), idx


def _mesh_arrays(ob):
    """World-space vertices, edge index pairs and triangle index triples."""
    import numpy as np
    bm = eval_bm(ob)
    bm.verts.index_update()
    P = np.array([v.co[:] for v in bm.verts]).reshape(-1, 3)
    E = np.array([[e.verts[0].index, e.verts[1].index] for e in bm.edges], int).reshape(-1, 2)
    T = np.array([[l.vert.index for l in t] for t in bm.calc_loop_triangles()], int).reshape(-1, 3)
    bm.free()
    return P, E, T


def _axis_basis(n):
    import numpy as np
    u = np.cross(n, [1.0, 0, 0] if abs(n[0]) < 0.9 else [0, 1.0, 0])
    u /= np.linalg.norm(u)
    return u, np.cross(n, u)


def _radial_min(P, E, T, centre, n):
    """Smallest distance from the axis line (centre, n) to the mesh, over its edges
    (not just vertices, so a flat bar dipping between its corners is caught), and the
    closest point. 0 when a face crosses the axis."""
    import numpy as np
    u, w = _axis_basis(n)
    Q = np.c_[(P - centre) @ u, (P - centre) @ w]
    if not len(E):
        rad = np.hypot(*Q.T)
        i = int(rad.argmin())
        return float(rad[i]), P[i]
    a, b = Q[E[:, 0]], Q[E[:, 1]]
    ab = b - a
    t = np.clip(-(a * ab).sum(1) / np.maximum((ab * ab).sum(1), 1e-18), 0.0, 1.0)
    p = a + t[:, None] * ab
    dist = np.hypot(p[:, 0], p[:, 1])
    i = int(dist.argmin())
    best, pt = float(dist[i]), P[E[i, 0]] + t[i] * (P[E[i, 1]] - P[E[i, 0]])
    if len(T):
        A, B, C = Q[T[:, 0]], Q[T[:, 1]], Q[T[:, 2]]

        def cross(p1, p2):
            return p1[:, 0] * p2[:, 1] - p1[:, 1] * p2[:, 0]
        s1, s2, s3 = cross(B - A, -A), cross(C - B, -B), cross(A - C, -C)
        hit = ((s1 >= 0) & (s2 >= 0) & (s3 >= 0)) | ((s1 <= 0) & (s2 <= 0) & (s3 <= 0))
        if hit.any():
            best, pt = 0.0, P[T[hit][0]].mean(0)
    return best, pt


# Plausible inside radius of a ring (8-40 mm diameter). Circles outside this range are
# other features seen end-on: a bezel tube, a gallery rail, the pole of a round head.
RING_RADIUS_MM = (4.0, 20.0)


def _fit_along(P, n):
    """Inner-circle fit looking along `n`, plus the share of 5-degree sectors that have
    points deep inside the circle (under 70% of its radius). Along the true axis the
    hole is empty; an edge-on view puts band points right across the centre. The depth
    keeps an oval band or a sizing bead, which reach only slightly inside, from
    counting."""
    import numpy as np
    u, w = _axis_basis(n)
    Q = P @ np.c_[u, w]
    c, r, S, keep, med, idx = _inner_circle(Q)
    d = Q - c
    deep = np.hypot(*d.T) < 0.7 * r
    sectors = ((np.arctan2(d[deep, 1], d[deep, 0]) + np.pi) / (2 * np.pi) * 72).astype(int)
    return {"axis": n, "u": u, "w": w, "c": c, "r": r, "S": S, "keep": keep,
            "inner_idx": idx[keep],
            "median_residual": med, "inside_frac": len(set(sectors.tolist())) / 72,
            "plausible": RING_RADIUS_MM[0] <= r <= RING_RADIUS_MM[1]}


def _ring_fit(band):
    """Inner-circle fit of a ring band: its axis, centre and inner radius.

    Candidate axes are the object's local axes and the principal axes of its
    vertices. A candidate is rejected if its circle isn't ring-sized, and ranked by
    how much of the band it sees inside its own circle: along the true axis the hole is
    empty, while an edge-on view puts band vertices all around the centre. Comparing
    residuals alone picks whichever part is a perfect circle end-on (a bezel tube).
    The winner's direction is then refined, because when rotation has been applied
    and the head is off to one side, the principal axes tilt toward the head. Every vertex near the fitted inner radius (both edges of the inner surface,
    not the head) lies on a cylinder around the true axis, which is their direction of
    least spread. Taking only the innermost point per angle would pick one edge per
    side and follow the tilt; nudging the axis to shrink the residual can make an oval
    band look round."""
    import numpy as np
    P, E, T = _mesh_arrays(band)
    M = band.matrix_world.to_3x3()
    cands = [np.array(M.col[k].normalized()) for k in range(3) if M.col[k].length > 1e-9]
    _, V = np.linalg.eigh(np.cov((P - P.mean(0)).T))
    for k in range(3):
        if all(abs(V[:, k] @ w) < 0.9999 for w in cands):
            cands.append(V[:, k])
    fits = [f for f in (_fit_along(P, n) for n in cands) if f["plausible"]]
    if not fits:
        raise ValueError(f"{band.name}: no axis gives a ring-sized inner circle "
                         "(8-40 mm diameter). Is this the object with the finger hole?")
    best = min(fits, key=lambda f: (round(f["inside_frac"], 2), f["median_residual"]))
    for tol in (0.3, 0.2, 0.1, 0.1, 0.05):
        rad = np.hypot(*(P @ np.c_[best["u"], best["w"]] - best["c"]).T) - best["r"]
        # Points inside the circle are something reaching into the hole, not the band.
        inner = P[(rad > -0.02) & (rad < tol)]
        if len(inner) < 12:
            break
        n = np.linalg.eigh(np.cov((inner - inner.mean(0)).T))[1][:, 0]
        n = n if n @ best["axis"] > 0 else -n
        f = _fit_along(P, n)
        if f["plausible"] and f["inside_frac"] <= best["inside_frac"] and \
                f["median_residual"] <= best["median_residual"] + 0.005:
            best = f
    n, c, u, w = best["axis"], best["c"], best["u"], best["w"]
    centre = u * c[0] + w * c[1] + n * float(np.median(P @ n))
    S, keep, r = best["S"], best["keep"], best["r"]
    opening, opening_at = _radial_min(P, E, T, centre, n)
    # The fit goes through vertices; the finger meets the flat faces between them, which
    # sit r*cos(pi/k) from the axis on a k-segment band.
    flats_r = r * math.cos(math.pi / max(int(keep.sum()), 12))
    return {"axis": n, "centre": centre, "r": r, "flats_r": flats_r,
            "max_dev": float(np.max(np.abs(np.hypot(*(S[keep] - c).T) - r))),
            "rejected": int((~keep).sum()), "min_opening_r": opening,
            "min_opening_at": opening_at}


def finger_clearance(ob, band):
    """How far `ob` (a stone's culet, a gallery) stays outside the finger hole of `band`.
    Negative = it reaches into the hole and will touch the finger."""
    ob, band = (get(x) if isinstance(x, str) else x for x in (ob, band))
    f = _ring_fit(band)
    dist, at = _radial_min(*_mesh_arrays(ob), f["centre"], f["axis"])
    return {"object": ob.name, "band": band.name,
            "clearance_mm": round(dist - f["r"], 3),
            "closest_point": tuple(round(float(x), 3) for x in at)}


# Japanese sizes (JCS): 1 = 13.00 mm inside diameter, +1/3 mm per size. JewelCraft 2.18's
# JP table goes through US sizes and drifts up to about 0.55 mm from this (JP 1, and
# JP 17-27 by 0.16-0.53 mm).
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
    if 2 * (f["flats_r"] - f["min_opening_r"]) > 0.05:
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
    """Bounding-box size and triangle count of a binary STL (0 x 0 x 0 when it's empty)."""
    import numpy as np
    with open(path, "rb") as f:
        f.seek(80)
        n = int(np.frombuffer(f.read(4), dtype="<u4")[0])
        rec = np.dtype([("normal", "<f4", 3), ("v", "<f4", (3, 3)), ("attr", "<u2")])
        data = np.frombuffer(f.read(n * 50), dtype=rec, count=n)
    if not n:
        return {"bbox": [0.0, 0.0, 0.0], "triangles": 0}
    v = data["v"].reshape(-1, 3).astype(np.float64)
    return {"bbox": [round(float(x), 4) for x in v.max(0) - v.min(0)], "triangles": n}


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
            locked = [o.name for o in obs if o.hide_select]
            raise RuntimeError(f"Could not select {missing} for export"
                               + (f": {locked} can't be selected (hide_select is on)." if locked
                                  else " (hidden or in an excluded collection)."))
        c = ctx()
        kw = dict(filepath=path, export_selected_objects=True, ascii_format=False,
                  apply_modifiers=True)
        # Export what the checks measured: the viewport evaluation. The exporter's default,
        # Render, writes an empty file for parts hidden from renders and can differ from
        # the viewport wherever a modifier has its own render setting (Subdivision levels).
        if "evaluation_mode" in bpy.ops.wm.stl_export.get_rna_type().properties.keys():
            kw["evaluation_mode"] = 'DAG_EVAL_VIEWPORT'
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
    _, _, shells, solver = _union(obs)
    if shells > 1:
        problems.append(f"The parts form {shells} separate pieces once joined: something "
                        "floats (for example prongs that don't reach the band or a head). "
                        "It would cast as loose pieces.")
    out = {"objects": rows, "collisions": collisions, "pieces": shells, "union_solver": solver,
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
                                      "HELPERS_VERSION", "DEFAULT_DENSITIES", "MANIFOLD_SOLVER")}
result = {"registered": sorted(bpy.app.driver_namespace["JC"].keys()),
          "helpers_version": HELPERS_VERSION}
# Some Blender MCP servers return only printed output, not a `result` variable.
print(json.dumps(result))
