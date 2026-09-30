import test from 'node:test';
import assert from 'node:assert/strict';
import { decisionSequence, choiceSequence } from '../src/town/action-story';
import { evaluate, IDEAS, SECRET_ORDER, type Idea } from '../src/town/game';

test('consecutive growth stages combine while supplies preserve their causal order',()=>{
  const sequence=choiceSequence(evaluate(['settlers','grove']));
  assert.deepEqual(sequence.map(beat=>beat.event.idea),['grove','settlers']);
  assert.deepEqual(sequence.map(beat=>beat.arrival),[true,false]);
  assert.deepEqual(sequence[0].event.sources.map(source=>source.idea),['settlers']);
  assert.deepEqual(sequence[1].event.sources.map(source=>source.idea),['grove']);
});
test('cinematic and development playback converges with skip and reload',()=>{
  const orders:Idea[][]=[[...IDEAS],[...SECRET_ORDER],[...IDEAS].reverse()];let seed=4597;
  for(let n=0;n<70;n++){
    const order=[...IDEAS];for(let i=order.length-1;i>0;i--){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const j=seed%(i+1);[order[i],order[j]]=[order[j],order[i]];}orders.push(order);
  }
  assert.deepEqual(decisionSequence(evaluate([])),[]);
  for(const order of orders)for(let turn=1;turn<=order.length;turn++){
    const before=evaluate(order.slice(0,turn-1)),after=evaluate(order.slice(0,turn));
    const sequence=decisionSequence(after),levels={...before.levels},projects=new Set(before.projects);
    let world=before.world,arrivals=0;
    for(const step of sequence){
      if(step.kind==='world'){world=step.event.after;continue;}
      const beat=step.beat;if(beat.arrival)arrivals++;
      for(const source of beat.event.sources)assert.ok(levels[source.idea]>=source.level,`${source.idea} must exist before ${beat.event.idea}`);
      assert.ok(beat.event.level>levels[beat.event.idea]);levels[beat.event.idea]=beat.event.level;
      for(const project of beat.projects)projects.add(project);world=beat.world;
    }
    assert.equal(arrivals,1);assert.deepEqual(levels,after.levels);assert.deepEqual(world,after.world);
    assert.deepEqual([...projects].sort(),[...after.projects].sort());
  }
});
test('the beacon cinematic follows artifact installation and precedes the final tower reveal',()=>{
  const state=evaluate(SECRET_ORDER.slice(0,8)),sequence=decisionSequence(state);
  const beacon=sequence.findIndex(step=>step.kind==='world'&&step.event.kind==='beacon-lit');
  const installed=sequence.findIndex(step=>step.kind==='world'&&step.event.kind==='artifact-installed'&&step.event.artifact==='core');
  const tower=sequence.findIndex(step=>step.kind==='development'&&step.beat.event.idea==='observatory'&&step.beat.event.level===8);
  assert.ok(installed>=0&&beacon>installed&&tower>beacon);
});
