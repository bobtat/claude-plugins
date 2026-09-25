# JewelCraft 3.x differences [source: v3.0.1; nothing here has been run]

- Requires Blender 4.5+. Adds headless support. Gem, prong, cutter, distribute and
  microprong tools can run outside the 3D view.
- `prongs_add` works with a plain EXEC call: it reads each selected gem's dimensions and
  groups gems by size. EXEC **does not apply presets**, so pass every setting (the
  property defaults are small: diameter 0.4, z1 0.4, z2 0.5). Don't use the 2.18 builder
  recipe.
- `cutter_add` also runs from EXEC, but its dimensions are nested property groups
  (`handle_dim`, `girdle_dim`, `hole_dim`) that default to 0, so a bare call gives a
  degenerate cutter. Use the builder with the new signatures, or set the groups and
  check the result with `H["seat_report"]`.
- New signatures that break the 2.18 recipe:
  - `prongs_mesh.get(self, gem_dim)` (no `create_prongs`)
  - `prongs_presets.init_presets(self, gem_dim, cut, shape)`
  - `cutter_mesh.get(self, gem_dim, active_dim)`
  - `cutter_presets.init_presets(self, gem_dim)`
  - `asset.bm_to_scene(bm, coll, name, *, color)`
  - new: `asset.bm_to_parent(bm, obs, name, *, color)`
- New tool: `object.jewelcraft_prongs_auto_add` (prongs between selected gems).
- The cutter has a new `seat_depth` setting. Stones and cuts are unchanged.
- The helpers use only operators and modules that exist in both versions (`gemlib`,
  `ringsizelib`, `design_report`), but they have only been run on 2.18.1. Re-check their
  results against known geometry before relying on them with 3.x.

Source: https://github.com/mrachinskiy/jewelcraft/tree/v3.0.1/source
