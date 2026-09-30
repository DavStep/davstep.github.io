import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { snapshotForGame } from '../src/town/game-snapshot';
import { evaluate,IDEAS } from '../src/town/game';
import { planetElevation,surfaceNormal,MOUNTAIN_SITES,PLANET_RADIUS } from '../src/town/planet-geography';
import { PlanetSettlements,wallFootprintSafe } from '../src/town/planet-settlements';
import { authoredLandmarkBuilding } from '../src/town/authored-landmarks';
import { planetBuildingYaw } from '../src/town/planet-placement';
import { PLANET_LANDMARK_SCALE } from '../src/town/planet-landmarks';

test('stone and timber gates frame all four road openings, including the wrapped sector pair',()=>{
 const snapshot=snapshotForGame(evaluate(IDEAS).levels);
 for(const stone of [0,32]){
  const settlements=new PlanetSettlements(new THREE.Group());
  settlements.update({...snapshot,innerStone:stone,outerWood:0});
  const gates=settlements.group.children.filter(g=>g.name==='Town gate');
  assert.equal(gates.length,4);
  for(const gate of gates){
   gate.updateMatrixWorld(true);
   const inverse=gate.matrixWorld.clone().invert(),matrix=new THREE.Matrix4();
   const nearby:THREE.Box3[]=[];
   for(const batch of settlements.group.children){
    if(!(batch instanceof THREE.InstancedMesh))continue;
    for(let i=0;i<batch.count;i++){
     batch.getMatrixAt(i,matrix);matrix.premultiply(inverse);
     const bounds=new THREE.Box3(new THREE.Vector3(-.5,-.5,-.5),new THREE.Vector3(.5,.5,.5)).applyMatrix4(matrix);
     if(bounds.min.z<1&&bounds.max.z>-1&&bounds.min.x<7&&bounds.max.x>-7)nearby.push(bounds);
    }
   }
   assert.ok(nearby.some(b=>b.min.x<-4&&b.max.x>4&&b.min.y>3),'visible lintel spans the road');
   assert.ok(!nearby.some(b=>b.min.x<1.5&&b.max.x>-1.5&&b.min.y<2.5),'passage stays open beneath the gate');
   for(const side of [-1,1])assert.ok(nearby.some(b=>b.min.y<0&&b.max.y>3&&(side<0?b.max.x<-3:b.min.x>3)),'both posts reach the ground');
  }
  settlements.update({...snapshot,wallGates:0,outerWood:0});
  assert.equal(settlements.group.children.filter(g=>g.name==='Town gate').length,0);
  settlements.dispose();
 }
});

test('all mature project footprints are dry and level, and dwarves have a mountain site',()=>{
 const snapshot=snapshotForGame(evaluate(IDEAS).levels),point=new THREE.Vector3();
 for(const plot of snapshot.plots.filter(p=>p.kind==='project')){
  const model=authoredLandmarkBuilding(plot,false);model.scale.set(PLANET_LANDMARK_SCALE.footprint,PLANET_LANDMARK_SCALE.height,PLANET_LANDMARK_SCALE.footprint);model.rotation.y=planetBuildingYaw(plot);model.updateMatrixWorld(true);
  model.traverse(o=>{if(!(o instanceof THREE.Mesh))return;const position=o.geometry.getAttribute('position');for(let i=0;i<position.count;i+=3){point.fromBufferAttribute(position,i).applyMatrix4(o.matrixWorld);const h=planetElevation(surfaceNormal(point.x,point.z));assert.ok(h>2.8,`${plot.id} footprint below safe ground: ${h}`);assert.ok(Math.abs(h-3.4)<.3,`${plot.id} unlevel foundation: ${h}`);}});
 }
 const dwarves=snapshot.plots.find(p=>p.project==='dwarves')!;
 assert.ok(MOUNTAIN_SITES.some(m=>m.angleTo(surfaceNormal(dwarves.x,dwarves.z))*PLANET_RADIUS<15));
});
test('all occupied sites reserve dry ground and walls omit unsafe coastline sections',()=>{
 const snapshot=snapshotForGame(evaluate(IDEAS).levels);
 for(const plot of snapshot.plots.filter(p=>p.stage>0))for(const [dx,dz] of [[0,0],[2,2],[-2,-2],[2,-2],[-2,2]])assert.ok(planetElevation(surfaceNormal(plot.x+dx,plot.z+dz))>2.5,plot.id);
 const parent=new THREE.Group(),settlements=new PlanetSettlements(parent);settlements.update(snapshot);
 assert.ok(settlements.group.children.some(g=>g.name==='Dwarven mountain mine'));
 const mine=settlements.group.children.find(g=>g.name==='Dwarven mountain mine')!;mine.updateMatrixWorld(true);
 // Original camp foundations are unit boxes; articulated/batched railway meshes
 // have their own rail and terrain checks in planet-mine.test.ts.
 mine.traverse(o=>{if(!(o instanceof THREE.Mesh)||o.parent!==mine||o.position.y-o.scale.y/2>.03)return;
  for(const x of [-.5,.5])for(const z of [-.5,.5]){
   const foot=new THREE.Vector3(x,-.5,z).applyMatrix4(o.matrixWorld),normal=foot.clone().normalize();
   const clearance=foot.length()-PLANET_RADIUS-planetElevation(normal);
   assert.ok(clearance>-.04&&clearance<.4,`unsupported mining foundation: ${clearance}`);
  }
 });
 const walls=settlements.group.children.filter(g=>g.name==='Dry wall section');assert.ok(walls.length>20);
 for(const wall of walls){const n=wall.position.clone().normalize(),x=2*PLANET_RADIUS*n.x/(1+n.y),z=2*PLANET_RADIUS*n.z/(1+n.y);assert.ok(wallFootprintSafe(x,z));assert.ok(wall.position.length()>PLANET_RADIUS+1);}
 settlements.update(snapshotForGame(evaluate([]).levels));assert.equal(settlements.group.children.length,0);settlements.dispose();assert.equal(parent.children.length,0);
});
