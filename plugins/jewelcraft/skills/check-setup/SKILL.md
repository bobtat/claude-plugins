---
name: check-setup
description: Checks that Blender, the Blender MCP connection and the JewelCraft add-on are ready for jewelry work. Use when the user says "is JewelCraft working", "is Blender ready for JewelCraft", "check my jewelry setup", or at the start of a JewelCraft session before building or measuring anything.
---

# Check setup

1. Load the `jewelcraft:jewelcraft-blender` skill if it isn't loaded, and load the helpers as its
   "Start of every session" section describes. The helper script is at
   `../jewelcraft-blender/scripts/jc_helpers.py`, relative to this skill's folder.
   - If the Blender MCP tool isn't available, or the call can't reach Blender, stop and
     tell the user: Blender must be open with its MCP server running and connected to this
     session.
2. Run `result = bpy.app.driver_namespace["JC"]["check_setup"]()`.
3. Report in plain language:
   - Blender and JewelCraft versions. If JewelCraft is 3.x, say that some instructions
     differ and read `../jewelcraft-blender/references/jewelcraft-3x.md` before building.
   - Whether the file has been saved. If never, ask the user to save before any
     building or experiments. Unsaved changes after that are a note, not a blocker:
     the helpers' temporary objects can mark the file modified too.
   - Units: whether 1 unit = 1 mm. If not, offer to fix it with
     `scene.unit_settings` (metric, millimetres, scale 0.001) and wait for a yes.
   - How many gems are in the scene and how many alloys are in its weighting list.
   - Each item in `issues`, with what to do about it, then `notes`. If `issues` is
     empty, say everything is ready.
4. Don't change anything in the scene during this check.
