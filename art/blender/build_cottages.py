"""Author cottage meshes through Blender MCP; also export baked runtime geometry.
Run via scripts/blender-mcp-run.py in the connected Blender.
The existing scene is preserved; generated scenes are named explicitly.
"""
import bpy, bmesh, math, json, random, os
from mathutils import Vector
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'))
OUT=ROOT+'/art/blender'
random.seed(81)
# Rebuild only our generated scenes; keep the user's original scene and data.
for old in list(bpy.data.scenes):
    if old.name.startswith(('Cottage_Library','Cottage_Review','Cottage_Before_Comparison','Cottage_Turnaround','Cottage_Export_RoundTrip')):
        owned=list(old.objects); cols=list(old.collection.children)
        bpy.data.scenes.remove(old)
        for obj in owned:
            if not obj.users_scene:bpy.data.objects.remove(obj,do_unlink=True)
        for col in cols:
            if col.users==0:bpy.data.collections.remove(col)
for mat in list(bpy.data.materials):
    if mat.name.startswith('MAT_Cottage_') and mat.users==0:bpy.data.materials.remove(mat)

COLORS={'woodDark':'59402e','wood':'80604b','woodLight':'9b7759','stone':'aaa396','stoneDark':'777b78','plaster':'e5c9a1','plasterIvory':'e1d2b4','plasterRose':'dab8a5','window':'50433d','glass':'8db3ab','iron':'576a72','gold':'e9c06c','leaf':'52775a','leafLight':'709466','earth':'8d795f','roof':'a95745','roofDark':'765740','roofBlue':'657f8b'}
def linear(v): return v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4
def rgb(h): return tuple(linear(int(h[i:i+2],16)/255) for i in (0,2,4))
mats={}
def material(key,h):
    m=bpy.data.materials.new('MAT_Cottage_'+key);m.diffuse_color=(*rgb(h),1);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=m.diffuse_color;p.inputs['Roughness'].default_value=.92
    m['runtime']=key;mats[key]=m;return m
for k,h in COLORS.items(): material(k,h)
palettes=[['ad5140','bd634c','c97558','a54c3c'],['76553b','8a6544','9a7450','816046'],['77919e','8da4ae','647e8c','9daeb4']]
roofmats=[]
for i,pal in enumerate(palettes):
    row=[]
    for j,h in enumerate(pal):
        m=material('tile_%s_%s'%(i,j),h);m['runtime']='roofTiles';row.append(m)
    roofmats.append(row)
scene=bpy.data.scenes.new('Cottage_Library');bpy.context.window.scene=scene
scene.unit_settings.system='METRIC'
parts=[];active=None;meta={}
def group(name,family,lod,lo=3,hi=8,porch=False):
    global active,meta
    active=bpy.data.collections.new(name);scene.collection.children.link(active)
    meta=dict(name=name,family=family,lod=lod,minStage=lo,maxStage=hi,porchOnly=porch)
    parts.append((active,meta.copy()))
def mesh(name,vs,fs,mat):
    me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);me.update()
    bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free()
    ob=bpy.data.objects.new(name,me);active.objects.link(ob);me.materials.append(mats[mat] if isinstance(mat,str) else mat)
    return ob
def box(name,loc,size,mat,bevel=0):
    x,y,z=loc;a,b,c=[s/2 for s in size]
    vs=[(x+i*a,y+j*b,z+k*c) for i,j,k in [(-1,-1,-1),(-1,-1,1),(-1,1,-1),(-1,1,1),(1,-1,-1),(1,-1,1),(1,1,-1),(1,1,1)]]
    ob=mesh(name,vs,[(0,4,6,2),(1,3,7,5),(0,1,5,4),(2,6,7,3),(0,2,3,1),(4,5,7,6)],mat)
    if bevel:
        mod=ob.modifiers.new('Hand softened edges','BEVEL');mod.width=bevel;mod.segments=1
        bpy.context.view_layer.objects.active=ob;ob.select_set(True);bpy.ops.object.modifier_apply(modifier=mod.name);ob.select_set(False)
    return ob
def beam(name,p,q,width,mat='woodDark'):
    p=Vector(p);q=Vector(q);v=q-p;n=v.normalized();u=n.cross(Vector((0,1,0)))
    if u.length<.01:u=n.cross(Vector((1,0,0)))
    u.normalize();u*=width/2;t=n.cross(u)
    vs=[tuple(c+i*u+j*t) for c in [p,q] for i,j in [(-1,-1),(1,-1),(1,1),(-1,1)]]
    return mesh(name,vs,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],mat)
def gable(name,cx,cy,w,d,eave,rise,wall='plaster'):
    a=w/2;b=d/2
    vs=[(cx+x,cy+y,z) for y in [-b,b] for x,z in [(-a,eave),(a,eave),(0,eave+rise)]]
    return mesh(name,vs,[(0,1,2),(5,4,3),(0,3,4,1),(1,4,5,2),(2,5,3,0)],wall)
def roof(cx,cy,w,d,eave,rise,pi,lod,prefix='roof'):
    a=w/2;L=math.hypot(a,rise)
    # Two closed roof slabs and overlapping closed shingles, not open triangles.
    rows=max(2,math.ceil(L/(.46 if lod==0 else .93)));cols=max(3,math.ceil(d/(.55 if lod==0 else 1.08)))
    for side in [-1,1]:
        down=Vector((side*a/L,0,-rise/L));across=Vector((0,1,0));normal=Vector((side*rise/L,0,a/L))
        origin=Vector((cx,cy,eave+rise))
        def plank(name,s0,s1,y0,y1,lift,thick,mat):
            vs=[tuple(origin+down*s+across*y+normal*z) for z in [lift,lift+thick] for s,y in [(s0,y0),(s1,y0),(s1,y1),(s0,y1)]]
            return mesh(name,vs,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],mat)
        plank(prefix+'_underlay',0,L,-d/2,d/2,-.045,.045,'woodDark')
        for row in range(rows):
            for col in range(cols+1):
                width=d/cols;offset=width*.5*(row%2)
                left=max(-d/2,-d/2+(col-1)*width+offset);right=min(d/2,left+width-.018) if col>0 else min(d/2,-d/2+offset-.018)
                if right-left<.08:continue
                s0=row*L/rows;s1=min(L+.025,(row+1.13)*L/rows)
                # Each course sits above the following one at the overlap.
                plank(prefix+'_shingle',s0,s1,left,right,.022+(rows-row)*.012,.043,roofmats[pi][random.randrange(4)])
        for yy in [-d/2-.02,d/2+.02]:beam(prefix+'_bargeboard',(cx,cy+yy,eave+rise+.01),(cx+side*a,cy+yy,eave),.14)
        beam(prefix+'_fascia',(cx+side*a,cy-d/2,eave),(cx+side*a,cy+d/2,eave),.13)
    for i in range(7 if lod==0 else 4):
        n=7 if lod==0 else 4
        ob=gable(prefix+'_ridgecap',cx,cy-d/2+(i+.5)*d/n,.26,d/n+.025,eave+rise+.065,.13,'roof')
        ob.data.materials.clear();ob.data.materials.append(roofmats[pi][1])
def window(cx,cy,z,side=False,shutters=True):
    # All facade detail is confined to each opening; braces stay outside it.
    def wbox(name,x,y,h,w,d,hh,mat):
        if side:return box(name,(cx-y,cy+x,z+h),(d,w,hh),mat)
        return box(name,(cx+x,cy+(y if cy<0 else -y),z+h),(w,d,hh),mat)
    wbox('window_recess',0,0,0,.69,.075,.79,'woodDark');wbox('window_glass',0,-.05,0,.52,.04,.60,'glass')
    wbox('window_mullion',0,-.09,0,.055,.06,.64,'woodLight');wbox('window_crossbar',0,-.09,0,.55,.06,.055,'woodLight')
    wbox('window_sill',0,-.05,-.44,.85,.25,.12,'woodLight')
    if shutters:
        for s in [-1,1]:wbox('window_shutter',s*.45,0,0,.19,.07,.70,'wood')
def planter(cx,cy,z,lod):
    box('window_box',(cx,cy,z),(.87,.27,.20),'wood')
    if lod==0:
        for x in [-.28,0,.28]:
            ob=box('plant',(cx+x,cy,z+.17),(.24,.25,.25),'leafLight');

def cottage_shell(pi,lod,fam,prefix,eave,rise,wall,lo=3,hi=6):
    group(prefix+'_shell'+('_upper' if lo==7 else ''),fam,lod,lo,hi)
    box('wall_plaster',(0,0,(eave+.25)/2),(3.8,3.5,eave-.25),wall)
    gable('wall_gable',0,0,3.8,3.5,eave,rise,wall)
    for x in [-1.84,1.84]:
        for y in [-1.7,1.7]:box('corner_post',(x,y,(eave+.25)/2),(.17,.17,eave-.25),'woodDark',.015 if lod==0 else 0)
    for y in [-1.79,1.79]:
        for z in [.38,eave-.04]:box('cross_timber',(0,y,z),(3.82,.13,.16),'woodDark')
        beam('gable_kingpost',(0,y,eave),(0,y,eave+rise-.08),.13)
        for s in [-1,1]:beam('gable_brace',(0,y,eave+.10),(s*1.58,y,eave+.18),.10) if pi==1 else beam('gable_brace',(s*1.67,y,eave+.10),(s*.57,y,eave+rise*.59),.11)
    for x in [-1.95,1.95]:
        for z in [.39,eave-.05]:box('side_cross_timber',(x,0,z),(.13,3.5,.14),'woodDark')
        for s in ([-1,1] if lod==0 else [-1]):beam('side_brace',(x,s*1.56,.5),(x,s*.63,eave-.16),.12)
    # Door at front (-Y), standing on the foundation; clear opening and lintel.
    box('door_recess',(0,-1.79,1.17),(1.02,.09,1.82),'window')
    box('door',(0,-1.85,1.15),(.79,.08,1.67),'wood')
    if lod==0:
        for x in [-.26,0,.26]:box('door_plank_joint',(x,-1.902,1.15),(.018,.012,1.62),'woodDark')
    for x in [-.52,.52]:box('door_jamb',(x,-1.86,1.20),(.14,.16,1.94),'woodDark')
    box('door_lintel',(0,-1.87,2.15),(1.18,.19,.16),'woodDark')
    box('door_step',(0,-1.91,.17),(1.18,.42,.20),'stone')
    box('door_handle',(.25,-1.92,1.16),(.065,.045,.12),'iron')
    for x in [-1.13,1.13]:window(x,-1.80,1.53,shutters=pi!=1)
    window(1.96,0,1.58,side=True,shutters=False)
    if lod==0:window(-1.08,1.80,1.50,shutters=False)
    if pi==1:
        # Taller central gable opening, no floating dormer.
        window(0,-1.81,eave+.43,shutters=False)
        box('floor_beam',(0,-1.82,2.49),(3.78,.15,.17),'woodDark')
    else:
        box('attic_vent',(0,-1.78,eave+.5),(.39,.05,.48),'woodDark')
        for x in ([-.105,.105] if lod==0 else []):box('attic_slat',(x,-1.82,eave+.5),(.045,.04,.46),'woodLight')
    group(prefix+'_roof'+('_upper' if lo==7 else ''),fam,lod,lo,hi);roof(0,0,4.50,4.10,eave,rise,pi,lod)

def build(pi,lod):
    fam='ABC'[pi];prefix='ENV_Cottage_'+fam+'_LOD'+str(lod);eave=[2.55,3.1,2.65][pi];rise=[1.75,1.9,1.6][pi];wall=['plaster','plasterIvory','plasterRose'][pi]
    group(prefix+'_foundation',fam,lod,1)
    box('foundation',(0,0,.13),(3.95,3.65,.26),'stoneDark')
    if lod==0:
        for yy in [-1.78,1.78]:
            for i in range(6):box('footing_stone',(-1.64+i*.65,yy,.20),(.61,.19,.30),'stone',.015)
    group(prefix+'_construction_posts',fam,lod,1,2)
    for x in [-1.79,1.79]:
        for y in [-1.64,1.64]:box('construction_post',(x,y,.99),(.19,.19,1.8),'woodDark')
    group(prefix+'_half_walls',fam,lod,2,2);box('half_walls',(0,0,.74),(3.8,3.5,1.02),wall)
    cottage_shell(pi,lod,fam,prefix,eave,rise,wall)
    group(prefix+'_occupied',fam,lod,4)
    for x in [-1.13,1.13]:planter(x,-1.94,1.03,lod)
    group(prefix+'_chimney',fam,lod,4,6)
    # Masonry chimney seated through roof slope, capped with dark flue.
    x=-1.03;y=.72;top=eave+rise*.69+.63
    box('chimney',(x,y,(eave+top)/2),(.45,.47,top-eave),'stoneDark')
    box('chimney_cap',(x,y,top),(.62,.64,.17),'stone')
    box('chimney_flue',(x,y,top+.09),(.31,.33,.018),'window')
    group(prefix+'_shed',fam,lod,5)
    box('shed_foundation',(2.07,.17,.12),(1.7,2.16,.24),'stoneDark')
    box('shed_body',(2.07,.17,.92),(1.61,2.06,1.61),'woodLight')
    for yy in [-.88,1.22]:
        for xx in [1.30,2.85]:box('shed_post',(xx,yy,.91),(.13,.13,1.6),'woodDark')
    if lod==0:
        for xx in [1.53,1.85,2.17,2.49,2.78]:box('shed_plank',(xx,-.88,.91),(.04,.04,1.55),'wood')
    roof(2.07,.17,1.94,2.31,1.73,.55,pi,lod,'shed_roof')
    group(prefix+'_wing',fam,lod,6)
    box('wing_foundation',(-2.69,.8,.12),(2.2,2.66,.24),'stoneDark')
    box('wing_wall',(-2.69,.8,1.03),(2.12,2.59,1.81),wall)
    gable('wing_gable',-2.69,.8,2.12,2.59,1.94,.76,wall)
    for xx in [-3.7,-1.67]:
        for yy in [-.48,2.08]:box('wing_timber',(xx,yy,1.08),(.14,.14,1.88),'woodDark')
    window(-2.7,-.51,1.25,shutters=False)
    roof(-2.69,.8,2.63,2.99,1.96,.81,pi,lod,'wing_roof')
    # A full extra storey replaces the original shell and roof at stage seven.
    cottage_shell(pi,lod,fam,prefix,eave+1.20,rise,wall,7,8)
    group(prefix+'_upper_rooms',fam,lod,7)
    for y in [-1.81,1.81]:box('upper_floor_beam',(0,y,eave-.02),(3.82,.16,.19),'woodDark')
    for x in [-1.13,1.13]:window(x,-1.80,eave+.54,shutters=False)
    window(1.96,0,eave+.54,side=True,shutters=False)
    for x in [-1.87,1.87]:box('upper_side_floor',(x,0,eave-.02),(.17,3.55,.19),'woodDark')
    top=eave+1.2+rise*.69+.63
    box('raised_chimney',(-1.03,.72,(eave+1.2+top)/2),(.45,.47,top-eave-1.2),'stoneDark')
    box('raised_chimney_cap',(-1.03,.72,top),(.62,.64,.17),'stone')
    box('raised_flue',(-1.03,.72,top+.09),(.31,.33,.018),'window')
    group(prefix+'_master_gable',fam,lod,8)
    bay_eave=eave+rise+.65
    box('projecting_attic',(0,-1.39,eave+(rise+1.34)/2),(1.40,1.14,rise-.04),wall)
    gable('attic_bay_gable',0,-1.39,1.40,1.14,bay_eave,.78,wall)
    roof(0,-1.36,1.62,1.38,bay_eave,.78,pi,lod,'master_gable_roof')
    for x in [-.68,.68]:box('attic_bay_post',(x,-1.98,eave+(rise+1.34)/2),(.11,.12,rise+.03),'woodDark')
    box('bay_sill',(0,-1.99,eave+.69),(1.46,.16,.14),'woodDark')
    window(0,-1.98,eave+rise+.03,shutters=False)

for lod in [0,1]:
    for pi in range(3):build(pi,lod)
    group('ENV_Cottage_COMMON_LOD'+str(lod)+'_porch','COMMON',lod,3,8,True)
    box('porch_platform',(0,-3.0,.16),(2.42,2.0,.32),'stoneDark')
    box('porch_step',(0,-4.09,.08),(1.58,.31,.16),'stone')
    for x in [-1.08,1.08]:box('porch_post',(x,-3.88,1.23),(.16,.16,2.14),'woodDark')
    box('porch_header',(0,-3.88,2.23),(2.48,.17,.18),'woodDark')
    for x in [-1.08,1.08]:beam('porch_brace',(x,-3.88,1.81),(x*.62,-3.88,2.22),.12)
    # Roof below the main eave, supported by posts.
    roof(0,-2.90,2.67,2.4,2.28,.47,1,lod,'porch_roof')

# Merge authoring parts by runtime material, preserving tile palette as face slots.
for col,meta in parts:
    groups={}
    for o in list(col.objects):groups.setdefault(o.data.materials[0]['runtime'],[]).append(o)
    for key,objects in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in objects:o.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]
        if len(objects)>1:bpy.ops.object.join()
        o=objects[0] if len(objects)==1 else bpy.context.object;o.name=meta['name']+'_'+key
        o['runtime_material']=key
        for k,v in meta.items():o[k]=v
        o.select_set(False)
# Export triangles with normals and optional tile vertex colors in runtime axes.
def bake(o):
    me=o.data;me.calc_loop_triangles();positions=[];normals=[];colors=[];indices=[];lookup={}
    for tri in me.loop_triangles:
        m=me.materials[tri.material_index];color=tuple(round(x,5) for x in m.diffuse_color[:3])
        for vi in tri.vertices:
            p=me.vertices[vi].co;n=tri.normal
            ps=tuple(round(v,5) for v in (p.x,p.z,-p.y));ns=tuple(round(v,5) for v in (n.x,n.z,-n.y));key=(ps,ns,color)
            if key not in lookup:
                lookup[key]=len(positions)//3;positions.extend(ps);normals.extend(ns);colors.extend(color)
            indices.append(lookup[key])
    out=dict(name=o['name']+'_'+o['runtime_material'],material=o['runtime_material'],positions=positions,normals=normals,indices=indices)
    if o['runtime_material']=='roofTiles':out['colors']=colors
    return out
payload={'version':1,'coordinates':'three-y-up','parts':[]}
for col,meta in parts:
    for o in col.objects:payload['parts'].append({**meta,**bake(o)})
os.makedirs(ROOT+'/src/town/generated',exist_ok=True)
runtime_path=ROOT+'/src/town/generated/cottages.json'
with open(runtime_path+'.tmp','w') as f:json.dump(payload,f,separators=(',',':'))
os.replace(runtime_path+'.tmp',runtime_path)
# Mature GLBs for interoperable handoff (palette survives per-face material slots).
for lod in [0,1]:
    for family in 'ABC':
        bpy.ops.object.select_all(action='DESELECT')
        for col,meta in parts:
            if meta['family']==family and meta['lod']==lod and meta['minStage']<=8<=meta['maxStage']:
                for o in col.objects:o.select_set(True)
        bpy.ops.export_scene.gltf(filepath=OUT+'/ENV_Cottage_'+family+'_LOD'+str(lod)+'.glb',use_selection=True,use_active_scene=True,export_format='GLB',export_yup=True,export_cameras=False,export_lights=False)
for lod in [0,1]:
    bpy.ops.object.select_all(action='DESELECT')
    for col,meta in parts:
        if meta['family']=='COMMON' and meta['lod']==lod:
            for o in col.objects:o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=OUT+'/ENV_Cottage_Porch_LOD'+str(lod)+'.glb',use_selection=True,use_active_scene=True,export_format='GLB',export_yup=True,export_cameras=False,export_lights=False)
# Keep imported originals in a separate comparison scene.
original=bpy.data.scenes.new('Cottage_Before_Comparison');active=bpy.data.collections.new('Original_Procedural_Houses');original.collection.children.link(active)
if os.path.exists('/tmp/town-original-houses.json'):
    for item in json.load(open('/tmp/town-original-houses.json')):
        for mi,data in enumerate(item['meshes']):
            ps=data['positions'];vs=[(ps[i]+item['variant']*12,-ps[i+2],ps[i+1]-.48) for i in range(0,len(ps),3)];ids=data['indices'] or list(range(len(vs)))
            mesh('BEFORE_'+str(item['variant'])+'_'+str(mi),vs,[tuple(ids[i:i+3]) for i in range(0,len(ids),3)],data['material'] if data['material'] in mats else 'wood')
# Review copies: a village cluster, source library remains untouched.
review=bpy.data.scenes.new('Cottage_Review');bpy.context.window.scene=review
active=bpy.data.collections.new('Review_Assembly');review.collection.children.link(active)
placements=[('A',(-5,-1,0),0),('B',(4,2,0),-.16),('C',(-1,8,0),.08)]
for family,loc,rot in placements:
    parent=bpy.data.objects.new('Review_'+family,None);active.objects.link(parent);parent.location=loc;parent.rotation_euler.z=rot
    for col,meta in parts:
        if (meta['family']==family or (meta['family']=='COMMON' and family=='C')) and meta['lod']==0 and meta['minStage']<=8<=meta['maxStage']:
            for src in col.objects:
                o=src.copy();o.data=src.data;o.parent=parent;active.objects.link(o)
# Restrained review set dressing, clearly excluded from runtime exports.
box('Review_Ground',(0,2,-.19),(28,28,.32),'earth')
for cx,cy,scale in [(-10,3,1.15),(8,7,1.25),(5,-4,.8),(-5,10,.95),(-9,-5,.8)]:
    box('Review_Pine_Trunk',(cx,cy,scale*1.8),(.22,.25,scale*3.6),'woodDark')
    for tier in range(4):
        z=scale*(1.35+tier*.84);rad=scale*(1.46-tier*.27);n=7
        vs=[(cx+math.cos(i*math.tau/n)*rad,cy+math.sin(i*math.tau/n)*rad,z) for i in range(n)]+[(cx+.09,cy,z+scale*1.48)]
        mesh('Review_Pine_Crown',vs,[tuple(range(n-1,-1,-1))]+[(i,(i+1)%n,n) for i in range(n)],'leafLight' if tier%2 else 'leaf')
for i in range(32):
    y=-9+i*.51;x=-.35+math.sin(y*.45)*1.5
    ob=box('Review_Path_Stone',(x+random.uniform(-.3,.3),y,-.015),(.55,.43,.10),'stone',.06)
for x in range(-9,-2):
    box('Review_Fence_Post',(x,4,.50),(.14,.16,1.1),'woodDark')
for z in [.31,.75]:beam('Review_Fence_Rail',(-9,4,z),(-3,4,z),.13,'wood')
world=bpy.data.worlds.new('Cottage_Studio_Sky');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.40,.53,.68,1);world.node_tree.nodes['Background'].inputs[1].default_value=.5;review.world=world
ld=bpy.data.lights.new('Review_Sun','SUN');ld.energy=2.6;ld.angle=.14;light=bpy.data.objects.new('Review_Sun',ld);active.objects.link(light);light.rotation_euler=(.45,-.60,-.45)
ld=bpy.data.lights.new('Review_Fill','AREA');ld.energy=1500;ld.shape='DISK';ld.size=12;light=bpy.data.objects.new('Review_Fill',ld);active.objects.link(light);light.location=(-5,-8,14)
camd=bpy.data.cameras.new('Review_Camera');cam=bpy.data.objects.new('Review_Camera',camd);active.objects.link(cam);cam.location=(19,-27,24);target=Vector((-1,2,1.5));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();camd.type='ORTHO';camd.ortho_scale=27;review.camera=cam
review.render.engine='CYCLES';review.cycles.samples=32;review.cycles.use_denoising=True;review.render.resolution_x=1600;review.render.resolution_y=1200;review.render.resolution_percentage=100
review.view_settings.view_transform='AgX';review.render.image_settings.file_format='PNG';review.render.filepath=ROOT+'/art/reviews/cottages/village-review.png'
for area in bpy.context.screen.areas:
    if area.type=='CONSOLE':area.type='VIEW_3D'
    if area.type=='VIEW_3D':
        area.spaces.active.region_3d.view_perspective='CAMERA';area.spaces.active.shading.type='MATERIAL'
bpy.data.libraries.write(OUT+'/cottages.blend',{scene,review,original},fake_user=True)
counts={}
for lod in [0,1]:
    for fam in 'ABC':
        subset=[p for p in payload['parts'] if p['lod']==lod and p['family']==fam and p['minStage']<=8<=p['maxStage']]
        counts[fam+'_LOD'+str(lod)]=sum(len(p['indices'])//3 for p in subset)
with open(ROOT+'/art/reviews/cottages/triangle-report.json','w') as f:json.dump(counts,f,indent=2)
print('COTTAGE_EXPORT',json.dumps(counts),'parts',len(payload['parts']))
