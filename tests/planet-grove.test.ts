import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PlanetGrove,createGroveSites,groveTreeBudget,GROVE_ORIGIN } from '../src/town/planet-grove';
import { PLANET_RADIUS,planetElevation,surfaceNormal } from '../src/town/planet-geography';
import { planetRoadClearance } from '../src/town/planet-road-clearance';
import { routePlanetRoads } from '../src/town/planet-roads';
import { snapshotForGame } from '../src/town/game-snapshot';
import { IDEAS,evaluate } from '../src/town/game';

const origin=surfaceNormal(GROVE_ORIGIN.x,GROVE_ORIGIN.z);
test('Grove begins with three castle-side trees and expands geographically across all eight levels',()=>{
  for(const mobile of [false,true]){
    const sites=createGroveSites(mobile),again=createGroveSites(mobile);
    assert.equal(sites.filter(s=>s.level===1).length,3);
    assert.ok(sites.slice(0,3).every(s=>s.normal.angleTo(origin)*PLANET_RADIUS<4));
    assert.deepEqual(sites.map(s=>s.normal.toArray()),again.map(s=>s.normal.toArray()));
    let lastDistance=0,lastCount=0;
    for(let level=1;level<=8;level++){
      const active=sites.filter(s=>s.level<=level),distance=Math.max(...active.map(s=>s.normal.angleTo(origin)*PLANET_RADIUS));
      assert.equal(active.length,groveTreeBudget(level,sites.length,mobile));
      assert.ok(active.length>lastCount);assert.ok(distance>lastDistance);
      lastCount=active.length;lastDistance=distance;
    }
    assert.ok(lastDistance>240,'highest tier reaches the far side of the globe');
    for(const site of sites)assert.ok(planetElevation(site.normal)>1&&planetElevation(site.normal)<7);
  }
});

test('growth adds flowers and wildlife later; mature trees grow, road clearance persists, and reset restores an empty world',()=>{
  const parent=new THREE.Group(),grove=new PlanetGrove(parent,true);
  const full=snapshotForGame(evaluate(IDEAS).levels),blocked=planetRoadClearance(full,routePlanetRoads(full));
  grove.setClearance(blocked);grove.setLevel(1,true);grove.render(0,true);
  const tree=grove.group.children.find(o=>o.name==='Grove tree 1') as THREE.InstancedMesh;
  const flower=grove.group.children.find(o=>o.name==='Grove flower 0') as THREE.InstancedMesh;
  assert.equal(tree.count,3);assert.equal(flower.count,0);
  assert.equal(grove.group.children.filter(o=>['bird','deer','sheep'].includes(o.name)&&o.visible).length,0);
  const young=new THREE.Matrix4();tree.getMatrixAt(0,young);const youngSize=new THREE.Vector3().setFromMatrixScale(young).length();
  grove.setLevel(3,true);grove.render(0,true);const grown=new THREE.Matrix4();tree.getMatrixAt(0,grown);
  assert.ok(new THREE.Vector3().setFromMatrixScale(grown).length()>youngSize);
  assert.ok(flower.count>0);
  grove.setLevel(8,true);grove.render(100,true);
  for(const name of ['bird','deer'])assert.ok(grove.group.children.some(o=>o.name===name&&o.visible),`missing ${name}`);
  const positions=grove.group.children.filter(o=>o.name==='deer'&&o.visible).map(o=>o.position.toArray());grove.render(9000,true);
  assert.deepEqual(grove.group.children.filter(o=>o.name==='deer'&&o.visible).map(o=>o.position.toArray()),positions);
  grove.setClearance(()=>true);
  for(let i=0;i<tree.count;i++){if(grove.sites[i].normal.y<=-.5)continue;tree.getMatrixAt(i,grown);assert.equal(new THREE.Vector3().setFromMatrixScale(grown).length(),0);}
  grove.setLevel(0,true);assert.equal(tree.count,0);assert.equal(flower.count,0);assert.ok(grove.group.children.every(o=>o instanceof THREE.InstancedMesh||!o.visible));
  grove.dispose();assert.equal(parent.children.length,0);
});

test('sprouting follows elapsed time and reduced motion completes the pending upgrade',()=>{
  const grove=new PlanetGrove(new THREE.Group(),true);grove.setClearance(()=>false);grove.setLevel(1,false);
  grove.render(0);for(let i=1;i<=12;i++)grove.render(i*100);
  assert.ok(grove.level>0&&grove.level<1);
  grove.render(1300,true);assert.equal(grove.level,1);
  grove.setLevel(0,true);assert.equal(grove.level,0);grove.dispose();
});

test('vegetation and habitat clearance includes riverbanks, farm fields and defensive walls',()=>{
  const snapshot=snapshotForGame(evaluate(IDEAS).levels),blocked=planetRoadClearance(snapshot,[]);
  assert.equal(blocked({x:47,z:-20},1.65),true);
  assert.equal(blocked({x:30,z:-18},1.65),true);
  const angle=Math.PI/4;
  assert.equal(blocked({x:34*Math.cos(angle),z:34*Math.sin(angle)},1.65),true);
  const empty=planetRoadClearance(snapshotForGame(evaluate([]).levels),[]);
  assert.equal(empty({x:47,z:-20},1.65),false);
});
