"""Render the six runtime resident colors from the Blender-authored forms."""
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "art/reviews/residents/color-variants.png"
PALETTE = ("F0DC8B", "A8CEB8", "E4A69E", "B6B6D5", "E3B98C", "94C4CC")
PARTS = tuple(bpy.data.objects[name] for name in
              ("torso", "head", "arm_left", "arm_right", "leg_left", "leg_right"))
PIVOTS = {
    "arm_left": (-0.23, 0, 1.44), "arm_right": (0.23, 0, 1.44),
    "leg_left": (-0.17, 0, 0.86), "leg_right": (0.17, 0, 0.86),
}
scene = bpy.context.scene
old_camera = scene.camera
old_path = scene.render.filepath
old_resolution = (scene.render.resolution_x, scene.render.resolution_y,
                  scene.render.resolution_percentage)
old_format = scene.render.image_settings.file_format
temporary = []

for index, hex_color in enumerate(PALETTE):
    x = (index - 2.5) * 1.95
    color = tuple(int(hex_color[channel:channel + 2], 16) / 255
                  for channel in (0, 2, 4))
    mat = bpy.data.materials.new("Preview_" + hex_color)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    shader = next(node for node in mat.node_tree.nodes if node.type == "BSDF_PRINCIPLED")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Roughness"].default_value = 0.9
    for part in PARTS:
        copy = part.copy()
        copy.data = part.data.copy()
        scene.collection.objects.link(copy)
        if part.name in PIVOTS:
            pivot = Vector(PIVOTS[part.name])
            for vertex in copy.data.vertices:
                vertex.co -= pivot
            copy.location = pivot
        copy.location.x += x
        if part.name == "arm_left":
            copy.rotation_euler.y = -1.85
        elif part.name == "arm_right":
            copy.rotation_euler.y = 1.85
        copy.data.materials.clear()
        copy.data.materials.append(mat)
        temporary.append(copy)

for part in PARTS:
    part.hide_render = True

bpy.ops.object.camera_add(location=(0, -11, 4.4))
camera = bpy.context.object
temporary.append(camera)
camera.rotation_euler = (Vector((0, 0, 1.3)) - camera.location).to_track_quat("-Z", "Y").to_euler()
camera.data.type = "ORTHO"
camera.data.ortho_scale = 13.8
scene.camera = camera

for location, energy, size in (((-4, -5, 8), 1100, 7), ((4, -3, 6), 650, 6)):
    bpy.ops.object.light_add(type="AREA", location=location)
    light = bpy.context.object
    light.data.energy = energy
    light.data.shape = "DISK"
    light.data.size = size
    temporary.append(light)

scene.render.resolution_x = 1500
scene.render.resolution_y = 450
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
scene.render.filepath = str(OUTPUT)
bpy.ops.render.render(write_still=True)

for obj in temporary:
    bpy.data.objects.remove(obj, do_unlink=True)
for part in PARTS:
    part.hide_render = False
scene.camera = old_camera
scene.render.filepath = old_path
scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = old_resolution
scene.render.image_settings.file_format = old_format
bpy.data.orphans_purge(do_recursive=True)
print(str(OUTPUT))
