import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_LEVEL, IDEAS, SECRET_ORDER, chooseIdea, evaluate, newGameSave, parseGameSave, restartGame } from '../src/town/game';
import { snapshotForGame } from '../src/town/game-snapshot';
import { millStreamPoint } from '../src/town/game-path';
import { streamSurfaceHeight } from '../src/town/game-scenery';
import { naturalTerrainHeight, riverCenter, riverHalfWidth, riverSurfaceHeight, terrainHeight } from '../src/town/environment';
import { CARDINAL_GATE_MASK } from '../src/town/wall-layout';

test('a prepared world develops all ten sites and earns the dragon beacon ending',()=>{
  const state=evaluate(SECRET_ORDER);
  assert.equal(state.score,80);assert.equal(state.perfect,true);assert.equal(state.secret,true);
  assert.equal(state.world.dragon,'tamed');assert.equal(state.world.volcano,'contained');
  assert.equal(state.world.beacon,true);assert.deepEqual(state.pending,[]);
});
test('supply shortages recover when their source is placed later',()=>{
  assert.equal(evaluate(['workshop','grove']).levels.workshop,1);
  const supplied=evaluate(['workshop','grove','settlers']);
  assert.equal(supplied.levels.workshop,3);assert.equal(supplied.levels.grove,3);
  assert.equal(supplied.levels.settlers,3);
  assert.equal(evaluate(['settlers','grove','workshop']).levels.workshop,3);
});
test('late roads can open existing walls rather than permanently missing a partnership',()=>{
  const state=evaluate(['walls','settlers','grove','workshop','roads']);
  assert.equal(state.gateMask,CARDINAL_GATE_MASK);assert.ok(state.projects.includes('road-gates'));
});
test('the opening has no placed buildings, while event landmarks have initial persistent state',()=>{
  const state=evaluate([]),empty=snapshotForGame(state.levels);
  assert.ok(empty.plots.every(plot=>plot.stage===0));assert.equal(empty.roads,0);assert.equal(empty.residents,0);
  assert.deepEqual(state.world.artifacts,{lens:'shrine',gold:'island',core:'mountain'});
  assert.equal(state.world.volcano,'quiet');assert.equal(state.world.dragon,'unaware');
});
test('version three saves preserve decisions and discoveries without reinterpreting legacy runs',()=>{
  const save=newGameSave();chooseIdea(save,'settlers');
  assert.equal(save.version,3);assert.deepEqual(parseGameSave(JSON.stringify(save)).order,['settlers']);
  for(const bad of ['{','{"version":3,"order":["grove","grove"]}','{"version":2,"order":["settlers"]}','{"version":3,"order":["unknown"]}'])assert.deepEqual(parseGameSave(bad).order,[]);
  assert.throws(()=>chooseIdea(save,'settlers'));assert.throws(()=>evaluate(['grove','grove']));
  save.secretFound=true;restartGame(save);assert.deepEqual(save.order,[]);assert.equal(save.secretFound,true);
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

test('planet scenery follows functioning supplies: wind drives gears, irrigation grows crops',async()=>{
  const THREE=await import('three'),{GameScenery}=await import('../src/town/game-scenery');
  const previous=globalThis.matchMedia;globalThis.matchMedia=(()=>({matches:false})) as typeof matchMedia;
  const scene=new THREE.Scene();
  const environment={createRiverMaterial:()=>new THREE.MeshStandardMaterial(),createPondMaterial:()=>new THREE.MeshStandardMaterial(),setStreamProgress(){}};
  const scenery=new GameScenery(scene,true,environment as import('../src/town/environment').Environment,true);
  try{
    scenery.setLevels(evaluate(['windmill','river']).levels,false,true);
    assert.equal(scene.getObjectByName('Built river and irrigation')?.visible,false);
    assert.equal(scene.getObjectByName('Continuous golden wheat field')?.visible,false);
    const dryMill=evaluate(['settlers','grove','workshop','windmill']);
    scenery.setLevels(dryMill.levels,false,true);
    const rotor=scenery.group.getObjectByName('windmill-rotor')!;
    assert.equal(rotor.visible,true);const rotation=rotor.rotation.z;scenery.update(1,.5);
    assert.ok(rotor.rotation.z<rotation,'windmill sails turn without river power');
    assert.equal(scene.getObjectByName('Continuous golden wheat field')?.visible,false);
    scenery.setLevels(evaluate([...dryMill.order,'river']).levels,false,true);
    assert.equal(scene.getObjectByName('Built river and irrigation')?.visible,true);
    assert.equal(scene.getObjectByName('Continuous golden wheat field')?.visible,true);
  }finally{scenery.dispose();globalThis.matchMedia=previous;}
});
