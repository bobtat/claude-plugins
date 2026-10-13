"""weigh, volume_nm, min_wall, overlap_volume, union_stats, and the Boolean solver choice."""
import os
import sys
import time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from jc_test import *  # noqa: E402,F401,F403

H = load()
reset()

a, b = cube("A"), cube("B", loc=(5, 0, 0))
w = H["weigh"]([a, b])
check("two cubes overlapping by half union to 1500", abs(w["volume_mm3"] - 1500) < 0.01, w["volume_mm3"])
check("overlap_volume of the same pair is 500", abs(H["overlap_volume"](a, b) - 500) < 0.01)
FAST = "MANIFOLD" if H["MANIFOLD_SOLVER"] else "EXACT"
check("separate closed parts are unioned with the fast solver", w["union_solver"] == FAST, w["union_solver"])
check("Exact gives the same 500 when asked for", abs(H["overlap_volume"](a, b, solver="EXACT") - 500) < 0.01)


def two_cubes(bm):
    bmesh.ops.create_cube(bm, size=10)
    bmesh.ops.translate(bm, vec=(5, 0, 0), verts=bmesh.ops.create_cube(bm, size=10)["verts"])


j = mesh("Joined", two_cubes)
j.location = (0, 40, 0)
w = H["weigh"]([j])
check("one object overlapping itself is unioned to 1500", abs(w["volume_mm3"] - 1500) < 0.01, w)
check("an object overlapping itself is unioned with Exact", w["union_solver"] == "EXACT", w["union_solver"])

m = cube("Mirrored", loc=(40, 0, 0))
m.scale = (-1, 1, 1)
bpy.context.view_layer.update()
v, vs, nm = H["volume_nm"](m)
check("mirrored cube has positive signed volume", vs > 0 and abs(v - 1000) < 0.01, (v, vs))
t, _ = H["min_wall"](m)
check("mirrored cube wall reads 10", t is not None and abs(t - 10) < 0.01, t)

# A Geometry Nodes SDF rebuild is a dense quad mesh whose quads are slightly non-planar
# wherever the surface curves. A ray started just behind a warped quad's centre can hit
# that quad's own other triangle first; helpers 0.3.0 read these as walls of 0.0001 to 0.0003 mm.
ball = mesh("SDF ball source", lambda bm: bmesh.ops.create_uvsphere(bm, u_segments=48, v_segments=24, radius=4.0))
ball.location = (0, 200, 0)
t, where = H["min_wall"](sdf_remesh("SDF ball", ball, voxel=0.1))
check("an SDF-rebuilt 8 mm ball's wall reads about 8, not a near-zero false hit",
      t is not None and 7.8 < t < 8.05, (t, where))
small = cube("SDF cube source", 2, (0, 220, 0))
t, where = H["min_wall"](sdf_remesh("SDF cube", small, voxel=0.03))
check("an SDF-rebuilt 2 mm cube's wall reads 2", t is not None and abs(t - 2.0) < 0.05, (t, where))
check("mirrored cube isn't inside-out", not H["weigh"]([m])["parts"][0]["inside_out"])

rod = curve_rod("Rod", y=80)
check("bevelled curve weighs 30 (12-gon section)", abs(H["weigh"]([rod])["volume_mm3"] - 30) < 0.01)


def flipped(bm):
    bmesh.ops.create_cube(bm, size=10)
    bmesh.ops.reverse_faces(bm, faces=bm.faces[:])


f = mesh("Flipped", flipped)
f.location = (0, -40, 0)
check("inside-out cube is reported inside-out", H["weigh"]([f])["parts"][0]["inside_out"])
check("inside-out cube still weighs 1000", abs(H["weigh"]([f])["volume_mm3"] - 1000) < 0.01)

d1, d2 = cube("Dup1", loc=(0, 120, 0)), cube("Dup2", loc=(0, 120, 0))
w = H["weigh"]([d1, d2])
check("coincident duplicates count once", abs(w["volume_mm3"] - 1000) < 0.01, w["union_solver"])
t1, t2 = cube("T1", loc=(80, 0, 0)), cube("T2", loc=(90, 0, 0))
w = H["weigh"]([t1, t2])
check("touching cubes sum to 2000", abs(w["volume_mm3"] - 2000) < 0.01, w["union_solver"])


def open_cube(bm):
    bmesh.ops.create_cube(bm, size=10)
    bm.faces.remove(max(bm.faces, key=lambda fc: fc.calc_center_median().z))


o = mesh("Open", open_cube)
o.location = (0, 160, 0)
w = H["weigh"]([o])
check("an open mesh is flagged non-manifold, not silently closed", w["result_nonmanifold_edges"] > 0, w)
check("an open mesh is unioned with Exact", w["union_solver"] == "EXACT", w["union_solver"])

emp = link("Empty", None)
try:
    H["weigh"]([emp])
    check("an empty raises a clear error", False)
except ValueError as e:
    check("an empty raises a clear error", "no geometry" in str(e), e)


# Dense Geometry Nodes SDF meshes are where Exact is slow; the fast solver must agree with it.
def sphere_src(name, x):
    o = mesh(name, lambda bm: bmesh.ops.create_uvsphere(bm, u_segments=48, v_segments=24, radius=4.0))
    o.location = (x, 260, 0)
    return o


s1 = sdf_remesh("SDF A", sphere_src("Sphere A", 0.0), voxel=0.08)
s2 = sdf_remesh("SDF B", sphere_src("Sphere B", 5.0), voxel=0.08)
t0 = time.time()
fast = H["overlap_volume"](s1, s2)
t_fast = time.time() - t0
t0 = time.time()
exact = H["overlap_volume"](s1, s2, solver="EXACT")
t_exact = time.time() - t0
check("on dense SDF meshes the fast solver matches Exact", exact > 0 and abs(fast - exact) < 1e-3 * exact,
      {"fast_mm3": round(fast, 4), "exact_mm3": round(exact, 4),
       "faces_each": len(s1.evaluated_get(bpy.context.evaluated_depsgraph_get()).data.polygons),
       "fast_s": round(t_fast, 2), "exact_s": round(t_exact, 2)})

check("no temporary objects left behind", not leftovers(), leftovers())
done()
