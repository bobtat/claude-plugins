"""Shared setup for the jewelcraft helper tests. Imported inside background Blender.

Each test script loads the helpers, builds geometry with a known answer, and calls
check(). done() prints the RESULT line that run.py reads.
"""
import bmesh
import bpy
import contextlib
import math
import os
from types import SimpleNamespace as NS

from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
HELPERS = os.environ.get("JC_HELPERS") or os.path.normpath(os.path.join(
    HERE, "..", "..", "plugins", "jewelcraft", "skills", "jewelcraft-blender", "scripts",
    "jc_helpers.py"))

# Inner radius of a US 8 ring (18.1324 mm inside diameter).
RI = 18.1324 / 2
US8 = 18.132

FAILS = []


def load():
    exec(compile(open(HELPERS, encoding="utf-8").read(), HELPERS, "exec"), {"__name__": "jc"})
    return bpy.app.driver_namespace["JC"]


def reset():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for m in list(bpy.data.meshes):
        bpy.data.meshes.remove(m)
    u = bpy.context.scene.unit_settings
    u.system, u.length_unit, u.scale_length = 'METRIC', 'MILLIMETERS', 0.001


def check(label, cond, detail=""):
    print(("PASS " if cond else "FAIL ") + label + ("  " + str(detail) if detail != "" else ""))
    if not cond:
        FAILS.append(label)


def done():
    print("RESULT", "FAILED: " + ", ".join(FAILS) if FAILS else "ALL PASSED")


def leftovers():
    """Anything the helpers' temporary objects left behind."""
    return ([c.name for c in bpy.data.collections if c.name.startswith("JC_TMP")]
            + [o.name for o in bpy.data.objects if o.name.startswith("JC_TMP")])


def link(name, data):
    o = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(o)
    bpy.context.view_layer.update()
    return o


def mesh(name, build):
    """Object from a function that fills a bmesh."""
    bm = bmesh.new()
    build(bm)
    bm.normal_update()
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    return link(name, me)


def cube(name, size=10, loc=(0, 0, 0)):
    o = mesh(name, lambda bm: bmesh.ops.create_cube(bm, size=size))
    o.location = loc
    bpy.context.view_layer.update()
    return o


def curve_rod(name, length=10, y=0.0):
    """A bevelled poly curve. With the default bevel resolution its cross-section is a
    12-sided polygon of area 3, so its volume is 3 x length."""
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions, cu.bevel_depth, cu.use_fill_caps = '3D', 1.0, True
    sp = cu.splines.new('POLY')
    sp.points.add(1)
    sp.points[0].co = (0, y, 0, 1)
    sp.points[1].co = (length, y, 0, 1)
    return link(name, cu)


def gem(cut, size, loc, stone='DIAMOND', rot=(0, 0, 0)):
    bpy.context.scene.cursor.location = loc
    bpy.ops.object.jewelcraft_gem_add(cut=cut, stone=stone, size=size)
    o = bpy.context.object
    o.rotation_euler = rot
    bpy.context.view_layer.update()
    return o


# ---------------------------------------------------------------- ring bands

RECT = [(RI, -1), (RI + 1.8, -1), (RI + 1.8, 1), (RI, 1)]


def comfort(width=4.0, dome=0.6, k=12):
    """Profile whose inner surface domes toward the finger: radius RI at the centre."""
    inner = [(RI + dome * (2 * (-width / 2 + width * i / k) / width) ** 2, -width / 2 + width * i / k)
             for i in range(k + 1)]
    return [(RI + 2.0, width / 2), (RI + 2.0, -width / 2)] + inner


def wide(width, rows=0):
    if not rows:
        return [(RI, -width / 2), (RI + 1.5, -width / 2), (RI + 1.5, width / 2), (RI, width / 2)]
    h = width / 2
    return ([(RI, -h), (RI + 1.5, -h)] + [(RI + 1.5, -h + i) for i in range(1, rows + 1)]
            + [(RI, h - i) for i in range(rows)])


def band(name="Band", profile=RECT, n=64, arc=360.0, sx=1.0, mat=None, extra=()):
    """Ring band around local Y from a closed profile of (radius, y). arc < 360 gives an
    open shank with end caps; sx stretches it into an oval; mat is applied to the mesh
    (applied rotation); extra adds more geometry to the same mesh."""
    bm = bmesh.new()
    closed = arc >= 360.0
    cnt = n if closed else n + 1
    rows = []
    for r, y in profile:
        row = []
        for i in range(cnt):
            a = math.radians(arc) * i / n - (0 if closed else math.radians(arc) / 2)
            row.append(bm.verts.new((sx * r * math.sin(a), y, -r * math.cos(a))))
        rows.append(row)
    for j in range(len(profile)):
        a, b = rows[j], rows[(j + 1) % len(profile)]
        for i in range(n):
            i2 = (i + 1) % cnt
            bm.faces.new((a[i], a[i2], b[i2], b[i]))
    if not closed:
        bm.faces.new([r[0] for r in rows][::-1])
        bm.faces.new([r[-1] for r in rows])
    for fn in extra:
        fn(bm)
    if mat is not None:
        bmesh.ops.transform(bm, matrix=mat, verts=bm.verts[:])
    bm.normal_update()
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    return link(name, me)


def sphere(y, z, rad=3.0, seg=128, ring=64):
    """Dense round head: many more vertices than the band."""
    def f(bm):
        g = bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=ring, radius=rad)["verts"]
        bmesh.ops.translate(bm, vec=(0, y, z), verts=g)
    return f


def block(sx, sy, sz, z):
    def f(bm):
        g = bmesh.ops.create_cube(bm, size=1)["verts"]
        bmesh.ops.scale(bm, vec=(sx, sy, sz), verts=g)
        bmesh.ops.translate(bm, vec=(0, 0, z), verts=g)
        es = list({e for v in g for e in v.link_edges})
        bmesh.ops.subdivide_edges(bm, edges=es, cuts=3, use_grid_fill=True)
    return f


def tube(ri, ro, h, z0, seg=64):
    """Bezel tube standing on the band, its axis along Z (a perfect circle end-on)."""
    def f(bm):
        rows = [[bm.verts.new((r * math.cos(2 * math.pi * i / seg), r * math.sin(2 * math.pi * i / seg), z))
                 for i in range(seg)] for r, z in ((ri, z0), (ro, z0), (ro, z0 + h), (ri, z0 + h))]
        for k in range(4):
            a, b = rows[k], rows[(k + 1) % 4]
            for i in range(seg):
                bm.faces.new((a[i], a[(i + 1) % seg], b[(i + 1) % seg], b[i]))
    return f


def bead(angle_deg, rad=1.0):
    """Sizing bead centred on the inner surface, reaching into the finger hole."""
    def f(bm):
        a = math.radians(angle_deg)
        g = bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=8, radius=rad)["verts"]
        bmesh.ops.translate(bm, vec=(RI * math.sin(a), 0, -RI * math.cos(a)), verts=g)
    return f


# ---------------------------------------------------------------- JewelCraft builders

def build(H, gem_ob, kind, **overrides):
    """The prong/cutter builder recipe from references/operators.md (JewelCraft 2.18)."""
    pm = H["jc"](".operators.add_prongs.prongs_mesh")
    pp = H["jc"](".operators.add_prongs.prongs_presets")
    cm = H["jc"](".operators.add_cutter.cutter_mesh")
    cp = H["jc"](".operators.add_cutter.cutter_presets")
    gemlib, asset = H["jc"](".lib.gemlib"), H["jc"](".lib.asset")
    prefs = bpy.context.preferences.addons[H["jc"](".var").ADDON_ID].preferences
    if kind == "prongs":
        builder, presets, color, name = pm.create_prongs, pp.init_presets, prefs.color_prongs, "Prongs"
    else:
        builder, presets, color, name = cm.get, cp.init_presets, prefs.color_cutter, "Cutter"
    s = NS(gem_dim=gem_ob.dimensions.copy(), cut=gem_ob["gem"]["cut"], color=color,
           handle_dim=NS(x=0, y=0, z1=0, z2=0), girdle_dim=NS(x=0, y=0, z1=0, z2=0),
           hole_dim=NS(x=0, y=0, z1=0, z2=0), mul_1=1.0, mul_2=1.0, mul_3=1.0,
           handle_shift=0.0, hole_shift=0.0)
    s.shape = gemlib.CUTS[s.cut].shape
    presets(s)
    for k, v in overrides.items():
        setattr(s, k, v)
    bm = builder(s)
    before = set(gem_ob.children)
    H["select_only"](gem_ob)
    c = H["ctx"]()
    with (bpy.context.temp_override(**c) if c else contextlib.nullcontext()):
        asset.bm_to_scene(bm, name=name, color=color)
    return next(ch for ch in gem_ob.children if ch not in before)


def boolean(target, cutter, op='DIFFERENCE'):
    md = target.modifiers.new("Seat", 'BOOLEAN')
    md.operation, md.solver, md.object = op, 'EXACT', cutter
    bpy.context.view_layer.update()
    return md
