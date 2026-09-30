import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PlanetRivers,planetCropGrowth,planetCropSite,planetCropDry,planetRiverPoint } from '../src/town/planet-rivers';
import { planetElevation,surfaceNormal } from '../src/town/planet-geography';

test('planet crops require both freshwater and a mill and stay on dry land',()=>{
  assert.equal(planetCropGrowth(0,8),0);assert.equal(planetCropGrowth(8,0),0);
  assert.equal(planetCropGrowth(1,1),0);assert.equal(planetCropGrowth(3,3),0);
  assert.ok(planetCropGrowth(3,5)>0);assert.ok(planetCropGrowth(8,8)>planetCropGrowth(3,5));
  const sites=Array.from({length:216},(_,i)=>planetCropSite(i)).filter(p=>planetCropDry(p.x,p.z));
  assert.ok(sites.length>180);
  assert.equal(new Set(sites.map(p=>`${p.x}/${p.z}`)).size,sites.length);
  for(const p of sites)assert.ok(planetElevation(surfaceNormal(p.x,p.z))>.35);
  const source=planetRiverPoint(0),mouth=planetRiverPoint(1);
  assert.ok(planetElevation(surfaceNormal(source.x,source.z))>2);
  assert.ok(planetElevation(surfaceNormal(mouth.x,mouth.z))<0,'river reaches the ocean');
});
test('planet river excavates before filling, persists across upgrades, and resets',()=>{
  const parent=new THREE.Group(),rivers=new PlanetRivers(parent,true);
  rivers.setLevel(0,true);rivers.update(0,true,0);assert.equal(rivers.group.visible,false);
  rivers.setLevel(1,false);rivers.update(2,false,2);
  assert.ok(rivers.banks.geometry.drawRange.count>0);assert.equal(rivers.water.geometry.drawRange.count,0);
  rivers.update(4,false,6);assert.ok(rivers.water.geometry.drawRange.count>0);
  rivers.setLevel(3,false);assert.ok(rivers.works.flowProgress>0,'upgrades do not dry the river');
  rivers.update(0,true,6);assert.equal(rivers.works.flowProgress,1);
  const points=rivers.water.geometry.getAttribute('position');
  assert.equal(rivers.water.geometry.drawRange.count,points.count);
  for(const value of points.array)assert.ok(Number.isFinite(value));
  rivers.setLevel(0,true);rivers.update(0,true,0);assert.equal(rivers.water.geometry.drawRange.count,0);
  rivers.dispose();assert.equal(parent.children.length,0);
});
