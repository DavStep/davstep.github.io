import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { evaluate, IDEAS } from '../src/town/game';
import { Hillside, HILLSIDE_SHARED_GEOMETRIES } from '../src/town/hillside';
import { landscapeForLevels, landscapeColliders } from '../src/town/landscape-state';
import { terrainHeight, naturalTerrainHeight } from '../src/town/environment';
import { MOUNT_HEIGHT, VALLEY_FLOOR, terrainGridCoordinate } from '../src/town/topography';
import { millStreamPoint } from '../src/town/game-path';
import { streamSurfaceHeight } from '../src/town/game-scenery';
import { moveWithCollisions } from '../src/town/collision';
import { MAT } from '../src/town/materials';
import data from '../src/town/generated/castle-mount.json';

test('castle summit stays level, approaches remain walkable, and detail concentrates on the mount',()=>{
  for(const x of [-8,0,6])for(const z of [-6,0,6])assert.equal(terrainHeight(x,z),MOUNT_HEIGHT+VALLEY_FLOOR);
  assert.equal(terrainHeight(65,0),VALLEY_FLOOR);
  for(const sign of [-1,1])for(const axis of ['x','z'] as const){
    const start={x:0,z:0},delta={x:0,z:0};start[axis]=sign*44;delta[axis]=-sign*33;
    const result=moveWithCollisions(start,delta,[]);
    assert.ok(Math.abs(result[axis]-sign*11)<.01,'clear approach from valley to summit');
  }
  assert.ok(Math.abs(terrainGridCoordinate(1)-350)<1e-9);
  assert.ok(terrainGridCoordinate(.5)<60);
});

test('the new hill cannot bury the mill channel',()=>{
  for(let i=0;i<=100;i++){
    const t=i/100,p=millStreamPoint(t);
    assert.ok(streamSurfaceHeight(t)>terrainHeight(p.x,p.z)+.25);
    assert.ok(naturalTerrainHeight(p.x,p.z)>=terrainHeight(p.x,p.z));
  }
});

test('landscape responds to dependencies and fully clears on restart in both quality tiers',()=>{
  const empty=evaluate([]).levels,full=evaluate(IDEAS).levels;
  assert.equal(landscapeForLevels(evaluate(['workshop']).levels).quarryWorking,false);
  assert.equal(landscapeForLevels(evaluate(['windmill','grove']).levels).irrigated,false);
  assert.equal(landscapeColliders(empty).length,0);
  assert.equal(landscapeColliders(full).length,2);
  for(const mobile of [false,true]){
    const root=new THREE.Group(),hill=new Hillside(root,mobile);
    assert.ok(hill.group.children.every(g=>!g.visible));
    hill.setLevels(full);hill.update(12,false);
    assert.ok(hill.group.children.every(g=>g.visible));
    const cart=hill.group.getObjectByName('cart')!;
    assert.ok(cart.position.x<-39&&cart.position.z===-9);
    hill.update(5,true);const still=cart.position.clone();hill.update(20,true);
    assert.deepEqual(cart.position.toArray(),still.toArray());
    hill.setLevels(empty);
    assert.ok(hill.group.children.every(g=>!g.visible));
    let sharedDisposals=0,ownedDisposals=0;
    const onShared=()=>sharedDisposals++;
    HILLSIDE_SHARED_GEOMETRIES.forEach(g=>g.addEventListener('dispose',onShared));
    Object.values(MAT).forEach(m=>m.addEventListener('dispose',onShared));
    hill.group.traverse(o=>{if(o instanceof THREE.Mesh&&!HILLSIDE_SHARED_GEOMETRIES.has(o.geometry))o.geometry.addEventListener('dispose',()=>ownedDisposals++);});
    hill.dispose();
    assert.equal(root.children.length,0);assert.equal(sharedDisposals,0);assert.ok(ownedDisposals>0);
    HILLSIDE_SHARED_GEOMETRIES.forEach(g=>g.removeEventListener('dispose',onShared));
    Object.values(MAT).forEach(m=>m.removeEventListener('dispose',onShared));
  }
});

test('Blender hillside kit has complete bounded LODs and valid nondegenerate triangles',()=>{
  for(const lod of [0,1])for(const family of ['retaining','buttress','quarry','cistern']){
    const parts=data.parts.filter(p=>p.lod===lod&&p.family===family);
    assert.ok(parts.length>0);
    assert.ok(parts.reduce((sum,p)=>sum+p.positions.length/9,0)<(lod?200:350));
    for(const part of parts){
      assert.equal(part.normals.length,part.positions.length);
      assert.ok(part.positions.every(Number.isFinite));assert.ok(part.normals.every(Number.isFinite));
      for(let i=0;i<part.positions.length;i+=9){
        const a=new THREE.Vector3().fromArray(part.positions,i),b=new THREE.Vector3().fromArray(part.positions,i+3),c=new THREE.Vector3().fromArray(part.positions,i+6);
        assert.ok(b.sub(a).cross(c.sub(a)).lengthSq()>1e-10);
      }
    }
  }
});
