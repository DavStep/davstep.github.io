"""Author the castle-mount masonry kit through Blender MCP.

Only CastleMount_* scenes are owned. Existing scenes and the current .blend
remain intact. Runtime is Y-up; authoring is Z-up with front toward -Y.
"""
import bpy, bmesh, json, math, os
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
OUT = os.path.join(ROOT, 'art/blender')
REVIEW = os.path.join(ROOT, 'art/reviews/castle-mount')
os.makedirs(REVIEW, exist_ok=True)
for old in list(bpy.data.scenes):
    if old.name.startswith('CastleMount_'):
        objects = list(old.objects)
        bpy.data.scenes.remove(old)
        bpy.data.batch_remove(ids=[o for o in objects if not o.users_scene])

scene = bpy.data.scenes.new('CastleMount_Library')
bpy.context.window.scene = scene
COLORS = {'stone':'a7a195', 'stoneDark':'777b78', 'earth':'8b7660', 'iron':'576a72', 'woodDark':'674d3d'}
materials = {}
def linear(v):
    return v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4
for name, value in COLORS.items():
    color = tuple(linear(int(value[i:i+2],16)/255) for i in (0,2,4))
    mat = bpy.data.materials.new('MAT_CastleMount_' + name)
    mat.use_nodes = True
    shader = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    shader.inputs['Base Color'].default_value = (*color,1)
    shader.inputs['Roughness'].default_value = .93
    mat.diffuse_color = (*color,1)
    materials[name] = mat

parts = []
def mesh(name, vertices, faces, material, family, lod):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    bm = bmesh.new(); bm.from_mesh(data)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bmesh.ops.triangulate(bm, faces=list(bm.faces))
    bm.to_mesh(data); bm.free(); data.update()
    obj = bpy.data.objects.new('ENV_CastleMount_' + name + '_LOD' + str(lod), data)
    scene.collection.objects.link(obj)
    data.materials.append(materials[material])
    obj['family'] = family; obj['lod'] = lod; obj['runtimeMaterial'] = material
    parts.append(obj)
    return obj

def block(name, x, y, z, w, d, h, material, family, lod):
    v = [(x+a*w/2,y+b*d/2,z+c*h/2) for a,b,c in
         [(-1,-1,-1),(-1,-1,1),(-1,1,-1),(-1,1,1),(1,-1,-1),(1,-1,1),(1,1,-1),(1,1,1)]]
    return mesh(name,v,[(0,4,6,2),(1,3,7,5),(0,1,5,4),(2,6,7,3),(0,2,3,1),(4,5,7,6)],material,family,lod)

for lod in (0,1):
    # Tapered masonry apron, a distinct cap, and sparse staggered ashlar.
    f = 'retaining'
    mesh('tapered_apron',[(-2,-.6,0),(2,-.6,0),(2,.65,0),(-2,.65,0),(-2,-.32,2),(2,-.32,2),(2,.5,2),(-2,.5,2)],
         [(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7),(4,5,6,7),(3,2,1,0)],'stoneDark',f,lod)
    block('coping',0,-.03,2.05,4.13,1.02,.28,'stone',f,lod)
    for row in range(3 if lod==0 else 2):
        for col in range(4 if lod==0 else 2):
            width = .88 if lod==0 else 1.7
            x = -1.5 + col if lod==0 else -1 + col*2
            z = .38 + row*.59 if lod==0 else .55+row*.8
            block('ashlar',x+(.1 if row%2 else -.06),-.6+z*.14-.04,z,width,.12,.44 if lod==0 else .56,'stone',f,lod)
    f = 'buttress'
    mesh('sloping_buttress',[(-.48,-1.7,0),(.48,-1.7,0),(.48,.4,0),(-.48,.4,0),(-.32,-.28,3.2),(.32,-.28,3.2),(.32,.35,3.2),(-.32,.35,3.2)],
         [(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7),(4,5,6,7),(3,2,1,0)],'stone',f,lod)
    block('buttress_cap',0,.02,3.27,.92,.92,.24,'stoneDark',f,lod)
    f = 'quarry'
    # An exposed terraced face: faces are deliberately faceted, never smoothed.
    mesh('cut_face',[(-4,-1.8,0),(4,-1.8,0),(4,1.5,0),(-4,1.5,0),(-3.5,-.7,3),(3.5,-.7,3),(3.2,1.8,4.7),(-3.7,1.8,4.3)],
         [(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7),(4,5,6,7),(3,2,1,0)],'earth',f,lod)
    for row in range(3):
        block('stone_seam',-.15+row*.13,-1.22+row*.4,.55+row*.94,6.4-row*.6,.32,.26,'stone',f,lod)
    for j in range(5 if lod==0 else 3):
        block('cut_block',-2.1+j*.95,-2.3+(j%2)*.5,.32,.74,.65,.64,'stone',f,lod)
    for side in (-1,1): block('spur_rail',side*.55,-3.8,.15,.11,3.3,.17,'iron',f,lod)
    f = 'cistern'
    n=24 if lod==0 else 12
    for j in range(n):
        a=math.tau*j/n; b=math.tau*(j+1)/n
        v=[(math.cos(t)*r,math.sin(t)*r,z) for z in (0,1.45) for r in (2.1,2.5) for t in (a,b)]
        mesh('basin_segment',v,[(0,1,5,4),(2,6,7,3),(4,5,7,6),(0,2,3,1),(0,4,6,2),(1,3,7,5)],'stone',f,lod)
    block('sluice_post',2.4,0,1.05,.4,.4,2.1,'woodDark',f,lod)
    block('sluice_arm',2.4,0,2.15,.25,1.1,.23,'iron',f,lod)

output=[]
for obj in parts:
    data=obj.data; data.calc_loop_triangles()
    positions=[]; normals=[]
    for tri in data.loop_triangles:
        n=tri.normal
        for vi in tri.vertices:
            p=data.vertices[vi].co
            positions.extend([round(p.x,5),round(p.z,5),round(-p.y,5)])
            normals.extend([round(n.x,5),round(n.z,5),round(-n.y,5)])
    output.append({'name':obj.name,'family':obj['family'],'lod':obj['lod'],'material':obj['runtimeMaterial'],
                   'positions':positions,'normals':normals})
with open(ROOT+'/src/town/generated/castle-mount.json','w') as stream:
    json.dump({'version':1,'coordinates':'three-y-up','parts':output},stream,separators=(',',':'))

# Export each LOD without disturbing the resident scene or its saved filepath.
for lod in (0,1):
    for obj in scene.objects: obj.select_set(obj['lod']==lod)
    bpy.context.view_layer.objects.active=next(o for o in parts if o['lod']==lod)
    # The registered exporter defaults to its binary format; its dynamic
    # format enum is not exposed through this Blender version's RNA.
    export_path=OUT+'/ENV_CastleMount_Kit_LOD'+str(lod)+'.glb'
    bpy.ops.export_scene.gltf(filepath=export_path,use_selection=True)
    with open(export_path,'rb') as check: assert check.read(4)==b'glTF'
bpy.data.libraries.write(OUT+'/castle-mount.blend',{scene},fake_user=True)

# Arrange a separate preview scene with linked source meshes.
preview=bpy.data.scenes.new('CastleMount_Preview');bpy.context.window.scene=preview
for obj in parts:
    if obj['lod']!=0:continue
    copy=obj.copy();preview.collection.objects.link(copy)
    copy.location.x={'retaining':-8,'buttress':-2,'quarry':7,'cistern':0}[obj['family']]
    copy.location.y=8 if obj['family']=='cistern' else 0
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':
        area.spaces.active.region_3d.view_location=Vector((0,1,1))
        area.spaces.active.region_3d.view_distance=28
        area.spaces.active.overlay.show_overlays=False
        area.spaces.active.shading.type=next(i.identifier for i in area.spaces.active.shading.bl_rna.properties['type'].enum_items if i.identifier=='MATERIAL')
report={str(lod):{family:sum(len(p['positions'])//9 for p in output if p['lod']==lod and p['family']==family)
                  for family in ('retaining','buttress','quarry','cistern')} for lod in (0,1)}
with open(REVIEW+'/geometry-report.json','w') as stream:json.dump(report,stream,indent=2)
print('CASTLE_MOUNT_READY',json.dumps(report))
