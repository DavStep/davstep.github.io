/** Capture the current five project silhouettes for Blender authoring.
 * Run: npx tsx art/blender/extract_landmark_source.ts
 * Stages are compared by geometry, transform, and material so unchanged parts
 * are stored once with the full range of stages in which they are visible.
 */
import * as THREE from 'three';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { landmarkBuilding } from '../../src/town/landmarks';
import { MAT } from '../../src/town/materials';
import type { PlotState } from '../../src/town/model';
import type { ProjectKey } from '../../src/town/projects';

type SourcePart = {
  name: string;
  material: keyof typeof MAT;
  kind: 'block' | 'mesh';
  positions: number[];
  indices?: number[];
  originalPositions?: number[];
  originalIndices?: number[];
  minStage: number;
  maxStage: number;
};

const families: ProjectKey[] = ['outpost', 'sandship', 'battle', 'wizard', 'dwarves'];
const materialName = new Map<THREE.Material, keyof typeof MAT>(
  Object.entries(MAT).map(([key, material]) => [material, key as keyof typeof MAT]),
);
const round = (value: number) => Math.round(value * 1e6) / 1e6;
const point = new THREE.Vector3();
const cubeCorners: [number, number, number][] = [
  [-.5, -.5, -.5], [-.5, -.5, .5], [-.5, .5, -.5], [-.5, .5, .5],
  [.5, -.5, -.5], [.5, -.5, .5], [.5, .5, -.5], [.5, .5, .5],
];

function capture(mesh: THREE.Mesh, index: number): Omit<SourcePart, 'minStage' | 'maxStage'> {
  const material = materialName.get(mesh.material as THREE.Material);
  if (!material) throw new Error(`Unmapped landmark material at mesh ${index}`);
  mesh.updateWorldMatrix(true, false);
  if (mesh.geometry.type === 'RoundedBoxGeometry') {
    const positions = cubeCorners.flatMap(corner => {
      point.set(...corner).applyMatrix4(mesh.matrixWorld);
      return [round(point.x), round(point.y), round(point.z)];
    });
    const attr = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    const originalPositions: number[] = [];
    for (let i = 0; i < attr.count; i++) {
      point.fromBufferAttribute(attr, i).applyMatrix4(mesh.matrixWorld);
      originalPositions.push(round(point.x), round(point.y), round(point.z));
    }
    const originalIndex = mesh.geometry.getIndex()?.array;
    const originalIndices = originalIndex ? Array.from(originalIndex)
      : Array.from({ length: attr.count }, (_, i) => i);
    return { name: `part_${index}`, kind: 'block', material, positions,
      originalPositions, originalIndices };
  }
  const attr = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
  const positions: number[] = [];
  for (let i = 0; i < attr.count; i++) {
    point.fromBufferAttribute(attr, i).applyMatrix4(mesh.matrixWorld);
    positions.push(round(point.x), round(point.y), round(point.z));
  }
  const indexArray = mesh.geometry.getIndex()?.array;
  const indices = indexArray ? Array.from(indexArray) : Array.from({ length: attr.count }, (_, i) => i);
  return { name: `part_${index}`, kind: 'mesh', material, positions, indices };
}

const models: Record<ProjectKey, SourcePart[]> = {} as Record<ProjectKey, SourcePart[]>;
for (const family of families) {
  const unique = new Map<string, SourcePart>();
  for (let stage = 3; stage <= 6; stage++) {
    const plot: PlotState = {
      id: `project-${family}`, kind: 'project', project: family,
      x: 0, z: 0, stage, renovation: 0, start: 0, step: 1,
    };
    const group = landmarkBuilding(plot);
    const occurrences = new Map<string, number>();
    group.children.forEach((child, index) => {
      if (!(child instanceof THREE.Mesh)) return;
      const source = capture(child, index);
      const digest = createHash('sha1').update(JSON.stringify([
        source.kind, source.material, source.positions, source.indices,
      ])).digest('hex');
      const occurrence = occurrences.get(digest) ?? 0;
      occurrences.set(digest, occurrence + 1);
      const key = digest + ':' + occurrence;
      const previous = unique.get(key);
      if (previous) {
        if (previous.maxStage !== stage - 1) throw new Error(`Discontinuous stage use: ${family} ${key}`);
        previous.maxStage = stage;
      } else {
        unique.set(key, { ...source, name: `${family}_${source.name}_s${stage}_${key.slice(0, 7)}`,
          minStage: stage, maxStage: stage });
      }
    });
  }
  models[family] = [...unique.values()];
}

const out = resolve(dirname(fileURLToPath(import.meta.url)), 'landmarks-source.json');
writeFileSync(out, JSON.stringify({ version: 1, coordinates: 'three-y-up', models }));
for (const family of families) {
  const parts = models[family];
  console.log(family, parts.length, 'unique parts',
    parts.filter(part => part.minStage === 3 && part.maxStage === 6).length, 'shared through all stages');
}
console.log(out);
