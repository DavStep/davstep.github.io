import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { authoredLandmarkBuilding } from '../src/town/authored-landmarks';
import type { PlotState } from '../src/town/model';
import type { ProjectKey } from '../src/town/projects';

const projects: ProjectKey[] = ['outpost', 'sandship', 'battle', 'wizard', 'dwarves'];
const plot = (project: ProjectKey, stage: number): PlotState => ({
  id: `project-${project}`, kind: 'project', project, x: 0, z: 0,
  start: 0, step: 1, stage, renovation: 0,
});

test('each level-one project reveals a distinct foundation inside its plot', () => {
  const signatures = new Set<string>();
  for (const project of projects) {
    for (const mobile of [false, true]) {
      const group = authoredLandmarkBuilding(plot(project, 2), mobile);
      const meshes: THREE.Mesh[] = [];
      group.traverse(child => { if (child instanceof THREE.Mesh) meshes.push(child); });
      assert.ok(meshes.length >= 5, `${project} stage 2 is not visible`);
      const bounds = new THREE.Box3().setFromObject(group);
      assert.ok(bounds.min.x >= -5.3 && bounds.max.x <= 5.3);
      assert.ok(bounds.min.z >= -5 && bounds.max.z <= 5);
      assert.ok(bounds.min.y >= -1e-5 && bounds.max.y <= (project === 'sandship' ? 6.3 : 5));
      const signature = meshes.map(child => child.name).join(',');
      if (!mobile) {
        assert.ok(!signatures.has(signature), `${project} repeats another project foundation`);
        signatures.add(signature);
      }
    }
  }
});
