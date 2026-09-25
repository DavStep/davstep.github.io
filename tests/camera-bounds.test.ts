import test from 'node:test';
import assert from 'node:assert/strict';
import { boundedOrbitDistance, CAMERA_BASE_FOV, CAMERA_VALLEY_RADIUS, orbitFieldOfView } from '../src/town/camera-bounds';

test('zooming and rotating keep the camera inside the mountain ring',()=>{
  for(const [x,z] of [[0,0],[-24,-55],[29,-51],[34,0]]){
    for(const elevation of [.38,1.05,1.42])for(let i=0;i<16;i++){
      const azimuth=i*Math.PI/8;
      const distance=boundedOrbitDistance(x,z,azimuth,elevation,220);
      const cameraX=x+Math.cos(azimuth)*Math.sin(elevation)*distance;
      const cameraZ=z+Math.sin(azimuth)*Math.sin(elevation)*distance;
      assert.ok(Math.hypot(cameraX,cameraZ)<=CAMERA_VALLEY_RADIUS+1e-8);
    }
  }
});

test('wide overview retains its apparent zoom while the camera stops at the valley edge',()=>{
  const distance=boundedOrbitDistance(0,0,.72,1.05,220);
  assert.ok(distance<220);
  assert.ok(orbitFieldOfView(220,distance)>CAMERA_BASE_FOV);
  assert.equal(orbitFieldOfView(52,52),CAMERA_BASE_FOV);
});
