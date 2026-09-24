import assert from 'node:assert/strict';
import test from 'node:test';
import { IDEAS, SECRET_ORDER, chooseIdea, evaluate, newGameSave, parseGameSave, restartGame } from '../src/town/game';
import { snapshotForGame } from '../src/town/game-snapshot';
import { millStreamPoint } from '../src/town/game-path';
import { streamSurfaceHeight } from '../src/town/game-scenery';
import { riverCenter, riverHalfWidth, riverSurfaceHeight, terrainHeight } from '../src/town/environment';

function* orders(items: readonly (typeof IDEAS)[number][]): Generator<(typeof IDEAS)[number][]> {
  if (items.length === 0) { yield []; return; }
  for (const idea of items) {
    for (const tail of orders(items.filter(item => item !== idea))) yield [idea, ...tail];
  }
}

test('exactly one of the 40,320 orders reaches every MAX', () => {
  const perfect = [...orders(IDEAS)].filter(order => evaluate(order).perfect);
  assert.deepEqual(perfect, [[...IDEAS]]);
});

test('storybook night is a distinct secret ending', () => {
  const state = evaluate(SECRET_ORDER);
  assert.equal(state.secret, true);
  assert.equal(state.perfect, false);
  assert.equal(state.levels.archive, 1);
  assert.equal(state.levels.windmill, 3);
});

test('new ideas upgrade earlier buildings and their surroundings', () => {
  const before = evaluate(IDEAS.slice(0, 5));
  assert.equal(before.levels.windmill, 0);
  const after = evaluate(IDEAS.slice(0, 6));
  assert.equal(after.levels.windmill, 3);
  assert.equal(after.levels.grove, 3);
  assert.equal(after.levels.workshop, 3);
  const snapshot = snapshotForGame(after.levels);
  assert.equal(snapshot.plots.find(plot => plot.id === 'mill')?.stage, 6);
  assert.equal(snapshot.plots.find(plot => plot.id === 'forge')?.stage, 6);
  assert.equal(snapshot.plots.find(plot => plot.id === 'home-12')?.stage, 0);
});

test('save resumes, rejects corrupt choices, and preserves discoveries on restart', () => {
  const save = newGameSave();
  chooseIdea(save, 'settlers');
  assert.deepEqual(parseGameSave(JSON.stringify(save)).order, ['settlers']);
  assert.deepEqual(parseGameSave('{').order, []);
  assert.deepEqual(parseGameSave('{"version":1,"order":["grove","grove"]}').order, []);
  assert.throws(() => chooseIdea(save, 'settlers'));
  save.secretFound = true;
  restartGame(save);
  assert.deepEqual(save.order, []);
  assert.equal(save.secretFound, true);
});

test('upgraded stream starts inside the main river and stays above its carved bed', () => {
  const source = millStreamPoint(0);
  assert.ok(Math.abs(source.z - riverCenter(source.x)) < riverHalfWidth(source.x));
  assert.equal(streamSurfaceHeight(0), riverSurfaceHeight(source.x));
  for (const t of [0, .1, .25, .5, .75, 1]) {
    const point = millStreamPoint(t);
    assert.ok(streamSurfaceHeight(t) > terrainHeight(point.x, point.z) + .25, `stream submerged at ${t}`);
  }
});
