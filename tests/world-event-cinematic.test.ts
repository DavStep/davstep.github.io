import test from 'node:test';
import assert from 'node:assert/strict';
import {worldEventCue,worldEventDuration} from '../src/town/world-event-cinematic';
test('cinematic phases provide cause, travel, interaction, delivery and permanent consequence',()=>{
  assert.deepEqual([0,.2,.45,.7,1].map(p=>worldEventCue(p).phase),['source','travel','interaction','delivery','consequence']);
  for(const p of [1,.45,0,.7,.2,.45])assert.deepEqual(worldEventCue(p),worldEventCue(p));
  assert.equal(worldEventCue(Infinity).progress,0);assert.equal(worldEventCue(-1).local,0);assert.equal(worldEventCue(2).local,1);
  assert.ok(worldEventDuration('expedition')>worldEventDuration('dragon-warning'));
});
