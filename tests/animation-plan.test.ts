import assert from 'node:assert/strict';
import test from 'node:test';
import { choiceBeats } from '../src/town/animation-plan';
import { evaluate } from '../src/town/game';

test('one arrival is followed by new levels without replaying its entrance', () => {
  const before=evaluate(['settlers','grove','workshop','roads','market','river']).levels;
  const after=evaluate(['settlers','grove','workshop','roads','market','river','windmill']).levels;
  const beats=choiceBeats(before,after,'windmill');
  assert.deepEqual(beats.filter(beat=>beat.idea==='windmill').map(beat=>[beat.level,beat.kind]),[
    [1,'arrival'],[2,'upgrade'],[3,'upgrade'],[4,'upgrade'],
  ]);
  assert.equal(beats.filter(beat=>beat.kind==='arrival').length,1);
  assert.ok(beats.every(beat=>beat.level>before[beat.idea]&&beat.level<=after[beat.idea]));
  assert.equal(new Set(beats.map(beat=>`${beat.idea}:${beat.level}`)).size,beats.length);
});

test('earlier ideas only animate newly reached levels', () => {
  const before=evaluate(['settlers','grove','workshop']).levels;
  const after=evaluate(['settlers','grove','workshop','roads']).levels;
  const beats=choiceBeats(before,after,'roads');
  assert.deepEqual(beats.filter(beat=>beat.idea==='settlers'),[{idea:'settlers',level:2,kind:'upgrade'}]);
  assert.deepEqual(beats.filter(beat=>beat.idea==='roads').map(beat=>beat.level),[1,2]);
  assert.equal(beats.some(beat=>beat.idea==='grove'),false);
});

test('a rescued workshop receives upgrade beats without repeating its parachute arrival', () => {
  const before=evaluate(['workshop','grove']).levels;
  const after=evaluate(['workshop','grove','settlers']).levels;
  const beats=choiceBeats(before,after,'settlers');
  assert.deepEqual(beats.filter(beat=>beat.idea==='workshop'),[{idea:'workshop',level:2,kind:'upgrade'}]);
  assert.equal(beats.filter(beat=>beat.kind==='arrival').length,1);
});
