"""scene_setup.py: studio scene, framing, preview materials, renders and teardown."""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from jc_test import *  # noqa: E402,F401,F403
from bpy_extras.object_utils import world_to_camera_view  # noqa: E402

SCENE_SETUP = os.environ.get("JC_SCENE_SETUP") or os.path.normpath(os.path.join(
    HERE, "..", "..", "plugins", "jewelcraft", "skills", "scene-setup", "scripts",
    "scene_setup.py"))

H = load()
reset()
exec(compile(open(SCENE_SETUP, encoding="utf-8").read(), SCENE_SETUP, "exec"), {"__name__": "jcs"})
S = bpy.app.driver_namespace["JCS"]

src = bpy.context.scene
src_state = lambda: {"engine": src.render.engine, "camera": src.camera, "world": src.world,
                     "objects": sorted(o.name for o in src.objects),
                     "children": sorted(c.name for c in src.collection.children)}
slots = lambda: {o.name: [(s.link, s.material.name if s.material else None) for s in o.material_slots]
                 for o in bpy.data.objects if not o.name.startswith("JC ")}

# A US 8 band turned so the finger runs along X (not JewelCraft's Y), to check the axis fit.
b = band("Band")
b.rotation_euler.z = math.pi / 2
own = bpy.data.materials.new("Own")
b.data.materials.append(own)                          # has its own material
g = gem('CUSHION', 7.38, (0, 0, RI + 6.0))
g.rotation_euler.z = math.pi / 2
g.scale.y *= 8.85 / 7.38                              # length along the finger (X)
prong = cube("Prong", size=1.0, loc=(3.6, 3.1, RI + 4.0))  # no material slots
empty_slot = cube("EmptySlot", size=1.0, loc=(-3.6, 3.1, RI + 4.0))
empty_slot.data.materials.append(None)                # one empty slot
cutter = cube("Cutter", size=4, loc=(0, 0, RI + 6.0))
cutter.display_type = 'WIRE'                          # Boolean cutter: must not render
hidden = cube("Hidden", size=40)
hidden.hide_set(True)                                 # hidden in the viewport only
for name in ("Archive", "Excluded"):
    c = bpy.data.collections.new(name)
    src.collection.children.link(c)
    o = cube(name + " part", size=40)
    src.collection.objects.unlink(o)
    c.objects.link(o)
vl = bpy.context.view_layer
vl.layer_collection.children["Archive"].hide_viewport = True
vl.layer_collection.children["Excluded"].exclude = True
bpy.context.view_layer.update()

before_src, before_slots = src_state(), slots()

r = S["setup"](band="Band", size=48, samples=2)
studio = bpy.data.scenes["JC Studio"]
check("setup leaves the source scene's engine, camera, world and objects alone",
      src_state() == before_src, src_state())
check("gold on the visible metal parts",
      sorted(r["materials"]["metal"]) == ["Band", "EmptySlot", "Prong"], r["materials"])
check("diamond on the gem", r["materials"]["gems"] == [g.name], r["materials"])
check("the mesh keeps its own material under the preview one",
      b.data.materials[0] == own and b.material_slots[0].link == 'OBJECT'
      and b.material_slots[0].material.name.startswith("JC Gold"))
fa = Vector(r["finger_axis"])
check("finger axis fitted from the band", r["finger_axis_source"] == "fitted from Band"
      and abs(abs(fa.x) - 1) < 1e-3, r["finger_axis"])
check("hidden and excluded collections are excluded in the studio",
      all(studio.view_layers[0].layer_collection.children[n].exclude for n in ("Archive", "Excluded")))
world_nodes = {n.type: n for n in studio.world.node_tree.nodes}
check("the HDRI's colour is removed", world_nodes["HUE_SAT"].inputs["Saturation"].default_value == 0)
check("a Blender without dispersion says so",
      S["make_materials"]()["dispersion"] or any("dispersion" in n for n in r["notes"]), r["notes"])

top = bpy.data.objects["JC Top"].matrix_world
check("top view looks straight down", abs(top.col[2].xyz.dot(Vector((0, 0, 1))) - 1) < 1e-6)
check("top view has the finger running left to right", abs(abs(top.col[0].xyz.dot(fa)) - 1) < 1e-6)
side = bpy.data.objects["JC Side"].matrix_world
check("side view has the finger running left to right", abs(abs(side.col[0].xyz.dot(fa)) - 1) < 1e-6)
end = bpy.data.objects["JC End"].matrix_world
check("end view looks along the finger", abs(abs(end.col[2].xyz.dot(fa)) - 1) < 1e-6)

# Every corner of the visible parts (the head views: of the gem) lands inside the frame.
dg = bpy.context.evaluated_depsgraph_get()
def corners(obs):
    return [o.evaluated_get(dg).matrix_world @ Vector(c) for o in obs for c in o.evaluated_get(dg).bound_box]
visible = [bpy.data.objects[n] for n in ("Band", "Prong", "EmptySlot", g.name)]
for name, (kind, az, el, framing) in S["VIEWS"].items():
    cam = bpy.data.objects[name]
    pts = corners(visible if framing == "all" else [g])
    uv = [world_to_camera_view(studio, cam, p) for p in pts]
    inside = all(0 <= q.x <= 1 and 0 <= q.y <= 1 and q.z > 0 for q in uv)
    fill = max(max(abs(q.x - 0.5), abs(q.y - 0.5)) for q in uv) * 2
    check(f"{name} frames the piece", inside and fill > 0.4, f"fill {fill:.2f}")

out = os.path.join(bpy.app.tempdir, "jc_scene_setup_test")
rr = S["render_views"](views=["JC Top", "JC Hero"], out_dir=out)
check("renders are written", all(os.path.isfile(f) for f in rr["files"]), rr["files"])
check("contact sheet is written", os.path.isfile(rr["contact_sheet"]["path"]))
check("cutter and viewport-hidden part are hidden for the render",
      sorted(rr["hidden_for_render"]) == ["Cutter", "Hidden"], rr["hidden_for_render"])
check("their render visibility is restored afterwards",
      not cutter.hide_render and not hidden.hide_render)

S["setup"](band="Band", size=48, samples=2)
rig = bpy.data.collections["JC Studio Rig"]
check("running setup again updates in place",
      len([o for o in rig.objects if o.type == 'CAMERA']) == 6
      and len([o for o in rig.objects if o.type == 'LIGHT']) == 3
      and not any(o.name.endswith(".001") for o in bpy.data.objects), [o.name for o in rig.objects])

td = S["teardown"]()
check("teardown removes the studio scene, rig, world and materials",
      "JC Studio" not in bpy.data.scenes and "JC Studio Rig" not in bpy.data.collections
      and "JC Studio World" not in bpy.data.worlds
      and not any(m.name.startswith("JC ") for m in bpy.data.materials))
check("teardown unloads the HDRI", not any(i.filepath.endswith("studio.exr") for i in bpy.data.images))
check("material slots are exactly as before (none, empty, own)", slots() == before_slots,
      {k: v for k, v in slots().items() if before_slots.get(k) != v})
check("the source scene is as before", src_state() == before_src)
done()
