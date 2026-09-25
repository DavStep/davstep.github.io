import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { evaluate,IDEAS } from '../src/town/game';
import { snapshotForGame } from '../src/town/game-snapshot';
import { IDEA_DISTRICTS,DISTRICT_IDEAS,districtConnections,districtForPlot } from '../src/town/idea-districts';
import { authoredLandmarkBuilding } from '../src/town/authored-landmarks';
import { DistrictScenery } from '../src/town/district-scenery';
import { CARDINAL_GATE_MASK } from '../src/town/wall-layout';
import { MAT } from '../src/town/materials';
import { INFRASTRUCTURE, PLOTS } from '../src/town/town-plan';

test('choosing Market first builds Idle Outpost inside the castle walls without requiring another choice',()=>{
  const state=evaluate(['market']),snapshot=snapshotForGame(state.levels,0,state.gateMask);
  const hero=snapshot.plots.find(p=>p.id==='project-outpost')!;
  assert.equal(state.levels.market,1);assert.ok(hero.stage>=3);assert.ok(Math.hypot(hero.x,hero.z)<INFRASTRUCTURE.wall.innerRadius);
  assert.ok(snapshot.plots.filter(p=>p.stage>0).every(p=>districtForPlot(p.id)==='market'));
  for(const mobile of [false,true])assert.ok(new THREE.Box3().setFromObject(authoredLandmarkBuilding(hero,mobile)).getSize(new THREE.Vector3()).y>3);
  assert.deepEqual(snapshot.districtConnections,[]);
});

test('every district grows around its fixed original site and connects only when developed',()=>{
  const empty=evaluate([]).levels;
  for(const idea of DISTRICT_IDEAS){
    const center=IDEA_DISTRICTS[idea];let previous=0;
    for(let level=1;level<=8;level++){
      const levels={...empty,[idea]:level,roads:idea==='roads'?level:3};
      const snapshot=snapshotForGame(levels),hero=snapshot.plots.find(p=>p.id===center.hero)!;
      const authored=PLOTS.find(p=>p.id===center.hero)!;
      assert.deepEqual([hero.x,hero.z],hero.kind==='project'?[authored.x,authored.z]:[center.x,center.z]);
      const local=snapshot.plots.filter(p=>p.stage>0&&districtForPlot(p.id)===idea);
      assert.ok(local.filter(p=>p.id!==center.hero).every(p=>Math.hypot(p.x-center.x,p.z-center.z)<25));
      if(level>=4)assert.ok(local.length>previous,`${idea} ${level} adds a permanent local building`);
      previous=local.length;
      assert.equal(snapshot.districtConnections!.includes(idea),level>=(idea==='roads'?2:3));
    }
  }
  const full=evaluate(IDEAS).levels;
  assert.deepEqual(districtConnections(full,0),[],'sealed gates block connection');
  assert.equal(districtConnections(full,CARDINAL_GATE_MASK).length,5);
  assert.equal(districtConnections({...full,roads:1},CARDINAL_GATE_MASK).length,0);
});

test('all five clickable project landmarks remain separated inside the castle walls',()=>{
  const snapshot=snapshotForGame(evaluate(IDEAS).levels);
  const projects=snapshot.plots.filter(p=>p.kind==='project');
  assert.equal(projects.length,5);
  for(const project of projects){
    assert.ok(Math.hypot(project.x,project.z)+6<INFRASTRUCTURE.wall.innerRadius,project.id);
    for(const other of projects)if(other.id!==project.id)
      assert.ok(Math.hypot(project.x-other.x,project.z-other.z)>12,`${project.id} overlaps ${other.id}`);
  }
});

test('district courtyards and upgrade details restore and reset without disposing shared materials',()=>{
  for(const mobile of [false,true]){
    const parent=new THREE.Group(),districts=new DistrictScenery(parent,mobile),empty=evaluate([]).levels;
    districts.setLevels({...empty,market:1},true);districts.update(0,true);
    assert.equal(districts.group.children.filter(c=>c.visible).length,1);
    districts.setLevels(evaluate(IDEAS).levels,true);districts.update(0,true);
    assert.equal(districts.group.children.filter(c=>c.visible).length,40);
    districts.setLevels(empty,true);assert.ok(districts.group.children.every(c=>!c.visible));
    let disposed=false;const listener=()=>{disposed=true;};MAT.stone.addEventListener('dispose',listener);
    districts.dispose();MAT.stone.removeEventListener('dispose',listener);assert.equal(disposed,false);assert.equal(parent.children.length,0);
  }
});
