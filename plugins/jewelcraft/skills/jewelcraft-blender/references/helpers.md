# Helper functions (`scripts/jc_helpers.py`, version 0.1.0)

Load once per Blender session (see SKILL.md), then `H = bpy.app.driver_namespace["JC"]`.
Object arguments accept a name or an object. All measurements are in mm, on the
**evaluated** mesh (modifiers included) in world space.

Helpers that need temporary geometry (overlaps, unions, seat checks) create copies in a
temporary `JC_TMP` collection and delete it before returning. They never modify the
user's objects. The only helper with side effects outside Blender is `print_check` when
given `stl_path` (it writes a file; the user's selection is restored afterwards).

Every result below was checked in Blender 5.1.1 + JewelCraft 2.18.1 against known
geometry. [verified]

| Helper | Returns / use |
|---|---|
| `check_setup()` | Blender and JewelCraft versions, file state, units, gem count, weighting-list size, `issues` (list of problems to act on). |
| `size_to_diameter(size, fmt="US")` | Circumference and diameter from JewelCraft's own size table. US 8 → 56.965 / 18.1324 mm. Formats: US, UK (letter index A = 0), CH, JP, HK. |
| `ring_size(band)` | Fits a circle to the band's inner surface (heads and other parts on the same mesh are ignored), and returns `inner_diameter_mm`, `inner_circumference_mm`, `sizes` per format, `roundness_max_dev_mm`. The ring axis is the object's thinnest direction. A tested US 8 band read 18.134 mm → US 8, with or without a head attached. JP/HK return `None` unless within ~0.1 mm of a listed size. |
| `gems_in_scene()` | Each gem: name, cut, stone, dims (x, y, z), ct from JewelCraft's formula, location. |
| `stone_report()` | JewelCraft's design-report data without a file or browser: `warnings`, `gems` (stone, cut, color, size, ct, qty, ct_sum), `total_ct`, and `large_stone_overlaps`. That last check catches overlaps between stones whose centres are ≥ 4 mm apart, which JewelCraft's own check skips. |
| `prong_report(gem, prongs)` | Slices the prongs at the gem's girdle plane. Per prong: centre, angle from +Y, diameter at the girdle, `bite_mm` (+ = overlaps the girdle, − = gap), `bite_pct_of_diameter`. Cushions also get `suggested_corner_settings`. |
| `corner_prong_settings(L, W, d, bite_frac=0.235)` | `position` (rad/deg) and `intersection` for 4 corner prongs (`number=2, use_symmetry=True`) on an L × W cushion, giving JewelCraft's square-cushion grip (23.5% of prong diameter). |
| `seat_report(gem, cutter, metal=None)` | Cutter size at the girdle vs the stone, `stone_inside_cutter`, `min_clearance_mm`, `max_gap_mm`, and a note if the cutter's proportions don't match the stone. With `metal`: its volume, non-manifold edges, `stone_metal_overlap_mm3` (should be 0), and `control_overlap_without_seat_mm3`, the overlap with a copy of the metal that keeps every modifier except the Booleans using this cutter (should be > 0; proves the 0 isn't a silent failure). |
| `weigh(objects, union=True)` | Per-part volumes; the union volume (overlaps counted once); how much was double-counted; weights for every enabled alloy in the scene's list (built-in defaults if the list is empty). |
| `overlap_volume(a, b)` | Volume of a ∩ b (mm³). 0 = no collision. |
| `union_stats(objects)` | (volume, non-manifold edges) of the union. |
| `volume_nm(ob)` | (volume, signed volume, non-manifold edges). Negative signed volume = normals inward. |
| `min_wall(ob)` | (thinnest wall mm, location). Casts a ray from each face centre inward. **Knife edges and rims read as thin walls:** a seat rim meeting the top surface read 0.117 mm on a test plate. Look at the location before calling it a defect. |
| `print_check(objects, min_wall_mm=None, parts_that_must_not_touch=(), stl_path=None)` | Per object: volume, non-manifold edges, inside-out, thinnest wall and where, scale applied. Also collisions for the listed pairs, units, and (with `stl_path`) STL export plus a bounding-box check. `problems` is the list to report. |
| `stl_bbox(path)` | Size of a binary STL (to confirm it's in mm). |
| `select_only(*obs)`, `ctx()`, `get(name)`, `jc(".lib.gemlib")`, `addon_name()`, `jc_version()` | Utilities. `ctx()` returns the override dict for `temp_override`. |
| `eval_bm`, `slice_components`, `girdle_hull`, `hull2d`, `dist_to_hull`, `gem_frame`, `TempObjects` | Building blocks for custom checks. |

Known limits:
- `prong_report` and `seat_report` assume the gem's girdle is at the gem object's local
  z = 0, which is true for JewelCraft gems.
- Outline comparisons use convex hulls, so they're exact for convex girdles (round,
  cushion, oval, emerald…) and approximate for hearts and pears near the notch or point.
