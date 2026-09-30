import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { activityState,caravanRoute,PlanetActivity } from '../src/town/planet-activity';
import { routePlanetRoads } from '../src/town/planet-roads';
import { snapshotForGame } from '../src/town/game-snapshot';
import { evaluate,IDEAS } from '../src/town/game';
import { PlanetTransport } from '../src/town/planet-transport';

const max={...evaluate([]).levels};for(const idea of IDEAS)max[idea]=8;
test('ambient rewards unlock at true max level, not the final hero model stage',()=>{
  assert.deepEqual(activityState(snapshotForGame({...max,market:7,observatory:7})),{caravans:0,magic:false});
  assert.deepEqual(activityState(snapshotForGame(max)),{caravans:2,magic:true});
  assert.equal(activityState(snapshotForGame({...max,settlers:0})).caravans,0);
  assert.equal(activityState(snapshotForGame({...max,roads:0})).caravans,0);
});
test('caravans use connected built roads and freeze under reduced motion; magic resets with upgrades',()=>{
  const snapshot=snapshotForGame(max),segments=routePlanetRoads(snapshot),activity=new PlanetActivity(new THREE.Group(),true);
  for(const seed of [0,1]){
    const route=caravanRoute(segments,seed);assert.ok(route.length>=8,'a usable trade route exists');
    const same=(a:{x:number;z:number},b:{x:number;z:number})=>Math.hypot(a.x-b.x,a.z-b.z)<.0002;
    for(let i=1;i<route.length;i++)assert.ok(segments.some(({a,b})=>same(a,route[i-1])&&same(b,route[i])||same(b,route[i-1])&&same(a,route[i])),'every traveled edge exists');
  }
  activity.update(snapshot,segments,1);activity.render(0,false);
  const carts=activity.group.children.filter(o=>o.name==='Merchant caravan');assert.ok(carts.every(c=>c.visible));
  const initial=carts[0].position.clone();for(let i=1;i<=40;i++)activity.render(i*100,false);assert.ok(initial.distanceTo(carts[0].position)>1);
  const frozen=carts[0].position.clone();activity.render(4100,true);activity.render(4200,true);assert.ok(frozen.equals(carts[0].position));
  assert.equal(activity.group.getObjectByName('Wizard sky confetti')!.visible,false);
  activity.update(snapshotForGame({...max,market:0,observatory:0}),segments,1);assert.ok(carts.every(c=>!c.visible));
  activity.dispose();assert.equal(activity.group.parent,null);
});
test('fishing cutter anchors to fish and periodically relocates while trade continues',()=>{
  const transport=new PlanetTransport(new THREE.Group(),true);transport.update(snapshotForGame(max),false);transport.render(0,false);
  const fisher=transport.group.getObjectByName('Fishing boat')!,trader=transport.group.getObjectByName('Island trading ship')!;
  const position=fisher.position.clone().normalize(),tradePosition=trader.position.clone();
  for(let i=1;i<=100;i++)transport.render(i*100,false);
  assert.ok(position.distanceTo(fisher.position.clone().normalize())<1e-10);assert.ok(tradePosition.distanceTo(trader.position)>1);
  assert.equal(fisher.userData.activity,'fishing');assert.equal(fisher.getObjectByName('Billowing canvas')!.visible,false);assert.equal(fisher.getObjectByName('Fishing bobber')!.visible,true);
  for(let i=101;i<=400;i++)transport.render(i*100,false);
  assert.equal(fisher.userData.activity,'relocating');assert.ok(position.distanceTo(fisher.position.clone().normalize())>.001);assert.equal(fisher.getObjectByName('Fishing bobber')!.visible,false);
  transport.dispose();
});
