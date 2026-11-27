"""seat_report."""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from jc_test import *  # noqa: E402,F401,F403

H = load()
reset()

# The plate is moved into place by a modifier, as a Curve modifier wraps a band. A
# control copy that dropped every modifier would measure the plate in its old place.
plate = cube("Plate", size=10, loc=(0, 0, -10))
d = plate.modifiers.new("Lift", 'DISPLACE')
d.direction, d.strength, d.mid_level = 'Z', 20, 0.5
stone = cube("Gem", size=4, loc=(0, 0, 3))
cutter = cube("Cutter", size=5, loc=(0, 0, 3))
cutter.hide_set(True)
boolean(plate, cutter)

r = H["seat_report"](stone, cutter, plate)
check("stone clears the seated metal", r["stone_metal_overlap_mm3"] == 0, r["stone_metal_overlap_mm3"])
check("control keeps the other modifiers and overlaps", r["control_overlap_without_seat_mm3"] > 0, r)
check("stone sits inside the cutter", r["stone_inside_cutter"] and abs(r["min_clearance_mm"] - 0.5) < 1e-3, r)
check("user's modifiers untouched", [m.name for m in plate.modifiers] == ["Lift", "Seat"])
check("no temporary objects left behind", not leftovers(), leftovers())
done()
