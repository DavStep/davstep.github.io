"""Author a chunky seven-ear wheat clump and bake its instancing mesh.

Run through scripts/blender-mcp-run.py while Blender MCP is connected. The
generated JSON is consumed directly by GameScenery; the GLB is an art source.
"""
import bpy
import json
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
SCENE_NAME = 'Wheat_Tile_Review'
old = bpy.data.scenes.get(SCENE_NAME)
if old:
    bpy.data.scenes.remove(old)
scene = bpy.data.scenes.new(SCENE_NAME)
bpy.context.window.scene = scene

palette = [
    ('stem', (0.47, 0.34, 0.12, 1), 0.62),
    ('leaf', (0.64, 0.48, 0.16, 1), 0.77),
    ('ear_shadow', (0.73, 0.51, 0.17, 1), 0.82),
    ('ear', (0.94, 0.72, 0.29, 1), 1.0),
]
materials = []
for key, rgba, _ in palette:
    mat = bpy.data.materials.new('Wheat_Tile_' + key)
    mat.diffuse_color = rgba
    mat.use_nodes = True
    shader = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    shader.inputs['Base Color'].default_value = rgba
    shader.inputs['Roughness'].default_value = 0.93
    materials.append(mat)

verts, faces, face_materials = [], [], []

def add(positions, polygons, material):
    start = len(verts)
    verts.extend(positions)
    faces.extend(tuple(start + i for i in face) for face in polygons)
    face_materials.extend([material] * len(polygons))

def box(cx, cy, z0, sx, sy, height, material):
    x0, x1 = cx - sx / 2, cx + sx / 2
    y0, y1 = cy - sy / 2, cy + sy / 2
    z1 = z0 + height
    add([(x0,y0,z0),(x1,y0,z0),(x1,y1,z0),(x0,y1,z0),
         (x0,y0,z1),(x1,y0,z1),(x1,y1,z1),(x0,y1,z1)],
        [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),
         (2,3,7,6),(3,0,4,7)], material)

def ear(cx, cy, z, width, height):
    # Square shoulders and a shallow cap keep each ear readable as a cube.
    rings = [(z, .62), (z + .07, 1.0),
             (z + height - .08, 1.0), (z + height, .60)]
    p = []
    for level, radius in rings:
        r = width * radius / 2
        p.extend([(cx-r,cy-r,level),(cx+r,cy-r,level),
                  (cx+r,cy+r,level),(cx-r,cy+r,level)])
    f = [(3,2,1,0), (12,13,14,15)]
    for ring in range(3):
        for side in range(4):
            a = ring * 4 + side
            b = ring * 4 + (side + 1) % 4
            f.append((a,b,b+4,a+4))
    add(p, f[:6], 2)
    add(p, f[6:], 3)

def leaf(cx, cy, z, dx, dy, length):
    # Two small folded diamonds make the clump recognisably planted wheat.
    p = [(cx,cy,z), (cx + dx*length*.5 - dy*.055,
                     cy + dy*length*.5 + dx*.055, z+.13),
         (cx + dx*length, cy + dy*length, z+.21),
         (cx + dx*length*.5 + dy*.055,
          cy + dy*length*.5 - dx*.055, z+.13)]
    add(p, [(0,1,2),(0,2,3)], 1)

plants = [
    (0.00, 0.00, 1.00, 0.27),
    (-.28,-.25,.88,.25), (.29,-.25,.95,.26),
    (-.32,.13,.80,.24), (.32,.17,.86,.25),
    (-.08,.34,.91,.26), (.10,-.38,.84,.24),
]
for i, (x,y,top,width) in enumerate(plants):
    stem_h = top - .34
    box(x,y,0,.065,.065,stem_h,0)
    ear(x,y,stem_h,width,.34)
    dx = -1 if x < 0 else 1
    dy = -.35 if i % 2 else .35
    leaf(x,y,stem_h*.46,dx,dy,.24)

mesh = bpy.data.meshes.new('Wheat_Tile_Mesh')
mesh.from_pydata(verts, [], faces)
mesh.update()
for material in materials:
    mesh.materials.append(material)
for polygon, index in zip(mesh.polygons, face_materials):
    polygon.material_index = index
object = bpy.data.objects.new('Wheat_Tile_Seven_Ears', mesh)
scene.collection.objects.link(object)

# Export a non-indexed, face-shaded mesh with neutral tonal variation so the
# existing per-instance green-to-gold tint still controls crop growth.
mesh.calc_loop_triangles()
positions, normals, colors = [], [], []
for triangle in mesh.loop_triangles:
    polygon = mesh.polygons[triangle.polygon_index]
    tone = palette[polygon.material_index][2]
    normal = polygon.normal
    for vertex_index in triangle.vertices:
        x,y,z = mesh.vertices[vertex_index].co
        positions.extend((round(x,5),round(z,5),round(-y,5)))
        normals.extend((round(normal.x,5),round(normal.z,5),round(-normal.y,5)))
        colors.extend((tone,tone,tone))
payload = {'positions': positions, 'normals': normals, 'colors': colors,
           'ears': len(plants)}
json_path = os.path.join(ROOT, 'src/town/generated/wheat-tile.json')
with open(json_path, 'w') as output:
    json.dump(payload, output, separators=(',', ':'))

bpy.ops.object.select_all(action='DESELECT')
object.select_set(True)
bpy.context.view_layer.objects.active = object
glb_path = os.path.join(ROOT, 'art/blender/ENV_Wheat_Tile_LOD0.glb')
bpy.ops.export_scene.gltf(filepath=glb_path, export_format='GLB',
                          use_selection=True, use_active_scene=True,
                          export_yup=True)

# Show a small field patch in Blender without including the preview copies in
# the exported runtime mesh.
for ix in range(-2,3):
    for iy in range(-2,3):
        if ix == 0 and iy == 0:
            continue
        copy = bpy.data.objects.new(f'Wheat_Preview_{ix}_{iy}', mesh)
        scene.collection.objects.link(copy)
        copy.location = (ix*.94, iy*.94, 0)
        copy.rotation_euler.z = ((ix*3 + iy*5) % 7) * .14
for area in bpy.context.screen.areas:
    if area.type == 'VIEW_3D':
        area.spaces.active.shading.color_type = 'MATERIAL'
        area.spaces.active.region_3d.view_location = (0,0,.48)
        area.spaces.active.region_3d.view_distance = 8.0
        from mathutils import Euler
        area.spaces.active.region_3d.view_rotation = Euler((1.10,0,.68),'XYZ').to_quaternion()

print(json.dumps({'json':json_path,'glb':glb_path,'ears_per_tile':len(plants),
                  'triangles_per_tile':len(mesh.loop_triangles)}))
