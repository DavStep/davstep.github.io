import assert from 'node:assert/strict';
import test from 'node:test';
import { IDEAS, SECRET_ORDER, chooseIdea, evaluate, newGameSave, parseGameSave, restartGame } from '../src/town/game';
import { snapshotForGame } from '../src/town/game-snapshot';
import { millStreamPoint } from '../src/town/game-path';
import { streamSurfaceHeight } from '../src/town/game-scenery';
import { naturalTerrainHeight, riverCenter, riverHalfWidth, riverSurfaceHeight, terrainHeight } from '../src/town/environment';
import { buildColliders, isBlocked } from '../src/town/collision';
import { CARDINAL_GATE_MASK, wallIsGate } from '../src/town/wall-layout';

test('a connected order can raise all nine ideas to MAX', () => {
  assert.equal(IDEAS.length, 9);
  assert.equal(evaluate(IDEAS).perfect, true);
  assert.equal(evaluate(['walls', ...IDEAS.filter(idea => idea !== 'walls')]).perfect, false);
});

test('storybook night is a distinct secret ending', () => {
  const state = evaluate(SECRET_ORDER);
  assert.equal(state.secret, true);
  assert.equal(state.perfect, false);
  assert.equal(state.levels.archive, 1);
  assert.equal(state.levels.windmill, 3);
});

test('new ideas upgrade earlier buildings and their surroundings', () => {
  const before = evaluate(IDEAS.slice(0, 6));
  assert.equal(before.levels.windmill, 0);
  const after = evaluate(IDEAS.slice(0, 7));
  assert.equal(after.levels.windmill, 3);
  assert.equal(after.levels.grove, 3);
  assert.equal(after.levels.workshop, 3);
  const snapshot = snapshotForGame(after.levels);
  assert.equal(snapshot.plots.find(plot => plot.id === 'mill')?.stage, 6);
  assert.equal(snapshot.plots.find(plot => plot.id === 'forge')?.stage, 6);
  assert.equal(snapshot.plots.find(plot => plot.id === 'home-12')?.stage, 0);
});

test('the opening landscape has no sites or roads until those ideas arrive', () => {
  const empty = snapshotForGame(evaluate([]).levels);
  assert.ok(empty.plots.every(plot => plot.stage === 0));
  assert.equal(empty.roads, 0);
  assert.equal(empty.residents, 0);
  const homes = snapshotForGame(evaluate(['settlers']).levels);
  assert.ok(homes.plots.some(plot => plot.kind === 'home' && plot.stage > 0));
  assert.equal(homes.roads, 0);
  const firstRoad = snapshotForGame(evaluate(['roads']).levels);
  assert.ok(firstRoad.roads > 0);
  assert.ok(firstRoad.roads < snapshotForGame(evaluate(IDEAS.slice(0, 4)).levels).roads);
});

test('walls without existing roads are sealed and strand the outside mill', () => {
  const state = evaluate(['settlers','grove','workshop','walls','roads','market','windmill']);
  assert.equal(state.levels.walls, 1);
  assert.equal(state.levels.roads, 2);
  assert.equal(state.levels.market, 1);
  assert.equal(state.levels.windmill, 1);
  assert.equal(state.gateMask, 0);
  assert.equal(state.isolatedMill, true);
  const snapshot = snapshotForGame(state.levels, 0, state.gateMask);
  assert.equal(snapshot.innerWood, 32);
  assert.equal(snapshot.innerStone, 0);
  assert.equal(snapshot.wallGates, 0);
  assert.ok(isBlocked(34, 0, buildColliders(snapshot)));
});

test('roads laid before walls leave aligned, walkable gates and supply the mill', () => {
  const state = evaluate(['settlers','grove','workshop','roads','walls','market','windmill']);
  assert.equal(state.levels.walls, 3);
  assert.equal(state.levels.windmill, 3);
  assert.equal(state.gateMask, CARDINAL_GATE_MASK);
  for(const sector of [0,7,8,15,16,23,24,31])assert.ok(wallIsGate(sector,state.gateMask));
  const snapshot = snapshotForGame(state.levels, 0, state.gateMask);
  assert.equal(snapshot.innerStone, 32);
  assert.equal(snapshot.outerWood, 32);
  assert.equal(isBlocked(34, 0, buildColliders(snapshot)), false);
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
  const oldEight=['settlers','grove','workshop','roads','market','windmill','archive','observatory'];
  const migrated=parseGameSave(JSON.stringify({version:1,started:true,order:oldEight,bestMax:8,secretFound:false}));
  assert.equal(migrated.order.length,8);
  assert.equal(evaluate(migrated.order).finished,false);
  assert.equal(evaluate(migrated.order).levels.walls,0);
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

test('the mill channel is uncarved before its progression begins', () => {
  const point = millStreamPoint(.62);
  assert.ok(naturalTerrainHeight(point.x, point.z) > terrainHeight(point.x, point.z) + .8);
});
