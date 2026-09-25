# Weight and reports

## Weight

- JewelCraft's `weight_display` merges every selected object into one mesh and measures
  it, so **overlapping parts are counted twice**. `H["weigh"](objects)` unions the parts
  first. Two 10 mm cubes overlapping by half read 2000 mm³ summed, 1500 mm³ unioned.
  [verified]
- It works on curves and on live (unapplied) modifiers. A seated plate read
  103.172 mm³ = 1.60 g of 18K yellow gold either way. [verified]
- Weight = `volume_mm3 × density / 1000` grams.
- **The alloy list is per scene** (`scene.jewelcraft.weighting_materials.coll`; items
  have `.name`, `.density`, `.enabled`). A scene created from a script starts empty.
  Copy the items over (blender-essentials.md §1). `H["weigh"]` falls back to the defaults
  below. [verified]
- JewelCraft 2.18.1 default list (g/cm³): 24K 19.32, 22K 17.86, 18K yellow 15.53,
  14K yellow 13.05, 10K yellow 11.47, 18K white Pd 15.66, 18K white Ni 14.69,
  14K white Pd 14.60, 14K white Ni 12.61, 10K white 10.99, 18K rose 15.02,
  14K rose 13.03, 10K rose 11.52, Pt950 20.70, Pt900 21.54, Pd950 12.16,
  sterling 10.36. [verified]
- This is the weight of the model as modelled. The metal a caster needs, and the
  finished piece's weight, will differ (sprues, finishing). Present it as the model's
  weight. [guidance]

## Stone report

- `H["stone_report"]()` returns JewelCraft's design-report data with no file or browser:
  - `gems`: stone, cut, color, size, ct, qty, ct_sum. Identical stones are grouped. Size
    is [length, width], or a single number for symmetric cuts.
  - `warnings`
  - `total_ct`
  - `large_stone_overlaps`
  [verified]
- **JewelCraft's overlap check only compares stones whose centres are within 4 mm.** Two
  8 mm rounds 6 mm apart (5.7 mm³ of overlap) produced no warning, but
  `large_stone_overlaps` caught them. [verified]
- The file-based operator (`wm.jewelcraft_design_report`) opens the report in the web
  browser. Only use it if the user wants the HTML/JSON file.
