import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { planetTransportLayout,planetTransportState,seaRoute,mixPoint,harborBerth,bridgeMaterial } from '../src/town/planet-transport-layout';
import { PlanetTransport,bridgeDeck } from '../src/town/planet-transport';
import { planetElevation,surfaceNormal,PLANET_RADIUS } from '../src/town/planet-geography';
import { routePlanetRoads } from '../src/town/planet-roads';
import { planetRoadClearance } from '../src/town/planet-road-clearance';
import { snapshotForGame } from '../src/town/game-snapshot';
import { evaluate,IDEAS } from '../src/town/game';
const height=(p:{x:number;z:number})=>planetElevation(surfaceNormal(p.x,p.z));

test('each bridge begins as timber and rebuilds in stone two Roads levels later, including the final upgrade',()=>{
  const parent=new THREE.Group(),transport=new PlanetTransport(parent,true),empty=evaluate([]).levels;
  for(let roads=2;roads<=8;roads++){
    transport.update(snapshotForGame({...empty,roads}),false);transport.render(0,true);
    for(const bridge of planetTransportLayout().bridges){
      const object=transport.group.getObjectByName(`Bridge to ${bridge.id}`);
      if(roads<bridge.level){assert.equal(object,undefined);continue;}
      const expected=roads>=bridge.level+2?'stone':'timber';
      assert.equal(bridgeMaterial(bridge,roads),expected);assert.equal(object?.userData.bridgeMaterial,expected);
    }
    transport.group.traverse(o=>{if(o instanceof THREE.InstancedMesh){
      const matrix=new THREE.Matrix4();for(let i=0;i<o.count;i++){o.getMatrixAt(i,matrix);assert.ok(matrix.elements.every(Number.isFinite));assert.ok(matrix.determinant()>0,'stone spans and piers have positive dimensions');}
    }});
  }
  transport.update(snapshotForGame({...empty,roads:2}),false);
  assert.equal(transport.group.getObjectByName('Bridge to western-island')?.userData.bridgeMaterial,'timber');
  transport.dispose();assert.equal(parent.children.length,0);
});

test('surveyed bridges cross real water, clear the terrain, and attach to roads at both ends',()=>{
  const layout=planetTransportLayout();assert.equal(layout.bridges.length,3);assert.equal(layout.harbors.length,2);
  const full=snapshotForGame(evaluate(IDEAS).levels),roads=routePlanetRoads(full),ends=roads.flatMap(r=>[r.a,r.b]);
  for(const bridge of layout.bridges){
    assert.ok(height(bridge.a)>.9&&height(bridge.b)>.9);
    let water=0;for(let i=0;i<=100;i++){const p=mixPoint(bridge.a,bridge.b,i/100);if(height(p)<0)water++;assert.ok(bridgeDeck(bridge,i/100)>height(p)-.02,'deck must not tunnel through the shore');}
    assert.ok(water>10,'a genuine water crossing');
    for(const p of [bridge.a,bridge.b])assert.ok(ends.some(end=>Math.hypot(end.x-p.x,end.z-p.z)<1e-6),`${bridge.id} disconnected landing`);
  }
  for(const harbor of layout.harbors)assert.ok(ends.some(end=>Math.hypot(end.x-harbor.land.x,end.z-harbor.land.z)<1e-6),`${harbor.id} missing access road`);
});

test('shipping follows navigable ocean between berths and never cuts across land',()=>{
  const [a,b]=planetTransportLayout().harbors,path=seaRoute(harborBerth(a),harborBerth(b));assert.ok(path.length>=2);
  assert.deepEqual(path[0],harborBerth(a));assert.deepEqual(path[path.length-1],harborBerth(b));
  for(let i=1;i<path.length;i++)for(let j=0;j<=100;j++){
    const p=mixPoint(path[i-1],path[i],j/100);assert.ok(height(p)<-.35);
    for(const [x,z] of [[1.2,0],[-1.2,0],[0,1.2],[0,-1.2]])assert.ok(height({x:p.x+x,z:p.z+z})<0,'hull clearance');
  }
});

test('vegetation leaves bridge approaches and harbor walkways clear',()=>{
  const snapshot=snapshotForGame(evaluate(IDEAS).levels),blocked=planetRoadClearance(snapshot,[]);
  const layout=planetTransportLayout();
  for(const bridge of layout.bridges)for(let i=0;i<=20;i++)assert.ok(blocked(mixPoint(bridge.a,bridge.b,i/20),1.5));
  for(const harbor of layout.harbors)for(let i=0;i<=20;i++)assert.ok(blocked(mixPoint(harbor.land,harbor.sea,i/20),1.5));
});

test('river and road upgrades reveal the fishing dock, fleet and crossings; reset releases the visible world',()=>{
  const empty=evaluate([]).levels,make=(river:number,roads:number,settlers=1)=>snapshotForGame({...empty,river,roads,settlers});
  assert.equal(planetTransportState(make(1,0,0)).fishing,false);
  assert.equal(planetTransportState(make(1,0)).fishing,true);
  assert.equal(planetTransportState(make(1,0)).boats,0);
  assert.equal(planetTransportState(make(2,0)).boats,1);
  assert.equal(planetTransportState(make(3,0)).boats,2);
  for(const [level,count] of [[1,0],[2,1],[4,2],[6,3]])assert.equal(planetTransportState(make(0,level)).bridges.length,count);
  const parent=new THREE.Group(),transport=new PlanetTransport(parent,true);
  transport.update(make(3,6),false);transport.render(0,true);
  assert.ok(transport.group.getObjectByName('castle-harbor'));assert.ok(transport.group.getObjectByName('island-harbor'));
  assert.equal(transport.group.children.filter(c=>c.name==='Fisherman at the dock'&&c.visible).length,2);
  for(const name of ['Fishing boat','Island trading ship']){
    const boat=transport.group.getObjectByName(name)!;assert.ok(boat.visible);assert.ok(boat.position.length()>PLANET_RADIUS);
    const before=boat.position.clone();transport.render(1000,true);assert.ok(boat.position.equals(before),'reduced motion freezes boats');
  }
  const boat=transport.group.getObjectByName('Island trading ship')!,before=boat.position.clone();transport.render(1100,false);assert.ok(boat.position.distanceTo(before)>.01);
  transport.update(make(0,0,0),false);assert.equal(transport.group.children.filter(c=>c.visible&&c.name==='Fishing boat').length,0);
  transport.dispose();assert.equal(parent.children.length,0);
});
