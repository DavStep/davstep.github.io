"""Authored hero landmark kit in runtime X/Y-up/Z-front coordinates.
Invoked by build_landmarks.py; stages and LODs share the same assembly grammar.
"""
import math
from mathutils import Vector

def author_landmark(family,lod,emit):
    stage=3;hi=6;serial=0
    def mesh(name,vs,fs,mat):
        nonlocal serial
        serial+=1;emit(name+'_'+str(serial),vs,fs,mat,stage,hi)
    def prism(name,ring,y0,y1,mat):
        n=len(ring);vs=[(x,y,z)for y in [y0,y1]for x,z in ring]
        mesh(name,vs,[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n)for i in range(n)],mat)
    def box(name,x,y,z,w,h,d,mat):
        b=min(.065,w*.10,d*.10)if lod==0 else 0
        if b:
            ring=[(-w/2+b,-d/2),(w/2-b,-d/2),(w/2,-d/2+b),(w/2,d/2-b),(w/2-b,d/2),(-w/2+b,d/2),(-w/2,d/2-b),(-w/2,-d/2+b)]
        else:ring=[(-w/2,-d/2),(w/2,-d/2),(w/2,d/2),(-w/2,d/2)]
        prism(name,[(x+a,z+c)for a,c in ring],y-h/2,y+h/2,mat)
    def beam(name,a,b,width,mat):
        a,b=Vector(a),Vector(b);v=(b-a).normalized();u=v.cross(Vector((0,1,0)))
        if u.length<.01:u=v.cross(Vector((1,0,0)))
        u.normalize();u*=width/2;t=v.cross(u)
        vs=[tuple(p+i*u+j*t)for p in[a,b]for i,j in[(-1,-1),(1,-1),(1,1),(-1,1)]]
        mesh(name,vs,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],mat)
    def tube(name,a,b,r,mat):
        a,b=Vector(a),Vector(b);v=(b-a).normalized();u=v.cross(Vector((0,1,0)))
        if u.length<.01:u=v.cross(Vector((1,0,0)))
        u.normalize();t=v.cross(u);n=12 if lod==0 else 8
        vs=[tuple(p+r*(math.cos(i*math.tau/n)*u+math.sin(i*math.tau/n)*t))for p in[a,b]for i in range(n)]
        mesh(name,vs,[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n)for i in range(n)],mat)
    def cyl(name,x,y,z,r,h,mat,n=None,r2=None,axis='y'):
        n=n or(14 if lod==0 else 8);r2=r if r2 is None else r2
        vs=[]
        for k,rad in [(-.5,r),(.5,r2)]:
            for i in range(n):
                a=i*math.tau/n;p=(math.cos(a)*rad,k*h,math.sin(a)*rad)
                if axis=='x':p=(p[1],p[0],p[2])
                if axis=='z':p=(p[0],p[2],p[1])
                vs.append((x+p[0],y+p[1],z+p[2]))
        mesh(name,vs,[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n)for i in range(n)],mat)
    def orb(name,x,y,z,sx,sy,sz,mat):
        n=10 if lod==0 else 7;m=5 if lod==0 else 3
        vs=[(x+sx*math.sin(j*math.pi/m)*math.cos(i*math.tau/n),y+sy*math.cos(j*math.pi/m),z+sz*math.sin(j*math.pi/m)*math.sin(i*math.tau/n))for j in range(m+1)for i in range(n)]
        fs=[]
        for j in range(m):
            for i in range(n):
                a=j*n+i;b=j*n+(i+1)%n;c=b+n;d=a+n
                if j==0:fs.append((a,c,d))
                elif j==m-1:fs.append((a,b,c))
                else:fs.append((a,b,c,d))
        mesh(name,vs,fs,mat)
    def rock(name,x,y,z,sx,sy,sz,mat):
        n=7 if lod==0 else 5
        vs=[]
        for k,(height,radius) in enumerate([(-.90,.78),(.05,1.0),(.84,.62)]):
            for i in range(n):
                a=math.tau*i/n+.09*k
                rad=radius*(.92+.08*math.sin(i*2.3+k))
                vs.append((x+math.cos(a)*sx*rad,y+sy*(height+.08*math.sin(i*1.7+k)),z+math.sin(a)*sz*rad))
        fs=[tuple(range(n-1,-1,-1)),tuple(range(2*n,3*n))]
        for k in range(2):
            for i in range(n):fs.append((k*n+i,k*n+(i+1)%n,(k+1)*n+(i+1)%n,(k+1)*n+i))
        mesh(name,vs,fs,mat)
    def roof(name,x,y,z,w,d,rise,mat):
        mesh(name+'_gable',[(x-w/2,y,z-d/2),(x+w/2,y,z-d/2),(x,y+rise,z-d/2),(x-w/2,y,z+d/2),(x+w/2,y,z+d/2),(x,y+rise,z+d/2)],[(0,1,2),(3,5,4),(0,3,4,1),(0,2,5,3),(1,4,5,2)],'woodDark')
        rows=4 if lod==0 else 2;cols=6 if lod==0 else 3
        for side in [-1,1]:
            for row in range(rows):
                t0=row/rows;t1=min(1,(row+1.07)/rows)
                for col in range(cols):
                    za=z-d/2+col*d/cols;zb=za+d/cols-.025
                    xa=x+side*w/2*(1-t0);xb=x+side*w/2*(1-t1)
                    ya=y+rise*t0+.06+row*.014;yb=y+rise*t1+.06+row*.014
                    vs=[(xa,ya,za),(xa,ya,zb),(xb,yb,zb),(xb,yb,za)]
                    mesh(name+'_tile',vs+[(a,b-.09,c)for a,b,c in vs],[(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],mat if(row+col)%4 else ('blue'if mat=='violet'else 'woodLight' if mat=='roofDark' else mat))
            for zz in[z-d/2,z+d/2]:beam(name+'_verge',(x+side*w/2,y,zz),(x,y+rise,zz),.13,'woodDark')
        beam(name+'_ridge',(x,y+rise+.1,z-d/2),(x,y+rise+.1,z+d/2),.16,'gold'if mat=='violet'else'woodDark')
    def window(x,y,z,w=.65,h=.85):
        box('window_recess',x,y,z,w,h,.09,'ink')
        for xx in[x-w/2-.07,x+w/2+.07]:box('window_jamb',xx,y,z+.05,.13,h+.23,.17,'woodDark')
        box('window_sill',x,y-h/2-.07,z+.08,w+.30,.14,.26,'stone')
        box('window_mullion',x,y,z+.10,.08,h,.08,'gold')
    def flag(x,y,z,mat,base_y=None):
        beam('flagstaff',(x,y-1.6 if base_y is None else base_y,z),(x,y+.2,z),.09,'woodDark')
        mesh('pennant',[(x,y,z),(x+.75,y-.10,z),(x+.59,y-.53,z),(x,y-.46,z)],[(0,1,2,3)],mat)
    def barrel(x,z):
        cyl('barrel',x,.96,z,.37,1.05,'woodLight',10 if lod==0 else 6,r2=.32)
        for y in[.63,1.3]:cyl('barrel_hoop',x,y,z,.39,.09,'iron',10 if lod==0 else 6)
    def base():
        box('foundation',0,.22,0,9.2,.36,8.1,'stoneDark')
        box('paving',0,.43,0,8.95,.13,7.87,'sand')
    if family=='outpost':
        base();box('trade_hall',0,2.02,-.94,6.2,3.05,3.90,'plasterIvory')
        for x in[-3,0,3]:box('timber_upright',x,2.06,1.08,.22,3.15,.23,'woodDark')
        for y in[.73,3.50]:box('facade_beam',0,y,1.08,6.35,.22,.25,'woodDark')
        box('trade_door',0,1.60,1.15,1.3,2.16,.12,'woodLight')
        for x in[-2,2]:window(x,2.17,1.13,.90,.90)
        for x in[-3.48,3.48]:
            beam('awning_post',(x,.5,3.42),(x,2.98,3.42),.19,'woodDark')
            beam('awning_brace',(x,2.1,3.42),(x,3.09,2.47),.14,'woodDark')
        for i in range(8 if lod==0 else 4):
            n=8 if lod==0 else 4;a=-3.7+i*7.4/n;b=a+7.4/n
            mesh('striped_canvas',[(a,3.45,1.0),(b,3.45,1.0),(b,3.0,3.60),(a,3.0,3.60)],[(0,1,2,3)],'olive'if i%2 else'plasterIvory')
            box('canvas_valance',(a+b)/2,2.87,3.60,b-a,.29,.06,'olive'if i%2 else'plasterIvory')
        box('trading_counter',0,1.05,2.9,4.5,1.05,.70,'woodDark');box('counter_planks',0,1.62,2.9,4.7,.14,.83,'woodLight')
        for x in[-1.4,0,1.4]:box('supply_basket',x,1.83,2.9,.74,.29,.56,'sand')
        for side in[-1,1]:
            for z in[-2.81,-1.0,.9]:box('hall_side_timber',side*3.14,2.03,z,.17,3.07,.17,'woodDark')
            for z in[-1.91,-.04]:
                box('hall_side_window',side*3.16,2.21,z,.10,.86,.69,'ink')
                box('hall_side_sill',side*3.23,1.70,z,.25,.14,.95,'woodDark')
                box('hall_side_mullion',side*3.23,2.21,z,.10,.86,.075,'woodLight')
            beam('side_diagonal_brace',(side*3.22,.80,-2.73),(side*3.22,1.57,-1.15),.13,'woodDark')
        stage=4;roof('hall_shingle',0,3.63,-.94,6.85,4.45,2.03,'roofDark')
        box('hanging_trade_sign',0,3.75,1.52,1.8,.68,.17,'woodDark')
        for x in[-.35,.35]:cyl('coin_emblem',x,3.75,1.64,.20,.08,'gold',10,axis='z')
        barrel(3.63,2.0)
        stage=5
        box('watchtower_base',-2.15,4.0,-1.9,1.7,7.0,1.65,'woodDark')
        box('watchtower_booth',-2.15,6.64,-1.9,2.15,1.44,2.0,'plasterIvory')
        window(-2.15,6.7,-.86,.96,.73)
        roof('watch_roof',-2.15,7.4,-1.9,2.65,2.53,1.0,'roofDark')
        stage=6;flag(-2.15,9.70,-1.9,'red');barrel(-3.75,2.10)
        box('supply_crate',3.65,.98,-2.8,1.05,.95,1.05,'woodLight')
        beam('crate_brace',(3.15,.55,-2.24),(4.14,1.43,-2.24),.13,'woodDark')
    elif family=='sandship':
        base()
        for side in[-1,1]:
            box('track_belt',side*3.15,1.12,0,1.48,1.18,6.85,'ink')
            for z in[-2.55,-.85,.85,2.55]:
                cyl('track_wheel',side*3.94,1.13,z,.49,.12,'iron',12 if lod==0 else 8,axis='x')
                cyl('wheel_hub',side*4.02,1.13,z,.19,.14,'copper',8,axis='x')
            for z in[-3.10,-2.4,-1.7,-1.0,-.3,.4,1.1,1.8,2.5,3.1]:box('track_tread',side*3.15,1.77,z,1.58,.13,.19,'iron')
        prism('armoured_hull',[(-2.8,-3.2),(2.8,-3.2),(3.05,1.6),(1.8,3.45),(-1.8,3.45),(-3.05,1.6)],1.55,3.25,'iron')
        box('deck',0,3.3,-.1,6.50,.25,5.75,'copper')
        box('factory_cabin',0,4.44,-.67,3.40,2.07,3.0,'sand')
        roof('cabin_cap',0,5.48,-.67,3.80,3.38,.53,'copper')
        for x in[-1.05,0,1.05]:window(x,4.60,.90,.67,.81)
        box('front_conveyor',0,3.52,2.70,1.83,.25,2.15,'ink')
        for z in[1.83,2.22,2.61,3.00,3.39]:box('conveyor_roller',0,3.71,z,1.70,.15,.16,'iron')
        cyl('prow_gear',0,2.37,3.51,.46,.14,'copper',12,axis='z')
        cyl('gear_hub',0,2.37,3.60,.19,.10,'iron',8,axis='z')
        for x in[-1.37,1.37]:cyl('headlamp',x,2.56,3.5,.19,.16,'gold',8,axis='z')
        for side in[-1,1]:
            for z in[-1.55,-.65,.25]:
                box('cabin_side_window',side*1.73,4.58,z,.10,.72,.50,'ink')
                box('side_window_sill',side*1.78,4.16,z,.19,.12,.67,'copper')
        stage=4
        for side in[-1,1]:
            cyl('side_boiler',side*2.13,4.04,-.65,.55,2.5,'copper',axis='z')
            for z in[-1.5,.15]:cyl('boiler_band',side*2.13,4.04,z,.61,.13,'iron',axis='z')
            cyl('power_lens',side*2.13,4.04,.64,.35,.12,'cyan',axis='z')
            for z in[-2.5,1.35]:beam('rail_post',(side*2.9,3.43,z),(side*2.9,4.15,z),.11,'iron')
            beam('safety_rail',(side*2.9,4.15,-2.5),(side*2.9,4.15,1.35),.11,'iron')
        stage=5
        for x,h in[(-2.0,8.8),(2.0,7.5)]:
            cyl('smokestack',x,(h+3.5)/2,-2.14,.32,h-3.5,'iron')
            cyl('chimney_flare',x,h-.15,-2.14,.49,.35,'copper',r2=.60)
            cyl('soot_opening',x,h+.031,-2.14,.45,.04,'ink')
        stage=6;flag(.5,9.60,-1.5,'red',5.80)
        for x in[-.8,.1,.9]:box('export_crate',x,4.04,2.60,.52,.5,.62,'woodLight')
    elif family=='battle':
        cyl('arena_plinth',0,.28,0,4.50,.36,'stoneDark',24 if lod==0 else 16)
        cyl('sand_arena',0,.51,0,4.25,.14,'sand',24 if lod==0 else 16)
        # The card is the central heraldic monument; the tournament yard surrounds it.
        for x in[-1.46,1.46]:box('card_pier',x,2.86,-1.88,.42,4.67,.50,'stoneDark')
        box('card_frame',0,4.15,-1.9,3.55,4.85,.35,'gold')
        box('card_dark_inset',0,4.15,-1.66,3.21,4.51,.12,'ink')
        box('card_parchment',0,4.15,-1.57,2.96,4.25,.09,'plasterIvory')
        orb('duck_head',0,4.53,-1.16,.81,.84,.34,'gold')
        cyl('duck_helmet',0,5.08,-1.19,.78,.65,'emerald',12 if lod==0 else 8,r2=.56)
        box('duck_beak',.38,4.35,-.74,1.0,.26,.46,'copper')
        for x in[-.30,.30]:orb('duck_eye',x,4.69,-.81,.095,.13,.055,'ink')
        box('card_ribbon',0,2.50,-1.43,1.97,.30,.13,'red')
        for side in[-1,1]:
            for z in[-2.7,-1.5,-.3]:
                box('grandstand_tier',side*3.40,.83+(2.7+z)*.08,z,1.15,.57,.84,'stone')
                box('grandstand_bench',side*3.40,1.18+(2.7+z)*.08,z,1.26,.14,.84,'woodLight')
        stage=4
        for i in range(10 if lod==0 else 6):
            n=10 if lod==0 else 6;a=math.pi*.05+i/(n-1)*math.pi*.90
            x=math.cos(a)*3.98;z=-math.sin(a)*3.98
            box('arena_parapet',x,1.1,z,.56,1.02,.46,'stone')
        cyl('duelling_dais',0,.68,.90,1.70,.20,'stone',16 if lod==0 else 10)
        for side in[-1,1]:
            for z in[-2.92,.12]:beam('gallery_post',(side*3.28,.60,z),(side*3.28,3.12,z),.16,'woodDark')
            roof('gallery_canopy',side*3.28,3.15,-1.4,1.70,3.75,.58,'red'if side<0 else'blue')
        for x in[-2.8,2.8]:
            box('entry_pier',x,1.38,2.70,.75,1.75,.75,'stone')
            cyl('entry_brazier',x,2.37,2.7,.41,.30,'gold',r2=.51)
        stage=5
        for x in[-3.25,3.25]:flag(x,7.45,-2.55,'red'if x<0 else'blue',.55)
        stage=6
        box('trophy_pedestal',0,6.86,-1.9,1.15,.44,.65,'stoneDark')
        cyl('trophy_stem',0,7.33,-1.9,.12,.55,'gold',8)
        cyl('champions_cup',0,7.77,-1.9,.21,.53,'gold',10,r2=.50)
        for x in[-.55,.55]:beam('cup_handle',(x*.4,7.64,-1.9),(x,7.90,-1.9),.12,'gold')
    elif family=='wizard':
        cyl('observatory_plinth',0,.28,0,4.25,.43,'stoneDark',20 if lod==0 else 12)
        cyl('tower_footing',.65,.70,-.55,2.38,.48,'stone',16 if lod==0 else 10)
        cyl('tapered_tower',.65,3.71,-.55,2.05,5.60,'stone',16 if lod==0 else 10,r2=1.65)
        for y,r in[(1.5,2.02),(3.6,1.87),(5.9,1.71)]:cyl('masonry_ring',.65,y,-.55,r+.10,.17,'stoneDark',16 if lod==0 else 10)
        box('book_room',-2.07,1.90,.08,2.64,2.71,3.12,'plasterIvory')
        roof('library_roof',-2.07,3.28,.08,3.04,3.52,1.24,'violet')
        window(-2.13,2.0,1.68,.89,1.20)
        box('arched_door_shadow',.65,1.62,1.54,1.24,2.20,.13,'ink')
        points=[(-.54,.58),(.54,.58),(.54,1.97)]+[(math.cos(i*math.pi/8)*.54,1.97+math.sin(i*math.pi/8)*.54)for i in range(1,9)]
        vs=[(.65+x,y,1.68)for x,y in points]
        mesh('arched_oak_door',vs,[tuple(range(len(vs)))],'woodLight')
        for x in[.65-.67,.65+.67]:box('door_stone_jamb',x,1.30,1.65,.22,1.64,.22,'stone')
        for i in range(7):
            a=i*math.pi/7;b=(i+1)*math.pi/7
            vs=[(.65+math.cos(t)*r,1.97+math.sin(t)*r,1.74)for r,t in[(.56,a),(.56,b),(.78,b),(.78,a)]]
            mesh('door_arch_stone',vs,[(0,1,2,3)],'stoneDark'if i%3==0 else'stone')
        box('door_handle',.95,1.34,1.79,.09,.17,.09,'gold')
        for i in range(3):box('entry_steps',.65,.52+i*.14,2.6-i*.30,1.80,.20+i*.20,.64,'stone')
        window(.65,4.30,1.35,.61,1.06)
        stage=4
        cyl('upper_observatory',.65,7.38,-.55,1.87,1.79,'plasterIvory',12 if lod==0 else 8)
        for y in[6.54,8.25]:cyl('chamber_cornice',.65,y,-.55,2.08,.22,'gold',12 if lod==0 else 8)
        for a in[0,math.pi/2,math.pi,math.pi*1.5]:
            x=.65+math.cos(a)*1.88;z=-.55+math.sin(a)*1.88
            box('chamber_timber',x,7.38,z,.17,1.60,.17,'woodDark')
        window(.65,7.40,1.36,.93,1.11)
        stage=5
        for lev,end in[(5,5),(6,6)]:
            stage=lev;hi=end;rows=6 if lod==0 else 4;basey=8.42;height=2.0 if lev==5 else 4.16
            n=18 if lod==0 else 10
            cyl('spire_underlay',.65,basey+height/2,-.55,2.32,height,'violet',n,r2=.025)
            for row in range(rows):
                t0=row/rows;t1=min(1,(row+1.06)/rows)
                for j in range(n):
                    a=math.tau*(j+(row%2)*.5)/n;b=a+math.tau/n*.976
                    r0=2.38*(1-t0);r1=max(.025,2.38*(1-t1))
                    vs=[(.65+math.cos(t)*r,basey+height*lev+.04+row*.006,-.55+math.sin(t)*r)for t,r,lev in[(a,r0,t0),(b,r0,t0),(b,r1,t1),(a,r1,t1)]]
                    mesh('spire_shingle',vs+[(x,y-.06,z)for x,y,z in vs],[(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],'violetTile'+str((row+j*3)%4))
        hi=6;stage=5
        beam('telescope_mount',(2.0,7.2,-.4),(2.85,7.8,.0),.18,'gold')
        tube('telescope_barrel',(2.2,7.70,-.50),(3.65,8.48,.45),.23,'copper')
        tube('telescope_rim',(3.51,8.405,.359),(3.65,8.48,.45),.285,'gold')
        orb('telescope_lens',3.65,8.48,.45,.27,.27,.27,'magic')
        stage=6;cyl('spire_finial',.65,12.74,-.55,.08,.36,'gold',8)
        orb('star_orb',.65,13.0,-.55,.16,.16,.16,'magic')
        # An armillary ring encircles the roof instead of disconnected floating rods.
        n=24 if lod==0 else 12
        for i in range(n):
            a=math.tau*i/n;b=math.tau*(i+1)/n
            beam('brass_armillary',(.65+2.48*math.cos(a),9.32+.6*math.sin(a),-.55+2.48*math.sin(a)),(.65+2.48*math.cos(b),9.32+.6*math.sin(b),-.55+2.48*math.sin(b)),.065,'gold')
    elif family=='dwarves':
        base()
        # Rock masses frame a deep dark portal; the center is deliberately open.
        for x,z,y,sx,sy,sz in[(-3.08,-1.8,2.26,1.47,1.83,1.83),(3.0,-2.0,2.24,1.39,1.8,1.8),(-2.4,-2.7,4.0,1.30,1.17,1.0),(1.85,-2.6,4.22,1.37,1.15,1.12),(0,-2.9,4.62,1.40,.95,1.0)]:rock('fractured_rock',x,y,z,sx,sy,sz,'stoneDark')
        box('deep_mine_shadow',0,2.03,-2.46,3.49,3.05,.12,'ink')
        for x in[-1.75,1.75]:
            box('portal_post',x,2.12,-1.24,.53,3.25,.61,'woodDark')
            beam('portal_brace',(x,2.36,-.88),(x*.63,3.58,-.88),.27,'woodLight')
        box('portal_header',0,3.69,-1.24,4.29,.58,.80,'woodLight')
        for z in[-1.3,-.52,.26,1.04,1.82,2.60,3.38]:box('rail_sleeper',0,.59,z,2.28,.17,.27,'woodDark')
        for x in[-.70,.70]:box('rail',x,.76,1.02,.13,.17,5.90,'iron')
        box('miners_lodge',-3.0,1.43,1.14,2.00,1.81,2.27,'woodLight')
        roof('lodge_roof',-3.0,2.39,1.14,2.57,2.63,.98,'red')
        window(-3.0,1.47,2.30,.65,.70)
        stage=4
        box('cart_floor',0,1.14,2.21,1.90,.28,1.62,'iron')
        for x in[-.98,.98]:box('cart_sides',x,1.72,2.21,.18,1.12,1.80,'woodLight')
        for z in[1.36,3.07]:box('cart_end',0,1.72,z,1.86,1.12,.18,'woodLight')
        for x in[-1.10,1.10]:
            for z in[1.65,2.78]:cyl('cart_wheel',x,1.06,z,.31,.15,'iron',10 if lod==0 else 6,axis='x')
        for x,z in[(-.5,1.8),(.45,2.5),(0,2.15)]:cyl('ore_crystal',x,2.31,z,.27,.70,'cyan'if x<0 else'gold',5,r2=.015)
        barrel(3.0,2.2)
        stage=5
        for x in[-2.63,2.63]:
            beam('hoist_frame',(x,.6,-2.10),(x*.85,6.2,-2.10),.35,'woodDark')
            beam('hoist_crossbrace',(x*.94,4.43,-2.1),(0,6.24,-2.1),.20,'woodLight')
        box('hoist_gantry',0,6.30,-2.1,5.12,.43,.53,'woodDark')
        cyl('pulley',0,5.94,-1.72,.51,.23,'iron',12 if lod==0 else 8,axis='z')
        cyl('pulley_hub',0,5.94,-1.56,.17,.14,'copper',8,axis='z')
        beam('hoist_rope',(0,5.95,-1.53),(0,3.39,-1.53),.045,'roofDark')
        stage=6
        flag(2.16,7.35,-2.1,'red')
        beam('sign_bracket',(1.94,3.5,-.55),(3.6,3.5,-.55),.15,'iron')
        box('tavern_sign',3.14,2.96,-.55,.92,.76,.18,'woodDark')
        box('tankard_emblem',3.05,2.96,-.40,.34,.43,.08,'gold')
        beam('tankard_handle',(3.26,3.13,-.40),(3.42,2.87,-.40),.08,'gold')
