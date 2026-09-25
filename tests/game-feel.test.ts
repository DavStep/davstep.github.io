import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BuildSequencer, buildStyle } from '../src/town/build-sequencer';
import { Juice } from '../src/town/juice';

const house = (x: number) => {
  const g = new THREE.Group(); g.position.set(x, 2, 0);
  g.add(new THREE.Mesh(new THREE.BoxGeometry(4, 5, 4)));
  return g;
};

test('buildings drop or rise with anticipation, one impact each, and settle at rest', () => {
  assert.equal(buildStyle('home'), 'drop');
  assert.equal(buildStyle('market'), 'rise');
  const oldHome = house(0), newHome = house(0), shop = house(12);
  const impacts: string[] = []; let puffs = 0;
  const seq = new BuildSequencer([
    { kind: 'home', previous: oldHome, next: newHome },
    { kind: 'market', next: shop },
  ], impact => impacts.push(impact.kind), () => puffs++);
  // Nothing new is visible at the first frame; the old stage crouches first.
  assert.equal(newHome.visible, false);
  seq.update(.1);
  assert.ok(oldHome.scale.y < 1 && oldHome.scale.x > 1, 'old stage squashes as anticipation');
  let falling = false;
  for (let t = 0; t < 4 && !seq.finished; t += 1 / 60) {
    seq.update(1 / 60);
    if (newHome.visible && newHome.position.y > 3) falling = true;
  }
  assert.ok(falling, 'homes fall in from above');
  assert.ok(seq.finished);
  assert.deepEqual(impacts.sort(), ['home', 'market']);
  assert.equal(puffs, 1);
  assert.equal(oldHome.visible, false);
  for (const g of [newHome, shop]) {
    assert.equal(g.visible, true);
    assert.deepEqual(g.scale.toArray(), [1, 1, 1]);
    assert.equal(g.position.y, 2);
  }
});

test('skipping jumps straight to the finished state', () => {
  const next = house(0), previous = house(0);
  const seq = new BuildSequencer([{ kind: 'forge', previous, next }], () => {});
  seq.finish();
  assert.ok(seq.finished);
  assert.equal(previous.visible, false);
  assert.equal(next.visible, true);
  assert.deepEqual(next.scale.toArray(), [1, 1, 1]);
});

test('juice particles are pooled, expire, and release everything on dispose', () => {
  const scene = new THREE.Scene(), juice = new Juice(scene);
  juice.dustRing(0, 0, 0, 4, 20); juice.debris(0, 0, 0, 3, [0xffffff], 10); juice.sparkles(0, 0, 0, 0xff0000, 12);
  juice.shockwave(0, 0, 0, 0xffffff); juice.pillar(0, 0, 0, 0xffffff); juice.addShake(.5);
  assert.ok(juice.shake > 0);
  for (let i = 0; i < 180; i++) juice.update(1 / 60);
  assert.equal(juice.shake, 0, 'camera shake decays to rest');
  const matrix = new THREE.Matrix4(), scale = new THREE.Vector3();
  juice.group.traverse(node => {
    if (!(node instanceof THREE.InstancedMesh)) return;
    for (let i = 0; i < node.count; i++) { node.getMatrixAt(i, matrix); scale.setFromMatrixScale(matrix); assert.ok(scale.length() < 1e-6); }
  });
  // Pools are bounded: an enormous burst never allocates beyond capacity.
  juice.sparkles(0, 0, 0, 0xffffff, 10_000);
  juice.dispose();
  assert.equal(scene.children.length, 0);
});
