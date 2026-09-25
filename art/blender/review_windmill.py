"""Focused windmill review and GLB round-trip audit, through Blender MCP."""
import bpy,json,os
from mathutils import Vector
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'))
OUT=ROOT+'/art/reviews/civic'
lib=bpy.data.scenes['Civic_Library'];reference=bpy.data.scenes['Civic_Review']
report={}
for lod in [0,1]:
    scene=bpy.data.scenes.new('Mill_Inspection');bpy.context.window.scene=scene
    scene.world=reference.world
    scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
    scene.render.resolution_x=1100;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX'
    path=f'{ROOT}/art/blender/ENV_Civic_mill_LOD{lod}.glb'
    bpy.ops.import_scene.gltf(filepath=path)
    meshes=[o for o in scene.objects if o.type=='MESH']
    tris=0;degenerate=0
    for ob in meshes:
        ob.data.calc_loop_triangles();tris+=len(ob.data.loop_triangles)
        for tri in ob.data.loop_triangles:
            a,b,c=[ob.data.vertices[i].co for i in tri.vertices]
            degenerate+=(b-a).cross(c-a).length<1e-8
    report[f'LOD{lod}']={'triangles':tris,'degenerateTriangles':degenerate,'meshes':len(meshes)}
    for ob in reference.objects:
        if ob.type=='LIGHT':scene.collection.objects.link(ob)
    camd=bpy.data.cameras.new('Mill_Camera');cam=bpy.data.objects.new('Mill_Camera',camd);scene.collection.objects.link(cam);scene.camera=cam
    camd.type='ORTHO';camd.ortho_scale=14
    cam.location=(13,-25,13);cam.rotation_euler=(Vector((-.3,0,5))-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=OUT+('/mill-front.png' if lod==0 else '/mill-mobile.png');bpy.ops.render.render(write_still=True)
    owned=list(scene.objects);bpy.data.scenes.remove(scene);bpy.data.batch_remove(ids=[o for o in owned if not o.users_scene])
bpy.context.window.scene=reference
bpy.ops.render.render(write_still=True)
bpy.data.libraries.write(ROOT+'/art/blender/civic.blend', {lib,reference}, fake_user=True)
with open(OUT+'/windmill-technical-review.json','w') as f:json.dump(report,f,indent=2)
print('MILL_REVIEW',report)
