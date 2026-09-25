# jewelcraft helper tests

Tests for `plugins/jewelcraft/skills/jewelcraft-blender/scripts/jc_helpers.py`. Each one
builds geometry with a known answer in background Blender and checks what the helpers
measure. Their failures are wrong-but-believable numbers rather than crashes, so reading
a change is not enough; run these after any edit to the script.

They live outside `plugins/jewelcraft/` because everything in the plugin folder is copied
to users when they install it.

## Requirements

- Blender (tested with 5.1.1) with **JewelCraft 2.18.1** installed and enabled in its user
  preferences. The runner doesn't pass `--factory-startup`, which would disable it.
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
| `test_volume.py` | Unioned weights (overlaps between and within objects), mirrored parts, curves, inside-out, open meshes, empties |
| `test_seat.py` | `seat_report`, including a control copy that keeps the metal's other modifiers |
| `test_ring_size.py` | `ring_size` on 29 synthetic US 8 bands (comfort-fit, wide, coarse, open, oval, dense and offset heads, bezel tubes, rotated and with rotation applied, intrusions), and JCS/US conversions |
| `test_finger_clearance.py` | Culet clearance, and a flat bar that dips into the hole between its corners |
| `test_stones.py` | `stone_overlaps` (beyond JewelCraft's 4 mm limit, square corners, near-touching, touching, nested, collection and geometry-nodes instances, hidden gems) and a 150-stone pavé timing |
| `test_prongs.py` | The corner-prong table, grip on corner and default prongs, notched prongs, tip heights, a halo rim joined into the prongs, a gem without JewelCraft's identity |
| `test_print.py` | `print_check`: STL readback, loose pieces, scale warnings, hidden and unselectable parts, selection restore |
| `test_weights_and_setup.py` | Alloy compositions, the temp-scene alloy copy, default fallbacks, `check_setup` |
| `test_build_ring.py` | The `build-ring` skill end to end: wrapped band, elongated cushion, stone height, notched corner prongs, seat, and every check |

`jc_test.py` holds the shared setup: loading the helpers, band and head builders, and the
prong/cutter builder recipe. A test prints `PASS`/`FAIL` lines and ends with a `RESULT`
line that `run.py` reads.

## Adding a test

Create `test_<area>.py` that imports `jc_test`, builds geometry whose correct answer you
know independently (not by running the helper), calls `check(label, condition, detail)`,
and ends with `done()`. Before relying on a new test, run it against the helper version
without the fix (`--helpers`) to see it fail.

JewelCraft 3.x is untested; these tests use the 2.18 builder recipe for prongs and cutters.
