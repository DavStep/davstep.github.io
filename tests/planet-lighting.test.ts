import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { applyPlanetLighting, configurePlanetShadows, PLANET_LIGHT_DISTANCE } from '../src/town/planet-lighting';

test('globe weather weakens direct light and raises sky fill without flattening clear-day shadows',()=>{
  const sun=new THREE.DirectionalLight(),fill=new THREE.HemisphereLight();
  applyPlanetLighting(sun,fill,0,0);
  const clearSun=sun.intensity,clearFill=fill.intensity;
  assert.ok(clearSun/clearFill>3,'clear weather keeps lit and shaded planes distinct');
  assert.equal(sun.shadow.intensity,1);
  applyPlanetLighting(sun,fill,0,1);
  assert.ok(sun.intensity<clearSun);assert.ok(fill.intensity>clearFill);
  assert.ok(sun.shadow.intensity<1);
  applyPlanetLighting(sun,fill,1,0);
  assert.ok(sun.intensity<clearSun*.4,'moonlight must not be overwritten by daytime light');
  assert.ok(fill.intensity>clearFill*.7,'moonlit architecture retains a readable sky fill');
});

test('one globe shadow volume covers mountains and hero architecture through any orbit',()=>{
  for(const mobile of [false,true]){
    const sun=new THREE.DirectionalLight();configurePlanetShadows(sun,mobile,85);
    const shadow=sun.shadow,cam=shadow.camera;
    // Surface shelves are ~3.4 high; the tallest hero landmark is ~29 high.
    const tallestRadius=85+3.4+29;
    assert.ok(cam.right>tallestRadius&&-cam.left>tallestRadius);
    assert.ok(cam.near<PLANET_LIGHT_DISTANCE-tallestRadius);
    assert.ok(cam.far>PLANET_LIGHT_DISTANCE+tallestRadius);
    const texel=(cam.right-cam.left)/shadow.mapSize.x;
    assert.ok(shadow.normalBias<texel,'contact bias must stay smaller than a shadow texel');
    assert.equal(shadow.mapSize.x,mobile?1024:2048);
  }
});

test('shadow resolution can be compared at runtime and releases an obsolete render target',()=>{
  const sun=new THREE.DirectionalLight();configurePlanetShadows(sun,false,85,4096);
  const previous=new THREE.WebGLRenderTarget(4096,4096);sun.shadow.map=previous;
  let disposed=false;previous.addEventListener('dispose',()=>{disposed=true;});
  configurePlanetShadows(sun,false,85,2048);
  assert.equal(disposed,true);assert.equal(sun.shadow.map,null);
  assert.equal(sun.shadow.mapSize.x,2048);
  assert.ok(sun.shadow.normalBias<250/2048);
});
