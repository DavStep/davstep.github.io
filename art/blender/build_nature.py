"""Build the reference-led town vegetation and rock kit in connected Blender.

Run with: uvx --from mcp-for-blender python scripts/blender-mcp-run.py art/blender/build_nature.py
Only Nature_* scenes are replaced. The user's other Blender scenes remain intact.
"""
import bpy
import bmesh
import json
import math
import os
import random
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
OUT = os.path.join(ROOT, 'art', 'blender')
GENERATED = os.path.join(ROOT, 'src', 'town', 'generated', 'nature.json')
REPORT = os.path.join(ROOT, 'art', 'reviews', 'nature', 'triangle-report.json')
os.makedirs(os.path.dirname(GENERATED), exist_ok=True)
os.makedirs(os.path.dirname(REPORT), exist_ok=True)

for old in list(bpy.data.scenes):
    if old.name.startswith(('Nature_Library', 'Nature_Review', 'Nature_RoundTrip')):
        owned = list(old.objects)
        bpy.data.scenes.remove(old)
        for obj in owned:
            if not obj.users_scene:
                bpy.data.objects.remove(obj, do_unlink=True)
for old in list(bpy.data.materials):
    if old.name.startswith('MAT_Nature_') and old.users == 0:
        bpy.data.materials.remove(old)


def linear(v):
    return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4


def rgb(h):
    return tuple(linear(int(h[i:i + 2], 16) / 255) for i in (0, 2, 4))


PALETTE = {
    'bark': ['513b2d', '674d3d', '75573e'],
    'pine': ['344d3a', '496743', '617e49', '7e9250', '96a25b'],
    'shrub': ['435f47', '58774c', '749057', '96a567'],
    'stone': ['777b78', '969893', 'b2afa3', 'c5bca7'],
}
MATERIAL_COLORS = {'woodDark': 'ffffff', 'pine': 'ffffff',
                   'foliage': 'ffffff', 'stone': 'ffffff'}
mats = {}
for key, h in MATERIAL_COLORS.items():
    mat = bpy.data.materials.new('MAT_Nature_' + key)
    mat.diffuse_color = (*rgb(h), 1)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = mat.diffuse_color
    bsdf.inputs['Roughness'].default_value = 0.96
    color_node = mat.node_tree.nodes.new('ShaderNodeVertexColor')
    color_node.layer_name = 'Color'
    mat.node_tree.links.new(color_node.outputs['Color'], bsdf.inputs['Base Color'])
    mat['runtime'] = key
    mats[key] = mat

library = bpy.data.scenes.new('Nature_Library')
bpy.context.window.scene = library
library.unit_settings.system = 'METRIC'
parts = []
collections = {}


def collection_for(family, lod):
    name = 'ENV_' + family + '_LOD' + str(lod)
    col = bpy.data.collections.new(name)
    library.collection.children.link(col)
    collections[(family, lod)] = col
    return col


def add_mesh(family, lod, role, vertices, faces, colors, material):
    name = 'ENV_' + family + '_LOD' + str(lod) + '_' + role
    me = bpy.data.meshes.new(name)
    me.from_pydata(vertices, [], faces)
    me.update()
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(me)
    bm.free()
    if colors:
        attr = me.color_attributes.new(name='Color', type='FLOAT_COLOR', domain='CORNER')
        for polygon in me.polygons:
            for loop_index in polygon.loop_indices:
                attr.data[loop_index].color = (*colors[me.loops[loop_index].vertex_index], 1)
        me.color_attributes.active_color = attr
    obj = bpy.data.objects.new(name, me)
    col = collections.get((family, lod)) or collection_for(family, lod)
    col.objects.link(obj)
    me.materials.append(mats[material])
    obj['runtime_material'] = material
    obj['role'] = role
    parts.append((family, lod, obj))
    return obj


def mesh_data():
    return [], [], []


def append_shell(v, f, c, rings, tip, color_rows, cap=True):
    """Faceted staggered bough or bush lobe; ring vertices are CCW from above."""
    n = len(rings[0])
    start = len(v)
    for ring, shade in zip(rings, color_rows):
        for i, p in enumerate(ring):
            v.append(p)
            c.append(rgb(shade[i % len(shade)]))
    for row in range(len(rings) - 1):
        for i in range(n):
            j = (i + 1) % n
            a = start + row * n + i
            b = start + row * n + j
            d = start + (row + 1) * n + i
            e = start + (row + 1) * n + j
            f.extend(((a, b, e), (a, e, d)))
    ti = len(v)
    v.append(tip)
    c.append(rgb(color_rows[-1][0]))
    for i in range(n):
        f.append((start + (len(rings) - 1) * n + i,
                  start + (len(rings) - 1) * n + (i + 1) % n, ti))
    if cap:
        ci = len(v)
        v.append((sum(p[0] for p in rings[0]) / n,
                  sum(p[1] for p in rings[0]) / n,
                  sum(p[2] for p in rings[0]) / n + .015))
        c.append(rgb(color_rows[0][0]))
        for i in range(n):
            f.append((ci, start + (i + 1) % n, start + i))


PINES = {
    'Pine_A': (5, [.50, .45, .34, .25, .16], [.215, .355, .515, .685, .835], 17),
    'Pine_B': (6, [.47, .42, .38, .29, .21, .12], [.205, .335, .47, .605, .735, .855], 41),
    'Pine_C': (5, [.46, .39, .36, .27, .17], [.23, .385, .535, .69, .845], 73),
}


def make_pine(family, lod):
    tiers, radii, heights, seed = PINES[family]
    n = 11 if lod == 0 else 7
    if lod == 1:
        chosen = [0, 1, 2, tiers - 1] if tiers == 5 else [0, 1, 3, tiers - 1]
    else:
        chosen = list(range(tiers))
    v, f, c = mesh_data()
    for ordinal, t in enumerate(chosen):
        r = radii[t]
        z = heights[t]
        phase = .38 * t + seed * .071
        shift_x = .028 * math.sin(seed + t * 2.2)
        shift_y = .027 * math.cos(seed * .3 + t * 1.7)
        # Alternating long bough tips and deep gaps give a broken, non-conical skirt.
        skirt, shoulder = [], []
        notch = (seed + t * 3) % n
        for i in range(n):
            a = math.tau * i / n + phase
            wave = 1 + .15 * math.sin(2.8 * a + seed) + .075 * math.cos(5 * a - t)
            cut = .67 if i == notch else .77 if i == (notch + 4) % n else 1
            rr = r * wave * cut
            edge_z = z + (.018 if i % 3 == 0 else -.016 if i % 4 == 1 else 0)
            skirt.append((shift_x + rr * math.cos(a), shift_y + rr * math.sin(a), edge_z))
            shoulder.append((shift_x + rr * .38 * math.cos(a + .05),
                             shift_y + rr * .38 * math.sin(a + .05), z + .115 + .014 * math.sin(a * 3)))
        apex_z = min(1, z + (.225 if ordinal < len(chosen) - 1 else .165))
        tip = (shift_x + .027 * math.sin(t * 3.1), shift_y + .022 * math.cos(t * 2.4), apex_z)
        shades = PALETTE['pine']
        skirt_shades = [shades[(i + t + 0) % 2] for i in range(n)]
        shoulder_shades = [shades[2 + (i + t) % 3] for i in range(n)]
        append_shell(v, f, c, [skirt, shoulder] if lod == 0 else [skirt],
                     tip, [skirt_shades, shoulder_shades] if lod == 0 else [shoulder_shades])
    # A single thin leader completes the silhouette without a repeated cone cap.
    add_mesh(family, lod, 'canopy', v, f, c, 'pine')

    v, f, c = mesh_data()
    sides = 7 if lod == 0 else 5
    for level, (radius, z) in enumerate(((.055, 0), (.044, .18), (.026, .58), (.012, .96))):
        for i in range(sides):
            angle = math.tau * i / sides + .11 * level
            v.append((radius * math.cos(angle), radius * math.sin(angle), z))
            c.append(rgb(PALETTE['bark'][(i + level) % 3]))
    for level in range(3):
        for i in range(sides):
            a = level * sides + i
            b = level * sides + (i + 1) % sides
            d = (level + 1) * sides + i
            e = (level + 1) * sides + (i + 1) % sides
            f.extend(((a, b, e), (a, e, d)))
    f.append(tuple(range(sides - 1, -1, -1)))
    f.append(tuple(3 * sides + i for i in range(sides)))
    add_mesh(family, lod, 'trunk', v, f, c, 'woodDark')


def make_shrub(family, lod):
    v, f, c = mesh_data()
    if family == 'Shrub_A':
        lobes = [(-.21, -.06, .26, .43), (.13, -.14, .29, .61),
                 (.29, .16, .21, .42), (-.19, .25, .24, .49), (.015, .08, .31, .72)]
    else:
        lobes = [(-.3, -.08, .19, .46), (-.09, .21, .2, .68),
                 (.22, .14, .24, .84), (.34, -.15, .17, .52), (-.07, -.2, .23, .61)]
    if lod == 1:
        lobes = [lobes[i] for i in (0, 2, 4)]
    n = 5
    for li, (cx, cy, radius, tall) in enumerate(lobes):
        low, shoulder = [], []
        for i in range(n):
            a = math.tau * i / n + li * .37
            r = radius * (1 + .17 * math.sin(i * 2.7 + li))
            low.append((cx + r * math.cos(a), cy + r * math.sin(a), 0))
            shoulder.append((cx + r * .68 * math.cos(a), cy + r * .68 * math.sin(a), tall * .6))
        tip = (cx + .035 * math.sin(li * 2), cy + .025 * math.cos(li * 3), tall)
        shades = PALETTE['shrub']
        colors = [[shades[(i + li) % 2] for i in range(n)],
                  [shades[1 + (i + li) % 3] for i in range(n)]]
        append_shell(v, f, c, [low, shoulder] if lod == 0 else [low], tip,
                     colors if lod == 0 else [colors[1]])
    # Height normalization and a level root make both families interchangeable.
    peak = max(p[2] for p in v)
    v = [(x, y, z / peak) for x, y, z in v]
    add_mesh(family, lod, 'shrub', v, f, c, 'foliage')


ROCKS = {
    'Rock_A': (1.25, .90, 10),
    'Rock_B': (.85, 1.05, 29),
    'Rock_C': (1.42, 1.08, 53),
    'Rock_Path': (1.00, .92, 79),
}


def make_rock(family, lod):
    rx, ry, seed = ROCKS[family]
    rng = random.Random(seed)
    n = 8 if lod == 0 else 5
    v, f, c = mesh_data()
    radii = [(.86, 0), (1, .13), (.84, .74)] if lod == 0 else [(1, 0), (.80, .78)]
    jitter = [rng.uniform(.84, 1.1) for _ in range(n)]
    for ri, (scale, height) in enumerate(radii):
        for i in range(n):
            angle = math.tau * i / n + .18
            z = height if ri == 0 else height + .07 * math.sin(3 * angle + seed)
            if family == 'Rock_Path' and ri > 0:
                z = height + .025 * math.sin(3 * angle + seed)
            v.append((rx * scale * jitter[i] * math.cos(angle) / 2,
                      ry * scale * jitter[i] * math.sin(angle) / 2,
                      max(0, z)))
            c.append(rgb(PALETTE['stone'][(i + ri + seed) % 4]))
    for row in range(len(radii) - 1):
        for i in range(n):
            a = row * n + i
            b = row * n + (i + 1) % n
            d = (row + 1) * n + i
            e = (row + 1) * n + (i + 1) % n
            f.extend(((a, b, e), (a, e, d)))
    f.append(tuple(range(n - 1, -1, -1)))
    tip = len(v)
    v.append((.07 if family == 'Rock_B' else -.035,
              .04 if family == 'Rock_C' else 0, 1))
    c.append(rgb(PALETTE['stone'][2]))
    last = (len(radii) - 1) * n
    for i in range(n):
        f.append((last + i, last + (i + 1) % n, tip))
    add_mesh(family, lod, 'rock', v, f, c, 'stone')


for family in PINES:
    for lod in (0, 1):
        make_pine(family, lod)
for family in ('Shrub_A', 'Shrub_B'):
    for lod in (0, 1):
        make_shrub(family, lod)
for family in ROCKS:
    for lod in (0, 1):
        make_rock(family, lod)


def export_part(family, lod, obj):
    me = obj.data
    me.calc_loop_triangles()
    attr = me.color_attributes.active_color
    positions, normals, colors, indices = [], [], [], []
    lookup = {}
    for tri in me.loop_triangles:
        for li in tri.loops:
            vi = me.loops[li].vertex_index
            p = me.vertices[vi].co
            normal = tri.normal
            color = tuple(attr.data[li].color[:3]) if attr else (1, 1, 1)
            ps = (p.x, p.z, -p.y)
            ns = (normal.x, normal.z, -normal.y)
            key = tuple(round(x, 6) for x in (*ps, *ns, *color))
            if key not in lookup:
                lookup[key] = len(positions) // 3
                positions.extend(round(x, 6) for x in ps)
                normals.extend(round(x, 6) for x in ns)
                colors.extend(round(x, 6) for x in color)
            indices.append(lookup[key])
    return dict(name=obj.name, family=family, lod=lod, role=obj['role'],
                material=obj['runtime_material'], positions=positions,
                normals=normals, indices=indices, colors=colors)


payload = {'version': 1, 'coordinates': 'three-y-up',
           'parts': [export_part(family, lod, obj) for family, lod, obj in parts]}
with open(GENERATED + '.tmp', 'w') as handle:
    json.dump(payload, handle, separators=(',', ':'))
os.replace(GENERATED + '.tmp', GENERATED)

report = {}
for family in (*PINES, 'Shrub_A', 'Shrub_B', *ROCKS):
    report[family] = {}
    for lod in (0, 1):
        subset = [p for p in payload['parts'] if p['family'] == family and p['lod'] == lod]
        points = [p['positions'][i:i + 3] for p in subset for i in range(0, len(p['positions']), 3)]
        report[family]['LOD' + str(lod)] = {
            'triangles': sum(len(p['indices']) // 3 for p in subset),
            'bounds': [[round(min(pt[axis] for pt in points), 4) for axis in range(3)],
                       [round(max(pt[axis] for pt in points), 4) for axis in range(3)]],
        }
with open(REPORT, 'w') as handle:
    json.dump(report, handle, indent=2)

# Export the exact authored family collections; no review cameras or set dressing.
for (family, lod), col in collections.items():
    bpy.ops.object.select_all(action='DESELECT')
    for obj in col.objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = next(iter(col.objects))
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'ENV_' + family + '_LOD' + str(lod) + '.glb'),
                              use_selection=True, use_active_scene=True, export_format='GLB',
                              export_yup=True, export_cameras=False, export_lights=False)

# Cottage cluster comparison, copied into a distinct review scene and excluded from exports.
review = bpy.data.scenes.new('Nature_Review')
bpy.context.window.scene = review
review_col = bpy.data.collections.new('Nature_Review_Assembly')
review.collection.children.link(review_col)
source = bpy.data.scenes.get('Cottage_Review')
if source is None and os.path.exists(os.path.join(OUT, 'cottages.blend')):
    with bpy.data.libraries.load(os.path.join(OUT, 'cottages.blend'), link=False) as (data_from, data_to):
        data_to.scenes = ['Cottage_Review'] if 'Cottage_Review' in data_from.scenes else []
    source = data_to.scenes[0] if data_to.scenes else None
if source:
    for obj in source.objects:
        if obj.type == 'MESH' and not obj.name.startswith('Review_Pine'):
            copy = obj.copy()
            copy.data = obj.data
            review_col.objects.link(copy)
for family, x, y, height, width in (('Pine_A', -7, -4, 5.7, 3.65),
                                     ('Pine_B', 5.8, -3.4, 7.15, 4.2),
                                     ('Pine_C', -1.8, 5.8, 4.5, 3.1)):
    parent = bpy.data.objects.new('Review_' + family, None)
    review_col.objects.link(parent)
    parent.location = (x, y, 0)
    parent.scale = (width, width, height)
    for src in collections[(family, 0)].objects:
        copy = src.copy()
        copy.data = src.data
        review_col.objects.link(copy)
        copy.parent = parent
for i, family in enumerate(('Shrub_A', 'Shrub_B', 'Rock_A', 'Rock_B', 'Rock_C', 'Rock_Path')):
    src = next(iter(collections[(family, 0)].objects))
    copy = src.copy()
    copy.data = src.data
    review_col.objects.link(copy)
    copy.location = (-5 + i * 1.7, -6.6, 0)
    copy.scale = (1.15, 1.15, .48 if family.startswith('Rock') else .8)

# Inspection camera and light are kept only in the review scene.
ground_me = bpy.data.meshes.new('Review_Earth')
ground_me.from_pydata([(-17, -15, -.12), (17, -15, -.12),
                       (17, 15, -.12), (-17, 15, -.12)], [], [(0, 1, 2, 3)])
ground_ob = bpy.data.objects.new('Review_Earth', ground_me)
review_col.objects.link(ground_ob)
ground_mat = bpy.data.materials.new('MAT_Nature_Review_Earth')
ground_mat.diffuse_color = (*rgb('9f794d'), 1)
ground_mat.use_nodes = True
ground_mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value = ground_mat.diffuse_color
ground_me.materials.append(ground_mat)
camera_data = bpy.data.cameras.new('Nature_Review_Camera')
camera = bpy.data.objects.new('Nature_Review_Camera', camera_data)
review_col.objects.link(camera)
camera_data.type = 'ORTHO'
camera_data.ortho_scale = 25
review.camera = camera
sun_data = bpy.data.lights.new('Nature_Review_Sun', 'SUN')
sun = bpy.data.objects.new('Nature_Review_Sun', sun_data)
review_col.objects.link(sun)
sun.rotation_euler = (.45, -.4, -.7)
sun_data.energy = 2.2
world = bpy.data.worlds.new('Nature_Review_World')
world.use_nodes = True
world.node_tree.nodes.get('Background').inputs['Color'].default_value = (.62, .69, .76, 1)
world.node_tree.nodes.get('Background').inputs['Strength'].default_value = .7
review.world = world
review.render.engine = 'BLENDER_EEVEE'
review.render.resolution_x = 1280
review.render.resolution_y = 720
review.render.resolution_percentage = 100
review.render.image_settings.file_format = 'PNG'

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'nature.blend'))
for label, location, target in (
    ('three-quarter', (15, -21, 15), (0, 0, 2.2)),
    ('front', (0, -23, 10), (0, 0, 2.1)),
    ('side', (23, 0, 11), (0, 0, 2.1)),
):
    camera.location = location
    camera.rotation_euler = (Vector(target) - camera.location).to_track_quat('-Z', 'Y').to_euler()
    review.render.filepath = os.path.join(ROOT, 'art', 'reviews', 'nature', 'nature-' + label + '.png')
    bpy.ops.render.render(write_still=True)

# Verify exported glTF imports cleanly, in its own scene, without modifying the library.
roundtrip = bpy.data.scenes.new('Nature_RoundTrip')
bpy.context.window.scene = roundtrip
roundtrip_report = {}
for family, lod in (('Pine_A', 0), ('Rock_Path', 1)):
    bpy.ops.object.select_all(action='DESELECT')
    path = os.path.join(OUT, 'ENV_' + family + '_LOD' + str(lod) + '.glb')
    bpy.ops.import_scene.gltf(filepath=path)
    imported = [obj for obj in bpy.context.selected_objects if obj.type == 'MESH']
    tris = sum(len(obj.data.polygons) for obj in imported)
    expected = report[family]['LOD' + str(lod)]['triangles']
    if tris != expected:
        raise RuntimeError('GLB round-trip triangle mismatch for ' + family + ': ' + str(tris) + ' != ' + str(expected))
    roundtrip_report[family + '_LOD' + str(lod)] = {'triangles': tris, 'meshes': len(imported)}
report['roundtrip'] = roundtrip_report
with open(REPORT, 'w') as handle:
    json.dump(report, handle, indent=2)
bpy.context.window.scene = review
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'nature.blend'))
print('NATURE_EXPORT', json.dumps(report), 'parts', len(payload['parts']))
