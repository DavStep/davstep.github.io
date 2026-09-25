"""Small articulated wildlife and a shallow-draft merchant boat, authored in Blender.
All coordinates below are runtime X/Y-up/Z. Only LivingWorld_* scenes are owned.
"""
import bpy,bmesh,math,json,os
from mathutils import Vector,Matrix
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'))
OUT=ROOT+'/art/blender';REVIEW=ROOT+'/art/reviews/living-world';os.makedirs(REVIEW,exist_ok=True)
for old in list(bpy.data.scenes):
    if old.name.startswith('LivingWorld_'):
        owned=list(old.objects);bpy.data.scenes.remove(old)
        bpy.data.batch_remove(ids=[o for o in owned if not o.users_scene])
scene=bpy.data.scenes.new('LivingWorld_Library');bpy.context.window.scene=scene
colors={'fur':'b98b60','wool':'efe5c9','dark':'514737','ivory':'f6edce','wood':'946345','blue':'668db0','gold':'f2ca63'}
mats={}
def linear(v):return v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4
for name,color in colors.items():
    m=bpy.data.materials.new('MAT_LivingWorld_'+name);m.use_nodes=True
    c=tuple(linear(int(color[i:i+2],16)/255) for i in (0,2,4))
    shader=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED');shader.inputs['Base Color'].default_value=(*c,1);shader.inputs['Roughness'].default_value=.88
    m.diffuse_color=(*c,1);mats[name]=m
parts=[];family='';lod=0
pivots={'body':(0,0,0),'head':(.78,1.18,0),'wingL':(0,.35,-.13),'wingR':(0,.35,.13),
        'legFL':(.66,.85,-.34),'legFR':(.66,.85,.34),'legBL':(-.65,.85,-.34),'legBR':(-.65,.85,.34)}
def obj(name,bm,material,role='body'):
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bmesh.ops.triangulate(bm,faces=list(bm.faces))
    # Rotate authoring coordinates to Blender Z-up, preserving right-handed winding.
    transform=Matrix(((1,0,0,0),(0,0,-1,0),(0,1,0,0),(0,0,0,1)))
    bmesh.ops.transform(bm,matrix=transform,verts=list(bm.verts))
    me=bpy.data.meshes.new(name);bm.to_mesh(me);bm.free();me.update()
    o=bpy.data.objects.new('LivingWorld_'+family+'_'+name+'_LOD'+str(lod),me);scene.collection.objects.link(o);me.materials.append(mats[material]);
    o['family']=family;o['lod']=lod;o['materialKey']=material;o['role']=role;parts.append(o);return o

def ball(name,p,scale,mat,role='body',detail=1):
    bm=bmesh.new();bmesh.ops.create_icosphere(bm,subdivisions=detail,radius=1)
    for v in bm.verts:v.co=Vector((v.co.x*scale[0]+p[0],v.co.y*scale[1]+p[1],v.co.z*scale[2]+p[2]))
    return obj(name,bm,mat,role)
def box(name,p,s,mat,role='body'):
    bm=bmesh.new();bmesh.ops.create_cube(bm,size=1)
    for v in bm.verts:v.co=Vector((v.co.x*s[0]+p[0],v.co.y*s[1]+p[1],v.co.z*s[2]+p[2]))
    return obj(name,bm,mat,role)
def beam(name,a,b,r,mat,role='body'):
    a,b=Vector(a),Vector(b);bm=bmesh.new()
    bmesh.ops.create_cone(bm,cap_ends=True,cap_tris=True,segments=6 if lod==0 else 4,radius1=r,radius2=r*.85,depth=(b-a).length)
    rot=(b-a).to_track_quat('Z','Y').to_matrix()
    for v in bm.verts:v.co=rot@v.co+(a+b)*.5
    return obj(name,bm,mat,role)
def poly(name,verts,faces,mat,role='body'):
    bm=bmesh.new();vs=[bm.verts.new(v) for v in verts]
    for face in faces:bm.faces.new([vs[i] for i in face])
    return obj(name,bm,mat,role)

for lod in (0,1):
    for family in ('sheep','deer'):
        sheep=family=='sheep';mat='wool' if sheep else 'fur'
        ball('body',(0,1.14,0),(1.0,.58,.51),mat,detail=2 if lod==0 else 1)
        if sheep:
            for i in range(6 if lod==0 else 3):
                a=i*math.tau/(6 if lod==0 else 3)
                ball('fleece',(.55*math.cos(a),1.5,.28*math.sin(a)),(.42,.29,.36),'wool')
            ball('face',(1.04,1.24,0),(.46,.31,.29),'dark','head')
            for side in (-1,1):ball('ear',(1.02,1.49,side*.33),(.25,.09,.18),'dark','head')
        else:
            beam('neck',(.65,1.23,0),(1.02,2.04,0),.25,'fur','head')
            ball('face',(1.2,2.08,0),(.48,.28,.25),'fur','head')
            ball('muzzle',(1.51,2.01,0),(.18,.14,.19),'dark','head')
            for side in (-1,1):
                ball('ear',(.93,2.38,side*.29),(.17,.31,.1),'fur','head')
                beam('antler',(.98,2.26,side*.16),(.7,2.99,side*.45),.055,'ivory','head')
                beam('antler_fork',(.8,2.72,side*.34),(1.04,2.94,side*.58),.04,'ivory','head')
        for side in (-1,1):ball('eye',((1.28 if sheep else 1.4),(1.35 if sheep else 2.18),side*(.265 if sheep else .225)),(.048,.06,.025),'ivory' if sheep else 'dark','head')
        for role in ('legFL','legFR','legBL','legBR'):
            x,y,z=pivots[role];beam('leg',(x,.11,z),(x,y,z),.105 if sheep else .078,'dark' if sheep else 'fur',role)
            box('hoof',(x,.1,z),(.2,.2,.19),'dark',role)
        ball('tail',(-1.01,1.2,0),(.24,.17,.15),mat)
    family='bird'
    ball('body',(0,.35,0),(.5,.2,.18),'ivory')
    ball('head',(.38,.42,0),(.2,.18,.16),'ivory')
    poly('beak',[(.48,.39,-.07),(.48,.39,.07),(.7,.36,0),(.48,.49,0)],[(0,1,2),(0,2,3),(1,3,2),(0,3,1)],'gold')
    for side,role in ((-1,'wingL'),(1,'wingR')):
        poly('wing',[(-.2,.35,side*.12),(.25,.35,side*.12),(-.4,.43,side*1.18),(-.65,.39,side*.87),(-.2,.39,side*.12)],[(0,1,2),(0,2,3),(1,4,2),(4,3,2),(0,3,4),(0,4,1)],'blue',role)
    family='boat'
    # V-shaped shallow-draft hull, longitudinal +X, waterline at Y=0.
    poly('hull',[(-3.2,.32,-.82),(-3.2,.32,.82),(2.35,.32,1),(3.5,.48,0),(2.35,.32,-1),(-2.7,-.48,0),(2.3,-.48,0)],[(0,1,5),(1,2,6,5),(2,3,6),(3,4,6),(4,0,5,6)],'wood')
    poly('deck',[(-3.1,.34,-.77),(-3.1,.34,.77),(2.3,.34,.93),(3.25,.47,0),(2.3,.34,-.93)],[(0,1,2,3,4)],'wood')
    for side in (-1,1):beam('gunwale',(-3.2,.42,side*.83),(2.36,.42,side*1),.095,'dark')
    beam('mast',(.4,.35,0),(.4,4.8,0),.1,'wood')
    beam('boom',(-2.05,1.28,0),(.45,1.28,0),.08,'wood')
    # A small thickness keeps the sail visible from both banks.
    poly('sail',[(.29,4.62,-.03),(.29,1.4,-.03),(-1.97,1.4,-.03),(.29,4.62,.03),(.29,1.4,.03),(-1.97,1.4,.03)],[(0,1,2),(3,5,4),(0,3,4,1),(1,4,5,2),(2,5,3,0)],'ivory')
    for x,z in ((-1.8,-.3),(-.9,.2),(-2.6,.22)):
        box('cargo',(x,.7,z),(.62,.65,.65),'blue')
        box('strap',(x,.72,z),(.13,.69,.69),'gold')
    beam('rudder',(-3.3,-.2,0),(-3.3,1.08,0),.14,'dark')

output=[]
for o in parts:
    me=o.data;me.calc_loop_triangles();positions=[];normals=[];pivot=pivots[o['role']]
    for tri in me.loop_triangles:
        n=tri.normal
        for vi in tri.vertices:
            p=me.vertices[vi].co;positions.extend([round(p.x-pivot[0],5),round(p.z-pivot[1],5),round(-p.y-pivot[2],5)])
            normals.extend([round(n.x,5),round(n.z,5),round(-n.y,5)])
    output.append({'family':o['family'],'lod':o['lod'],'role':o['role'],'pivot':pivot,'material':o['materialKey'],'positions':positions,'normals':normals})
with open(ROOT+'/src/town/generated/living-world.json','w') as f:json.dump({'version':1,'colors':colors,'parts':output},f,separators=(',',':'))
for lod in (0,1):
    for o in scene.objects:o.select_set(o['lod']==lod)
    bpy.context.view_layer.objects.active=next(o for o in parts if o['lod']==lod)
    with bpy.context.temp_override(scene=scene,view_layer=scene.view_layers[0]):
        bpy.ops.export_scene.gltf(filepath=OUT+'/ENV_LivingWorld_LOD'+str(lod)+'.glb',use_selection=True,use_active_scene=True)
bpy.data.libraries.write(OUT+'/living-world.blend',{scene},fake_user=True)
preview=bpy.data.scenes.new('LivingWorld_Preview');bpy.context.window.scene=preview
for o in parts:
    if o['lod']==0:
        cp=o.copy();preview.collection.objects.link(cp);cp.location.x={'bird':-6,'sheep':-2,'deer':2,'boat':9}[o['family']]
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':
        area.spaces.active.region_3d.view_location=Vector((3,0,1.5));area.spaces.active.region_3d.view_distance=23
report={str(lod):{family:sum(len(p['positions'])//9 for p in output if p['lod']==lod and p['family']==family) for family in ('bird','sheep','deer','boat')} for lod in (0,1)}
with open(REVIEW+'/geometry-report.json','w') as f:json.dump(report,f,indent=2)
print('LIVING_WORLD_READY',report)
