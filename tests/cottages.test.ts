import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { COTTAGE_SHARED_GEOMETRIES, cottageBuilding, gameCottageBuilding } from '../src/town/cottages';
import cottageData from '../src/town/generated/cottages.json';
import type { PlotState } from '../src/town/model';

const plot = (stage: number, variant: number, renovation = 0): PlotState => ({
  id: 'test-cottage', kind: 'home', x: 12, z: -7, start: 0, step: 1,
  stage, variant, renovation,
});

test('every cottage family and construction stage has desktop and mobile geometry', () => {
  for (const mobile of [false, true]) {
    for (let stage = 1; stage <= 8; stage++) {
      for (let variant = 0; variant < 3; variant++) {
        const group = cottageBuilding(plot(stage, variant), mobile);
        assert.ok(group.children.length > 0, `missing stage ${stage}, family ${variant}, mobile ${mobile}`);
        assert.deepEqual(group.position.toArray(), [12, .48, -7]);
        for (const child of group.children) {
          assert.ok(child instanceof THREE.Mesh);
          assert.ok(COTTAGE_SHARED_GEOMETRIES.has(child.geometry));
          assert.ok(child.geometry.getAttribute('position').count > 0);
          assert.ok(child.material instanceof THREE.Material);
          if (child.material.vertexColors) {
            assert.equal(child.geometry.getAttribute('color')?.count, child.geometry.getAttribute('position').count);
          }
        }
      }
    }
  }
  assert.equal(cottageBuilding(plot(0, 0), false).children.length, 0);
});

test('cached cottage buffers survive repeated builds and renovation stays visible', () => {
  const first = cottageBuilding(plot(6, 0, 2), false);
  const second = cottageBuilding(plot(6, 0, 2), false);
  const firstMeshes = first.children.filter((child): child is THREE.Mesh => child instanceof THREE.Mesh);
  const secondMeshes = second.children.filter((child): child is THREE.Mesh => child instanceof THREE.Mesh);
  assert.equal(firstMeshes.length, secondMeshes.length);
  firstMeshes.forEach((mesh, index) => assert.equal(mesh.geometry, secondMeshes[index].geometry));
  assert.equal(firstMeshes.filter(mesh => mesh.name === 'renovation-flower').length, 2);
  assert.equal(cottageBuilding(plot(5, 0, 2), false).children.some(child => child.name === 'renovation-flower'), false);
  const source = firstMeshes[0].geometry;
  const copy = source.clone();
  copy.dispose();
  assert.ok(source.getAttribute('position').count > 0);
  assert.equal(secondMeshes[0].geometry, source);
});

test('porch geometry follows the four-variant porch slot', () => {
  const porchParts = cottageData.parts.filter(part => part.porchOnly && part.lod === 0
    && (part.family === 'C' || part.family === 'COMMON')
    && part.minStage <= 6 && part.maxStage >= 6);
  assert.ok(porchParts.length > 0);
  const withPorch = cottageBuilding(plot(6, 2), false);
  const withoutPorch = cottageBuilding(plot(6, 8), false);
  for (const part of porchParts) {
    assert.ok(withPorch.children.some(child => child.name === part.name));
    assert.ok(!withoutPorch.children.some(child => child.name === part.name));
  }
});

test('game homes begin with four distinct construction footprints', () => {
  const names = new Set<string>();
  for (let variant = 0; variant < 4; variant++) {
    const group = gameCottageBuilding(plot(2, variant), false);
    assert.ok(group.children.length >= 7);
    const footprint = group.children.filter(child => child.name.endsWith('-floor'))
      .map(child => child.name).sort().join(',');
    names.add(footprint);
    for (const child of group.children) {
      assert.ok(child instanceof THREE.Mesh);
      assert.ok(COTTAGE_SHARED_GEOMETRIES.has(child.geometry));
    }
  }
  assert.equal(names.size, 4);
  assert.ok(gameCottageBuilding(plot(4, 0), false).children.some(child => child.name.includes('roof')));
});

test('scene batching disposes old batches while retaining authored cottage buffers', async () => {
  Object.defineProperty(globalThis, 'matchMedia', {
    configurable: true, value: () => ({ matches: false }),
  });
  const { TownScene } = await import('../src/town/scene');
  const scene = Object.assign(Object.create(TownScene.prototype), {
    structures: new THREE.Group(),
    pickBoxes: new Map(),
    contactShadows: { setBuildings: () => {} },
  }) as { structures: THREE.Group; buildStructures: (plots: PlotState[]) => void };
  const source = [...COTTAGE_SHARED_GEOMETRIES][0];
  let sourceDisposed = false;
  source.addEventListener('dispose', () => { sourceDisposed = true; });

  scene.buildStructures([plot(6, 0)]);
  assert.ok(scene.structures.children.length > 0);
  const oldBatch = (scene.structures.children[0] as THREE.Mesh).geometry;
  let oldBatchDisposed = false;
  oldBatch.addEventListener('dispose', () => { oldBatchDisposed = true; });
  scene.buildStructures([plot(5, 1)]);

  assert.ok(oldBatchDisposed);
  assert.equal(sourceDisposed, false);
  assert.ok(source.getAttribute('position').count > 0);
  assert.ok(scene.structures.children.length > 0);
});
