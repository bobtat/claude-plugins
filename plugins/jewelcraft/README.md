# jewelcraft

Teaches Claude to model and check jewelry in Blender with the
[JewelCraft](https://github.com/mrachinskiy/jewelcraft) add-on, working through a Blender
MCP connection.

## Installation

```
/plugin marketplace add bobtat/claude-plugins
/plugin install jewelcraft@bobtat-plugins
```

## Skills

| Skill | Use it to |
|---|---|
| `jewelcraft:jewelcraft-blender` | Core knowledge: driving JewelCraft from Python, its pitfalls, gem/prong/cutter/weight details, head anatomy and sources |
| `jewelcraft:check-setup` | Confirm Blender, the connection, JewelCraft and units are ready |
| `jewelcraft:stone-report` | List stones with sizes and carats; catch overlapping stones |
| `jewelcraft:ring-size-check` | Measure a band's real inside diameter and size, or convert a size to a diameter |
| `jewelcraft:check-prongs` | Measure each prong's grip on the stone; suggest corrected settings |
| `jewelcraft:check-seat` | Verify cutter fit, a clean seat, and stone/metal clearance |
| `jewelcraft:weigh-piece` | Metal volume and weight per alloy, with overlaps counted once |
| `jewelcraft:print-cast-check` | Closed mesh, wall thickness, collisions, units; export and verify an STL |
| `jewelcraft:build-ring` | Step-by-step ring workflow with a check after each stage |
| `jewelcraft:scene-setup` | Studio scene for review renders: fixed cameras, 18K gold and diamond materials, lighting, contact sheet |
| `jewelcraft:build-from-paths` | Metalwork built from editable paths and fused with Geometry Nodes, split into a cast part and a hand-built wire head, checked after every change; STLs and a 1:1 bending template with a cut list |

Bracelet, necklace and earring workflows are planned for a later version.

## Requirements

- **Blender** (tested on 5.1.1) with **JewelCraft** enabled (tested on 2.18.1; notes for
  3.x are included but untested).
- A **Blender MCP server** connected to Claude that can run Python in the open Blender (a
  tool such as `execute_blender_code`).
- Scene units of 1 unit = 1 mm (`jewelcraft:check-setup` will tell you if not).
- For `jewelcraft:scene-setup` renders: Cycles (bundled with Blender). A GPU is optional;
  it made renders about 5 s per view on a GTX 970.
- For `jewelcraft:build-from-paths`: Blender 5.x (Geometry Nodes' SDF grid nodes; tested on
  5.2.2 with JewelCraft 3.0.1). Its template generator runs outside Blender, in Python 3 with
  numpy and reportlab.

## How it works

The skills share one helper script, `skills/jewelcraft-blender/scripts/jc_helpers.py`,
which Claude loads into Blender once per session (`jewelcraft:scene-setup` adds its own,
`skills/scene-setup/scripts/scene_setup.py`, and `jewelcraft:build-from-paths` adds
`path_build.py` and `u_wire.py`). All measurements use the evaluated
model (modifiers included), in millimetres. Checks work on temporary copies and don't
change your model; anything that would change it is proposed first. Creating and removing
those copies can mark the file as modified, so Blender may ask to save on quit. Save your file
before building or experimenting.

## How the content was verified

Facts in the reference files are tagged:
- **[verified]**: measured in Blender.
- **[source]**: read in JewelCraft's source.
- **[docs]**: from Blender's documentation.
- **[cited]**: from a named outside source (a standard, supplier or bench reference).
- **[guidance]** / **[untested]**: not yet confirmed.

The helpers were tested against known geometry: prong grip and tip height, cutter fit,
seat clearance, union weights, ring size (rotated, coarse, open, comfort-fit, with heads
and bezels), culet clearance, stone overlaps, loose pieces, STL size, overlap islands, thin
spots, the Boolean solver choice, and the build-from-paths node groups and U-wire geometry.

## Known limits

- One head type is tested, on one ring: a U-wire basket head on a cast shank with cathedral
  shoulders (`jewelcraft:build-from-paths`). Other heads aren't;
  `skills/jewelcraft-blender/references/heads.md` gives anatomy, starting proportions and
  sources.
- The helper tests that build prongs and cutters (`test_prongs`, `test_build_ring`) use
  JewelCraft 2.18's builder recipe and fail on 3.x.
- Prong grip is checked against a 30–50% notch depth (Stuller's bench guidance). Casting
  wall thickness, shrinkage and finishing allowance depend on your caster or printer, so
  `jewelcraft:print-cast-check` asks for them rather than assuming values.
- JewelCraft's own overlap check skips stones whose centres are ≥ 4 mm apart and treats
  each stone as a circle, missing square corners; `jewelcraft:stone-report` checks the
  meshes instead.
