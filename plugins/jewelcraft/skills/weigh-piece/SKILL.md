---
name: weigh-piece
description: Calculates the metal volume and weight of a jewelry piece in Blender for each alloy (gold karats, platinum, palladium, silver), counting overlapping parts only once. Use when the user asks "how much will this weigh", "weight in 18K", "metal weight", "how much gold", or "volume of the ring".
---

# Weigh piece

1. Load the `jewelcraft:jewelcraft-blender` skill and its helpers (script at
   `../jewelcraft-blender/scripts/jc_helpers.py`, relative to this skill's folder), then
   run `H["check_setup"]()`. If units aren't 1 unit = 1 mm, the weights will be wrong: say
   so and stop.
2. Identify the **metal** objects to weigh: band, head, prongs, galleries. **Exclude
   gems and cutters** (gems have JewelCraft's gem identity; cutters are usually children
   of gems named "Cutter…"). If unsure, list the candidates and ask.
3. Run `H["weigh"](names)`. It unions the parts on temporary copies, so overlaps count
   once, and changes nothing.
4. Report:
   - The volume in mm³, and the weight in the alloy the user cares about (ask if unknown;
     18K yellow gold is a sensible first line). Put the full alloy list in a short table.
   - If `overlap_counted_twice_mm3` is significant, say the parts overlap and that
     JewelCraft's own weight tool would have overstated the weight by that much.
   - `densities_from`: "scene" = the file's own alloy list; "built-in defaults" = the
     scene's list was empty.
   - Any part with non-manifold edges or `inside_out: true`: its volume, and therefore the
     weight, can't be trusted. Suggest the `jewelcraft:print-cast-check` skill.
   - Note that this is the weight of the model as modelled; the metal a caster needs will
     differ.
