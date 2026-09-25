---
name: check-prongs
description: Measures how each prong grips a stone's girdle in a Blender/JewelCraft design and suggests corrected settings, including corner prongs on elongated cushions. Use when the user asks "check my prongs", "are the prongs touching the stone", "prong grip", "fix the prongs", or after adding prongs to a gem.
---

# Check prongs

1. Load the `jewelcraft:jewelcraft-blender` skill and its helpers (script at
   `../jewelcraft-blender/scripts/jc_helpers.py`, relative to this skill's folder), then
   run `H["check_setup"]()`.
2. Identify the gem and prong object pairs. JewelCraft parents prongs to their gem, so
   check each gem's children for prong objects first. Otherwise use the names the user
   gave, or ask.
3. For each pair, run `H["prong_report"](gem, prongs)`. It slices the prongs at the
   girdle plane and changes nothing. Pass `prong_diameter=` if the prong setting is known
   (from the build or the user); for tapered prongs, ask for it. If the prongs are
   already notched (a Difference Boolean with the cutter), the report measures them
   without the notch and lists it in `measured_without_notches`.
4. Report per prong: position (angle), diameter at the girdle, and grip (`bite_mm`,
   `bite_pct_of_diameter`).
   - **Negative bite = gap: that prong doesn't touch the stone.** Say this plainly.
   - Bench guidance is a notch of 30–50% of the prong's thickness; the report adds a
     `note` for any prong under 30%. See `../jewelcraft-blender/references/prongs.md`
     ("How much grip is enough"), including whether the prongs will be pre-notched or
     notched by the setter.
   - Uneven grip between prongs usually means the stone or prongs are off-centre or
     rotated.
   - Tip height: `tip_above_girdle_mm` against `crown_height_mm`. A tip below halfway up
     the crown is too short to fold over the stone.
5. For cushions, the report includes `suggested_corner_settings` (position,
   intersection) for corner prongs with a 33% notch, computed from `prong_diameter` (or
   the measured diameter at the girdle, which overstates a tapered prong). Explain what
   would change. **Rebuild the prongs only if the user agrees.** Use the builder recipe in
   `../jewelcraft-blender/references/operators.md` with `position=s["position_rad"]` and
   `intersection=s["intersection"]` (where `s` is the suggestion), name the new object clearly, and
   leave the old prongs untouched (hidden or kept) until the user confirms.
6. After any rebuild, run `prong_report` again and report the new numbers.
