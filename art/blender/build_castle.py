"""Reference-led castle authoring and bake. Run through scripts/blender-mcp-run.py.

Blender source is Z-up, facade toward -Y. Runtime JSON is Y-up with facade +Z.
Only scenes whose names begin Castle_ are rebuilt. The preexisting Blender scene stays intact.
"""
import bpy, bmesh, json, math, os, random
from mathutils import Vector

ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
OUT=ROOT+'/art/blender'
REV=ROOT+'/art/reviews/castle'
os.makedirs(REV,exist_ok=True)
random.seed(144)
for old in list(bpy.data.scenes):
    if old.name.startswith('Castle_'):
        owned=list(old.objects); cols=list(old.collection.children)
        bpy.data.scenes.remove(old)
        bpy.data.batch_remove(ids=[obj for obj in owned if not obj.users_scene])
        for col in cols:
            if col.users==0:bpy.data.collections.remove(col)
# Rebuilding in the same Blender session can leave unreferenced meshes behind.
unused_meshes=[mesh for mesh in bpy.data.meshes if mesh.users==0]
if unused_meshes:bpy.data.batch_remove(ids=unused_meshes)
for old in list(bpy.data.materials):
    if old.name.startswith('MAT_Castle_') and old.users==0:bpy.data.materials.remove(old)

def linear(v):return v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4
def rgb(h):return tuple(linear(int(h[i:i+2],16)/255) for i in (0,2,4))
COLORS={'stone':'a7a195','stoneDark':'777b78','wood':'80604b','woodDark':'674d3d',
        'roof':'a95745','gold':'e9c06c','window':'50433d','iron':'576a72',
        'tile_0':'ac4937','tile_1':'c26743','tile_2':'d48345','tile_3':'b9543d'}
mats={}
for k,h in COLORS.items():
    m=bpy.data.materials.new('MAT_Castle_'+k);m.diffuse_color=(*rgb(h),1);m.use_nodes=True
    p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED');p.inputs['Base Color'].default_value=m.diffuse_color;p.inputs['Roughness'].default_value=.93
    m['runtime']='roofTiles' if k.startswith('tile_') else k;mats[k]=m

library=bpy.data.scenes.new('Castle_Library');bpy.context.window.scene=library
library.unit_settings.system='METRIC';parts=[];active=None;meta=None
def group(name,lod,lo,hi=6):
    global active,meta
    active=bpy.data.collections.new(name);library.collection.children.link(active)
    meta=dict(name=name,family='CASTLE',lod=lod,minStage=lo,maxStage=hi)
    parts.append((active,meta.copy()))
def mesh(name,vs,fs,mat,face_mats=None):
    me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);me.update()
    bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free()
    ob=bpy.data.objects.new(name,me);active.objects.link(ob)
    if face_mats:
        for key in ['tile_0','tile_1','tile_2','tile_3']:me.materials.append(mats[key])
        for i,poly in enumerate(me.polygons):poly.material_index=face_mats[i]
    else:me.materials.append(mats[mat])
    return ob
def box(name,loc,size,mat):
    x,y,z=loc;a,b,c=[s/2 for s in size]
    vs=[(x+i*a,y+j*b,z+k*c) for i,j,k in [(-1,-1,-1),(-1,-1,1),(-1,1,-1),(-1,1,1),(1,-1,-1),(1,-1,1),(1,1,-1),(1,1,1)]]
    return mesh(name,vs,[(0,4,6,2),(1,3,7,5),(0,1,5,4),(2,6,7,3),(0,2,3,1),(4,5,7,6)],mat)
def beam(name,p,q,width,mat):
    p=Vector(p);q=Vector(q);v=q-p;n=v.normalized();u=n.cross(Vector((0,1,0)))
    if u.length<.01:u=n.cross(Vector((1,0,0)))
    u.normalize();u*=width/2;t=n.cross(u)*width/2
    vs=[tuple(c+i*u+j*t) for c in [p,q] for i,j in [(-1,-1),(1,-1),(1,1),(-1,1)]]
    return mesh(name,vs,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],mat)
def frustum(name,cx,cy,z0,z1,r0,r1,n,mat):
    vs=[]
    for z,r in [(z0,r0),(z1,r1)]:
        for i in range(n):
            a=math.tau*i/n;vs.append((cx+math.cos(a)*r,cy+math.sin(a)*r,z))
    fs=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]
    fs += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    return mesh(name,vs,fs,mat)
def cone_tiles(name,cx,cy,z0,z1,r0,lod):
    # Closed segmented courses, orange palette varied by face. Pronounced shingle lips.
    n=18 if lod==0 else 10; rows=8 if lod==0 else 4
    vs=[];fs=[];fm=[]
    for row in range(rows):
        low=row/rows;high=(row+1.08)/rows
        rlo=r0*(1-low)+.018; rhi=max(.055,r0*(1-high))
        za=z0+(z1-z0)*low;zb=min(z1,z0+(z1-z0)*high)
        for j in range(n):
            a0=math.tau*j/n + (math.pi/n if row%2 else 0)
            a1=a0+math.tau/n*.985
            start=len(vs)
            vs.extend([(cx+math.cos(a)*r,cy+math.sin(a)*r,z) for a,r,z in [(a0,rlo,za),(a1,rlo,za),(a1,rhi,zb),(a0,rhi,zb)]])
            fs.append((start,start+1,start+2,start+3));fm.append((row+j+random.randrange(3))%4)
    mesh(name,vs,fs,'tile_0',fm)
    frustum(name+'_underlay',cx,cy,z0,z1,r0-.07,.025,n,'roof')
def arch_shape(name,cy,zbase,width,spring,rise,mat,lod):
    # A filled dark arch against the solid front wall. It is intentionally not traversable.
    n=10 if lod==0 else 6;w=width/2
    top=[(-w+width*i/n,cy,zbase+spring+rise*math.sqrt(max(0,1-((2*i/n)-1)**2))) for i in range(n+1)]
    vs=[(-w,cy,zbase),(w,cy,zbase)]+list(reversed(top))
    return mesh(name,vs,[tuple(range(len(vs)))],mat)
def tower(cx,cy,h,lod,roofed):
    n=12 if lod==0 else 8
    frustum('round_tower',cx,cy,0,h,1.15,1.02,n,'stone')
    for z in ([1.55,3.25] if lod==0 else [2.4]):
        if z>=h-.2:continue
        frustum('masonry_course',cx,cy,z,z+.075,1.165-z*.022,1.16-z*.022,n,'stoneDark')
    if lod==0:
        for row,z in enumerate([.87,2.02,2.85,3.92]):
            for j in range(0,n,2):
                a0=math.tau*(j+(row%2)*.55-.32)/n;a1=a0+math.tau*.73/n
                r=1.171-z*.028
                vs=[(cx+math.cos(a)*r,cy+math.sin(a)*r,zz) for a,zz in [(a0,z),(a1,z),(a1,z+.21),(a0,z+.21)]]
                mesh('staggered_tower_stone',vs,[(0,1,2,3)],'stoneDark' if (row+j)%5==0 else 'stone')
    frustum('tower_cornice',cx,cy,h-.16,h+.08,1.23,1.31,n,'stoneDark')
    for i in range(0,n,2):
        a=math.tau*i/n;box('tower_merlon',(cx+math.cos(a)*1.12,cy+math.sin(a)*1.12,h+.32),(.43,.43,.5),'stone')
    if roofed:
        frustum('roof_ledge',cx,cy,h+.5,h+.63,1.27,1.31,n,'stone')
        cone_tiles('orange_tower_tiles',cx,cy,h+.61,h+2.65,1.40,lod)
        frustum('gold_finial',cx,cy,h+2.64,h+3.0,.11,.055,8,'gold')
def arched_front_wall(lod):
    # The wall has a real one-unit-deep entrance cavity. Its inner silhouette
    # follows the gate voussoirs; the dark backing sits at the rear of the cavity.
    z0=.125;ztop=4.515;outer=5.125;half=1.20
    yfront=-4.90;yback=-3.95;depth=yback-yfront
    pier_w=outer-half
    for side in [-1,1]:
        box('gate_wall_pier',(side*(outer+half)/2,(yfront+yback)/2,(z0+ztop)/2),
            (pier_w,depth,ztop-z0),'stone')
    n=12 if lod==0 else 8
    vs=[]
    for i in range(n+1):
        x=-half+2*half*i/n
        z=2.0+1.20*math.sqrt(max(0,1-(x/half)**2))
        vs.extend([(x,yfront,z),(x,yback,z),(x,yfront,ztop),(x,yback,ztop)])
    fs=[]
    for i in range(n):
        a=i*4;b=(i+1)*4
        fs.extend([(a,b,b+2,a+2),(a+1,a+3,b+3,b+1),
                   (a,a+1,b+1,b),(a+2,b+2,b+3,a+3)])
    mesh('arched_gate_wall',vs,fs,'stone')
def battlement(lod):
    for x in range(-4,5):
        if abs(x)<2:continue
        box('front_merlon',(x*1.04,-5.12,5.0),(.56,.68,.75),'stone')
        box('rear_merlon',(x*1.04,5.12,5.0),(.56,.68,.75),'stone')
    for yy in [-3.35,-1.65,0,1.65,3.35]:
        for sx in [-1,1]:box('side_merlon',(sx*5.55,yy,5.0),(.62,.62,.75),'stone')
    if lod==0:
        for x in [-4.15,-2.9,2.9,4.15]:
            box('machicolation',(x,-5.19,4.45),(.30,.38,.28),'stoneDark')
def banner(x,cy,top):
    box('banner_rod',(x,cy,top),(.85,.13,.10),'woodDark')
    # Hanging warm orange pennant with forked lower edge, flush to facade.
    vs=[(x-.31,cy-.07,top-.04),(x+.31,cy-.07,top-.04),(x+.31,cy-.07,top-1.48),(x,cy-.07,top-1.23),(x-.31,cy-.07,top-1.48)]
    mesh('hanging_banner',vs,[(0,1,2,3,4)],'roof')
    box('banner_crest',(x,cy-.09,top-.55),(.17,.035,.19),'gold')
def great_hall(lod):
    # Broad intermediate mass ties the slender keep into the curtain walls.
    # Local Z is height; the new floor remains within the established footprint.
    cy=.40;zbase=4.25;ztop=8.65
    box('great_hall_body',(0,cy,(zbase+ztop)/2),(8.20,6.70,ztop-zbase),'stone')
    box('hall_lower_course',(0,cy,4.80),(8.36,6.85,.25),'stoneDark')
    box('hall_eave_course',(0,cy,8.51),(8.48,6.96,.28),'stoneDark')
    for x in [-3.52,-1.75,0,1.75,3.52]:
        box('hall_front_window',(x,cy-3.39,6.85),(.37,.12,.91),'window')
        box('hall_window_lintel',(x,cy-3.48,7.39),(.62,.20,.16),'stoneDark')
        box('hall_window_sill',(x,cy-3.49,6.33),(.60,.23,.15),'stone')
    for side in [-1,1]:
        for yy in [-1.85,.25,2.38]:
            box('hall_side_window',(side*4.15,yy,6.86),(.12,.37,.89),'window')
            box('hall_side_lintel',(side*4.22,yy,7.39),(.20,.61,.16),'stoneDark')
        if lod==0:
            for z in [5.38,6.23,7.10,7.95]:
                for yy in [cy-3.25,cy+3.25]:
                    box('hall_corner_quoin',(side*4.14,yy,z),(.19,.47,.29),'stoneDark')
    banner(-2.62,cy-3.53,7.89);banner(2.62,cy-3.53,7.89)
    # Four roof shoulders slope up to the keep; the top is buried in its walls.
    lower=[Vector(v) for v in [(-4.48,cy-3.70,8.70),(4.48,cy-3.70,8.70),(4.48,cy+3.70,8.70),(-4.48,cy+3.70,8.70)]]
    upper=[Vector(v) for v in [(-1.96,1.05-1.95,10.42),(1.96,1.05-1.95,10.42),(1.96,1.05+1.95,10.42),(-1.96,1.05+1.95,10.42)]]
    mesh('hall_roof_underlay',[tuple(p)for p in lower+upper],[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],'woodDark')
    rows=4 if lod==0 else 3;columns=7 if lod==0 else 4
    for side in range(4):
        a,b=lower[side],lower[(side+1)%4];c,d=upper[side],upper[(side+1)%4]
        for row in range(rows):
            t0=row/rows;t1=min(1,(row+1.06)/rows)
            left0=a.lerp(c,t0);right0=b.lerp(d,t0);left1=a.lerp(c,t1);right1=b.lerp(d,t1)
            for col in range(columns):
                u0=col/columns;u1=(col+.98)/columns
                top=[left0.lerp(right0,u0),left0.lerp(right0,u1),left1.lerp(right1,u1),left1.lerp(right1,u0)]
                vs=[tuple(p+Vector((0,0,.055+row*.012))) for p in top]+[tuple(p+Vector((0,0,-.03))) for p in top]
                mesh('hall_shoulder_tile',vs,[(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],'tile_'+str((side+row+col)%4))

def early_hip_roof(lod):
    # Stage 4 needs a complete roof: the stage-5 great hall replaces this mass.
    # Keep the eaves just inside the parapet and below the four corner spires.
    lower=[Vector(v) for v in [(-4.80,-4.25,4.81),(4.80,-4.25,4.81),
                              (4.80,4.25,4.81),(-4.80,4.25,4.81)]]
    upper=[Vector(v) for v in [(-2.25,-.18,6.30),(2.25,-.18,6.30),
                              (2.25,.18,6.30),(-2.25,.18,6.30)]]
    box('early_roof_support',(0,0,4.65),(9.55,8.45,.29),'woodDark')
    mesh('early_roof_underlay',[tuple(p) for p in lower+upper],
         [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),
          (2,3,7,6),(3,0,4,7)],'woodDark')
    rows=6 if lod==0 else 4
    for side in range(4):
        a,b=lower[side],lower[(side+1)%4]
        d,c=upper[side],upper[(side+1)%4]
        normal=(b-a).cross(d-a).normalized()
        columns=(12 if lod==0 else 7) if side%2==0 else (9 if lod==0 else 5)
        for row in range(rows):
            t0=row/rows;t1=min(1,(row+1.08)/rows)
            left0=a.lerp(d,t0);right0=b.lerp(c,t0)
            left1=a.lerp(d,t1);right1=b.lerp(c,t1)
            shift=.5/columns if row%2 else 0
            for col in range(-1,columns+1):
                u0=max(0,(col+shift)/columns)
                u1=min(1,(col+1+shift)/columns-.006)
                if u1-u0<.025:continue
                top=[left0.lerp(right0,u0),left0.lerp(right0,u1),
                     left1.lerp(right1,u1),left1.lerp(right1,u0)]
                top=[p+normal*(.055+row*.008) for p in top]
                back=[p-normal*.065 for p in top]
                mesh('early_overlapping_tile',[tuple(p) for p in top+back],
                     [(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),
                      (2,6,7,3),(3,7,4,0)],'tile_'+str((side+row+col)%4))
        beam('early_eave_trim',a,b,.11,'woodDark')
    beam('early_ridge',(-2.25,0,6.33),(2.25,0,6.33),.14,'roof')

def build(lod):
    pre='ENV_Castle_LOD'+str(lod)
    group(pre+'_foundation',lod,1)
    box('foundation',(0,0,.15),(11.35,10.35,.30),'stoneDark')
    for x in [-5.4,5.4]:
        box('footing_side',(x,0,.39),(.31,10.12,.49),'stone')
    for y in [-4.95,4.95]:box('footing_front',(0,y,.39),(10.85,.31,.49),'stone')
    group(pre+'_groundwork',lod,1,1)
    for x in [-4.75,4.75]:
        for y in [-4.3,4.3]:box('groundwork_post',(x,y,1.14),(.20,.20,1.75),'woodDark')
    box('stacked_timber',(3.8,-4.4,.56),(1.15,.55,.35),'wood')
    group(pre+'_construction',lod,2,2)
    box('building_first_course',(0,0,.98),(10.35,9.40,1.52),'stone')
    for x in [-4.83,4.83]:
        for y in [-4.36,4.36]:box('scaffold_post',(x,y,1.48),(.21,.21,2.38),'woodDark')
    for y in [-4.36,4.36]:box('scaffold_beam',(0,y,2.55),(9.85,.17,.20),'wood')
    group(pre+'_walls',lod,3)
    arched_front_wall(lod)
    box('curtain_rear',(0,4.425,2.32),(10.25,.95,4.39),'stone')
    for side in [-1,1]:
        box('curtain_side',(side*4.65,0,2.32),(.95,9.80,4.39),'stone')
    for yy in [-4.83,4.83]:
        box('parapet_course',(0,yy,4.45),(10.45,.50,.33),'stoneDark')
    for xx in [-5.22,5.22]:box('side_parapet_course',(xx,0,4.45),(.52,9.62,.33),'stoneDark')
    arch_shape('arched_gate_recess',-3.94,.30,2.40,1.70,1.20,'window',lod)
    for x in [-1.32,1.32]:
        box('gate_jamb',(x,-4.97,1.15),(.25,.20,1.70),'stoneDark')
    for sx in [-1,1]:
        for sy in [-1,1]:tower(sx*5.17,sy*4.7,4.65,lod,False)
    group(pre+'_early_roofs',lod,4,4)
    # The stage-4 spires sit on the same round tower footprint as the old castle.
    for sx in [-1,1]:
        for sy in [-1,1]:cone_tiles('stage4_spire',sx*5.17,sy*4.7,5.24,7.00,1.39,lod)
    early_hip_roof(lod)
    group(pre+'_gate',lod,4)
    # Segmental arch voussoirs read from the front at a distance.
    for i in range(8 if lod==0 else 5):
        count=8 if lod==0 else 5;a=math.pi*i/count;b=math.pi*(i+1)/count
        def p(rad,angle,y):return (math.cos(angle)*rad,y,2.0+math.sin(angle)*rad)
        vs=[p(rad,angle,y) for y in [-5.04,-4.83]
            for rad,angle in [(1.20,a),(1.20,b),(1.45,b),(1.45,a)]]
        mesh('arch_voussoir',vs,[(0,1,2,3),(4,7,6,5),(0,4,5,1),
                                  (1,5,6,2),(2,6,7,3),(3,7,4,0)],
             'stoneDark' if i%3==0 else 'stone')
    for x in [-.84,-.42,0,.42,.84]:box('portcullis_bar',(x,-5.08,1.25),(.075,.12,1.75),'iron')
    box('portcullis_crossbar',(0,-5.10,.8),(2.15,.12,.10),'iron')
    box('portcullis_crossbar',(0,-5.10,1.55),(2.15,.12,.10),'iron')
    banner(-3.25,-4.99,4.24);banner(3.25,-4.99,4.24)
    group(pre+'_keep',lod,5)
    great_hall(lod)
    # The narrower keep now emerges from the broad rectangular great hall.
    box('keep_lower',(0,1.05,7.45),(4.12,4.10,14.25),'stone')
    if lod==0:
        for side in [-1,1]:
            for row,z in enumerate([5.65,7.40,9.10,11.05,12.80]):
                for yy in [-.75,2.78]:
                    box('keep_quoin',(side*2.105,yy+(.19 if row%2 else 0),z),(.14,.52,.37),'stoneDark' if row%3==0 else 'stone')
            for y in [-.26,2.28]:
                for z in [7.7,10.7,13.0]:
                    box('side_arrow_slit',(side*2.105,y,z),(.09,.25,.69),'window')
                    box('side_slit_lintel',(side*2.13,y,z+.43),(.16,.42,.13),'stoneDark')
    box('keep_belt',(0,1.05,9.85),(4.58,4.56,.31),'stoneDark')
    box('keep_cornice',(0,1.05,14.35),(4.62,4.61,.34),'stoneDark')
    for yy in [-1.07,3.16]:
        for xx in [-1.46,0,1.46]:box('keep_merlon',(xx,yy,14.70),(.53,.52,.62),'stone')
    for xx in [-2.16,2.16]:
        for yy in [-.41,1.05,2.51]:box('keep_side_merlon',(xx,yy,14.70),(.52,.53,.62),'stone')
    # Closed stone gables and solid dark underlay support thick overlapping clay courses.
    z0=14.87;z1=18.12;cx=0;cy=1.05;rw=2.54;rd=2.55
    vs=[(-rw,cy-rd+.08,z0),(rw,cy-rd+.08,z0),(0,cy-rd+.08,z1-.08),
        (-rw,cy+rd-.08,z0),(rw,cy+rd-.08,z0),(0,cy+rd-.08,z1-.08)]
    mesh('closed_keep_gable',vs,[(0,1,2),(3,5,4),(0,3,4,1),(0,2,5,3),(1,4,5,2)],'stone')
    for side in [-1,1]:
        normal=Vector((side*(z1-z0),0,rw)).normalized()
        def sloped_panel(name,xa,xb,ya,yb,za,zb,lift,depth,mat):
            top=[Vector((xa,ya,za)),Vector((xa,yb,za)),Vector((xb,yb,zb)),Vector((xb,ya,zb))]
            vs=[tuple(p+normal*lift) for p in top]+[tuple(p+normal*(lift-depth)) for p in top]
            return mesh(name,vs,[(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],mat)
        sloped_panel('roof_underlay',side*rw,0,cy-rd,cy+rd,z0,z1,0,.15,'woodDark')
        for row in range(7 if lod==0 else 4):
            rows=7 if lod==0 else 4
            t0=row/rows;t1=min(1,(row+1.07)/rows)
            xa=side*rw*(1-t0);xb=side*rw*(1-t1)
            za=z0+(z1-z0)*t0;zb=z0+(z1-z0)*t1
            count=7 if lod==0 else 3
            width=2*rd/count;offset=(row%2)*width*.5
            for j in range(-1,count+1):
                ya=max(cy-rd,cy-rd+j*width+offset)
                yb=min(cy+rd,cy-rd+(j+1)*width+offset-.022)
                if yb-ya<.12:continue
                tile=['tile_0','tile_1','tile_2','tile_3'][(j+row)%4]
                sloped_panel('overlapping_keep_tile',xa,xb,ya,yb,za,zb,.045+row*.009,.078,tile)
            lip=normal*(.10+row*.009)
            beam('shingle_course_lip',Vector((xa,cy-rd,za))+lip,Vector((xa,cy+rd,za))+lip,.055,'roof')
        for yy in [cy-rd-.035,cy+rd+.035]:
            beam('keep_roof_bargeboard',(side*rw,yy,z0),(0,yy,z1),.13,'woodDark')
    for y in [-1.02,3.12]:
        for z in [7.9,10.6,13.0]:
            box('keep_arrow_slit',(0,y,z),(.28,.08,.83),'window')
            box('slit_lintel',(0,y-(.06 if y<0 else -.06),z+.49),(.47,.17,.13),'stoneDark')
    for x in [-1.33,1.33]:banner(x,-1.1,12.1)
    group(pre+'_towers_raised',lod,5)
    for sx in [-1,1]:
        for sy in [-1,1]:
            frustum('raised_round_tower',sx*5.17,sy*4.7,4.60,7.45,1.03,.97,12 if lod==0 else 8,'stone')
            frustum('raised_tower_band',sx*5.17,sy*4.7,7.24,7.45,1.18,1.30,12 if lod==0 else 8,'stoneDark')
            cone_tiles('mature_spire',sx*5.17,sy*4.7,7.47,10.15,1.39,lod)
            frustum('spire_finial',sx*5.17,sy*4.7,10.15,10.48,.11,.06,8,'gold')
    group(pre+'_completion',lod,6)
    battlement(lod)
    # Existing stage-6 side wing extension reaches x=-8.65; keep it inside that bound.
    box('side_wing',(-7.18,1.34,2.12),(2.32,2.78,3.75),'stone')
    box('side_wing_cap',(-7.18,1.34,4.16),(2.58,3.03,.30),'stoneDark')
    for yy in [.35,1.85]:box('wing_merlon',(-8.3,yy,4.50),(.46,.48,.55),'stone')
    if lod==0:
        for x in [-3.92,-2.65,2.65,3.92]:
            box('arrow_slit',(x,-4.83,2.75),(.17,.09,.65),'window')
        for side in [-1,1]:
            for i in range(3):box('crenel_stone',(side*(2.35+i*.95),-5.12,5.35),(.66,.42,.15),'stoneDark')

for lod in [0,1]:build(lod)

# Join within each stage part by runtime material: one shared BufferGeometry per material.
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
    me=o.data;me.calc_loop_triangles();positions=[];normals=[];colors=[];indices=[];lookup={}
    for tri in me.loop_triangles:
        color=tuple(round(v,5) for v in me.materials[tri.material_index].diffuse_color[:3])
        for vi in tri.vertices:
            p=me.vertices[vi].co;n=tri.normal
            ps=tuple(round(v,5) for v in (p.x,p.z,-p.y));ns=tuple(round(v,5) for v in (n.x,n.z,-n.y));key=(ps,ns,color)
            if key not in lookup:
                lookup[key]=len(positions)//3;positions.extend(ps);normals.extend(ns);colors.extend(color)
            indices.append(lookup[key])
    result=dict(name=o.name,material=o['runtime_material'],positions=positions,normals=normals,indices=indices)
    if o['runtime_material']=='roofTiles':result['colors']=colors
    return result
payload=dict(version=1,coordinates='three-y-up',parts=[])
for col,m in parts:
    for o in col.objects:payload['parts'].append({**m,**bake(o)})
path=ROOT+'/src/town/generated/castle.json'
with open(path+'.tmp','w') as f:json.dump(payload,f,separators=(',',':'))
os.replace(path+'.tmp',path)

counts={}
for lod in [0,1]:
    for stage in range(1,7):
        subset=[p for p in payload['parts'] if p['lod']==lod and p['minStage']<=stage<=p['maxStage']]
        counts[f'LOD{lod}_stage{stage}']=sum(len(p['indices'])//3 for p in subset)
    bpy.ops.object.select_all(action='DESELECT')
    for col,m in parts:
        if m['lod']==lod and m['minStage']<=6<=m['maxStage']:
            for o in col.objects:o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=OUT+f'/ENV_Castle_LOD{lod}.glb',use_selection=True,use_active_scene=True,export_format='GLB',export_yup=True,export_cameras=False,export_lights=False)

# Comparison is linked data, offset side by side for scale and silhouette review.
review=bpy.data.scenes.new('Castle_Review');bpy.context.window.scene=review
active=bpy.data.collections.new('Castle_Review_Set');review.collection.children.link(active)
for col,m in parts:
    if m['lod']==0 and m['minStage']<=6<=m['maxStage']:
        for src in col.objects:
            o=src.copy();o.data=src.data;o.location.x+=0;active.objects.link(o)
before='/tmp/town-original-castle.json'
if os.path.exists(before):
    for mi,item in enumerate(json.load(open(before))['meshes']):
        ps=item['positions'];vs=[(ps[i]+20,-ps[i+2],ps[i+1]-.48) for i in range(0,len(ps),3)]
        fs=[(i,i+1,i+2) for i in range(0,len(vs),3)]
        mesh('BEFORE_Original_%03d'%mi,vs,fs,item['material'] if item['material'] in mats else 'stone')
box('Review_ground',(9.5,0,-.19),(39,25,.34),'woodDark')
world=bpy.data.worlds.new('Castle_Studio_Sky');world.use_nodes=True
bg=next(n for n in world.node_tree.nodes if n.type=='BACKGROUND')
bg.inputs['Color'].default_value=(.40,.53,.67,1)
bg.inputs['Strength'].default_value=.65;review.world=world
ld=bpy.data.lights.new('Castle_Review_Sun','SUN');ld.energy=2.8;ld.angle=.13
light=bpy.data.objects.new('Castle_Review_Sun',ld);active.objects.link(light);light.rotation_euler=(.5,-.55,-.5)
camd=bpy.data.cameras.new('Castle_Review_Camera');cam=bpy.data.objects.new('Castle_Review_Camera',camd);active.objects.link(cam)
cam.location=(24,-31,23);target=Vector((0,0,7.5));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();camd.type='ORTHO';camd.ortho_scale=27;review.camera=cam
review.render.engine='BLENDER_EEVEE';review.render.resolution_x=1300;review.render.resolution_y=1300;review.render.resolution_percentage=100
review.view_settings.view_transform='AgX';review.render.image_settings.file_format='PNG';review.render.filepath=REV+'/castle-three-quarter.png'
bpy.ops.wm.save_as_mainfile(filepath=OUT+'/castle.blend')
for o in review.objects:
    if o.name.startswith('BEFORE_'):o.hide_render=True
bpy.ops.render.render(write_still=True)
for o in review.objects:
    if o.name.startswith('BEFORE_'):o.hide_render=False

# Keep a review of the roofed stage the player sees before the taller keep grows.
stage4=bpy.data.scenes.new('Castle_Stage4_Review');bpy.context.window.scene=stage4
for col,m in parts:
    if m['lod']==0 and m['minStage']<=4<=m['maxStage']:
        for src in col.objects:
            o=src.copy();o.data=src.data;stage4.collection.objects.link(o)
stage4.world=world
stage4_light=bpy.data.lights.new('Castle_Stage4_Sun','SUN');stage4_light.energy=2.8;stage4_light.angle=.15
stage4_sun=bpy.data.objects.new('Castle_Stage4_Sun',stage4_light)
stage4.collection.objects.link(stage4_sun);stage4_sun.rotation_euler=(.5,-.55,-.5)
stage4_camd=bpy.data.cameras.new('Castle_Stage4_Camera')
stage4_cam=bpy.data.objects.new('Castle_Stage4_Camera',stage4_camd)
stage4.collection.objects.link(stage4_cam);stage4_cam.location=(16,-20,15)
stage4_target=Vector((0,0,3.1))
stage4_cam.rotation_euler=(stage4_target-stage4_cam.location).to_track_quat('-Z','Y').to_euler()
stage4_camd.type='ORTHO';stage4_camd.ortho_scale=17;stage4.camera=stage4_cam
stage4.render.engine=review.render.engine
stage4.render.resolution_x=1100;stage4.render.resolution_y=950
stage4.render.resolution_percentage=100
stage4.render.image_settings.file_format='PNG'
stage4.render.filepath=REV+'/castle-stage4.png'
bpy.ops.render.render(write_still=True)
stage4_cam.location=(8,-18,8.2)
detail_target=Vector((0,-4.5,2.2))
stage4_cam.rotation_euler=(detail_target-stage4_cam.location).to_track_quat('-Z','Y').to_euler()
stage4_camd.ortho_scale=8.5
stage4.render.resolution_x=1050;stage4.render.resolution_y=850
stage4.render.filepath=REV+'/castle-entrance-detail.png'
bpy.ops.render.render(write_still=True)
stage4_cam.location=(16,-20,15)
stage4_cam.rotation_euler=(stage4_target-stage4_cam.location).to_track_quat('-Z','Y').to_euler()
stage4_camd.ortho_scale=17
stage4.render.resolution_x=1100;stage4.render.resolution_y=950
stage4.render.filepath=REV+'/castle-stage4.png'

# Round-trip imports to separate scene; validate material and geometry presence.
roundtrip=bpy.data.scenes.new('Castle_Export_RoundTrip');bpy.context.window.scene=roundtrip
roundtrip_counts={}
for lod in [0,1]:
    bpy.ops.import_scene.gltf(filepath=OUT+f'/ENV_Castle_LOD{lod}.glb')
    imported=[o for o in bpy.context.selected_objects if o.type=='MESH']
    roundtrip_counts[f'LOD{lod}']=sum(len(o.data.polygons) for o in imported)
    for o in imported:o.hide_render=True
with open(REV+'/technical-report.json','w') as f:json.dump({'triangles':counts,'roundTripPolygons':roundtrip_counts,'parts':len(payload['parts'])},f,indent=2)
bpy.context.window.scene=stage4
bpy.ops.wm.save_as_mainfile(filepath=OUT+'/castle.blend')
print('CASTLE_EXPORT',json.dumps(counts),'parts',len(payload['parts']),'roundtrip',roundtrip_counts)
