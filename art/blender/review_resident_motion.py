"""Render a looping resident gait preview without changing the source blend."""
import math
import subprocess
import tempfile
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "art/reviews/residents/walk-cycle.gif"
PIVOTS = {
    "arm_left": (-0.23, 0, 1.44), "arm_right": (0.23, 0, 1.44),
    "leg_left": (-0.17, 0, 0.86), "leg_right": (0.17, 0, 0.86),
}
scene = bpy.context.scene
parts = [bpy.data.objects[name] for name in
         ("torso", "head", "arm_left", "arm_right", "leg_left", "leg_right")]
copies = {}
for part in parts:
    copy = part.copy()
    copy.data = part.data.copy()
    scene.collection.objects.link(copy)
    if part.name in PIVOTS:
        pivot = Vector(PIVOTS[part.name])
        for vertex in copy.data.vertices:
            vertex.co -= pivot
        copy.location = pivot
    copies[part.name] = copy
    part.hide_render = True

bpy.ops.object.camera_add(location=(2.5, -8, 3.2))
camera = bpy.context.object
camera.rotation_euler = (Vector((0, 0, 1.2)) - camera.location).to_track_quat("-Z", "Y").to_euler()
camera.data.type = "ORTHO"
camera.data.ortho_scale = 2.85
scene.camera = camera
for location, energy, size in (((-4, -5, 8), 1100, 7), ((4, -3, 6), 650, 6)):
    bpy.ops.object.light_add(type="AREA", location=location)
    light = bpy.context.object
    light.data.energy = energy
    light.data.shape = "DISK"
    light.data.size = size

scene.render.resolution_x = 280
scene.render.resolution_y = 320
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
OUTPUT.parent.mkdir(parents=True, exist_ok=True)

with tempfile.TemporaryDirectory(prefix="resident-walk-") as frames:
    for frame in range(16):
        step = math.sin(frame * 2 * math.pi / 16)
        for side in ("left", "right"):
            arm = copies["arm_" + side]
            arm.rotation_euler.x = (-step if side == "left" else step) * 0.45
            arm.rotation_euler.y = -1.85 if side == "left" else 1.85
            leg = copies["leg_" + side]
            angle = (-step if side == "left" else step) * 0.52
            leg.rotation_euler.x = angle
            lift = max(0, step if side == "left" else -step) * 0.12
            leg.location.z = PIVOTS["leg_" + side][2] - 0.72 * (1 - math.cos(angle)) + lift
        scene.render.filepath = str(Path(frames) / f"frame_{frame:02d}.png")
        bpy.ops.render.render(write_still=True)
    subprocess.run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-framerate", "16",
        "-i", str(Path(frames) / "frame_%02d.png"), "-filter_complex",
        "[0:v]split[a][b];[a]palettegen[p];[b][p]paletteuse",
        "-loop", "0", str(OUTPUT),
    ], check=True)

print(str(OUTPUT))
