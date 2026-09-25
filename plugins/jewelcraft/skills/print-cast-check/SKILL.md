---
name: print-cast-check
description: Checks a jewelry model in Blender before 3D printing or casting (closed mesh, inward normals, minimum wall thickness, collisions between parts, applied scale, millimetre units) and optionally exports and verifies an STL. Use when the user asks "is this ready to print", "check before casting", "export STL", "wall thickness", or "is the mesh manifold".
---

# Print / cast check

1. Load the `jewelcraft:jewelcraft-blender` skill and its helpers (script at
   `../jewelcraft-blender/scripts/jc_helpers.py`, relative to this skill's folder), then
   run `H["check_setup"]()`.
2. Identify the parts to check (the metal parts that will be printed or cast; not gems or
   cutters), and pairs of parts that must not intersect (e.g. stone and metal). Ask if
   unclear.
3. **Minimum wall thickness:** ask the user, or their printer or caster, for the number.
   It depends on material and process, and this plugin has no sourced value. If they
   don't know, run without it and report the thinnest wall found.
4. Run `H["print_check"](parts, min_wall_mm=..., parts_that_must_not_touch=[(a, b), ...])`.
   - To export, confirm the file path with the user first, then pass `stl_path=...`.
     The helper exports the selected parts with modifiers applied, reads the file back,
     and checks its size against the model (millimetres). The user's selection is
     restored.
5. Report `problems` first, then the per-part table: volume, non-manifold edges,
   inside-out, thinnest wall and where, scale.
   - **Thinnest wall:** the location matters. Knife edges and seat rims read as very thin
     walls (a seat rim measured 0.117 mm on a test plate). Say where it is and whether it
     looks like a rim or a real thin wall.
   - Non-manifold or inside-out parts aren't printable as they are. Suggest fixes (Boolean
     union with Exact, voxel Remesh, recalculate normals) and apply them only with the
     user's agreement, on a copy.
   - Unapplied scale is usually harmless for export, but it makes Solidify and similar
     thicknesses uneven.
   - STL `matches: false` means the export scale is wrong. Never set
     `use_scene_unit=True`: it writes metres (1000× too small).
