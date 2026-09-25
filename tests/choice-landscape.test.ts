import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Environment, naturalTerrainHeight, riverCenter } from '../src/town/environment';
import { FrontierWorld } from '../src/town/frontier-world';
import { evaluate } from '../src/town/game';
import { MAT } from '../src/town/materials';

test('the opening valley has no river or trees, and each choice reveals its landscape',()=>{
  const previous=globalThis.matchMedia;
  globalThis.matchMedia=(()=>({matches:false})) as typeof matchMedia;
  try{
    const environment=new Environment(new THREE.Scene(),true,true);
    const mainWater=environment.group.getObjectByName('Main_river_and_ponds')!;
    const forest=environment.group.children.filter(child=>child.name.startsWith('Grove_outer_trees_'));
    const terrain=environment.group.children.find(child=>child instanceof THREE.Mesh&&child.material===MAT.terrain) as THREE.Mesh;
    const positions=terrain.geometry.getAttribute('position');
    let riverVertex=-1;
    for(let i=0;i<positions.count;i++){
      const x=positions.getX(i),z=positions.getZ(i);
      if(Math.abs(x)<12&&Math.abs(z-riverCenter(x))<1&&positions.getY(i)-naturalTerrainHeight(x,z)>1){riverVertex=i;break;}
    }
    assert.ok(riverVertex>=0);
    const dryHeight=positions.getY(riverVertex);
    assert.equal(mainWater.visible,false);
    assert.equal(environment.activeTrees.length,0);
    assert.equal(forest.length,8);
    assert.ok(forest.every(layer=>!layer.visible));

    environment.setRiverLevel(1);
    assert.equal(mainWater.visible,true);
    assert.ok(positions.getY(riverVertex)<dryHeight-1);
    environment.setGroveLevel(1);
    assert.ok(environment.activeTrees.length>0);
    assert.equal(forest.filter(layer=>layer.visible).length,1);
    environment.setGroveLevel(8);
    assert.equal(environment.activeTrees.length,environment.trees.length);
    assert.ok(forest.every(layer=>layer.visible));

    environment.setRiverLevel(0);
    environment.setGroveLevel(0);
    assert.equal(positions.getY(riverVertex),dryHeight);
    assert.equal(mainWater.visible,false);
    assert.equal(environment.activeTrees.length,0);
    assert.ok(forest.every(layer=>!layer.visible));
  }finally{globalThis.matchMedia=previous;}
});

test('the playable frontier contains only waterways and preserves the main river during channel updates',()=>{
  const previous=globalThis.matchMedia;
  globalThis.matchMedia=(()=>({matches:false})) as typeof matchMedia;
  try{
    const environment=new Environment(new THREE.Scene(),true,true);
    const parent=new THREE.Group(),world=new FrontierWorld(parent,true,environment,true);
    assert.equal(world.group.children.length,5);
    assert.ok(world.group.children.every(child=>child.name.startsWith('regional-river-')));
    const terrain=environment.group.children.find(child=>child instanceof THREE.Mesh&&child.material===MAT.terrain) as THREE.Mesh;
    const positions=terrain.geometry.getAttribute('position');
    const empty=evaluate([]).levels;
    environment.setRiverLevel(1);
    const mainOnly=Array.from(positions.array);
    world.setLevels({...empty,river:8},true);
    environment.setRegionalChannelProgress('regional-river-4',1);
    const both=Array.from(positions.array);
    assert.ok(both.some((height,index)=>index%3===1&&height<mainOnly[index]-.2));
    environment.setRiverLevel(0);
    environment.setRiverLevel(1);
    assert.deepEqual(Array.from(positions.array),both,'main river and regional channels survive reset and replay');
    world.setLevels(empty,true);
    for(let level=4;level<=8;level++)environment.setRegionalChannelProgress(`regional-river-${level}`,0);
    assert.deepEqual(Array.from(positions.array),mainOnly,'regional channels clear without erasing the main river');
    world.dispose();
  }finally{globalThis.matchMedia=previous;}
});
