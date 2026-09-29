import test from 'node:test';
import assert from 'node:assert/strict';
import { createCloudGeometry, createFirGeometry } from '../src/town/planet-assets';

test('planet vegetation and clouds have bounded geometry and valid normals for instancing',()=>{
  for(const geometry of [createFirGeometry(),...Array.from({length:3},(_,i)=>createCloudGeometry(i))]){
    const position=geometry.getAttribute('position'),normal=geometry.getAttribute('normal');
    assert.ok(position.count>100&&position.count<18000);
    assert.equal(normal.count,position.count);
    assert.equal(geometry.getAttribute('color').count,position.count);
    for(let i=0;i<position.count;i++){
      assert.ok(Number.isFinite(position.getX(i)+position.getY(i)+position.getZ(i)));
      const length=Math.hypot(normal.getX(i),normal.getY(i),normal.getZ(i));
      assert.ok(Math.abs(length-1)<.01,`normal ${i}: ${length}`);
    }
    geometry.computeBoundingBox();
    assert.ok(geometry.boundingBox!.max.y-geometry.boundingBox!.min.y<10);
    geometry.dispose();
  }
});
