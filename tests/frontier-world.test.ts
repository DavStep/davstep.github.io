import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { IDEAS,evaluate,MAX_LEVEL,parseGameSave } from '../src/town/game';
import { MILESTONES } from '../src/town/milestones';
import { choiceBeats } from '../src/town/animation-plan';
import { snapshotForGame } from '../src/town/game-snapshot';
import { FrontierWorld } from '../src/town/frontier-world';
import { Environment } from '../src/town/environment';
import { MAT } from '../src/town/materials';

test('all eighty milestones have distinct named events and a valid world destination',()=>{
  assert.equal(MAX_LEVEL,8);const names=new Set<string>();
  for(const key of IDEAS){assert.equal(MILESTONES[key].length,8);for(const m of MILESTONES[key]){assert.ok(m.description.length>20);assert.ok(Number.isFinite(m.x)&&Number.isFinite(m.z));names.add(m.name);}}
  assert.equal(names.size,80);const full=evaluate(IDEAS);assert.ok(Object.values(full.levels).every(l=>l===8));assert.equal(full.maxCount,10);
  assert.ok(snapshotForGame(full.levels).plots.every(p=>Number.isFinite(p.stage)&&p.stage<=6),'authored building tiers remain bounded');
  const before=evaluate(IDEAS.slice(0,-1)),beats=choiceBeats(before.levels,full.levels,'observatory');
  assert.ok(beats.filter(b=>b.kind==='max').every(b=>b.level===8));assert.equal(beats.filter(b=>b.kind==='max').length,10);
  assert.deepEqual(evaluate(parseGameSave(JSON.stringify({version:1,order:IDEAS})).order).levels,full.levels);
});

test('every advanced level reveals its own geometry and all regions reset in desktop and mobile',()=>{
  const previous=globalThis.matchMedia;globalThis.matchMedia=(()=>({matches:false})) as typeof matchMedia;
  try{for(const mobile of [false,true]){
    const env=new Environment(new THREE.Scene(),mobile,true),parent=new THREE.Group(),world=new FrontierWorld(parent,mobile,env),empty=evaluate([]).levels;
    const terrain=env.group.children.find(o=>o instanceof THREE.Mesh&&o.material===MAT.terrain) as THREE.Mesh;
    const positions=terrain.geometry.getAttribute('position'),initial=Array.from(positions.array);
    world.setLevels(empty,true);assert.equal(world.group.children.filter(g=>g.visible).length,0);
    for(let level=4;level<=8;level++){
      const levels=Object.fromEntries(IDEAS.map(key=>[key,level])) as typeof empty;world.setLevels(levels,true);
      assert.equal(world.group.children.filter(g=>g.visible).length,(level-3)*10);
      for(const key of IDEAS.filter(key=>key!=='river')){const stage=world.group.children.find(g=>g.name.startsWith(`${key}_level_${level}_`))!;assert.ok(new THREE.Box3().setFromObject(stage).getSize(new THREE.Vector3()).length()>5);}
    }
    assert.ok(initial.some((y,i)=>i%3===1&&positions.array[i]<y-.2),'advanced rivers actually excavate the terrain');
    const easternBank=(world.group.getObjectByName('regional-river-4')!.getObjectByName('Regional_banks') as THREE.Mesh).geometry.getAttribute('position');
    const collapsed=()=>Array.from({length:easternBank.count/6},(_,q)=>q*6).filter(i=>easternBank.getX(i)===easternBank.getX(i+1)&&easternBank.getY(i)===easternBank.getY(i+1)&&easternBank.getZ(i)===easternBank.getZ(i+1)).length;
    assert.ok(collapsed()>0,'later branches remove the old bank across their junction');
    world.setLevels(empty,true);assert.deepEqual(Array.from(positions.array),initial);assert.equal(world.group.children.filter(g=>g.visible).length,0);
    assert.equal(collapsed(),0,'restart restores the original banks');
    const riverOnly={...empty,river:4};world.setLevels(riverOnly);world.update(2);const channel=world.group.getObjectByName('regional-river-4')!;
    const water=channel.getObjectByName('Regional_flow') as THREE.Mesh;assert.equal(water.geometry.drawRange.count,0);world.update(3);assert.ok(water.geometry.drawRange.count>0);world.setLevels(riverOnly,true);assert.equal(water.geometry.drawRange.count,480);
    let sharedDisposed=false;const listener=()=>{sharedDisposed=true;};MAT.stone.addEventListener('dispose',listener);world.dispose();MAT.stone.removeEventListener('dispose',listener);assert.equal(sharedDisposed,false);assert.equal(parent.children.length,0);
  }}finally{globalThis.matchMedia=previous;}
});
