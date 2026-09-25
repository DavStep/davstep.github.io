import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { evaluate, IDEAS } from '../src/town/game';
import { CastleMoat } from '../src/town/castle-moat';
import { moatForLevels,moatColliders,moatBedHeight,moatSurfaceHeight,MOAT_RADIUS,MOAT_FEED_X,MOAT_FEED_START,MOAT_FEED_END } from '../src/town/moat-layout';
import { Environment,naturalTerrainHeight } from '../src/town/environment';
import { isBlocked,buildColliders } from '../src/town/collision';
import { snapshotForGame } from '../src/town/game-snapshot';
import { MAT } from '../src/town/materials';

const empty=evaluate([]).levels,full=evaluate(IDEAS).levels;
test('river, crossings and gatehouses each follow their own progression threshold',()=>{
  assert.deepEqual(moatForLevels(empty),{filled:false,bridges:false,gates:false});
  assert.deepEqual(moatForLevels({...empty,river:3}),{filled:true,bridges:false,gates:false});
  assert.deepEqual(moatForLevels({...empty,river:3,roads:2}),{filled:true,bridges:true,gates:false});
  assert.deepEqual(moatForLevels(full),{filled:true,bridges:true,gates:true});
  const blocked=moatColliders({...empty,river:3});
  assert.equal(isBlocked(0,MOAT_RADIUS,blocked),true);
  const crossed=moatColliders(full);
  assert.equal(isBlocked(0,MOAT_RADIUS,crossed),false);
  assert.equal(isBlocked(MOAT_RADIUS,0,crossed),false);
  assert.equal(isBlocked(42.43,42.43,crossed),true);
  const repaired=evaluate(['walls',...IDEAS.filter(x=>x!=='walls')]);
  assert.equal(isBlocked(34,0,[...buildColliders(snapshotForGame(repaired.levels,0,repaired.gateMask)),...moatColliders(repaired.levels)]),false);
});

test('moat bed is below the entire water circuit and feeder, away from occupied plots',()=>{
  const points=Array.from({length:192},(_,i)=>({x:Math.cos(i*Math.PI/96)*MOAT_RADIUS,z:Math.sin(i*Math.PI/96)*MOAT_RADIUS}));
  for(let i=0;i<=40;i++)points.push({x:MOAT_FEED_X,z:MOAT_FEED_START+(MOAT_FEED_END-MOAT_FEED_START)*i/40});
  for(const {x,z} of points)assert.ok(moatBedHeight(x,z,naturalTerrainHeight(x,z))<moatSurfaceHeight(x,z)-.8);
  for(const plot of snapshotForGame(full).plots.filter(p=>p.stage>0))
    assert.equal(moatBedHeight(plot.x,plot.z,naturalTerrainHeight(plot.x,plot.z)),naturalTerrainHeight(plot.x,plot.z));
});

test('moat fills, resets and releases owned resources without disposing shared materials',()=>{
  for(const mobile of [false,true]){
    const root=new THREE.Group();let progress=-1;
    const moat=new CastleMoat(root,mobile,{createRiverMaterial:()=>new THREE.MeshBasicMaterial(),setMoatProgress:p=>{progress=p;}});
    moat.setLevels(full);moat.update(1);assert.ok(progress>0&&progress<1);
    moat.update(7);assert.equal(progress,1);assert.ok(moat.group.visible&&moat.gates.visible&&moat.crossings.visible);
    moat.setLevels(empty,true);assert.equal(progress,0);assert.equal(moat.group.visible,false);
    moat.setLevels(full,true);assert.equal(progress,1);
    let sharedDisposals=0;const onDispose=()=>sharedDisposals++;
    Object.values(MAT).forEach(m=>m.addEventListener('dispose',onDispose));
    moat.dispose();assert.equal(root.children.length,0);assert.equal(progress,0);assert.equal(sharedDisposals,0);
    Object.values(MAT).forEach(m=>m.removeEventListener('dispose',onDispose));
  }
});

test('the mill stream passes through both moat banks without a sand wall',()=>{
  for(const mobile of [false,true]){
    const root=new THREE.Group();
    const moat=new CastleMoat(root,mobile,{createRiverMaterial:()=>new THREE.MeshBasicMaterial(),setMoatProgress:()=>{}});
    moat.setLevels(full,true);
    root.updateMatrixWorld(true);
    const banks:THREE.Object3D[]=[];
    moat.group.traverse(object=>{if(object instanceof THREE.Mesh&&object.material===MAT.sand)banks.push(object);});
    for(const z of [-58.5,-46]){
      const hits=new THREE.Raycaster(new THREE.Vector3(28.2,10,z),new THREE.Vector3(0,-1,0),0,20).intersectObjects(banks);
      assert.equal(hits.length,0,`raised moat bank crosses the mill stream at z=${z}, mobile=${mobile}`);
    }
    moat.dispose();
  }
});

test('terrain channels reset without losing the independent mill stream in either detail tier',()=>{
  const previous=globalThis.matchMedia;globalThis.matchMedia=(()=>({matches:false})) as typeof matchMedia;
  try{for(const mobile of [false,true]){
    const root=new THREE.Scene(),environment=new Environment(root,mobile,true);
    const terrain=root.children[0].children.find(o=>o instanceof THREE.Mesh&&o.material===MAT.terrain) as THREE.Mesh;
    const vertices=terrain.geometry.getAttribute('position');
    environment.setStreamProgress(1);const streamOnly=Array.from(vertices.array);
    environment.setMoatProgress(1);let cut=0;
    for(let i=0;i<vertices.count;i++){
      const x=vertices.getX(i),z=vertices.getZ(i);
      if(Math.abs(Math.hypot(x,z)-MOAT_RADIUS)<1.8){assert.ok(vertices.getY(i)<moatSurfaceHeight(x,z)-.5);cut++;}
    }
    assert.ok(cut>100);
    environment.setMoatProgress(0);assert.deepEqual(Array.from(vertices.array),streamOnly);
  }}finally{globalThis.matchMedia=previous;}
});
