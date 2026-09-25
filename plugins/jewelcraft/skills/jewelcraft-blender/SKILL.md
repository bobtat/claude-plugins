---
name: jewelcraft-blender
description: Core knowledge for modeling jewelry in Blender with the JewelCraft add-on through Python or a Blender MCP connection. Use when adding gems, prongs or cutters, sizing ring shanks, reading carat weights or metal weights, or scripting any JewelCraft tool. Other skills in the jewelcraft plugin build on it. General Blender modeling that isn't jewelry belongs to the Blender modeling skill.
---

# JewelCraft in Blender, driven from Python

Drive Blender through a Blender MCP server that can run Python (a tool such as
`execute_blender_code`). Examples here assign a JSON-serialisable dict to `result`. Some
servers return that variable; others return only printed output. Unless you know the
server returns `result`, end each call with
`import json; print(json.dumps(result, default=str))`. The snippets below leave that line
out for brevity.
JewelCraft must be installed and enabled in that Blender.

Everything here was written against **JewelCraft 2.18.1 on Blender 5.1.1**. Tags in the
reference files:
- **[verified]**: run in Blender and the result measured.
- **[source]**: read in the JewelCraft source, not run.
- **[docs]**: from the Blender manual or Python API reference.
- **[cited]**: from a named outside source (a standard, supplier or bench reference), not run.
- **[untested]** / **[guidance]**: inference or practice, not confirmed.

## Start of every session

1. **Load the helpers.** Read `scripts/jc_helpers.py` (in this skill's folder) and note
   its `HELPERS_VERSION` line. Check what's loaded:
   `result = {"v": bpy.app.driver_namespace.get("JC", {}).get("HELPERS_VERSION")}`
   (plus the print line above).
   If that doesn't match the file, send the file's **entire contents** as the code of one
   `execute_blender_code` call. The helpers
   live in `bpy.app.driver_namespace["JC"]` until Blender restarts. Leave them there
   between calls. That's deliberate, unlike one-off helpers, which should be deleted when
   done: every skill in this plugin reuses them. Use them as
   `H = bpy.app.driver_namespace["JC"]`. The API is described in `references/helpers.md`.
2. **Run `H["check_setup"]()`** (or the `jewelcraft:check-setup` skill) and act on its `issues`:
   - Never saved: ask the user to save before building or experimenting.
   - JewelCraft 3.x: read `references/jewelcraft-3x.md` first.
   - Units not 1 unit = 1 mm: offer to fix them and wait for a yes.
   - Not in Object Mode: ask the user to switch.

   `notes` are information. "Unsaved changes" appears after any helper call, because
   the helpers' temporary objects can mark the file modified. Ask the user to save once at
   the start of a session, not before every check.
3. **Protect the user's work.** Never open a new file over unsaved work. Build experiments
   in a temporary scene and delete it afterwards (`references/blender-essentials.md` §1).
   Don't change the user's objects without saying what will change.

## Rules that prevent most failures

- **Viewport context:** many JewelCraft operators need one. Use
  `bpy.context.temp_override(**H["ctx"]())`. Set selection with `H["select_only"](...)`.
  **Never pass `object=`/`active_object=` in the override.** [verified]
- **Adding an object changes the selection.** A new gem or size curve becomes the only
  selected and active object. Re-select before the next step. [verified]
- **Some JewelCraft tools only work from a click in 2.18.1:** `prongs_add`,
  `cutter_add`, `lattice_profile`, `lattice_project`, `curve_distribute` (does nothing,
  without an error), `curve_redistribute`, `microprong_cutter_add`, `resize`. Build
  prongs and cutters with the builder recipe in `references/operators.md`. [verified for
  prongs_add, lattice_profile]
- **`gem_edit` resets whatever you don't pass:** always give both `cut` and `stone`
  (`references/gems.md`).
- **Ring sizes:** always pass `diameter` to `size_curve_add` (from
  `H["size_to_diameter"](8, "US")`). `size_us=8` from a script gives an 18.00 mm curve
  instead of 18.13 mm. [verified]
- **What `size` means for a gem depends on the cut.** For oval, pear, marquise, emerald and
  baguette it's the **length** (`references/gems.md`). [verified]
- **Elongated cushions:** default prongs float clear of the stone, and the default cutter
  is square. Use `H["corner_prong_settings"]` and scale the cutter's X by W/L
  (`references/prongs.md`, `references/cutters-and-seats.md`). [verified]
- **Measure, don't eyeball.** Report numbers from the helpers, not impressions from a
  screenshot.

## Reference files (read when the task needs them)

| File | Covers |
|---|---|
| `references/blender-essentials.md` | Protecting the file, temp scenes, context, bpy/bmesh pitfalls, Booleans, STL export, rendering |
| `references/operators.md` | Which JewelCraft operators work from a script, the prong/cutter builder recipe, enum lists |
| `references/gems.md` | Gem sizes by cut, proportions, `gem_edit` pitfalls, carat calculation |
| `references/prongs.md` | What each prong setting does, presets, corner-prong formula for elongated cushions |
| `references/cutters-and-seats.md` | Cutter anatomy, square-cutter fix, cutting and checking a seat |
| `references/weight-and-reports.md` | Weight tool, per-scene alloy list, densities, design report, overlap blind spot |
| `references/heads.md` | Head, basket and cathedral anatomy, bench proportions, sources [untested] |
| `references/jewelcraft-3x.md` | What changes in JewelCraft 3.x |
| `references/helpers.md` | The helper functions: arguments, outputs, how to read them |

## Actions in this plugin

- **`jewelcraft:check-setup`**: verify the connection, file, JewelCraft version and units.
- **`jewelcraft:stone-report`**: stones, sizes, carats and overlaps.
- **`jewelcraft:ring-size-check`**: a band's real inside diameter and size.
- **`jewelcraft:check-prongs`**: prong grip on the girdle, with fixes.
- **`jewelcraft:check-seat`**: cutter fit, seat cleanliness, stone/metal clearance.
- **`jewelcraft:weigh-piece`**: volume and weight per alloy.
- **`jewelcraft:print-cast-check`**: closed mesh, wall thickness, collisions, STL scale.
- **`jewelcraft:build-ring`**: the tested ring workflow.

Bracelet, necklace and earring workflows are not included yet. They'll be added once
they've been researched and tested.
