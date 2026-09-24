"""Author five distinct hero landmarks in connected Blender.

Run through scripts/blender-mcp-run.py. Historical source is retained for bounds and comparison.
Only Landmark_* scenes are replaced. Other open Blender work stays untouched.
"""
import bpy
import bmesh
import json
import math
import os
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
OUT = os.path.join(ROOT, 'art', 'blender')
SOURCE = os.path.join(OUT, 'landmarks-source.json')
GENERATED = os.path.join(ROOT, 'src', 'town', 'generated', 'landmarks.json')
REVIEW_OUT = os.path.join(ROOT, 'art', 'reviews', 'landmarks')
REPORT = os.path.join(REVIEW_OUT, 'triangle-report.json')
os.makedirs(REVIEW_OUT, exist_ok=True)
os.makedirs(os.path.dirname(GENERATED), exist_ok=True)

source = json.load(open(SOURCE))
assert source['version'] == 1 and source['coordinates'] == 'three-y-up'
FAMILIES = ('outpost', 'sandship', 'battle', 'wizard', 'dwarves')

for old in list(bpy.data.scenes):
    if old.name.startswith(('Landmark_Library', 'Landmark_Review',
                            'Landmark_Before_Comparison', 'Landmark_RoundTrip')):
        owned = list(old.objects)
        bpy.data.scenes.remove(old)
        bpy.data.batch_remove(ids=[obj for obj in owned if not obj.users_scene])
for old in list(bpy.data.materials):
    if old.name.startswith('MAT_Landmark_') and old.users == 0:
        bpy.data.materials.remove(old)


def linear(v):
    return v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4


def rgb(h):
    return tuple(linear(int(h[i:i + 2], 16) / 255) for i in (0, 2, 4))


COLORS = {
    'blue': '668db0', 'copper': 'b8775d', 'cyan': '62c4cc',
    'earth': '8d795f', 'emerald': '5aab85', 'gold': 'e9c06c',
    'ink': '34384b', 'iron': '576a72', 'magic': '9bc5ed',
    'olive': '748568', 'plasterIvory': 'e1d2b4', 'red': 'be7062',
    'roofDark': '765740', 'sand': 'c6a97e', 'stone': 'a7a195',
    'stoneDark': '777b78', 'violet': '664b89', 'woodDark': '674d3d',
    'woodLight': '9b7759', 'violetTile0':'615a83', 'violetTile1':'73678f', 'violetTile2':'82769e', 'violetTile3':'69668c',
}
mats = {}
for key, color in COLORS.items():
    mat = bpy.data.materials.new('MAT_Landmark_' + key)
    mat.use_nodes = True
    mat.diffuse_color = (*rgb(color), 1)
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = mat.diffuse_color
    shader.inputs['Roughness'].default_value = .93 if key not in ('iron', 'copper', 'gold') else .76
    if key in ('cyan', 'magic'):
        shader.inputs['Emission Color'].default_value = (*rgb(color), 1)
        shader.inputs['Emission Strength'].default_value = .16
    mat['runtime'] = key
    mats[key] = mat

library = bpy.data.scenes.new('Landmark_Library')
bpy.context.window.scene = library
library.unit_settings.system = 'METRIC'
work_col = bpy.data.collections.new('Landmark_Editable_Workparts')
library.collection.children.link(work_col)
grouped_cols = {}


def grouped_collection(family, lod):
    key = (family, lod)
    if key not in grouped_cols:
        name = 'ENV_Landmark_' + family + '_LOD' + str(lod)
        col = bpy.data.collections.new(name)
        library.collection.children.link(col)
        grouped_cols[key] = col
    return grouped_cols[key]


def to_blender(flat):
    return [(flat[i], -flat[i + 2], flat[i + 1]) for i in range(0, len(flat), 3)]


BOX_FACES = [(0, 2, 6, 4), (1, 5, 7, 3), (0, 1, 3, 2),
             (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6)]
BOX_EDGES = ((0, 4), (0, 2), (0, 1))


def make_object(name, vertices, faces, material, col):
    me = bpy.data.meshes.new(name)
    me.from_pydata(vertices, [], faces)
    me.update()
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    col.objects.link(ob)
    me.materials.append(mats[material])
    return ob


def source_object(item, name, col):
    if item['kind'] == 'block':
        vs = to_blender(item['originalPositions'])
        ids = item['originalIndices']
    else:
        vs = to_blender(item['positions'])
        ids = item['indices']
    return make_object(name, vs, [tuple(ids[i:i + 3]) for i in range(0, len(ids), 3)],
                       item['material'], col)


def refined_object(item, name, lod):
    if item['kind'] == 'block':
        vs = to_blender(item['positions'])
        ob = make_object(name, vs, BOX_FACES, item['material'], work_col)
        if lod == 0:
            shortest = min((Vector(vs[a]) - Vector(vs[b])).length for a, b in BOX_EDGES)
            bevel = ob.modifiers.new('Single edge cut', 'BEVEL')
            bevel.width = min(.06, shortest * .12)
            bevel.segments = 1
            bpy.ops.object.select_all(action='DESELECT')
            ob.select_set(True)
            bpy.context.view_layer.objects.active = ob
            bpy.ops.object.modifier_apply(modifier=bevel.name)
        return ob
    ids = item['indices']
    vs = to_blender(item['positions'])
    return make_object(name, vs, [tuple(ids[i:i + 3]) for i in range(0, len(ids), 3)],
                       item['material'], work_col)


# Hero designs share indexed geometry across stages, with authored construction
# and project-specific features instead of refining the original primitive stack.
import importlib.util
spec=importlib.util.spec_from_file_location('hero_landmarks',os.path.join(OUT,'hero_landmarks.py'))
hero=importlib.util.module_from_spec(spec);spec.loader.exec_module(hero)
groups = {}
for family in FAMILIES:
    for lod in (0,1):
        def emit(name,vertices,faces,material,lo,hi):
            ob=make_object(family+'_'+name+'_LOD'+str(lod),[(x,-z,y) for x,y,z in vertices],faces,material,work_col)
            key=(family,lod,lo,hi,material)
            bucket=groups.setdefault(key,{'vertices':[],'faces':[]})
            offset=len(bucket['vertices'])
            bucket['vertices'].extend(tuple(v.co) for v in ob.data.vertices)
            ob.data.calc_loop_triangles()
            bucket['faces'].extend(tuple(offset+v for v in tri.vertices) for tri in ob.data.loop_triangles)
            ob['family']=family;ob['minStage']=lo;ob['maxStage']=hi;ob.hide_set(True)
        hero.author_landmark(family,lod,emit)

parts = []
for (family, lod, lo, hi, material), payload in groups.items():
    name = 'ENV_Landmark_' + family + '_LOD' + str(lod) + '_s' + str(lo) + '-' + str(hi) + '_' + material
    ob = make_object(name, payload['vertices'], payload['faces'], material,
                     grouped_collection(family, lod))
    ob['family'] = family
    ob['lod'] = lod
    ob['minStage'] = lo
    ob['maxStage'] = hi
    ob['runtime_material'] = 'roofTiles' if material.startswith('violetTile') else material
    parts.append(ob)


def export_part(ob):
    me = ob.data
    me.calc_loop_triangles()
    positions, normals, indices, colors = [], [], [], []
    lookup = {}
    for tri in me.loop_triangles:
        for vi in tri.vertices:
            p = me.vertices[vi].co
            n = tri.normal
            ps = (p.x, p.z, -p.y)
            ns = (n.x, n.z, -n.y)
            key = tuple(round(v, 6) for v in (*ps, *ns))
            if key not in lookup:
                lookup[key] = len(positions) // 3
                positions.extend(round(v, 6) for v in ps)
                colors.extend(round(v,6) for v in me.materials[tri.material_index].diffuse_color[:3])
                normals.extend(round(v, 6) for v in ns)
            indices.append(lookup[key])
    return {'name': ob.name, 'family': ob['family'], 'lod': ob['lod'],
            'minStage': ob['minStage'], 'maxStage': ob['maxStage'],
            'material': ob['runtime_material'], 'positions': positions,
            'normals': normals, 'indices': indices, **({'colors': colors} if ob['runtime_material']=='roofTiles' else {})}


runtime = {'version': 1, 'coordinates': 'three-y-up',
           'parts': [export_part(ob) for ob in parts]}
with open(GENERATED + '.tmp', 'w') as handle:
    json.dump(runtime, handle, separators=(',', ':'))
os.replace(GENERATED + '.tmp', GENERATED)

report = {}
for family in FAMILIES:
    report[family] = {}
    for lod in (0, 1):
        for stage in (3, 4, 5, 6):
            active = [part for part in runtime['parts'] if part['family'] == family
                      and part['lod'] == lod and part['minStage'] <= stage <= part['maxStage']]
            points = [p['positions'][i:i + 3] for p in active
                      for i in range(0, len(p['positions']), 3)]
            report[family]['LOD' + str(lod) + '_stage' + str(stage)] = {
                'triangles': sum(len(part['indices']) // 3 for part in active),
                'bounds': [[round(min(v[axis] for v in points), 4) for axis in range(3)],
                           [round(max(v[axis] for v in points), 4) for axis in range(3)]],
            }
        budget = 6500 if lod == 0 else 3000
        if report[family]['LOD' + str(lod) + '_stage6']['triangles'] > budget:
            raise RuntimeError(f'{family} LOD{lod} exceeds {budget} triangle budget')

for family in FAMILIES:
    for lod in (0, 1):
        bpy.ops.object.select_all(action='DESELECT')
        selected = [ob for ob in grouped_cols[(family, lod)].objects
                    if ob['minStage'] <= 6 <= ob['maxStage']]
        for ob in selected:
            ob.select_set(True)
        bpy.context.view_layer.objects.active = selected[0]
        bpy.ops.export_scene.gltf(
            filepath=os.path.join(OUT, 'ENV_Landmark_' + family + '_LOD' + str(lod) + '.glb'),
            use_selection=True, use_active_scene=True, export_format='GLB',
            export_yup=True, export_cameras=False, export_lights=False)

# Preserve the exact existing procedural stage-6 parts in a separate source
# scene. Its 11k-triangle rounded blocks can be compared to the production kit.
before = bpy.data.scenes.new('Landmark_Before_Comparison')
bpy.context.window.scene = before
before_col = bpy.data.collections.new('Landmark_Original_Stage6')
before.collection.children.link(before_col)
for fi, family in enumerate(FAMILIES):
    parent = bpy.data.objects.new('Before_' + family, None)
    before_col.objects.link(parent)
    parent.location.x = (fi - 2) * 13
    for item in source['models'][family]:
        if not item['minStage'] <= 6 <= item['maxStage']:
            continue
        if item['kind'] == 'block' and not item.get('originalPositions'):
            continue
        ob = source_object(item, 'Before_' + item['name'], before_col)
        ob.parent = parent

review = bpy.data.scenes.new('Landmark_Review')
bpy.context.window.scene = review
review_col = bpy.data.collections.new('Landmark_Review_Assembly')
review.collection.children.link(review_col)
for fi, family in enumerate(FAMILIES):
    parent = bpy.data.objects.new('Review_' + family, None)
    review_col.objects.link(parent)
    parent.location.x = (fi - 2) * 13
    for lodpart in grouped_cols[(family, 0)].objects:
        if not lodpart['minStage'] <= 6 <= lodpart['maxStage']:
            continue
        ob = lodpart.copy()
        ob.data = lodpart.data
        review_col.objects.link(ob)
        ob.parent = parent

ground_me = bpy.data.meshes.new('Landmark_Review_Ground')
ground_me.from_pydata([(-40, -9, -.1), (40, -9, -.1),
                       (40, 9, -.1), (-40, 9, -.1)], [], [(0, 1, 2, 3)])
ground_ob = bpy.data.objects.new('Landmark_Review_Ground', ground_me)
review_col.objects.link(ground_ob)
earth = bpy.data.materials.new('MAT_Landmark_Review_Ground')
earth.use_nodes = True
earth.diffuse_color = (*rgb('9f794d'), 1)
earth.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value = earth.diffuse_color
ground_me.materials.append(earth)
camera_data = bpy.data.cameras.new('Landmark_Review_Camera')
camera = bpy.data.objects.new('Landmark_Review_Camera', camera_data)
review_col.objects.link(camera)
review.camera = camera
camera_data.type = 'ORTHO'
sun_data = bpy.data.lights.new('Landmark_Review_Sun', 'SUN')
sun = bpy.data.objects.new('Landmark_Review_Sun', sun_data)
review_col.objects.link(sun)
sun.rotation_euler = (.5, -.45, -.7)
sun_data.energy = 2.2
world = bpy.data.worlds.new('Landmark_Review_World')
world.use_nodes = True
world.node_tree.nodes.get('Background').inputs['Color'].default_value = (.62, .68, .75, 1)
world.node_tree.nodes.get('Background').inputs['Strength'].default_value = .7
review.world = world
review.render.engine = 'BLENDER_EEVEE'
review.render.resolution_x = 1600
review.render.resolution_y = 900
review.render.resolution_percentage = 100
review.render.image_settings.file_format = 'PNG'

for label, location, target, scale in (
    ('families', (35, -72, 37), (0, 0, 4), 73),
    ('outpost', (-12, -22, 13), (-26, 0, 4.4), 15),
    ('sandship', (1, -22, 13), (-13, 0, 4.4), 15),
    ('battle', (14, -22, 13), (0, 0, 4.4), 15),
    ('wizard', (27, -22, 14), (13, 0, 6), 17),
    ('dwarves', (42, -23, 14), (26, 0, 4), 17),
):
    review.render.resolution_x=1600 if label=='families' else 1200
    review.render.resolution_y=900 if label=='families' else 1400
    for ob in review_col.objects:
        if ob.parent:ob.hide_render=label!='families' and ob.parent.name!='Review_'+label
    camera.location = location
    camera.rotation_euler = (Vector(target) - camera.location).to_track_quat('-Z', 'Y').to_euler()
    camera_data.ortho_scale = scale
    review.render.filepath = os.path.join(REVIEW_OUT, label + '.png')
    bpy.ops.render.render(write_still=True)

for ob in review_col.objects:ob.hide_render=False
roundtrip = bpy.data.scenes.new('Landmark_RoundTrip')
bpy.context.window.scene = roundtrip
report['roundtrip'] = {}
for family in FAMILIES:
    for lod in (0, 1):
        bpy.ops.object.select_all(action='DESELECT')
        bpy.ops.import_scene.gltf(filepath=os.path.join(
            OUT, 'ENV_Landmark_' + family + '_LOD' + str(lod) + '.glb'))
        imported = [ob for ob in bpy.context.selected_objects if ob.type == 'MESH']
        triangles = sum(len(ob.data.polygons) for ob in imported)
        expected = report[family]['LOD' + str(lod) + '_stage6']['triangles']
        if triangles != expected:
            raise RuntimeError(f'{family} LOD{lod} round-trip {triangles} != {expected}')
        report['roundtrip'][family + '_LOD' + str(lod)] = triangles
with open(REPORT, 'w') as handle:
    json.dump(report, handle, indent=2)
bpy.context.window.scene = review
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'landmarks.blend'))
print('LANDMARK_EXPORT', json.dumps(report), 'parts', len(runtime['parts']))
