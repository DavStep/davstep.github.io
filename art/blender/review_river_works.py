"""Render the actual town geometry with neutral Blender review lighting.
Export scene data first: node --import tsx scripts/export-town-review.mjs --game --roads
Run through scripts/blender-mcp-run.py. Does not change runtime game data.
"""
import bpy,json,os,math
from mathutils import Matrix,Vector
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'))
PHASE=globals().get('RIVER_PHASE','digging')
source=json.load(open(ROOT+'/art/reviews/river/runtime-'+PHASE+'.json'))
for old in list(bpy.data.scenes):
    if old.name=='River_Works_Review':
        owned=list(old.objects);bpy.data.scenes.remove(old)
        bpy.data.batch_remove(ids=[o for o in owned if not o.users_scene])
scene=bpy.data.scenes.new('River_Works_Review');bpy.context.window.scene=scene
collection=scene.collection
meshes=[]
for i,geo in enumerate(source['geometries']):
    p=geo['positions'];vertices=[tuple(p[i:i+3]) for i in range(0,len(p),3)]
    ids=geo['indices'] or list(range(len(vertices)));faces=[tuple(ids[i:i+3]) for i in range(0,len(ids),3)]
    me=bpy.data.meshes.new('World_Geometry_'+str(i));me.from_pydata(vertices,[],faces);me.update()
    if geo['colors']:
        attr=me.color_attributes.new(name='TownRGB',type='FLOAT_COLOR',domain='CORNER')
        rgb=geo['colors'];attr.data.foreach_set('color',[x for loop in me.loops for x in (*rgb[loop.vertex_index*3:loop.vertex_index*3+3],1)])
    me.update()
    meshes.append(me)
materials=[]
for i,mat in enumerate(source['materials']):
    m=bpy.data.materials.new('World_'+mat['name']);m.use_nodes=True
    shader=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED');shader.inputs['Base Color'].default_value=(*mat['color'],1);shader.inputs['Roughness'].default_value=mat['roughness']
    shader.inputs['Emission Color'].default_value=(*mat['emissive'],1);shader.inputs['Emission Strength'].default_value=mat['emissiveIntensity']
    if mat['vertexColors']:
        color=m.node_tree.nodes.new('ShaderNodeAttribute');color.attribute_name='TownRGB'
        mix=m.node_tree.nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1;mix.inputs[2].default_value=(*mat['color'],1)
        m.node_tree.links.new(color.outputs['Color'],mix.inputs[1]);m.node_tree.links.new(mix.outputs[0],shader.inputs['Base Color'])
    info=m.node_tree.nodes.new('ShaderNodeObjectInfo')
    instance=m.node_tree.nodes.new('ShaderNodeMixRGB');instance.blend_type='MULTIPLY';instance.inputs[0].default_value=1
    if shader.inputs['Base Color'].links:
        m.node_tree.links.new(shader.inputs['Base Color'].links[0].from_socket,instance.inputs[1])
    else:instance.inputs[1].default_value=(*mat['color'],1)
    m.node_tree.links.new(info.outputs['Color'],instance.inputs[2]);m.node_tree.links.new(instance.outputs[0],shader.inputs['Base Color'])
    materials.append(m)
# One reusable mesh per geometry/material combination, every instance retains its
# actual runtime transform. Three.js X,Y,Z converts to Blender X,-Z,Y.
convert=Matrix(((1,0,0,0),(0,0,-1,0),(0,1,0,0),(0,0,0,1)))
linked={}
for item in source['objects']:
    key=(item['geometry'],item['material'])
    if key not in linked:
        me=meshes[item['geometry']].copy();me.materials.append(materials[item['material']]);linked[key]=me
    o=bpy.data.objects.new(item['name'],linked[key]);collection.objects.link(o)
    o.color=(*item['color'],1)
    a=item['matrix'];o.matrix_world=convert@Matrix([a[j::4] for j in range(4)])
world=bpy.data.worlds.new('World_Review_Sky');world.use_nodes=True;next(n for n in world.node_tree.nodes if n.type=='BACKGROUND').inputs[0].default_value=(.48,.58,.72,1);next(n for n in world.node_tree.nodes if n.type=='BACKGROUND').inputs[1].default_value=.7;scene.world=world
lightdata=bpy.data.lights.new('World_Key','SUN');lightdata.energy=2.3;lightdata.angle=.12;light=bpy.data.objects.new('World_Key',lightdata);collection.objects.link(light);light.rotation_euler=(.6,-.5,-.6)
camd=bpy.data.cameras.new('World_Review_Camera');cam=bpy.data.objects.new('World_Review_Camera',camd);collection.objects.link(cam);scene.camera=cam;camd.type='ORTHO'

try: scene.render.engine='CYCLES'
except TypeError: pass
scene.cycles.samples=16;scene.cycles.use_denoising=True;scene.render.resolution_x=1600;scene.render.resolution_y=1200;scene.render.resolution_percentage=100
views=[(PHASE,(82,5,61),(29,55,1),70)]
for name,loc,target,scale in views:
    cam.location=loc;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();camd.ortho_scale=scale
    scene.render.filepath=ROOT+'/art/reviews/river/'+name+'.png';bpy.ops.render.render(write_still=True)
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':area.spaces.active.region_3d.view_perspective='CAMERA'

print('WORLD_REVIEW_READY',len(source['objects']))
