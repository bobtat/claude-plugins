# JewelCraft 3.x differences [source]

Read in the v3.0.1 source; nothing here has been run.

- Requires Blender 4.5+. Adds headless support. Gem, prong, cutter, distribute and
  microprong tools no longer need the 3D view, **but that doesn't make them work from a
  script**: distribute and microprong still read values set in `invoke()` and still do
  nothing or fail from EXEC.
- `lattice_profile` and `lattice_project` now compute their bounding box in `execute()`,
  so they do work from a script in 3.x.
- `size_curve_add(size_us=...)` no longer rounds to whole millimetres
  (`diameter_precision` now defaults to 2). Passing `diameter` still works on both
  versions.
- `prongs_add` works with a plain EXEC call: it reads each selected gem's dimensions and
  groups gems by size. EXEC **does not apply presets**, so pass every setting (the
  property defaults are small: diameter 0.4, z1 0.4, z2 0.5). Don't use the 2.18 builder
  recipe.
- `cutter_add` also runs from EXEC, but its dimensions are nested property groups
  (`handle_dim`, `girdle_dim`, `hole_dim`) that default to 0, so a bare call gives a
  degenerate cutter. It also defaults to a **round** cutter (`cut="ROUND"`,
  `shape=1`) whatever the gem is, and `use_handle`/`use_hole` default to off. Pass
  `cut=` and `shape=` (`gemlib.CUTS[cut].shape`) as well as the dimension groups, with
  the gem active (an active object with a zero dimension raises ZeroDivisionError).
  Check the result with `H["seat_report"]`.
- Rectangular cutters (baguette, emerald) now get the girdle offset on X too, so they
  differ from 2.18's.
- **`gem_edit` arguments changed:** `use_force` and `use_id_only` are gone, replaced by
  `filter_gems`, `edit_id`, `edit_mesh` and `edit_mat` (all default on). The 2.18
  "ID only" call becomes `filter_gems=False, edit_mesh=False, edit_mat=False`. Passing
  the old names raises a TypeError.
- New signatures that break the 2.18 recipe:
  - `prongs_mesh.get(self, gem_dim)` (no `create_prongs`)
  - `prongs_presets.init_presets(self, gem_dim, cut, shape)`
  - `cutter_mesh.get(self, gem_dim, active_dim)`
  - `cutter_presets.init_presets(self, gem_dim)`
  - `asset.bm_to_scene(bm, coll, name, *, color)`
  - new: `asset.bm_to_parent(bm, obs, name, *, color)`
- New tools: `object.jewelcraft_prongs_auto_add` (prongs between selected gems),
  `object.jewelcraft_incremental_resize`, and a Gems Magnet tool in the UI.
- Unreleased master (after 3.0.1) changes `prongs_mesh.get` again, to
  `get(self, gem_size)`. Check the installed version's source before using the builder.
- The cutter has a new `seat_depth` setting. Stones and cuts are unchanged.
- The helpers use only modules that exist in both versions (`gemlib`, `ringsizelib`,
  `gettext`, `design_report`; the builder recipe also uses `var`), but they have only been
  run on 2.18.1. The skills also call
  operators (`gem_edit`, `cutter_add`, the builder recipe) whose arguments changed as
  above. Re-check results against known geometry before relying on them with 3.x.

Source: https://github.com/mrachinskiy/jewelcraft/tree/v3.0.1/source
