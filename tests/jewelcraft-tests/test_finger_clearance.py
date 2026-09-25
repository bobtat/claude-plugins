"""finger_clearance."""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from jc_test import *  # noqa: E402,F401,F403

H = load()
reset()
ring = band()

# A 6.5 mm round above the band: the clearance is the culet's height above the hole.
stone = gem('ROUND', 6.5, (0, 0, 0))
for z in (RI + 2.0, RI + 4.0):
    stone.location = (0, 0, z)
    bpy.context.view_layer.update()
    culet = min((stone.matrix_world @ v.co).z for v in stone.data.vertices)
    fc = H["finger_clearance"](stone, ring)
    check(f"culet clearance with the girdle at {z:.2f}", abs(fc["clearance_mm"] - (culet - RI)) < 0.01,
          (fc["clearance_mm"], round(culet - RI, 3)))

# A straight bar whose corners clear the hole by 0.2 mm but whose middle dips in.
a, rr = math.radians(20), RI + 0.2


def bar(bm):
    vs = [bm.verts.new((s * rr * math.sin(a), y, rr * math.cos(a) + dz))
          for s in (-1, 1) for y in (-0.5, 0.5) for dz in (0, 0.6)]
    bmesh.ops.convex_hull(bm, input=vs)


fc = H["finger_clearance"](mesh("Bar", bar), ring)
true_min = rr * math.cos(a) - RI
check("a flat bar is measured along its faces, not just its corners",
      abs(fc["clearance_mm"] - true_min) < 0.02, (fc["clearance_mm"], round(true_min, 3)))


def ball(y, z):
    def f(bm):
        g = bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=8, radius=0.5)["verts"]
        bmesh.ops.translate(bm, vec=(0, y, z), verts=g)
    return f


fc = H["finger_clearance"](mesh("FarBall", ball(0, -(RI + 2.5))), ring)
check("an object outside the far side clears by 2.0", abs(fc["clearance_mm"] - 2.0) < 0.01, fc)
fc = H["finger_clearance"](mesh("SideBall", ball(3.0, RI - 1.0)), ring)
check("an object beside the band but inside the hole radius reads -1.5",
      abs(fc["clearance_mm"] + 1.5) < 0.01, fc)
done()
