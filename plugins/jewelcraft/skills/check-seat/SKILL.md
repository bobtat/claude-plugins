---
name: check-seat
description: Verifies a stone seat in a Blender/JewelCraft design, checking that the cutter fits the stone, the Boolean cut is clean, and the stone clears the metal. Use when the user asks "check the seat", "does the stone fit", "is the cutter right", "does the stone collide with the metal", or after cutting a seat with a JewelCraft cutter.
---

# Check seat

1. Load the `jewelcraft:jewelcraft-blender` skill and its helpers (script at
   `../jewelcraft-blender/scripts/jc_helpers.py`, relative to this skill's folder), then
   run `H["check_setup"]()`.
2. Identify the gem, its cutter (usually a child of the gem named "Cutter…"), and the
   metal object the seat is cut into (the one with a Boolean modifier using that cutter:
   check `modifiers` for `BOOLEAN` with `object == cutter`). Ask if unclear.
3. Run `H["seat_report"](gem, cutter, metal)` (omit `metal` to check the cutter alone).
   It uses temporary copies and changes nothing.
4. Report:
   - **Cutter fit at the girdle:** cutter vs stone width × length, `stone_inside_cutter`,
     `min_clearance_mm`, `max_gap_mm`.
   - If there's a `note` about mismatched proportions, the cutter is square on an
     elongated stone. The fix is `cutter.scale.x *= gem.dimensions.x / gem.dimensions.y`
     (`../jewelcraft-blender/references/cutters-and-seats.md`). Apply it only if the user agrees, then re-run.
   - Gaps up to ~0.45 mm at the corners are JewelCraft's cutter design, not a fault.
   - **With metal:**
     - `stone_metal_overlap_mm3` should be 0; any overlap means the stone collides with
       the metal.
     - `control_overlap_without_modifiers_mm3` should be > 0. If it's 0, the stone isn't
       actually positioned in the metal, and the check proves nothing.
     - `metal_nonmanifold_edges` should be 0; anything else means the Boolean left holes
       or bad geometry.
5. Suggest next steps only from what the numbers show.
