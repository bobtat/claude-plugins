"""print_check and STL export."""
import os
import sys
import tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from jc_test import *  # noqa: E402,F401,F403

H = load()
reset()
out = tempfile.mkdtemp(prefix="jc_print_")


def stl(name):
    return os.path.join(out, name + ".stl")


a, b = cube("A"), cube("B", loc=(5, 0, 0))
far = cube("Far", loc=(30, 0, 0))
other = cube("Other", loc=(0, -20, 0))
H["select_only"](other)

r = H["print_check"]([a, b], parts_that_must_not_touch=[(a, far)], stl_path=stl("pair"))
check("export runs without a viewport and matches size and triangles",
      r["stl"]["matches"] and r["stl"]["stl_triangles"] == 24, r["stl"])
check("collision pairs accept objects", r["collisions"][0]["a"] == "A")
check("overlapping parts are one piece", r["pieces"] == 1 and not r["problems"], (r["pieces"], r["problems"]))
check("the user's selection is restored", other.select_get() and not a.select_get()
      and bpy.context.view_layer.objects.active == other)

r = H["print_check"]([a, far])
check("separate parts are flagged as loose pieces", r["pieces"] == 2 and any("separate pieces" in p for p in r["problems"]), r["problems"])

s = cube("Scaled", loc=(0, 40, 0))
s.scale = (1, 2, 1)
bpy.context.view_layer.update()
r = H["print_check"]([s])
check("unapplied scale is a warning, not a problem", not r["problems"] and r["warnings"], r)

m = cube("Mirrored", 4, (0, 60, 0))
m.scale.x = -1
bpy.context.view_layer.update()
rod = curve_rod("Rod", y=80)
for label, obs in (("negative scale", [m]), ("curve", [rod])):
    r = H["print_check"](obs, stl_path=stl(label))
    check(f"STL of a {label} object matches", r["stl"]["matches"], r["stl"])

b.hide_set(True)
r = H["print_check"]([a, b], stl_path=stl("hidden"))
check("a hidden part blocks the export", "stl" not in r and any("hidden" in p for p in r["problems"]), r["problems"])
b.hide_set(False)

u = cube("Locked", 4, (0, 100, 0))
u.hide_select = True
try:
    H["print_check"]([u], stl_path=stl("locked"))
    check("an unselectable part fails with the real reason", False)
except RuntimeError as e:
    check("an unselectable part fails with the real reason", "hide_select" in str(e), e)
check("selection restored after a failed export", other.select_get())
check("no temporary objects left behind", not leftovers(), leftovers())
done()
