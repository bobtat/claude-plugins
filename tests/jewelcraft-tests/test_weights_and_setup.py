"""densities, weigh's alloy list, check_setup."""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from jc_test import *  # noqa: E402,F401,F403

H = load()
reset()

s = H["check_setup"]()
check("JewelCraft found and enabled", s["jewelcraft"]["module"] and s["jewelcraft"]["enabled"], s["jewelcraft"])
check("a never-saved file is an issue", any("never been saved" in i for i in s["issues"]), s["issues"])
check("check_setup has notes", "notes" in s)

a = cube("A")
coll = bpy.context.scene.jewelcraft.weighting_materials.coll
g = {x["alloy"]: x for x in H["weigh"]([a])["weights_g"]}
check("scene alloys come with their composition",
      g["Platinum 950"] == {"alloy": "Platinum 950", "composition": "Pt 95%, Ru 5%", "g": 20.7}, g["Platinum 950"])

# The temp-scene recipe in blender-essentials.md §1 copies the list, compositions included.
test = bpy.data.scenes.new("TMP_TEST")
for m in coll:
    it = test.jewelcraft.weighting_materials.coll.add()
    it.name, it.density, it.enabled, it.composition = m.name, m.density, m.enabled, m.composition
copied = {m.name: m.composition for m in test.jewelcraft.weighting_materials.coll}
check("the temp-scene recipe copies compositions", copied["Platinum 950"] == "Pt 95%, Ru 5%")
bpy.data.scenes.remove(test)

for m in coll:
    m.enabled = False
w = H["weigh"]([a])
check("all alloys disabled falls back to the defaults", w["densities_from"].startswith("built-in defaults") and w["weights_g"], w["densities_from"])
coll.clear()
w = H["weigh"]([a])
g = {x["alloy"]: x for x in w["weights_g"]}
check("an empty list uses the defaults, with compositions", w["densities_from"] == "built-in defaults"
      and g["Yellow Gold 18K"]["g"] == 15.53 and g["Yellow Gold 18K"]["composition"].startswith("Au 75.3%"), g["Yellow Gold 18K"])
check("an empty list is a note, not an issue", any("weighting" in n for n in H["check_setup"]()["notes"]))
done()
