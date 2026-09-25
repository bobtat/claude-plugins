"""ring_size and size_to_diameter on synthetic US 8 bands (18.132 mm)."""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from jc_test import *  # noqa: E402,F401,F403

H = load()
reset()
ROT = Matrix.Rotation(math.radians(35), 4, 'X') @ Matrix.Rotation(math.radians(25), 4, 'Z')


def ring(label, ob, expect=US8, tol=0.01, warn=None, loc=None, rot=None):
    """warn: True/False = the finger-hole warning must/mustn't appear; None = either."""
    if loc:
        ob.location = loc
    if rot:
        ob.rotation_euler = rot
    bpy.context.view_layer.update()
    r = H["ring_size"](ob)
    ok = abs(r["inner_diameter_mm"] - expect) <= tol and (warn is None or ("warning" in r) == warn)
    check(label, ok, (r["inner_diameter_mm"], r["min_opening_diameter_mm"], r.get("warning", "")[:40]))
    return r


r = ring("plain 64-segment band", band(), warn=False)
check("plain band is US 8", r["sizes"]["US"] == 8, r["sizes"])
ring("rotation applied to the mesh", band(mat=ROT), warn=False)
ring("object rotated 30 degrees", band(), rot=(0, 0, math.radians(30)), warn=False)
ring("object rotated 45 degrees", band(), rot=(0, 0, math.radians(45)), warn=False)
ring("comfort fit", band(profile=comfort()), warn=False)
ring("comfort fit, rotation applied", band(profile=comfort(), mat=ROT))
ring("comfort fit 8 mm, dome 1.0, rotation applied", band(profile=comfort(8, 1.0), mat=ROT))
ring("16 mm wide", band(profile=wide(16)))
ring("22 mm wide (wider than the diameter), rotation applied", band(profile=wide(22, 22), mat=ROT))
ring("24 segments (flats don't count as an intrusion)", band(n=24), warn=False)
ring("half shank", band(arc=180))
ring("300 degree open shank, rotation applied", band(arc=300, mat=ROT))

# Heads and bezels on the same mesh
ring("block head on the band", band(extra=[block(8, 8, 12, RI + 6.5)]), warn=False)
ring("block head clear above the band", band(extra=[block(8, 8, 12, RI + 9)]), warn=False)
ring("head wider than the band", band(extra=[block(26, 6, 6, RI + 4)]), warn=False)
ring("dense round head, centred", band(extra=[sphere(0, RI + 4)]), warn=False)
ring("dense round head, rotation applied", band(extra=[sphere(0, RI + 4)], mat=ROT), warn=False)
ring("dense head offset 2.5 mm along the axis", band(extra=[sphere(2.5, RI + 4)]), warn=False)
ring("dense head offset 2.5 mm, rotation applied", band(extra=[sphere(2.5, RI + 4)], mat=ROT), warn=False)
ring("bezel tube on the band", band(extra=[tube(3.1, 3.6, 3.0, RI + 1.2)]), warn=False)
ring("bezel tube, 128 segments", band(extra=[tube(3.1, 3.6, 3.0, RI + 1.2, seg=128)]), warn=False)
ring("bezel tube on a 32-segment band", band(n=32, extra=[tube(3.1, 3.6, 3.0, RI + 1.2)]), tol=0.1, warn=False)
bz = band(extra=[tube(3.1, 3.6, 3.0, RI + 1.2)])
ring("bezel tube, moved off origin", bz, loc=(123.4, 56.7, -8.9), warn=False)
ring("bezel tube, rotated", bz, rot=(0.3, 0.2, 0.1), warn=False)

# Things reaching into the finger hole must be flagged
ring("sizing beads flagged", band(extra=[bead(150), bead(210)]), warn=True)
ring("head sunk into the finger hole flagged", band(extra=[block(8, 8, 12, RI + 4)]), warn=True)
# With an intrusion the fit itself may be off by up to ~0.1 mm (documented).
ring("dense head reaching 1 mm in, rotation applied", band(extra=[sphere(4, RI + 3, rad=4)], mat=ROT), tol=0.1, warn=True)
ring("head beside the band reaching 1 mm in, rotation applied", band(extra=[sphere(3.5, RI + 1.5, rad=2.5)], mat=ROT), tol=0.1, warn=True)
ring("oval band reads its mean diameter and warns", band(sx=1.1), expect=19.06, tol=0.1, warn=True)

# Size conversions
for n, dia in ((1, 13.0), (13, 17.0), (20, 19.3333), (27, 21.6667)):
    s = H["size_to_diameter"](n, "JP")
    check(f"JCS size {n} is {dia} mm", abs(s["diameter_mm"] - dia) < 1e-3, s)
s = H["size_to_diameter"](8, "US")
check("US 8 is 18.1324 mm", abs(s["diameter_mm"] - 18.1324) < 1e-4, s)
check("JP reported from the band is 16.4", r["sizes"]["JP"] == 16.4, r["sizes"])
done()
