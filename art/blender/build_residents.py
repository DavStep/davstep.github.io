"""Build a resident from six simple, visibly joined round forms.

Run in the live Blender session through scripts/blender-mcp-run.py. Blender uses
Z up and faces -Y; the JSON below converts it to Three.js Y up and +Z front.
"""
import json
import math
from pathlib import Path

import bpy
from mathutils import Euler, Vector


ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "src/town/generated/residents.json"
GLB = ROOT / "art/blender/CHR_Resident_A_LOD0.glb"
BLEND = ROOT / "art/blender/residents.blend"

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
bpy.data.orphans_purge(do_recursive=True)


def material(name, color):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    shader = next(node for node in mat.node_tree.nodes if node.type == "BSDF_PRINCIPLED")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Roughness"].default_value = 0.88
    return mat


cream = material("MAT_Resident_Cream", (0.90, 0.83, 0.58))
pieces = []


def head():
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=10, location=(0, 0, 1.99))
    obj = bpy.context.object
    obj.name = "head"
    obj.scale = (0.44, 0.44, 0.44)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(cream)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    pieces.append(obj)


def capsule(name, start, end, radius, sides=12, cap_steps=3):
    """A closed straight capsule: a cylinder with hemispherical ends."""
    start, end = Vector(start), Vector(end)
    direction = end - start
    rotation = direction.to_track_quat("Z", "Y")
    length = direction.length
    vertices = [tuple(start + rotation @ Vector((0, 0, -radius)))]
    rings = []
    angles = [-math.pi / 2 + step * math.pi / (2 * cap_steps) for step in range(1, cap_steps + 1)]
    angles += [0]
    angles += [step * math.pi / (2 * cap_steps) for step in range(1, cap_steps)]
    for ring_index, angle in enumerate(angles):
        ring = []
        z = radius * math.sin(angle) + (length if ring_index > cap_steps - 1 else 0)
        ring_radius = radius * math.cos(angle)
        for side in range(sides):
            phi = side * 2 * math.pi / sides
            point = start + rotation @ Vector((ring_radius * math.cos(phi), ring_radius * math.sin(phi), z))
            ring.append(len(vertices))
            vertices.append(tuple(point))
        rings.append(ring)
    top = len(vertices)
    vertices.append(tuple(end + rotation @ Vector((0, 0, radius))))
    faces = [(0, rings[0][(side + 1) % sides], rings[0][side]) for side in range(sides)]
    for lower, upper in zip(rings, rings[1:]):
        faces.extend((lower[side], lower[(side + 1) % sides], upper[(side + 1) % sides], upper[side]) for side in range(sides))
    faces.extend((rings[-1][side], rings[-1][(side + 1) % sides], top) for side in range(sides))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(cream)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    pieces.append(obj)


# Each form overlaps its neighbor at the joint, while keeping its own clean
# outline. The arms angle away from the torso so both hands read separately.
capsule("torso", (0, 0, 0.94), (0, 0, 1.43), 0.30, sides=16)
head()
for side in (-1, 1):
    capsule("arm_left" if side < 0 else "arm_right", (side * 0.23, 0, 1.44), (side * 0.73, 0, 1.70), 0.13)
    capsule("leg_left" if side < 0 else "leg_right", (side * 0.17, 0, 0.86), (side * 0.20, -0.02, 0.14), 0.14)


def geometry(objects, pivot=(0, 0, 0)):
    positions, normals, indices = [], [], []
    for obj in objects:
        mesh = obj.data
        mesh.calc_loop_triangles()
        offset = len(positions) // 3
        for vertex in mesh.vertices:
            p = obj.matrix_world @ vertex.co
            n = obj.matrix_world.to_3x3() @ vertex.normal
            positions.extend((round(p.x - pivot[0], 5), round(p.z - pivot[1], 5), round(-p.y - pivot[2], 5)))
            normals.extend((round(n.x, 5), round(n.z, 5), round(-n.y, 5)))
        for tri in mesh.loop_triangles:
            indices.extend(offset + i for i in tri.vertices)
    return {"positions": positions, "normals": normals, "indices": indices}


OUT.parent.mkdir(parents=True, exist_ok=True)
part_pivots = {
    "arm_left": (-0.23, 1.44, 0), "arm_right": (0.23, 1.44, 0),
    "leg_left": (-0.17, 0.86, 0), "leg_right": (0.17, 0.86, 0),
}
parts_by_name = {obj.name: obj for obj in pieces}
parts = {name: {"pivot": pivot, **geometry([parts_by_name[name]], pivot)}
         for name, pivot in part_pivots.items()}
OUT.write_text(json.dumps({"version": 3, "coordinates": "three-y-up",
                           "body": geometry([parts_by_name["torso"], parts_by_name["head"]]),
                           "parts": parts}, separators=(",", ":")))

bpy.ops.object.select_all(action="DESELECT")
for obj in pieces:
    obj.select_set(True)
bpy.context.view_layer.objects.active = pieces[0]
bpy.ops.export_scene.gltf(filepath=str(GLB), export_format="GLB", use_selection=True)

# Keep the authoring file focused on the model and a useful three-quarter view.
for area in bpy.context.screen.areas:
    if area.type == "VIEW_3D":
        space = area.spaces.active
        space.shading.type = "SOLID"
        space.shading.color_type = "MATERIAL"
        space.overlay.show_overlays = False
        space.region_3d.view_rotation = Euler((math.radians(72), 0, math.radians(-18)), "XYZ").to_quaternion()
        space.region_3d.view_location = (0, 0, 1.22)
        space.region_3d.view_distance = 4.2
bpy.ops.object.select_all(action="DESELECT")
bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))

print(json.dumps({"parts": [obj.name for obj in pieces], "triangles": len(geometry(pieces)["indices"]) // 3,
                  "json": str(OUT), "glb": str(GLB), "blend": str(BLEND)}))
