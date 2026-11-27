# jewelcraft plugin: build jewelry from editable paths, fused into solids by Geometry Nodes.
# Run this whole file once per Blender session through the Blender MCP's
# execute_blender_code tool. It registers the functions in
#     bpy.app.driver_namespace["JPB"]
# and later calls use:  B = bpy.app.driver_namespace["JPB"]
# Loading it changes nothing in the file; each function says what it creates or changes.
#
# How the solids are made: every part (a tube along a path, a profile swept along a path,
# a band) becomes a mesh, the meshes are turned into one signed-distance (SDF) voxel grid
# and back into a mesh. Overlapping parts become one closed solid. A fillet is a
# "closing": grow the surface by r, then shrink it by r, which rounds inside corners only.
# Voxel Size sets the detail (0.03 mm to check and export; 0.05 while editing).
#
# Objects follow one naming scheme, "<prefix> <role>" (see references/two-part-build.md):
#   <prefix> Head Control   empty at the stone's girdle centre; head parts are its children
#   <prefix> Wire, Peg, Gallery (+ Gallery Profile)          paths of the hand-built head
#   <prefix> Band, Shoulders (+ Shoulder Profile), Size      the cast shank
#   <prefix> Head Wire, Casting, Ring    mesh objects whose Geometry Nodes make the solids

import bpy
import math
from mathutils import Vector

# The skill compares the loaded copy against this line, so bump it with every change.
PATH_BUILD_VERSION = "0.1.0"


# ---------------------------------------------------------------- node-group plumbing

def group(name):
    """An empty Geometry Nodes group called `name` (created, or cleared if it exists),
    with a Geometry input and output."""
    ng = bpy.data.node_groups.get(name) or bpy.data.node_groups.new(name, 'GeometryNodeTree')
    ng.nodes.clear()
    for it in list(ng.interface.items_tree):
        ng.interface.remove(it)
    ng.interface.new_socket("Geometry", in_out='INPUT', socket_type='NodeSocketGeometry')
    ng.interface.new_socket("Geometry", in_out='OUTPUT', socket_type='NodeSocketGeometry')
    return ng


SOCKET_TYPES = {"float": 'NodeSocketFloat', "int": 'NodeSocketInt', "bool": 'NodeSocketBool',
                "object": 'NodeSocketObject', "vector": 'NodeSocketVector'}


def socket(ng, name, kind, default=None, min_value=None, description=""):
    """Add a modifier input to `ng`. kind: float, int, bool, object or vector."""
    s = ng.interface.new_socket(name, in_out='INPUT', socket_type=SOCKET_TYPES[kind])
    if default is not None:
        s.default_value = default
    if min_value is not None:
        s.min_value = min_value
    s.description = description
    return s


class Builder:
    """Adds nodes and links to one group. Methods take and return node sockets; a float
    argument can be a number or a socket."""

    def __init__(self, ng):
        self.ng = ng
        self.N = ng.nodes.new
        self.L = ng.links.new
        self.gi = self.N('NodeGroupInput')
        self.go = self.N('NodeGroupOutput')

    def _set(self, sock, v):
        if isinstance(v, (int, float, tuple)):
            sock.default_value = v
        else:
            self.L(v, sock)

    def obj(self, input_name):
        """Object Info for an object input, in RELATIVE space: the object's geometry as
        seen from the modifier's object, so parenting and moving the head both work."""
        oi = self.N('GeometryNodeObjectInfo')
        oi.transform_space = 'RELATIVE'
        oi.label = input_name
        self.L(self.gi.outputs[input_name], oi.inputs["Object"])
        return oi.outputs["Geometry"]

    def math(self, op, a, b):
        n = self.N('ShaderNodeMath')
        n.operation = op
        for i, v in enumerate((a, b)):
            self._set(n.inputs[i], v)
        return n.outputs[0]

    def join(self, *socks):
        j = self.N('GeometryNodeJoinGeometry')
        for s in socks:
            self.L(s, j.inputs["Geometry"])
        return j.outputs["Geometry"]

    def tubes(self, curve, half_width, ends=True, resolution=32):
        """Round tube along every path in `curve`: radius = each point's radius x
        half_width, so set point radius 1 and drive the size from a modifier input.
        ends=True puts a ball on both ends of each path (a wire end, a prong tip)."""
        sr = self.N('GeometryNodeSetCurveRadius')
        self.L(curve, sr.inputs["Curve"])
        self.L(self.math('MULTIPLY', self.N('GeometryNodeInputRadius').outputs[0], half_width),
               sr.inputs["Radius"])
        circ = self.N('GeometryNodeCurvePrimitiveCircle')
        circ.mode = 'RADIUS'
        circ.inputs["Resolution"].default_value = resolution
        circ.inputs["Radius"].default_value = 1.0
        c2m = self.N('GeometryNodeCurveToMesh')
        self.L(sr.outputs["Curve"], c2m.inputs["Curve"])
        self.L(circ.outputs["Curve"], c2m.inputs["Profile Curve"])
        self.L(self.N('GeometryNodeInputRadius').outputs[0], c2m.inputs["Scale"])
        c2m.inputs["Fill Caps"].default_value = True
        if not ends:
            return c2m.outputs["Mesh"]
        # Balls on the end points: tag the ends, take the evaluated points, keep the tagged.
        st = self.N('GeometryNodeStoreNamedAttribute')
        st.data_type, st.domain = 'FLOAT', 'POINT'
        st.inputs["Name"].default_value = "jpb_end"
        self.L(sr.outputs["Curve"], st.inputs["Geometry"])
        self.L(self.N('GeometryNodeCurveEndpointSelection').outputs[0], st.inputs["Value"])
        c2p = self.N('GeometryNodeCurveToPoints')
        c2p.mode = 'EVALUATED'
        self.L(st.outputs["Geometry"], c2p.inputs["Curve"])
        na = self.N('GeometryNodeInputNamedAttribute')
        na.data_type = 'FLOAT'
        na.inputs["Name"].default_value = "jpb_end"
        cmp = self.N('FunctionNodeCompare')
        cmp.data_type, cmp.operation = 'FLOAT', 'LESS_THAN'
        self.L(na.outputs["Attribute"], cmp.inputs["A"])
        cmp.inputs["B"].default_value = 0.999
        de = self.N('GeometryNodeDeleteGeometry')
        de.domain = 'POINT'
        self.L(c2p.outputs["Points"], de.inputs["Geometry"])
        self.L(cmp.outputs["Result"], de.inputs["Selection"])
        sph = self.N('GeometryNodeMeshUVSphere')
        sph.inputs["Segments"].default_value = resolution
        sph.inputs["Rings"].default_value = max(8, resolution // 2)
        sph.inputs["Radius"].default_value = 1.0
        iop = self.N('GeometryNodeInstanceOnPoints')
        self.L(de.outputs["Geometry"], iop.inputs["Points"])
        self.L(sph.outputs["Mesh"], iop.inputs["Instance"])
        self.L(self.N('GeometryNodeInputRadius').outputs[0], iop.inputs["Scale"])
        rl = self.N('GeometryNodeRealizeInstances')
        self.L(iop.outputs["Instances"], rl.inputs["Geometry"])
        return self.join(c2m.outputs["Mesh"], rl.outputs["Geometry"])

    def mirror(self, sock, sx, sy):
        """`sock` plus its mirror image (scale sx, sy), faces flipped back outward."""
        tr = self.N('GeometryNodeTransform')
        self.L(sock, tr.inputs["Geometry"])
        tr.inputs["Scale"].default_value = (sx, sy, 1.0)
        ff = self.N('GeometryNodeFlipFaces')
        self.L(tr.outputs["Geometry"], ff.inputs["Mesh"])
        return self.join(sock, ff.outputs["Mesh"])

    def mirror_xy(self, sock):
        """One quarter mirrored to four (across x = 0, then y = 0)."""
        return self.mirror(self.mirror(sock, -1, 1), 1, -1)

    def sdf(self, mesh, voxel, band):
        s = self.N('GeometryNodeMeshToSDFGrid')
        self.L(mesh, s.inputs["Mesh"])
        self._set(s.inputs["Voxel Size"], voxel)
        self._set(s.inputs["Band Width"], band)
        return s.outputs[0]

    def to_mesh(self, grid, threshold=0.0, adaptivity=0.0):
        """Surface of an SDF grid. A positive threshold grows the surface by that much, a
        negative one shrinks it. [verified]"""
        m = self.N('GeometryNodeGridToMesh')
        self.L(grid, m.inputs["Grid"])
        self._set(m.inputs["Threshold"], threshold)
        self._set(m.inputs["Adaptivity"], adaptivity)
        return m.outputs["Mesh"]

    def closing(self, mesh, voxel, radius):
        """Union of everything in `mesh` with radius-`radius` fillets in the inside corners:
        grow by radius, then shrink by radius. Outside edges stay sharp."""
        bw = self.N('FunctionNodeFloatToInt')
        bw.rounding_mode = 'CEILING'
        self.L(self.math('ADD', self.math('DIVIDE', radius, voxel), 3.0), bw.inputs[0])
        grown = self.to_mesh(self.sdf(mesh, voxel, bw.outputs[0]), radius)
        return self.to_mesh(self.sdf(grown, voxel, bw.outputs[0]), self.math('MULTIPLY', radius, -1.0))

    def difference(self, grid, *cutters):
        """SDF grid minus other SDF grids. The node takes the base on "Grid 1" and every
        cutter on its multi-input "Grid 2". [verified]"""
        d = self.N('GeometryNodeSDFGridBoolean')
        d.operation = 'DIFFERENCE'
        self.L(grid, d.inputs["Grid 1"])
        for g in cutters:
            self.L(g, d.inputs["Grid 2"])
        return d.outputs[0]

    def lift(self, sock, dz):
        """Move geometry up by dz (an Explode input for exploded views)."""
        cx = self.N('ShaderNodeCombineXYZ')
        self._set(cx.inputs["Z"], dz)
        tr = self.N('GeometryNodeTransform')
        self.L(sock, tr.inputs["Geometry"])
        self.L(cx.outputs["Vector"], tr.inputs["Translation"])
        return tr.outputs["Geometry"]

    def box_above(self, ref_geo, offset, size):
        """Closed box centred on x = y = 0 whose bottom face sits at the lowest z of
        `ref_geo` plus `offset`. `size` is a vector socket or an (x, y, z) tuple."""
        bb = self.N('GeometryNodeBoundBox')
        self.L(ref_geo, bb.inputs["Geometry"])
        sep = self.N('ShaderNodeSeparateXYZ')
        self.L(bb.outputs["Min"], sep.inputs["Vector"])
        cube = self.N('GeometryNodeMeshCube')
        self._set(cube.inputs["Size"], size)
        ssz = self.N('ShaderNodeSeparateXYZ')
        self._set(ssz.inputs["Vector"], size)
        zb = self.math('ADD', self.math('ADD', sep.outputs["Z"], offset), self.math('MULTIPLY', ssz.outputs["Z"], 0.5))
        cx = self.N('ShaderNodeCombineXYZ')
        self.L(zb, cx.inputs["Z"])
        tr = self.N('GeometryNodeTransform')
        self.L(cube.outputs["Mesh"], tr.inputs["Geometry"])
        self.L(cx.outputs["Vector"], tr.inputs["Translation"])
        return tr.outputs["Geometry"]

    def output(self, mesh):
        sm = self.N('GeometryNodeSetShadeSmooth')
        self.L(mesh, sm.inputs["Mesh"])
        self.L(sm.outputs["Mesh"], self.go.inputs["Geometry"])
        self.layout()

    def layout(self):
        for i, nd in enumerate(self.ng.nodes):
            nd.location = ((i % 10) * 220, -(i // 10) * 240)


# ---------------------------------------------------------------- recipes: the two-part build

def wire_head(name="Head Wire"):
    """The hand-built head as one solid: `Wire` is one quarter of the head wire (mirrored
    to four), `Peg` the peg under the crossing, `Gallery` a finished gallery object (a
    path with a bevel profile and its own Mirror modifier). Fillet Radius stands in for
    the solder where they meet. Explode lifts the solid for exploded views."""
    ng = group(name)
    socket(ng, "Wire", "object", description="Quarter path of the head wire; mirrored to the four corners")
    socket(ng, "Peg", "object", description="Peg path (optional)")
    socket(ng, "Gallery", "object", description="Gallery object (optional)")
    socket(ng, "Wire Diameter", "float", 1.1, 0.3, "Round wire for prongs and arms, mm")
    socket(ng, "Peg Diameter", "float", 1.1, 0.3, "Round wire for the peg, mm")
    socket(ng, "Voxel Size", "float", 0.03, 0.008, "Surface detail, mm (0.05 while editing)")
    socket(ng, "Fillet Radius", "float", 0.1, 0.0, "Solder fillet where wires and gallery meet, mm")
    socket(ng, "Explode", "float", 0.0, None, "Lift the head this far (mm) for an exploded view; keep 0")
    b = Builder(ng)
    wire = b.mirror_xy(b.tubes(b.obj("Wire"), b.math('MULTIPLY', b.gi.outputs["Wire Diameter"], 0.5)))
    peg = b.tubes(b.obj("Peg"), b.math('MULTIPLY', b.gi.outputs["Peg Diameter"], 0.5), ends=False)
    solid = b.closing(b.join(wire, peg, b.obj("Gallery")), b.gi.outputs["Voxel Size"], b.gi.outputs["Fillet Radius"])
    b.output(b.lift(solid, b.gi.outputs["Explode"]))
    return ng


def casting(name="Casting"):
    """The cast part, as cast: band + shoulders joined with a fillet; shoulder tops cut
    flat at the gallery's underside plus Filing Allowance (filing stock to fit the real
    head); seat grooves where the head wires will sit (the wire's tubes grown by Seat Gap);
    and a drill-start dimple under the centre of the crossing (the first point of the
    wire path). The trim box is centred on x = y = 0 of this object, so keep the casting
    object at the ring's origin with the head on its z axis."""
    ng = group(name)
    socket(ng, "Band", "object", description="The band")
    socket(ng, "Shoulders", "object", description="Shoulders (a path with a profile, mirrored)")
    socket(ng, "Gallery", "object", description="Gallery: the shoulder tops are cut at its underside + Filing Allowance")
    socket(ng, "Wire", "object", description="Head wire quarter path: cuts the seat grooves and places the dimple")
    socket(ng, "Voxel Size", "float", 0.03, 0.008, "Surface detail, mm (0.05 while editing)")
    socket(ng, "Fillet Radius", "float", 0.2, 0.0, "Blend where the shoulders leave the band, mm")
    socket(ng, "Filing Allowance", "float", 0.2, 0.0, "Extra height left on the shoulder tops to file to the head, mm")
    socket(ng, "Seat Gap", "float", 0.05, 0.0, "Clearance around the wires in the seat grooves, mm")
    socket(ng, "Wire Diameter", "float", 1.1, 0.3, "Must match the head's Wire Diameter, mm")
    socket(ng, "Dimple Diameter", "float", 0.7, 0.0, "Drill-start dimple for the peg hole: its width at the groove floor, mm")
    socket(ng, "Dimple Depth", "float", 0.35, 0.0, "Depth of the dimple below the groove floor, mm")
    socket(ng, "Trim Size", "vector", (12.0, 4.0, 3.0), None, "Size of the box that trims the shoulder tops, mm")
    socket(ng, "Adaptivity", "float", 0.0, 0.0, "Mesh simplification for export (0 = none; 0.1-0.3 shrinks the STL)")
    b = Builder(ng)
    vox = b.gi.outputs["Voxel Size"]
    body = b.closing(b.join(b.obj("Band"), b.obj("Shoulders")), vox, b.gi.outputs["Fillet Radius"])
    trim = b.sdf(b.box_above(b.obj("Gallery"), b.gi.outputs["Filing Allowance"], b.gi.outputs["Trim Size"]), vox, 4)
    wire = b.obj("Wire")
    half = b.math('ADD', b.math('MULTIPLY', b.gi.outputs["Wire Diameter"], 0.5), b.gi.outputs["Seat Gap"])
    grooves = b.sdf(b.mirror_xy(b.tubes(wire, half, ends=False)), vox, 4)
    # Dimple: a cone, apex down, under the first point of the wire path: its apex Dimple
    # Depth below the groove floor, its top 0.1 above it, and Dimple Diameter across where
    # it meets the floor (so its top radius is scaled up by (depth + 0.1) / depth).
    si = b.N('GeometryNodeSampleIndex')
    si.data_type, si.domain = 'FLOAT_VECTOR', 'POINT'
    b.L(wire, si.inputs["Geometry"])
    b.L(b.N('GeometryNodeInputPosition').outputs[0], si.inputs["Value"])
    si.inputs["Index"].default_value = 0
    sep = b.N('ShaderNodeSeparateXYZ')
    b.L(si.outputs["Value"], sep.inputs["Vector"])
    cone = b.N('GeometryNodeMeshCone')
    cone.inputs["Vertices"].default_value = 32
    depth = b.gi.outputs["Dimple Depth"]
    height = b.math('ADD', depth, 0.1)
    r_floor = b.math('MULTIPLY', b.gi.outputs["Dimple Diameter"], 0.5)
    b.L(b.math('DIVIDE', b.math('MULTIPLY', r_floor, height), depth), cone.inputs["Radius Top"])
    cone.inputs["Radius Bottom"].default_value = 0.0
    b.L(height, cone.inputs["Depth"])
    floor = b.math('SUBTRACT', sep.outputs["Z"], half)
    # Move the cone by where its apex actually is: in Blender 5.2.2 the Cone node's mesh runs
    # from z = 0 to z = Depth, not centred on its origin, and placing it as if it were centred
    # left the R1 dimple about 0.12 mm deep instead of 0.35. [verified]
    cbb = b.N('GeometryNodeBoundBox')
    b.L(cone.outputs["Mesh"], cbb.inputs["Geometry"])
    cmin = b.N('ShaderNodeSeparateXYZ')
    b.L(cbb.outputs["Min"], cmin.inputs["Vector"])
    cz = b.math('SUBTRACT', b.math('SUBTRACT', floor, b.gi.outputs["Dimple Depth"]), cmin.outputs["Z"])
    cxyz = b.N('ShaderNodeCombineXYZ')
    b.L(sep.outputs["X"], cxyz.inputs["X"])
    b.L(sep.outputs["Y"], cxyz.inputs["Y"])
    b.L(cz, cxyz.inputs["Z"])
    trc = b.N('GeometryNodeTransform')
    b.L(cone.outputs["Mesh"], trc.inputs["Geometry"])
    b.L(cxyz.outputs["Vector"], trc.inputs["Translation"])
    dimple = b.sdf(trc.outputs["Geometry"], vox, 4)
    cut = b.difference(b.sdf(body, vox, 4), trim, grooves, dimple)
    b.output(b.to_mesh(cut, 0.0, b.gi.outputs["Adaptivity"]))
    return ng


def fuse(name="Fuse"):
    """The finished piece: the casting with its filing allowance taken off (shoulder tops
    flush with the gallery's underside), joined to the head with fillets wherever they
    meet, as solder would."""
    ng = group(name)
    socket(ng, "Casting", "object", description="The casting (as cast)")
    socket(ng, "Head", "object", description="The head solid")
    socket(ng, "Gallery", "object", description="Gallery: shoulder tops are shown filed flush with its underside")
    socket(ng, "Voxel Size", "float", 0.03, 0.008, "Surface detail, mm (0.05 while editing)")
    socket(ng, "Fillet Radius", "float", 0.2, 0.0, "Blend wherever head and casting meet, mm")
    socket(ng, "Trim Size", "vector", (12.0, 4.0, 3.0), None, "Must match the casting's Trim Size, mm")
    b = Builder(ng)
    vox = b.gi.outputs["Voxel Size"]
    trim = b.sdf(b.box_above(b.obj("Gallery"), 0.0, b.gi.outputs["Trim Size"]), vox, 4)
    filed = b.to_mesh(b.difference(b.sdf(b.obj("Casting"), vox, 4), trim))
    b.output(b.closing(b.join(filed, b.obj("Head")), vox, b.gi.outputs["Fillet Radius"]))
    return ng


RECIPES = {"wire_head": wire_head, "casting": casting, "fuse": fuse}


# ---------------------------------------------------------------- modifier inputs by name

def _items(ng):
    return [it for it in ng.interface.items_tree
            if getattr(it, "item_type", "SOCKET") == 'SOCKET' and it.in_out == 'INPUT'
            and it.socket_type != 'NodeSocketGeometry']


def _slot(md, identifier):
    # Blender 5.2: modifier.properties.inputs.<identifier>.value; older: modifier["Socket_n"].
    props = getattr(md, "properties", None)
    inputs = getattr(props, "inputs", None) if props is not None else None
    return getattr(inputs, identifier, None) if inputs is not None else None


def read_inputs(md):
    """{input name: value} of a Geometry Nodes modifier (objects stay objects)."""
    out = {}
    for it in _items(md.node_group):
        slot = _slot(md, it.identifier)
        try:
            out[it.name] = slot.value if slot is not None else md[it.identifier]
        except (KeyError, TypeError, AttributeError):
            pass
    return out


def write_inputs(md, values):
    """Set inputs by name; an input missing from `values` gets the group's default. A
    group rebuilt in place leaves new inputs on existing modifiers at 0, not the default:
    a Voxel Size of 0 makes an empty mesh. [verified]"""
    for it in _items(md.node_group):
        v = values[it.name] if it.name in values else getattr(it, "default_value", None)
        if v is None:
            continue
        slot = _slot(md, it.identifier)
        try:
            if slot is not None:
                slot.value = v
            else:
                md[it.identifier] = v
        except (TypeError, AttributeError, ValueError):
            pass


def rebuild(groups):
    """Rebuild node groups in place from their recipes and give every modifier that uses
    them its settings back. groups: {group name: recipe}, e.g.
    {"R1 Head Wire": "wire_head", "R1 Casting": "casting", "R1 Fuse": "fuse"}."""
    users = [(ob, md) for ob in bpy.data.objects for md in ob.modifiers
             if md.type == 'NODES' and md.node_group is not None and md.node_group.name in groups]
    saved = [(ob, md, read_inputs(md)) for ob, md in users]
    for name, recipe in groups.items():
        RECIPES[recipe](name)
    for ob, md, vals in saved:
        write_inputs(md, vals)
        ob.update_tag(refresh={'OBJECT', 'DATA'})
    bpy.context.view_layer.update()
    return {"rebuilt": list(groups), "settings_restored_on": [f"{ob.name} / {md.name}" for ob, md, _ in saved]}


# ---------------------------------------------------------------- objects

def _collection(name):
    if name is None:
        return bpy.context.scene.collection
    c = bpy.data.collections.get(name)
    if c is None:
        c = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(c)
    return c


def bezier(name, points, parent=None, collection=None):
    """A 3D Bézier curve from [(co, handle_left, handle_right), ...] (free handles,
    point radius 1, no bevel: the node groups give it thickness). Replaces the splines of
    an existing curve called `name`, so objects that use it keep working."""
    ob = bpy.data.objects.get(name)
    if ob is None:
        cu = bpy.data.curves.new(name, 'CURVE')
        ob = bpy.data.objects.new(name, cu)
        _collection(collection).objects.link(ob)
    cu = ob.data
    cu.dimensions = '3D'
    cu.splines.clear()
    sp = cu.splines.new('BEZIER')
    sp.bezier_points.add(len(points) - 1)
    for bp, (co, hl, hr) in zip(sp.bezier_points, points):
        bp.handle_left_type = bp.handle_right_type = 'FREE'
        bp.co, bp.handle_left, bp.handle_right = co, hl, hr
        bp.radius = 1.0
    if parent is not None:
        ob.parent = bpy.data.objects[parent] if isinstance(parent, str) else parent
        ob.matrix_parent_inverse.identity()
    ob.update_tag()
    return ob


def profile(name, width, height, collection=None):
    """A closed 2D rectangle `width` (x) by `height` (y), centred, for use as a curve's
    Bevel > Object: a gallery bar's or a shoulder's cross-section."""
    ob = bpy.data.objects.get(name)
    if ob is None:
        ob = bpy.data.objects.new(name, bpy.data.curves.new(name, 'CURVE'))
        _collection(collection).objects.link(ob)
    cu = ob.data
    cu.dimensions = '2D'
    cu.splines.clear()
    sp = cu.splines.new('POLY')
    sp.points.add(3)
    w, h = width / 2, height / 2
    for p, (x, y) in zip(sp.points, ((w, h), (w, -h), (-w, -h), (-w, h))):
        p.co = (x, y, 0.0, 1.0)
    sp.use_cyclic_u = True
    ob.hide_render = True
    return ob


def solid(name, group_name, inputs=None, modifier="Solid", collection=None, preview=False):
    """A mesh object whose Geometry Nodes modifier (`group_name`) makes the solid; inputs
    are set by name (objects by name or object). Fabrication solids are hidden from
    renders and shown as boxes unless preview=True; the finished piece is what renders."""
    ob = bpy.data.objects.get(name)
    if ob is None:
        ob = bpy.data.objects.new(name, bpy.data.meshes.new(name))
        _collection(collection).objects.link(ob)
    md = ob.modifiers.get(modifier) or ob.modifiers.new(modifier, 'NODES')
    md.node_group = bpy.data.node_groups[group_name]
    vals = {k: (bpy.data.objects[v] if isinstance(v, str) else v) for k, v in (inputs or {}).items()}
    write_inputs(md, dict(read_inputs(md), **vals))
    if not preview:
        ob.display_type, ob.hide_render = 'BOUNDS', True
    ob.update_tag(refresh={'OBJECT', 'DATA'})
    bpy.context.view_layer.update()
    return ob


def archive(names, label, prefix=""):
    """Keep a version before a structural change: move the objects into an excluded
    collection "<prefix> Archive - <label>" and rename each "<name> (<label>)", so new
    objects can take the old names. Objects the live model still uses (profiles, the stone)
    must not be archived."""
    coll_name = (prefix + " " if prefix else "") + "Archive - " + label
    coll = bpy.data.collections.get(coll_name) or bpy.data.collections.new(coll_name)
    if coll.name not in bpy.context.scene.collection.children:
        bpy.context.scene.collection.children.link(coll)
    moved = []
    for n in names:
        ob = bpy.data.objects[n]
        for c in list(ob.users_collection):
            c.objects.unlink(ob)
        coll.objects.link(ob)
        ob.name = f"{n} ({label})"
        moved.append(ob.name)

    def find(lc):
        if lc.collection == coll:
            return lc
        for ch in lc.children:
            r = find(ch)
            if r:
                return r
    lc = find(bpy.context.view_layer.layer_collection)
    if lc is not None:
        lc.exclude = True
    bpy.context.view_layer.update()
    return {"collection": coll.name, "archived": moved}


bpy.app.driver_namespace["JPB"] = {
    k: v for k, v in globals().items() if callable(v) and not k.startswith("_")} | {
    "PATH_BUILD_VERSION": PATH_BUILD_VERSION, "RECIPES": RECIPES}
result = {"path_build_version": PATH_BUILD_VERSION, "registered": sorted(bpy.app.driver_namespace["JPB"])}
print(result)
