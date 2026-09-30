import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PLANET_RADIUS, planetPoint, planetNormal, planetToTown } from '../src/town/planet-layout';
import { PlanetProjection } from '../src/town/planet-scene';
import { planetElevation, TOWN_SITES, globeDirection } from '../src/town/planet-geography';
import { terrainHeight } from '../src/town/environment';

test('projection preserves authored height ratios and maps picking back to the original town',()=>{
  for(const x of [-340,-88,0,57,340])for(const z of [-340,-54,0,91,340])for(const y of [0,5,30]){
    const p=planetPoint(x,y,z),flat=planetToTown(p);
    const scale=1/(1+(x*x+z*z)/(4*PLANET_RADIUS*PLANET_RADIUS));
    assert.ok(Math.abs(p.length()-(PLANET_RADIUS+planetElevation(planetNormal(x,z))+(y-terrainHeight(x,z))*scale))<1e-8);
    assert.ok(flat.distanceTo(new THREE.Vector3(x,y,z))<1e-8);
    assert.ok(Math.abs(planetNormal(x,z).length()-1)<1e-8);
  }
});

test('curving the scene preserves authored buffers, materials, colors and object placement',()=>{
  const scene=new THREE.Scene(),geometry=new THREE.BoxGeometry(3,7,4);
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count*3).fill(.7),3));
  const material=new THREE.MeshStandardMaterial({color:0x998877,vertexColors:true});
  let originalHookRan=false;
  material.onBeforeCompile=shader=>{originalHookRan=true;shader.uniforms.authored={value:7};};
  material.customProgramCacheKey=()=>'authored-material';
  const mesh=new THREE.Mesh(geometry,material);mesh.position.set(-88,5,-54);mesh.rotation.y=.7;scene.add(mesh);
  const positions=Array.from(geometry.attributes.position.array),normals=Array.from(geometry.attributes.normal.array),colors=Array.from(geometry.attributes.color.array),matrix=mesh.matrix.clone();
  const projection=new PlanetProjection(scene);projection.sync(scene);projection.sync(scene);
  assert.equal(mesh.geometry,geometry);assert.equal(mesh.material,material);
  assert.deepEqual(Array.from(geometry.attributes.position.array),positions);
  assert.deepEqual(Array.from(geometry.attributes.normal.array),normals);
  assert.deepEqual(Array.from(geometry.attributes.color.array),colors);
  assert.ok(mesh.matrix.equals(matrix));assert.deepEqual(mesh.scale.toArray(),[1,1,1]);
  assert.equal(material.customProgramCacheKey(),'authored-material-planet-projection-v2');
  const shader={vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader,uniforms:{}};
  material.onBeforeCompile(shader as THREE.WebGLProgramParametersWithUniforms,{} as THREE.WebGLRenderer);
  assert.ok(originalHookRan);assert.equal((shader.uniforms as any).authored.value,7);
  assert.ok(shader.vertexShader.includes('planetPosition(planetSource.xyz)'));
  assert.ok(mesh.customDepthMaterial,'curved geometry needs matching shadow geometry');
  projection.dispose();geometry.dispose();material.dispose();
});


test('native geography has substantial ocean basins, continents, mountains and dry town sites',()=>{
  let sea=0,land=0,mountains=0;
  for(let i=0;i<4000;i++){
    const n=globeDirection(Math.asin(1-2*(i+.5)/4000),i*2.39996),h=planetElevation(n);
    assert.ok(Number.isFinite(h));
    if(h<0)sea++;else land++;
    if(h>10)mountains++;
  }
  assert.ok(sea>1000&&land>1000,`coverage: ${sea} sea, ${land} land`);
  assert.ok(mountains>5,'independent mountain ranges should have high summits');
  for(const site of TOWN_SITES)assert.ok(planetElevation(site)>1,'town sites must remain dry after adding water');
});

test('geography remains continuous across the longitude seam and the poles',()=>{
  for(let lat=-1.5;lat<1.5;lat+=.1){
    assert.ok(Math.abs(planetElevation(globeDirection(lat,-Math.PI+1e-7))-planetElevation(globeDirection(lat,Math.PI-1e-7)))<.001);
  }
  for(const sign of [-1,1]){
    const heights=Array.from({length:24},(_,i)=>planetElevation(globeDirection(sign*(Math.PI/2-1e-7),i*Math.PI/12)));
    assert.ok(Math.max(...heights)-Math.min(...heights)<.1);
  }
});
