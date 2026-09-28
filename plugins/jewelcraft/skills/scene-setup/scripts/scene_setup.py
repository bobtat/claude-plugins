# jewelcraft plugin: studio scene for design-review renders.
# Run this whole file once per Blender session through the Blender MCP's
# execute_blender_code tool. It registers the functions in
#     bpy.app.driver_namespace["JCS"]
# and later calls use:  S = bpy.app.driver_namespace["JCS"]
#
# Everything is built in a separate scene ("JC Studio") that links the user's
# collections, so the modelling scene's cameras, world and render settings are never
# touched. The only change to the user's own objects is the preview materials, which are
# attached per object (slot link = OBJECT) so each mesh keeps its own materials, and
# which teardown() removes again.

import bpy
import json
import math
import os
import time
from mathutils import Matrix, Vector

# The skill compares the loaded copy against this line, so bump it with every change.
SCENE_HELPERS_VERSION = "0.2.2"

STUDIO = "JC Studio"
RIG = "JC Studio Rig"
WORLD = "JC Studio World"
STATE_KEY = "jc_studio"
MAT_NAMES = {
    "gold_18k_yellow": "JC Gold 18K Yellow (3N)",
    "diamond": "JC Diamond",
}

# ISO 8654 colour 3N ("yellow", the usual 18K yellow): CIE x 0.3601, y 0.3729,
# reflectance 0.79 under D65 (ProGold, "The colours of the gold alloys", Table 1),
# converted to linear sRGB. Used as the Principled BSDF base colour of a metal, which
# is its colour at normal incidence, so treat it as a close approximation.
GOLD_3N_LINEAR = (0.9758, 0.7661, 0.4793)
DIAMOND_IOR = 2.417  # physicallybased.info

GEOM_TYPES = {"MESH", "CURVE", "SURFACE", "META", "FONT", "CURVES", "POINTCLOUD", "VOLUME"}

VIEWS = {
    # name: (kind, azimuth deg, elevation deg, framing)
    # azimuth 0 = looking from the ring's side (finger runs left to right),
    # 90 = looking along the finger (end view). Elevation 90 = from above.
    "JC Top":     ("ORTHO", 0, 90, "all"),
    "JC Side":    ("ORTHO", 0, 0, "all"),
    "JC End":     ("ORTHO", 90, 0, "all"),
    "JC Hero":    ("PERSP", 35, 25, "all"),
    "JC Head":    ("PERSP", 30, 15, "head"),
    "JC Gallery": ("PERSP", 60, 3, "head"),
}
DEFAULT_ORDER = list(VIEWS)


# ---------------------------------------------------------------- small utilities

def _scene(name):
    sc = bpy.data.scenes.get(name)
    if sc is None:
        raise KeyError(f"No scene named {name!r}")
    return sc


def _state(studio):
    try:
        return json.loads(studio.get(STATE_KEY, "{}"))
    except Exception:
        return {}


def _save_state(studio, st):
    studio[STATE_KEY] = json.dumps(st)


def _source_view_layer(src):
    ctx_sc = bpy.context.scene
    if ctx_sc == src and bpy.context.view_layer:
        return bpy.context.view_layer
    return src.view_layers[0]


def _is_gem(ob):
    return "gem" in ob.keys()


def _renderable(ob):
    return ob.type in GEOM_TYPES and ob.display_type not in {"WIRE", "BOUNDS"}


def _visible_geometry(src):
    vl = _source_view_layer(src)
    return [o for o in src.objects
            if _renderable(o) and o.visible_get(view_layer=vl) and not o.hide_render]


def _bbox(obs):
    dg = bpy.context.evaluated_depsgraph_get()
    pts = []
    for o in obs:
        oe = o.evaluated_get(dg)
        pts += [oe.matrix_world @ Vector(c) for c in oe.bound_box]
    if not pts:
        raise ValueError("Nothing visible to frame.")
    lo = Vector([min(p[i] for p in pts) for i in range(3)])
    hi = Vector([max(p[i] for p in pts) for i in range(3)])
    return lo, hi, pts


def _look_matrix(loc, forward, up):
    """Camera matrix at `loc` looking along `forward`, with `up` roughly up in frame."""
    z = (-forward).normalized()
    x = up.cross(z)
    if x.length < 1e-6:
        x = Vector((1, 0, 0)).cross(z) if abs(z.x) < 0.9 else Vector((0, 1, 0)).cross(z)
    x.normalize()
    y = z.cross(x)
    m = Matrix((x, y, z)).transposed().to_4x4()
    m.translation = loc
    return m


# ---------------------------------------------------------------- scene and sync

def _ensure_studio(src):
    studio = bpy.data.scenes.get(STUDIO)
    if studio is None:
        studio = bpy.data.scenes.new(STUDIO)
    u, su = studio.unit_settings, src.unit_settings
    u.system, u.length_unit, u.scale_length = su.system, su.length_unit, su.scale_length
    rig = bpy.data.collections.get(RIG) or bpy.data.collections.new(RIG)
    if rig.name not in studio.collection.children:
        studio.collection.children.link(rig)
    return studio, rig


def _mirror_layers(src_lc, dst_lc):
    for c in src_lc.children:
        d = dst_lc.children.get(c.name)
        if d is None:
            continue
        d.exclude = c.exclude or c.hide_viewport
        if not d.exclude:
            _mirror_layers(c, d)


def _sync(src, studio):
    """Link the source scene's collections and loose objects into the studio scene and
    copy which collections are excluded or hidden, so the studio renders what the user
    sees in their own scene."""
    root = studio.collection
    want_c = {c.name for c in src.collection.children}
    for c in src.collection.children:
        if c.name not in root.children:
            root.children.link(c)
    for c in list(root.children):
        if c.name != RIG and c.name not in want_c:
            root.children.unlink(c)
    want_o = {o.name for o in src.collection.objects}
    for o in src.collection.objects:
        if o.name not in root.objects:
            root.objects.link(o)
    for o in list(root.objects):
        if o.name not in want_o:
            root.objects.unlink(o)
    _mirror_layers(_source_view_layer(src).layer_collection, studio.view_layers[0].layer_collection)


# ---------------------------------------------------------------- materials

def _principled(mat):
    mat.use_nodes = True
    nt = mat.node_tree
    p = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if p is None:
        nt.nodes.clear()
        p = nt.nodes.new("ShaderNodeBsdfPrincipled")
        out = nt.nodes.new("ShaderNodeOutputMaterial")
        nt.links.new(p.outputs[0], out.inputs["Surface"])
    return p


def _set(p, name, value):
    if name in p.inputs:
        p.inputs[name].default_value = value


def make_materials(metal_roughness=0.12):
    """Create or refresh the preview materials. Returns their names."""
    gold = bpy.data.materials.get(MAT_NAMES["gold_18k_yellow"]) or \
        bpy.data.materials.new(MAT_NAMES["gold_18k_yellow"])
    p = _principled(gold)
    _set(p, "Base Color", (*GOLD_3N_LINEAR, 1.0))
    _set(p, "Metallic", 1.0)
    _set(p, "Roughness", metal_roughness)
    gold.diffuse_color = (*GOLD_3N_LINEAR, 1.0)
    gold.metallic, gold.roughness = 1.0, metal_roughness

    dia = bpy.data.materials.get(MAT_NAMES["diamond"]) or bpy.data.materials.new(MAT_NAMES["diamond"])
    p = _principled(dia)
    _set(p, "Base Color", (1.0, 1.0, 1.0, 1.0))
    _set(p, "Metallic", 0.0)
    _set(p, "Roughness", 0.0)
    _set(p, "IOR", DIAMOND_IOR)
    _set(p, "Transmission Weight", 1.0)
    dia.diffuse_color = (0.85, 0.9, 1.0, 1.0)
    # EEVEE needs these to show refraction; Cycles ignores them.
    for attr, val in (("use_raytrace_refraction", True), ("surface_render_method", "DITHERED")):
        if hasattr(dia, attr):
            try:
                setattr(dia, attr, val)
            except Exception:
                pass
    return {"metal": gold.name, "gem": dia.name,
            "dispersion": "Dispersion" in p.inputs}


def _override(ob, mat, st):
    """Show `mat` on every slot of `ob` without touching the mesh's own materials."""
    rec = st.setdefault("overrides", {})
    if ob.name in rec:
        entry = rec[ob.name]
    else:
        entry = {"added_slot": False, "slots": []}
        if len(ob.material_slots) == 0:
            if not hasattr(ob.data, "materials"):
                return False
            ob.data.materials.append(None)
            entry["added_slot"] = True
        entry["slots"] = [s.link for s in ob.material_slots]
        rec[ob.name] = entry
    for s in ob.material_slots:
        s.link = "OBJECT"
        s.material = mat
    return True


def assign(src, metal="auto", gems="auto", st=None):
    """Put the preview materials on the metal and gem objects. `metal`/`gems` are lists
    of names, "auto" (visible gems = JewelCraft gems, metal = every other visible
    geometry), or None to skip."""
    names = make_materials()
    gold, dia = bpy.data.materials[names["metal"]], bpy.data.materials[names["gem"]]
    vis = _visible_geometry(src)
    if gems == "auto":
        gems = [o for o in vis if _is_gem(o)]
    else:
        gems = [bpy.data.objects[n] for n in (gems or [])]
    if metal == "auto":
        metal = [o for o in vis if not _is_gem(o)]
    else:
        metal = [bpy.data.objects[n] for n in (metal or [])]
    done = {"metal": [], "gems": [], "skipped": []}
    for ob in metal:
        (done["metal"] if _override(ob, gold, st) else done["skipped"]).append(ob.name)
    for ob in gems:
        (done["gems"] if _override(ob, dia, st) else done["skipped"]).append(ob.name)
    return done


def _restore_materials(st):
    out = []
    for name, entry in st.get("overrides", {}).items():
        ob = bpy.data.objects.get(name)
        if ob is None:
            continue
        for s, link in zip(ob.material_slots, entry["slots"]):
            s.material = None  # clears the object-level material
            s.link = link
        if entry.get("added_slot") and len(ob.data.materials) and ob.data.materials[-1] is None:
            ob.data.materials.pop()
            # Popping the mesh's slot leaves the object's own slot count stale;
            # reassigning the data makes Blender re-sync it.
            ob.data = ob.data
        out.append(name)
    st["overrides"] = {}
    return out


# ---------------------------------------------------------------- world and lights

def _world(hdri="studio.exr", strength=2.5, rotation_deg=0.0, backdrop=0.8, neutral=True):
    """HDRI for lighting and reflections; a plain grey backdrop for what the camera sees
    directly. Uses one of Blender's bundled studio-light HDRIs, so nothing is downloaded.
    With `neutral`, the HDRI's colour is removed (its brightness pattern is kept): the
    bundled studio.exr is blue-tinted (mean B/R about 1.33), which cancels gold's yellow."""
    folder = bpy.utils.system_resource("DATAFILES", path="studiolights/world")
    path = os.path.join(folder, hdri)
    if not os.path.isfile(path):
        raise FileNotFoundError(f"{hdri} not in {folder}: {sorted(os.listdir(folder))}")
    w = bpy.data.worlds.get(WORLD) or bpy.data.worlds.new(WORLD)
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    N = nt.nodes.new
    coord, mapping = N("ShaderNodeTexCoord"), N("ShaderNodeMapping")
    env = N("ShaderNodeTexEnvironment")
    env.image = bpy.data.images.load(path, check_existing=True)
    light_bg, back_bg = N("ShaderNodeBackground"), N("ShaderNodeBackground")
    path_n, mix = N("ShaderNodeLightPath"), N("ShaderNodeMixShader")
    out = N("ShaderNodeOutputWorld")
    L = nt.links.new
    L(coord.outputs["Generated"], mapping.inputs["Vector"])
    L(mapping.outputs["Vector"], env.inputs["Vector"])
    if neutral:
        desat = N("ShaderNodeHueSaturation")
        desat.inputs["Saturation"].default_value = 0.0
        L(env.outputs["Color"], desat.inputs["Color"])
        L(desat.outputs["Color"], light_bg.inputs["Color"])
    else:
        L(env.outputs["Color"], light_bg.inputs["Color"])
    L(path_n.outputs["Is Camera Ray"], mix.inputs["Fac"])
    L(light_bg.outputs[0], mix.inputs[1])
    L(back_bg.outputs[0], mix.inputs[2])
    L(mix.outputs[0], out.inputs["Surface"])
    mapping.inputs["Rotation"].default_value[2] = math.radians(rotation_deg)
    light_bg.inputs["Strength"].default_value = strength
    back_bg.inputs["Color"].default_value = (backdrop, backdrop, backdrop, 1.0)
    back_bg.inputs["Strength"].default_value = 1.0
    return w


def _light(rig, name, loc, target, size, power):
    ob = bpy.data.objects.get(name)
    if ob is None or ob.type != "LIGHT":
        ob = bpy.data.objects.new(name, bpy.data.lights.new(name, "AREA"))
        rig.objects.link(ob)
    L = ob.data
    L.shape, L.size, L.energy = "DISK", size, power
    ob.matrix_world = _look_matrix(loc, target - loc, Vector((0, 0, 1)))
    return ob


# ---------------------------------------------------------------- framing

def _axes(band=None):
    """Up is +Z. The finger axis comes from the band's fitted inner circle when a band
    is given and the jewelcraft helpers are loaded; otherwise JewelCraft's convention,
    Y (size curves wrap around Y)."""
    up = Vector((0, 0, 1))
    finger = Vector((0, 1, 0))
    source = "default: Y (JewelCraft convention)"
    if band:
        H = bpy.app.driver_namespace.get("JC")
        if H and "ring_size" in H:
            n = Vector([float(x) for x in H["ring_size"](bpy.data.objects[band])["axis"]])
            n = n - up * n.dot(up)
            if n.length > 1e-6:
                finger, source = n.normalized(), f"fitted from {band}"
    side = up.cross(finger).normalized()
    return up, finger, side, source


def _place(src, rig, st, lens=100.0, margin=1.15):
    up, finger, side, axis_source = _axes(st.get("band"))
    vis = _visible_geometry(src)
    lo, hi, pts = _bbox(vis)
    centre = (lo + hi) / 2
    radius = max((p - centre).length for p in pts)
    gems = [o for o in vis if _is_gem(o)]
    if gems:
        glo, ghi, gpts = _bbox(gems)
        head_c = (glo + ghi) / 2
        head_pts = [head_c + (p - head_c) * 1.5 for p in gpts]  # stone plus prongs/gallery
    else:
        head_c, head_pts = centre, pts
    fov = 2 * math.atan(18.0 / lens)  # 36 mm sensor width
    made = {}
    for name, (kind, az, el, framing) in VIEWS.items():
        c, fp = (centre, pts) if framing == "all" else (head_c, head_pts)
        a, e = math.radians(az), math.radians(el)
        d = (side * math.cos(a) + finger * math.sin(a)) * math.cos(e) + up * math.sin(e)
        frame_up = side if el >= 89 else up
        ob = bpy.data.objects.get(name)
        if ob is None or ob.type != "CAMERA":
            ob = bpy.data.objects.new(name, bpy.data.cameras.new(name))
            rig.objects.link(ob)
        cam = ob.data
        cam.sensor_fit, cam.sensor_width = "HORIZONTAL", 36.0
        if kind == "ORTHO":
            dist = radius * 4
            ob.matrix_world = _look_matrix(c + d * dist, -d, frame_up)
            inv = ob.matrix_world.inverted()
            local = [inv @ p for p in pts]
            ext = max(max(abs(q.x - (inv @ c).x) for q in local),
                      max(abs(q.y - (inv @ c).y) for q in local))
            cam.type, cam.ortho_scale = "ORTHO", 2 * ext * margin
        else:
            # Closest distance at which every point fits inside the square frame.
            m = _look_matrix(c + d, -d, frame_up)
            cx, cy = m.col[0].xyz, m.col[1].xyz
            t = math.tan(fov / 2) / margin
            dist = max((p - c).dot(d) + max(abs((p - c).dot(cx)), abs((p - c).dot(cy))) / t
                       for p in fp)
            ob.matrix_world = _look_matrix(c + d * dist, -d, frame_up)
            cam.type, cam.lens = "PERSP", lens
        cam.clip_start, cam.clip_end = dist * 0.01, dist * 10
        made[name] = {"type": kind, "distance_mm": round(dist, 2),
                      "ortho_scale_mm": round(cam.ortho_scale, 3) if kind == "ORTHO" else None}
    # Three large soft lights, scaled to the piece. Power grows with distance squared so
    # exposure doesn't depend on the piece's size.
    R = max(radius, 1.0)
    dist, size = 8 * R, 5 * R
    k = st.get("light_k", 30.0)
    for name, az, el, rel in (("JC Key", -40, 45, 1.0), ("JC Fill", 140, 25, 0.35),
                              ("JC Top Light", 0, 88, 0.6)):
        a, e = math.radians(az), math.radians(el)
        d = (side * math.cos(a) + finger * math.sin(a)) * math.cos(e) + up * math.sin(e)
        _light(rig, name, centre + d * dist, centre, size, k * rel * dist * dist)
    return {"cameras": made, "finger_axis": tuple(round(x, 4) for x in finger),
            "finger_axis_source": axis_source, "centre": tuple(round(x, 3) for x in centre),
            "radius_mm": round(radius, 3), "framed_objects": [o.name for o in vis]}


# ---------------------------------------------------------------- render settings

def _gpu_available():
    ad = bpy.context.preferences.addons.get("cycles")
    if not ad:
        return False, None
    cp = ad.preferences
    try:
        cp.refresh_devices()
    except Exception:
        pass
    gpus = [d.name for d in cp.devices if d.use and d.type != "CPU"]
    return (cp.compute_device_type != "NONE" and bool(gpus)), cp.compute_device_type


def _render_settings(studio, size=1200, samples=64, view_transform="Standard"):
    r = studio.render
    r.engine = "CYCLES"
    r.resolution_x = r.resolution_y = size
    r.resolution_percentage = 100
    r.film_transparent = False
    r.image_settings.file_format = "PNG"
    r.image_settings.color_mode = "RGB"
    c = studio.cycles
    gpu, backend = _gpu_available()
    c.device = "GPU" if gpu else "CPU"
    c.samples = samples
    c.use_adaptive_sampling = True
    c.use_denoising = True
    # Diamonds need many transmission and glossy bounces or they render dark.
    c.max_bounces, c.glossy_bounces, c.transmission_bounces = 32, 16, 32
    c.transparent_max_bounces, c.diffuse_bounces = 16, 4
    try:
        studio.view_settings.view_transform = view_transform
        studio.view_settings.look = "None"
    except TypeError:
        pass
    return {"engine": "CYCLES", "device": c.device, "backend": backend,
            "resolution": size, "samples": samples,
            "view_transform": studio.view_settings.view_transform}


# ---------------------------------------------------------------- public API

def setup(source=None, band=None, metal="auto", gems="auto", hdri="studio.exr",
          hdri_strength=2.5, hdri_rotation_deg=0.0, backdrop=0.8, size=1200, samples=64,
          light_k=30.0, view_transform="Standard"):
    """Build (or rebuild) the studio scene. Safe to run again: it updates in place."""
    src = _scene(source) if source else bpy.context.scene
    if src.name == STUDIO:
        raise ValueError("Pass the modelling scene as `source`, not the studio scene.")
    studio, rig = _ensure_studio(src)
    st = _state(studio)
    st.update({"source": src.name, "band": band, "light_k": light_k, "hdri": hdri,
               "hdri_strength": hdri_strength, "hdri_rotation_deg": hdri_rotation_deg,
               "backdrop": backdrop})
    _sync(src, studio)
    assigned = assign(src, metal, gems, st)
    studio.world = _world(hdri, hdri_strength, hdri_rotation_deg, backdrop)
    placed = _place(src, rig, st)
    settings = _render_settings(studio, size, samples, view_transform)
    studio.camera = bpy.data.objects["JC Hero"]
    _save_state(studio, st)
    notes = ["Materials are attached per object; the meshes' own materials are untouched "
             "and teardown() restores them."]
    if not make_materials()["dispersion"]:
        notes.append("This Blender has no dispersion, so diamonds show no rainbow fire.")
    if st.get("band") is None:
        notes.append("Finger axis assumed to be Y; pass band=<name> to fit it.")
    return {"scene": studio.name, "source": src.name, "materials": assigned,
            "render": settings, **placed, "notes": notes,
            "scene_helpers_version": SCENE_HELPERS_VERSION}


def status():
    """Whether a studio exists, and for which scene. Changes nothing."""
    studio = bpy.data.scenes.get(STUDIO)
    if studio is None:
        return {"exists": False}
    st = _state(studio)
    return {"exists": True, "source": st.get("source"),
            "cameras": [o.name for o in bpy.data.collections[RIG].objects if o.type == "CAMERA"]
            if RIG in bpy.data.collections else [],
            "material_overrides": sorted(st.get("overrides", {}))}


def render_views(views=None, samples=None, size=None, out_dir=None, reframe=True,
                 contact_sheet=True):
    """Render cameras of the studio to PNGs. Re-syncs with the source scene first and,
    with reframe, re-aims the cameras at the current model. Returns file paths."""
    studio = _scene(STUDIO)
    st = _state(studio)
    src = _scene(st["source"])
    rig = bpy.data.collections[RIG]
    _sync(src, studio)
    assign(src, "auto", "auto", st)  # picks up parts added since setup
    if reframe:
        _place(src, rig, st)
    if samples:
        studio.cycles.samples = samples
    if size:
        studio.render.resolution_x = studio.render.resolution_y = size
    if out_dir is None:
        if not bpy.data.filepath:
            raise RuntimeError("Save the .blend first; renders go in a folder next to it.")
        out_dir = os.path.join(bpy.path.abspath("//"), "renders", time.strftime("%Y%m%d-%H%M%S"))
    os.makedirs(out_dir, exist_ok=True)
    # Objects the user has hidden in their viewport, and wire/bounds-display objects
    # (Boolean cutters), would still render in Cycles; hide them for the render only.
    vl = _source_view_layer(src)
    hidden = [o for o in studio.view_layers[0].objects  # excluded collections aren't in it
              if o.type in GEOM_TYPES and not o.hide_render
              and RIG not in [c.name for c in o.users_collection]
              and (not o.visible_get(view_layer=vl) or not _renderable(o))]
    for o in hidden:
        o.hide_render = True
    files, times = [], {}
    prev_cam = studio.camera
    try:
        for name in (views or DEFAULT_ORDER):
            studio.camera = bpy.data.objects[name]
            path = os.path.join(out_dir, name.replace(" ", "_") + ".png")
            studio.render.filepath = path
            t = time.time()
            bpy.ops.render.render(write_still=True, scene=studio.name)
            times[name] = round(time.time() - t, 1)
            files.append(path)
    finally:
        for o in hidden:
            o.hide_render = False
        studio.camera = prev_cam
        _save_state(studio, st)
    out = {"dir": out_dir, "files": files, "seconds": times,
           "hidden_for_render": [o.name for o in hidden], "device": studio.cycles.device}
    if contact_sheet and len(files) > 1:
        out["contact_sheet"] = make_contact_sheet(files, os.path.join(out_dir, "contact_sheet.png"))
    return out


def make_contact_sheet(files, path, cols=3, cell=600):
    """Tile renders into one image (row by row, in the order given)."""
    import numpy as np
    rows = math.ceil(len(files) / cols)
    sheet = np.ones((rows * cell, cols * cell, 4), dtype=np.float32)
    for i, f in enumerate(files):
        img = bpy.data.images.load(f, check_existing=False)
        img.scale(cell, cell)
        px = np.empty(cell * cell * 4, dtype=np.float32)
        img.pixels.foreach_get(px)
        bpy.data.images.remove(img)
        r, c = divmod(i, cols)
        y0 = (rows - 1 - r) * cell  # image rows start at the bottom
        sheet[y0:y0 + cell, c * cell:(c + 1) * cell] = px.reshape(cell, cell, 4)
    out = bpy.data.images.new("JC_contact_sheet", cols * cell, rows * cell, alpha=False)
    out.pixels.foreach_set(sheet.ravel())
    out.filepath_raw, out.file_format = path, "PNG"
    out.save()
    bpy.data.images.remove(out)
    return {"path": path, "order": [os.path.basename(f) for f in files], "cols": cols}


def show_image(path):
    """Show `path` in the main window's largest 3D Viewport, switched temporarily to an
    Image Editor, so the MCP's area screenshot (IMAGE_EDITOR) can capture it. Always
    call close_image() afterwards to switch the area back."""
    had = {i.name for i in bpy.data.images}
    img = bpy.data.images.load(path, check_existing=True)
    img.reload()
    if img.name not in had:
        bpy.app.driver_namespace.setdefault("JCS_loaded", set()).add(img.name)
    w = bpy.context.window_manager.windows[0]
    prev = bpy.app.driver_namespace.get("JCS_area")
    if prev is None:
        views = [a for a in w.screen.areas if a.type == "VIEW_3D"]
        if not views:
            raise RuntimeError("No 3D Viewport in the main window to borrow.")
        area = max(views, key=lambda a: a.width * a.height)
        bpy.app.driver_namespace["JCS_area"] = (w.screen.areas[:].index(area), area.ui_type)
        area.ui_type = "IMAGE_EDITOR"
    else:
        area = w.screen.areas[prev[0]]
    area.spaces.active.image = img
    region = next(r for r in area.regions if r.type == "WINDOW")
    with bpy.context.temp_override(window=w, area=area, region=region):
        bpy.ops.image.view_all(fit_view=True)
    area.tag_redraw()
    return {"image": img.name, "size": tuple(img.size)}


def close_image():
    """Switch the borrowed area back to the 3D Viewport (its view is preserved)."""
    prev = bpy.app.driver_namespace.pop("JCS_area", None)
    if prev is None:
        return {"restored": False}
    w = bpy.context.window_manager.windows[0]
    area = w.screen.areas[prev[0]]
    if area.type == "IMAGE_EDITOR":
        area.spaces.active.image = None
    area.ui_type = prev[1]
    area.tag_redraw()
    # Unload the images show_image() loaded; the PNGs stay on disk.
    for n in bpy.app.driver_namespace.pop("JCS_loaded", set()):
        img = bpy.data.images.get(n)
        if img is not None:
            bpy.data.images.remove(img)
    return {"restored": True, "area": area.ui_type}


def teardown(keep_materials=False):
    """Remove the studio scene, its cameras, lights and world, and restore the objects'
    own materials. The user's modelling scene is left as it was."""
    close_image()
    studio = bpy.data.scenes.get(STUDIO)
    restored = []
    if studio is not None:
        st = _state(studio)
        restored = _restore_materials(st)
        _save_state(studio, st)
    rig = bpy.data.collections.get(RIG)
    if rig is not None:
        for o in list(rig.objects):
            data = o.data
            bpy.data.objects.remove(o, do_unlink=True)
            if data is not None and data.users == 0:
                (bpy.data.cameras if isinstance(data, bpy.types.Camera) else bpy.data.lights).remove(data)
        bpy.data.collections.remove(rig)
    if studio is not None:
        bpy.data.scenes.remove(studio)
    w = bpy.data.worlds.get(WORLD)
    if w is not None and w.users == 0:
        env = [n.image for n in w.node_tree.nodes if n.type == "TEX_ENVIRONMENT" and n.image]
        bpy.data.worlds.remove(w)
        for img in env:
            if img.users == 0:
                bpy.data.images.remove(img)
    if not keep_materials:
        for n in MAT_NAMES.values():
            m = bpy.data.materials.get(n)
            if m is not None and m.users == 0:
                bpy.data.materials.remove(m)
    return {"removed": STUDIO, "materials_restored_on": restored}


bpy.app.driver_namespace["JCS"] = {
    k: v for k, v in globals().items()
    if callable(v) and not k.startswith("__")} | {
    "SCENE_HELPERS_VERSION": SCENE_HELPERS_VERSION, "VIEWS": VIEWS,
    "GOLD_3N_LINEAR": GOLD_3N_LINEAR}
result = {"scene_helpers_version": SCENE_HELPERS_VERSION}
