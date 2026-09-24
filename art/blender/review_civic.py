"""Round-trip validate and render all civic assets through Blender MCP."""
import bpy
import bmesh
import json
import os
from mathutils import Vector

ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'))
OUT=ROOT+'/art/reviews/civic'
for old in list(bpy.data.scenes):
    if old.name.startswith('Civic_Export_RoundTrip'):
        owned=list(old.objects)
        bpy.data.scenes.remove(old)
        for obj in owned:
            if not obj.users_scene:bpy.data.objects.remove(obj,do_unlink=True)

lib=bpy.data.scenes['Civic_Library']
report={'meshes':0,'triangles':0,'degenerateTriangles':0,
        'invalidTransforms':[],'nonManifoldEdges':0,'roundTrip':{}}
for ob in lib.objects:
    if ob.type!='MESH':continue
    report['meshes']+=1
    me=ob.data
    me.calc_loop_triangles()
    report['triangles']+=len(me.loop_triangles)
    if (any(abs(v-1)>1e-6 for v in ob.scale)
        or any(abs(v)>1e-6 for v in ob.rotation_euler)
        or ob.location.length>1e-6):report['invalidTransforms'].append(ob.name)
    for tri in me.loop_triangles:
        p,q,r=[me.vertices[i].co for i in tri.vertices]
        if (q-p).cross(r-p).length<1e-8:report['degenerateTriangles']+=1
    bm=bmesh.new();bm.from_mesh(me)
    report['nonManifoldEdges']+=sum(not edge.is_manifold for edge in bm.edges)
    bm.free()

check=bpy.data.scenes.new('Civic_Export_RoundTrip')
bpy.context.window.scene=check
for family in ['market','tavern','forge','mill','guild','post']:
    for lod in [0,1]:
        path=f'{ROOT}/art/blender/ENV_Civic_{family}_LOD{lod}.glb'
        before=set(check.objects)
        bpy.ops.import_scene.gltf(filepath=path)
        added=set(check.objects)-before
        meshes=[ob for ob in added if ob.type=='MESH']
        triangles=0
        for ob in meshes:
            ob.data.calc_loop_triangles()
            triangles+=len(ob.data.loop_triangles)
        unexpected=[ob.name for ob in added
                    if not ob.name.startswith(f'ENV_Civic_{family}_LOD{lod}')]
        report['roundTrip'][f'{family}_LOD{lod}']={
            'triangles':triangles,'objects':len(added),
            'unexpectedObjects':unexpected,'bytes':os.path.getsize(path)}
        for ob in added:bpy.data.objects.remove(ob,do_unlink=True)
bpy.data.scenes.remove(check)
with open(OUT+'/technical-review.json','w') as handle:json.dump(report,handle,indent=2)

review=bpy.data.scenes['Civic_Review']
bpy.context.window.scene=review
bpy.ops.wm.save_as_mainfile(filepath=ROOT+'/art/blender/civic.blend')
bpy.ops.render.render(write_still=True)

# One front three-quarter image per family at the same scale for comparison.
for family in ['market','tavern','forge','mill','guild','post']:
    scene=bpy.data.scenes.new('Civic_Inspection_'+family)
    scene.world=review.world
    scene.render.engine='CYCLES'
    scene.cycles.samples=24
    scene.cycles.use_denoising=True
    scene.render.resolution_x=1100
    scene.render.resolution_y=900
    scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX'
    bpy.context.window.scene=scene
    for ob in lib.objects:
        if (ob.get('family')==family and ob.get('lod')==0
            and ob.get('minStage')<=6<=ob.get('maxStage')):
            copy=ob.copy();copy.data=ob.data;scene.collection.objects.link(copy)
    for ob in review.objects:
        if ob.type=='LIGHT':scene.collection.objects.link(ob)
    cam_data=bpy.data.cameras.new('Inspection_Camera')
    cam=bpy.data.objects.new('Inspection_Camera',cam_data)
    scene.collection.objects.link(cam)
    scene.camera=cam
    cam_data.type='ORTHO'
    cam_data.ortho_scale=10.5
    cam.location=(10,-15,10)
    cam.rotation_euler=(Vector((-.4,0,2))-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=f'{OUT}/{family}-front.png'
    bpy.ops.render.render(write_still=True)
    bpy.data.scenes.remove(scene)
bpy.context.window.scene=review
bpy.ops.wm.save_as_mainfile(filepath=ROOT+'/art/blender/civic.blend')
print('CIVIC_TECHNICAL_REVIEW',json.dumps(report))
