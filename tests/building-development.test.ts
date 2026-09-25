import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { evaluate } from '../src/town/game';
import { snapshotForGame } from '../src/town/game-snapshot';
import { townAt, createSave } from '../src/town/model';
import { cottageBuilding, gameCottageBuilding } from '../src/town/cottages';
import { civicBuilding } from '../src/town/civic';
import { districtExpansionPlots } from '../src/town/idea-districts';
import { isRegularBuilding } from '../src/town/building-development';

const signature=(group:THREE.Group)=>group.children.map(c=>`${c.name}:${c.position.y}:${c.scale.y}`).join('|');
test('all home levels produce distinct stable development states and finish as townhouses',()=>{
  const levels=evaluate([]).levels;
  for(const mobile of [false,true])for(const variant of [0,1,2]){
    const signatures=new Set<string>();
    for(let level=1;level<=8;level++){
      const home=snapshotForGame({...levels,settlers:level}).plots.find(p=>p.id==='home-0')!;
      home.variant=variant;
      assert.equal(home.stage,level);
      const model=gameCottageBuilding(home,mobile);signatures.add(signature(model));
      assert.ok(model.children.length);
      if(level>=7)assert.ok(model.children.some(c=>c.name.includes('_upper')));
      if(level===8)assert.ok(model.children.some(c=>c.name.includes('_master_gable')));
    }
    assert.equal(signatures.size,8);
  }
});
test('regular offices and shops have eight distinct authored states in both detail levels',()=>{
  for(const mobile of [false,true])for(const kind of ['market','tavern','forge','guild','post'] as const){
    const signatures=new Set<string>();
    for(let stage=1;stage<=8;stage++){
      const group=civicBuilding({id:`office-${kind}`,kind,stage,x:0,z:0,start:0,step:1,renovation:0},mobile);
      assert.ok(group.children.length);signatures.add(signature(group));
      if(stage>=7)assert.ok(group.children.some(c=>c.name.includes('_stage7_upper_wing')));
    }
    assert.equal(signatures.size,8);
  }
});
test('new district buildings develop after opening instead of spawning complete',()=>{
  const empty=evaluate([]).levels;
  const stages=[4,5,6,7,8].map(market=>districtExpansionPlots({...empty,market}).find(p=>p.id==='district-market-covered-stalls')!.stage);
  assert.deepEqual(stages,[3,5,7,8,8]);
  assert.equal(districtExpansionPlots({...empty,archive:8}).find(p=>p.id==='district-archive-great-library')!.stage,6);
  const stagesForForge=[1,2,3,4,5,6].map(workshop=>snapshotForGame({...empty,workshop}).plots.find(p=>p.id==='forge')!.stage);
  assert.deepEqual(stagesForForge,[3,4,5,6,7,8]);
});
test('mature regular models retain road footprints, finite geometry and bounded detail',()=>{
  const snapshot=townAt(createSave(0),60*60000);
  assert.ok(snapshot.plots.filter(isRegularBuilding).every(p=>p.stage===8));
  for(const mobile of [false,true])for(const plot of snapshot.plots.filter(isRegularBuilding)){
    const mature=plot.kind==='home'?cottageBuilding(plot,mobile):civicBuilding(plot,mobile);
    const old=plot.kind==='home'?cottageBuilding({...plot,stage:6},mobile):civicBuilding({...plot,stage:6},mobile);
    const bounds=new THREE.Box3().setFromObject(mature),previous=new THREE.Box3().setFromObject(old);
    assert.ok(bounds.min.x>=previous.min.x-.05&&bounds.max.x<=previous.max.x+.05);
    assert.ok(bounds.min.z>=previous.min.z-.05&&bounds.max.z<=previous.max.z+.05);
    let triangles=0;
    mature.traverse(o=>{if(o instanceof THREE.Mesh){triangles+=(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3;assert.ok([...o.geometry.getAttribute('position').array].every(Number.isFinite));}});
    assert.ok(triangles<=(mobile?3200:7000),`${plot.kind}: ${triangles}`);
  }
});
