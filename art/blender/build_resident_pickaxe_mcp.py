"""Build the resident pickaxe with Blender MCP without changing the open scene."""
import json
import math
from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parents[2]
OUT_JSON = ROOT / "src/town/generated/resident-pickaxe.json"
OUT_BLEND = ROOT / "art/blender/resident-pickaxe.blend"
scene = bpy.data.scenes.new("Resident Pickaxe Asset")


def tube(name, sections, axis):
    sides = 12
    vertices = []
    for position, center_z, radius in sections:
        for side in range(sides):
            angle = side * math.tau / sides
            if axis == "z":
                vertices.append((radius * math.cos(angle), radius * math.sin(angle), position))
            else:
                vertices.append((position, radius * math.cos(angle), center_z + radius * math.sin(angle)))
    faces = []
    for ring in range(len(sections) - 1):
        for side in range(sides):
            a = ring * sides + side
            b = ring * sides + (side + 1) % sides
            c = (ring + 1) * sides + (side + 1) % sides
            d = (ring + 1) * sides + side
            faces.extend(((a, b, c), (a, c, d)))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    for face in mesh.polygons:
        face.use_smooth = True
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    return obj


handle = tube("rounded_tapered_handle", [
    (-.04, 0, .006), (0, 0, .063), (.15, 0, .071),
    (.56, 0, .061), (.9, 0, .051), (.96, 0, .007),
], "z")
socket = tube("forged_socket", [
    (.7, 0, .007), (.72, 0, .093), (.86, 0, .093), (.88, 0, .007),
], "z")
head = tube("curved_pointed_head", [
    (-.42, .72, .006), (-.32, .81, .03), (-.18, .86, .06),
    (0, .88, .08), (.18, .85, .065), (.34, .76, .035),
    (.52, .58, .006),
], "x")

wood = bpy.data.materials.new("Warm dark wood")
wood.diffuse_color = (.32, .18, .09, 1)
wood.use_nodes = True
next(node for node in wood.node_tree.nodes if node.type == "BSDF_PRINCIPLED").inputs["Base Color"].default_value = wood.diffuse_color
metal = bpy.data.materials.new("Soft iron")
metal.diffuse_color = (.32, .39, .4, 1)
metal.use_nodes = True
next(node for node in metal.node_tree.nodes if node.type == "BSDF_PRINCIPLED").inputs["Base Color"].default_value = metal.diffuse_color
handle.data.materials.append(wood)
socket.data.materials.append(metal)
head.data.materials.append(metal)


def to_three(vector):
    return [round(vector.x, 5), round(vector.z, 5), round(-vector.y, 5)]


parts = []
for name, obj in (("handle", handle), ("socket", socket), ("head", head)):
    parts.append({
        "name": name,
        "positions": [coordinate for vertex in obj.data.vertices for coordinate in to_three(vertex.co)],
        "indices": [vertex for polygon in obj.data.polygons for vertex in polygon.vertices],
    })
OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
OUT_JSON.write_text(json.dumps({"version": 1, "coordinates": "three-y-up", "parts": parts}, separators=(",", ":")))
if bpy.app.background:
    for other in list(bpy.data.scenes):
        if other != scene:
            bpy.data.scenes.remove(other)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT_BLEND))
else:
    # The currently open world scene and its selection are untouched.
    bpy.data.scenes.remove(scene)
    meshes = [obj.data for obj in (handle, socket, head)]
    for obj in (handle, socket, head):
        bpy.data.objects.remove(obj)
    for mesh in meshes:
        bpy.data.meshes.remove(mesh)
    bpy.data.materials.remove(wood)
    bpy.data.materials.remove(metal)
print(json.dumps({"json": str(OUT_JSON), "blend": str(OUT_BLEND) if bpy.app.background else None, "parts": [(p["name"], len(p["positions"]) // 3) for p in parts]}))
