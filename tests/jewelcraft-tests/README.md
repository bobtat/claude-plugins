# jewelcraft helper tests

Tests for `plugins/jewelcraft/skills/jewelcraft-blender/scripts/jc_helpers.py`,
`plugins/jewelcraft/skills/scene-setup/scripts/scene_setup.py` and the
`plugins/jewelcraft/skills/build-from-paths/scripts/` scripts. Each one
builds geometry with a known answer in background Blender and checks what the helpers
measure. Their failures are wrong-but-believable numbers rather than crashes, so reading
a change is not enough; run these after any edit to the script.

They live outside `plugins/jewelcraft/` because everything in the plugin folder is copied
to users when they install it.

## Requirements

- Blender (tested with 5.1.1) with **JewelCraft 2.18.1** installed and enabled in its user
  preferences. The runner doesn't pass `--factory-startup`, which would disable it.
- `test_checks.py`, `test_path_build.py` and the SDF checks in `test_volume.py` need Blender
  5.x (Geometry Nodes' SDF grid nodes). They were written on Blender 5.2.2 with JewelCraft
  3.0.1, where `test_prongs.py` and `test_build_ring.py` fail because they use the 2.18
  builder recipe (and fail the same way without these changes).
- Any Python 3 to run `run.py`; the tests themselves run in Blender's Python.

## Running

```
python run.py --blender "C:/Program Files/Blender Foundation/Blender 5.1/blender.exe"
python run.py --blender <path> ring prongs     # only files whose name contains these
python run.py --blender <path> -v              # print every check, not just failures
python run.py --blender <path> --helpers <other jc_helpers.py>
```

`BLENDER` can stand in for `--blender`. The exit code is 0 when every file passes. The
whole suite takes about 20 seconds.

## What's covered

| File | Checks |
|---|---|
| `test_volume.py` | Unioned weights (overlaps between and within objects), mirrored parts, curves, inside-out, open meshes, empties, which Boolean solver each union gets, the fast solver against Exact on dense SDF meshes, `min_wall` on Geometry Nodes SDF meshes |
| `test_seat.py` | `seat_report`, including a control copy that keeps the metal's other modifiers |
| `test_ring_size.py` | `ring_size` on 29 synthetic US 8 bands (comfort-fit, wide, coarse, open, oval, dense and offset heads, bezel tubes, rotated and with rotation applied, intrusions), and JCS/US conversions |
| `test_finger_clearance.py` | Culet clearance, and a flat bar that dips into the hole between its corners |
| `test_stones.py` | `stone_overlaps` (beyond JewelCraft's 4 mm limit, square corners, near-touching, touching, nested, collection and geometry-nodes instances, hidden gems) and a 150-stone pavé timing |
| `test_prongs.py` | The corner-prong table, grip on corner and default prongs, notched prongs, tip heights, a halo rim joined into the prongs, a gem without JewelCraft's identity |
| `test_print.py` | `print_check`: STL readback, loose pieces, scale warnings, hidden and unselectable parts, parts hidden only from renders, selection restore |
| `test_checks.py` | `pieces`, `overlap_islands` (counts, volumes, centres, touching-only, the solver used), `thin_spots` (cube corners, a thin fin, a sheet too thin to survive), `node_inputs`/`set_node_inputs` |
| `test_path_build.py` | `build-from-paths`: tube and ball volumes, mirroring, fillets only in inside corners, Explode, `rebuild` keeping settings and defaulting new inputs, the casting's trim, seat grooves and drill dimple, the fused piece, `profile`, `archive`, the U-wire's angles, radii, tangents and length, and `apply` |
| `test_weights_and_setup.py` | Alloy compositions, the temp-scene alloy copy, default fallbacks, `check_setup` |
| `test_build_ring.py` | The `build-ring` skill end to end: wrapped band, elongated cushion, stone height, notched corner prongs, seat, and every check |
| `test_scene_setup.py` | `scene-setup`'s script: the source scene left alone, preview materials per object, finger axis fitted on a band turned 90°, camera orientation and framing, hidden/excluded parts, a small render, `preview_jpeg`, re-running setup, and teardown restoring every material slot. `show_image` needs a window, so it isn't covered |

`jc_test.py` holds the shared setup: loading the helpers, band and head builders, an SDF
rebuild like the build-from-paths node groups make (`sdf_remesh`), and the prong/cutter
builder recipe. A test prints `PASS`/`FAIL` lines and ends with a `RESULT`
line that `run.py` reads.

## Adding a test

Create `test_<area>.py` that imports `jc_test`, builds geometry whose correct answer you
know independently (not by running the helper), calls `check(label, condition, detail)`,
and ends with `done()`. Before relying on a new test, run it against the helper version
without the fix (`--helpers`) to see it fail.

JewelCraft 3.x is untested; these tests use the 2.18 builder recipe for prongs and cutters.

## Running from the open Blender

Through the Blender MCP there is no terminal, but the open Blender can start the runner with
its own Python and wait for it, or start it in the background and write a log to read later:

```python
import bpy, subprocess, sys
subprocess.run([sys.executable, r"<repo>/tests/jewelcraft-tests/run.py",
                "--blender", bpy.app.binary_path, "-v"], capture_output=True, text=True)
```

Each test file runs in its own background Blender, so the open file is never touched. On
Windows, add `creationflags=0x08000000` to that call so no console window opens (the runner
does the same for each test).
