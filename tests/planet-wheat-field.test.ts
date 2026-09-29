import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PlanetWheatField } from '../src/town/planet-wheat-field';

test('wheat is one solid canopy and cuts a visible corridor for roads',()=>{
  const parent=new THREE.Group(),field=new PlanetWheatField(parent);
  assert.equal(parent.children.length,2);
  assert.equal(field.mesh instanceof THREE.InstancedMesh,false);
  field.setGrowth(1);assert.equal(field.mesh.visible,true);
  const original=field.mesh.geometry.getAttribute('position');
  assert.ok(Array.from({length:original.count},(_,i)=>original.getX(i)).some(x=>Math.abs(x-32)<1));
  field.setClearance((p,radius)=>Math.abs(p.x-32)<1+radius);
  const positions=field.mesh.geometry.getAttribute('position');
  for(let i=0;i<positions.count;i++)assert.ok(Math.abs(positions.getX(i)-32)>1.44,'road and verge remain exposed');
  const fullHeight=positions.getY(0);field.setGrowth(.2);assert.ok(positions.getY(0)<fullHeight);
  field.setGrowth(0);assert.equal(field.mesh.visible,false);
  assert.ok(field.stalks.count>300);
  field.setGrowth(1);
  const matrix=new THREE.Matrix4();let farBank=0;
  for(let i=0;i<field.stalks.count;i++){
    field.stalks.getMatrixAt(i,matrix);
    assert.ok(Math.abs(matrix.elements[12]-32)>1.8,'wheat parts also leave the road clear');
    if(matrix.elements[12]>51)farBank++;
  }
  assert.ok(farBank>30,'wheat covers the opposite riverbank');
  field.setGrowth(0);assert.equal(field.stalks.visible,false);
  field.mesh.geometry.dispose();field.mesh.material.dispose();
  field.stalks.geometry.dispose();(field.stalks.material as THREE.Material).dispose();
});
