"""gems_in_scene, stone_overlaps, stone_report."""
import os
import sys
import time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from jc_test import *  # noqa: E402,F401,F403

H = load()
reset()


def pairs():
    return {frozenset((r["a"], r["b"])): r for r in H["stone_overlaps"]()}


def pair(x, y):
    return pairs().get(frozenset((x if isinstance(x, str) else x.name, y if isinstance(y, str) else y.name)), {})


# JewelCraft's own check misses these: centres 4 mm or more apart, and square corners.
r8a, r8b = gem('ROUND', 8, (0, 0, 0)), gem('ROUND', 8, (6, 0, 0))
check("8 mm rounds 6 mm apart overlap (5.7182 mm3, as an Exact Boolean)",
      abs(pair(r8a, r8b).get("overlap_mm3", 0) - 5.7182) < 1e-3, pair(r8a, r8b))
d = 10.5 / math.sqrt(2)
p1, p2 = gem('PRINCESS', 8, (30, 0, 0)), gem('PRINCESS', 8, (30 + d, d, 0))
check("8 mm princesses corner to corner 10.5 mm apart overlap",
      abs(pair(p1, p2).get("overlap_mm3", 0) - 0.1404) < 1e-3, pair(p1, p2))
g1, g2 = gem('ROUND', 5, (0, 30, 0)), gem('ROUND', 5, (5.05, 30, 0))
check("5 mm rounds 0.05 mm apart flagged as a gap", 0.04 < pair(g1, g2).get("gap_mm", 9) < 0.06, pair(g1, g2))
f1, f2 = gem('ROUND', 5, (0, 60, 0)), gem('ROUND', 5, (5.5, 60, 0))
check("5 mm rounds 0.5 mm apart not flagged", not pair(f1, f2))
t1, t2 = gem('ROUND', 5, (0, 90, 0)), gem('ROUND', 5, (5.0, 90, 0))
check("touching stones read as a 0 mm gap, not an overlap", pair(t1, t2).get("gap_mm") == 0.0, pair(t1, t2))
big, small = gem('ROUND', 8, (0, 120, 0)), gem('ROUND', 1, (0.5, 120.3, -0.5))
check("a stone inside another is caught", pair(big, small).get("overlap_mm3", 0) > 0.1, pair(big, small))

hidden = gem('ROUND', 5, (0, 150, 0))
hidden.hide_set(True)
names = [g["name"] for g in H["gems_in_scene"]()]
check("hidden gems are left out", hidden.name not in names)

# A collection instance of a gem overlapping a real one
src = bpy.data.collections.new("GemSrc")
gi = gem('ROUND', 6, (0, 0, 0))
for c in list(gi.users_collection):
    c.objects.unlink(gi)
src.objects.link(gi)
inst = link("Inst", None)
inst.instance_type, inst.instance_collection, inst.location = 'COLLECTION', src, (0, 180, 0)
real = gem('ROUND', 6, (4, 180, 0))
names = [g["name"] for g in H["gems_in_scene"]()]
check("instanced gems are listed", any(n.startswith(gi.name + " [Inst") for n in names), names)
check("an instance overlapping a real gem is caught",
      any(real.name in k and any(n.startswith(gi.name + " [") for n in k) for k in pairs()))

# Geometry-nodes instances of a gem get distinct labels
host = cube("GNHost", 4, (0, 220, 0))
ng = bpy.data.node_groups.new("InstGem", 'GeometryNodeTree')
ng.interface.new_socket("Geometry", in_out='INPUT', socket_type='NodeSocketGeometry')
ng.interface.new_socket("Geometry", in_out='OUTPUT', socket_type='NodeSocketGeometry')
ni, no = ng.nodes.new('NodeGroupInput'), ng.nodes.new('NodeGroupOutput')
iop, oi = ng.nodes.new('GeometryNodeInstanceOnPoints'), ng.nodes.new('GeometryNodeObjectInfo')
oi.inputs['As Instance'].default_value = True
oi.inputs['Object'].default_value = r8a
ng.links.new(ni.outputs[0], iop.inputs['Points'])
ng.links.new(oi.outputs['Geometry'], iop.inputs['Instance'])
ng.links.new(iop.outputs['Instances'], no.inputs[0])
host.modifiers.new("GN", 'NODES').node_group = ng
bpy.context.view_layer.update()
gn = [g["name"] for g in H["gems_in_scene"]() if "[GNHost" in g["name"]]
check("geometry-nodes instances have distinct labels", len(gn) == 8 and len(set(gn)) == 8, gn)
bpy.data.objects.remove(host)

rep = H["stone_report"]()
check("stone_report returns carats and overlaps", rep["total_ct"] > 0 and rep["stone_overlaps"])

# Speed: a 150-stone pave with 275 overlapping pairs
reset()
src = gem('ROUND', 1.3, (0, 0, 0))
for j in range(1, 150):
    o = src.copy()
    bpy.context.scene.collection.objects.link(o)
    o.location = ((j % 13) * 1.25, (j // 13) * 1.25, 0)
bpy.context.view_layer.update()
t0 = time.time()
res = H["stone_overlaps"]()
dt = time.time() - t0
check("150-stone pave: 275 overlapping pairs in under 10 s", len(res) == 275 and dt < 10, (len(res), round(dt, 2)))
check("no temporary objects left behind", not leftovers(), leftovers())
done()
