"""Author the mill-stream bridges and terminal pool with Blender MCP.

Runtime coordinates are X/Y-up/Z; the Blender library uses X/Z-up/-Y.
"""
import bpy, json, math, os
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
OUT = os.path.join(ROOT, 'src/town/generated/river-crossings.json')
BLEND = os.path.join(ROOT, 'art/blender/river-crossings.blend')
old = bpy.data.scenes.get('River_Crossings_Library')
if old:
    objects = list(old.objects)
    bpy.data.scenes.remove(old)
    bpy.data.batch_remove(ids=[obj for obj in objects if not obj.users_scene])
scene = bpy.data.scenes.new('River_Crossings_Library')
bpy.context.window.scene = scene

palette = {
    'deck': 'a9764c', 'beam': '603f2d', 'rail': 'bf925e',
    'stone': '8a8776', 'stoneLight': 'b0a68b', 'reed': '79965b',
}
def linear(v): return v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4
materials = {}
for key, color in palette.items():
    mat = bpy.data.materials.new('MAT_River_'+key)
    mat.use_nodes = True
    rgb = tuple(linear(int(color[i:i+2], 16)/255) for i in (0,2,4))
    shader = next(node for node in mat.node_tree.nodes if node.type == 'BSDF_PRINCIPLED')
    shader.inputs['Base Color'].default_value = (*rgb,1)
    shader.inputs['Roughness'].default_value = .88
    mat.diffuse_color = (*rgb,1)
    materials[key] = mat

parts = []
def mesh(family, name, vertices, faces, material, uv=None):
    data = bpy.data.meshes.new(name)
    data.from_pydata([(x,-z,y) for x,y,z in vertices], [], faces)
    data.update()
    obj = bpy.data.objects.new('River_'+family+'_'+name, data)
    scene.collection.objects.link(obj)
    if material in materials: data.materials.append(materials[material])
    obj['family'] = family
    obj['materialKey'] = material
    parts.append((obj,vertices,faces,uv))

def box(family, name, center, size, material):
    x,y,z = center; sx,sy,sz = (v/2 for v in size)
    verts = [(x+a*sx,y+b*sy,z+c*sz) for a,b,c in
             [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),
              (-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
    mesh(family,name,verts,[(0,3,2,1),(4,5,6,7),(0,1,5,4),
                            (3,7,6,2),(0,4,7,3),(1,2,6,5)],material)

def beam(family,name,a,b,width,material):
    direction = Vector(b)-Vector(a)
    length = direction.length
    mid = (Vector(a)+Vector(b))/2
    # Build an oriented square timber in runtime coordinates.
    axis = direction.normalized()
    side = axis.cross(Vector((0,1,0))).normalized()
    if side.length < .1: side = Vector((1,0,0))
    up = side.cross(axis).normalized()
    verts = [tuple(mid + axis*(length*.5*s) + side*(width*.5*t) + up*(width*.5*u))
             for s,t,u in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),
                           (-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
    mesh(family,name,verts,[(0,3,2,1),(4,5,6,7),(0,1,5,4),
                            (3,7,6,2),(0,4,7,3),(1,2,6,5)],material)

# X crosses the stream; Z is the walking width. The shallow camber and
# stone feet let one asset fit each of the three crossings.
for i in range(25):
    x = -6 + i*.5
    crown = 1.08 + .17*(1-(x/6.2)**2)
    box('bridge','plank_%02d'%i,(x,crown,0),(.46,.19,4.15),'deck')
for side in (-1,1):
    z = side*2.03
    beam('bridge','stringer_%s'%side,(-6.3,.92,z),(6.3,.92,z),.27,'beam')
    beam('bridge','toprail_%s'%side,(-5.85,2.22,z),(5.85,2.22,z),.18,'rail')
    beam('bridge','midrail_%s'%side,(-5.85,1.72,z),(5.85,1.72,z),.12,'rail')
    for i,x in enumerate((-5.7,-3.8,-1.9,0,1.9,3.8,5.7)):
        beam('bridge','post_%s_%d'%(side,i),(x,1.05,z),(x,2.43,z),.23,'beam')
    for i,x in enumerate((-4.75,-2.85,-.95,.95,2.85,4.75)):
        beam('bridge','brace_%s_%d'%(side,i),(x-.7,1.15,z),(x+.7,1.7,z),.1,'rail')
for side in (-1,1):
    box('bridge','abutment_%s'%side,(side*6.55,.52,0),(1.15,1.05,4.7),'stone')
    box('bridge','cap_%s'%side,(side*6.55,1.1,0),(1.38,.2,4.8),'stoneLight')

# A rounded still-water head at the mill. The open southeast arc blends into
# the incoming stream; low stones and reeds define the remaining shoreline.
radius = 3.7
segments = 36
water_vertices = [(0,.035,0)] + [(math.cos(i*math.tau/segments)*radius,.035,
                                    math.sin(i*math.tau/segments)*radius)
                                   for i in range(segments)]
water_faces = [(0,1+i,1+(i+1)%segments) for i in range(segments)]
mesh('pool','water',water_vertices,water_faces,'water')
for i in range(22):
    angle = i*math.tau/22
    if abs(math.atan2(math.sin(angle+.96),math.cos(angle+.96))) < .52:
        continue
    x,z = math.cos(angle)*4.05,math.sin(angle)*4.05
    box('pool','bank_stone_%02d'%i,(x,.7,z),(.82,.38,.64),
        'stoneLight' if i%3==0 else 'stone')
for i in range(10):
    angle = i*math.tau/10+.13
    if abs(math.atan2(math.sin(angle+.96),math.cos(angle+.96))) < .6:
        continue
    x,z = math.cos(angle)*4.75,math.sin(angle)*4.75
    beam('pool','reed_%02d'%i,(x,.68,z),(x+.13,1.48+i%3*.16,z-.09),.075,'reed')

export = {'parts': []}
for obj, vertices, faces, uv in parts:
    positions, normals, texcoords = [], [], []
    for face in faces:
        for indices in ((0,1,2),(0,2,3)) if len(face)==4 else ((0,1,2),):
            triangle = [Vector(vertices[face[j]]) for j in indices]
            normal = (triangle[1]-triangle[0]).cross(triangle[2]-triangle[0]).normalized()
            for point in triangle:
                positions.extend(round(float(v),5) for v in point)
                normals.extend(round(float(v),5) for v in normal)
                if obj['materialKey']=='water':
                    texcoords.extend((round(.5+point.x/(radius*2),5),round(.5+point.z/(radius*2),5)))
    part = {'family':obj['family'],'name':obj.name,'material':obj['materialKey'],
            'positions':positions,'normals':normals}
    if texcoords: part['uv'] = texcoords
    export['parts'].append(part)
with open(OUT,'w') as target: json.dump(export,target,separators=(',',':'))
bpy.ops.wm.save_as_mainfile(filepath=BLEND)
print('Exported',len(parts),'river crossing parts to',OUT)
