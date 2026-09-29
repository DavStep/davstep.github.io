import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { planetBuildingYaw, planetSunDirection, planetRoadRadius, PLANET_CAMERA_NEAR } from '../src/town/planet-placement';
import { snapshotForGame } from '../src/town/game-snapshot';
import { evaluate } from '../src/town/game';
import { accessPathFor } from '../src/town/town-plan';

test('houses face their access roads and retain their heading throughout construction',()=>{
  const plots=snapshotForGame(evaluate(['settlers']).levels).plots.filter(p=>p.kind==='home');
  const headings=new Set<number>();
  for(const plot of plots){
    const yaw=planetBuildingYaw(plot),road=accessPathFor(plot)!;
    const forward=new THREE.Vector2(Math.sin(yaw),Math.cos(yaw));
    const approach=new THREE.Vector2(road.x2-plot.x,road.z2-plot.z).normalize();
    if(approach.length()>0)assert.ok(forward.dot(approach)>.999);
    headings.add(Math.round(yaw*10));
    for(let stage=1;stage<=8;stage++)assert.equal(planetBuildingYaw({...plot,stage} as typeof plot),yaw);
  }
  assert.ok(headings.size>=5,'houses must not all share one facade direction');
});

test('turning the globe moves light over its surface while keeping the sun fixed in the view',()=>{
  const first=new THREE.Quaternion().setFromEuler(new THREE.Euler(-.5,.7,0));
  const second=new THREE.Quaternion().setFromEuler(new THREE.Euler(-.5,1.8,0));
  const a=planetSunDirection(first),b=planetSunDirection(second);
  assert.ok(a.angleTo(b)>.5);
  assert.ok(a.applyQuaternion(first.clone().invert()).distanceTo(b.applyQuaternion(second.clone().invert()))<1e-10);
});

test('road surfaces and crossings remain separated beyond the worst-case depth precision',()=>{
  const far=1800,distance=1020;
  const depthStep=distance*distance*(far-PLANET_CAMERA_NEAR)/(far*PLANET_CAMERA_NEAR*(2**24-1));
  assert.ok(depthStep<.007);
  for(const height of [-8,0,3,18]){
    const roads=[0,1,2].map(ring=>planetRoadRadius(85,height,ring));
    assert.ok(roads[0]-(85+height)>.25);
    assert.ok(roads[1]-roads[0]>depthStep*20);
    assert.ok(roads[2]-roads[1]>depthStep*20);
  }
});
