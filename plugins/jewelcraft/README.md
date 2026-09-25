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

Bracelet, necklace and earring workflows are planned for a later version.

## Requirements

- **Blender** (tested on 5.1.1) with **JewelCraft** enabled (tested on 2.18.1; notes for
  3.x are included but untested).
- A **Blender MCP server** connected to Claude that can run Python in the open Blender (a
  tool such as `execute_blender_code`).
- Scene units of 1 unit = 1 mm (`jewelcraft:check-setup` will tell you if not).

## How it works

The skills share one helper script, `skills/jewelcraft-blender/scripts/jc_helpers.py`,
which Claude loads into Blender once per session. All measurements use the evaluated
model (modifiers included), in millimetres. Checks work on temporary copies and don't
change your model; anything that would change it is proposed first. Save your file
before building or experimenting.

## How the content was verified

Facts in the reference files are tagged:
- **[verified]**: measured in Blender.
- **[source]**: read in JewelCraft's source.
- **[docs]**: from Blender's documentation.
- **[cited]**: from a named outside source (a standard, supplier or bench reference).
- **[guidance]** / **[untested]**: not yet confirmed.

The helpers were tested against known geometry: prong grip, cutter fit, seat clearance,
union weights, ring size with and without a head, stone overlaps, and STL size.

## Known limits

- The head, gallery and cathedral workflow is not tested yet;
  `skills/jewelcraft-blender/references/heads.md` gives anatomy, starting proportions and
  sources.
- No sourced minimums for prong grip or casting wall thickness are included; get these
  from your caster or printer.
- JewelCraft's own overlap check skips stones whose centres are ≥ 4 mm apart and treats
  each stone as a circle, missing square corners; `jewelcraft:stone-report` checks the
  meshes instead.
