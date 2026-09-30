import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PlanetProjection } from '../src/town/planet-scene';

test('projection caches stable scene topology and observes nested additions and removals',()=>{
  const scene=new THREE.Scene(),group=new THREE.Group();scene.add(group);
  const projection=new PlanetProjection(scene);
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial());group.add(mesh);
  let traversals=0;
  const traverse=scene.traverse.bind(scene);
  scene.traverse=(callback)=>{traversals++;traverse(callback);};
  projection.sync(scene);
  assert.ok(mesh.customDepthMaterial);
  const initial=traversals;
  for(let i=0;i<10;i++)projection.sync(scene);
  assert.equal(traversals,initial,'stable frames do not rescan the scene');
  const child=new THREE.Mesh(mesh.geometry,new THREE.MeshStandardMaterial());mesh.add(child);
  projection.sync(scene);assert.ok(child.customDepthMaterial,'new descendants are projected before rendering');
  let disposed=0;child.customDepthMaterial!.addEventListener('dispose',()=>disposed++);
  child.removeFromParent();projection.sync(scene);
  assert.equal(disposed,1,'detached depth materials are released');
  assert.equal(child.customDepthMaterial,undefined);
  mesh.add(child);projection.sync(scene);assert.ok(child.customDepthMaterial,'reattaching a pooled mesh restores its depth material');
  projection.dispose();mesh.geometry.dispose();(mesh.material as THREE.Material).dispose();(child.material as THREE.Material).dispose();
});

test('projection still patches replaced and edited material arrays on stable meshes',()=>{
  const scene=new THREE.Scene(),geometry=new THREE.BoxGeometry(),first=new THREE.MeshStandardMaterial();
  const mesh=new THREE.Mesh(geometry,first);scene.add(mesh);
  const projection=new PlanetProjection(scene);projection.sync(scene);
  const replacement=new THREE.MeshStandardMaterial();mesh.material=replacement;projection.sync(scene);
  assert.match(replacement.customProgramCacheKey(),/planet-projection/);
  const third=new THREE.MeshStandardMaterial(),fourth=new THREE.MeshStandardMaterial();
  mesh.material=[replacement,third];projection.sync(scene);
  assert.match(third.customProgramCacheKey(),/planet-projection/);
  mesh.material[1]=fourth;projection.sync(scene);
  assert.match(fourth.customProgramCacheKey(),/planet-projection/);
  projection.dispose();geometry.dispose();[first,replacement,third,fourth].forEach(m=>m.dispose());
});

test('native and shader geometry stays untouched, and disposal removes topology observers',()=>{
  const scene=new THREE.Scene(),geometry=new THREE.BoxGeometry();
  const native=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial());native.userData.planetNative=true;
  const shader=new THREE.Mesh(geometry,new THREE.ShaderMaterial());
  const line=new THREE.Line(geometry,new THREE.LineBasicMaterial());scene.add(native,shader,line);
  const projection=new PlanetProjection(scene);projection.sync(scene);
  assert.equal(native.customDepthMaterial,undefined);assert.equal(shader.customDepthMaterial,undefined);
  assert.match((line.material as THREE.Material).customProgramCacheKey(),/planet-projection/);
  projection.dispose();
  const observed=(object:THREE.Object3D)=>object as THREE.Object3D&{_listeners?:Record<string,unknown[]>};
  scene.traverse(object=>{for(const type of ['childadded','childremoved'])assert.equal(observed(object)._listeners?.[type]?.length??0,0);});
  geometry.dispose();[native.material,shader.material,line.material].forEach(m=>(m as THREE.Material).dispose());
});
