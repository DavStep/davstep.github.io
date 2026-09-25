import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_LEVEL, IDEAS, SECRET_ORDER, chooseIdea, evaluate, newGameSave, parseGameSave, restartGame, upgradeBlocker } from '../src/town/game';
import { snapshotForGame } from '../src/town/game-snapshot';
import { millStreamPoint } from '../src/town/game-path';
import { streamSurfaceHeight } from '../src/town/game-scenery';
import { naturalTerrainHeight, riverCenter, riverHalfWidth, riverSurfaceHeight, terrainHeight } from '../src/town/environment';
import { buildColliders, isBlocked } from '../src/town/collision';
import { CARDINAL_GATE_MASK, wallIsGate } from '../src/town/wall-layout';

test('a connected order can raise all ten ideas to MAX', () => {
  assert.equal(IDEAS.length, 10);
  assert.equal(evaluate(IDEAS).perfect, true);
  assert.equal(evaluate(['walls', ...IDEAS.filter(idea => idea !== 'walls')]).perfect, true);
});

test('storybook night is a distinct secret ending', () => {
  const state = evaluate(SECRET_ORDER);
  assert.equal(state.secret, true);
  assert.equal(state.perfect, true);
  assert.equal(state.levels.archive, MAX_LEVEL);
  assert.equal(state.levels.windmill, MAX_LEVEL);
});

test('every choice retries blocked options and recovers chains of earlier buildings', () => {
  const waiting = evaluate(['archive','windmill','market','roads','workshop','grove']);
  assert.ok(['archive','windmill','market','roads','workshop','grove'].every(key => waiting.levels[key as keyof typeof waiting.levels] === 1));
  const recovered = evaluate([...waiting.order, 'settlers', 'river']);
  assert.ok(recovered.levels.grove >= 3);
  assert.ok(recovered.levels.workshop >= 3);
  assert.ok(recovered.levels.roads >= 3);
  assert.ok(recovered.levels.market >= 3);
  assert.ok(recovered.levels.windmill >= 3);
  assert.ok(recovered.levels.archive >= 3);
  assert.equal(recovered.levels.walls, 0, 'unchosen options stay absent');
  assert.ok(recovered.levels.workshop>1, 'the old workshop blocker is cleared');
  assert.equal(evaluate([...recovered.order, 'walls', 'observatory']).perfect, true);
});

test('every unfinished placed option has a real blocker after each choice', () => {
  // Many different orders exercise recovery and sealed routes at every prefix.
  let seed = 71829;
  for (let run = 0; run < 100; run++) {
    const order = [...IDEAS];
    for (let i = order.length - 1; i > 0; i--) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const j = seed % (i + 1); [order[i], order[j]] = [order[j], order[i]];
    }
    let before = evaluate([]);
    for (let turn = 1; turn <= order.length; turn++) {
      const after = evaluate(order.slice(0, turn));
      for (const idea of IDEAS) {
        assert.ok(after.levels[idea] >= before.levels[idea]);
        if (after.levels[idea] > 0 && after.levels[idea] < MAX_LEVEL)
          assert.ok(upgradeBlocker(idea, after.levels, after.gateMask), `${idea} was eligible but did not upgrade`);
      }
      before = after;
    }
  }
});

test('new ideas upgrade earlier buildings and their surroundings', () => {
  const before = evaluate(IDEAS.slice(0, 6));
  assert.equal(before.levels.windmill, 0);
  const after = evaluate([...IDEAS.slice(0, 7), 'river']);
  assert.ok(after.levels.windmill >= 3);
  assert.ok(after.levels.grove >= 3);
  assert.ok(after.levels.workshop >= 3);
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

test('early walls gain walkable gates when road builders arrive', () => {
  const waiting = evaluate(['settlers','grove','workshop','walls']);
  assert.equal(waiting.gateMask, 0);
  assert.equal(waiting.levels.walls, 1);
  assert.ok(isBlocked(34, 0, buildColliders(snapshotForGame(waiting.levels, 0, waiting.gateMask))));
  const repaired = evaluate([...waiting.order,'roads','market','windmill']);
  assert.equal(repaired.levels.walls, 2);
  assert.equal(repaired.gateMask, CARDINAL_GATE_MASK);
  assert.equal(repaired.isolatedMill, false);
  assert.equal(isBlocked(34, 0, buildColliders(snapshotForGame(repaired.levels, 0, repaired.gateMask))), false);
  assert.match(upgradeBlocker('windmill', repaired.levels, repaired.gateMask)!, /River/);
});

test('roads laid before walls leave aligned, walkable gates and supply the mill', () => {
  const state = evaluate(['settlers','grove','workshop','roads','walls','market','windmill','river']);
  assert.ok(state.levels.walls >= 3);
  assert.ok(state.levels.windmill >= 3);
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
