import { planetRoadClearance } from '../src/town/planet-road-clearance';
import { planetBuildingAccess } from '../src/town/planet-building-access';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { routePlanetRoads,roadGroundSafe,roadHeight,stoneReach,PlanetRoads } from '../src/town/planet-roads';
import { snapshotForGame } from '../src/town/game-snapshot';
import { evaluate,IDEAS } from '../src/town/game';

test('fantasy paths stay on dry gentle ground including edges and stop at disconnected land',()=>{
  assert.deepEqual(routePlanetRoads(snapshotForGame(evaluate([]).levels)),[]);
  for(const order of [['roads'],['settlers','roads'],IDEAS] as const){
    const state=evaluate(order),snapshot=snapshotForGame(state.levels,0,state.gateMask),roads=routePlanetRoads(snapshot);
    assert.ok(roads.length>10);
    for(const {a,b} of roads){
      const dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz);
      for(let step=0;step<=8;step++){
        const x=a.x+dx*step/8,z=a.z+dz*step/8;
        assert.ok(roadGroundSafe(x,z,Boolean(snapshot.riverLevel)),`unsafe centre ${x},${z}`);
        for(const side of [-.72,.72]){const h=roadHeight(x+dz/length*side,z-dx/length*side);assert.ok(h>.4&&h<5,`unsafe edge ${h}`);}
      }
    }
    const isolated={...snapshot,plots:[...snapshot.plots,{id:'isolated-test',kind:'home' as const,x:120,z:120,stage:8,renovation:0,start:0,step:1}]};
    for(const {a,b} of routePlanetRoads(isolated))assert.ok(Math.hypot(a.x-b.x,a.z-b.z)<4,'no long bridges between islands');
  }
});
test('town paving expands with upgrades while the outlying roads stay dirt; reset disposes meshes',()=>{
  const parent=new THREE.Group(),roads=new PlanetRoads(parent,true),state=evaluate(IDEAS),snapshot=snapshotForGame(state.levels,0,state.gateMask);
  roads.update({...snapshot,roadLevel:1});assert.equal(roads.group.children.some(o=>o.name==='Irregular town cobblestones'),false);
  roads.update({...snapshot,roadLevel:2});const early=roads.group.children.find(o=>o instanceof THREE.InstancedMesh) as THREE.InstancedMesh;assert.ok(early.count>0);
  roads.update({...snapshot,roadLevel:8});const late=roads.group.children.find(o=>o instanceof THREE.InstancedMesh) as THREE.InstancedMesh;assert.ok(late.count>early.count);assert.ok(stoneReach(8)>stoneReach(2));
  roads.update(snapshotForGame(evaluate([]).levels));assert.equal(roads.group.children.length,0);
  roads.dispose();assert.equal(parent.children.length,0);
});

test('every developed building has a facade-normal doorstep connection and no lane cuts through another building',()=>{
  const snapshot=snapshotForGame(Object.fromEntries(IDEAS.map(id=>[id,8])) as ReturnType<typeof evaluate>['levels']);
  const entrances=snapshot.plots.filter(p=>p.stage>0).map(planetBuildingAccess),roads=routePlanetRoads(snapshot);
  const key=(p:{x:number;z:number})=>`${p.x.toFixed(6)}/${p.z.toFixed(6)}`;
  const graph=new Map<string,Set<string>>();
  for(const {a,b} of roads){const ka=key(a),kb=key(b);if(!graph.has(ka))graph.set(ka,new Set());if(!graph.has(kb))graph.set(kb,new Set());graph.get(ka)!.add(kb);graph.get(kb)!.add(ka);}
  for(const entry of entrances){
    const door=key(entry.door);assert.ok(graph.has(door),`${entry.plot.id}: missing doorstep`);
    const first=roads.find(({a,b})=>key(a)===door||key(b)===door)!;
    const other=key(first.a)===door?first.b:first.a;
    const forward=new THREE.Vector2(entry.approach.x-entry.door.x,entry.approach.z-entry.door.z).normalize();
    const direction=new THREE.Vector2(other.x-entry.door.x,other.z-entry.door.z).normalize();
    assert.ok(forward.dot(direction)>.999,`${entry.plot.id}: road must approach the front, not the side`);
    const visited=new Set([door]),queue=[door];for(const id of queue)for(const neighbor of graph.get(id)??[])if(!visited.has(neighbor)){visited.add(neighbor);queue.push(neighbor);}
    assert.ok(entrances.some(other=>other!==entry&&visited.has(key(other.door))),`${entry.plot.id}: disconnected driveway`);
  }
  for(const {a,b} of roads)for(let i=0;i<=4;i++){
    const p={x:a.x+(b.x-a.x)*i/4,z:a.z+(b.z-a.z)*i/4};
    for(const entry of entrances)if(entry.contains(p,.72)){
      const dx=entry.approach.x-entry.door.x,dz=entry.approach.z-entry.door.z,length=Math.hypot(dx,dz);
      const along=((p.x-entry.door.x)*dx+(p.z-entry.door.z)*dz)/length;
      const across=Math.abs((p.x-entry.door.x)*dz-(p.z-entry.door.z)*dx)/length;
      assert.ok(across<.001&&along>=-.001&&along<=length+.001,`${entry.plot.id}: a street crosses its footprint`);
    }
  }
});

test('upgrades reroute around expanded wings and porches even when occupied plot IDs stay the same',()=>{
  const levels={...evaluate([]).levels,settlers:2,roads:1};
  const early=snapshotForGame(levels),late=snapshotForGame({...levels,settlers:8});
  const group=new THREE.Group(),roads=new PlanetRoads(group,true);roads.update(early);
  const before=roads.group.children[0];roads.update(late);assert.notEqual(roads.group.children[0],before);
  for(const snapshot of [early,late]){
    const segments=routePlanetRoads(snapshot);
    for(const plot of snapshot.plots.filter(p=>p.stage>0)){
      const {door}=planetBuildingAccess(plot);
      assert.ok(segments.some(({a,b})=>Math.hypot(a.x-door.x,a.z-door.z)<.001||Math.hypot(b.x-door.x,b.z-door.z)<.001),plot.id);
    }
  }
  roads.dispose();
});

test('trees and boulders are cleared from the full road width and entrances, and restored on reset',()=>{
  const snapshot=snapshotForGame({...evaluate([]).levels,settlers:3,roads:1});
  const paths=routePlanetRoads(snapshot),blocked=planetRoadClearance(snapshot,paths);
  for(const {a,b} of paths){
    const x=(a.x+b.x)/2,z=(a.z+b.z)/2,dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz);
    assert.ok(blocked({x,z},1.5));
    assert.ok(blocked({x:x+dz/length*2,z:z-dx/length*2},1.5),'crown must not hang across a path');
  }
  const reset=planetRoadClearance(snapshotForGame(evaluate([]).levels),[]);
  assert.equal(reset(paths[0].a,1.5),false);
  assert.equal(blocked({x:155,z:155},1.5),false,'keep remote woods');
});
