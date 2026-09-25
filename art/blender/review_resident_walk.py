"""Render three grounded walking phases from the Three.js limb pivots."""
import math
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "art/reviews/residents/walk-cycle.png"
PART_NAMES = ("torso", "head", "arm_left", "arm_right", "leg_left", "leg_right")
PIVOTS = {
    "arm_left": (-0.23, 0, 1.44), "arm_right": (0.23, 0, 1.44),
    "leg_left": (-0.17, 0, 0.86), "leg_right": (0.17, 0, 0.86),
}
scene = bpy.context.scene
parts = [bpy.data.objects[name] for name in PART_NAMES]
old_camera = scene.camera
old_path = scene.render.filepath
old_resolution = (scene.render.resolution_x, scene.render.resolution_y,
                  scene.render.resolution_percentage)
old_format = scene.render.image_settings.file_format
temporary = []

for index, step in enumerate((-1, 0, 1)):
    offset = Vector(((index - 1) * 3.0, 0, 0))
    for part in parts:
        copy = part.copy()
        copy.data = part.data.copy()
        scene.collection.objects.link(copy)
        temporary.append(copy)
        if part.name in PIVOTS:
            pivot = Vector(PIVOTS[part.name])
            for vertex in copy.data.vertices:
                vertex.co -= pivot
            copy.location = offset + pivot
            if part.name.startswith("arm"):
                copy.rotation_euler.x = (-step if part.name == "arm_left" else step) * 0.45
                copy.rotation_euler.y = -1.85 if part.name == "arm_left" else 1.85
            elif part.name == "leg_left":
                angle = -step * 0.52
                copy.rotation_euler.x = angle
                copy.location.z += -0.72 * (1 - math.cos(angle)) + max(0, step) * 0.12
            else:
                angle = step * 0.52
                copy.rotation_euler.x = angle
                copy.location.z += -0.72 * (1 - math.cos(angle)) + max(0, -step) * 0.12
        else:
            copy.location += offset

for part in parts:
    part.hide_render = True

bpy.ops.object.camera_add(location=(4, -11, 4.3))
camera = bpy.context.object
temporary.append(camera)
camera.rotation_euler = (Vector((0, 0, 1.2)) - camera.location).to_track_quat("-Z", "Y").to_euler()
camera.data.type = "ORTHO"
camera.data.ortho_scale = 10.4
scene.camera = camera

for location, energy, size in (((-4, -5, 8), 1100, 7), ((4, -3, 6), 650, 6)):
    bpy.ops.object.light_add(type="AREA", location=location)
    light = bpy.context.object
    light.data.energy = energy
    light.data.shape = "DISK"
    light.data.size = size
    temporary.append(light)

scene.render.resolution_x = 1200
scene.render.resolution_y = 450
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
scene.render.filepath = str(OUTPUT)
bpy.ops.render.render(write_still=True)

for obj in temporary:
    bpy.data.objects.remove(obj, do_unlink=True)
for part in parts:
    part.hide_render = False
scene.camera = old_camera
scene.render.filepath = old_path
scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = old_resolution
scene.render.image_settings.file_format = old_format
bpy.data.orphans_purge(do_recursive=True)
print(str(OUTPUT))
