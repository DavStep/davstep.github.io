import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ChoiceWorker } from '../src/town/choice-worker';
import { IDEA_COLORS } from '../src/town/idea-colors';
import { IDEAS, evaluate } from '../src/town/game';
import { eventFocus } from '../src/town/reaction-effects';
import { snapshotForGame } from '../src/town/game-snapshot';
import { buildColliders, isBlocked } from '../src/town/collision';
import { landscapeColliders } from '../src/town/landscape-state';
import { moatColliders } from '../src/town/moat-layout';
import { planConstructionCrew } from '../src/town/residents';

test('every idea has a clear arrival path for its one worker',()=>{
  const empty=evaluate([]).levels;
  for(const idea of IDEAS){
    const target=eventFocus({idea,level:1});
    const future=snapshotForGame({...empty,[idea]:1});
    const colliders=[...buildColliders(future,[]),...landscapeColliders(empty),...moatColliders(empty)];
    const routes=planConstructionCrew(target,1,(x,z)=>!isBlocked(x,z,colliders,1.15));
    assert.equal(routes.length,1,`${idea} needs a dry, unobstructed worker route`);
  }
});

test('an idea-colored crew hops in, works, cheers, leaves, and clears on skip',()=>{
  const scene=new THREE.Scene(),worker=new ChoiceWorker(scene);
  const pops:boolean[]=[];let strikes=0,cheers=0;
  worker.hooks={pop:(_x,_y,_z,appearing)=>pops.push(appearing),strike:()=>strikes++,cheer:()=>cheers++};
  assert.equal(worker.visibleCount,0);
  worker.startCue('grove',{x:32,z:0},()=>true,false,10,3);
  const figure=worker.group.getObjectByName('Choice_worker_0')!;
  assert.equal(figure.visible,true);
  const body=figure.children[0].children[0] as THREE.Mesh;
  assert.equal((body.material as THREE.MeshStandardMaterial).color.getHex(),IDEA_COLORS.grove);
  // Workers pop in with a scale-up instead of appearing at full size.
  assert.ok(figure.scale.x<1.55);
  const origin=figure.position.clone();
  worker.update(10.6);assert.ok(figure.position.distanceTo(origin)>1);
  worker.update(11.4);assert.equal(worker.visibleCount,3);
  assert.equal(pops.filter(Boolean).length,3);
  for(let t=11.4;t<13;t+=1/30)worker.update(t);
  assert.ok(strikes>=3,'crew swings its mallets');
  worker.celebrate(13);assert.equal(cheers,1);
  worker.update(13.3);
  const worksite=figure.position.clone();
  worker.finishCue(false,14);worker.update(14.5);
  assert.ok(figure.visible&&figure.position.distanceTo(worksite)>0);
  worker.update(16);assert.equal(worker.visibleCount,0);
  assert.equal(pops.filter(p=>!p).length,3,'each worker poofs out');
  worker.startCue('river',{x:32,z:0},()=>true,false,20);
  assert.equal((body.material as THREE.MeshStandardMaterial).color.getHex(),IDEA_COLORS.river);
  worker.finishCue(true);assert.equal(worker.visibleCount,0);
  worker.dispose();assert.equal(scene.children.length,0);
});
