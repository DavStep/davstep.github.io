"""Build the chibi worker: a big-headed toy figure with a face, tinted tunic
and sleeves, and untinted skin, hair, belt, trousers and boots.

Runs through scripts/blender-mcp-run.py in the live Blender session, or headless
(`python -c "import bpy, runpy; runpy.run_path('art/blender/build_residents.py')"`).
Blender uses Z up and faces -Y; the JSON converts to Three.js Y up and +Z front.

Runtime contract (src/town/residents.ts):
- `body` and `parts.*` are the tinted surfaces (idea color at runtime).
- `detail.body` and `detail.parts.*` carry fixed colors as linear vertex colors.
- Limb pivots are unchanged so existing animation and props still line up.
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
REVIEW = ROOT / "art/reviews/residents/chibi-worker.png"

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
bpy.data.orphans_purge(do_recursive=True)


def linear(v):
    return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4


def rgb(hex_color):
    return tuple(linear(int(hex_color[i:i + 2], 16) / 255) for i in (0, 2, 4))


COLORS = {
    "tint": "ffffff",      # multiplied by the idea color at runtime
    "skin": "f3c9a4",
    "cheek": "ee9a8a",
    "hair": "6b4630",
    "eye": "2b2320",
    "shine": "ffffff",
    "belt": "5a3b28",
    "buckle": "e9c06c",
    "trousers": "6f6258",
    "boot": "4a3629",
}
materials = {}


def material(key):
    if key in materials:
        return materials[key]
    mat = bpy.data.materials.new("MAT_Resident_" + key)
    color = rgb(COLORS[key])
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    shader = next(node for node in mat.node_tree.nodes if node.type == "BSDF_PRINCIPLED")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Roughness"].default_value = 0.8
    materials[key] = mat
    return mat


pieces = []  # (object, group, color_key)


def finish(obj, group, key, smooth=True):
    obj.data.materials.append(material(key))
    for polygon in obj.data.polygons:
        polygon.use_smooth = smooth
    pieces.append((obj, group, key))
    return obj


def sphere(name, location, scale, group, key, segments=18, rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, group, key)


def capsule(name, start, end, radius, group, key, sides=14, cap_steps=3, end_radius=None):
    """A closed capsule; `end_radius` tapers it into a rounded cone."""
    end_radius = radius if end_radius is None else end_radius
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
        upper = ring_index > cap_steps - 1
        r = end_radius if upper else radius
        z = r * math.sin(angle) + (length if upper else 0)
        ring_radius = r * math.cos(angle)
        ring = []
        for side in range(sides):
            phi = side * 2 * math.pi / sides
            ring.append(len(vertices))
            vertices.append(tuple(start + rotation @ Vector((ring_radius * math.cos(phi), ring_radius * math.sin(phi), z))))
        rings.append(ring)
    top = len(vertices)
    vertices.append(tuple(end + rotation @ Vector((0, 0, end_radius))))
    faces = [(0, rings[0][(side + 1) % sides], rings[0][side]) for side in range(sides)]
    for lower, upper in zip(rings, rings[1:]):
        faces.extend((lower[side], lower[(side + 1) % sides], upper[(side + 1) % sides], upper[side]) for side in range(sides))
    faces.extend((rings[-1][side], rings[-1][(side + 1) % sides], top) for side in range(sides))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return finish(obj, group, key)


def box(name, location, size, group, key):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bevel = obj.modifiers.new("soft", "BEVEL")
    bevel.width = min(size) * 0.3
    bevel.segments = 2
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    return finish(obj, group, key)


# --- Proportions: chibi 1 : 2.3 head-to-body, head centre at 2.02 -------------
HEAD_Z, HEAD_R = 2.02, 0.56
FRONT = -1  # Blender -Y is the character's front

# Tunic: a flared rounded cone, tinted.
def cone(name, z0, z1, r0, r1, group, key, sides=20):
    bpy.ops.mesh.primitive_cone_add(vertices=sides, radius1=r0, radius2=r1, depth=z1 - z0, location=(0, 0, (z0 + z1) / 2))
    obj = bpy.context.object
    obj.name = name
    bevel = obj.modifiers.new("soft", "BEVEL")
    bevel.width = 0.06
    bevel.segments = 3
    bevel.limit_method = "ANGLE"
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    return finish(obj, group, key)


cone("tunic", 0.76, 1.56, 0.4, 0.25, "body", "tint")

# Head and face (fixed colors).
sphere("head", (0, 0, HEAD_Z), (HEAD_R, HEAD_R * 0.96, HEAD_R * 0.92), "body", "skin")
sphere("hair", (0, 0.07, HEAD_Z + 0.1), (HEAD_R * 1.05, HEAD_R * 0.98, HEAD_R * 0.86), "body", "hair")
# Keep the face clear: squash the hair cap back so it frames the forehead.
hair = pieces[-1][0]
for vertex in hair.data.vertices:
    local = vertex.co
    if local.y < -0.18 and local.z < 0.2:
        local.y = -0.18 + (local.y + 0.18) * 0.25
for side in (-1, 1):
    sphere(f"eye_{side}", (side * 0.19, FRONT * 0.5, HEAD_Z + 0.02), (0.075, 0.05, 0.1), "body", "eye", segments=10, rings=8)
    sphere(f"eye_shine_{side}", (side * 0.17, FRONT * 0.545, HEAD_Z + 0.06), (0.025, 0.015, 0.03), "body", "shine", segments=8, rings=6)
    sphere(f"cheek_{side}", (side * 0.3, FRONT * 0.43, HEAD_Z - 0.12), (0.08, 0.035, 0.05), "body", "cheek", segments=10, rings=6)
    sphere(f"ear_{side}", (side * HEAD_R * 0.97, 0, HEAD_Z - 0.02), (0.08, 0.06, 0.11), "body", "skin", segments=10, rings=8)
sphere("nose", (0, FRONT * 0.54, HEAD_Z - 0.06), (0.06, 0.05, 0.05), "body", "skin", segments=10, rings=8)
# Belt with a buckle.
cone("belt", 0.98, 1.08, 0.372, 0.357, "body", "belt")
box("buckle", (0, FRONT * 0.37, 1.03), (0.15, 0.05, 0.12), "body", "buckle")

# Arms: tinted sleeve from the shoulder, skin forearm and a round hand.
for side, name in ((-1, "arm_left"), (1, "arm_right")):
    shoulder = Vector((side * 0.23, 0, 1.44))
    tip = Vector((side * 0.66, 0, 1.66))
    elbow = shoulder.lerp(tip, 0.55)
    capsule(name, tuple(shoulder), tuple(elbow), 0.15, name, "tint", sides=12)
    capsule(name + "_forearm", tuple(elbow), tuple(tip), 0.1, name, "skin", sides=10)
    sphere(name + "_hand", tuple(tip + (tip - shoulder).normalized() * 0.04), (0.13, 0.13, 0.13), name, "skin", segments=12, rings=8)

# Legs: short trousers and chunky boots.
for side, name in ((-1, "leg_left"), (1, "leg_right")):
    capsule(name, (side * 0.17, 0, 0.86), (side * 0.18, 0, 0.3), 0.15, name, "trousers", sides=12)
    box(name + "_boot", (side * 0.18, FRONT * 0.07, 0.13), (0.26, 0.4, 0.24), name, "boot")


# --- Export -------------------------------------------------------------------
def geometry(objects, pivot=(0, 0, 0), colored=False):
    positions, normals, indices, colors = [], [], [], []
    for obj, _group, key in objects:
        mesh = obj.data
        mesh.calc_loop_triangles()
        offset = len(positions) // 3
        color = rgb(COLORS[key])
        for vertex in mesh.vertices:
            p = obj.matrix_world @ vertex.co
            n = (obj.matrix_world.to_3x3() @ vertex.normal).normalized()
            positions.extend((round(p.x - pivot[0], 5), round(p.z - pivot[1], 5), round(-p.y - pivot[2], 5)))
            normals.extend((round(n.x, 5), round(n.z, 5), round(-n.y, 5)))
            if colored:
                colors.extend(round(c, 5) for c in color)
        for tri in mesh.loop_triangles:
            indices.extend(offset + i for i in tri.vertices)
    out = {"positions": positions, "normals": normals, "indices": indices}
    if colored:
        out["colors"] = colors
    return out


def select(group, tinted):
    return [p for p in pieces if p[1] == group and (p[2] == "tint") == tinted]


part_pivots = {
    "arm_left": (-0.23, 1.44, 0), "arm_right": (0.23, 1.44, 0),
    "leg_left": (-0.17, 0.86, 0), "leg_right": (0.17, 0.86, 0),
}
payload = {
    "version": 3,
    "coordinates": "three-y-up",
    "style": "chibi",
    "body": geometry(select("body", True)),
    "parts": {name: {"pivot": pivot, **geometry(select(name, True), pivot)} for name, pivot in part_pivots.items()},
    "detail": {
        "body": geometry(select("body", False), colored=True),
        "parts": {name: geometry(select(name, False), pivot, colored=True) for name, pivot in part_pivots.items()},
    },
}
# The legs have no tinted surface; keep a valid (empty) tinted mesh for them.
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(payload, separators=(",", ":")))

bpy.ops.object.select_all(action="DESELECT")
for obj, _group, _key in pieces:
    obj.select_set(True)
bpy.context.view_layer.objects.active = pieces[0][0]
bpy.ops.export_scene.gltf(filepath=str(GLB), export_format="GLB", use_selection=True)


# --- Review render (three-quarter and front) ----------------------------------
def review():
    scene = bpy.context.scene
    tint = material("tint")
    shader = next(node for node in tint.node_tree.nodes if node.type == "BSDF_PRINCIPLED")
    shader.inputs["Base Color"].default_value = (*rgb("e99a6f"), 1)  # settlers orange
    bpy.ops.mesh.primitive_plane_add(size=12, location=(0, 0, 0))
    ground = bpy.context.object
    gmat = bpy.data.materials.new("MAT_Review_Ground")
    gmat.use_nodes = True
    next(n for n in gmat.node_tree.nodes if n.type == "BSDF_PRINCIPLED").inputs["Base Color"].default_value = (*rgb("9cc47a"), 1)
    ground.data.materials.append(gmat)
    bpy.ops.object.light_add(type="SUN", location=(3, -4, 6))
    sun = bpy.context.object
    sun.data.energy = 3.2
    sun.rotation_euler = Euler((math.radians(50), 0, math.radians(35)))
    world = bpy.data.worlds.new("Review") if not scene.world else scene.world
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (*rgb("cfe3ea"), 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.9
    bpy.ops.object.camera_add(location=(2.6, -4.6, 2.6))
    cam = bpy.context.object
    direction = Vector((0, 0, 1.35)) - cam.location
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    cam.data.lens = 55
    scene.camera = cam
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 24
    scene.cycles.device = "CPU"
    scene.render.resolution_x, scene.render.resolution_y = 720, 720
    REVIEW.parent.mkdir(parents=True, exist_ok=True)
    scene.render.filepath = str(REVIEW)
    bpy.ops.render.render(write_still=True)
    for obj in (ground, sun, cam):
        bpy.data.objects.remove(obj, do_unlink=True)
    shader.inputs["Base Color"].default_value = (1, 1, 1, 1)


try:
    review()
except Exception as error:  # rendering is optional in constrained sessions
    print("REVIEW_RENDER_SKIPPED", error)

bpy.ops.object.select_all(action="DESELECT")
bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
print(json.dumps({"pieces": len(pieces), "triangles": len(geometry(pieces)["indices"]) // 3,
                  "json": str(OUT), "glb": str(GLB), "blend": str(BLEND), "review": str(REVIEW)}))
