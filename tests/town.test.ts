import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createSave, milestoneRecap, parseSave, townAt, TOWN_SAVE_KEY, MINUTE, PLOTS, WALL_SEGMENTS } from '../src/town/model';
import { routeBetween } from '../src/town/residents';
import { buildColliders, isBlocked, moveWithCollisions } from '../src/town/collision';
import { isWater, riverCenter, riverHalfWidth, terrainHeight } from '../src/town/environment';
import { RoamController } from '../src/town/navigation';
import { wallIsGate, wallSection } from '../src/town/wall-layout';
import { INFRASTRUCTURE, accessPathFor } from '../src/town/town-plan';
import { cottageBuilding } from '../src/town/cottages';

const t0=1_700_000_000_000;
const save=createSave(t0);

test('new towns at the same age follow the same plan',()=>{
  const laterSave=createSave(t0+5*MINUTE);
  for(const age of [0,8,16,30,60]){
    assert.deepEqual(townAt(save,t0+age*MINUTE),townAt(laterSave,laterSave.createdAt+age*MINUTE));
  }
  assert.equal(townAt(save,t0).plots.filter(p=>p.project).length,5);
});

test('construction starts at the planned time',()=>{
  for(const plot of PLOTS){
    if(plot.kind==='project'||plot.kind==='castle'||plot.start<=0)continue;
    const before=townAt(save,t0+plot.start-1).plots.find(p=>p.id===plot.id)!;
    const after=townAt(save,t0+plot.start).plots.find(p=>p.id===plot.id)!;
    assert.equal(before.stage,0,`${plot.id} started before its planned time`);
    assert.equal(after.stage,1,`${plot.id} missed its planned start`);
    assert.ok(accessPathFor(plot));
  }
  assert.equal(townAt(save,t0+8*MINUTE).outerRoad,0);
  assert.equal(townAt(save,t0+12*MINUTE).outerRoad,INFRASTRUCTURE.road.outerRingSegments);
});

test('completed buildings and cottage details stay fixed',()=>{
  const finished=townAt(save,t0+60*MINUTE);
  const later=townAt(save,t0+120*MINUTE);
  assert.deepEqual(finished.plots,later.plots);
  assert.equal(finished.plots.find(p=>p.kind==='castle')?.stage,6);
  assert.ok(finished.plots.filter(p=>p.kind==='home').some(p=>p.renovation>0));
  assert.deepEqual(
    [finished.innerWood,finished.innerStone,finished.outerWood,finished.roads,finished.outerRoad],
    [later.innerWood,later.innerStone,later.outerWood,later.roads,later.outerRoad],
  );
});

test('weather follows a fixed repeating schedule',()=>{
  assert.equal(townAt(save,t0).weather,'clear');
  assert.equal(townAt(save,t0+12*MINUTE).weather,'cloudy');
  assert.equal(townAt(save,t0+24*MINUTE).weather,'rain');
  assert.equal(townAt(save,t0+60*MINUTE).weather,'clear');
});

test('progression makes inner and outer walls in order and keeps the castle growing',()=>{
  const early=townAt(save,t0+5*MINUTE),middle=townAt(save,t0+16*MINUTE),late=townAt(save,t0+29*MINUTE);
  assert.ok(early.innerWood>0);
  assert.equal(early.innerStone,0);
  assert.equal(early.outerWood,0);
  assert.equal(middle.innerStone,WALL_SEGMENTS);
  assert.equal(middle.outerWood,0);
  assert.equal(late.outerWood,WALL_SEGMENTS);
  assert.equal(late.plots.find(p=>p.kind==='castle')?.stage,6);
  assert.ok(late.buildings>early.buildings);
});

test('offline elapsed time reaches the same state without replay and recap is bounded',()=>{
  const returnTime=t0+32*MINUTE;
  const before={...save,lastSeenAt:t0+2*MINUTE};
  assert.deepEqual(townAt(before,returnTime),townAt(save,returnTime));
  const recap=milestoneRecap(before,returnTime);
  assert.equal(recap.length,3);
  assert.match(recap[2],/castle/);
});

test('mature mergers retain children and most small homes',()=>{
  const mature=townAt(save,t0+60*MINUTE);
  const homes=mature.plots.filter(p=>p.kind==='home');
  assert.ok(homes.filter(p=>!p.complexId).length/homes.length>=.75);
  assert.equal(mature.plots.length,PLOTS.length);
  assert.ok(mature.plots.filter(p=>p.complexId).every(p=>!p.project));
  assert.ok(mature.plots.filter(p=>p.complexId).length>0);
  const complexes=new Map<string,typeof mature.plots>();
  for(const plot of mature.plots)if(plot.complexId)complexes.set(plot.complexId,[...(complexes.get(plot.complexId)??[]),plot]);
  for(const pair of complexes.values()){
    assert.equal(pair.length,2);
    assert.ok(Math.hypot(pair[0].x-pair[1].x,pair[0].z-pair[1].z)<12,'merged plots must be neighbors');
  }
});

test('save parsing tolerates corrupt input and protects progressed time from clock rollback',()=>{
  assert.equal(parseSave('{',t0).version,3);
  assert.equal(TOWN_SAVE_KEY,'davstep.town.v3');
  const oldSave={version:2,seed:711,createdAt:t0-60*MINUTE,lastSeenAt:t0-1,eventCursor:60,elapsedFloorMs:60*MINUTE};
  assert.deepEqual(parseSave(JSON.stringify(oldSave),t0),createSave(t0));
  const reset=createSave(t0+60*MINUTE);
  assert.equal(townAt(reset,reset.createdAt).elapsed,0);
  assert.equal(townAt(reset,reset.createdAt).plots.find(p=>p.kind==='castle')?.stage,2);
  const progressed={...save,elapsedFloorMs:25*MINUTE};
  assert.equal(townAt(progressed,t0+MINUTE).elapsed,25*MINUTE);
});

test('road routing starts and ends at the requested locations',()=>{
  const a={x:-41,z:3},b={x:19,z:22};
  const path=routeBetween(a,b);
  assert.ok(path.length>=3);
  assert.equal(path[0].x,a.x);assert.equal(path[0].z,a.z);
  assert.equal(path.at(-1)?.x,b.x);assert.equal(path.at(-1)?.z,b.z);
});

test('fully grown houses leave the main roads clear',()=>{
  const homes=townAt(save,t0+60*MINUTE).plots.filter(plot=>plot.kind==='home');
  for(const plot of homes){
    const bounds=new THREE.Box3().setFromObject(cottageBuilding(plot,false));
    const {min,max}=bounds;
    assert.ok(min.z>1.4||max.z< -1.4,`${plot.id} overlaps the east-west road`);
    assert.ok(min.x>1.4||max.x< -1.4,`${plot.id} overlaps the north-south road`);
    const nearestX=min.x<=0&&max.x>=0?0:Math.min(Math.abs(min.x),Math.abs(max.x));
    const nearestZ=min.z<=0&&max.z>=0?0:Math.min(Math.abs(min.z),Math.abs(max.z));
    const minRadius=Math.hypot(nearestX,nearestZ);
    const maxRadius=Math.max(...[min.x,max.x].flatMap(x=>[min.z,max.z].map(z=>Math.hypot(x,z))));
    for(const [radius,halfWidth] of [[INFRASTRUCTURE.road.ringRadius,1.175],[INFRASTRUCTURE.road.outerRingRadius,1.075]]){
      assert.ok(maxRadius<radius-halfWidth||minRadius>radius+halfWidth,`${plot.id} overlaps the ring road at ${radius}`);
    }
  }
});

test('walk collision blocks buildings and water while sliding along their edges',()=>{
  const town=townAt(save,t0+30*MINUTE),colliders=buildColliders(town);
  assert.ok(isBlocked(0,0,colliders));
  assert.ok(isBlocked(0,riverCenter(0),colliders));
  const moved=moveWithCollisions({x:8,z:8},{x:-7,z:4},colliders);
  assert.ok(!isBlocked(moved.x,moved.z,colliders));
  assert.ok(moved.z>8);
});

test('a walker cannot pass through a wall segment but can use a gate',()=>{
  const colliders=buildColliders(townAt(save,t0+30*MINUTE));
  const wall=moveWithCollisions({x:23,z:23},{x:5,z:5},colliders);
  assert.ok(Math.hypot(wall.x,wall.z)<34);
  const gate=moveWithCollisions({x:30,z:3},{x:10,z:0},colliders);
  assert.ok(gate.x>34);
});

test('wall sections meet at shared corners and gates align with their openings',()=>{
  const colliders=buildColliders(townAt(save,t0+30*MINUTE));
  for(const radius of [34,55]){
    const wallSegments=colliders.filter(c=>c.kind==='segment'&&Math.hypot(c.ax,c.az)>radius-1&&Math.hypot(c.ax,c.az)<radius+1);
    assert.equal(wallSegments.length,WALL_SEGMENTS-4);
    for(let i=0;i<WALL_SEGMENTS;i++){
      const section=wallSection(radius,i),next=wallSection(radius,(i+1)%WALL_SEGMENTS);
      assert.ok(Math.hypot(section.end.x-next.start.x,section.end.z-next.start.z)<1e-10);
      if(!wallIsGate(i))assert.ok(wallSegments.some(c=>c.kind==='segment'&&Math.hypot(c.ax-section.start.x,c.az-section.start.z)<1e-10));
      else assert.ok(section.length>5&&section.length<12);
    }
  }
});

test('river and ponds sit inside carved terrain with dry banks',()=>{
  for(const x of [-100,0,100]){
    const center=riverCenter(x),width=riverHalfWidth(x);
    assert.ok(isWater(x,center));
    assert.ok(!isWater(x,center+width+3));
    assert.ok(Math.max(terrainHeight(x,center+width+3),terrainHeight(x,center-width-3))-terrainHeight(x,center)>1);
  }
  assert.ok(isWater(-82,-27));
  assert.ok(terrainHeight(-82,-16)>terrainHeight(-82,-27)+1);
});

test('keyboard and touch directions move the camera without an avatar',()=>{
  const roam=new RoamController();roam.setPosition({x:8,z:11});
  for(let i=0;i<30;i++)roam.update(1/60,{x:0,z:1,sprint:false},0,[]);
  assert.ok(roam.position.x<5.5);
  assert.ok(Math.abs(roam.position.z-11)<.01);
  const forwardX=roam.position.x;
  for(let i=0;i<30;i++)roam.update(1/60,{x:0,z:0,sprint:false},0,[]);
  assert.ok(roam.position.x<forwardX);
  assert.ok(roam.position.x>forwardX-1);
  const beforeStrafe=roam.position.z;
  for(let i=0;i<30;i++)roam.update(1/60,{x:1,z:0,sprint:false},0,[]);
  assert.ok(roam.position.z<beforeStrafe-2);
});
