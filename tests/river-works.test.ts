import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { IDEAS,evaluate,parseGameSave,chooseIdea,upgradeBlocker } from '../src/town/game';
import { RiverWorks,riverWorkProgress,channelFront,RIVER_WORK_SECONDS } from '../src/town/river-works';
import { millStreamPoint,millStreamParameter } from '../src/town/game-path';
import { naturalTerrainHeight,Environment,isWater } from '../src/town/environment';
import { streamSurfaceHeight } from '../src/town/game-scenery';
import { moatRoutePoint,moatRouteParameter } from '../src/town/moat-layout';
import { MAT } from '../src/town/materials';

test('River waits for workers and tools, then water rescues earlier options automatically',()=>{
  const waiting=evaluate(['windmill','river']);assert.equal(waiting.levels.river,1);assert.match(upgradeBlocker('river',waiting.levels,0)!,/Settlers/);
  const channel=evaluate(['windmill','river','settlers','grove','workshop']);
  assert.equal(channel.levels.river,2);assert.equal(channel.levels.windmill,1);assert.equal(channel.levels.grove,3);
  const connected=evaluate([...channel.order,'roads','market']);assert.ok(connected.levels.river>=3);assert.ok(connected.levels.windmill>=3);
  assert.equal(evaluate(IDEAS).perfect,true);
  assert.equal(evaluate(['walls',...IDEAS.filter(x=>x!=='walls')]).levels.river,8);
});

test('nine-choice saves retain their choices and can select the new River',()=>{
  const old=IDEAS.filter(x=>x!=='river');const save=parseGameSave(JSON.stringify({version:1,started:true,order:old,bestMax:9}));
  assert.deepEqual(save.order,old);assert.equal(evaluate(save.order).finished,false);
  const state=chooseIdea(save,'river');assert.equal(state.finished,true);assert.equal(state.perfect,true);
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

test('diggers animate, water follows, and skip/reload/restart release temporary effects in both tiers',()=>{
  for(const mobile of [false,true]){
    const parent=new THREE.Group(),works=new RiverWorks(parent,mobile,millStreamPoint,naturalTerrainHeight,streamSurfaceHeight,7.6,[.22,.8]);
    works.setActive(true);works.update(1);
    const worker=works.group.getObjectByName('River_digger_0')!;assert.equal(worker.visible,true);for(const w of works.group.children.filter(o=>o.name.startsWith('River_digger_'))){assert.equal(isWater(w.position.x,w.position.z,.6),false);assert.ok(Math.hypot(w.position.x-29,w.position.z+31)>3.2,'crew clears the cistern');}
    const position=worker.position.clone();
    works.update(1);assert.ok(worker.position.distanceTo(position)>.5);assert.equal(works.flowProgress,0);
    works.update(3.5);assert.equal(worker.visible,false);assert.ok(works.flowProgress>0&&works.flowProgress<1);
    works.setActive(true);assert.ok(works.flowProgress>0,'other choices must not restart digging');
    works.setActive(true,true);assert.equal(works.flowProgress,1);assert.equal(works.working,false);
    works.setActive(false,true);assert.equal(works.digProgress,0);assert.equal(works.flowProgress,0);
    works.setActive(true);works.update(.01,true);assert.equal(works.flowProgress,1);assert.equal(worker.visible,false);
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
