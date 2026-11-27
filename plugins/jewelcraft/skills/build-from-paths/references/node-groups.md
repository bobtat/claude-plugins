# Node groups: the Builder, the recipes, and Blender 5.2 behaviour

`scripts/path_build.py` builds every solid as one Geometry Nodes group. Tags as in the core
skill: **[verified]** measured in Blender 5.2.2, **[docs]** from the Blender manual.

## How a solid is made

1. Each part becomes a mesh: a tube along a path (`tubes`), a path with a Bevel > Object
   profile (read as it is), or any mesh object (`obj`).
2. The meshes are joined and turned into one signed-distance (SDF) voxel grid (Mesh to SDF Grid)
   and back into a mesh (Grid to Mesh). Overlapping parts become one closed solid. The SDF is
   negative inside the mesh and positive outside [docs].
3. A fillet is a **closing**: grow the surface by r (Grid to Mesh with Threshold +r), then shrink
   it by r (another SDF, Threshold −r). Inside corners keep up to r of extra metal; convex
   shapes come back unchanged (a capsule changed by under 0.3%) [verified].
4. Cuts (seat grooves, a drill dimple, a trim box) are SDF grids subtracted with SDF Grid
   Boolean (Difference) before the last Grid to Mesh.

Voxel Size sets the detail: R1 was checked and exported at 0.03 mm and edited at 0.05. A
tube's cross-section is a 32-sided polygon, 0.6% less area than a circle, and four 1 mm
capsules came out 1.3% under their round volume at 0.04 mm voxels [verified].

## Builder (`B["Builder"](node_group)`)

| Method | Makes |
|---|---|
| `obj("Input")` | Object Info for an object input, **Relative** space: the object as seen from the modifier's object, so parenting and moving the head work |
| `tubes(curve, half_width, ends=True)` | A round tube along every path, radius = point radius × half_width; `ends` adds a ball at each end (a wire end, a prong tip) |
| `mirror(sock, sx, sy)`, `mirror_xy(sock)` | Mirrored copies, faces flipped back outward; `mirror_xy` turns one quarter into four |
| `sdf(mesh, voxel, band)`, `to_mesh(grid, threshold, adaptivity)` | Mesh to SDF Grid; Grid to Mesh |
| `closing(mesh, voxel, r)` | Union with r fillets in inside corners |
| `difference(grid, *cutters)` | SDF Grid Boolean, Difference |
| `box_above(ref, offset, size)` | A box centred on x = y = 0 whose bottom is at ref's lowest z + offset (trims shoulder tops) |
| `lift(sock, dz)` | Moves geometry up (exploded views) |
| `math(op, a, b)`, `join(...)`, `output(mesh)` | Math node, Join Geometry, smooth shading to the group output |

`B["group"](name)` makes or clears a group; `B["socket"](ng, name, kind, default, min, description)`
adds an input (float, int, bool, object, vector). Write a new recipe as a function that does
both and returns the group, then add it to `B["RECIPES"]` so `rebuild` can find it.

## The recipes

**`wire_head(name)`**: the hand-built head as one solid. Inputs: Wire (one quarter of the head
wire, mirrored to four), Peg, Gallery (a path with a profile and its own Mirror), Wire
Diameter, Peg Diameter, Voxel Size, Fillet Radius (solder at the joints, 0.1), Explode (lifts
the head for exploded views; keep 0).

**`casting(name)`**: the cast part as cast. Band and Shoulders joined with Fillet Radius (0.2);
the shoulder tops cut flat at the gallery's underside + Filing Allowance (0.2) by a box of Trim
Size (12 × 4 × 3, centred on the head's axis: keep the casting object at the ring's origin);
seat grooves where the head wires sit (the wire's tubes grown by Seat Gap, 0.05); a drill-start
dimple under the first point of the wire path, the centre of the crossing: a cone Dimple
Diameter (0.7) across at the groove floor, its point Dimple Depth (0.35) below it; Adaptivity
for smaller STLs.

**`fuse(name)`**: the finished piece. The casting with its filing allowance taken off (shoulder
tops flush with the gallery's underside), joined to the head with Fillet Radius (0.2) wherever
they meet. Use it for renders, size and weight; send the casting and the head to the bench.

## Inputs by name

- `H["node_inputs"](ob, modifier)` reads them, `H["set_node_inputs"](ob, modifier, {name: value})`
  sets them (objects by name) and returns the old values.
- In Blender 5.2.2 the values live in `modifier.properties.inputs.<identifier>.value`; the
  modifier no longer takes ID properties, so `modifier["Socket_2"]` raises TypeError [verified].
  The helpers handle both.
- Rebuilding a group in place leaves inputs that are new to it at 0 on existing modifiers, not
  at their default. A Voxel Size of 0 gives an empty mesh, which is how R1's finished ring once
  evaluated to nothing [verified]. `B["rebuild"]` restores every value by name and gives new
  inputs their defaults.

## Blender 5.2 behaviour measured here [verified]

- **Grid to Mesh Threshold:** a positive threshold grows the surface by that much on an SDF
  (a 10 mm cube at +0.5 mm: 1323.7 mm³, against 1324.1 for the exact offset), a negative one
  shrinks it. The manual's general rule ("voxels with values larger than this threshold are
  considered inside") is about density grids [docs].
- **SDF Grid Offset** grows with a positive Distance too (the same cube: 1323.0 mm³). The
  recipes use the threshold instead, which needs no extra node.
- **SDF Grid Fillet** has only an Iterations input, no radius, and left a convex cube unchanged.
  The recipes use the closing, whose radius is explicit.
- **SDF Grid Boolean, Difference:** the base grid goes on "Grid 1", every cutter on the
  multi-input "Grid 2".
- **The Cone mesh node** runs from z = 0 to z = Depth; it is not centred on its origin. R1's
  drill dimple was placed as if it were, and came out about 0.12 mm deep instead of 0.35.
  The casting recipe now places the cone by its actual bounding box, and sizes it by its
  width at the groove floor.
- **A new scene's view layer** has no layer collection until it is updated
  (`view_layer.update()`).
- **The Boolean modifier's Manifold solver** gave the same volume as Exact on two 47,000-face
  SDF spheres (48.6486 mm³) in 0.19 s against 5.08 s. The helpers use it when every mesh is
  closed and its pieces can't overlap, and check its result (`references/helpers.md` in the
  core skill).

## Working through the Blender MCP

- About **60 s per call**. Split heavy work: checks on a ring at 0.03 mm voxels take seconds to
  tens of seconds each; run them in separate calls.
- **Change one thing per call** when trying values (voxel size, fillet): a rapid series of
  voxel changes crashed Blender once during R1.
- Results too large for one tool response are saved to a file by the tool; read the fields you
  need from that file (for example with `jq`).
- **Long jobs** (the test suite, a full check) can run in a separate background Blender started
  from the open one with `subprocess` and `bpy.app.binary_path -b`, writing results to a file
  to poll. The Blender MCP's own background tool needs `BLENDER_PATH` set; on the test machine
  it couldn't find Blender without it.
