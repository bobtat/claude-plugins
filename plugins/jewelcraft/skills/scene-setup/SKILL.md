---
name: scene-setup
description: Sets up a studio scene in Blender for reviewing a jewelry design (fixed top, side, end and perspective cameras, 18K yellow gold and diamond preview materials, neutral studio lighting, Cycles render settings), renders every view to PNGs with a contact sheet, and removes it all again on request. Use when the user asks to "set up the scene", "set up cameras", "render the ring", "show me what it looks like in gold", "render all the views", "studio lighting", or before judging how a design looks.
---

# Scene setup and review renders

Builds a separate scene, **"JC Studio"**, that links the user's collections. Its cameras,
lights, world and render settings live only there, so the modelling scene is never
changed. The one change to the user's own objects: preview materials attached **per
object** (slot link = Object), which leaves each mesh's own materials in place.
`teardown()` removes everything and restores those slots.

Tested in Blender 5.1.1 with JewelCraft 3.0.1 on a US 8 test band, an 8.85 × 7.38 mm
cushion and four prongs: setup, render, reframe, the image viewer, and teardown leaving
the objects' material slots exactly as before (none, empty, or their own material). [verified]

## 1. Prepare

1. Load the `jewelcraft:jewelcraft-blender` skill and its helpers (script at
   `../jewelcraft-blender/scripts/jc_helpers.py`), then run `H["check_setup"]()`. The file
   must have been saved (renders go in a folder next to it), and 1 unit = 1 mm.
2. Load this skill's script, `scripts/scene_setup.py`, the same way as the helpers: check
   `result = {"v": bpy.app.driver_namespace.get("JCS", {}).get("SCENE_HELPERS_VERSION")}`
   against the file's `SCENE_HELPERS_VERSION` line, and if they differ, send the file's
   **entire contents** as one `execute_blender_code` call. Then
   `S = bpy.app.driver_namespace["JCS"]`.
3. Run `S["status"]()`. If a studio already exists for this scene, skip to step 3 (Render).

## 2. Set up

1. Tell the user, before running it, what will change:
   - a new scene "JC Studio" with 6 cameras and 3 lights; their own scene, cameras
     (for example an existing "R1 Cameras" collection) and render settings stay as they are;
   - every visible part gets the gold preview material and every visible JewelCraft gem
     the diamond one, per object; `teardown()` puts the originals back.
2. Find the band (the object with the finger hole) so the cameras line up with the
   finger. Use the name the user gave, or list mesh objects and ask. Without it, the
   finger axis is assumed to be Y, JewelCraft's convention.
3. Only 18K yellow gold (ISO 8654 colour 3N) exists as a metal preset. If the user's
   metal is different, say so rather than using gold for it.
4. Run `result = S["setup"](source=<their scene name>, band=<band name>)`. Report the
   materials list (which objects became gold and which became diamond), the render device
   and the notes. Anything wrong in the materials list (a cutter shown as gold, a stone
   left out) is fixed by calling `setup` again with explicit `metal=[...]`/`gems=[...]`.

`setup` options: `hdri` (Blender's bundled studio lights: `studio.exr` default,
`interior.exr`, `courtyard.exr` …), `hdri_strength` (2.5), `hdri_rotation_deg` (moves the
reflections), `backdrop` (grey level, 0.8), `size` (1200 px), `samples` (64), `light_k`
(area-light power factor, 30), `view_transform` ("Standard"). It's safe to run again; it
updates in place.

## 3. Render

1. The first time in a session, render one view to time it:
   `S["render_views"](views=["JC Hero"], contact_sheet=False)`. On a GTX 970 (CUDA) one
   1200 px, 64-sample view took about 5 s. [verified] If one view takes more than about a
   minute (CPU), lower `size`/`samples` or render the views in separate calls.
2. `result = S["render_views"]()` renders all six to `renders/<date-time>/` next to the
   .blend and tiles them into `contact_sheet.png` (row 1: Top, Side, End; row 2: Hero,
   Head, Gallery). It first re-syncs with the user's scene and re-aims the cameras at the
   current model, so there's no need to run `setup` again after modelling changes.
   Objects hidden in the user's viewport, and wire/bounds-display objects such as Boolean
   cutters, are hidden for the render only.

| Camera | What it shows |
|---|---|
| JC Top | Orthographic, from above; finger runs left to right (matches the sketch template's top view) |
| JC Side | Orthographic, from the side; finger runs left to right |
| JC End | Orthographic, looking along the finger |
| JC Hero | Whole ring, perspective, three-quarter view from above |
| JC Head | Stone and head close-up, slightly above |
| JC Gallery | Head from almost level, to see under the stone |

Orthographic views are to scale: mm per pixel = the camera's `ortho_scale_mm` (reported by
`setup`) ÷ the image width.

## 4. Look at the renders

1. `S["show_image"](result["contact_sheet"]["path"])` temporarily switches the main 3D
   Viewport to an Image Editor showing the image.
2. Take a screenshot with the Blender MCP's area screenshot (`IMAGE_EDITOR`). The tool
   only sees the main window, which is why the 3D Viewport is borrowed. For detail, call
   `show_image` again with one view's PNG and screenshot again.
3. **Always** call `S["close_image"]()` afterwards. It switches the area back to the 3D
   Viewport (the view is preserved) and unloads the images; the PNGs stay on disk.
4. Tell the user where the renders are, so they can open them full size. Describe what the
   renders show, but report dimensions from the measuring helpers, not from the pictures.

## 5. Remove

`S["teardown"]()` when the user asks, or before they share or send the file: it deletes
the studio scene, its cameras, lights and world, restores the objects' materials, and
unloads the HDRI. The preview materials are deleted too unless `keep_materials=True`. The
rendered PNGs are kept.

## Known limits

- **No dispersion before Blender 5.3**, so the diamond shows no rainbow fire; brilliance
  and contrast are right, fire isn't. [verified: 5.1.1's Principled BSDF has no dispersion
  input]
- The gold colour is 3N's measured colour used as the metal's reflectance at normal
  incidence, a close approximation rather than a measured spectral match
  (`references/studio.md`).
- Lighting was tuned on one test ring: the bundled `studio.exr` is blue-tinted, so its
  colour is removed; the key/fill/top area lights scale with the piece's size.
- Parts whose material comes from a geometry-nodes Set Material node, and gems instanced
  by geometry nodes, don't get the preview materials.
- Only one studio per file, tied to one source scene.

`references/studio.md` has the sources and measurements behind the materials and lighting.
