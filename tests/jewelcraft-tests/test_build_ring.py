"""The build-ring skill followed end to end: a wrapped US 8 band, an 8 x 5.8 cushion,
pre-notched corner prongs, a seat, then every check skill's helper."""
import os
import sys
import tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from jc_test import *  # noqa: E402,F401,F403

H = load()
reset()
WIDTH, THICK = 2.5, 1.8
L, W = 8.0, 5.8
PRONG_D, Z1, Z2 = 1.0, 1.2, 1.5


def override():
    c = H["ctx"]()
    return bpy.context.temp_override(**c) if c else contextlib.nullcontext()


# 1. Band: a flat bar along X, bottom at Z = 0, 64+ segments, width on Y, thickness on Z.
def flat_bar(bm):
    g = bmesh.ops.create_cube(bm, size=1)["verts"]
    bmesh.ops.scale(bm, vec=(60, WIDTH, THICK), verts=g)
    bmesh.ops.translate(bm, vec=(0, 0, THICK / 2), verts=g)
    bmesh.ops.subdivide_edges(bm, edges=[e for e in bm.edges
                                         if abs(e.verts[0].co.x - e.verts[1].co.x) > 1], cuts=95)


bar = mesh("R1 Band", flat_bar)
ring_d = H["size_to_diameter"](8, "US")["diameter_mm"]
H["select_only"](bar)
with override():
    bpy.ops.curve.jewelcraft_size_curve_add(diameter=ring_d, curve_start_pos='BOTTOM')
H["select_only"](bar)
bpy.ops.object.jewelcraft_stretch_along_curve()
H["select_only"](bar)
bpy.ops.object.jewelcraft_move_over_under(position='OVER', individual=True)
bpy.context.view_layer.update()
rs = H["ring_size"](bar)
check("wrapped band reads US 8", abs(rs["inner_diameter_mm"] - US8) < 0.03 and "warning" not in rs, rs["inner_diameter_mm"])

# 2. Stone: girdle 1 mm above the band is too low for a 5.8 mm cushion.
top = max((bar.matrix_world @ v.co).z for v in bar.evaluated_get(bpy.context.evaluated_depsgraph_get()).to_mesh().vertices)
bpy.context.scene.cursor.location = (0, 0, top + 1.0)
with override():
    bpy.ops.object.jewelcraft_gem_add(cut='CUSHION', stone='DIAMOND', size=W)
stone = bpy.context.object
stone.scale.y *= L / W
bpy.context.view_layer.update()
fc = H["finger_clearance"](stone, bar)
check("a girdle 1 mm above the band puts the culet in the finger hole", abs(fc["clearance_mm"] + 0.207) < 0.01, fc)
stone.location.z += 0.3 - fc["clearance_mm"]   # build-ring 2.2: move out by the shortfall + margin
bpy.context.view_layer.update()
fc = H["finger_clearance"](stone, bar)
check("after raising the stone the culet clears by the margin", abs(fc["clearance_mm"] - 0.3) < 0.01, fc)

# 3. Prongs
cs = H["corner_prong_settings"](L, W, PRONG_D)
prongs = build(H, stone, "prongs", number=2, use_symmetry=True, position=cs["position_rad"],
               intersection=cs["intersection"], diameter=PRONG_D, z1=Z1, z2=Z2)
pr = H["prong_report"](stone, prongs, prong_diameter=PRONG_D)
check("prongs grip 30-50% and reach halfway up the crown", "note" not in pr, pr.get("note"))

# 5. Seat, pre-notched prongs
cutter = build(H, stone, "cutter")
cutter.scale.x *= stone.dimensions.x / stone.dimensions.y
for target in (bar, prongs):
    boolean(target, cutter)
cutter.hide_set(True)
bpy.context.view_layer.update()
sr = H["seat_report"](stone, cutter, bar)
check("stone clears the band", sr["stone_metal_overlap_mm3"] == 0, sr)
check("seat control keeps the curve wrap", sr["control_overlap_without_seat_mm3"] > 0, sr)
check("seat is manifold, stone inside the cutter", sr["metal_nonmanifold_edges"] == 0 and sr["stone_inside_cutter"], sr)
pr = H["prong_report"](stone, prongs)
check("notched prongs still read 33%", all(abs(r["bite_pct_of_diameter"] - 33) < 1 for r in pr["prongs_at_girdle"]), pr.get("note"))
check("band still reads US 8 after the seat", abs(H["ring_size"](bar)["inner_diameter_mm"] - US8) < 0.03)

# 6. Finish
w = H["weigh"]([bar, prongs])
check("band and prongs weigh without inside-out parts", w["volume_mm3"] > 50 and not any(p["inside_out"] for p in w["parts"]), w["volume_mm3"])
st = H["stone_report"]()
check("stone report: one stone, no overlaps", len(st["gems"]) == 1 and not st["stone_overlaps"], st["gems"])
pc = H["print_check"]([bar, prongs], parts_that_must_not_touch=[(stone, bar), (stone, prongs)],
                      stl_path=os.path.join(tempfile.mkdtemp(prefix="jc_ring_"), "ring.stl"))
check("STL matches the model", pc["stl"]["matches"], pc["stl"])
check("no stone/metal collisions", all(c["overlap_mm3"] == 0 for c in pc["collisions"]), pc["collisions"])
# With no head, the corner prongs sit beyond the 2.5 mm band's edges.
check("prongs with no head are flagged as loose pieces", pc["pieces"] == 5, pc["pieces"])
check("no temporary objects left behind", not leftovers(), leftovers())
done()
