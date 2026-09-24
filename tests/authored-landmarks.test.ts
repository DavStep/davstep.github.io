import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { authoredLandmarkBuilding, AUTHORED_LANDMARK_SHARED_GEOMETRIES } from '../src/town/authored-landmarks';
import type { PlotState } from '../src/town/model';
import type { ProjectKey } from '../src/town/projects';

const families: ProjectKey[] = ['outpost', 'sandship', 'battle', 'wizard', 'dwarves'];
type SourcePart = { minStage: number; maxStage: number; positions: number[]; originalPositions?: number[] };
const source = JSON.parse(readFileSync(resolve(dirname(fileURLToPath(import.meta.url)),
  '../art/blender/landmarks-source.json'), 'utf8')) as { models: Record<ProjectKey, SourcePart[]> };
function originalBounds(family: ProjectKey, stage: number): THREE.Box3 {
  const bounds = new THREE.Box3();
  for (const part of source.models[family]) {
    if (stage < part.minStage || stage > part.maxStage) continue;
    const positions = part.originalPositions ?? part.positions;
    for (let i = 0; i < positions.length; i += 3) {
      bounds.expandByPoint(new THREE.Vector3(positions[i], positions[i + 1], positions[i + 2]));
    }
  }
  return bounds;
}
const plot = (project: ProjectKey, stage: number): PlotState => ({
  id: `project-${project}`, kind: 'project', project, x: 18, z: -12,
  start: 0, step: 1, stage, renovation: 0,
});

// New silhouettes may shrink within the historical envelopes; exact old extents
// are intentionally not required by a redesign.
test('all five landmarks retain stages 3–6 with bounded desktop and mobile geometry', () => {
  for (const family of families) {
    for (const mobile of [false, true]) {
      const prior = authoredLandmarkBuilding(plot(family, 3), mobile);
      const mature = authoredLandmarkBuilding(plot(family, 6), mobile);
      assert.ok(prior.children.length > 0, `${family} stage 3 missing`);
      assert.ok(mature.children.length > 0, `${family} stage 6 missing`);
      assert.deepEqual(mature.position.toArray(), [18, 0, -12]);
      const shared = new Set(prior.children.map(child => (child as THREE.Mesh).geometry));
      assert.ok(mature.children.some(child => shared.has((child as THREE.Mesh).geometry)),
        `${family} lost all stable parts between stages`);
      for (let stage = 3; stage <= 6; stage++) {
        const group = authoredLandmarkBuilding(plot(family, stage), mobile);
        let triangles = 0;
        const bounds = new THREE.Box3();
        for (const child of group.children) {
          assert.ok(child instanceof THREE.Mesh);
          assert.ok(AUTHORED_LANDMARK_SHARED_GEOMETRIES.has(child.geometry));
          assert.equal(child.geometry.getAttribute('normal').count,
            child.geometry.getAttribute('position').count);
          triangles += child.geometry.getIndex()!.count / 3;
          child.geometry.computeBoundingBox();
          bounds.union(child.geometry.boundingBox!);
        }
        const original = originalBounds(family, stage);
        for (const axis of ['x', 'y', 'z'] as const) {
          assert.ok(bounds.min[axis] >= original.min[axis] - .02,
            `${family} stage ${stage} minimum ${axis} exceeds the original envelope`);
          assert.ok(bounds.max[axis] <= original.max[axis] + .02,
            `${family} stage ${stage} maximum ${axis} exceeds the original envelope`);
        }
        assert.ok(bounds.min.x>=-5.3 && bounds.max.x<=5.3 && bounds.min.z>=-5 && bounds.max.z<=5, `${family} exceeds picking box`);
        assert.ok(triangles <= (mobile ? 3000 : 6500),
          `${family} stage ${stage} has ${triangles} triangles`);
      }
    }
  }
  assert.equal(authoredLandmarkBuilding(plot('outpost', 0), false).children.length, 0);
});


test('hero meshes have finite normals and nondegenerate exported triangles',()=>{
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
  for(const geometry of AUTHORED_LANDMARK_SHARED_GEOMETRIES){
    const positions=geometry.getAttribute('position'),normals=geometry.getAttribute('normal'),indices=geometry.getIndex()!;
    for(const value of normals.array)assert.ok(Number.isFinite(value));
    for(let i=0;i<indices.count;i+=3){
      a.fromBufferAttribute(positions,indices.getX(i));b.fromBufferAttribute(positions,indices.getX(i+1));c.fromBufferAttribute(positions,indices.getX(i+2));
      assert.ok(b.sub(a).cross(c.sub(a)).lengthSq()>1e-12,'collapsed hero triangle');
    }
  }
});
