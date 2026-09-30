import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createWorldEventDragon, type DragonPose } from '../src/town/world-event-dragon';

for (const mobile of [true, false]) test(`procedural dragon has finite articulated geometry and a compact sleeping footprint (${mobile ? 'mobile' : 'desktop'})`, () => {
  const dragon = createWorldEventDragon(mobile);
  let draws = 0, triangles = 0;
  dragon.root.traverse(object => {
    assert.equal(object.userData.planetNative, true);
    if (!(object instanceof THREE.Mesh)) return;
    draws++;
    const position = object.geometry.getAttribute('position'); triangles += position.count / 3;
    for (let i = 0; i < position.count; i++) assert.ok(Number.isFinite(position.getX(i) + position.getY(i) + position.getZ(i)));
    assert.ok(object.geometry.getAttribute('normal'));
  });
  assert.ok(draws <= 40, `articulation/material batches: ${draws}`);
  assert.ok(triangles < (mobile ? 6000 : 11000), `triangles: ${triangles}`);
  for (const mode of ['flying', 'calmed', 'sleeping'] as DragonPose[]) {
    for (const t of [0, 1, 2, 5]) {
      dragon.pose(mode, t);
      const bounds = new THREE.Box3().setFromObject(dragon.root), size = bounds.getSize(new THREE.Vector3());
      assert.ok(Number.isFinite(size.length()));
      if (mode === 'flying') { assert.ok(size.x > 7 && size.x < 9); assert.ok(size.z > 5 && size.z < 6.5); }
      if (mode === 'sleeping') { assert.ok(size.x <= 6 && size.z <= 6); assert.ok(bounds.min.y >= -.001, `feet clear ground: ${bounds.min.y}`); }
      if (mode === 'calmed') assert.ok(Math.abs(bounds.min.y) < .01);
    }
  }
  dragon.dispose();
});

test('dragon poses are deterministic, preserve caller placement, and honor reduced motion', () => {
  const dragon = createWorldEventDragon(true), root = dragon.root;
  root.position.set(7, 10, -4); root.rotation.y = .8;
  const wing = root.getObjectByName('wing_left')!, tail = root.getObjectByName('tail_1')!, body = root.getObjectByName('breathing_body')!;
  dragon.pose('flying', 0); const a = wing.rotation.z;
  dragon.pose('flying', .3); assert.notEqual(wing.rotation.z, a);
  dragon.pose('calmed', 0); const standingTail = tail.rotation.y;
  dragon.pose('sleeping', 3); assert.notEqual(tail.rotation.y, standingTail); const breath = body.scale.y;
  assert.equal(root.getObjectByName('open_eyes')!.visible, false);
  assert.equal(root.getObjectByName('sleeping_eyelids')!.visible, true);
  dragon.pose('sleeping', 7); assert.notEqual(body.scale.y, breath);
  dragon.pose('sleeping', 3); assert.equal(body.scale.y, breath);
  for (const mode of ['flying', 'calmed', 'sleeping'] as DragonPose[]) {
    dragon.pose(mode, 1, true); const transforms: number[] = [];
    root.traverse(o => { o.updateMatrix(); transforms.push(...o.matrix.elements); });
    dragon.pose(mode, 1000, true); const next: number[] = [];
    root.traverse(o => { o.updateMatrix(); next.push(...o.matrix.elements); });
    assert.deepEqual(next, transforms);
  }
  assert.deepEqual(root.position.toArray(), [7, 10, -4]); assert.equal(root.rotation.y, .8);
  dragon.dispose();
});

test('dragon disposes every owned batch/material exactly once and detaches', () => {
  const dragon = createWorldEventDragon(true), parent = new THREE.Group(); parent.add(dragon.root);
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  dragon.root.traverse(o => { if (o instanceof THREE.Mesh) { geometries.add(o.geometry); materials.add(o.material as THREE.Material); } });
  assert.equal(materials.size, 6, 'materials shared between articulations');
  let disposed = 0;
  for (const resource of [...geometries, ...materials]) resource.addEventListener('dispose', () => disposed++);
  dragon.dispose(); dragon.dispose();
  assert.equal(disposed, geometries.size + materials.size); assert.equal(parent.children.length, 0);
});
