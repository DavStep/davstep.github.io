import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { CASTLE_SHARED_GEOMETRIES, castleBuilding } from '../src/town/castle';
import type { PlotState } from '../src/town/model';

const plot = (stage: number): PlotState => ({
  id: 'castle', kind: 'castle', x: 0, z: 0, start: 0, step: 1,
  stage, variant: 0, renovation: 0,
});

test('castle construction remains inside the original stage envelope', () => {
  const ceilings: Record<number, number> = { 1: 2.50, 2: 3.196, 3: 6.56, 4: 7.51, 5: 19.15, 6: 20.10 };
  for (const mobile of [false, true]) {
    assert.equal(castleBuilding(plot(0), mobile).children.length, 0);
    for (let stage = 1; stage <= 6; stage++) {
      const group = castleBuilding(plot(stage), mobile);
      assert.ok(group.children.length > 0);
      assert.deepEqual(group.position.toArray(), [0, .48, 0]);
      const bounds = new THREE.Box3().setFromObject(group);
      assert.ok(bounds.min.x >= -8.647 && bounds.max.x <= 7.413, `X envelope stage ${stage}`);
      assert.ok(bounds.min.z >= -6.943 && bounds.max.z <= 6.943, `Z envelope stage ${stage}`);
      assert.ok(bounds.min.y >= .475 && bounds.max.y <= ceilings[stage] + .005, `height stage ${stage}: ${bounds.max.y}`);
      const triangles = group.children.reduce((sum, child) => {
        assert.ok(child instanceof THREE.Mesh);
        assert.ok(CASTLE_SHARED_GEOMETRIES.has(child.geometry));
        assert.ok(child.geometry.getAttribute('normal'));
        if (child.material === undefined) throw new Error('missing material');
        if ((child.material as THREE.Material).vertexColors) {
          assert.equal(child.geometry.getAttribute('color')?.count, child.geometry.getAttribute('position').count);
        }
        return sum + (child.geometry.index?.count ?? child.geometry.getAttribute('position').count) / 3;
      }, 0);
      if (stage === 6) assert.ok(triangles <= (mobile ? 7000 : 18000));
    }
  }
});

test('castle authored buffers are reused across builds', () => {
  const first = castleBuilding(plot(6), false);
  const second = castleBuilding(plot(6), false);
  assert.equal(first.children.length, second.children.length);
  first.children.forEach((child, index) => {
    assert.ok(child instanceof THREE.Mesh && second.children[index] instanceof THREE.Mesh);
    assert.equal(child.geometry, second.children[index].geometry);
  });
});
