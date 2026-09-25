"""corner_prong_settings and prong_report."""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from jc_test import *  # noqa: E402,F401,F403

H = load()
reset()


def grips(r):
    return [row["bite_pct_of_diameter"] for row in r["prongs_at_girdle"]]


def tips(r):
    return [row["tip_above_girdle_mm"] for row in r["prongs_at_girdle"]]


# The table in references/prongs.md
for (L, W, dia), (pos, inter) in (((8, 5.8, 0.8), (35.94, 45.73)), ((7, 5, 0.8), (35.54, 46.3)),
                                  ((10, 6.5, 1.0), (33.02, 62.49)), ((6, 6, 0.8), (45.0, -10.43))):
    s = H["corner_prong_settings"](L, W, dia)
    check(f"corner settings for {L} x {W}, d {dia}", (s["position_deg"], s["intersection"]) == (pos, inter), s)
s = H["corner_prong_settings"](6, 6, 0.8, bite_frac=0.235)
check("bite_frac 0.235 reproduces JewelCraft's square-cushion preset (-19.93%)", s["intersection"] == -19.93, s)

# Corner prongs on an elongated cushion
cushion = gem('CUSHION', 5.8, (0, 0, 0))
cushion.scale.y *= 8 / 5.8
bpy.context.view_layer.update()
cs = H["corner_prong_settings"](8, 5.8, 0.8)
corner = build(H, cushion, "prongs", number=2, use_symmetry=True, position=cs["position_rad"],
               intersection=cs["intersection"], diameter=0.8, taper=0.0)
r = H["prong_report"](cushion, corner)
check("corner prongs grip 33% at all four corners", len(grips(r)) == 4 and all(abs(g - 33) < 1 for g in grips(r)), grips(r))
check("corner prongs raise no note", "note" not in r, r.get("note"))
r = H["prong_report"](cushion, build(H, cushion, "prongs"))
check("JewelCraft's default prongs on an elongated cushion are flagged", "does not touch" in r.get("note", ""), r.get("note"))

# Pre-notched: the same prongs cut by the stone's cutter still read as designed.
cutter = build(H, cushion, "cutter")
cutter.scale.x *= cushion.dimensions.x / cushion.dimensions.y
cutter.hide_set(True)
boolean(corner, cutter)
r = H["prong_report"](cushion, corner)
check("notched prongs are measured without the notch (33%)", all(abs(g - 33) < 1 for g in grips(r)) and
      r.get("measured_without_notches") == ["Seat"], (grips(r), r.get("measured_without_notches")))
check("prong_report left the prongs' modifiers alone", [m.name for m in corner.modifiers] == ["Seat"])

# Tip heights on a 6.5 mm round (crown 1.136 mm)
rnd = gem('ROUND', 6.5, (0, 40, 0))
r = H["prong_report"](rnd, build(H, rnd, "prongs", number=4, use_symmetry=False, z1=1.5, bump_scale=0.5, diameter=0.8))
check("tall prongs: tips at 1.7 mm, no tip note", all(abs(t - 1.7) < 0.05 for t in tips(r)) and "crown" not in r.get("note", ""), tips(r))
short = build(H, rnd, "prongs", number=4, use_symmetry=False, z1=0.2, bump_scale=0.0, diameter=0.8)
r = H["prong_report"](rnd, short)
check("short prongs: tips at 0.2 mm flagged", tips(r) == [0.2] * 4 and "crown" in r.get("note", ""), (tips(r), r.get("note")))


def add_rim(ob, rad, z, thick=0.3):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.create_cone(bm, cap_ends=True, segments=64, radius1=rad, radius2=rad, depth=thick,
                          matrix=ob.matrix_world.inverted() @ Matrix.Translation(rnd.matrix_world.translation + Vector((0, 0, z))))
    bm.to_mesh(ob.data)
    bm.free()
    bpy.context.view_layer.update()


add_rim(short, 4.5, 1.8)
r = H["prong_report"](rnd, short)
check("a halo rim joined into the prongs doesn't raise the tips", tips(r) == [0.2] * 4 and "crown" in r.get("note", ""), tips(r))

plain = link("PlainGem", rnd.data.copy())
plain.matrix_world = rnd.matrix_world.copy()
bpy.context.view_layer.update()
r = H["prong_report"](plain, short)
check("a gem mesh without JewelCraft's identity works", r.get("crown_height_mm") == 1.136, r.get("crown_height_mm"))
check("no temporary objects left behind", not leftovers(), leftovers())
done()
