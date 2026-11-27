---
name: build-from-paths
description: Builds jewelry metalwork in Blender (heads, prongs, galleries, shoulders, wire work) from editable paths fused into solids by Geometry Nodes SDF volumes with filleted joints, split the way it will be made (a cast part plus hand-built wire parts), measured and rendered after every change, and handed off as STLs and a 1:1 bending template with a cut list. Use when the user asks to "build the head", "make a wire head", "basket or cathedral head", "make it look like one piece", "cast the shank and build the head from wire", "bending template", "cut list", or wants a design they can adjust through a few numbers.
---

# Build from paths

A way of modeling metalwork that held up on a real ring (R1: an 18K solitaire with a hand-built
U-wire head on a cast band, Blender 5.2.2 with JewelCraft 3.0.1) where earlier approaches
(assembled tubes and parts, a hand-shaped Subdivision cage) did not. Its scripts are covered
by background tests with known answers (`tests/jewelcraft-tests/test_path_build.py`).
**Needs Blender 5.x**: the solids use Geometry Nodes' SDF grid nodes.

## Why it works

- **Parts are what a bench jeweler would make.** Round wire bent in straight runs and arcs, flat
  bars, a cast shank. Each is a path plus a cross-section, set by a few numbers (wire diameter,
  bend radii, an angle, clearances), which are also the numbers on the bending template. Freehand
  sculpted forms are where Claude's modeling fails; these are not freehand. A part is as big as
  what's made in one go: each U-wire is one continuous piece from prong tip to prong tip,
  because it's bent from one length of wire.
- **One continuous solid.** Each solid is one Geometry Nodes group: paths become tubes or swept
  profiles, everything is merged through one signed-distance volume, and inside corners get a
  fillet (a "closing": grow by r, shrink by r). Joints read like solder, not like parts pushed
  into each other. Only the joints that will really be soldered exist.
- **Few, named controls.** One quarter of the head is modeled and mirrored; the head hangs off
  one empty; every size is a named modifier input. The user can change the design without
  scripts, and so can Claude, one value at a time.
- **Every change is measured and rendered.** Numbers from the helpers, then a gold render
  (`jewelcraft:scene-setup`), then the report. One live model, old versions archived.

## 0. Prepare

1. Load the `jewelcraft:jewelcraft-blender` skill and its helpers (`../jewelcraft-blender/scripts/jc_helpers.py`),
   then run `H["check_setup"]()`. The file must be saved, 1 unit = 1 mm.
2. Load this skill's scripts the same way: `scripts/path_build.py` (registers
   `bpy.app.driver_namespace["JPB"]`, compare `PATH_BUILD_VERSION`) and, for a U-wire head,
   `scripts/u_wire.py` (`JUW`, `U_WIRE_VERSION`). `B = bpy.app.driver_namespace["JPB"]`,
   `U = bpy.app.driver_namespace["JUW"]`.
3. Confirm the SDF nodes exist: `hasattr(bpy.types, "GeometryNodeMeshToSDFGrid")`. If not, say this
   skill needs Blender 5.x and stop.
4. Agree with the user before building:
   - **What is cast and what is hand-built** (`references/two-part-build.md`). Their own
     fabrication plan comes first; propose a split only if they have none.
   - The stone (a JewelCraft gem), ring size and band section, wire diameter, and the caster's
     minimum wall (ask; don't assume).
   - A **prefix** for every object name ("R2"), so the scripts find them.
5. Set up the review studio with `jewelcraft:scene-setup`, so every change can be judged in gold.

## 1. Lay out the objects

Use the naming scheme in `references/two-part-build.md` ("<prefix> Head Control",
"<prefix> Wire", "<prefix> Casting", …). Ring coordinates: ring centre at the origin, finger
along Y, stone up along Z.

1. **Head control:** an empty at the centre of the stone's girdle. Parent the gem and every head
   path to it. Moving it moves the stone and head together.
2. **Paths:** `B["bezier"](name, [(co, handle_left, handle_right), ...], parent=control)` makes
   or rewrites a Bézier path (point radius 1; the node groups give it thickness). Model one
   quarter of anything with four-fold symmetry. For the U-wire head, `U["apply"](prefix,
   prong_xy=..., tip_z=..., culet_clearance=..., wire_d=...)` writes the wire and peg paths
   (`references/two-part-build.md`, "The U-wire head").
3. **Profiles:** `B["profile"](name, width, height)` makes a rectangle for a path's
   Bevel > Object (a gallery bar, a shoulder). Galleries and shoulders are paths with a profile
   and a Mirror modifier.
4. **Solids:** make the groups with the recipes, then the objects:
   `B["wire_head"]("R2 Head Wire")`, `B["casting"]("R2 Casting")`, `B["fuse"]("R2 Fuse")`, and
   `B["solid"]("R2 Casting", "R2 Casting", {"Band": "R2 Band", ...}, modifier="Casting")`.
   Fabrication solids are hidden from renders and drawn as boxes; the finished piece renders.
   What each input does: `references/node-groups.md`.

Use Voxel Size 0.05 while editing and 0.03 to check and export. On R1 at 0.03, a change to the
wire took about 16 s to re-evaluate and each check 1–15 s, against the Blender MCP's limit of
about 60 s per call: run heavy steps in separate calls.

## 2. After every change: measure, then look

Run these, then render, then report numbers before impressions:

| Check | Helper | Expect |
|---|---|---|
| Each solid is one piece | `H["pieces"](ob)` | 1 |
| Stone vs head | `H["overlap_islands"](gem, head, frame=...)` | only the prong seats (one island per notched prong), or nothing |
| Prong grip and tip height | `H["prong_report"](gem, head, prong_diameter=wire_d)` | 30–50% grip, tips at least halfway up the crown |
| Stone vs casting | `H["overlap_islands"](gem, casting)` | no islands |
| Head vs casting | `H["overlap_islands"](head, casting)` | only the intended overlaps (peg in its hole, filing stock) |
| Thin metal | `H["thin_spots"](solid, min_mm=...)` | no spots, or only ones you can explain |
| Finger clearance | `H["finger_clearance"](ob, band)` | positive |
| Size and weight | `H["ring_size"](ring)`, `H["weigh"]([ring])` | the agreed size |

Pass `frame=control.matrix_world.inverted()` to get positions in head coordinates (z = 0 at
the girdle). `thin_spots` reports how deep each spot sinks in units of r = min_mm / 2: a 90° edge
sinks 0.41 r and a cube corner 0.73 r (both normal, under the 0.85 r threshold); 1 r or more
is a fin, wire or wall thinner than min_mm, or an edge sharper than 60°. Say where each one is.

Then `S["render_views"]()` from `jewelcraft:scene-setup`. If the Blender window is minimized,
screenshots come back black: look at renders with `S["preview_jpeg"](path)` instead.

## 3. Change the design

- **One change per request**, and re-run section 2 after it. Change a size through its input
  (`H["set_node_inputs"](ob, modifier, {"Fillet Radius": 0.15})`), a shape through its path,
  the U-wire through `U["apply"]` (it keeps the prong position unless given a new one).
- **Before a structural change** (a new head type, a different split), keep the current version:
  `B["archive"]([...], "head v1", prefix)` moves the objects into an excluded collection and
  renames them, so the new parts can take the names.
- **After editing a recipe**, `B["rebuild"]({"R2 Casting": "casting", ...})` rebuilds the groups
  and gives every modifier its settings back (a new input gets its default, not 0).
- Keep a "<prefix> Notes" text block current: the split, the numbers, the last check results,
  where the files are. Offer to save a copy of the file after milestones.

## 4. Hand off to the bench

1. **STLs:** `H["print_check"]([casting], stl_path=...)` for the casting (it exports what was
   measured, including parts hidden from renders, and checks the file), and the head the same
   way for a fit-test print. The casting's Adaptivity input (0.1–0.3) shrinks the file.
   Follow `jewelcraft:print-cast-check` for the caster's questions (shrinkage, minimum wall).
2. **Template and cut list** (U-wire head): `U["export_geometry"](path, prefix, ring_size="US 8",
   alloy="18K yellow", band_profile="comfort fit")` in Blender, then outside Blender:
   `python scripts/u_wire_template.py geometry.json template.pdf` (needs numpy and reportlab).
   Tell the user to print at 100% and check the 50 mm scale line.
3. Give the build sequence and safety notes from `references/two-part-build.md`, with its sources.

## Reference files

| File | Covers |
|---|---|
| `references/node-groups.md` | The Builder and recipes, each input, Blender 5.2 Geometry Nodes behaviour measured here |
| `references/two-part-build.md` | Cast vs hand-built split, object names, the U-wire head, bench sequence, safety, the R1 example |
