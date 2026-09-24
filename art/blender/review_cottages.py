"""Validate and render the authored cottages through Blender MCP."""
import bpy, json, os, math
from mathutils import Vector
root=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'))
for old in list(bpy.data.scenes):
    if old.name.startswith(('Cottage_Turnaround','Cottage_Export_RoundTrip')):
        owned=list(old.objects);bpy.data.scenes.remove(old)
        for obj in owned:
            if not obj.users_scene:bpy.data.objects.remove(obj,do_unlink=True)
lib=bpy.data.scenes['Cottage_Library'];report={'meshes':0,'triangles':0,'degenerateTriangles':0,'invalidTransforms':[],'nonManifoldEdges':0,'roundTrip':{}}
for o in lib.objects:
    if o.type!='MESH':continue
    report['meshes']+=1;me=o.data;me.calc_loop_triangles();report['triangles']+=len(me.loop_triangles)
    if any(abs(x-1)>1e-6 for x in o.scale) or any(abs(x)>1e-6 for x in o.rotation_euler) or o.location.length>1e-6:report['invalidTransforms'].append(o.name)
    for t in me.loop_triangles:
        p,q,r=[me.vertices[i].co for i in t.vertices]
        if (q-p).cross(r-p).length<1e-8:report['degenerateTriangles']+=1
    import bmesh
    bm=bmesh.new();bm.from_mesh(me);report['nonManifoldEdges']+=sum(not e.is_manifold for e in bm.edges);bm.free()
# GLB active-scene exports must not contain the original default cube.
check=bpy.data.scenes.new('Cottage_Export_RoundTrip');bpy.context.window.scene=check
for lod in [0,1]:
    for f in 'ABC':
        path=root+'/art/blender/ENV_Cottage_'+f+'_LOD'+str(lod)+'.glb'
        before=set(check.objects);bpy.ops.import_scene.gltf(filepath=path);added=set(check.objects)-before
        meshes=[o for o in added if o.type=='MESH'];count=0
        for o in meshes:o.data.calc_loop_triangles();count+=len(o.data.loop_triangles)
        bad=[o.name for o in added if not o.name.startswith('ENV_Cottage_'+f+'_LOD'+str(lod))]
        report['roundTrip'][f+'_LOD'+str(lod)]={'triangles':count,'objects':len(added),'unexpectedObjects':bad,'bytes':os.path.getsize(path)}
        for o in added:bpy.data.objects.remove(o,do_unlink=True)
bpy.data.scenes.remove(check)
with open(root+'/art/reviews/cottages/technical-review.json','w') as h:json.dump(report,h,indent=2)
review=bpy.data.scenes['Cottage_Review'];bpy.context.window.scene=review
bpy.ops.wm.save_as_mainfile(filepath=root+'/art/blender/cottages.blend')
bpy.ops.render.render(write_still=True)
# Front/side/back turnaround, one clean example without review props.
turn=bpy.data.scenes.new('Cottage_Turnaround');bpy.context.window.scene=turn
turn.world=review.world;turn.render.engine='CYCLES';turn.cycles.samples=24;turn.cycles.use_denoising=True
turn.render.resolution_x=1200;turn.render.resolution_y=1000;turn.render.resolution_percentage=100;turn.view_settings.view_transform='AgX'
for o in lib.objects:
    if o.get('family')=='A' and o.get('lod')==0 and o.get('minStage')<=6<=o.get('maxStage'):
        copy=o.copy();copy.data=o.data;turn.collection.objects.link(copy)
for o in review.objects:
    if o.type=='LIGHT':turn.collection.objects.link(o)
camd=bpy.data.cameras.new('Turnaround_Camera');cam=bpy.data.objects.new('Turnaround_Camera',camd);turn.collection.objects.link(cam);turn.camera=cam;camd.type='ORTHO';camd.ortho_scale=10.3
for name,loc in [('front',(0,-18,5)),('back',(-11,15,8))]:
    cam.location=loc;cam.rotation_euler=(Vector((-.5,0,2))-cam.location).to_track_quat('-Z','Y').to_euler();turn.render.filepath=root+'/art/reviews/cottages/'+name+'.png';bpy.ops.render.render(write_still=True)
bpy.context.window.scene=review
bpy.ops.wm.save_as_mainfile(filepath=root+'/art/blender/cottages.blend')
print('TECHNICAL_REVIEW',json.dumps(report))
