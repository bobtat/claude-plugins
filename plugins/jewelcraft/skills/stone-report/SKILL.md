---
name: stone-report
description: Lists every stone in the open Blender/JewelCraft design with cut, size, carat weight and quantity, and checks for overlapping stones, without opening a browser. Use when the user asks "how many carats", "list the stones", "stone report", "diamond weight", or "do any stones overlap".
---

# Stone report

1. Load the `jewelcraft:jewelcraft-blender` skill and its helpers (script at
   `../jewelcraft-blender/scripts/jc_helpers.py`, relative to this skill's folder), then
   run `H["check_setup"]()`. Stop and explain any blocking issue (no JewelCraft, no
   connection).
2. Run `result = bpy.app.driver_namespace["JC"]["stone_report"]()` (with the JSON print
   line from the `jewelcraft:jewelcraft-blender` skill). It reads the whole visible view
   layer and creates nothing permanent.
3. Report:
   - A table of stones: stone, cut, size (length × width, or diameter), ct each, qty,
     ct total.
   - Total carats (`total_ct`). Say these are JewelCraft's volume-based estimates, not
     graded weights.
   - JewelCraft's `warnings`, explained.
   - `stone_overlaps`: each pair listed either overlaps (`overlap_mm3`) or sits closer
     than 0.1 mm (`gap_mm`). Explain that JewelCraft's own check skips stones whose
     centres are 4 mm or more apart and treats stones as circles, missing square
     corners, which is why this mesh-based check exists.
4. If there are no gems, say so. Gems are objects with JewelCraft's gem identity; a mesh
   that only looks like a stone won't be listed (see `../jewelcraft-blender/references/gems.md` on
   `gem_edit`, which can tag a mesh as a gem; its arguments differ in JewelCraft 3.x).
5. Only use JewelCraft's file-based design report if the user asks for the HTML/JSON
   file. It opens a browser window on their computer, so say so first.
