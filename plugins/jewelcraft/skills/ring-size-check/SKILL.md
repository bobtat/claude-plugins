---
name: ring-size-check
description: Measures the actual inside diameter of a ring band in Blender and reports its size in US, UK, Swiss, Japanese and Hong Kong systems, or converts a ring size to a diameter. Use when the user asks "what size is this ring", "check the ring size", "is this a size 7", "inside diameter", or "what diameter is size 8".
---

# Ring size check

1. Load the `jewelcraft:jewelcraft-blender` skill and its helpers (script at
   `../jewelcraft-blender/scripts/jc_helpers.py`, relative to this skill's folder), then
   run `H["check_setup"]()`. If units aren't 1 unit = 1 mm, say the numbers can't be
   trusted until that's fixed.
2. **Size → diameter** (no model needed):
   `H["size_to_diameter"](size, "US")`. Formats: US, UK (letter index: A = 0, so N = 13),
   CH, JP, HK. These come from JewelCraft's own size table (US 8 = 56.965 mm /
   18.1324 mm).
3. **Model → size:**
   1. Identify the band. Use the name the user gave; otherwise list mesh objects and ask.
      The band and head may be one object or several; pass the object that contains the
      finger hole.
   2. Run `H["ring_size"](name)`. It fits a circle to the inner surface, so a head or
      other parts on the same mesh don't affect it.
   3. Report the inner diameter and circumference, and the size in each system:
      - JP/HK `None` means no exact match.
      - US and CH sizes are shown to two decimals; state the nearest standard size and
        the difference in mm.
      - If `roundness_max_dev_mm` exceeds about 0.05 mm, say the inside isn't a true
        circle and the size is approximate.
4. If the user wants a different size, compute the target diameter with
   `size_to_diameter` and follow the band steps in the `jewelcraft:build-ring` skill. **Never set a
   ring size with `size_curve_add(size_us=...)` from a script:** it rounds to whole
   millimetres (US 8 became 18.00 mm instead of 18.13 mm). Pass `diameter` instead.
