"""Author civic families and the Archive landmark, then bake runtime geometry.

Run through scripts/blender-mcp-run.py. Only Civic_* scenes are replaced; the
other open scenes and their objects are preserved. Blender uses X/Y/Z with the
front on -Y; the JSON is converted to Three.js X/Y/Z with the front on +Z.
"""
import bpy
import bmesh
import json
import math
import os
import random
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
OUT = ROOT + '/art/blender'
REVIEW_OUT = ROOT + '/art/reviews/civic'
os.makedirs(REVIEW_OUT, exist_ok=True)
random.seed(173)

for old in list(bpy.data.scenes):
    if old.name.startswith(('Civic_Library', 'Civic_Review', 'Civic_Before_Comparison', 'Civic_Export_RoundTrip')):
        owned = list(old.objects)
        cols = list(old.collection.children)
        bpy.data.scenes.remove(old)
        for ob in owned:
            if not ob.users_scene:
                bpy.data.objects.remove(ob, do_unlink=True)
        for col in cols:
            if col.users == 0:
                bpy.data.collections.remove(col)
for mat in list(bpy.data.materials):
    if mat.name.startswith('MAT_Civic_') and mat.users == 0:
        bpy.data.materials.remove(mat)

COLORS = {
    'woodDark': '59402e', 'wood': '80604b', 'woodLight': '9b7759',
    'stone': 'aaa396', 'stoneDark': '777b78', 'plaster': 'e5c9a1',
    'plasterIvory': 'e1d2b4', 'plasterRose': 'dab8a5',
    'window': '50433d', 'glass': '8db3ab', 'iron': '576a72',
    'gold': 'e9c06c', 'red': 'be7062', 'blue': '668db0',
    'earth': '8d795f', 'roof': 'a95745', 'roofDark': '765740',
    'roofBlue': '657f8b', 'leaf': '52775a',
}

def linear(v):
    return v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4

def rgb(h):
    return tuple(linear(int(h[i:i + 2], 16) / 255) for i in (0, 2, 4))

mats = {}
def material(key, h, runtime=None):
    m = bpy.data.materials.new('MAT_Civic_' + key)
    m.diffuse_color = (*rgb(h), 1)
    m.use_nodes = True
    shader = m.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = m.diffuse_color
    shader.inputs['Roughness'].default_value = .93
    m['runtime'] = runtime or key
    mats[key] = m
    return m

for key, h in COLORS.items():
    material(key, h)
material('roofTiles', 'a95745')  # Neutral proxy for the procedural comparison.
PALETTES = [
    ['ad5140', 'bd634c', 'c97558', 'a54c3c'],
    ['76553b', '8a6544', '9a7450', '816046'],
    ['77919e', '8da4ae', '647e8c', '9daeb4'],
]
tile_mats = []
for pi, palette in enumerate(PALETTES):
    tile_mats.append([material(f'tile_{pi}_{i}', h, 'roofTiles') for i, h in enumerate(palette)])

library = bpy.data.scenes.new('Civic_Library')
bpy.context.window.scene = library
library.unit_settings.system = 'METRIC'
parts = []
active = None
meta = None

def group(name, family, lod, lo=3, hi=8):
    global active, meta
    if family in ('mill','archive') and hi==8:hi=6
    active = bpy.data.collections.new(name)
    library.collection.children.link(active)
    meta = dict(name=name, family=family, lod=lod, minStage=lo, maxStage=hi)
    parts.append((active, meta.copy()))

def mesh(name, verts, faces, mat):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    active.objects.link(ob)
    me.materials.append(mats[mat] if isinstance(mat, str) else mat)
    return ob

def box(name, loc, size, mat, bevel=0):
    x, y, z = loc
    a, b, c = [v / 2 for v in size]
    verts = [(x + i * a, y + j * b, z + k * c)
             for i, j, k in [(-1,-1,-1),(-1,-1,1),(-1,1,-1),(-1,1,1),
                             (1,-1,-1),(1,-1,1),(1,1,-1),(1,1,1)]]
    ob = mesh(name, verts, [(0,4,6,2),(1,3,7,5),(0,1,5,4),
                            (2,6,7,3),(0,2,3,1),(4,5,7,6)], mat)
    if bevel:
        mod = ob.modifiers.new('Soft edge', 'BEVEL')
        mod.width = bevel
        mod.segments = 1
        bpy.context.view_layer.objects.active = ob
        ob.select_set(True)
        bpy.ops.object.modifier_apply(modifier=mod.name)
        ob.select_set(False)
    return ob

def beam(name, p, q, width, mat='woodDark'):
    p, q = Vector(p), Vector(q)
    axis = (q-p).normalized()
    u = axis.cross(Vector((0,1,0)))
    if u.length < .01:
        u = axis.cross(Vector((1,0,0)))
    u.normalize()
    u *= width / 2
    v = axis.cross(u) * width / 2
    verts = [tuple(c + i*u + j*v) for c in [p,q]
             for i,j in [(-1,-1),(1,-1),(1,1),(-1,1)]]
    return mesh(name, verts, [(0,3,2,1),(4,5,6,7),(0,1,5,4),
                              (1,2,6,5),(2,3,7,6),(3,0,4,7)], mat)

def gable(name, cx, cy, w, d, eave, rise, wall):
    a, b = w/2, d/2
    verts = [(cx+x, cy+y, z) for y in [-b,b]
             for x,z in [(-a,eave),(a,eave),(0,eave+rise)]]
    return mesh(name, verts, [(0,1,2),(5,4,3),(0,3,4,1),
                              (1,4,5,2),(2,5,3,0)], wall)

def roof(cx, cy, w, d, eave, rise, palette, lod, prefix='roof'):
    half = w/2
    length = math.hypot(half, rise)
    rows = max(3 if lod == 0 else 2, math.ceil(length / (.52 if lod == 0 else 1.35)))
    cols = max(4 if lod == 0 else 3, math.ceil(d / (.66 if lod == 0 else 1.60)))
    for side in [-1,1]:
        down = Vector((side*half/length, 0, -rise/length))
        across = Vector((0,1,0))
        normal = Vector((side*rise/length, 0, half/length))
        origin = Vector((cx,cy,eave+rise))
        def plank(name, s0, s1, y0, y1, lift, thick, mat):
            verts = [tuple(origin + down*s + across*y + normal*z)
                     for z in [lift,lift+thick]
                     for s,y in [(s0,y0),(s1,y0),(s1,y1),(s0,y1)]]
            return mesh(name, verts, [(0,3,2,1),(4,5,6,7),(0,1,5,4),
                                      (1,2,6,5),(2,3,7,6),(3,0,4,7)], mat)
        plank(prefix+'_underlay', 0, length, -d/2, d/2, -.05, .05, 'woodDark')
        for row in range(rows):
            width = d/cols
            offset = (row % 2) * width*.5
            for col in range(cols+1):
                left = max(-d/2, -d/2+(col-1)*width+offset)
                right = min(d/2, left+width-.02) if col else min(d/2, -d/2+offset-.02)
                if right-left < .09:
                    continue
                s0 = row*length/rows
                s1 = min(length+.03, (row+1.13)*length/rows)
                tile = tile_mats[palette][random.randrange(4)]
                plank(prefix+'_shingle', s0, s1, left, right,
                      .025+(rows-row)*.012, .045, tile)
        for yy in [-d/2-.02,d/2+.02]:
            beam(prefix+'_barge', (cx,cy+yy,eave+rise+.015),
                 (cx+side*half,cy+yy,eave), .15)
        beam(prefix+'_fascia', (cx+side*half,cy-d/2,eave),
             (cx+side*half,cy+d/2,eave), .15)
    for i in range(5 if lod == 0 else 3):
        n = 5 if lod == 0 else 3
        cap = gable(prefix+'_ridge',cx,cy-d/2+(i+.5)*d/n,
                    .29,d/n+.03,eave+rise+.065,.14,'roof')
        cap.data.materials.clear()
        cap.data.materials.append(tile_mats[palette][1])

def window(x, y, z, lod, side=False):
    if side:
        def face(name, dx, dz, w, h, depth, mat):
            return box(name,(x+dx,y,z+dz),(depth,w,h),mat)
    else:
        def face(name, dx, dz, w, h, depth, mat):
            return box(name,(x+dx,y,z+dz),(w,depth,h),mat)
    face('window_recess',0,0,.68,.80,.09,'woodDark')
    face('window_glass',0,.01,.51,.61,.055,'glass')
    face('window_mullion',0,.01,.055,.63,.1,'woodLight')
    face('window_sill',0,-.43,.84,.13,.25,'stone')
    if lod == 0:
        face('window_crossbar',0,0,.55,.055,.1,'woodLight')

def doorway(y=-2.28):
    box('door_recess',(0,y,1.10),(1.15,.09,1.85),'window')
    box('door',(0,y-.07,1.08),(.87,.08,1.70),'wood')
    for x in [-.55,.55]:box('door_jamb',(x,y-.09,1.13),(.14,.16,1.94),'woodDark')
    box('door_lintel',(0,y-.10,2.13),(1.23,.19,.18),'woodDark')
    box('door_step',(0,y-.22,.15),(1.30,.42,.19),'stone')
    box('handle',(.30,y-.13,1.12),(.07,.05,.11),'iron')

def frame(eave, lod, upper='plaster'):
    for x in [-2.40,2.40]:
        for y in [-2.14,2.14]:
            box('corner_post',(x,y,(eave+.25)/2),(.18,.17,eave-.25),'woodDark', .016 if lod==0 else 0)
    for y in [-2.26,2.26]:
        for z in [.42,eave-.07]:box('front_crossbar',(0,y,z),(4.95,.16,.18),'woodDark')
        beam('gable_kingpost',(0,y,eave),(0,y,eave+1.45),.16)
        for side in [-1,1]:
            beam('gable_brace',(side*2.13,y,eave+.08),
                 (side*.73,y,eave+1.03),.14)
    for x in [-2.48,2.48]:
        for z in [.43,eave-.07]:box('side_crossbar',(x,0,z),(.15,4.34,.17),'woodDark')
        if lod==0:
            beam('side_brace',(x,-1.96,.54),(x,-.98,eave-.18),.13)

def foundation_and_stages(family,lod,wall):
    prefix=f'ENV_Civic_{family}_LOD{lod}'
    group(prefix+'_foundation',family,lod,1)
    box('foundation',(0,0,.15),(5.18,4.72,.30),'stoneDark')
    if lod==0:
        for y in [-2.30,2.30]:
            for i in range(7):
                box('stone_course',(-2.15+i*.71,y,.30),(.66,.16,.25),'stone',.014)
    group(prefix+'_construction_posts',family,lod,1,2)
    for x in [-2.32,2.32]:
        for y in [-2.08,2.08]:box('post',(x,y,1.05),(.23,.23,1.8),'woodDark')
    group(prefix+'_half_walls',family,lod,2,2)
    box('half_walls',(0,0,.91),(5.0,4.5,1.50),wall)
    return prefix

def common_shell(family,lod,eave,rise,wall,palette):
    prefix=f'ENV_Civic_{family}_LOD{lod}'
    group(prefix+'_shell',family,lod)
    box('wall',(0,0,(eave+.30)/2),(5.0,4.5,eave-.30),wall)
    gable('gable_wall',0,0,5.0,4.5,eave,rise,wall)
    frame(eave,lod)
    doorway()
    for x in [-1.48,1.48]:window(x,-2.24,1.56,lod)
    window(2.46,0,1.58,lod,side=True)
    group(prefix+'_roof',family,lod)
    roof(0,0,5.48,4.96,eave,rise,palette,lod)

def add_stage_extensions(family,lod,wall,palette):
    prefix=f'ENV_Civic_{family}_LOD{lod}'
    group(prefix+'_stage5_shed',family,lod,5)
    # Existing collision proxy: runtime x [1.6,3.8], z [-1.42,1.08].
    box('shed_footing',(2.78,.17,.13),(1.88,2.25,.26),'stoneDark')
    box('shed_wall',(2.78,.17,.95),(1.80,2.16,1.64),'woodLight')
    for x in [1.88,3.68]:
        for y in [-.88,1.22]:box('shed_post',(x,y,.99),(.14,.14,1.72),'woodDark')
    roof(2.78,.17,1.90,2.34,1.84,.55,palette,lod,'shed_roof')
    group(prefix+'_stage6_wing',family,lod,6,6)
    # Existing collision proxy: runtime x [-4.96,-2.06], z [-2.45,.85].
    box('wing_footing',(-3.49,.80,.12),(2.72,2.91,.24),'stoneDark')
    box('wing_wall',(-3.49,.80,.99),(2.62,2.78,1.75),wall)
    gable('wing_gable',-3.49,.80,2.62,2.78,1.87,.78,wall)
    for x in [-4.78,-2.20]:
        for y in [-.48,2.08]:box('wing_post',(x,y,1.04),(.14,.14,1.86),'woodDark')
    window(-3.49,-.65,1.22,lod)
    roof(-3.49,.80,2.82,3.03,1.87,.80,palette,lod,'wing_roof')

def chimney(x,y,eave,height=1.1,width=.62):
    box('chimney_stack',(x,y,eave+height*.5),(width,width,height),'stoneDark')
    box('chimney_cap',(x,y,eave+height),(width+.24,width+.24,.19),'stone')
    box('chimney_opening',(x,y,eave+height+.11),(width-.22,width-.22,.05),'window')

def sign(x,y,z,lod):
    beam('sign_bracket',(x,y,z+.47),(x,y-.50,z+.47),.12,'iron')
    beam('sign_hanger',(x,y-.47,z+.47),(x,y-.47,z+.13),.075,'iron')
    box('hanging_sign',(x,y-.49,z-.17),(.73,.10,.55),'woodDark')
    if lod == 0:
        box('sign_gilt',(x,y-.55,z-.17),(.49,.045,.30),'gold')

def market(lod):
    family='market';wall='plaster'
    prefix=foundation_and_stages(family,lod,wall)
    common_shell(family,lod,2.72,1.65,wall,0)
    group(prefix+'_market_stalls',family,lod,4)
    # Four broad red/ivory strips, with a scalloped lower edge, read as stalls.
    for x in [-1.58,1.58]:
        box('counter',(x,-2.36,.93),(2.02,.53,.22),'woodLight')
        for side in [-.88,.88]:
            box('stall_post',(x+side,-2.54,1.70),(.12,.12,1.91),'woodDark')
        for stripe in range(4):
            xx=x-.79+stripe*.52
            box('striped_canopy',(xx,-2.43,2.75),(.51,.54,.12),
                'red' if stripe%2==0 else 'plasterIvory')
            box('canopy_valance',(xx,-2.70,2.57),(.51,.06,.28),
                'red' if stripe%2==0 else 'plasterIvory')
    add_stage_extensions(family,lod,wall,0)

def tavern(lod):
    family='tavern';wall='plasterIvory'
    prefix=foundation_and_stages(family,lod,wall)
    common_shell(family,lod,3.05,1.94,wall,1)
    group(prefix+'_tavern_identity',family,lod,4)
    box('upper_gallery',(0,-2.33,2.53),(4.34,.24,.18),'woodDark')
    for x in [-1.46,1.46]:window(x,-2.27,2.53,lod)
    sign(2.01,-2.10,2.85,lod)
    chimney(-1.48,.70,3.22,.92,.55)
    add_stage_extensions(family,lod,wall,1)

def forge(lod):
    family='forge';wall='stone'
    prefix=foundation_and_stages(family,lod,wall)
    common_shell(family,lod,2.55,1.34,wall,1)
    group(prefix+'_forge_identity',family,lod,4)
    # Wide masonry stack interrupts the squat roof outline.
    chimney(1.45,.52,2.77,2.16,1.02)
    for z in [.55,1.15,1.75]:
        box('chimney_banding',(1.45,.52,2.77+z),(1.10,1.10,.14),'stone')
    box('forge_hood',(-1.47,-2.33,1.91),(1.30,.33,.29),'iron')
    box('anvil_stand',(-1.42,-2.48,.71),(.58,.36,.63),'woodDark')
    box('anvil',(-1.42,-2.48,1.03),(.78,.48,.20),'iron')
    add_stage_extensions(family,lod,wall,1)

def mill(lod):
    """Tapered masonry mill, slate cap, four framed cloth sails; front is -Y."""
    family='mill'; prefix=f'ENV_Civic_mill_LOD{lod}'; n=12 if lod==0 else 8
    # Preserve the palette sequence of following families when replacing the
    # former gable (118 desktop / 26 mobile shingles).
    for _ in range(118 if lod==0 else 26):random.randrange(4)
    def ring(name,z0,z1,r0,r1,mat):
        angles=[2*math.pi*i/n-math.pi/2-math.pi/n for i in range(n)]
        verts=[(r*math.cos(a),r*math.sin(a),z) for z,r in [(z0,r0),(z1,r1)] for a in angles]
        faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]
        faces += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
        return mesh(name,verts,faces,mat)
    def timber(name,p,q,width,mat='woodDark'):
        p,q=Vector(p),Vector(q); axis=(q-p).normalized()
        u=Vector((0,1,0))*width/2; v=axis.cross(u)
        verts=[tuple(c+i*u+j*v) for c in [p,q] for i,j in [(-1,-1),(1,-1),(1,1),(-1,1)]]
        return mesh(name,verts,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],mat)
    group(prefix+'_foundation',family,lod,1)
    ring('round_stone_plinth',0,.32,2.55,2.48,'stoneDark')
    ring('foundation_lip',.28,.47,2.49,2.49,'stone')
    group(prefix+'_construction_posts',family,lod,1,2)
    for x in [-1.4,1.4]:
        for y in [-1.4,1.4]:box('temporary_frame',(x,y,1.2),(.18,.18,1.7),'woodDark')
    group(prefix+'_half_walls',family,lod,2,2)
    ring('unfinished_round_wall',.4,2.2,2.22,2.02,'stone')
    group(prefix+'_shell',family,lod)
    ring('tower_masonry',.4,2.4,2.22,2.01,'stone')
    ring('limewashed_tower',2.4,7.05,2.01,1.48,'plasterIvory')
    for z,r in [(2.38,2.08),(4.57,1.83),(6.94,1.58)]:
        ring('tower_belt',z,z+.13,r,r-.015,'stoneDark' if z<3 else 'woodDark')
    # Ground courses and scattered exposed masonry keep the tapered shell readable.
    for row in range(4 if lod==0 else 2):
        z=.66+row*.44; radius=2.22-(z-.4)*.105
        for i in range(n):
            a=2*math.pi*(i+.5)/n-math.pi/2-math.pi/n
            if math.sin(a)<-.8:continue
            ob=box('foundation_block',(math.cos(a)*radius*.968,math.sin(a)*radius*.968,z),(.60,.10,.27),'stoneDark' if (i+row)%4==0 else 'stone')
            # Box starts aligned with tangent at the front; rotate vertices about its center.
            center=Vector((math.cos(a)*radius*.968,math.sin(a)*radius*.968,z))
            from mathutils import Matrix
            rot=Matrix.Rotation(a+math.pi/2,3,'Z')
            for v in ob.data.vertices:v.co=center+rot@(v.co-center)
    doorway(-2.06)
    window(0,-1.83,3.55,lod)
    window(0,-1.59,5.65,lod)
    window(1.82,0,3.65,lod,side=True)
    box('axle_bearing',(0,-1.59,6.45),(.66,.34,.64),'woodDark')
    box('fixed_windshaft',(0,-2.02,6.45),(.27,1.10,.27),'iron')
    group(prefix+'_roof',family,lod)
    ring('cap_underlay',7.05,9.05,1.96,.08,'woodDark')
    # Overlapping wedge shingles follow the cone, with restrained slate variation.
    rows=5 if lod==0 else 3
    for row in range(rows):
        t0=row/rows; t1=min(1,(row+1.13)/rows)
        z0=7.02+t0*2.0; z1=7.02+t1*2.0
        r0=2.02*(1-t0)+.08; r1=2.02*(1-t1)+.08
        for i in range(n):
            a=2*math.pi*i/n; b=2*math.pi*(i+.975)/n
            verts=[(r*math.cos(angle),r*math.sin(angle),z+lift) for lift in [0,.085]
                   for r,z,angle in [(r0,z0,a),(r0,z0,b),(r1,z1,b),(r1,z1,a)]]
            mesh('cap_shingle',verts,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],tile_mats[2][(row*3+i)%4])
    ring('cap_finial',9.02,9.43,.13,.035,'gold')
    group(prefix+'_mill_sails',family,lod,4)
    # Socket matches MILL_ROTOR_SOCKET in windmill-layout.ts. Rotor clears the
    # doorway at every angle; complete blade sweep stays above avatar height.
    hub=Vector((0,-2.65,6.45))
    for i in range(4):
        a=math.pi*i/2+math.pi/4
        d=Vector((math.cos(a),0,math.sin(a))); t=Vector((-math.sin(a),0,math.cos(a)))
        def point(radius,spread,depth=0):return hub+d*radius+t*spread+Vector((0,depth,0))
        timber('main_spar',point(.12,0),point(4.08,0),.17)
        timber('outer_frame',point(1.05,.64),point(4.08,.88),.10,'wood')
        for r,w in [(1.05,.64),(4.08,.88)]:timber('end_frame',point(r,0),point(r,w),.10,'wood')
        # Slight billow, inset from the frame. Closed panel gives both faces normals.
        corners=[point(1.18,.13,.025),point(1.18,.56,.025),point(3.96,.77,.025),point(3.96,.13,.025)]
        verts=[tuple(p+Vector((0,dy,0))) for dy in [-.025,.025] for p in corners]
        mesh('linen_sail',verts,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],'plaster')
        for rib in range(1,7 if lod==0 else 4):
            r=1.05+rib*3.03/(7 if lod==0 else 4); w=.64+(r-1.05)*.24/3.03
            timber('lattice_rib',point(r,.04,-.06),point(r,w,-.06),.065,'woodLight')
    box('hub_block',tuple(hub),(.55,.36,.55),'woodDark')
    box('iron_hub_pin',(0,-2.87,6.45),(.22,.12,.22),'iron')
    add_stage_extensions(family,lod,'plasterIvory',2)

def guild(lod):
    family='guild';wall='stone'
    prefix=foundation_and_stages(family,lod,wall)
    common_shell(family,lod,3.10,1.76,wall,2)
    group(prefix+'_guild_hall',family,lod,4)
    # Cool masonry lower floor and warm panelled upper hall.
    box('upper_plaster',(0,-2.31,2.47),(4.58,.09,1.08),'plasterIvory')
    for side in [-1,1]:
        box('side_upper_plaster',(side*2.52,0,2.47),(.09,4.08,1.08),'plasterIvory')
        box('side_upper_sill',(side*2.57,0,1.87),(.15,4.20,.16),'woodDark')
    for x in [-2.28,0,2.28]:
        box('upper_post',(x,-2.39,2.47),(.17,.15,1.13),'woodDark')
    box('upper_sill',(0,-2.42,1.87),(4.71,.17,.16),'woodDark')
    box('upper_header',(0,-2.42,3.05),(4.71,.17,.16),'woodDark')
    for x in [-1.20,1.20]:window(x,-2.43,2.45,lod)
    box('hall_crest',(0,-2.51,3.54),(.66,.10,.48),'gold')
    add_stage_extensions(family,lod,wall,2)

def post(lod):
    family='post';wall='plaster'
    prefix=foundation_and_stages(family,lod,wall)
    common_shell(family,lod,2.66,1.52,wall,0)
    group(prefix+'_post_identity',family,lod,4)
    # Small raised corner tower and a clear letter box by the arrival.
    box('tower_body',(1.55,.88,3.20),(1.43,1.36,1.65),'woodLight')
    for x in [.85,2.25]:
        for y in [.21,1.54]:box('tower_corner',(x,y,3.23),(.14,.14,1.73),'woodDark')
    roof(1.55,.88,1.77,1.65,4.05,.89,0,lod,'tower_roof')
    box('letter_box',(-1.70,-2.39,1.08),(.63,.28,.66),'woodDark')
    box('letter_slot',(-1.70,-2.55,1.22),(.39,.04,.045),'gold')
    box('banner_pole',(1.58,-1.01,5.22),(.075,.075,.93),'woodDark')
    box('banner',(1.87,-1.02,5.37),(.54,.08,.49),'red')
    add_stage_extensions(family,lod,wall,0)

def archive(lod):
    """Dedicated library landmark: stepped gable, glazed reading hall and book crest."""
    family='archive';prefix=foundation_and_stages(family,lod,'stone')
    # Closed extruded pointed arches, with a separate stone surround.
    def arch(name,cx,y,z,w,h,depth,mat):
        outline=[(-w/2,0),(w/2,0),(w/2,h-w*.42),(w*.34,h-w*.17),(0,h),(-w*.34,h-w*.17),(-w/2,h-w*.42)]
        verts=[(cx+x,y+dy,z+zz) for dy in [-depth/2,depth/2] for x,zz in outline]
        n=len(outline)
        return mesh(name,verts,[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)],mat)
    def book(cx,y,z,scale=1):
        # Open pages are a shallow V in the facade plane, framed by dark covers.
        for side in [-1,1]:
            x0=cx; x1=cx+side*.84*scale
            pts=[(x0,y,z-.36*scale),(x1,y+.06,z-.48*scale),(x1,y+.06,z+.48*scale),(x0,y,z+.36*scale)]
            for name,offset,mat in [('book_cover',0,'woodDark'),('book_pages',-.055*scale,'plasterIvory')]:
                verts=[(x,yy+offset+dy,zz) for dy in [0,.07*scale] for x,yy,zz in pts]
                mesh(name,verts,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],mat)
            if lod==0:
                for line in range(3):box('page_ink',(cx+side*.46*scale,y-.065*scale,z+(.19-line*.18)*scale),(.46*scale,.022,.025*scale),'gold')
        box('book_spine',(cx,y-.09*scale,z),(.08*scale,.10*scale,.82*scale),'gold')
        box('ribbon_bookmark',(cx+.28*scale,y-.09*scale,z-.52*scale),(.13*scale,.035,.28*scale),'red')
    group(prefix+'_reading_hall',family,lod)
    box('masonry_hall',(0,0,2.56),(4.82,4.30,4.52),'plasterIvory')
    gable('hall_gables',0,0,4.82,4.30,4.82,2.35,'stone')
    for z in [.50,2.65,4.77]:box('stone_string_course',(0,0,z),(4.96,4.43,.17),'stoneDark')
    # Broad corner buttresses and their sloped shoulders anchor the taller hall.
    for x in [-2.40,2.40]:
        for y in [-2.15,2.15]:
            box('buttress',(x,y,2.15),(.34,.36,3.65),'stone')
            box('buttress_plinth',(x,y,.58),(.48,.46,.42),'stoneDark')
            box('buttress_cap',(x,y,4.06),(.48,.48,.17),'stoneDark')
    arch('door_surround',0,-2.28,.29,1.69,2.42,.16,'stoneDark')
    arch('double_door',0,-2.39,.35,1.33,2.13,.10,'woodDark')
    for x in [-.32,.32]:
        box('door_panel',(x,-2.46,1.20),(.52,.07,1.42),'wood')
        box('door_handle',(x*.35,-2.51,1.12),(.09,.06,.21),'gold')
    box('front_step',(0,-2.39,.20),(2.04,.60,.25),'stone')
    # Large lancet glazing and deep mullions replace the cottage-sized window pair.
    arch('great_window_stone',0,-2.23,2.96,2.08,3.05,.18,'woodDark')
    arch('great_window_glass',0,-2.35,3.11,1.76,2.73,.08,'glass')
    for x in [-.57,0,.57]:box('window_mullion',(x,-2.42,4.09),(.08,.08,1.94),'gold' if x==0 else 'woodLight')
    box('great_window_transom',(0,-2.43,4.58),(1.73,.10,.10),'woodLight')
    for x in [-1.73,1.73]:
        arch('side_lancet_frame',x,-2.25,1.14,.61,1.24,.12,'woodDark')
        arch('side_lancet',x,-2.34,1.23,.43,1.03,.07,'glass')
    # Two bays on each side give the reading hall a recognisable long elevation.
    for side in [-1,1]:
        for y in ([-.98,1.02] if lod==0 else [-.98]):
            box('reading_window_recess',(side*2.43,y,3.55),(.10,.88,1.52),'woodDark')
            box('reading_window_glass',(side*2.49,y,3.55),(.05,.66,1.31),'glass')
            box('reading_window_mullion',(side*2.53,y,3.55),(.08,.07,1.36),'woodLight')
            box('reading_window_sill',(side*2.49,y,2.76),(.25,1.01,.14),'stone')
    group(prefix+'_stepped_roof',family,lod)
    roof(0,0,5.24,4.71,4.82,2.35,2,lod,'library_roof')
    # The stepped parapet projects in front of the roof; it is solid all the way
    # down to the gable so the silhouette has no floating blocks or open seams.
    for y in ([-2.41,2.41] if lod==0 else [-2.41]):
        for side in [-1,1]:
            for i in range(4):
                x=side*(2.21-i*.61); base=4.82+2.35*(1-abs(x)/2.41)
                box('gable_step',(x,y,base+.16),(.63,.25,.55),'stone')
                box('gable_step_cap',(x,y,base+.45),(.69,.31,.13),'stoneDark')
        box('gable_crown',(0,y,7.38),(.62,.30,.54),'stone')
        box('crown_cap',(0,y,7.68),(.75,.36,.13),'gold')
    group(prefix+'_archive_identity',family,lod,4)
    # Oversized book crest reads as knowledge even from the game camera.
    box('crest_backing',(0,-2.45,2.81),(2.06,.18,.94),'blue')
    book(0,-2.59,2.84,1.0)
    for x in [-1.80,1.80]:
        box('banner_bracket',(x,-2.43,4.35),(.76,.20,.11),'gold')
        box('blue_pennant',(x,-2.45,3.69),(.48,.07,1.20),'blue')
        box('banner_gold_stripe',(x,-2.50,3.69),(.06,.025,.94),'gold')
    # Visible book spines in the lower side bays communicate the interior use.
    for side in [-1,1]:
        for y in ([-.97,1.00] if lod==0 else [-.97]):
            box('shelf_recess',(side*2.44,y,1.45),(.10,1.05,1.43),'woodDark')
            for row in range(2 if lod==0 else 1):
                box('shelf_board',(side*2.52,y,.92+row*.63),(.19,1.07,.10),'wood')
                for j in range(4 if lod==0 else 3):
                    yy=y-.36+j*(.24 if lod==0 else .34)
                    box('bound_volume',(side*2.53,yy,1.16+row*.63),(.13,.15,.35+(j%2)*.08),['blue','red','woodLight','gold'][j])
    group(prefix+'_stage5_scriptorium',family,lod,5)
    box('scriptorium_base',(2.79,.17,.16),(1.88,2.24,.32),'stoneDark')
    box('scriptorium_wall',(2.79,.17,1.51),(1.80,2.16,2.70),'plasterIvory')
    gable('scriptorium_gable',2.79,.17,1.80,2.16,2.86,.89,'stone')
    roof(2.79,.17,1.86,2.34,2.86,.89,2,lod,'scriptorium_roof')
    arch('scriptorium_window_frame',2.79,-.95,.86,1.13,1.71,.13,'woodDark')
    arch('scriptorium_window',2.79,-1.04,.98,.88,1.42,.07,'glass')
    box('scriptorium_mullion',(2.79,-1.10,1.59),(.075,.06,1.23),'woodLight')
    group(prefix+'_stage6_map_room',family,lod,6)
    box('map_room_base',(-3.49,.80,.15),(2.72,2.91,.30),'stoneDark')
    box('map_room_wall',(-3.49,.80,1.45),(2.62,2.78,2.60),'plasterIvory')
    gable('map_room_gable',-3.49,.80,2.62,2.78,2.75,1.08,'stone')
    roof(-3.49,.80,2.78,3.03,2.75,1.08,2,lod,'map_room_roof')
    arch('map_room_window_frame',-3.49,-.64,.97,1.68,1.92,.13,'woodDark')
    arch('map_room_window',-3.49,-.75,1.10,1.39,1.61,.07,'glass')
    for x in [-3.90,-3.49,-3.08]:box('map_room_mullion',(x,-.80,1.70),(.07,.07,1.17),'woodLight')

def developed_civic(family,lod):
    palette={'market':0,'tavern':1,'forge':1,'guild':2,'post':0}[family]
    wall={'market':'plaster','tavern':'plasterIvory','forge':'stone','guild':'stone','post':'plaster'}[family]
    prefix=f'ENV_Civic_{family}_LOD{lod}'
    group(prefix+'_stage7_upper_wing',family,lod,7)
    box('upper_wing_footing',(-3.49,.80,.12),(2.72,2.91,.24),'stoneDark')
    box('two_storey_wing',(-3.49,.80,1.83),(2.62,2.78,3.43),wall)
    gable('upper_wing_gable',-3.49,.80,2.62,2.78,3.55,.80,wall)
    for x in [-4.78,-2.20]:
        for y in [-.48,2.08]:box('tall_corner_post',(x,y,1.89),(.14,.14,3.54),'woodDark')
    for y in [-.63,2.21]:box('wing_floor_beam',(-3.49,y,2.05),(2.64,.14,.18),'woodDark')
    window(-3.49,-.65,1.22,lod)
    window(-3.49,-.65,2.81,lod)
    roof(-3.49,.80,2.82,3.03,3.55,.80,palette,lod,'upper_wing_roof')
    group(prefix+'_stage8_roof_lantern',family,lod,8)
    # A family-specific roof feature makes the final upgrade legible at town scale.
    if family=='forge':
        chimney(-1.20,.55,2.90,2.65,.76)
        for z in [4.25,5.20]:box('kiln_iron_band',(-1.20,.55,z),(.82,.82,.15),'iron')
    else:
        peak={'market':4.37,'tavern':4.99,'guild':4.86,'post':4.18}[family]
        base=peak-.40
        box('clerestory_body',(0,.65,base+.45),(1.12,1.18,.90),wall)
        for x in [-.56,.56]:
            for y in [.07,1.23]:box('lantern_corner',(x,y,base+.45),(.12,.12,1.00),'woodDark')
        box('lantern_window',(0,.015,base+.52),(.76,.10,.57),'glass')
        box('lantern_mullion',(0,-.05,base+.52),(.075,.08,.59),'woodLight')
        gable('lantern_gable',0,.65,1.12,1.18,base+.9,.69,wall)
        roof(0,.65,1.48,1.55,base+.9,.69,palette,lod,'lantern_roof')
        if family in ('market','guild'):
            box('civic_finial',(0,.65,base+1.86),(.12,.12,.47),'gold')

BUILDERS = dict(market=market,tavern=tavern,forge=forge,
                mill=mill,guild=guild,post=post,archive=archive)
for lod in [0,1]:
    for name,build in BUILDERS.items():
        state=random.getstate()
        build(lod)
        if name=='archive':random.setstate(state)  # New family leaves legacy palettes stable.
        if name in ('market','tavern','forge','guild','post'):
            after=random.getstate();developed_civic(name,lod);random.setstate(after)

# Each stage collection becomes one mesh per material. This is the runtime draw
# grouping; roof tile face colors are retained only for MAT.roofTiles.
for col, data in parts:
    grouped = {}
    for ob in list(col.objects):
        grouped.setdefault(ob.data.materials[0]['runtime'], []).append(ob)
    for key, objects in grouped.items():
        bpy.ops.object.select_all(action='DESELECT')
        for ob in objects:ob.select_set(True)
        bpy.context.view_layer.objects.active = objects[0]
        if len(objects)>1:bpy.ops.object.join()
        ob = objects[0] if len(objects)==1 else bpy.context.object
        ob.name = data['name']+'_'+key
        ob['runtime_material'] = key
        for k,v in data.items():ob[k] = v
        ob.select_set(False)

def bake(ob):
    me = ob.data
    me.calc_loop_triangles()
    positions,normals,colors,indices=[],[],[],[]
    lookup={}
    for tri in me.loop_triangles:
        mat=me.materials[tri.material_index]
        color=tuple(round(c,5) for c in mat.diffuse_color[:3])
        for vi in tri.vertices:
            p=me.vertices[vi].co
            n=tri.normal
            pos=tuple(round(v,5) for v in (p.x,p.z,-p.y))
            nor=tuple(round(v,5) for v in (n.x,n.z,-n.y))
            key=(pos,nor,color)
            if key not in lookup:
                lookup[key]=len(positions)//3
                positions.extend(pos)
                normals.extend(nor)
                colors.extend(color)
            indices.append(lookup[key])
    payload=dict(name=ob['name']+'_'+ob['runtime_material'],material=ob['runtime_material'],
                 positions=positions,normals=normals,indices=indices)
    if ob['runtime_material']=='roofTiles':payload['colors']=colors
    return payload

payload={'version':1,'coordinates':'three-y-up','parts':[]}
for col,data in parts:
    for ob in col.objects:
        payload['parts'].append({**data,**bake(ob)})
os.makedirs(ROOT+'/src/town/generated',exist_ok=True)
runtime=ROOT+'/src/town/generated/civic.json'
with open(runtime+'.tmp','w') as f:json.dump(payload,f,separators=(',',':'))
os.replace(runtime+'.tmp',runtime)

for lod in [0,1]:
    for family in BUILDERS:
        bpy.ops.object.select_all(action='DESELECT')
        for col,data in parts:
            if data['family']==family and data['lod']==lod and data['minStage']<=(6 if family in ('mill','archive') else 8)<=data['maxStage']:
                for ob in col.objects:ob.select_set(True)
        bpy.ops.export_scene.gltf(
            filepath=f'{OUT}/ENV_Civic_{family}_LOD{lod}.glb',
            use_selection=True,use_active_scene=True,export_format='GLB',
            export_yup=True,export_cameras=False,export_lights=False)

comparison=bpy.data.scenes.new('Civic_Before_Comparison')
comparison_col=bpy.data.collections.new('Original_Procedural_Civic')
comparison.collection.children.link(comparison_col)
original_path='/tmp/town-original-civic.json'
if os.path.exists(original_path):
    original=json.load(open(original_path))
    active=comparison_col
    for item in original:
        for index,data in enumerate(item['meshes']):
            ps=data['positions']
            verts=[(ps[i]+item['offset'], -ps[i+2], ps[i+1]-.48)
                   for i in range(0,len(ps),3)]
            ids=data['indices'] or list(range(len(verts)))
            if data['material'] in mats:
                mesh('BEFORE_'+item['kind']+'_'+str(index),verts,
                     [tuple(ids[i:i+3]) for i in range(0,len(ids),3)],
                     data['material'])
    for index,family in enumerate(BUILDERS):
        parent=bpy.data.objects.new('AFTER_'+family,None)
        comparison_col.objects.link(parent)
        parent.location=(index*12+5,0,0)
        for col,data in parts:
            if (data['family']==family and data['lod']==0
                and data['minStage']<=(6 if family in ('mill','archive') else 8)<=data['maxStage']):
                for source in col.objects:
                    ob=source.copy();ob.data=source.data;ob.parent=parent
                    comparison_col.objects.link(ob)

review=bpy.data.scenes.new('Civic_Review')
bpy.context.window.scene=review
active=bpy.data.collections.new('Review_Assembly')
review.collection.children.link(active)
positions={'market':(-10,-8,0),'tavern':(-2,-8,0),'forge':(7,-8,0),
           'mill':(-10,4,0),'guild':(-2,4,0),'archive':(7,4,0)}
for family,loc in positions.items():
    parent=bpy.data.objects.new('Review_'+family,None)
    active.objects.link(parent)
    parent.location=loc
    for col,data in parts:
        if data['family']==family and data['lod']==0 and data['minStage']<=(6 if family in ('mill','archive') else 8)<=data['maxStage']:
            for source in col.objects:
                ob=source.copy();ob.data=source.data;ob.parent=parent;active.objects.link(ob)
box('Review_Ground',(-1,0,-.21),(31,26,.35),'earth')
world=bpy.data.worlds.new('Civic_Studio_Sky')
world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(.43,.54,.68,1)
world.node_tree.nodes['Background'].inputs[1].default_value=.55
review.world=world
sun_data=bpy.data.lights.new('Review_Sun','SUN');sun_data.energy=2.7;sun_data.angle=.14
sun=bpy.data.objects.new('Review_Sun',sun_data);active.objects.link(sun)
sun.rotation_euler=(.45,-.60,-.45)
fill_data=bpy.data.lights.new('Review_Fill','AREA');fill_data.energy=1800;fill_data.shape='DISK';fill_data.size=16
fill=bpy.data.objects.new('Review_Fill',fill_data);active.objects.link(fill);fill.location=(-8,-12,15)
camera_data=bpy.data.cameras.new('Review_Camera')
camera=bpy.data.objects.new('Review_Camera',camera_data);active.objects.link(camera)
camera.location=(25,-34,28)
target=Vector((-1,-1,1.5))
camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
camera_data.type='ORTHO';camera_data.ortho_scale=34
review.camera=camera
review.render.engine='CYCLES'
review.cycles.samples=28
review.cycles.use_denoising=True
review.render.resolution_x=1800
review.render.resolution_y=1200
review.render.resolution_percentage=100
review.view_settings.view_transform='AgX'
review.render.image_settings.file_format='PNG'
review.render.filepath=REVIEW_OUT+'/families-review.png'
bpy.data.libraries.write(OUT+'/civic.blend', {library, review, comparison}, fake_user=True)

report={}
for family in BUILDERS:
    for lod in [0,1]:
        relevant=[part for part in payload['parts']
                  if part['family']==family and part['lod']==lod
                  and part['minStage']<=(6 if family in ('mill','archive') else 8)<=part['maxStage']]
        tri=sum(len(part['indices'])//3 for part in relevant)
        coords=[v for part in relevant for v in part['positions']]
        bounds={'min':[min(coords[i::3]) for i in range(3)],
                'max':[max(coords[i::3]) for i in range(3)]}
        report[f'{family}_LOD{lod}']={'triangles':tri,'bounds':bounds,
                                      'materials':sorted(set(p['material'] for p in relevant))}
with open(REVIEW_OUT+'/geometry-report.json','w') as f:json.dump(report,f,indent=2)
print('CIVIC_EXPORT',json.dumps({k:v['triangles'] for k,v in report.items()}),'parts',len(payload['parts']))
