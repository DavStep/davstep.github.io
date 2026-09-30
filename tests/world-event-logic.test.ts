import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, IDEAS, SECRET_ORDER, type Idea } from '../src/town/game';
import { worldNextEvent } from '../src/town/world-event-logic';

const voyage:Idea[]=['settlers','grove','workshop','river'];
test('treasure comes from the island and schedules one preparation choice',()=>{
  const before=evaluate(voyage.slice(0,-1)),state=evaluate(voyage);
  assert.equal(before.world.artifacts.gold,'island');
  assert.equal(state.world.artifacts.gold,'town');assert.equal(state.world.dragon,'approaching');
  assert.equal(state.world.dragonDueTurn,5);
  assert.deepEqual(state.worldEvents.map(e=>e.kind),['expedition','dragon-warning']);
  assert.match(worldNextEvent(state.world),/next choice/);
});
test('a Wizard placed during the warning tames the dragon immediately',()=>{
  const state=evaluate([...voyage,'observatory']);
  assert.equal(state.world.dragon,'tamed');assert.equal(state.world.artifacts.gold,'friendly-dragon');
  assert.ok(state.world.installed.includes('gold'));assert.equal(state.world.orchard,'healthy');
  assert.ok(state.worldEvents.some(e=>e.kind==='dragon-tamed'));
});
test('a raid steals gold and burns fruit production; later restoration does not undo theft',()=>{
  const raid=evaluate([...voyage,'walls']);
  assert.equal(raid.world.dragon,'departed');assert.equal(raid.world.orchard,'burned');
  assert.equal(raid.world.artifacts.gold,'departed-dragon');assert.ok(!raid.world.capabilities.includes('orchard-food'));
  const later=evaluate([...voyage,'walls','observatory']);
  assert.equal(later.world.orchard,'restored');assert.equal(later.world.dragon,'departed');
  assert.ok(later.world.capabilities.includes('orchard-food'));assert.ok(!later.world.installed.includes('gold'));
});
test('an existing prepared mine visibly contains the eighth-choice eruption',()=>{
  const warning=evaluate(SECRET_ORDER.slice(0,6));assert.equal(warning.world.volcano,'warning');assert.equal(warning.world.minePrepared,true);
  assert.equal(evaluate(SECRET_ORDER.slice(0,7)).world.volcano,'warning');
  const eruption=evaluate(SECRET_ORDER.slice(0,8));
  assert.equal(eruption.world.volcano,'contained');assert.equal(eruption.world.mountainPass,'open');
  assert.ok(eruption.history.some(e=>e.kind==='core-recovered'&&e.turn===8));
});
test('mine entrance alone cannot contain lava; local equipment repairs it on a later choice',()=>{
  const order:Idea[]=['settlers','grove','workshop','roads','river','observatory','market','walls','archive','windmill'];
  const damaged=evaluate(order.slice(0,8));
  assert.equal(damaged.world.volcano,'overflowed');assert.equal(damaged.world.minePrepared,false);
  assert.equal(damaged.world.mountainPass,'blocked');assert.equal(damaged.world.artifacts.core,'mountain');
  assert.equal(damaged.world.artifacts.lens,'installed','an already delivered lens survives');
  assert.ok(!damaged.world.capabilities.includes('trade'));
  const repaired=evaluate(order.slice(0,9));
  assert.equal(repaired.world.mountainPass,'bypass');assert.equal(repaired.world.volcano,'overflowed');
  assert.equal(repaired.world.artifacts.core,'installed');assert.ok(repaired.worldEvents.some(e=>e.kind==='pass-repaired'));
});
test('lava can stop the first lens caravan; opening a bypass releases its delivery',()=>{
  const order:Idea[]=['settlers','grove','workshop','windmill','river','market','walls','roads','archive','observatory'];
  const blocked=evaluate(order.slice(0,8));
  assert.equal(blocked.world.caravan,'waiting');assert.equal(blocked.world.artifacts.lens,'shrine');
  assert.ok(blocked.world.capabilities.includes('ship'),'sea travel remains available');
  const repaired=evaluate(order.slice(0,9));
  assert.equal(repaired.world.caravan,'delivered');assert.equal(repaired.world.artifacts.lens,'town');
  const kinds=repaired.worldEvents.map(e=>e.kind);assert.ok(kinds.indexOf('pass-repaired')<kinds.indexOf('lens-delivery'));
});
test('the last Wizard uses prior artifacts and handles a still-approaching dragon',()=>{
  const before=evaluate(IDEAS.slice(0,9)),after=evaluate(IDEAS);
  assert.equal(before.world.dragon,'approaching');assert.equal(before.world.artifacts.lens,'town');assert.equal(before.world.artifacts.core,'town');
  assert.equal(after.world.dragon,'tamed');assert.equal(after.levels.observatory,8);assert.equal(after.world.beacon,true);
});
test('a last-turn ship expedition resolves its encounter without an eleventh click',()=>{
  const order=[...IDEAS.filter(i=>i!=='river'),'river'] as Idea[];
  const state=evaluate(order);assert.equal(state.finished,true);assert.equal(state.world.dragon,'tamed');
  assert.equal(state.world.dragonDueTurn,null);assert.equal(state.world.beacon,true);
  assert.ok(state.worldEvents.some(e=>e.kind==='expedition'));assert.ok(state.worldEvents.some(e=>e.kind==='dragon-tamed'));
});
test('last ordinary buildings use existing supplies without a future trigger',()=>{
  const state=evaluate(SECRET_ORDER);assert.equal(state.order.at(-1),'walls');assert.equal(state.levels.walls,8);
  assert.equal(state.events[0].idea,'walls');assert.equal(state.events.at(-1)?.level,8);
});
test('random orders preserve single encounters, artifact custody and stage bounds',()=>{
  let seed=8172;
  for(let n=0;n<250;n++){
    const order=[...IDEAS];for(let i=9;i>0;i--){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const j=seed%(i+1);[order[i],order[j]]=[order[j],order[i]];}
    const state=evaluate(order);
    assert.equal(new Set(state.history.map(e=>e.id)).size,state.history.length);
    assert.equal(state.history.filter(e=>e.kind.startsWith('eruption-')).length,1);
    assert.equal(state.history.filter(e=>e.kind==='dragon-tamed'||e.kind==='dragon-raid').length,1);
    assert.equal(state.history.filter(e=>e.kind==='expedition').length,1);
    assert.ok(Object.values(state.levels).every(l=>l>=1&&l<=8));assert.equal(state.world.dragonDueTurn,null);
    if(state.world.dragon==='departed'){assert.equal(state.world.artifacts.gold,'departed-dragon');assert.equal(state.world.beacon,false);}
    if(state.world.beacon)assert.deepEqual([...state.world.installed].sort(),['core','gold','lens']);
    assert.deepEqual(evaluate(order),state);
  }
});

test('event outcomes match an independent positional oracle across 2000 full orders',()=>{
  let seed=33591;
  for(let n=0;n<2000;n++){
    const order=[...IDEAS];for(let i=9;i>0;i--){seed=(Math.imul(seed,1103515245)+12345)>>>0;const j=seed%(i+1);[order[i],order[j]]=[order[j],order[i]];}
    const pos=(idea:Idea)=>order.indexOf(idea)+1;
    const supplies=Math.max(pos('settlers'),pos('grove'),pos('workshop'));
    const expeditionTurn=Math.max(supplies,pos('river'));
    const arrivalTurn=Math.min(10,expeditionTurn+1);
    const prepared=Math.max(supplies,pos('roads'),pos('archive'))<=8;
    const tame=pos('observatory')<=arrivalTurn;
    const state=evaluate(order);
    assert.equal(state.world.dragon,tame?'tamed':'departed');
    assert.equal(state.world.volcano,prepared?'contained':'overflowed');
    assert.equal(state.history.find(e=>e.kind==='expedition')?.turn,expeditionTurn);
    assert.equal(state.history.find(e=>e.kind==='dragon-tamed'||e.kind==='dragon-raid')?.turn,arrivalTurn);
    assert.equal(state.world.beacon,tame,'all supplies eventually arrive, but stolen gold stays lost');
    assert.equal(state.perfect,tame);assert.equal(state.secret,tame&&prepared);
  }
});


test('the result explains the stolen ingredient rather than an internal beacon flag',()=>{
  const state=evaluate(['settlers','grove','workshop','river','walls','windmill','market','roads','archive','observatory']);
  assert.deepEqual(state.pending.find(p=>p.idea==='observatory')?.missing,['the retained dragon hoard']);
});
