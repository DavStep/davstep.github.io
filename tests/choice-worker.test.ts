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

test('one idea-colored worker arrives, works, leaves, and clears on skip',()=>{
  const scene=new THREE.Scene(),worker=new ChoiceWorker(scene);
  const figure=worker.group.getObjectByName('Choice_worker')!;
  assert.equal(figure.visible,false);
  worker.startCue('grove',{x:32,z:0},()=>true,false,10);
  assert.equal(worker.group.children.length,1);
  assert.equal(figure.name,'Choice_worker_grove');
  assert.equal(figure.visible,true);
  const body=figure.children[0].children[0] as THREE.Mesh;
  assert.equal((body.material as THREE.MeshStandardMaterial).color.getHex(),IDEA_COLORS.grove);
  const origin=figure.position.clone();
  worker.update(11);assert.ok(figure.position.distanceTo(origin)>1);
  const worksite=figure.position.clone();
  worker.finishCue(false,12);worker.update(12.5);
  assert.ok(figure.visible&&figure.position.distanceTo(worksite)>0);
  worker.update(13.1);assert.equal(figure.visible,false);
  worker.startCue('river',{x:32,z:0},()=>true,false,20);
  assert.equal((body.material as THREE.MeshStandardMaterial).color.getHex(),IDEA_COLORS.river);
  worker.finishCue(true);assert.equal(figure.visible,false);
  worker.dispose();assert.equal(scene.children.length,0);
});
