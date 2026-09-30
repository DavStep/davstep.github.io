import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createEventChest,createEventShrine,createEventCaravan,createEventTowerSockets } from '../src/town/world-event-props';

const cases=[
  {name:'chest',build:createEventChest,max:[1.8,1.15,1.2],budget:1000,draws:6},
  {name:'shrine',build:createEventShrine,max:[4,4,3.3],budget:1200,draws:7},
  {name:'caravan',build:createEventCaravan,max:[2,2,4],budget:3000,draws:20},
  {name:'sockets',build:createEventTowerSockets,max:[3.1,2.1,3],budget:1400,draws:13},
];
function meshes(root:THREE.Object3D){const result:THREE.Mesh[]=[];root.traverse(o=>{if(o instanceof THREE.Mesh)result.push(o);});return result;}
function triangles(root:THREE.Object3D){return meshes(root).reduce((sum,m)=>sum+(m.geometry.index?.count??m.geometry.attributes.position.count)/3,0);}

for(const item of cases)test(`${item.name} has grounded finite geometry, material batches and reduced mobile topology`,()=>{
  const desktop=item.build(false),mobile=item.build(true);
  try{
    for(const asset of [desktop,mobile]){
      const bounds=new THREE.Box3().setFromObject(asset.root),size=bounds.getSize(new THREE.Vector3());
      assert.ok(Math.abs(bounds.min.y)<1e-6);assert.ok(size.x>.8&&size.y>.8&&size.z>.8);
      size.toArray().forEach((n,i)=>assert.ok(n<=item.max[i],`${item.name} dimension ${i}: ${n}`));
      assert.ok(meshes(asset.root).length<=item.draws);
      assert.equal(asset.root.userData.forward,'+Z');
      for(const mesh of meshes(asset.root)){
        assert.deepEqual(mesh.scale.toArray(),[1,1,1]);assert.deepEqual(mesh.position.toArray(),[0,0,0]);
        assert.ok(Array.from(mesh.geometry.attributes.position.array).every(Number.isFinite));
        assert.ok(Array.from(mesh.geometry.attributes.normal.array).every(Number.isFinite));
        assert.ok(mesh.geometry.attributes.position.count>0);
      }
    }
    assert.ok(triangles(mobile.root)<=item.budget);assert.ok(triangles(mobile.root)<triangles(desktop.root)*.7);
  }finally{desktop.dispose();mobile.dispose();}
});

test('articulated parts retain semantic groups and usable hinge/axle pivots',()=>{
  const chest=createEventChest(true),wagon=createEventCaravan(true),shrine=createEventShrine(true),sockets=createEventTowerSockets(true);
  try{
    assert.equal(chest.lid.name,'lid');assert.equal(chest.lid.parent,chest.root);assert.deepEqual(chest.lid.position.toArray(),[0,.68,-.45]);
    const shut=new THREE.Box3().setFromObject(chest.root);chest.lid.rotation.x=-Math.PI/2;
    assert.ok(new THREE.Box3().setFromObject(chest.root).max.y>shut.max.y+.3);
    assert.equal(wagon.wheels.length,4);assert.equal(new Set(wagon.wheels.map(w=>w.name)).size,4);
    for(const wheel of wagon.wheels){assert.equal(wheel.parent,wagon.root);assert.equal(wheel.position.y,.4);assert.ok(meshes(wheel).length>0);}
    assert.equal(wagon.cargo.parent,wagon.root);assert.equal(shrine.lens.parent,shrine.root);
    for(const group of [sockets.lens,sockets.core,sockets.gold,sockets.beam]){assert.equal(group.parent,sockets.root);assert.ok(meshes(group).length>0);}
    sockets.lens.visible=false;assert.ok(sockets.core.visible&&sockets.gold.visible&&sockets.beam.visible);
  }finally{chest.dispose();wagon.dispose();shrine.dispose();sockets.dispose();}
});

test('collected shrine lens leaves an actual empty mount',()=>{
  const shrine=createEventShrine(false);
  try{
    shrine.root.updateMatrixWorld(true);
    const ray=new THREE.Raycaster(new THREE.Vector3(0,2.25,5),new THREE.Vector3(0,0,-1));
    assert.ok(ray.intersectObjects(meshes(shrine.lens),false).length>0);
    shrine.lens.visible=false;const visible:THREE.Object3D[]=[];
    shrine.root.traverseVisible(o=>{if(o instanceof THREE.Mesh)visible.push(o);});
    assert.equal(ray.intersectObjects(visible,false).length,0,'no static substitute remains in the glass aperture');
    assert.ok(visible.length>0,'ruined architecture persists after collection');
  }finally{shrine.dispose();}
});

for(const item of cases)test(`${item.name} disposes every owned resource exactly once and detaches`,()=>{
  const asset=item.build(true),parent=new THREE.Group();parent.add(asset.root);
  const geometries=new Set(meshes(asset.root).map(m=>m.geometry));
  const materials=new Set(meshes(asset.root).flatMap(m=>Array.isArray(m.material)?m.material:[m.material]));
  let geometryCount=0,materialCount=0;
  geometries.forEach(g=>g.addEventListener('dispose',()=>geometryCount++));materials.forEach(m=>m.addEventListener('dispose',()=>materialCount++));
  asset.dispose();asset.dispose();
  assert.equal(parent.children.length,0);assert.equal(geometryCount,geometries.size);assert.equal(materialCount,materials.size);
});
