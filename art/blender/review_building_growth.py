"""Review all eight regular-building states through Blender MCP."""
import bpy,json,os,math
from mathutils import Vector
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'))
OUT=ROOT+'/art/reviews/development';os.makedirs(OUT,exist_ok=True)
libraries={'home':bpy.data.scenes['Cottage_Library'],'civic':bpy.data.scenes['Civic_Library']}
reference=bpy.data.scenes['Civic_Review']
for old in list(bpy.data.scenes):
    if old.name.startswith('Development_Review'):
        owned=list(old.objects);bpy.data.scenes.remove(old);bpy.data.batch_remove(ids=[o for o in owned if not o.users_scene])
report={}
for kind,lib in libraries.items():
    total=0;bad=0
    for ob in lib.objects:
        if ob.type!='MESH':continue
        ob.data.calc_loop_triangles();total+=len(ob.data.loop_triangles)
        for tri in ob.data.loop_triangles:
            a,b,c=[ob.data.vertices[i].co for i in tri.vertices]
            bad+=(b-a).cross(c-a).length<1e-8
    report[kind]={'sourceTriangles':total,'degenerateTriangles':bad}

# Verify the mature handoff assets against the exact runtime triangle counts.
roundtrip=bpy.data.scenes.new('Development_Review_Exports');bpy.context.window.scene=roundtrip
report['exports']={}
for kind,families,file_prefix,json_name in [('home','ABC','ENV_Cottage_','cottages'),('civic',['market','tavern','forge','guild','post'],'ENV_Civic_','civic')]:
    data=json.load(open(ROOT+'/src/town/generated/'+json_name+'.json'))
    for family in families:
        for lod in [0,1]:
            before=set(roundtrip.objects)
            bpy.ops.import_scene.gltf(filepath=ROOT+'/art/blender/'+file_prefix+family+'_LOD'+str(lod)+'.glb')
            added=set(roundtrip.objects)-before;count=0
            for ob in added:
                if ob.type=='MESH':ob.data.calc_loop_triangles();count+=len(ob.data.loop_triangles)
            expected=sum(len(p['indices'])//3 for p in data['parts'] if p['family']==family and p['lod']==lod and p['minStage']<=8<=p['maxStage'])
            assert count==expected,(kind,family,lod,count,expected)
            report['exports'][kind+'_'+family+'_LOD'+str(lod)]={'triangles':count,'matchesRuntime':True}
            bpy.data.batch_remove(ids=list(added))
bpy.data.scenes.remove(roundtrip)

def draw(name,items,mobile=False):
    scene=bpy.data.scenes.new('Development_Review_'+name);bpy.context.window.scene=scene;scene.world=reference.world
    for light in reference.objects:
        if light.type=='LIGHT':scene.collection.objects.link(light)
    for index,(kind,family,stage,label) in enumerate(items):
        x=(index%4)*11;y=-(index//4)*13
        root=bpy.data.objects.new(label,None);scene.collection.objects.link(root);root.location=(x,y,0)
        for ob in libraries[kind].objects:
            if ob.type=='MESH' and ob.get('family')==family and ob.get('lod')==int(mobile) and ob.get('minStage')<=stage<=ob.get('maxStage'):
                copy=ob.copy();copy.data=ob.data;copy.parent=root;scene.collection.objects.link(copy)
        textdata=bpy.data.curves.new('Stage_label','FONT');textdata.body=label;textdata.size=.60;textdata.align_x='CENTER'
        text=bpy.data.objects.new('Stage_label',textdata);scene.collection.objects.link(text);text.location=(x,y-4,.03)
    camdata=bpy.data.cameras.new('Growth_Camera');cam=bpy.data.objects.new('Growth_Camera',camdata);scene.collection.objects.link(cam);scene.camera=cam
    cam.location=(37,-63,47);cam.rotation_euler=(Vector((16,-6,2))-cam.location).to_track_quat('-Z','Y').to_euler();camdata.type='ORTHO';camdata.ortho_scale=49
    scene.render.engine='CYCLES';scene.cycles.samples=20;scene.cycles.use_denoising=True
    scene.render.resolution_x=1900;scene.render.resolution_y=1100;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX'
    scene.render.filepath=OUT+'/'+name+'.png';bpy.ops.render.render(write_still=True)

labels=['Footing','Frame','Cottage','Occupied','Workshop','Side wing','Upper floor','Gabled townhouse']
draw('homes',[('home','A',stage,f'{stage}  {labels[stage-1]}') for stage in range(1,9)])
draw('shops',[('civic','tavern',stage,f'{stage}  '+['Footing','Frame','Basic hall','Open tavern','Store room','Side wing','Upper wing','Roof lantern'][stage-1]) for stage in range(1,9)])
items=[('home',family,8,'Townhouse '+family) for family in 'ABC']+[('civic',family,8,family.title()) for family in ['market','tavern','forge','guild','post']]
draw('mature-families',items)
draw('mature-mobile',items,True)
with open(OUT+'/technical-review.json','w') as f:json.dump(report,f,indent=2)
print('BUILDING_DEVELOPMENT_REVIEW',report)
