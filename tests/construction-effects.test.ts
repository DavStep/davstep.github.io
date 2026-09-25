import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { ConstructionEffects } from '../src/town/construction-effects';

test('construction stays near the worksite and settles cleanly', () => {
  const scene=new THREE.Scene();
  const effects=new ConstructionEffects(scene,[{
    bounds:new THREE.Box3(new THREE.Vector3(20,0,-7),new THREE.Vector3(28,8,1)),
    kind:'home',
  }],false);
  const fragments=effects.group.children[0] as THREE.InstancedMesh;
  const clouds=effects.group.children[1] as THREE.InstancedMesh;
  assert.equal(fragments.count,10);
  assert.equal(clouds.count,16);
  const matrix=new THREE.Matrix4(),position=new THREE.Vector3(),scale=new THREE.Vector3();
  for(const progress of [0,.25,.5,.75,1]){
    effects.update(progress);
    for(const mesh of [fragments,clouds]){
      for(let i=0;i<mesh.count;i++){
        mesh.getMatrixAt(i,matrix);
        position.setFromMatrixPosition(matrix);
        assert.ok(position.x>=19&&position.x<=29&&position.z>=-8&&position.z<=2);
        assert.ok(position.y>=0&&position.y<=9);
      }
    }
  }
  fragments.getMatrixAt(0,matrix);scale.setFromMatrixScale(matrix);
  assert.ok(scale.length()<.001);
  clouds.getMatrixAt(0,matrix);scale.setFromMatrixScale(matrix);
  assert.ok(scale.length()<.001);
  effects.dispose();
  assert.equal(scene.children.length,0);
});
