# Blender essentials for scripted jewelry work

General Blender rules that the jewelry workflows depend on. Written for Blender 5.1.1.

## 1. Protect the user's file

The MCP runs code in the Blender the user has open; their work lives in memory.
1. Check first: `H["check_setup"]()` reports `file.saved` / `file.dirty`. [verified]
2. **If it has never been saved (`file.saved` false), ask the user to save** before
   experiments. `file.dirty` alone isn't a reason to ask again: the helpers' temporary
   objects can set it (SKILL.md, "Start of every session"). Never run
   `wm.read_homefile`, `wm.open_mainfile` or anything else that replaces the open file.
3. **Experiment in a temporary scene**, then delete it: [verified]
   ```python
   win = bpy.context.window_manager.windows[0]
   home = win.scene
   test = bpy.data.scenes.new("TMP_TEST"); win.scene = test
   u = test.unit_settings; u.system = 'METRIC'; u.length_unit = 'MILLIMETERS'; u.scale_length = 0.001
   # copy the alloy list so weights work in the new scene
   for m in home.jewelcraft.weighting_materials.coll:
       it = test.jewelcraft.weighting_materials.coll.add()
       it.name, it.density, it.enabled, it.composition = m.name, m.density, m.enabled, m.composition
   # ... build with a "TMP_" prefix ...
   # cleanup:
   win.scene = home
   obs = list(test.objects); datas = [o.data for o in obs if o.data]
   for o in obs: bpy.data.objects.remove(o, do_unlink=True)
   for d in datas:
       try:
           if d.users == 0:
               (bpy.data.meshes if isinstance(d, bpy.types.Mesh) else bpy.data.curves).remove(d)
       except ReferenceError:
           pass
   bpy.data.scenes.remove(test)
   bpy.context.view_layer.update()
   ```
   Afterwards, confirm the user's scene has the same objects as before. The file shows as
   modified even though its content is the same.
4. Tell the user before anything visible happens on their computer (a browser tab, a file
   written).

## 2. Scripting pitfalls

- An operator that raises can roll back objects created earlier in the same call. Put
  risky calls in their own MCP call. [verified]
- Operators raise `RuntimeError` when their context is wrong, **and whenever they report
  an error, even if they return FINISHED**. Check with `bpy.ops.x.y.poll()`. [docs]
- Operators only return a status; they act on the selection and active object.
  Prefer the data API (`bpy.data`, modifiers, bmesh) when it can do the job. [docs]
- Context override: `with bpy.context.temp_override(**H["ctx"]()) as c:`.
  `c.logging_set(True)` prints which context members an operator reads. The
  window/area/region must be consistent. [docs]
- After changing transforms or modifiers, call `bpy.context.view_layer.update()` before
  reading `matrix_world`, `dimensions` or evaluated geometry. [docs]
- Don't keep references to mesh elements or collection items across mode switches,
  adding items or removing data. Undo can invalidate every object reference. Look things
  up again. [docs]
- A new datablock may not get the name you asked for. Keep the returned object. [docs]
- In Edit Mode, `ob.data` is out of sync with what the user sees. Work in Object Mode, or
  use `bmesh.from_edit_mesh` / `update_edit_mesh`. [docs]
- After deleting objects, call `view_layer.update()` before iterating
  `view_layer.objects`. Otherwise it can yield `None` entries. [verified]
- A new scene has default units and an empty JewelCraft alloy list. [verified]

## 3. Units and transforms

- 1 unit = 1 mm: `system='METRIC'`, `length_unit='MILLIMETERS'`, `scale_length=0.001`.
  JewelCraft's Set Units operator does the same but needs a viewport override. [verified]
- Solidify thickness uses local coordinates, so non-uniform scale makes walls uneven.
  Apply scale before thickness-driven modifiers. [docs]

## 4. Booleans

- Solvers: `FLOAT` (fast, no overlapping geometry), `EXACT` (best, handles overlaps,
  slower), `MANIFOLD` (fastest, manifold meshes only). Only manifold inputs are guaranteed
  to give proper results. [docs]
- `EXACT` gave clean results in every test here. The operand's world transform is used,
  parented or not. [verified]
- A live (unapplied) Boolean is measured correctly by the helpers: the seated test plate
  read 103.172 mm³ whether applied or live. [verified]

## 5. STL export

`bpy.ops.wm.stl_export(filepath=..., export_selected_objects=True)`. With 1 unit = 1 mm,
the defaults write millimetre numbers, which is what slicers expect. **Don't set
`use_scene_unit=True`:** it writes metres (1000× too small). `H["print_check"](...,
stl_path=...)` exports and verifies the size. [verified]

## 6. Seeing the result

- MCP screenshots of the Blender window come back **black** when the window is minimized or
  covered.
- Render the viewport instead: [verified]
  ```python
  with bpy.context.temp_override(**H["ctx"]()):
      bpy.ops.render.opengl(view_context=True)
  bpy.data.images['Render Result'].save_render(path)
  ```
- For design review, use Cycles with a metallic material and an HDRI or studio lights
  (not yet scripted or tested here).
