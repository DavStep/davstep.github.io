import * as THREE from 'three';
import landmarkData from './generated/landmarks.json';
import { MAT } from './materials';
import type { PlotState } from './model';
import type { ProjectKey } from './projects';

type LandmarkPart = {
  name: string;
  family: ProjectKey;
  lod: 0 | 1;
  minStage: number;
  maxStage: number;
  material: keyof typeof MAT;
  positions: number[];
  normals: number[];
  indices: number[];
  colors?: number[];
};

const data = landmarkData as { version: number; coordinates: string; parts: LandmarkPart[] };
if (data.version !== 1 || data.coordinates !== 'three-y-up') {
  throw new Error('Unsupported landmark geometry format');
}

const parts = data.parts.map(part => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(part.positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(part.normals, 3));
  geometry.setIndex(part.indices);
  if (part.colors) {
    if (part.material !== 'roofTiles' || part.colors.length !== part.positions.length) {
      throw new Error(`Unexpected landmark vertex colors: ${part.name}`);
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(part.colors, 3));
  }
  return { ...part, geometry, materialObject: MAT[part.material] };
});

// Stage changes reuse authored source buffers. The scene batching path may
// clone these geometries, but must keep the originals alive.
export const AUTHORED_LANDMARK_SHARED_GEOMETRIES: ReadonlySet<THREE.BufferGeometry> = new Set(
  parts.map(part => part.geometry),
);

export function authoredLandmarkBuilding(plot: PlotState, mobile: boolean): THREE.Group {
  const group = new THREE.Group();
  group.position.set(plot.x, 0, plot.z);
  if (!plot.project || plot.stage < 3) return group;
  const stage = Math.min(plot.stage, 6);
  const lod = mobile ? 1 : 0;
  for (const part of parts) {
    if (part.family !== plot.project || part.lod !== lod
      || stage < part.minStage || stage > part.maxStage) continue;
    const mesh = new THREE.Mesh(part.geometry, part.materialObject);
    mesh.name = part.name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}
