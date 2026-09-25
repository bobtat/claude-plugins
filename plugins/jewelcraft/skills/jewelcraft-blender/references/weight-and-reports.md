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
  have `.name`, `.density`, `.enabled`, `.composition`). A scene created from a script starts empty.
  Copy the items over (blender-essentials.md §1). `H["weigh"]` falls back to the defaults
  below. [verified]
- JewelCraft 2.18.1 default list (g/cm³): 24K 19.32, 22K 17.86, 18K yellow 15.53,
  14K yellow 13.05, 10K yellow 11.47, 18K white Pd 15.66, 18K white Ni 14.69,
  14K white Pd 14.60, 14K white Ni 12.61, 10K white 10.99, 18K rose 15.02,
  14K rose 13.03, 10K rose 11.52, Pt950 (Pt/Ru) 20.70, Pt900 (Pt/Ir) 21.54,
  Pd950 (Pd/Ru) 12.16, sterling 10.36. Each item also has a `composition`, and
  `H["weigh"]` returns it with every weight. [verified]
- **A density is one alloy, not every alloy with that name.** Pt950 ranges from about
  19.8 (Pt/Pd) to 21.45 g/cm³ (Pt/Ir), so a "Pt950" weight can be several percent off,
  and Pt900/Ir really is heavier than Pt950/Ru. White and rose golds vary with their
  master alloy in the same way. (Plumb Club, platinum alloys:
  https://plumbclub.com/platinum-alloys/) [cited] For a quote, use the specific gravity
  of the user's actual alloy from their supplier, and give weights as approximate
  (± a few percent), not to 0.01 g. [guidance]
- This is the weight of the model as modelled. The metal a caster needs, and the
  finished piece's weight, will differ (sprues, finishing). Present it as the model's
  weight. [guidance]

## Stone report

- `H["stone_report"]()` returns JewelCraft's design-report data with no file or browser:
  - `gems`: stone, cut, color, size, ct, qty, ct_sum. Identical stones are grouped.
    `stone` and `cut` are display names ("Diamond", "Round"), not ids. Size is a single
    number (the length) for round, square, asscher, flanders and octagon; `[width,
    length]` for heart, trillion and trilliant; and `[length, width]` for every other
    cut, including square cushions, princesses and radiants. [source]
  - `warnings`
  - `total_ct`
  - `stone_overlaps`
  [verified]
- **JewelCraft's overlap check only compares stones whose centres are within 4 mm.** Two
  8 mm rounds 6 mm apart (5.7 mm³ of overlap) produced no warning. It also treats each
  stone as a circle of half its larger side, so two 8 mm princesses touching corner to
  corner 10.5 mm apart are never compared. `stone_overlaps` checks the meshes and caught
  both, plus stones under 0.1 mm apart (JewelCraft's own warning distance). [verified]
- The file-based operator (`wm.jewelcraft_design_report`) opens the report in the web
  browser. Only use it if the user wants the HTML/JSON file.
