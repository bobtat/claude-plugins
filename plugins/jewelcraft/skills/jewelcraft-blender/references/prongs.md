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
  so `number=2` + symmetry = 4 prongs. `symmetry_pivot` rotates the whole set, but only
  when `use_symmetry` is on.
- `alignment` = tilt. **Positive tilts the tips outward and pulls the bases in**
  (basket/cathedral look); negative does the opposite. At +10°, a 4 mm prong shifts
  4 × sin 10° ≈ 0.7 mm between top and base. [verified]
- Presets (`prongs_presets.py`): [source]
  - Cushion/square → 2 + symmetry at 45°, intersection −20% (octagon 0%).
  - Rectangle → 2 + symmetry at 36°, −20%; baguette 29°, −10%.
  - Round → 1 + symmetry at 60° (**2 prongs**; set `number`/`use_symmetry` yourself for
    4 or 6).
  - Triangle and heart → 3, no symmetry, alignment 10°.
  - Oval → 30°, +40%. Pear → 1 prong at 50°, +40%, symmetry pivot −90°. Marquise → 16°,
    +70%. These three use diameter 0.28 × width and heights from the width.
  - Every other cut: diameter 0.8 mm for gems with Y ≥ 2.5 mm (smaller below). Heart
    keeps this size-table diameter.

## Elongated stones: presets float

Prongs sit on a circle of radius `gem_dim.y/2 + radius − intersection`. On an elongated
stone (Y = length) that circle is wider than the stone's sides. **On an 8 × 5.8 cushion
the presets left all four prongs 0.49 mm clear of the girdle.** [verified]

## Corner prongs on an elongated cushion

`H["corner_prong_settings"](L, W, d)` places 4 corner prongs on an L × W cushion so each
overlaps the girdle by `bite_frac` × d (default 0.33, inside the 30–50% bench range
below):
```python
bite  = bite_frac * d
theta = math.atan(W / L)                      # -> position
R     = 0.3945 * math.hypot(L, W) + d/2 - bite
intersection = (L/2 + d/2 - R) / d * 100
```
0.3945 × √(L²+W²) is the corner's distance from the centre along the diagonal.

| Stone | d | position | intersection (0.33) | intersection (0.235, JewelCraft's grip) |
|---|---|---|---|---|
| 8 × 5.8 | 0.8 | 35.94° | +45.7% | +36.2% |
| 7 × 5 | 0.8 | 35.54° | +46.3% | +36.8% |
| 10 × 6.5 | 1.0 | 33.02° | +62.5% | +53.0% |
| 6 × 6 | 0.8 | 45° | −10.4% | −19.9% (= the preset) |

With `bite_frac=0.235` the formula reproduced JewelCraft's square-cushion grip to
±0.004 mm. Built on an 8 × 5.8 cushion with the 0.33 default, all four prongs measured
33.1%. [verified]

This only applies to cushions stretched with `scale.y`; other cuts have a different
corner constant. Always confirm with `H["prong_report"]` (the `jewelcraft:check-prongs` skill).

## How much grip is enough

Stuller's bench guide for four-prong settings puts the seat (notch) depth at **30–50% of
the prong's thickness**. [cited] `bite_pct_of_diameter` in `H["prong_report"]` measures
the same thing: how far the prong reaches inside the girdle outline. JewelCraft's own
square-cushion preset gives 23.5%, below that range, so treat it as a CAD default, not a
target. `prong_report` adds a note when any prong is under 30%.

**Pre-notched or setter-notched?** Decide this with the user (or their setter) before
checking collisions:
- **Pre-notched:** the notches are modelled. Cut the prongs with the stone's cutter as
  well as the seat metal, and include prongs in the stone/metal collision pairs; their
  overlap with the stone should then be 0. `prong_report` still measures the grip as
  designed (it leaves the notch Booleans out). The notch leaves slivers that `min_wall`
  reads as walls of about 0.002 mm; they are the notch rim, not a thin wall. [verified]
- **Setter-notched:** the prongs are cast plain and the setter cuts the notches. The
  prongs still sit 30–50% inside the girdle, so they overlap the stone in the model.
  Leave them out of the stone/metal collision pairs, and tell the user the overlap is the
  material the setter will remove.

**Tip height.** Stuller trims each prong to reach halfway up the crown (halfway from the
girdle to the table) before it's pushed over. [cited] `prong_report` gives each prong's
`tip_above_girdle_mm` and the stone's `crown_height_mm`, and flags tips below half of it.
Heights set with `z1` also have to leave that much metal after finishing.

A prong whose gap to the girdle is more than a few hundredths of a millimetre isn't
touching the stone at all, and the setter would have to bend it in; report that as a
fault. [guidance]

Source: Stuller, "Step-by-step stone setting gems in four-prong mountings",
https://www.stuller.com/benchjeweler/resources/bencharticles/view/step-by-step-stone-setting-gems-in-four-prong-mountings/
