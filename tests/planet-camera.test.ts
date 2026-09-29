import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PlanetCameraMove,planetEventView } from '../src/town/planet-camera';

test('global growth uses the whole planet while individual arrivals retain close-ups',()=>{
  assert.equal(planetEventView('grove',1),'site');
  for(let level=2;level<=8;level++)assert.equal(planetEventView('grove',level),'planet');
  assert.equal(planetEventView('roads',4),'planet');
  assert.equal(planetEventView('roads',4,true),'site');
  assert.equal(planetEventView('walls',3),'planet');
  assert.equal(planetEventView('river',3),'planet');
  assert.equal(planetEventView('river',1),'site');
  assert.equal(planetEventView('workshop',1),'site');
  assert.equal(planetEventView('archive',6),'site');
});

test('cinematic follows the globe exterior and arrives exactly at its build framing',()=>{
  const start=new THREE.Vector3(0,460,0),end=new THREE.Vector3(0,-180,0);
  const fromLook=new THREE.Vector3(0,10,0),toLook=new THREE.Vector3(0,-88,0);
  const move=new PlanetCameraMove(start,end,fromLook,toLook),position=new THREE.Vector3(),look=new THREE.Vector3();
  assert.equal(move.sample(0,position,look),false);assert.ok(position.distanceTo(start)<1e-8);
  for(let i=0;i<=100;i++){
    move.sample(move.duration*i/100,position,look);
    assert.ok(position.length()>=180-1e-8,'never cut through the planet');
    assert.ok(Number.isFinite(position.x+position.y+position.z));
  }
  assert.equal(move.sample(move.duration,position,look),true);
  assert.ok(position.distanceTo(end)<1e-8);assert.ok(look.distanceTo(toLook)<1e-8);
  move.sample(move.duration+10,position,look);assert.ok(position.distanceTo(end)<1e-8);
});
test('cinematic eases in and out and supports a nearby follow-up upgrade',()=>{
  const start=new THREE.Vector3(170,0,0),end=new THREE.Vector3(0,210,0),origin=new THREE.Vector3();
  const move=new PlanetCameraMove(start,end,origin,origin),position=new THREE.Vector3();
  move.sample(move.duration*.01,position,origin);assert.ok(position.distanceTo(start)<.01);
  move.sample(move.duration*.99,position,origin);assert.ok(position.distanceTo(end)<.01);
  const stationary=new PlanetCameraMove(end,end,origin,origin);
  stationary.sample(stationary.duration*.5,position,origin);assert.ok(position.distanceTo(end)<1e-8);
});
