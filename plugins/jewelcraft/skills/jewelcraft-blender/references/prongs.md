# Prongs (JewelCraft 2.18.1 `prongs_mesh.py`)

Each prong is a straight, optionally tapered cylinder with a domed top, built at the gem
origin and then positioned. There is no curved-prong mode; curved claws are ordinary
Blender modeling (see heads.md). [source]

## Settings

- `z1` = height above the girdle where the dome starts. The tip is at
  `z1 + bump_scale × diameter/2`. `z2` = depth of the base below the girdle.
- `diameter`; `taper` (0–1) widens the base radius by `(1 + taper)`; `bump_scale` = dome
  height as a fraction of the radius (0 = flat top).
- `intersection` (%) = how far the prong moves into the girdle, **as a percentage of the
  prong diameter** (negative = further out).
- `position` = angle, clockwise from +Y, of the first prong. `number` = copies spread over
  360°. `use_symmetry` mirrors every prong's Y coordinate (a mirror across the XZ plane),
  so `number=2` + symmetry = 4 prongs. `symmetry_pivot` rotates the whole set.
- `alignment` = tilt. **Positive tilts the tips outward and pulls the bases in**
  (basket/cathedral look); negative does the opposite. At +10°, a 4 mm prong shifts
  4 × sin 10° ≈ 0.7 mm between top and base. [verified]
- Presets: cushion/square → 2 + symmetry at 45°, intersection −20% (octagon 0%).
  Rectangle → 2 + symmetry at 36° (baguette 29°). Round → 1 + symmetry at 60° (**2
  prongs**; set `number`/`use_symmetry` yourself for 4 or 6). Triangle and heart → 3,
  no symmetry. Diameter 0.8 mm for gems ≥ 2.5 mm; fantasy cuts use 0.28 × width. [source]

## Elongated stones: presets float

Prongs sit on a circle of radius `gem_dim.y/2 + radius − intersection`. On an elongated
stone (Y = length) that circle is wider than the stone's sides. **On an 8 × 5.8 cushion
the presets left all four prongs 0.49 mm clear of the girdle.** [verified]

## Corner prongs on an elongated cushion [verified to ±0.004 mm]

JewelCraft's square-cushion preset makes each prong overlap the girdle by 23.5% of its
diameter. `H["corner_prong_settings"](L, W, d)` reproduces that on an L × W cushion:
```python
bite  = 0.235 * d
theta = math.atan(W / L)                      # -> position
R     = 0.3945 * math.hypot(L, W) + d/2 - bite
intersection = (L/2 + d/2 - R) / d * 100
```
0.3945 × √(L²+W²) is the corner's distance from the centre along the diagonal.

| Stone | d | position | intersection |
|---|---|---|---|
| 8 × 5.8 | 0.8 | 35.94° | +36.2% |
| 7 × 5 | 0.8 | 35.54° | +36.8% |
| 10 × 6.5 | 1.0 | 33.02° | +53.0% |
| 6 × 6 | 0.8 | 45° | −19.9% (= the preset) |

This only applies to cushions stretched with `scale.y`; other cuts have a different
corner constant. Always confirm with `H["prong_report"]` (the `jewelcraft:check-prongs` skill).

## How much grip is enough

23.5% of the diameter is JewelCraft's own square-cushion default, not an industry
standard. A tapered 1.0 mm prong set by hand on an 8 × 5.8 cushion measured 30.5% at the
girdle. [verified] No sourced minimum has been found yet. Report the measured grip, compare
it with these two reference points, and let the user decide. A prong with a gap (negative
bite) never holds the stone. [guidance]
