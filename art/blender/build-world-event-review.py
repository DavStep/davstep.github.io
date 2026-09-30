"""Import native Three.js event geometry into a NEW editable Blender review scene.
Run via exec(compile(open(__file__).read(), __file__, 'exec')) or Blender --python.
Never clears existing scenes/objects; save_as_mainfile(copy=True) preserves current filepath.
"""
import bpy
import json
from pathlib import Path
from mathutils import Vector

BASE = Path('/Users/davitstepanyan/Documents/stepdav.github.io/art/blender')
data = json.loads((BASE / 'world-events-review.json').read_text())
scene = bpy.data.scenes.new('WorldEventReview')
scene['authoring'] = data['authoring']
scene['source_coordinates'] = data['coordinates']
collection = bpy.data.collections.new('WorldEventReview')
scene.collection.children.link(collection)
asset_collections = {}
materials = {}
for item in data['meshes']:
    asset = item['asset']
    if asset not in asset_collections:
        sub = bpy.data.collections.new(asset)
        collection.children.link(sub)
        asset_collections[asset] = sub
    raw = item['vertices']
    vertices = [raw[i:i + 3] for i in range(0, len(raw), 3)]
    indices = item['indices']
    faces = [indices[i:i + 3] for i in range(0, len(indices), 3)]
    mesh = bpy.data.meshes.new(item['name'])
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(item['name'], mesh)
    asset_collections[asset].objects.link(obj)
    obj['source_part_path'] = item['partPath']
    obj['source_matrix_world_diagnostic_only'] = item['sourceMatrixWorld']
    spec = item['material']
    key = json.dumps(spec, sort_keys=True)
    if key not in materials:
        mat = bpy.data.materials.new(spec['name'])
        mat.use_nodes = True
        node = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
        node.inputs['Base Color'].default_value = (*spec['baseColorLinear'], 1)
        node.inputs['Roughness'].default_value = spec['roughness']
        node.inputs['Metallic'].default_value = spec['metalness']
        node.inputs['Alpha'].default_value = spec['opacity']
        if 'Emission Color' in node.inputs:
            node.inputs['Emission Color'].default_value = (*spec['emissiveLinear'], 1)
            node.inputs['Emission Strength'].default_value = spec['emissiveIntensity']
        mat.diffuse_color = (*spec['baseColorLinear'], spec['opacity'])
        mat.use_backface_culling = not spec['doubleSided']
        materials[key] = mat
    mesh.materials.append(materials[key])

# Review-only neutral floor, camera and studio lights live in their own collection.
studio = bpy.data.collections.new('WorldEventReview_Studio')
scene.collection.children.link(studio)
floor_mesh = bpy.data.meshes.new('Review_Floor')
floor_mesh.from_pydata([(-18, -14, -.035), (18, -14, -.035), (18, 14, -.035), (-18, 14, -.035)], [], [(0, 1, 2, 3)])
floor = bpy.data.objects.new('Review_Floor', floor_mesh)
studio.objects.link(floor)
floor_mat = bpy.data.materials.new('Review_Neutral_Ground')
floor_mat.diffuse_color = (.18, .21, .20, 1)
floor_mesh.materials.append(floor_mat)
world = bpy.data.worlds.new('WorldEventReview_World')
world.use_nodes = True
background = next(n for n in world.node_tree.nodes if n.type == 'BACKGROUND')
background.inputs['Color'].default_value = (.25, .30, .36, 1)
background.inputs['Strength'].default_value = .45
scene.world = world
for name, location, power, size in [('Key', (-9, -5, 16), 2300, 9), ('Fill', (10, 3, 12), 1700, 10)]:
    light = bpy.data.lights.new('Review_' + name, 'AREA')
    light.energy = power
    light.shape = 'DISK'
    light.size = size
    obj = bpy.data.objects.new('Review_' + name, light)
    studio.objects.link(obj)
    obj.location = location
    obj.rotation_euler = (Vector((0, -2, 0)) - obj.location).to_track_quat('-Z', 'Y').to_euler()
camera_data = bpy.data.cameras.new('WorldEventReview_Camera')
camera = bpy.data.objects.new('WorldEventReview_Camera', camera_data)
studio.objects.link(camera)
camera.location = (16, -24, 23)
camera.rotation_euler = (Vector((0, -1, 1)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
camera_data.type = 'ORTHO'
camera_data.ortho_scale = 27
scene.camera = camera
scene.render.engine = 'CYCLES'
scene.cycles.samples = 32
scene.render.resolution_x = 1600
scene.render.resolution_y = 1100
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = str(BASE / 'world-events-review.png')
scene.view_settings.view_transform = 'AgX'
if bpy.context.window:
    bpy.context.window.scene = scene
bpy.ops.wm.save_as_mainfile(filepath=str(BASE / 'world-events-review.blend'), copy=True)
print('Created', scene.name, 'with', len(data['meshes']), 'editable visible material batches. Existing scene data preserved; saved review copy.')
