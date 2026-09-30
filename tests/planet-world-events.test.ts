import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {PlanetWorldEvents,eventRouteSample} from '../src/town/planet-world-events';
import {initialWorldEventState,copyWorldEventState,type WorldEvent,type WorldEventKind} from '../src/town/world-event-types';
import type {Levels} from '../src/town/game';
const levels:Levels={settlers:3,grove:3,river:3,roads:3,workshop:3,windmill:3,market:3,walls:3,archive:3,observatory:3};
const shape=(root:THREE.Object3D)=>{root.updateMatrixWorld(true);const out:unknown[]=[];root.traverseVisible(o=>{if(o instanceof THREE.Mesh)out.push([o.name,o.visible,...o.matrixWorld.elements.map(v=>Math.round(v*1e5)/1e5)]);});return out;};
const kinds:WorldEventKind[]=['expedition','dragon-warning','dragon-tamed','dragon-raid','volcano-warning','mine-prepared','eruption-safe','eruption-damage','pass-repaired','core-recovered','lens-delivery','caravan-waiting','orchard-restored','artifact-installed','beacon-lit'];
test('absolute cinematic seeking and finishing reconstructs every final event state',()=>{
 const scene=new THREE.Scene(),visual=new PlanetWorldEvents(scene,true);
 for(const kind of kinds){const before=initialWorldEventState(),after=copyWorldEventState(before);
  after.artifacts={lens:'installed',gold:'friendly-dragon',core:'installed'};after.installed=['lens','gold','core'];after.dragon=kind==='dragon-raid'?'departed':'tamed';after.orchard=kind==='dragon-raid'?'burned':'restored';after.volcano='overflowed';after.mountainPass='bypass';after.beacon=true;after.expedition='returned';after.caravan='delivered';
  const event:WorldEvent={id:kind,kind,title:kind,description:'test',turn:8,before,after,artifact:'core'};
  visual.begin(event,levels);visual.sample(.45);const sample=shape(visual.group);visual.sample(.95);visual.sample(.15);visual.sample(.45);assert.deepEqual(shape(visual.group),sample,kind+' can seek backwards');
  for(const p of [0,.2,.45,.6,.8,.99,1]){const camera=visual.sample(p)!;assert.ok(Number.isFinite(camera.x+camera.z+camera.height));visual.group.traverse(o=>assert.ok(o.matrix.elements.every(Number.isFinite)));}
  visual.finish();const finished=shape(visual.group);visual.finish();assert.deepEqual(shape(visual.group),finished,'finish idempotent');
  visual.setState(after,levels);assert.deepEqual(shape(visual.group),finished,kind+' skip/reload matches playback');
 }
 visual.dispose();visual.dispose();assert.equal(scene.children.length,0);
});
test('opening destinations remain and departed gold never returns on late Wizard',()=>{
 const visual=new PlanetWorldEvents(new THREE.Scene(),true),world=initialWorldEventState();visual.setState(world,levels);
 assert.equal(visual.group.getObjectByName('ENV_EventChest_A_LOD1')?.visible,true);
 world.dragon='departed';world.artifacts.gold='departed-dragon';world.orchard='burned';visual.setState(world,levels);
 assert.equal(visual.group.userData.worldState.dragon,'departed');assert.equal(visual.group.getObjectByName('Retained dragon gold hoard')?.parent?.visible,false);
 visual.update(.1,true);const first=shape(visual.group);visual.update(999,true);assert.deepEqual(shape(visual.group),first,'reduced motion is static');visual.dispose();
});
test('route samples clamp and stay continuous at ends',()=>{
 const route=[{x:1,z:2},{x:10,z:4},{x:15,z:7}];assert.deepEqual(eventRouteSample(route,-1).point,route[0]);assert.deepEqual(eventRouteSample(route,2).point,route[2]);
});
test('journey actors remain upright on the sphere and the expedition includes physical shore transport',()=>{
 const visual=new PlanetWorldEvents(new THREE.Scene(),true),before=initialWorldEventState(),after=copyWorldEventState(before);after.artifacts.gold='town';after.expedition='returned';
 const event:WorldEvent={id:'crew',kind:'expedition',title:'',description:'',turn:3,before,after};visual.begin(event,levels);
 for(const p of [.1,.25,.35,.43,.5,.6,.72,.9]){
  visual.sample(p);visual.group.updateMatrixWorld(true);
  visual.group.traverseVisible(o=>{if(o.name.includes('Tender')||o.name==='Island trading ship'){
   const up=new THREE.Vector3(0,1,0).applyQuaternion(o.quaternion),normal=o.position.clone().normalize();
   if(o instanceof THREE.Group&&o.parent?.name==='Cinematic actors')assert.ok(up.dot(normal)>.999,'actor waterline follows planet normal');
  }});
 }
 visual.sample(.6);const actors=visual.group.getObjectByName('Cinematic actors')!;
 assert.ok(actors.children.some(o=>o.name.includes('Tender')&&o.visible),'a rowboat carries crew and chest from shore to the anchored ship');
 assert.equal(actors.getObjectByName('Chest carrying crew')?.parent?.visible,true);
 visual.finish();assert.ok(actors.children.every(o=>!o.visible),'all transient journey actors clear after delivery');visual.dispose();
});
