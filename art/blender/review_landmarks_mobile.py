"""Render mature mobile LODs beside each other without altering authored assets."""
import bpy,os
from mathutils import Vector
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'))
scene=bpy.data.scenes['Landmark_Review'];bpy.context.window.scene=scene
collection=next(c for c in scene.collection.children if c.name.startswith('Landmark_Review_Assembly'))
originals=[o for o in collection.objects if o.parent]
for ob in originals:ob.hide_render=True
copies=[]
for family in ['outpost','sandship','battle','wizard','dwarves']:
    parent=next(o for o in collection.objects if o.name.split('.')[0]=='Review_'+family)
    library=bpy.data.scenes['Landmark_Library']
    source_collection=next(c for c in library.collection.children if c.name.split('.')[0]=='ENV_Landmark_'+family+'_LOD1')
    for source in source_collection.objects:
        if source['minStage']<=6<=source['maxStage']:
            ob=source.copy();ob.data=source.data;collection.objects.link(ob);ob.parent=parent;ob.hide_render=False;copies.append(ob)
camera=scene.camera;camera.location=(35,-72,37);camera.rotation_euler=(Vector((0,0,4))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.ortho_scale=73
scene.render.resolution_x=1600;scene.render.resolution_y=900;scene.render.filepath=ROOT+'/art/reviews/landmarks/families-mobile.png'
bpy.ops.render.render(write_still=True)
bpy.data.batch_remove(ids=copies)
for ob in originals:ob.hide_render=False
bpy.ops.wm.save_as_mainfile(filepath=ROOT+'/art/blender/landmarks.blend')
print('LANDMARK_MOBILE_REVIEW_READY')
