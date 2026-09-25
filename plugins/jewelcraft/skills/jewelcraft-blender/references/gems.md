# Gems

## What `size` means in `gem_add`

`gem_add` scales JewelCraft's unit gem mesh uniformly by `size`. Measured in 2.18.1: [verified]
- **Round, square-family and other symmetric cuts:** 1 × 1, so `size` = diameter / side.
- **Oval and pear:** X = 0.625. **Marquise, baguette:** 0.5. **Emerald:** 0.714. All of
  these have Y = 1, so **`size` is the length (Y)**. Oval and pear also get a lookup-table
  width correction, but only at sizes that round to OVAL 5–12, 14, 16, 18, 20 and PEAR 5,
  6, 7, 9, 10, 12–16, 18, 20 mm; other sizes keep the unit mesh's width
  (`operators/gem/gem_ratio.py`). [source]
  Example: OVAL `size=8` gave 8.0 (Y) × 6.0 (X) × 3.06 mm.
- **Heart, trillion, trilliant:** X = 1, so `size` is the width (X).
- **Triangle:** Y = 1, X = 1.155, so `size` is Y.

For a specific L × W, add the gem, then set `gem.scale.x` / `gem.scale.y`.

## Proportions and identity

- The gem mesh is unit-sized and scaled by the object. The girdle is at local z = 0.
  CUSHION: crown top ≈ +0.168 × size, culet ≈ −0.518 × size (depth ≈ 0.69 × width).
  [verified]
- The gem's identity is stored in `ob["gem"] = {"cut", "stone"}`. JewelCraft's size-aware
  tools read `dimensions.y` as the size (`dimensions.x` for heart, trillion and
  trilliant). [source]
- **Elongated cushions:** JewelCraft's CUSHION is square-shaped. Stretch with
  `gem.scale.y *= L / W`. The gem and the report handle it (8.0 × 5.8 mm = 1.396 ct).
  Prongs and cutters need the fixes in prongs.md and cutters-and-seats.md. [verified]

## `gem_edit`

`gem_edit` acts on every selected mesh. In 2.18.1:
- `use_force=True` **replaces the mesh** with JewelCraft's gem for `cut`, scaled
  uniformly to the object's Y dimension, and renames the object.
- To turn your own mesh into a gem without touching its geometry, pass
  `use_force=True, use_id_only=True, cut=..., stone=...`. A test cube kept its 8 vertices
  with `use_id_only`, and became a 153-vertex "Round" without it. [verified]
- **Always pass both `cut` and `stone`**, using the gem's current values for the one you
  aren't changing. They default to ROUND and DIAMOND on every call, even without
  `use_force`: `gem_edit(stone='RUBY')` on an oval sees the cut differ, replaces the mesh
  with a round scaled to the oval's length, and loses its shape; `gem_edit(cut='OVAL')`
  on a ruby resets it to diamond. [source]

JewelCraft 3.x removed `use_force` and `use_id_only`; passing them raises a TypeError.
See jewelcraft-3x.md.

## Carats

- `gemlib.ct_calc(stone, cut, (x, y, z))` with dims in mm, or `H["gems_in_scene"]()` /
  `H["stone_report"]()`.
- It's a volume estimate (cone/pyramid/prism × a per-cut correction × stone density),
  so it can differ slightly from JewelCraft's own mm-to-carat table for round diamonds
  (0.00365 × d³; 6.5 mm round: 1.004 vs 1.002 ct). The trade's D² × depth × 0.0061
  formula needs the stone's measured depth.
- For the 8 × 5.8 cushion, `ct_calc`, the report and the mesh's own volume (79.17 mm³ ×
  3.53 g/cm³ × 5 ct/g → 1.397 ct) all agree. [verified]
- Densities are in `gemlib.STONES` (diamond 3.53, corundum 4.1, beryl 2.76, quartz 2.65,
  …). [source] Coloured-stone estimates are rougher than diamond's: some of these
  densities run high (corundum is usually given as 4.00, spinel about 3.60, tourmaline
  about 3.06), garnet covers species from about 3.6 to 4.3, and coloured stones are cut
  to less standard proportions. [cited: GIA, Gem-A]
