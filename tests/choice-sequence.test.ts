import test from 'node:test';
import assert from 'node:assert/strict';
import { choiceSequence } from '../src/town/action-story';
import { evaluate,IDEAS,SECRET_ORDER,type Idea } from '../src/town/game';

test('Settlers then Grove is one arrival and one Settlers upgrade, without bouncing back',()=>{
  const state=evaluate(['settlers','grove']),sequence=choiceSequence(state);
  assert.deepEqual(sequence.map(beat=>beat.event.idea),['grove','settlers']);
  assert.deepEqual(sequence.map(beat=>beat.arrival),[true,false]);
  assert.deepEqual(sequence[0].event.sources,[]);
  assert.deepEqual(sequence[1].event.sources.map(source=>source.idea),['grove']);
  assert.equal(sequence[0].event.level,state.levels.grove);
  assert.equal(sequence[1].event.level,state.levels.settlers);
});
test('every selection visits each affected site once and preserves all rewards and unlocks',()=>{
  const orders:Idea[][]=[[...IDEAS],[...SECRET_ORDER],[...IDEAS].reverse()];
  let seed=4597;
  for(let n=0;n<60;n++){
    const order=[...IDEAS];
    for(let i=order.length-1;i>0;i--){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const j=seed%(i+1);[order[i],order[j]]=[order[j],order[i]];}
    orders.push(order);
  }
  assert.deepEqual(choiceSequence(evaluate([])),[]);
  for(const order of orders)for(let turn=1;turn<=order.length;turn++){
    const before=evaluate(order.slice(0,turn-1)),after=evaluate(order.slice(0,turn));
    const sequence=choiceSequence(after),levels={...before.levels},projects=new Set(before.projects);
    assert.equal(sequence[0].event.idea,order[turn-1]);
    assert.equal(sequence.filter(beat=>beat.arrival).length,1);
    assert.equal(new Set(sequence.map(beat=>beat.event.idea)).size,sequence.length);
    for(const beat of sequence){
      for(const source of beat.event.sources){assert.equal(source.idea,order[turn-1]);assert.ok(levels[source.idea]>=source.level);}
      assert.ok(beat.event.level>levels[beat.event.idea]);levels[beat.event.idea]=beat.event.level;
      for(const project of beat.projects)projects.add(project);
    }
    assert.deepEqual(levels,after.levels,'normal playback and skip reach the same levels');
    assert.deepEqual([...projects].sort(),[...after.projects].sort(),'no collaboration or gate unlock is lost');
  }
});
