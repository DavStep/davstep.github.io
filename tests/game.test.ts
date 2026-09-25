import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_LEVEL, IDEAS, SECRET_ORDER, chooseIdea, evaluate, newGameSave, parseGameSave, restartGame } from '../src/town/game';
import { snapshotForGame } from '../src/town/game-snapshot';
import { millStreamPoint } from '../src/town/game-path';
import { streamSurfaceHeight } from '../src/town/game-scenery';
import { naturalTerrainHeight, riverCenter, riverHalfWidth, riverSurfaceHeight, terrainHeight } from '../src/town/environment';
import { buildColliders, isBlocked } from '../src/town/collision';
import { CARDINAL_GATE_MASK, wallIsGate } from '../src/town/wall-layout';

test('the valley order completes every collaboration and reaches all eighty levels', () => {
  const state = evaluate(IDEAS);
  assert.equal(IDEAS.length, 10);
  assert.equal(state.perfect, true);
  assert.equal(state.secret, false);
  assert.equal(state.score, 80);
  assert.equal(state.projects.length, 28);
  assert.deepEqual(state.faults, []);
});

test('Archive first opens a distinct complete Storybook Night route', () => {
  const state = evaluate(SECRET_ORDER);
  assert.equal(state.route, 'storybook');
  assert.equal(state.secret, true);
  assert.equal(state.perfect, true);
  assert.equal(state.score, 80);
  assert.equal(state.projects.length, 28);
});

test('reversing a pair misses only its collaboration; later partners still grow', () => {
  const state = evaluate(['walls', ...IDEAS.filter(idea => idea !== 'walls')]);
  assert.equal(state.perfect, false);
  assert.equal(state.gateMask, 0);
  assert.ok(state.faults.some(fault => fault.project === 'road-gates'));
  assert.ok(state.faults.some(fault => fault.project === 'gate-fittings'));
  assert.equal(state.levels.walls, 4);
  assert.equal(state.levels.settlers, MAX_LEVEL);
  assert.equal(state.levels.river, MAX_LEVEL);
  assert.ok(state.score < 80);
});

test('each choice upgrades only itself and already selected project partners', () => {
  const order: typeof IDEAS[number][] = ['settlers', 'grove', 'workshop', 'roads', 'walls', 'market', 'windmill', 'archive', 'river', 'observatory'];
  let before = evaluate([]);
  for (const idea of order) {
    const after = evaluate([...before.order, idea]);
    assert.equal(after.events.filter(event => event.level === 1).length, 1);
    assert.equal(after.events[0].idea, idea);
    for (const previous of IDEAS) {
      if (previous !== idea && after.levels[previous] > before.levels[previous])
        assert.ok(after.events.some(event => event.idea === previous && event.project));
      if (!after.order.includes(previous)) assert.equal(after.levels[previous], 0);
    }
    before = after;
  }
  assert.equal(before.perfect, true);
});

test('a late river advances earlier sites and the scene reflects their new levels', () => {
  const before = evaluate(IDEAS.slice(0, 8));
  const after = evaluate([...before.order, 'river']);
  assert.ok(after.levels.grove > before.levels.grove);
  assert.ok(after.levels.workshop > before.levels.workshop);
  assert.ok(after.levels.windmill > before.levels.windmill);
  const snapshot = snapshotForGame(after.levels, 0, after.gateMask);
  assert.equal(snapshot.plots.find(plot => plot.id === 'mill')?.stage, 6);
  assert.equal(snapshot.plots.find(plot => plot.id === 'forge')?.stage, 8);
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

test('mapped gates require the Roads–Walls collaboration', () => {
  const missed = evaluate(['settlers', 'grove', 'workshop', 'walls', 'roads', 'market', 'windmill']);
  assert.equal(missed.gateMask, 0);
  assert.ok(missed.faults.some(fault => fault.project === 'road-gates'));
  assert.ok(isBlocked(34, 0, buildColliders(snapshotForGame(missed.levels, 0, missed.gateMask))));
  const linked = evaluate(['settlers', 'grove', 'workshop', 'roads', 'walls', 'market', 'windmill']);
  assert.equal(linked.gateMask, CARDINAL_GATE_MASK);
  assert.ok(linked.projects.includes('road-gates'));
  assert.equal(isBlocked(34, 0, buildColliders(snapshotForGame(linked.levels, 0, linked.gateMask))), false);
  for (const sector of [0, 7, 8, 15, 16, 23, 24, 31]) assert.ok(wallIsGate(sector, linked.gateMask));
});

test('save resumes new rules, rejects old and corrupt choices, and preserves discoveries', () => {
  const save = newGameSave();
  chooseIdea(save, 'settlers');
  assert.deepEqual(parseGameSave(JSON.stringify(save)).order, ['settlers']);
  assert.deepEqual(parseGameSave('{').order, []);
  assert.deepEqual(parseGameSave('{"version":2,"order":["grove","grove"]}').order, []);
  assert.deepEqual(parseGameSave('{"version":1,"order":["settlers"]}').order, []);
  assert.throws(() => chooseIdea(save, 'settlers'));
  save.secretFound = true;
  restartGame(save);
  assert.deepEqual(save.order, []);
  assert.equal(save.secretFound, true);
  assert.equal(save.bestScore, 0);
});

test('upgraded stream starts inside the main river and stays above its carved bed', () => {
  const source = millStreamPoint(0);
  assert.ok(Math.abs(source.z - riverCenter(source.x)) < riverHalfWidth(source.x));
  assert.ok(Math.abs(source.z - riverCenter(source.x)) + 3.1 < riverHalfWidth(source.x), 'both stream banks begin under the river surface');
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

test('game windmill uses the relocated authored rotor and owns its disposable meshes', async () => {
  const THREE = await import('three');
  const { GameScenery } = await import('../src/town/game-scenery');
  const { MAT } = await import('../src/town/materials');
  const { MILL_ROTOR_SOCKET } = await import('../src/town/windmill-layout');
  const previous = globalThis.matchMedia;
  globalThis.matchMedia = (() => ({ matches: false })) as typeof matchMedia;
  const levels = evaluate(IDEAS).levels;
  const site = snapshotForGame(levels).plots.find(p => p.id === 'mill')!;
  const scene = new THREE.Scene();
  const environment = { createRiverMaterial: () => new THREE.MeshStandardMaterial(), createPondMaterial: () => new THREE.MeshStandardMaterial(), setStreamProgress() {} };
  let sharedDisposals = 0;
  const disposed = () => sharedDisposals++;
  Object.values(MAT).forEach(material => material.addEventListener('dispose', disposed));
  try {
    const scenery = new GameScenery(scene, true, environment as import('../src/town/environment').Environment);
    scenery.setLevels(levels, false, true);
    const rotor = scenery.group.getObjectByName('windmill-rotor')!;
    assert.ok(rotor.visible && rotor.children.length > 0);
    assert.deepEqual(rotor.position.toArray(), [site.x + MILL_ROTOR_SOCKET.x, .48 + MILL_ROTOR_SOCKET.y, site.z + MILL_ROTOR_SOCKET.z]);
    scenery.update(1, 1);
    assert.ok(rotor.rotation.z < 0, 'upgraded sails turn');
    scenery.setLevels(evaluate([]).levels, false, true);
    assert.equal(rotor.visible, false);
    scenery.dispose();
    assert.equal(sharedDisposals, 0, 'scenery cleanup preserves town materials');
  } finally {
    Object.values(MAT).forEach(material => material.removeEventListener('dispose', disposed));
    globalThis.matchMedia = previous;
  }
});
