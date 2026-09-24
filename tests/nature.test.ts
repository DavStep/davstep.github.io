import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { NATURE_SHARED_GEOMETRIES, getNatureAsset } from '../src/town/nature';
import type { NatureFamily } from '../src/town/nature';

const families: NatureFamily[] = [
  'Pine_A', 'Pine_B', 'Pine_C', 'Shrub_A', 'Shrub_B',
  'Rock_A', 'Rock_B', 'Rock_C', 'Rock_Path',
];

test('nature kit has reusable complete family parts within both geometry budgets', () => {
  for (const family of families) {
    for (const mobile of [false, true]) {
      const parts = getNatureAsset(family, mobile);
      assert.ok(parts.length > 0, `${family} missing ${mobile ? 'mobile' : 'desktop'} geometry`);
      assert.equal(getNatureAsset(family, mobile), parts, 'asset buffers should be cached');
      let triangles = 0;
      let minY = Infinity;
      let maxY = -Infinity;
      for (const part of parts) {
        const geometry = part.geometry;
        assert.ok(NATURE_SHARED_GEOMETRIES.has(geometry));
        const position = geometry.getAttribute('position');
        const normal = geometry.getAttribute('normal');
        const color = geometry.getAttribute('color');
        assert.equal(normal.count, position.count);
        assert.equal(color.count, position.count);
        assert.equal((part.material as THREE.MeshStandardMaterial).vertexColors, true);
        triangles += geometry.getIndex()!.count / 3;
        for (let i = 0; i < position.count; i++) {
          const y = position.getY(i);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
          assert.ok(Number.isFinite(y));
        }
      }
      const budget = family.startsWith('Pine') ? (mobile ? 160 : 420)
        : family.startsWith('Shrub') ? (mobile ? 60 : 120)
          : (mobile ? 48 : 96);
      assert.ok(triangles <= budget, `${family} LOD${mobile ? 1 : 0}: ${triangles} > ${budget}`);
      assert.ok(Math.abs(minY) < 1e-5, `${family} ground pivot ${minY}`);
      assert.ok(Math.abs(maxY - 1) < 1e-5, `${family} unit height ${maxY}`);
      const roles = new Set(parts.map(part => part.role));
      if (family.startsWith('Pine')) {
        assert.deepEqual(roles, new Set(['canopy', 'trunk']));
      } else {
        assert.deepEqual(roles, new Set([family.startsWith('Shrub') ? 'shrub' : 'rock']));
      }
    }
  }
});

test('the path stone has a compact footprint for irregular road insets', () => {
  const [path] = getNatureAsset('Rock_Path', false);
  path.geometry.computeBoundingBox();
  const box = path.geometry.boundingBox!;
  assert.ok(box.max.x - box.min.x > .8 && box.max.x - box.min.x < 1.15);
  assert.ok(box.max.z - box.min.z > .75 && box.max.z - box.min.z < 1.1);
});
