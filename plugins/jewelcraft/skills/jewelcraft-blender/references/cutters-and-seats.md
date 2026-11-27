# Cutters and seats

## Cutter anatomy [source]

The default cutter is a tall stack: a handle above the table, the girdle seat, and a hole
below the culet. It's parented to the gem. Cut it into the metal with a Boolean
Difference. CUSHION preset: curved seat, rounded corners (48%, 28 segments, profile 0.72).

## Square-shaped cuts on elongated stones [verified]

For square-shaped cuts (cushion, princess, radiant, asscher…), `cutter_mesh.get()`
forces X = Y using the Y (length) value. On an 8 × 5.8 cushion the cutter came out
**8.16 × 8.16 mm, 1.2 mm too wide per side.** Fix it by scaling the cutter object:
```python
cutter.scale.x *= gem.dimensions.x / gem.dimensions.y
```
It then measured 5.92 × 8.16 mm (2% over the stone both ways), and the stone sat fully
inside it with ≥ 0.06 mm clearance. `H["seat_report"]` flags a mismatched cutter.

The cutter's corners are squarer than the stone's: gaps up to ~0.37 mm on a square
cushion, 0.45 mm when scaled. That's JewelCraft's design, not an error.

## Cutting the seat [verified]

```python
md = metal.modifiers.new("Seat", 'BOOLEAN')
md.operation = 'DIFFERENCE'; md.solver = 'EXACT'; md.object = cutter
```
- The cutter's world transform is used, even though it's parented to the gem.
- On a 7.8 × 10 × 2.4 mm test plate: 0 non-manifold edges, and the removed volume
  (84.028 mm³) equalled plate ∩ cutter.
- **The stone's overlap with the metal went from 63.9 mm³ to 0.**
- Check every seat with `H["seat_report"](gem, cutter, metal)` (the `jewelcraft:check-seat` skill):
  - `stone_metal_overlap_mm3` should be 0.
  - The control (overlap with the metal minus only its seat Boolean) should be > 0.
  - `metal_nonmanifold_edges` should be 0.
- Keep the Boolean live while designing; the helpers measure it correctly.
