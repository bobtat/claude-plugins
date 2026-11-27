# JewelCraft operators from Python (2.18.1)

## Finding the add-on

JewelCraft ships as an extension, so its module has **no `bl_info`**. Use
`H["addon_name"]()` (usually `bl_ext.user_default.jewelcraft`) and `H["jc_version"]()`,
which calls `addon_utils.module_bl_info`. [verified]

## Kwargs vs. clicks

- Operator kwargs **do** trigger property update callbacks, e.g.
  `gem_add(stone='RUBY')` gets the correct red material. [verified]
- Anything an operator sets in `invoke()` (a click) stays at its default from a script.
  `size_curve_add(size_us=8)` rounds the diameter to `diameter_precision`, which is set
  only in `invoke()`, so the curve comes out **18.00 mm instead of 18.13 mm**. Always
  pass `diameter`. [verified]
- These fail on a plain EXEC call because they compute required values in `invoke()`:
  `prongs_add` (`gem_dim`), `cutter_add`, `lattice_profile` (`BBox`), `lattice_project`,
  `curve_redistribute`, `microprong_cutter_add`, `resize` (`dim_orig`), and
  `gem_recover` (modal). prongs_add and lattice_profile [verified]; the rest [source]
- `curve_distribute` from EXEC usually **does nothing and returns FINISHED**: with an
  empty size list it exits early. It raises only if an earlier click left sizes behind.
  [source]
- To check another operator, read its `invoke()`. If it assigns `self.x` that
  `execute()` reads, EXEC will fail.

## Operators that work from a script

| Operator | Notes |
|---|---|
| `object.jewelcraft_gem_add(cut, stone, size)` | Gem at the 3D cursor; becomes the only selected and active object. `size` depends on the cut (gems.md). Needs no viewport: it ran in background Blender with no override. [verified] |
| `curve.jewelcraft_size_curve_add(diameter=...)` | Ring-size Bezier circle in the XZ plane, named "Size". Adds a Curve modifier to every object selected *before* the call, then leaves only the curve selected and active. From a script, pass `diameter` and `curve_start_pos` (`TOP`, the default, rotates the curve 180° about Z). [verified] |
| `object.jewelcraft_stretch_along_curve()` | Scales selected curve-deformed meshes on X to span the curve. Skips non-meshes. No override needed. [verified] |
| `object.jewelcraft_move_over_under(position='OVER', individual=True)` | Puts each selected deformed mesh's bottom on the curve. `individual=True` needs no override. The default acts on the active object and would move a selected curve too. [verified] |
| `object.jewelcraft_weight_display()` | Volume + weight, one `Info:` line per enabled alloy in the current scene's list. Works on meshes, curves, text and metaballs. Prefer `H["weigh"]`, which handles overlaps. [verified] |
| `wm.jewelcraft_design_report(filepath=..., file_format='JSON', use_preview=False)` | Writes a report file **and opens it in the web browser** (unless Blender runs in background mode). Prefer `H["stone_report"]()`, which returns the same data with no file or browser. [verified] |
| `object.jewelcraft_gem_edit(cut, stone, use_force, use_id_only)` | Always pass both `cut` and `stone`; they reset to ROUND/DIAMOND otherwise [source]. Arguments differ in 3.x. See gems.md before using. `use_id_only` [verified] |
| `object.jewelcraft_gem_select_overlapping(threshold=0.1)` | Selects gems closer than `threshold` mm, **but only compares gems whose centres are within 4 mm** (two overlapping 8 mm rounds 6 mm apart were missed) [verified], and treats each stone as a circle [source]. `H["stone_overlaps"]()` checks the meshes. |
| `scene.jewelcraft_scene_units_set()` | Sets 1 unit = 1 mm and the grid scale. Needs the viewport override. [verified] |

## Prongs and cutters: builder recipe (2.18.1 only)

Call JewelCraft's own mesh builders with a stand-in `self`, then its `bm_to_scene`, which
parents the result to the selected gem. [verified]

```python
import bpy, math
from types import SimpleNamespace as NS
H = bpy.app.driver_namespace["JC"]
pm = H["jc"](".operators.add_prongs.prongs_mesh"); pp = H["jc"](".operators.add_prongs.prongs_presets")
cm = H["jc"](".operators.add_cutter.cutter_mesh"); cp = H["jc"](".operators.add_cutter.cutter_presets")
gemlib = H["jc"](".lib.gemlib"); asset = H["jc"](".lib.asset")
prefs = bpy.context.preferences.addons[H["jc"](".var").ADDON_ID].preferences

def jc_build(gem, builder, presets, color, name, **overrides):
    s = NS(gem_dim=gem.dimensions.copy(), cut=gem["gem"]["cut"], color=color,
           handle_dim=NS(x=0, y=0, z1=0, z2=0), girdle_dim=NS(x=0, y=0, z1=0, z2=0),
           hole_dim=NS(x=0, y=0, z1=0, z2=0), mul_1=1.0, mul_2=1.0, mul_3=1.0,
           handle_shift=0.0, hole_shift=0.0)
    s.shape = gemlib.CUTS[s.cut].shape
    presets(s)                                  # JewelCraft's defaults for this cut/size
    for k, v in overrides.items(): setattr(s, k, v)
    bm = builder(s)
    before = set(gem.children)
    H["select_only"](gem)
    with bpy.context.temp_override(**H["ctx"]()):
        asset.bm_to_scene(bm, name=name, color=color)
    return next(c for c in gem.children if c not in before)

prongs = jc_build(gem, pm.create_prongs, pp.init_presets, prefs.color_prongs, "Prongs")
cutter = jc_build(gem, cm.get, cp.init_presets, prefs.color_cutter, "Cutter")
```
Pass prong settings (prongs.md) as keyword overrides, e.g.
`number=2, use_symmetry=True, position=..., intersection=..., diameter=0.8`.
In JewelCraft 3.x these functions have different signatures (jewelcraft-3x.md).

## Enum lists

`get_rna_type()` shows cuts and stones as empty (they're dynamic). Get them from the add-on:
```python
dl = H["jc"](".lib.dynamic_list")
cuts = [i[0] for i in dl.cuts(None, bpy.context)]
stones = [i[0] for i in dl.stones(None, bpy.context)]
```
2.18.1 cuts: ROUND OVAL CUSHION PEAR MARQUISE PRINCESS BAGUETTE SQUARE EMERALD ASSCHER
RADIANT FLANDERS OCTAGON HEART TRILLION TRILLIANT TRIANGLE. Stones: ALEXANDRITE AMETHYST
AQUAMARINE CITRINE CUBIC_ZIRCONIA DIAMOND EMERALD GARNET MORGANITE PERIDOT QUARTZ RUBY
SAPPHIRE SPINEL TANZANITE TOPAZ TOURMALINE ZIRCON (no moissanite). [verified]
