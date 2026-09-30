import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PlanetCameraMove,PlanetOrbit,planetEventView } from '../src/town/planet-camera';

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

test('globe follows horizontal and vertical drags in overview and tilted close-ups',()=>{
  for(const [position,look,up] of [
    [new THREE.Vector3(260,280,235),new THREE.Vector3(0,12,0),new THREE.Vector3(0,1,0)],
    [new THREE.Vector3(-145,-90,30),new THREE.Vector3(-60,-40,10),new THREE.Vector3(.2,.4,1).normalize()],
  ])for(const [dx,dy] of [[.1,0],[0,.1]]){
    const camera=new THREE.PerspectiveCamera(43,1,.1,1800);
    camera.position.copy(position);camera.up.copy(up);camera.lookAt(look);camera.updateMatrixWorld();
    const orbit=new PlanetOrbit();orbit.start(camera,look);
    const marker=position.clone().normalize().multiplyScalar(85),before=marker.clone().project(camera);
    const initial=camera.quaternion.clone(),sampleLook=new THREE.Vector3();
    orbit.sample(1,position.length(),camera.position,sampleLook,camera.up);camera.lookAt(sampleLook);
    assert.ok(camera.quaternion.angleTo(initial)<1e-7,'taking over a close-up preserves its view');
    orbit.rotate(dx,dy);orbit.sample(1,position.length(),camera.position,sampleLook,camera.up);
    camera.lookAt(sampleLook);camera.updateMatrixWorld();const after=marker.clone().project(camera);
    if(dx)assert.ok(after.x>before.x,'right drag moves the globe right');
    if(dy)assert.ok(after.y<before.y,'down drag moves the globe down');
    assert.ok(Math.abs(camera.position.length()-position.length())<1e-8);
  }
});

test('vertical rotation passes both poles without sticking or flipping the view',()=>{
  const camera=new THREE.PerspectiveCamera();camera.position.set(0,0,200);camera.lookAt(0,0,0);
  const orbit=new PlanetOrbit(),look=new THREE.Vector3();orbit.start(camera,look);
  let north=false,south=false;
  for(let i=0;i<400;i++){
    const before=camera.quaternion.clone();orbit.rotate(0,.02);
    orbit.sample(1,200,camera.position,look,camera.up);camera.lookAt(look);
    assert.ok(camera.quaternion.angleTo(before)<.021,'no roll snap at a pole');
    assert.ok(Math.abs(camera.position.length()-200)<1e-8);
    if(camera.position.y>199.9)north=true;if(camera.position.y< -199.9)south=true;
  }
  assert.ok(north&&south,'both poles remain reachable');
});

test('returning from a rolled manual view preserves orientation at both flight endpoints',()=>{
  const camera=new THREE.PerspectiveCamera();camera.position.set(-150,-70,90);
  camera.up.set(.5,-.2,1).normalize();const look=new THREE.Vector3(-40,-20,15);camera.lookAt(look);
  const start=camera.quaternion.clone(),end=new THREE.Vector3(260,280,235),endLook=new THREE.Vector3(0,12,0);
  const move=new PlanetCameraMove(camera.position.clone(),end,look.clone(),endLook,camera.up);
  move.sample(0,camera.position,look,camera.up);camera.lookAt(look);
  assert.ok(camera.quaternion.angleTo(start)<1e-7);
  move.sample(move.duration,camera.position,look,camera.up);camera.lookAt(look);
  const finish=camera.quaternion.clone();camera.up.set(0,1,0);camera.lookAt(endLook);
  assert.ok(camera.quaternion.angleTo(finish)<1e-7,'resuming automatic framing does not snap');
});

test('released drags coast in their direction and ease into a slow spin',()=>{
  const camera=new THREE.PerspectiveCamera(),look=new THREE.Vector3();
  camera.position.set(0,0,200);camera.lookAt(look);
  const orbit=new PlanetOrbit();orbit.start(camera,look);orbit.beginDrag(0);
  orbit.drag(.06,.03,50);orbit.sample(1,200,camera.position,look,camera.up);camera.lookAt(look);
  const release=camera.position.clone();orbit.endDrag(50);orbit.advance(.1,.035);
  orbit.sample(1,200,camera.position,look,camera.up);
  assert.ok(camera.position.x<release.x&&camera.position.y>release.y,'coasts along both drag axes');
  const firstStep=camera.position.distanceTo(release);
  for(let i=0;i<60;i++)orbit.advance(.1,.035);
  orbit.sample(1,200,camera.position,look,camera.up);const settled=camera.position.clone();
  orbit.advance(.1,.035);orbit.sample(1,200,camera.position,look,camera.up);
  const idleStep=camera.position.distanceTo(settled);
  assert.ok(idleStep>.6&&idleStep<.8,'continues the gentle spin after momentum settles');
  assert.ok(firstStep>idleStep*10,'release momentum gradually slows');
});

test('momentum is frame-rate independent and stops on held or cancelled gestures',()=>{
  function setup(){
    const camera=new THREE.PerspectiveCamera();camera.position.set(0,0,200);camera.lookAt(0,0,0);
    const orbit=new PlanetOrbit();orbit.start(camera,new THREE.Vector3());orbit.beginDrag(0);orbit.drag(.04,-.02,40);
    return orbit;
  }
  function position(orbit:PlanetOrbit){const p=new THREE.Vector3();orbit.sample(1,200,p,new THREE.Vector3(),new THREE.Vector3());return p;}
  const a=setup(),b=setup();a.endDrag(40);b.endDrag(40);
  for(let i=0;i<30;i++)a.advance(1/30,.035);
  for(let i=0;i<120;i++)b.advance(1/120,.035);
  assert.ok(position(a).distanceTo(position(b))<1e-8);
  for(const finish of [undefined,240,'cancel'] as const){
    const orbit=setup(),before=position(orbit);
    if(finish!==undefined)orbit.endDrag(typeof finish==='number'?finish:40,finish==='cancel');
    orbit.advance(.1);
    assert.ok(before.distanceTo(position(orbit))<1e-8,'holding, pausing before release, and cancellation clear coasting');
  }
});
