"""Author bounded structural town props through scripts/blender-mcp-run.py.

Prepare source without touching Blender while another family owns the MCP lock.
Rebuilds only Props_* scenes. Source is Z-up; runtime JSON is Three.js Y-up.
"""
import bpy, bmesh, json, math, os, random
from mathutils import Vector

ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'))
OUT=ROOT+'/art/blender';REV=ROOT+'/art/reviews/props'
os.makedirs(REV,exist_ok=True)
random.seed(208)
for old in list(bpy.data.scenes):
    if old.name.startswith('Props_'):
        owned=list(old.objects);cols=list(old.collection.children)
        bpy.data.scenes.remove(old)
        for obj in owned:
            if not obj.users_scene:bpy.data.objects.remove(obj,do_unlink=True)
        for col in cols:
            if col.users==0:bpy.data.collections.remove(col)
for old in list(bpy.data.materials):
    if old.name.startswith('MAT_Props_') and old.users==0:bpy.data.materials.remove(old)

def linear(v):return v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4
def rgb(h):return tuple(linear(int(h[i:i+2],16)/255) for i in (0,2,4))
COLORS={'wood':'80604b','woodLight':'9b7759','woodDark':'674d3d','iron':'576a72',
        'stone':'a7a195','gold':'e9c06c','lamp':'ffd390','window':'50433d'}
mats={}
for k,h in COLORS.items():
    m=bpy.data.materials.new('MAT_Props_'+k);m.diffuse_color=(*rgb(h),1);m.use_nodes=True
    bsdf=m.node_tree.nodes.get('Principled BSDF');bsdf.inputs['Base Color'].default_value=m.diffuse_color
    bsdf.inputs['Roughness'].default_value=.9 if k!='lamp' else .4
    if k=='lamp':
        if bsdf.inputs.get('Emission Color'):bsdf.inputs['Emission Color'].default_value=(*rgb(h),1)
        if bsdf.inputs.get('Emission Strength'):bsdf.inputs['Emission Strength'].default_value=.45
    m['runtime']=k;mats[k]=m

library=bpy.data.scenes.new('Props_Library');bpy.context.window.scene=library
library.unit_settings.system='METRIC';parts=[];active=None;meta=None
def group(family,lod,role):
    global active,meta
    name=f'ENV_{family}_LOD{lod}_{role}'
    active=bpy.data.collections.new(name);library.collection.children.link(active)
    meta=dict(name=name,family=family,lod=lod,role=role)
    parts.append((active,meta.copy()))
def mesh(name,vs,fs,mat):
    me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);me.update()
    bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free()
    ob=bpy.data.objects.new(name,me);active.objects.link(ob);me.materials.append(mats[mat])
    return ob
def box(name,loc,size,mat):
    x,y,z=loc;a,b,c=[s*.5 for s in size]
    vs=[(x+i*a,y+j*b,z+k*c) for i,j,k in [(-1,-1,-1),(-1,-1,1),(-1,1,-1),(-1,1,1),(1,-1,-1),(1,-1,1),(1,1,-1),(1,1,1)]]
    return mesh(name,vs,[(0,4,6,2),(1,3,7,5),(0,1,5,4),(2,6,7,3),(0,2,3,1),(4,5,7,6)],mat)
def beam(name,p,q,width,depth,mat):
    p=Vector(p);q=Vector(q);v=q-p;n=v.normalized();u=n.cross(Vector((0,1,0)))
    if u.length<.01:u=n.cross(Vector((1,0,0)))
    u.normalize();u*=width/2;t=n.cross(u).normalized()*depth/2
    vs=[tuple(c+i*u+j*t) for c in [p,q] for i,j in [(-1,-1),(1,-1),(1,1),(-1,1)]]
    return mesh(name,vs,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],mat)
def frustum(name,loc,z0,z1,radii,n,mat,axis='Z'):
    # Circular cross-section with optional taper and flat deliberate facets.
    cx,cy=loc;vs=[]
    for z,r in [(z0,radii[0]),(z1,radii[1])]:
        for i in range(n):
            a=math.tau*i/n
            vs.append((cx+math.cos(a)*r,cy+math.sin(a)*r,z))
    fs=[tuple(range(n-1,-1,-1)),tuple(range(n,n*2))]
    fs.extend((i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n))
    return mesh(name,vs,fs,mat)
def ring(name,loc,z0,z1,r,n,mat):
    cx,cy=loc;vs=[]
    for z in [z0,z1]:
        for i in range(n):
            a=math.tau*i/n;vs.append((cx+math.cos(a)*r,cy+math.sin(a)*r,z))
    return mesh(name,vs,[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)],mat)

def fence(lod):
    group('Fence_A',lod,'timber')
    for x,h in [(-1.09,1.08),(1.09,1.15)]:
        box('slightly_uneven_post',(x,0,h*.5),(.18,.18,h),'woodDark')
        if lod==0:
            # Single clipped cap creates a hand-built silhouette.
            vs=[(x-.105,-.105,h),(x+.105,-.105,h),(x+.105,.105,h),(x-.105,.105,h),(x,0,h+.075)]
            mesh('post_cap',vs,[(0,1,4),(1,2,4),(2,3,4),(3,0,4)],'wood')
    for z in [.38,.78]:box('long_rail',(0,.01,z),(2.30,.12,.13),'wood')
    if lod==0:
        for x in [-.73,0,.73]:box('rail_nail',(x,-.08,.78),(.045,.025,.045),'iron')

def barrel(lod):
    n=10 if lod==0 else 8
    group('Barrel_A',lod,'staves')
    # Bulge peaks below the upper rim; closed body and inset top.
    vs=[]
    for z,r in [(0,.30),(.18,.34),(.75,.35),(1.0,.30)]:
        for i in range(n):
            a=math.tau*i/n;vs.append((math.cos(a)*r,math.sin(a)*r,z))
    fs=[tuple(range(n-1,-1,-1))]
    for row in range(3):
        for i in range(n):fs.append((row*n+i,row*n+(i+1)%n,(row+1)*n+(i+1)%n,(row+1)*n+i))
    mesh('coopered_tapered_body',vs,fs,'wood')
    rim=[]
    for r in [.30,.255]:
        for i in range(n):
            a=math.tau*i/n;rim.append((math.cos(a)*r,math.sin(a)*r,1.0))
    mesh('open_top_rim',rim,[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)],'woodDark')
    frustum('inset_top',(0,0),.95,.96,(.26,.26),n,'woodDark')
    if lod==0:
        for i in range(n):
            a=math.tau*i/n
            box('stave_end_joint',(.29*math.cos(a),.29*math.sin(a),.945),(.027,.027,.055),'woodDark')
    group('Barrel_A',lod,'hoops')
    for z,r in [(.17,.344),(.81,.347)]:ring('iron_hoop',(0,0),z,z+.065,r,n,'iron')

def crate(lod):
    group('Crate_A',lod,'timber')
    box('crate_core',(0,0,.425),(.83,.83,.85),'wood')
    # Distinct broad boards, no dense texture or floating labels.
    for z in ([.18,.425,.67] if lod==0 else [.21,.63]):
        box('front_plank',(0,-.423,z),(.84,.035,.22),'woodLight')
        if lod==0:box('side_plank',(.423,0,z),(.035,.84,.22),'woodLight')
    for x in [-.35,.35]:box('front_batten',(x,-.452,.425),(.08,.055,.83),'woodDark')
    if lod==0:beam('diagonal_face_brace',(-.31,-.448,.13),(.31,-.448,.72),.075,.05,'woodDark')
    else:beam('diagonal_face_brace',(-.28,-.448,.16),(.28,-.448,.69),.06,.05,'woodDark')

def lantern(lod):
    group('Lantern_A',lod,'post')
    box('timber_post',(0,0,1.42),(.16,.16,2.84),'woodDark')
    box('post_foot',(0,0,.12),(.31,.31,.24),'stone')
    box('iron_bracket',(0,0,2.77),(.48,.17,.12),'iron')
    if lod==0:
        box('bracket_drop',(.19,0,2.64),(.08,.12,.25),'iron')
    group('Lantern_A',lod,'warm_glass')
    box('warm_glass',(0,0,2.91),(.37,.37,.31),'lamp')
    group('Lantern_A',lod,'iron_frame')
    for z in [2.72,3.06]:box('lantern_cap',(0,0,z),(.52,.52,.08),'iron')
    if lod==0:
        for x in [-.205,.205]:
            for y in [-.205,.205]:box('lantern_corner',(x,y,2.9),(.043,.043,.32),'iron')

def logpile(lod):
    group('Logpile_A',lod,'cut_wood')
    # Bundled logs lie along Y; near cross-sections are visible from the facade.
    positions=[(-.43,.18), (0,.18),(.43,.18),(-.22,.47),(.22,.47)] if lod==0 else [(-.35,.18),(.35,.18),(0,.47)]
    n=7 if lod==0 else 5
    for cx,z in positions:
        vs=[]
        for yy in [-.38,.38]:
            for i in range(n):
                a=math.tau*i/n;vs.append((cx+math.cos(a)*.18,yy,z+math.sin(a)*.18))
        fs=[tuple(range(n)),tuple(range(2*n-1,n-1,-1))]
        fs.extend((i,i+n,(i+1)%n+n,(i+1)%n) for i in range(n))
        mesh('short_log',vs,fs,'woodLight')
    group('Logpile_A',lod,'bindings')
    for x in [-.58,.58]:box('side_stop',(x,0,.29),(.08,.80,.52),'woodDark')

BUILDERS={'Fence_A':fence,'Barrel_A':barrel,'Crate_A':crate,'Lantern_A':lantern,'Logpile_A':logpile}
for lod in [0,1]:
    for builder in BUILDERS.values():builder(lod)

# Merge source submeshes by runtime material within each role.
for col,m in parts:
    groups={}
    for o in list(col.objects):groups.setdefault(o.data.materials[0]['runtime'],[]).append(o)
    for key,objects in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in objects:o.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]
        if len(objects)>1:bpy.ops.object.join()
        o=objects[0] if len(objects)==1 else bpy.context.object
        o.name=m['name']+'_'+key;o['runtime_material']=key
        for k,v in m.items():o[k]=v
        o.select_set(False)

def bake(o):
    me=o.data;me.calc_loop_triangles();positions=[];normals=[];indices=[];lookup={}
    for tri in me.loop_triangles:
        for vi in tri.vertices:
            p=me.vertices[vi].co;n=tri.normal
            ps=tuple(round(v,5) for v in (p.x,p.z,-p.y));ns=tuple(round(v,5) for v in (n.x,n.z,-n.y));key=(ps,ns)
            if key not in lookup:
                lookup[key]=len(positions)//3;positions.extend(ps);normals.extend(ns)
            indices.append(lookup[key])
    return dict(name=o.name,material=o['runtime_material'],positions=positions,normals=normals,indices=indices)
payload=dict(version=1,coordinates='three-y-up',parts=[])
for col,m in parts:
    for o in col.objects:payload['parts'].append({**m,**bake(o)})
path=ROOT+'/src/town/generated/props.json'
with open(path+'.tmp','w') as f:json.dump(payload,f,separators=(',',':'))
os.replace(path+'.tmp',path)
counts={}
bounds={}
for lod in [0,1]:
    for family in BUILDERS:
        selected=[p for p in payload['parts'] if p['lod']==lod and p['family']==family]
        counts[f'{family}_LOD{lod}']=sum(len(p['indices'])//3 for p in selected)
        coords=[v for p in selected for v in p['positions']]
        bounds[f'{family}_LOD{lod}']={
            'min':[min(coords[i::3]) for i in range(3)],
            'max':[max(coords[i::3]) for i in range(3)],
        }
        bpy.ops.object.select_all(action='DESELECT')
        for col,m in parts:
            if m['lod']==lod and m['family']==family:
                for o in col.objects:o.select_set(True)
        bpy.ops.export_scene.gltf(filepath=OUT+f'/ENV_{family}_LOD{lod}.glb',use_selection=True,use_active_scene=True,export_format='GLB',export_yup=True,export_cameras=False,export_lights=False)

review=bpy.data.scenes.new('Props_Review');bpy.context.window.scene=review
active=bpy.data.collections.new('Props_Review_Set');review.collection.children.link(active)
placements={'Fence_A':(-3.4,-2.4),'Barrel_A':(-1.3,-2.8),'Crate_A':(.2,-2.8),
            'Lantern_A':(2.1,-2.4),'Logpile_A':(3.8,-2.8)}
for col,m in parts:
    if m['lod']!=0:continue
    x,y=placements[m['family']]
    for src in col.objects:
        o=src.copy();o.data=src.data;o.location=(x,y,0);active.objects.link(o)
# Include an authentic cottage copy for scale and palette, if the current Blender file holds it.
if bpy.data.scenes.get('Cottage_Library'):
    for o in bpy.data.scenes['Cottage_Library'].objects:
        if o.type=='MESH' and o.get('family')=='A' and o.get('lod')==0 and o.get('minStage',99)<=6<=o.get('maxStage',0):
            copy=o.copy();copy.data=o.data;copy.location=(0,3.2,0);active.objects.link(copy)
box('review_ground',(0,.3,-.18),(14,14,.32),'stone')
world=bpy.data.worlds.new('Props_Studio_Sky');world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(.43,.53,.64,1)
world.node_tree.nodes['Background'].inputs[1].default_value=.6;review.world=world
sun=bpy.data.lights.new('Props_Review_Sun','SUN');sun.energy=2.7;sun.angle=.13
light=bpy.data.objects.new('Props_Review_Sun',sun);active.objects.link(light);light.rotation_euler=(.55,-.48,-.51)
camd=bpy.data.cameras.new('Props_Review_Camera');cam=bpy.data.objects.new('Props_Review_Camera',camd);active.objects.link(cam)
cam.location=(10,-13,10);target=Vector((0,.2,1.4));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();camd.type='ORTHO';camd.ortho_scale=12;review.camera=cam
review.render.engine='BLENDER_EEVEE';review.render.resolution_x=1500;review.render.resolution_y=1100;review.render.resolution_percentage=100
review.view_settings.view_transform='AgX';review.render.image_settings.file_format='PNG';review.render.filepath=REV+'/props-library.png'
bpy.ops.wm.save_as_mainfile(filepath=OUT+'/props.blend')
bpy.ops.render.render(write_still=True)
roundtrip=bpy.data.scenes.new('Props_Export_RoundTrip');bpy.context.window.scene=roundtrip
round_counts={}
for lod in [0,1]:
    for family in BUILDERS:
        bpy.ops.import_scene.gltf(filepath=OUT+f'/ENV_{family}_LOD{lod}.glb')
        imported=[o for o in bpy.context.selected_objects if o.type=='MESH']
        round_counts[f'{family}_LOD{lod}']=sum(len(o.data.polygons) for o in imported)
        for o in imported:o.hide_render=True
with open(REV+'/technical-report.json','w') as f:json.dump({'triangles':counts,'bounds':bounds,'roundTripPolygons':round_counts,'parts':len(payload['parts'])},f,indent=2)
bpy.context.window.scene=review;bpy.ops.wm.save_as_mainfile(filepath=OUT+'/props.blend')
print('PROPS_EXPORT',json.dumps(counts),'roundtrip',round_counts)
