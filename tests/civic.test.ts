import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { CIVIC_SHARED_GEOMETRIES, civicBuilding } from '../src/town/civic';
import data from '../src/town/generated/civic.json';
import type { PlotState } from '../src/town/model';

const families = ['market', 'tavern', 'forge', 'mill', 'guild', 'post'] as const;
const plot = (kind: typeof families[number], stage: number): PlotState => ({
  id: kind, kind, x: 12, z: -7, stage, renovation: 0, variant: 0, start: 0, step: 1,
});

test('all six civic families retain every construction stage in both quality tiers', () => {
  for (const kind of families) {
    for (const mobile of [false, true]) {
      assert.equal(civicBuilding(plot(kind, 0), mobile).children.length, 0);
      for (let stage = 1; stage <= 6; stage++) {
        const group = civicBuilding(plot(kind, stage), mobile);
        assert.deepEqual(group.position.toArray(), [12, .48, -7]);
        assert.ok(group.children.length > 0, `${kind} stage ${stage}, mobile ${mobile}`);
        for (const child of group.children) {
          assert.ok(child instanceof THREE.Mesh);
          assert.ok(CIVIC_SHARED_GEOMETRIES.has(child.geometry));
          assert.ok(child.geometry.getAttribute('position').count > 0);
          if ((child.material as THREE.Material & { vertexColors?: boolean }).vertexColors) {
            assert.equal(child.geometry.getAttribute('color')?.count,
              child.geometry.getAttribute('position').count);
          }
        }
      }
    }
  }
});

test('civic stages stay inside the existing collider envelopes and triangle ceilings', () => {
  for (const kind of families) {
    for (const mobile of [false, true]) {
      const lod = mobile ? 1 : 0;
      const parts = data.parts.filter(part => part.family === kind && part.lod === lod
        && part.minStage <= 6 && part.maxStage >= 6);
      const triangles = parts.reduce((sum, part) => sum + part.indices.length / 3, 0);
      assert.ok(triangles <= (mobile ? 2300 : 5500), `${kind} LOD${lod}: ${triangles} triangles`);
      for (let stage = 1; stage <= 6; stage++) {
        const group = civicBuilding(plot(kind, stage), mobile);
        const bounds = new THREE.Box3().setFromObject(group);
        // World positions above are 12/-7. The main footprint is +/-3, +/-2.75;
        // stage 5/6 extensions have their own fixed proxies.
        group.children.forEach(child => {
          if (!(child instanceof THREE.Mesh)) return;
          const position = child.geometry.getAttribute('position');
          for (let i = 0; i < position.count; i++) {
            const x = position.getX(i);
            const z = position.getZ(i);
            const inMain = x >= -3.01 && x <= 3.01 && z >= -2.76 && z <= 2.76;
            const inShed = stage >= 5 && x >= 1.59 && x <= 3.81
              && z >= -1.43 && z <= 1.09;
            const inWing = stage >= 6 && x >= -4.97 && x <= -2.05
              && z >= -2.46 && z <= .86;
            assert.ok(inMain || inShed || inWing,
              `${kind} stage ${stage} ${child.name}: ${[x,z]}`);
          }
        });
        assert.ok(bounds.max.y > .48);
      }
    }
  }
});

test('civic source buffers are shared across builds and survive clone disposal', () => {
  const first = civicBuilding(plot('mill', 6), false);
  const second = civicBuilding(plot('mill', 6), false);
  const source = (first.children[0] as THREE.Mesh).geometry;
  assert.equal(source, (second.children[0] as THREE.Mesh).geometry);
  source.clone().dispose();
  assert.ok(source.getAttribute('position').count > 0);
});
