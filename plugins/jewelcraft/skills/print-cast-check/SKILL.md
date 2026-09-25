---
name: print-cast-check
description: Checks a jewelry model (ring, pendant, setting) in Blender before 3D printing or casting (closed mesh, inward normals, minimum wall thickness, stone/metal collisions, millimetre units, casting shrinkage) and optionally exports and verifies an STL. Use when the user asks "is this ring ready to print", "check the ring before casting", "export the piece as STL for my caster", or "are the prongs thick enough to cast". For non-jewelry models, use the general Blender modeling skill instead.
---

# Print / cast check

1. Load the `jewelcraft:jewelcraft-blender` skill and its helpers (script at
   `../jewelcraft-blender/scripts/jc_helpers.py`, relative to this skill's folder), then
   run `H["check_setup"]()`.
2. Identify the parts to check (the metal parts that will be printed or cast; not gems or
   cutters), and pairs of parts that must not intersect (e.g. stone and metal). Ask if
   unclear.
3. **Ask the user, or their printer or caster**, for what depends on their process. This
   plugin has no sourced values for these:
   - **Minimum wall thickness.** If they don't know, run without it and report the
     thinnest wall found.
   - **Shrinkage.** Castings come out smaller than the model. Figures quoted by bench
     jewelers range from about a quarter of a ring size for a direct cast to several
     percent through rubber moulds, so a ring modelled at its exact size can come back a
     size small. Ask whether the caster compensates or wants the model scaled, and
     their sizing tolerance. Don't scale the model yourself without that answer.
     (Ganoksin Orchid, "Casting shrinkage": https://orchid.ganoksin.com/t/casting-shrinkage/48368)
   - **Finishing allowance:** how much metal polishing and cleanup will remove,
     especially inside the band (it enlarges the size) and on prong tips.
4. Run `H["print_check"](parts, min_wall_mm=..., parts_that_must_not_touch=[(a, b), ...])`.
   - To export, confirm the file path with the user first, then pass `stl_path=...`.
     The helper exports the listed parts with modifiers applied, reads the file back,
     and checks its size and triangle count against the model (millimetres). The user's
     selection is restored. A part hidden in the viewport stops the export; ask the user
     whether to unhide it or leave it out.
5. Report `problems` first, then `warnings`, then the per-part table: volume,
   non-manifold edges, inside-out, thinnest wall and where, scale.
   - **Thinnest wall:** the location matters. Knife edges and seat rims read as very thin
     walls (a seat rim measured 0.117 mm on a test plate). Say where it is and whether it
     looks like a rim or a real thin wall.
   - Non-manifold or inside-out parts aren't printable as they are. Suggest fixes (Boolean
     union with Exact, voxel Remesh, recalculate normals) and apply them only with the
     user's agreement, on a copy.
   - Unapplied scale is a warning, not a problem: harmless for export, but it makes
     Solidify and similar thicknesses uneven. Bands built with `jewelcraft:build-ring`
     always have it (Stretch Along Curve scales the bar).
   - STL `matches: false` means a part is missing (triangle count differs) or the export
     scale is wrong (size differs). Never set `use_scene_unit=True`: it writes metres
     (1000× too small).
6. Mention what the helpers don't check, so the user can raise it with the caster:
   sprue placement (usually a heavy section, away from seats and prongs), narrow gaps
   between parts that investment can fill or metal can bridge, and point protection
   (V-prongs) for pear, marquise, princess and heart stones. [guidance]
