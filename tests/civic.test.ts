import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { CIVIC_SHARED_GEOMETRIES, civicBuilding, millRotor } from '../src/town/civic';
import data from '../src/town/generated/civic.json';
import { MILL_ROTOR_SOCKET } from '../src/town/windmill-layout';
import { PLOTS, INFRASTRUCTURE, accessPathFor } from '../src/town/town-plan';
import { terrainHeight } from '../src/town/environment';
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
            // The elevated rotor has its own tested sweep; ground proxies exclude air.
            const inRotor = kind === 'mill' && child.name.includes('_mill_sails_')
              && position.getY(i) > 2.2 && Math.abs(z - MILL_ROTOR_SOCKET.z) < .35;
            assert.ok(inMain || inShed || inWing || inRotor,
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


test('windmill tower and full sail sweep clear the walls, roads and ground in both LODs', () => {
  const site = PLOTS.find(p => p.id === 'mill')!;
  const access = accessPathFor(site)!;
  assert.ok(Math.hypot(site.x, site.z) > INFRASTRUCTURE.wall.innerRadius + 6);
  assert.ok(Math.abs(Math.hypot(access.x2, access.z2) - INFRASTRUCTURE.road.outerRingRadius) < 1e-6);
  for (const mobile of [false, true]) {
    const state = { ...site, stage: 6, renovation: 0 };
    const shell = civicBuilding(state, mobile, true);
    assert.ok(!shell.children.some(child => child.name.includes('_mill_sails_')));
    assert.ok(new THREE.Box3().setFromObject(shell).max.y > 9);
    const rotor = millRotor(mobile);
    assert.ok(rotor.children.length > 0);
    rotor.position.set(site.x + MILL_ROTOR_SOCKET.x, .48 + MILL_ROTOR_SOCKET.y, site.z + MILL_ROTOR_SOCKET.z);
    for (let turn = 0; turn < 24; turn++) {
      rotor.rotation.z = turn * Math.PI / 12;
      rotor.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(rotor, true);
      assert.ok(bounds.min.y > 2.6, 'sails stay above visitors and the doorway');
      for (const group of [shell, rotor]) {
        group.updateMatrixWorld(true);
        group.traverse(child => {
          if (!(child instanceof THREE.Mesh)) return;
          const positions = child.geometry.getAttribute('position');
          for (let i = 0; i < positions.count; i++) {
            const p = new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(child.matrixWorld);
            const radius = Math.hypot(p.x, p.z);
            assert.ok(radius > INFRASTRUCTURE.wall.innerRadius + 2, 'clear inner wall');
            assert.ok(radius < INFRASTRUCTURE.road.outerRingRadius - 1.2, 'clear outer road and wall');
            assert.ok(Math.abs(terrainHeight(p.x, p.z) - .48) < .001, 'foundation on level terrain');
          }
        });
      }
    }
    // At zero turn, dynamic and static sails have identical world-space bounds.
    rotor.rotation.z = 0;
    const fixed = civicBuilding(state, mobile);
    for (const child of [...fixed.children]) if (!child.name.includes('_mill_sails_')) fixed.remove(child);
    const a = new THREE.Box3().setFromObject(fixed), b = new THREE.Box3().setFromObject(rotor, true);
    assert.ok(a.min.distanceTo(b.min) < 1e-5 && a.max.distanceTo(b.max) < 1e-5);
    for (const child of rotor.children) {
      const mesh = child as THREE.Mesh;
      assert.ok(!CIVIC_SHARED_GEOMETRIES.has(mesh.geometry));
      mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose();
    }
  }
});

test('mill entrance lane stays walkable through the mature farm site', async () => {
  const { buildColliders, isBlocked } = await import('../src/town/collision');
  const { createSave, townAt } = await import('../src/town/model');
  const snapshot = townAt(createSave(0), 30 * 60_000);
  const colliders = buildColliders(snapshot);
  const site = snapshot.plots.find(p => p.id === 'mill')!;
  const path = accessPathFor(site)!;
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    assert.equal(isBlocked(path.x1 + (path.x2-path.x1)*t, path.z1 + (path.z2-path.z1)*t, colliders), false);
  }
  const angle = Math.atan2(path.z2, path.x2);
  for (let i = 0; i <= 40; i++) {
    const a = angle * (1-i/40);
    assert.equal(isBlocked(Math.cos(a)*INFRASTRUCTURE.road.outerRingRadius, Math.sin(a)*INFRASTRUCTURE.road.outerRingRadius, colliders), false);
  }
});
