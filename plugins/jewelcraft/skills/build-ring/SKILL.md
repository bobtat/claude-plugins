---
name: build-ring
description: Step-by-step workflow for building a ring in Blender with JewelCraft (a sized band from a flat profile, a stone, prongs and a seat), with a check after each stage. Use when the user asks to "build a ring", "make a solitaire", "model a band in size 7", "make an engagement ring", or wants to start a ring design from scratch.
---

# Build a ring

The band, stone, prong and seat stages below were tested end to end in Blender 5.1.1 with
JewelCraft 2.18.1. **Heads (baskets, cathedral arches, curved claws) have no tested
workflow yet.** See `../jewelcraft-blender/references/heads.md`, and tell the user that part is unverified.

## 0. Prepare

1. Load the `jewelcraft:jewelcraft-blender` skill and its helpers (script at
   `../jewelcraft-blender/scripts/jc_helpers.py`, relative to this skill's folder), then
   run `H["check_setup"]()`. The file must be saved, and 1 unit = 1 mm.
2. Agree the key numbers with the user before building. Don't invent them:
   - ring size (and system)
   - band width and thickness
   - stone cut, stone, and size (L × W for non-round stones)
   - prong count, prong diameter and heights (`z1`, `z2`). JewelCraft's preset is 0.8 mm
     for every stone of 2.5 mm or more, which is light for a large centre stone; ask
     rather than accept it.
   - whether the prongs will be pre-notched in the model or notched by the setter
     (`../jewelcraft-blender/references/prongs.md`, "How much grip is enough")
   - metal
3. Build in the user's scene only if they want it there; otherwise use a new scene
   (`../jewelcraft-blender/references/blender-essentials.md` §1). Prefix object names ("R1 Band", "R1 Gem", …)
   so parts are easy to find.

## 1. Band (flat, then wrapped) [verified]

1. Build the band as a **flat bar**: along X, centred on the origin, bottom at local
   Z = 0, 64+ segments along X, band width on Y, thickness on Z. Shape the profile,
   taper and shoulders now, while it's straight.
2. `ring_d = H["size_to_diameter"](size, system)["diameter_mm"]`
3. `H["select_only"](bar)`, then with `temp_override(**H["ctx"]())`:
   `bpy.ops.curve.jewelcraft_size_curve_add(diameter=ring_d, curve_start_pos='BOTTOM')`.
   Pass `diameter`, never `size_us`. The new curve is now the only selected object.
4. **`H["select_only"](bar)` again**, then `bpy.ops.object.jewelcraft_stretch_along_curve()`.
   Skipping the re-select leaves the bar unstretched.
5. With only the bar selected:
   `bpy.ops.object.jewelcraft_move_over_under(position='OVER', individual=True)`.
6. **Check:** `H["ring_size"](bar)` should report the requested size (a US 8 test band
   read 18.134 mm → US 8).

## 2. Stone [verified]

1. Set the 3D cursor where the stone sits, then with the override:
   `bpy.ops.object.jewelcraft_gem_add(cut=..., stone=..., size=...)`.
   - `size` is the length (Y) for oval, pear, marquise, emerald, baguette and triangle,
     and the width (X) for heart, trillion and trilliant
     (`../jewelcraft-blender/references/gems.md`).
   - For an elongated cushion or other square-shaped cut: add at the width, then
     `gem.scale.y *= L / W`.
2. **Check:** `H["gems_in_scene"]()` for size and carats, and
   `H["finger_clearance"](gem, bar)`: `clearance_mm` must be positive, or the culet will
   touch the finger. Agree a margin with the user.

## 3. Prongs [verified]

1. Build with the builder recipe (`../jewelcraft-blender/references/operators.md`),
   passing `diameter=prong_d` and the heights (`z1`, `z2`) agreed in step 0. For a
   cushion, also pass `number=2, use_symmetry=True` and the output of
   `H["corner_prong_settings"](L, W, prong_d)` (`position=..["position_rad"]`,
   `intersection=..["intersection"]`).
2. **Check:** run the `jewelcraft:check-prongs` skill (`H["prong_report"]`). Every prong
   should grip 30–50% of its thickness and reach at least halfway up the crown.

## 4. Head [not yet tested]

Model the head (gallery rails, basket or cathedral arches) with ordinary Blender modeling,
using `../jewelcraft-blender/references/heads.md` for anatomy and starting proportions. Say it's unverified.
Measure it: prong grip, collisions with the stone, wall thickness.

## 5. Seat [verified]

1. Build the cutter with the builder recipe. For square-shaped cuts on elongated stones:
   `cutter.scale.x *= gem.dimensions.x / gem.dimensions.y`.
2. Add a Boolean (Difference, Exact) on the metal part that holds the stone, with the
   cutter as its object. If the prongs are pre-notched, add the same Boolean to the
   prongs; if the setter will notch them, leave the prongs uncut and out of the
   stone/metal collision pairs.
3. **Check:** run the `jewelcraft:check-seat` skill (`H["seat_report"](gem, cutter, metal)`).

## 6. Finish

- Run the `jewelcraft:weigh-piece` skill for metal weight, and the `jewelcraft:stone-report` skill for carats.
- Before printing or casting, run the `jewelcraft:print-cast-check` skill. It asks about
  casting shrinkage: a ring modelled at its exact size can come back small.
- Report measured numbers (size, carats, weight, clearances), not impressions from a
  screenshot.
