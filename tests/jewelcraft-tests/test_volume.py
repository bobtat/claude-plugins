"""weigh, volume_nm, min_wall, overlap_volume, union_stats."""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from jc_test import *  # noqa: E402,F401,F403

H = load()
reset()

a, b = cube("A"), cube("B", loc=(5, 0, 0))
w = H["weigh"]([a, b])
check("two cubes overlapping by half union to 1500", abs(w["volume_mm3"] - 1500) < 0.01, w["volume_mm3"])
check("overlap_volume of the same pair is 500", abs(H["overlap_volume"](a, b) - 500) < 0.01)


def two_cubes(bm):
    bmesh.ops.create_cube(bm, size=10)
    bmesh.ops.translate(bm, vec=(5, 0, 0), verts=bmesh.ops.create_cube(bm, size=10)["verts"])


j = mesh("Joined", two_cubes)
j.location = (0, 40, 0)
w = H["weigh"]([j])
check("one object overlapping itself is unioned to 1500", abs(w["volume_mm3"] - 1500) < 0.01, w)

m = cube("Mirrored", loc=(40, 0, 0))
m.scale = (-1, 1, 1)
bpy.context.view_layer.update()
v, vs, nm = H["volume_nm"](m)
check("mirrored cube has positive signed volume", vs > 0 and abs(v - 1000) < 0.01, (v, vs))
t, _ = H["min_wall"](m)
check("mirrored cube wall reads 10", t is not None and abs(t - 10) < 0.01, t)
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
check("coincident duplicates count once", abs(H["weigh"]([d1, d2])["volume_mm3"] - 1000) < 0.01)
t1, t2 = cube("T1", loc=(80, 0, 0)), cube("T2", loc=(90, 0, 0))
check("touching cubes sum to 2000", abs(H["weigh"]([t1, t2])["volume_mm3"] - 2000) < 0.01)


def open_cube(bm):
    bmesh.ops.create_cube(bm, size=10)
    bm.faces.remove(max(bm.faces, key=lambda fc: fc.calc_center_median().z))


o = mesh("Open", open_cube)
o.location = (0, 160, 0)
w = H["weigh"]([o])
check("an open mesh is flagged non-manifold, not silently closed", w["result_nonmanifold_edges"] > 0, w)

emp = link("Empty", None)
try:
    H["weigh"]([emp])
    check("an empty raises a clear error", False)
except ValueError as e:
    check("an empty raises a clear error", "no geometry" in str(e), e)

check("no temporary objects left behind", not leftovers(), leftovers())
done()
