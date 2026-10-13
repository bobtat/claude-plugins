"""build-from-paths: path_build.py (node-group recipes, rebuild, object helpers) and
u_wire.py (the U-wire head's geometry)."""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from jc_test import *  # noqa: E402,F401,F403

SCRIPTS = os.environ.get("JC_PATH_BUILD") or os.path.normpath(os.path.join(
    HERE, "..", "..", "plugins", "jewelcraft", "skills", "build-from-paths", "scripts"))

H = load()
reset()
for f in ("path_build.py", "u_wire.py"):
    p = os.path.join(SCRIPTS, f)
    exec(compile(open(p, encoding="utf-8").read(), p, "exec"), {"__name__": "jpb_test"})
B = bpy.app.driver_namespace["JPB"]
U = bpy.app.driver_namespace["JUW"]
dg = bpy.context.evaluated_depsgraph_get


def ev(ob):
    return ob.evaluated_get(dg())


def faces(ob):
    return len(ev(ob).data.polygons)


def zrange(ob):
    zs = [(ob.matrix_world @ v.co).z for v in ev(ob).data.vertices]
    return min(zs), max(zs)


def inside(ob, p):
    """Whether world point p is inside the evaluated solid (nearest-face normal test)."""
    q = ob.matrix_world.inverted() @ Vector(p)
    ok, loc, nrm, _ = ev(ob).closest_point_on_mesh(q)
    return ok and (q - loc).dot(nrm) < 0


def vol(ob):
    return H["volume_nm"](ob)[0]


def line(a, b):
    a, b = Vector(a), Vector(b)
    d = (b - a) / 3
    return [(a, a - d, a + d), (b, b - d, b + d)]


# ---------------------------------------------------------------- wire_head: tubes, ends, mirror
B["wire_head"]("T Head")
B["bezier"]("T Wire", line((2, 2, 0), (2, 2, 10)))
head = B["solid"]("T Head Wire", "T Head", {"Wire": "T Wire", "Wire Diameter": 1.0, "Voxel Size": 0.04,
                                            "Fillet Radius": 0.0}, modifier="Head", preview=True)
capsule = math.pi * 0.25 * 10 + 4 / 3 * math.pi * 0.125     # radius 0.5, 10 long, round ends
v = vol(head)
check("a quarter path makes four capsules (tube + ball ends) of the wire diameter",
      abs(v - 4 * capsule) < 0.015 * 4 * capsule and H["pieces"](head) == 4, (round(v, 3), round(4 * capsule, 3)))
lo, hi = zrange(head)
check("ball ends reach half a wire past each end", abs(lo + 0.5) < 0.05 and abs(hi - 10.5) < 0.05, (lo, hi))

H["set_node_inputs"](head, "Head", {"Fillet Radius": 0.3})
v2 = vol(head)
check("a fillet (closing) leaves convex parts alone", abs(v2 - v) < 0.01 * v, (round(v, 3), round(v2, 3)))

H["set_node_inputs"](head, "Head", {"Explode": 5.0})
lo2, _ = zrange(head)
check("Explode lifts the head", abs(lo2 - lo - 5.0) < 0.01, (lo, lo2))
H["set_node_inputs"](head, "Head", {"Explode": 0.0})

# A T: the quarter path along +x on y = 0 mirrors into one straight rod; the peg meets it
# in the middle, so there are inside corners for the fillet to fill.
B["bezier"]("T Bar", line((0, 0, 20), (4, 0, 20)))
B["bezier"]("T Peg", line((0, 0, 20), (0, 0, 16)))
tee = B["solid"]("T Tee", "T Head", {"Wire": "T Bar", "Peg": "T Peg", "Wire Diameter": 1.0, "Peg Diameter": 1.0,
                                     "Voxel Size": 0.04, "Fillet Radius": 0.0}, modifier="Head", preview=True)
t0 = vol(tee)
H["set_node_inputs"](tee, "Head", {"Fillet Radius": 0.3})
t1 = vol(tee)
check("a fillet adds metal in the inside corners where the peg meets the bar", t1 - t0 > 0.02 and H["pieces"](tee) == 1,
      (round(t0, 3), round(t1, 3)))

# ---------------------------------------------------------------- rebuild keeps settings
H["set_node_inputs"](head, "Head", {"Wire Diameter": 0.8})
ng = bpy.data.node_groups["T Head"]
ng.interface.remove(next(i for i in ng.interface.items_tree if getattr(i, "name", "") == "Voxel Size"))
bpy.context.view_layer.update()
r = B["rebuild"]({"T Head": "wire_head"})
vals = H["node_inputs"](head, "Head")
check("rebuild keeps each modifier's settings", abs(vals["Wire Diameter"] - 0.8) < 1e-6, vals)
check("an input the old group lacked gets the default, not 0", abs(vals["Voxel Size"] - 0.03) < 1e-6 and faces(head) > 0,
      vals["Voxel Size"])
check("rebuild reports the modifiers it restored", "T Head Wire / Head" in r["settings_restored_on"], r)

# ---------------------------------------------------------------- casting
# Ring coordinates: a bar for the band top (z 8..10), two shoulders rising from it, a gallery
# whose underside is at z 12, and a head wire crossing at z 10 (the bar's top).
def boxes(*specs):
    """One mesh of axis-aligned boxes, each (sx, sy, sz, x, y, z)."""
    def f(bm):
        for sx, sy, sz_, x, y, z in specs:
            g_ = bmesh.ops.create_cube(bm, size=1)["verts"]
            bmesh.ops.scale(bm, vec=(sx, sy, sz_), verts=g_)
            bmesh.ops.translate(bm, vec=(x, y, z), verts=g_)
    return f


bar = mesh("C Band", boxes((20, 2.5, 2, 0, 0, 9)))                       # z 8..10
sh = mesh("C Shoulders", boxes((1.5, 2.5, 5, -3.75, 0, 11.5), (1.5, 2.5, 5, 3.75, 0, 11.5)))   # z 9..14
gal = cube("C Gallery", 1, (0, 0, 12.5))                                # underside at z 12
B["bezier"]("C Wire", line((0, 0, 10), (3, 3, 10)))
for o in (bar, sh, gal):
    o.display_type = 'WIRE'
B["casting"]("C Casting")
cast = B["solid"]("C Cast", "C Casting", {"Band": "C Band", "Shoulders": "C Shoulders", "Gallery": "C Gallery",
                                          "Wire": "C Wire", "Voxel Size": 0.04, "Fillet Radius": 0.0},
                  modifier="Casting", preview=True)
_, top = zrange(cast)
check("shoulder tops are cut at the gallery's underside + the filing allowance (12.2)", abs(top - 12.2) < 0.05, top)
check("the cast is one piece", H["pieces"](cast) == 1)
check("below the trim the shoulder is metal", inside(cast, (3.75, 0, 11.5)))
check("above the trim it is gone", not inside(cast, (3.75, 0, 12.6)))
check("the seat groove follows the wire (0.6 mm around it)", not inside(cast, (0.8, 0.8, 9.7)))
check("the bar is untouched away from the groove", inside(cast, (6.0, 0, 9.0)) and inside(cast, (0.3, 0, 9.2)))
check("the drill dimple sits under the crossing", not inside(cast, (0, 0, 9.2)) and inside(cast, (0, 0, 8.5)))

# ---------------------------------------------------------------- fuse
# A head 7 mm wide (x +-3.5), z 12..14: it sits on the inner half of each shoulder once the
# shoulders are filed to 12, so the outer half (x 3.5..4.5) keeps no filing stock.
hd = mesh("F Head", boxes((7, 2, 2, 0, 0, 13)))
B["fuse"]("F Fuse")
ring = B["solid"]("F Ring", "F Fuse", {"Casting": "C Cast", "Head": "F Head", "Gallery": "C Gallery",
                                       "Voxel Size": 0.04, "Fillet Radius": 0.2}, modifier="Fuse", preview=True)
check("the finished piece is one piece", H["pieces"](ring) == 1)
check("the filing allowance is filed off where the head isn't", not inside(ring, (4.2, 0, 12.1))
      and inside(cast, (4.2, 0, 12.1)))
check("and the head is joined on top", inside(ring, (0, 0, 13.0)) and inside(ring, (3.2, 0, 12.1)))

# ---------------------------------------------------------------- object helpers
p = B["profile"]("T Profile", 0.6, 1.0)
xs = sorted(round(q.co.x, 3) for q in p.data.splines[0].points)
check("profile() is a closed 0.6 x 1.0 rectangle", p.data.splines[0].use_cyclic_u and xs[0] == -0.3 and xs[-1] == 0.3, xs)
a = B["archive"](["T Tee"], "test")
lc = bpy.context.view_layer.layer_collection.children[a["collection"]]
check("archive() renames into an excluded collection", a["archived"] == ["T Tee (test)"] and lc.exclude, a)

# ---------------------------------------------------------------- U-wire design
pts, info = U["design"]((3.0, 4.0), 0.5, -4.4, 1.1, 2.0, 1.2, 23.75)
uu = Vector((0.6, 0.8, 0))


def sz(v):
    return (v.x * uu.x + v.y * uu.y, v.z)


(s1, z1), (s2, z2) = sz(pts[1][0]), sz(pts[2][0])
check("the straight arm is 23.75 degrees below horizontal",
      abs(math.degrees(math.atan2(z2 - z1, s2 - s1)) - 23.75) < 1e-6)
coll = all(abs((pts[i][1] - pts[i][0]).normalized().dot((pts[i][2] - pts[i][0]).normalized()) + 1) < 1e-9
           for i in (1, 2, 3))
check("the arcs and straights meet tangentially", coll)
check("the prong runs straight up from the bend to the tip at (3, 4, 0.5)",
      (pts[4][0] - Vector((3, 4, 0.5))).length < 1e-9 and abs(pts[3][0].x - 3) < 1e-9 and abs(pts[3][0].y - 4) < 1e-9)


def bez(i, t):
    p0, p1, p2, p3 = pts[i][0], pts[i][2], pts[i + 1][1], pts[i + 1][0]
    return (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t ** 2 * p2 + t ** 3 * p3


arc_b = max(abs(math.hypot(sz(bez(0, t))[0], sz(bez(0, t))[1] - (-4.4 + 2.0)) - 2.0) for t in (0.25, 0.5, 0.75))
zs_ = info["bend_starts_z"]
arc_e = max(abs(math.hypot(sz(bez(2, t))[0] - (5.0 - 1.2), sz(bez(2, t))[1] - zs_) - 1.2) for t in (0.25, 0.5, 0.75))
check("the bottom arc has radius 2.0 and the elbow 1.2 (within 0.001)", arc_b < 1e-3 and arc_e < 1e-3, (arc_b, arc_e))
L = sum((bez(i, (k + 1) / 400) - bez(i, k / 400)).length for i in range(4) for k in range(400))
check("quarter_path_len matches the curve", abs(L - info["quarter_path_len"]) < 2e-3, (L, info["quarter_path_len"]))
check("the U-wires cross at 2 x atan(3/4) = 73.74 degrees", abs(info["crossing_angle_deg"] - 73.7398) < 1e-3,
      info["crossing_angle_deg"])

# ---------------------------------------------------------------- U-wire apply
ctrl = link("U Head Control", None)
ctrl.location = (0, 0, 40)
g = cube("U Gem", 6, (0, 0, 40))         # its lowest point is 3 mm below the control
g.parent = ctrl
g.matrix_parent_inverse = ctrl.matrix_world.inverted()
B["wire_head"]("U Head")
uh = B["solid"]("U Head Wire", "U Head", {"Wire": None}, modifier="Head")
bpy.context.view_layer.update()
r = U["apply"]("U", culet_clearance=0.3, wire_d=1.0, prong_xy=(3.0, 4.0), tip_z=0.5)
w = bpy.data.objects["U Wire"]
c0 = w.data.splines[0].bezier_points[0].co
check("the crossing sits culet_clearance + half a wire under the culet", abs(c0.z - (-3 - 0.3 - 0.5)) < 1e-4, c0.z)
pg = [q.co.z for q in bpy.data.objects["U Peg"].data.splines[0].bezier_points]
check("the peg runs from inside the crossing to 0.6 below the wires", abs(pg[1] - (c0.z - 0.5 - 0.6)) < 1e-4, pg)
check("Wire Diameter is set on the head's modifier", r["wire_diameter_set_on"] == ["U Head Wire / Head"]
      and abs(H["node_inputs"](uh, "Head")["Wire Diameter"] - 1.0) < 1e-6, r)
r2 = U["apply"]("U", culet_clearance=0.5, wire_d=1.0)
tip = w.data.splines[0].bezier_points[-1].co
check("a second apply keeps the prong position and tip", (tip - Vector((3, 4, 0.5))).length < 1e-6, tuple(tip))
check("and moves the crossing for the new clearance", abs(w.data.splines[0].bezier_points[0].co.z - (-3.5 - 0.5)) < 1e-4)
gl = cube("U Gallery", 0.5, (0, 0, 40 - 1.2))
gl.parent = ctrl
gl.matrix_parent_inverse = ctrl.matrix_world.inverted()
r3 = U["apply"]("U", culet_clearance=0.5, wire_d=1.0)
check("a prong bend inside the gallery is warned about", "warning" in r3, r3.get("bend_below_gallery"))

check("no temporary objects left behind", not leftovers(), leftovers())
done()
