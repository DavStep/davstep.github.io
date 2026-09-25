import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { authoredLandmarkBuilding } from '../src/town/authored-landmarks';
import { ParachuteArrival, isSandshipArrival, SANDSHIP_TOUCHDOWN } from '../src/town/parachute-arrival';
import { snapshotForGame } from '../src/town/game-snapshot';
import { evaluate } from '../src/town/game';

const plot = snapshotForGame(evaluate(['workshop']).levels).plots.find(p => p.project === 'sandship')!;

test('Sandship descends above its fixed pad and settles exactly on its hillside placement', () => {
  for (const mobile of [false, true]) {
    const building = authoredLandmarkBuilding(plot, mobile);
    building.position.y = 13.25;
    const settledBounds = new THREE.Box3().setFromObject(building);
    const pad = building.children.find(child => child instanceof THREE.Mesh)!;
    const padBounds = new THREE.Box3().setFromObject(pad);
    const arrival = new ParachuteArrival(building, mobile);
    const hull = building.getObjectByName('sandship-payload')!;
    let priorHeight = Infinity;
    for (let i = 0; i <= 100; i++) {
      arrival.update(i / 100 * SANDSHIP_TOUCHDOWN);
      assert.ok(hull.position.y <= priorHeight);
      assert.ok(hull.position.y >= 0);
      priorHeight = hull.position.y;
      assert.ok(new THREE.Box3().setFromObject(pad).equals(padBounds), 'the dock must stay grounded');
    }
    assert.deepEqual(hull.position.toArray(), [0, 0, 0]);
    arrival.dispose();
    assert.ok(new THREE.Box3().setFromObject(building).equals(settledBounds));
  }
});

test('skipping releases each rig resource once without disposing shared ship geometry or materials', () => {
  const building = authoredLandmarkBuilding(plot, false);
  let sharedDisposals = 0;
  building.traverse(child => {
    if (!(child instanceof THREE.Mesh)) return;
    child.geometry.addEventListener('dispose', () => sharedDisposals++);
    (child.material as THREE.Material).addEventListener('dispose', () => sharedDisposals++);
  });
  const arrival = new ParachuteArrival(building, false);
  const owned = new Set<THREE.BufferGeometry | THREE.Material>();
  arrival.rig.traverse(child => {
    if (child instanceof THREE.Mesh) { owned.add(child.geometry); owned.add(child.material as THREE.Material); }
  });
  let temporaryDisposals = 0;
  owned.forEach(resource => resource.addEventListener('dispose', () => temporaryDisposals++));
  arrival.update(.4);
  arrival.dispose();
  arrival.dispose();
  assert.equal(temporaryDisposals, owned.size);
  assert.equal(sharedDisposals, 0);
  assert.equal(building.getObjectByName('sandship-parachute'), undefined);
  assert.deepEqual(building.getObjectByName('sandship-payload')!.position.toArray(), [0, 0, 0]);
});

test('only the first Sandship appearance qualifies for a parachute, never an upgrade or restored save', () => {
  assert.equal(isSandshipArrival({...plot, stage: 0}, plot), true);
  assert.equal(isSandshipArrival(plot, {...plot, stage: 4}), false);
  assert.equal(isSandshipArrival(plot, plot), false);
  assert.equal(isSandshipArrival({...plot, stage: 0}, {...plot, project: 'wizard'}), false);
});
