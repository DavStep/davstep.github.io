import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { MAT } from '../src/town/materials';
import { getPropAsset, PROPS_SHARED_GEOMETRIES, type PropFamily } from '../src/town/props';

const families: PropFamily[] = ['Fence_A', 'Barrel_A', 'Crate_A', 'Lantern_A', 'Logpile_A'];
const limits: Record<PropFamily, { x: number; y: number; z: number; mobile: number }> = {
  Fence_A: { x: 2.4, y: 1.3, z: .3, mobile: 150 },
  Barrel_A: { x: .8, y: 1.0, z: .8, mobile: 150 },
  Crate_A: { x: .9, y: .9, z: .9, mobile: 150 },
  Lantern_A: { x: .52, y: 3.1, z: .52, mobile: 250 },
  Logpile_A: { x: 1.4, y: .7, z: .8, mobile: 150 },
};

test('prop exports obey placement envelopes and LOD budgets', () => {
  for (const family of families) {
    for (const mobile of [false, true]) {
      const parts = getPropAsset(family, mobile);
      assert.ok(parts.length > 0, `missing ${family} ${mobile ? 'mobile' : 'desktop'}`);
      const group = new THREE.Group();
      let triangles = 0;
      for (const part of parts) {
        assert.ok(PROPS_SHARED_GEOMETRIES.has(part.geometry));
        assert.ok(part.geometry.getAttribute('normal'));
        assert.ok(part.role);
        group.add(new THREE.Mesh(part.geometry, part.material));
        triangles += (part.geometry.index?.count ?? part.geometry.getAttribute('position').count) / 3;
      }
      const bounds = new THREE.Box3().setFromObject(group);
      const size = bounds.getSize(new THREE.Vector3());
      assert.ok(bounds.min.y >= -.001, `${family} ground`);
      assert.ok(size.x <= limits[family].x + .002, `${family} width ${size.x}`);
      assert.ok(size.y <= limits[family].y + .002, `${family} height ${size.y}`);
      assert.ok(size.z <= limits[family].z + .002, `${family} depth ${size.z}`);
      assert.ok(triangles <= (mobile ? limits[family].mobile : 350), `${family} triangles ${triangles}`);
    }
  }
});

test('lantern glow uses shared warm lamp material and buffers are reused', () => {
  const first = getPropAsset('Lantern_A', false);
  const second = getPropAsset('Lantern_A', false);
  assert.ok(first.some(part => part.material === MAT.lamp && part.role === 'warm_glass'));
  assert.deepEqual(first.map(part => part.geometry), second.map(part => part.geometry));
});
