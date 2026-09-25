# Helper functions (`scripts/jc_helpers.py`)

Load once per Blender session (see SKILL.md), then `H = bpy.app.driver_namespace["JC"]`.
Object arguments accept a name or an object. All measurements are in mm, on the
**evaluated** mesh (modifiers included) in world space.

Helpers that need temporary geometry (overlaps, unions, seat checks) create copies in a
temporary `JC_TMP` collection and delete it before returning. They never modify the
user's objects, but creating and removing that collection can mark the file as modified, so
Blender may ask to save on quit. The only helper with side effects outside Blender is `print_check` when
given `stl_path` (it writes a file; the user's selection is restored afterwards).

Every result below was checked in Blender 5.1.1 + JewelCraft 2.18.1 against known
geometry. [verified]

| Helper | Returns / use |
|---|---|
| `check_setup()` | Blender and JewelCraft versions, file state, units, gem count, weighting-list size, `issues` (problems to act on: not installed, never saved, wrong units, not in Object Mode...) and `notes` (information, such as unsaved changes). |
| `size_to_diameter(size, fmt="US")` | Circumference and diameter. US 8 → 56.965 / 18.1324 mm. Formats: US, UK (letter index A = 0), CH and HK from JewelCraft's own size table; JP from the JCS scale (1 = 13.00 mm, +1/3 mm per size), because JewelCraft's JP table is up to 0.5 mm off from size 17 up. [cited] |
| `ring_size(band)` | Fits a circle to the band's inner surface and returns `inner_diameter_mm`, `inner_circumference_mm`, `sizes` per format, `roundness_max_dev_mm`, `points_rejected`, `min_opening_diameter_mm`, `axis` and `centre`. The axis is chosen from the object's local axes and the principal axes of its vertices, whichever fits a circle best, so rotated rings and heads wider than the band are handled. Head and prong points that fall into the fit are rejected repeatedly until none remain. `min_opening_diameter_mm` is the narrowest point of the whole mesh around the axis. When it is more than 0.05 mm under the fitted diameter, a `warning` says something (a sizing bead, a sunk head, a culet) reaches into the finger hole. Checked on a synthetic US 8 band (18.132 mm): plain, with a head on top, with a head wider than the band, rotated 30° and 45°, and rotated off-origin with a head all read 18.132 mm; two 1 mm beads and a sunk head were flagged. [verified] Fitting through vertices overstates a coarse inner surface slightly (the finger touches the flats): about 0.02 mm in diameter at 64 segments, 0.09 mm at 32. JP is the JCS size to two decimals; HK returns `None` unless within ~0.1 mm of a listed size. |
| `gems_in_scene()` | Each visible gem, including instanced ones (named `gem [instancer #n]`): name, cut, stone, dims (x, y, z), ct from JewelCraft's formula, location. Hidden gems are left out, as in JewelCraft's report. |
| `stone_report()` | JewelCraft's design-report data without a file or browser: `warnings`, `gems` (stone, cut, color, size, ct, qty, ct_sum), `total_ct`, and `stone_overlaps` (below). |
| `stone_overlaps(threshold=0.1)` | Pairs of stones that overlap (`overlap_mm3`) or are closer than `threshold` mm (`gap_mm`), measured on the meshes, instances included. Catches what JewelCraft's check misses: stones ≥ 4 mm apart, and corners of square and emerald cuts (JewelCraft treats each stone as a circle of half its larger side). Checked: 8 mm rounds 6 mm apart, 8 mm princesses corner to corner 10.5 mm apart, 5 mm rounds 0.05 mm apart, and an instanced gem overlapping a real one were all flagged; 0.5 mm apart was not. [verified] A stone entirely inside another isn't detected. |
| `prong_report(gem, prongs, prong_diameter=None)` | Slices the prongs at the gem's girdle plane. Per prong: centre, angle from +Y, diameter at the girdle, `bite_mm` (+ = overlaps the girdle, − = gap), `bite_pct_of_diameter`. Also `tip_above_girdle_mm` per prong and the stone's `crown_height_mm`. A `note` flags gaps, grips under 30%, and tips below halfway up the crown (too short to fold over; Stuller trims prongs to halfway up the crown). [verified] Cushions also get `suggested_corner_settings`, computed from `prong_diameter` if given (use the setting for tapered prongs). |
| `corner_prong_settings(L, W, d, bite_frac=0.33)` | `position` (rad/deg) and `intersection` for 4 corner prongs (`number=2, use_symmetry=True`) on an L × W cushion, giving a notch of `bite_frac` × d. 0.235 reproduces JewelCraft's own square-cushion grip. |
| `finger_clearance(ob, band)` | How far `ob` (usually the stone, for its culet) stays outside the band's finger hole, using the same axis and circle as `ring_size`: `clearance_mm` (negative = it reaches into the hole and will touch the finger) and the closest point. Checked with a 6.5 mm round seated 1.2 mm clear and 0.8 mm into the hole. [verified] |
| `seat_report(gem, cutter, metal=None)` | Cutter size at the girdle vs the stone, `stone_inside_cutter`, `min_clearance_mm`, `max_gap_mm`, and a note if the cutter's proportions don't match the stone. With `metal`: its volume, non-manifold edges, `stone_metal_overlap_mm3` (should be 0), and `control_overlap_without_seat_mm3`, the overlap with a copy of the metal that keeps every modifier except the Booleans using this cutter (should be > 0; proves the 0 isn't a silent failure). |
| `weigh(objects, union=True)` | Per-part volumes; the union volume (overlaps counted once); how much was double-counted; `weights_g`, one `{alloy, composition, g}` per enabled alloy in the scene's list (built-in defaults if the list is empty). |
| `overlap_volume(a, b)` | Volume of a ∩ b (mm³). 0 = no collision. |
| `union_stats(objects)` | (volume, non-manifold edges) of the union. |
| `volume_nm(ob)` | (volume, signed volume, non-manifold edges). Negative signed volume = normals inward. |
| `min_wall(ob)` | (thinnest wall mm, location). Casts a ray from each face centre inward, so on a coarse mesh the thinnest point can fall between samples; subdivide a copy (or add a Subdivision/Remesh modifier to it) before trusting a low-poly result. **Knife edges and rims read as thin walls:** a seat rim meeting the top surface read 0.117 mm on a test plate. Look at the location before calling it a defect. |
| `print_check(objects, min_wall_mm=None, parts_that_must_not_touch=(), stl_path=None)` | Per object: volume, non-manifold edges, inside-out, thinnest wall and where, scale. Also collisions for the listed pairs (names or objects), units, and (with `stl_path`) STL export checked against the model's size and triangle count. `problems` is the list to report; `warnings` (unapplied scale) don't block printing. Parts hidden in the viewport block the export instead of being silently left out. Export works with or without a 3D Viewport. [verified] |
| `stl_info(path)`, `stl_bbox(path)` | Size and triangle count of a binary STL (to confirm it's in mm and complete). |
| `select_only(*obs)`, `ctx()`, `get(name)`, `jc(".lib.gemlib")`, `addon_name()`, `jc_version()` | Utilities. `ctx()` returns the override dict for `temp_override`. |
| `eval_bm`, `slice_components`, `girdle_hull`, `hull2d`, `dist_to_hull`, `gem_frame`, `TempObjects` | Building blocks for custom checks. |

Known limits:
- `prong_report` and `seat_report` assume the gem's girdle is at the gem object's local
  z = 0, which is true for JewelCraft gems.
- Outline comparisons use convex hulls, so they're exact for convex girdles (round,
  cushion, oval, emerald…) and approximate for hearts and pears near the notch or point.
