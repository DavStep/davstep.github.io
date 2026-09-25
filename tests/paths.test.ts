import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';

test('road faces hug the rendered hill across their whole width in both detail tiers', async()=>{
  Object.defineProperty(globalThis,'matchMedia',{configurable:true,value:()=>({matches:false})});
  const {pathRibbon,linePoints,ringPoints}=await import('../src/town/paths');
  const {Environment,terrainHeight,naturalTerrainHeight}=await import('../src/town/environment');
  const {TerrainSurface}=await import('../src/town/terrain-surface');
  const {MAT}=await import('../src/town/materials');
  const {PLOTS,accessPathFor}=await import('../src/town/town-plan');
  for(const mobile of [false,true]){
    const scene=new THREE.Scene(),environment=new Environment(scene,mobile,true);
    const terrain=environment.group.children.find(o=>o instanceof THREE.Mesh&&o.material===MAT.terrain)!;
    scene.updateMatrixWorld(true);
    const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0),point=new THREE.Vector3(),vertex=new THREE.Vector3();
    for(const stream of [false,true]){
      environment.setStreamProgress(stream?1:0);
      const surface=new TerrainSurface(mobile,stream?terrainHeight:naturalTerrainHeight);
      const paths=[linePoints({x:-55,z:0},{x:55,z:0}),linePoints({x:0,z:-55},{x:0,z:55}),ringPoints(31.5,40),ringPoints(11.8,32),
        ...PLOTS.slice(0,12).map(p=>accessPathFor(p)).filter(a=>a!==null).map(a=>linePoints({x:a.x1,z:a.z1},{x:a.x2,z:a.z2}))];
      for(const points of paths){
        const geometry=pathRibbon(points,2.35,mobile,surface),p=geometry.getAttribute('position'),n=geometry.getAttribute('normal'),ids=geometry.getIndex()!;
        assert.ok(ids.count>0);
        // Cast against the actual terrain mesh, including inside road triangles
        // where the previous two-edge ribbons disappeared into the hillside.
        const stride=Math.max(1,Math.floor(ids.count/3/35));
        for(let i=0;i<ids.count;i+=3*stride){
          point.set(0,0,0);
          for(let j=0;j<3;j++)point.add(vertex.fromBufferAttribute(p,ids.getX(i+j)));
          point.divideScalar(3);const roadY=point.y;
          ray.set(new THREE.Vector3(point.x,80,point.z),down);
          const hit=ray.intersectObject(terrain)[0];assert.ok(hit);
          assert.ok(Math.abs(roadY-hit.point.y-.048)<.0002,`road detached from visible ground: ${roadY-hit.point.y}`);
        }
        for(let i=0;i<n.count;i++)assert.ok(n.getY(i)>0,'upward facing road');
        if(points===paths[2]){
          const road=new THREE.Mesh(geometry,MAT.path);road.updateMatrixWorld(true);
          for(const z of [-.001,0,.001]){
            ray.set(new THREE.Vector3(31.5,80,z),down);
            assert.ok(ray.intersectObject(road).length,'closed ring has no seam');
          }
        }
        geometry.dispose();
      }
    }
  }
});

test('paving instances align their top with the hill normal without tilting other scenery',async()=>{
  const {addNatureInstances}=await import('../src/town/nature-placement');
  const group=new THREE.Group();
  addNatureInstances(group,[{family:'Rock_Path',x:15,y:10,z:0,sx:.5,sy:.07,sz:.5,rotation:1.2,groundNormal:{x:.6,y:1,z:.3}}],false,false);
  const mesh=group.children[0] as THREE.InstancedMesh,matrix=new THREE.Matrix4();mesh.getMatrixAt(0,matrix);
  const normal=new THREE.Vector3(0,1,0).transformDirection(matrix);
  assert.ok(normal.distanceTo(new THREE.Vector3(.6,1,.3).normalize())<1e-6);
  group.traverse(o=>{if(o instanceof THREE.InstancedMesh)o.dispose();});
});
