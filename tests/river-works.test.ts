import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { IDEAS,evaluate,parseGameSave,chooseIdea } from '../src/town/game';
import { RiverWorks,riverWorkProgress,channelFront,RIVER_WORK_SECONDS } from '../src/town/river-works';
import { millStreamPoint,millStreamParameter } from '../src/town/game-path';
import { naturalTerrainHeight,Environment } from '../src/town/environment';
import { streamSurfaceHeight } from '../src/town/game-scenery';
import { moatRoutePoint,moatRouteParameter } from '../src/town/moat-layout';
import { MAT } from '../src/town/materials';

test('River builds a mill race with an earlier mill and can advance other sites later',()=>{
  const first=evaluate(['windmill','river']);
  assert.ok(first.projects.includes('mill-race'));
  assert.equal(first.levels.river,2);
  assert.equal(first.levels.windmill,2);
  const later=evaluate(['windmill','river','settlers','grove','workshop','roads','market']);
  assert.ok(later.levels.river>=first.levels.river);
  assert.ok(later.levels.grove>0);
  assert.ok(later.faults.some(fault=>fault.project==='grove-irrigation'));
  assert.equal(evaluate(IDEAS).perfect,true);
});

test('version two nine-choice saves retain their route and can choose River',()=>{
  const order=IDEAS.filter(idea=>idea!=='river');
  const save=parseGameSave(JSON.stringify({version:2,started:true,order,bestMax:9}));
  assert.deepEqual(save.order,order);
  const state=chooseIdea(save,'river');
  assert.equal(state.finished,true);
  assert.equal(state.perfect,false);
  assert.ok(state.faults.some(fault=>fault.project==='waterway-map'));
});

test('excavation finishes before the fluid front advances',()=>{
  assert.deepEqual(riverWorkProgress(0),{dig:0,flow:0});
  assert.deepEqual(riverWorkProgress(2.2),{dig:.5,flow:0});
  assert.equal(riverWorkProgress(4.4).dig,1);assert.equal(riverWorkProgress(4.4).flow,0);
  assert.ok(riverWorkProgress(5.8).flow>.49&&riverWorkProgress(5.8).flow<.51);
  assert.deepEqual(riverWorkProgress(20),{dig:1,flow:1});
  assert.equal(channelFront(.5,.8),0);assert.equal(channelFront(.5,.2),1);
  for(let i=0;i<=50;i++)assert.ok(Math.abs(millStreamParameter(...Object.values(millStreamPoint(i/50)) as [number,number])-i/50)<.003);
  for(const t of [.02,.07,.2,.5,.9]){const p=moatRoutePoint(t);assert.ok(Math.abs(moatRouteParameter(p.x,p.z)-t)<.002);}
});

test('river excavation advances without spawning a separate crew, and resets in both tiers',()=>{
  for(const mobile of [false,true]){
    const parent=new THREE.Group(),works=new RiverWorks(parent,mobile,millStreamPoint,naturalTerrainHeight,streamSurfaceHeight,7.6,[.22,.8]);
    works.setActive(true);works.update(1);
    assert.equal(works.group.children.filter(o=>o.name.startsWith('River_digger_')).length,0);
    works.update(1);assert.equal(works.flowProgress,0);
    works.update(3.5);assert.ok(works.flowProgress>0&&works.flowProgress<1);
    works.setActive(true);assert.ok(works.flowProgress>0,'other choices must not restart digging');
    works.setActive(true,true);assert.equal(works.flowProgress,1);assert.equal(works.working,false);
    works.setActive(false,true);assert.equal(works.digProgress,0);assert.equal(works.flowProgress,0);
    works.setActive(true);works.update(.01,true);assert.equal(works.flowProgress,1);
    let sharedDisposed=false;const onDispose=()=>sharedDisposed=true;MAT.earth.addEventListener('dispose',onDispose);
    works.dispose();MAT.earth.removeEventListener('dispose',onDispose);assert.equal(parent.children.length,0);assert.equal(sharedDisposed,false);
  }
});

test('the actual terrain cut advances from upstream and restores on restart',()=>{
  const old=globalThis.matchMedia;globalThis.matchMedia=(()=>({matches:false})) as typeof matchMedia;
  try{
    const env=new Environment(new THREE.Scene(),true,true);
    const mesh=env.group.children.find(o=>o instanceof THREE.Mesh&&o.material===MAT.terrain) as THREE.Mesh;
    const p=mesh.geometry.getAttribute('position'),original=Array.from(p.array);
    env.setStreamProgress(.5);let upstream=0,downstream=0;
    for(let i=0;i<p.count;i++){
      const x=p.getX(i),z=p.getZ(i),t=millStreamParameter(x,z),center=millStreamPoint(t);
      if(Math.hypot(x-center.x,z-center.z)>1)continue;
      if(t>.2&&t<.35&&original[i*3+1]-p.getY(i)>.5)upstream++;
      if(t>.7&&t<.9){assert.equal(p.getY(i),original[i*3+1]);downstream++;}
    }
    assert.ok(upstream>0&&downstream>0);env.setStreamProgress(0);assert.deepEqual(Array.from(p.array),original);
  }finally{globalThis.matchMedia=old;}
});
