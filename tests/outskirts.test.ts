import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { IDEAS,evaluate } from '../src/town/game';
import { outskirtsForLevels,outskirtsArrival,outskirtsOverviewDistance,COUNTRY_ROUTES } from '../src/town/outskirts-state';
import { Outskirts } from '../src/town/outskirts';
import { isWater } from '../src/town/environment';
import { MAT } from '../src/town/materials';

const empty=evaluate([]).levels,full=evaluate(IDEAS).levels;
test('countryside develops through habitation, water and commerce',()=>{
  assert.deepEqual(Object.values(outskirtsForLevels(empty)),[0,0,0,0,0]);
  assert.equal(outskirtsForLevels(evaluate(['settlers']).levels).farms,1);
  assert.equal(outskirtsForLevels(evaluate(['grove']).levels).woodland,1);
  assert.equal(outskirtsForLevels(evaluate(['grove']).levels).orchard,1);
  assert.equal(outskirtsForLevels(evaluate(['roads']).levels).caravan,1);
  assert.equal(outskirtsForLevels(evaluate(['river']).levels).fishery,1);
  assert.deepEqual(Object.values(outskirtsForLevels(full)),[3,3,3,3,3]);
  const repaired=evaluate(['walls','settlers','grove','workshop','roads','market','windmill','archive','observatory','river']).levels;
  assert.equal(outskirtsForLevels(repaired).farms,3);
  assert.equal(outskirtsForLevels(repaired).fishery,3);
  assert.equal(outskirtsArrival(full,full),'');
  assert.match(outskirtsArrival(empty,evaluate(['settlers']).levels),/farms/);
  assert.ok(outskirtsOverviewDistance(full)>outskirtsOverviewDistance(empty));
});

test('country lanes remain on dry land outside the moat',()=>{
  for(const route of COUNTRY_ROUTES)for(let j=1;j<route.length;j++)for(let i=0;i<=100;i++){
    const a=route[j-1],b=route[j],x=a.x+(b.x-a.x)*i/100,z=a.z+(b.z-a.z)*i/100;
    assert.ok(Math.hypot(x,z)>66);
    assert.equal(isWater(x,z,1),false);
  }
});

test('desktop and mobile countryside reconcile reload, reset and reduced motion without disposing shared materials',()=>{
  for(const mobile of [false,true]){
    const parent=new THREE.Group(),world=new Outskirts(parent,mobile);
    world.setLevels(full);
    assert.equal(world.group.getObjectByName('Orchard_saplings')!.visible,false);
    assert.equal(world.group.getObjectByName('Country_wheat')!.parent!.visible,true);
    const cart=world.group.getObjectByName('caravan_wagon')!;
    const initial=cart.position.clone();world.update(20,false);assert.ok(initial.distanceTo(cart.position)>1);
    world.update(50,true);const paused=cart.position.clone();world.update(90,true);assert.deepEqual(cart.position,paused);
    world.setLevels(empty);let visibleMeshes=0;world.group.traverseVisible(o=>{if(o instanceof THREE.Mesh)visibleMeshes++;});assert.equal(visibleMeshes,0);
    world.setLevels(full);assert.equal(cart.visible,true);
    let disposed=false;const listener=()=>{disposed=true;};MAT.woodDark.addEventListener('dispose',listener);
    world.dispose();MAT.woodDark.removeEventListener('dispose',listener);
    assert.equal(disposed,false);assert.equal(parent.children.length,0);
  }
});
