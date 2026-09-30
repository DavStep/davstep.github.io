import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PlanetMine,minecartTrip,mineRailPoint } from '../src/town/planet-mine';
import { PlanetSettlements } from '../src/town/planet-settlements';
import { snapshotForGame } from '../src/town/game-snapshot';
import { evaluate } from '../src/town/game';
import { MINING_SITE,PLANET_RADIUS,planetElevation,surfaceNormal } from '../src/town/planet-geography';

function camp(){const g=new THREE.Group(),n=surfaceNormal(MINING_SITE.x,MINING_SITE.z);g.position.copy(n).multiplyScalar(PLANET_RADIUS+planetElevation(n)+.06);g.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),n);g.rotateY(-.25);g.scale.setScalar(.7);return g;}
test('minecarts load in the mine, stop to unload, and return empty on a closed rail loop',()=>{
  assert.equal(minecartTrip(1).moving,false);assert.equal(minecartTrip(9).loaded,true);
  assert.equal(minecartTrip(17).unloading,true);assert.equal(minecartTrip(18).loaded,false);
  assert.equal(minecartTrip(25).loaded,false);assert.equal(minecartTrip(35).loaded,true);
  assert.ok(mineRailPoint(0).distanceTo(mineRailPoint(Math.PI*2))<1e-10);
  const mine=new PlanetMine(camp(),8);mine.render(0,false);
  const carts=mine.group.children.filter(o=>o.name==='Ore minecart');assert.equal(carts.length,2);
  for(let i=1;i<=680;i++){
    mine.render(i*100,false);
    for(let j=0;j<2;j++)assert.ok(carts[j].position.distanceTo(mineRailPoint(minecartTrip(i*.1,j*17).angle))<1e-9);
    assert.ok(carts[0].position.distanceTo(carts[1].position)>1.4,'carts cannot collide');
  }
  const position=carts[0].position.clone();mine.render(68100,true);mine.render(68200,true);assert.ok(position.equals(carts[0].position));
  assert.ok(mine.group.children.filter(o=>o.name==='Pickaxe ore chips').every(o=>!o.visible));
  const resources=new Set<THREE.BufferGeometry|THREE.Material>();mine.group.traverse(o=>{assert.equal(o.userData.planetNative,true);if(o instanceof THREE.Mesh){resources.add(o.geometry);resources.add(o.material as THREE.Material);}});
  let released=0;resources.forEach(r=>r.addEventListener('dispose',()=>released++));mine.dispose();assert.equal(released,resources.size);
});
test('mine activity follows upgrades and removes old actors when the camp is rebuilt',()=>{
  const parent=new THREE.Group(),settlements=new PlanetSettlements(parent),levels=evaluate([]).levels;
  for(const [roads,miners,carts] of [[1,0,0],[2,1,0],[3,1,1],[5,2,1],[8,3,2],[0,0,0]]){
    settlements.update(snapshotForGame({...levels,roads}));settlements.render(0,false);
    let minerCount=0,cartCount=0;parent.traverse(o=>{if(o.name==='Dwarf miner')minerCount++;if(o.name==='Ore minecart')cartCount++;});
    assert.equal(minerCount,miners);assert.equal(cartCount,carts);
  }
  settlements.dispose();assert.equal(parent.children.length,0);
});

test('the complete rail loop stays above the mountain surface',()=>{
  const frame=camp();frame.updateMatrixWorld(true);
  for(let i=0;i<=128;i++){
    const point=frame.localToWorld(mineRailPoint(i/128*Math.PI*2));
    const clearance=point.length()-PLANET_RADIUS-planetElevation(point.clone().normalize());
    assert.ok(clearance>.1&&clearance<1,'rails have clear, modest trestle clearance');
  }
});
