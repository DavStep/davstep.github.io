import assert from 'node:assert/strict';
import test from 'node:test';
import { choiceBeats } from '../src/town/animation-plan';
import { evaluate, type Idea } from '../src/town/game';

function testChoice(order: Idea[], chosen: Idea) {
  const before = evaluate(order).levels;
  const after = evaluate([...order, chosen]).levels;
  const beats = choiceBeats(before, after, chosen);
  assert.deepEqual(beats.filter(beat => beat.kind === 'arrival'), [{ idea: chosen, level: 1, kind: 'arrival' }]);
  assert.equal(new Set(beats.map(beat => `${beat.idea}:${beat.level}`)).size, beats.length);
  for (const idea of Object.keys(before) as Idea[]) {
    assert.deepEqual(beats.filter(beat => beat.idea === idea).map(beat => beat.level),
      Array.from({ length: after[idea] - before[idea] }, (_, index) => before[idea] + index + 1));
  }
}

test('a new mill animates its arrival and each stage gained from earlier partners', () => {
  testChoice(['settlers', 'grove', 'workshop', 'roads', 'market', 'river'], 'windmill');
});

test('roads advance earlier partners without replaying their arrivals', () => {
  testChoice(['settlers', 'grove', 'workshop'], 'roads');
});

test('an earlier workshop can grow when a later partner arrives', () => {
  testChoice(['workshop', 'grove'], 'settlers');
});
