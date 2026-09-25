import assert from 'node:assert/strict';
import test from 'node:test';
import { planConstructionCrew } from '../src/town/residents';

test('workers arrive along clear paths outside the finished building', () => {
  const isClear = (x: number, z: number) => !(Math.abs(x - 32) < 7.5 && Math.abs(z) < 6.5)
    && !(x < 23 && x > 17 && z > -3 && z < 3);
  const routes = planConstructionCrew({ x: 32, z: 0 }, 4, isClear);
  assert.equal(routes.length, 4);
  for (const { origin, spot } of routes) {
    for (let step = 0; step <= 20; step++) {
      const t = step / 20;
      assert.ok(isClear(origin.x + (spot.x - origin.x) * t, origin.z + (spot.z - origin.z) * t));
    }
  }
  for (let i = 0; i < routes.length; i++) {
    for (let j = i + 1; j < routes.length; j++) {
      assert.ok(Math.hypot(routes[i].spot.x - routes[j].spot.x, routes[i].spot.z - routes[j].spot.z) >= 2.5);
    }
  }
});
