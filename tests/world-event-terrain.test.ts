import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {MINING_SITE,planetElevation,surfaceNormal} from '../src/town/planet-geography';
import {planetTransportLayout} from '../src/town/planet-transport-layout';
import {WORLD_EVENT_SITES as S,EMBER_SEAM,SAFE_LAVA_GRADE,DAMAGING_LAVA_GRADE,gradeHeight,SAFE_LAVA_PATH,DAMAGING_LAVA_PATH,BYPASS_PATH,CARAVAN_PATH,CARAVAN_BRIDGE,createWorldEventTerrain,type EventTerrainState} from '../src/town/world-event-terrain';
const elevation=(p:{x:number;z:number})=>planetElevation(surfaceNormal(p.x,p.z));
const initial:EventTerrainState={volcano:'quiet',prepared:false,orchard:'healthy',corePresent:true,orchardActive:false};

test('event sites occupy existing land, the nearby volcanic summit and surveyed harbor surroundings',()=>{
  for(const [name,p] of Object.entries(S))assert.ok(elevation(p)>.8,`${name} must be on land`);
  assert.ok(elevation(S.volcano)>10,'crater is on existing high mountain');
  assert.ok(Math.hypot(S.volcano.x-MINING_SITE.x,S.volcano.z-MINING_SITE.z)<14);
  for(const [site,id] of [[S.orchard,'castle-harbor'],[S.islandChest,'island-harbor']] as const){
    const harbor=planetTransportLayout().harbors.find(h=>h.id===id)!;
    assert.ok(Math.hypot(site.x-harbor.land.x,site.z-harbor.land.z)<10);
  }
  assert.equal(CARAVAN_BRIDGE,planetTransportLayout().bridges.find(b=>b.id==='western-island'));
  assert.equal(CARAVAN_PATH[1],CARAVAN_BRIDGE.a);assert.equal(CARAVAN_PATH[2],CARAVAN_BRIDGE.b);
});

test('authored lava crosses the required wagon pass, while safe lava and recovery bypass avoid it',()=>{
  assert.equal(DAMAGING_LAVA_PATH[0],S.volcano);assert.ok(DAMAGING_LAVA_PATH.includes(S.pass));assert.ok(CARAVAN_PATH.includes(S.pass));
  assert.equal(SAFE_LAVA_PATH[0],S.volcano);assert.ok(!SAFE_LAVA_PATH.includes(S.pass));
  assert.deepEqual(BYPASS_PATH[0],CARAVAN_PATH[3]);assert.deepEqual(BYPASS_PATH.at(-1),CARAVAN_PATH[5]);
  const paths=[SAFE_LAVA_PATH,DAMAGING_LAVA_PATH,BYPASS_PATH,CARAVAN_PATH];
  for(const path of paths)for(let i=1;i<path.length;i++){
    if(path===CARAVAN_PATH&&i===2)continue; // The real wagon bridge is the sole water crossing.
    const a=path[i-1],b=path[i];
    for(let j=0;j<=40;j++)assert.ok(elevation({x:a.x+(b.x-a.x)*j/40,z:a.z+(b.z-a.z)*j/40})>.65,'route stays above water');
  }
  assert.ok(elevation(SAFE_LAVA_PATH.at(-1)!)<elevation(SAFE_LAVA_PATH[0]));
});

test('saved terrain history survives bypass and restoration, and reset restores the opening',()=>{
  const parent=new THREE.Group(),terrain=createWorldEventTerrain(parent,true);
  const part=(name:string)=>{const found=terrain.group.getObjectByName(name);assert.ok(found,name);return found;};
  assert.equal(part('Always visible jagged volcanic crater').visible,true);
  assert.equal(part('Healthy harbor orchard').visible,false);
  terrain.update({...initial,orchardActive:true});assert.equal(part('Healthy harbor orchard').visible,true);
  terrain.update({...initial,volcano:'blocked',orchard:'scorched'});
  assert.equal(part('Permanent black lava field and ruined original pass').visible,true);
  assert.equal(part('Scorched harbor orchard ground and stumps').visible,true);
  terrain.update({...initial,volcano:'bypassed',orchard:'restored',corePresent:false});
  assert.equal(part('Permanent black lava field and ruined original pass').visible,true);
  assert.equal(part('Closed mountain freight barricade').visible,true,'original road stays ruined');
  assert.equal(part('Excavated mountain bypass').visible,true);
  assert.equal(part('Restored orchard with charcoal history').visible,true);
  assert.ok(part('Preserved charcoal stump after restoration'));
  assert.equal(part('Ember core in exposed seam').visible,false);assert.equal(part('Empty crystal seam after harvest').visible,true);
  terrain.update({...initial,volcano:'contained',prepared:true,corePresent:false});
  assert.equal(part('Engineered diversion masonry gate and basin').visible,true);
  assert.equal(part('Contained lava and cooled safe channel').visible,true);
  assert.equal(part('Permanent black lava field and ruined original pass').visible,false);
  terrain.update(initial);assert.equal(part('Ember core in exposed seam').visible,true);assert.equal(part('Excavated mountain bypass').visible,false);
  terrain.dispose();assert.equal(parent.children.length,0);
});

test('geometry is finite, spherical and native; reduced motion remains static without replacing meshes',()=>{
  const terrain=createWorldEventTerrain(new THREE.Group(),false);
  const objects:THREE.Object3D[]=[];
  terrain.group.traverse(o=>{objects.push(o);assert.equal(o.userData.planetNative,true);
    if(o instanceof THREE.Mesh){
      const positions=o.geometry.getAttribute('position');for(const value of positions.array)assert.ok(Number.isFinite(value));
      if(o instanceof THREE.InstancedMesh){for(const value of o.instanceMatrix.array)assert.ok(Number.isFinite(value));}
    }
  });
  const smoke=terrain.group.getObjectByName('Volcanic smoke')!;
  terrain.render(10,true);const frozen=smoke.children.map(p=>p.position.toArray());
  terrain.render(999,true);assert.deepEqual(smoke.children.map(p=>p.position.toArray()),frozen);
  terrain.render(2,false);assert.notDeepEqual(smoke.children.map(p=>p.position.toArray()),frozen);
  terrain.render(NaN,false);for(const puff of smoke.children)assert.ok(puff.position.toArray().every(Number.isFinite));
  const after:THREE.Object3D[]=[];terrain.group.traverse(o=>after.push(o));assert.deepEqual(after,objects);
  terrain.dispose();
});


test('both exported lava grades strictly descend and their interpolated beds clear the terrain',()=>{
  for(const profile of [SAFE_LAVA_GRADE,DAMAGING_LAVA_GRADE]){
    assert.ok(profile.length>20);
    for(let i=0;i<profile.length;i++){
      const sample=profile[i];
      assert.ok(sample.height>elevation(sample.point),'graded bed clears existing terrain');
      assert.ok(Math.abs(gradeHeight(profile,sample.point)-sample.height)<1e-8);
      if(i===0)continue;
      const previous=profile[i-1];
      assert.ok(sample.distance>previous.distance);
      assert.ok(sample.height<previous.height,'lava must never climb uphill');
      const middle={x:(previous.point.x+sample.point.x)/2,z:(previous.point.z+sample.point.z)/2};
      const h=gradeHeight(profile,middle);
      assert.ok(h<previous.height&&h>sample.height,'sampled surge descends between grade points');
    }
  }
});

test('route capability toggles only the road and permanent discovery fixtures survive collection',()=>{
  const terrain=createWorldEventTerrain(new THREE.Group(),true);
  const road=terrain.group.getObjectByName('Mountain wagon route')!;
  const pedestal=terrain.group.getObjectByName('Permanent island chest pedestal')!;
  assert.equal(road.visible,true,'unspecified route capability preserves default');
  assert.ok(pedestal);assert.equal(pedestal.userData.topLift,.42);
  terrain.update({...initial,routeOpen:false});assert.equal(road.visible,false);assert.equal(pedestal.visible,true);
  terrain.update({...initial,routeOpen:true,corePresent:false});assert.equal(road.visible,true);assert.equal(pedestal.visible,true);
  assert.equal(terrain.group.getObjectByName('Empty chest footprint on island pedestal')!.visible,true);
  const core=terrain.group.getObjectByName('Glowing mountain Ember Core')!;
  assert.ok(core.position.clone().normalize().distanceTo(surfaceNormal(EMBER_SEAM.x,EMBER_SEAM.z))<1e-8);
  assert.deepEqual(S.wizard,{x:-45,z:120});
  terrain.dispose();
});
