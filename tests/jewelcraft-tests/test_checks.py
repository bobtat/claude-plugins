"""pieces, overlap_islands, thin_spots, node_inputs / set_node_inputs, and the fast solver
on dense SDF meshes."""
import os
import sys
import time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from jc_test import *  # noqa: E402,F401,F403

H = load()
reset()


def boxes(*specs):
    """One mesh of axis-aligned boxes, each (sx, sy, sz, x, y, z)."""
    def f(bm):
        for sx, sy, sz, x, y, z in specs:
            g = bmesh.ops.create_cube(bm, size=1)["verts"]
            bmesh.ops.scale(bm, vec=(sx, sy, sz), verts=g)
            bmesh.ops.translate(bm, vec=(x, y, z), verts=g)
    return f


# ---------------------------------------------------------------- pieces
one = cube("One", loc=(0, 0, 0))
check("a cube is one piece", H["pieces"](one) == 1, H["pieces"](one))
two = mesh("Two", boxes((2, 2, 2, 0, 30, 0), (2, 2, 2, 10, 30, 0)))
check("two separate boxes in one mesh are two pieces", H["pieces"](two) == 2, H["pieces"](two))


def with_loose(bm):
    bmesh.ops.create_cube(bm, size=2)
    bm.verts.new((20, 0, 0))
check("a loose vertex is not a piece", H["pieces"](mesh("Loose", with_loose)) == 1)

# ---------------------------------------------------------------- overlap_islands
# A 10 x 10 x 2 plate with four 1 mm "prongs" (one mesh of four boxes) each sunk 0.5 mm
# into one corner region: four islands of 1 x 1 x 0.5 = 0.5 mm3, plus one box that only
# touches the plate's top face.
plate = mesh("Plate", boxes((10, 10, 2, 0, 0, -1)))
plate.location = (0, 60, 0)
prongs = mesh("Prongs", boxes(*[(1, 1, 3, x, y, 1.0) for x in (-4, 4) for y in (-4, 4)],
                              (1, 1, 1, 0, 0, 0.5)))
prongs.location = (0, 60, 0)
bpy.context.view_layer.update()
r = H["overlap_islands"](plate, prongs)
vols = sorted(i["mm3"] for i in r["islands"])
check("four sunk prongs give four islands of 0.5 mm3", len(vols) == 4 and all(abs(v - 0.5) < 1e-3 for v in vols), r)
check("the box that only touches makes no island", abs(r["total_mm3"] - 2.0) < 1e-3, r["total_mm3"])
cs = sorted((round(i["centre"][0]), round(i["centre"][1] - 60), round(i["centre"][2], 2)) for i in r["islands"])
check("island centres sit at the four corners, 0.25 mm below the top",
      cs == [(-4, -4, -0.25), (-4, 4, -0.25), (4, -4, -0.25), (4, 4, -0.25)], cs)
check("the islands were found with the fast solver", r["solver"] == ("MANIFOLD" if H["MANIFOLD_SOLVER"] else "EXACT"),
      r["solver"])
F = Matrix.Translation((0, -60, 0))
r2 = H["overlap_islands"](plate, prongs, frame=F)
check("frame= gives the centres in that frame", all(abs(i["centre"][1]) < 4.5 for i in r2["islands"]), r2["islands"])
far = cube("FarAway", 2, (0, 60, 50))
check("parts that don't meet have no islands", H["overlap_islands"](plate, far)["islands"] == [])

# ---------------------------------------------------------------- thin_spots
if not hasattr(bpy.types, "GeometryNodeMeshToSDFGrid"):
    check("SDF grid nodes available for thin_spots and the SDF checks", False, "needs Blender 5.x")
else:
    blk = cube("Block", 6, (0, 100, 0))
    r = H["thin_spots"](blk, min_mm=0.5)
    check("a 6 mm cube has no spots: its edges (0.41 r) and corners (0.73 r) stay under 0.85 r",
          r["spots"] == [], r["spots"][:3])
    # A 0.3 mm fin, 4 mm tall, standing on a 6 mm block: thinner than 0.5 mm.
    fin = mesh("Fin", boxes((6, 6, 6, 0, 0, 0), (0.3, 4, 4, 0, 0, 5)))
    fin.location = (0, 120, 0)
    bpy.context.view_layer.update()
    r = H["thin_spots"](fin, min_mm=0.5)
    on_fin = [s for s in r["spots"] if s["centre"][2] > 3.5 and abs(s["centre"][0]) < 0.5]
    check("a 0.3 mm fin is flagged", len(on_fin) > 0 and on_fin[0]["depth_r"] >= 1.0, r["spots"][:3])
    check("nothing on the block itself is flagged (its corners are at z = +-3)",
          all(s["centre"][2] > 3.5 for s in r["spots"]), r["spots"])
    sheet = mesh("Sheet", boxes((5, 5, 0.3, 0, 0, 0)))
    sheet.location = (0, 140, 0)
    bpy.context.view_layer.update()
    r = H["thin_spots"](sheet, min_mm=0.5)
    check("a part thinner than min_mm everywhere is reported as gone", "note" in r and r["spots"]
          and r["spots"][0]["depth_mm"] is None, r.get("note"))

    # ------------------------------------------------------------ fast solver on dense SDF meshes
    def sphere_src(name, x):
        o = mesh(name, lambda bm: bmesh.ops.create_uvsphere(bm, u_segments=48, v_segments=24, radius=4.0))
        o.location = (x, 200, 0)
        return o
    s1 = sdf_remesh("SDF A", sphere_src("Sphere A", 0.0), voxel=0.08)
    s2 = sdf_remesh("SDF B", sphere_src("Sphere B", 5.0), voxel=0.08)
    t0 = time.time()
    fast = H["overlap_volume"](s1, s2)
    t_fast = time.time() - t0
    t0 = time.time()
    exact = H["overlap_volume"](s1, s2, solver="EXACT")
    t_exact = time.time() - t0
    check("on dense SDF meshes the fast solver matches Exact", exact > 0 and abs(fast - exact) < 1e-3 * exact,
          {"fast_mm3": round(fast, 4), "exact_mm3": round(exact, 4), "faces_each": len(s1.evaluated_get(
              bpy.context.evaluated_depsgraph_get()).data.polygons),
           "fast_s": round(t_fast, 2), "exact_s": round(t_exact, 2)})

# ---------------------------------------------------------------- node inputs by name
ng = bpy.data.node_groups.new("Inputs test", 'GeometryNodeTree')
ng.interface.new_socket("Geometry", in_out='INPUT', socket_type='NodeSocketGeometry')
ng.interface.new_socket("Geometry", in_out='OUTPUT', socket_type='NodeSocketGeometry')
s = ng.interface.new_socket("Wire Diameter", in_out='INPUT', socket_type='NodeSocketFloat')
s.default_value = 1.1
ng.interface.new_socket("Target", in_out='INPUT', socket_type='NodeSocketObject')
gi, go = ng.nodes.new('NodeGroupInput'), ng.nodes.new('NodeGroupOutput')
ng.links.new(gi.outputs["Geometry"], go.inputs["Geometry"])
holder = cube("Holder", 1, (0, 300, 0))
holder.modifiers.new("Head", 'NODES').node_group = ng
v = H["node_inputs"](holder)
check("node_inputs reads the inputs by name", abs(v["Wire Diameter"] - 1.1) < 1e-6 and v["Target"] is None, v)
r = H["set_node_inputs"](holder, "Head", {"Wire Diameter": 0.9, "Target": "One"})
v = H["node_inputs"](holder, "Head")
check("set_node_inputs sets values and objects by name", abs(v["Wire Diameter"] - 0.9) < 1e-6 and v["Target"] == "One", v)
check("set_node_inputs returns the previous values", abs(r["previous"]["Wire Diameter"] - 1.1) < 1e-6, r)
try:
    H["set_node_inputs"](holder, values={"Wire Diamter": 1.0})
    check("an unknown input name raises KeyError naming the real inputs", False)
except KeyError as e:
    check("an unknown input name raises KeyError naming the real inputs", "Wire Diameter" in str(e), e)

check("no temporary objects or node groups left behind",
      not leftovers() and not [g.name for g in bpy.data.node_groups if g.name.startswith("JC_TMP")], leftovers())
done()
