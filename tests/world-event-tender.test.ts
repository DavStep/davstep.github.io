import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createEventTender} from '../src/town/world-event-tender';
for(const mobile of [false,true])test(`tender ${mobile?'mobile':'desktop'} has budgeted open hull and disposable oar pivots`,()=>{
  const boat=createEventTender(mobile),parent=new THREE.Group();parent.add(boat.root);
  const meshes:THREE.Mesh[]=[];boat.root.traverse(o=>{assert.equal(o.userData.planetNative,true);if(o instanceof THREE.Mesh)meshes.push(o);});
  const triangles=meshes.reduce((sum,m)=>sum+(m.geometry.index?.count??m.geometry.attributes.position.count)/3,0);
  assert.ok(triangles<=1000,`${triangles} triangles`);assert.ok(meshes.length<8);
  const bounds=new THREE.Box3().setFromObject(boat.root);assert.ok(Math.abs(bounds.min.y+.25)<.001);assert.ok(bounds.max.z-bounds.min.z<2.6);
  assert.equal(boat.oars.length,2);for(const oar of boat.oars){assert.equal(oar.parent,boat.root);assert.equal(oar.position.y,.38);assert.ok(oar.children.length>0);oar.rotation.y=.3;}
  const geometries=new Set(meshes.map(m=>m.geometry)),materials=new Set(meshes.flatMap(m=>Array.isArray(m.material)?m.material:[m.material]));let gd=0,md=0;geometries.forEach(g=>g.addEventListener('dispose',()=>gd++));materials.forEach(m=>m.addEventListener('dispose',()=>md++));boat.dispose();boat.dispose();assert.equal(gd,geometries.size);assert.equal(md,materials.size);assert.equal(parent.children.length,0);
});
