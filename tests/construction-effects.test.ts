import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { ConstructionEffects } from '../src/town/construction-effects';

test('construction pieces converge as dust rises, then release temporary meshes', () => {
  const scene=new THREE.Scene();
  const effects=new ConstructionEffects(scene,[{
    bounds:new THREE.Box3(new THREE.Vector3(20,0,-7),new THREE.Vector3(28,8,1)),
    kind:'home',
  }],false);
  const fragments=effects.group.children[0] as THREE.InstancedMesh;
  const clouds=effects.group.children[1] as THREE.InstancedMesh;
  assert.equal(fragments.count,14);
  assert.equal(clouds.count,48);
  const matrix=new THREE.Matrix4(),start=new THREE.Vector3(),mid=new THREE.Vector3(),dustStart=new THREE.Vector3(),dustMid=new THREE.Vector3();
  fragments.getMatrixAt(0,matrix);start.setFromMatrixPosition(matrix);
  clouds.getMatrixAt(0,matrix);dustStart.setFromMatrixPosition(matrix);
  effects.update(.8);
  fragments.getMatrixAt(0,matrix);mid.setFromMatrixPosition(matrix);
  clouds.getMatrixAt(0,matrix);dustMid.setFromMatrixPosition(matrix);
  assert.ok(Math.hypot(mid.x-24,mid.z+3)<Math.hypot(start.x-24,start.z+3));
  assert.ok(dustMid.y>dustStart.y+3);
  effects.dispose();
  assert.equal(scene.children.length,0);
});
