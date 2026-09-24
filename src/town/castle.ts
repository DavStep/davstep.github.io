import * as THREE from 'three';
import castleData from './generated/castle.json';
import { MAT } from './materials';
import type { PlotState } from './model';

type CastlePart = {
  name: string;
  family: 'CASTLE';
  lod: 0 | 1;
  minStage: number;
  maxStage: number;
  material: keyof typeof MAT;
  positions: number[];
  normals: number[];
  indices: number[];
  colors?: number[];
};

const data = castleData as { version: number; coordinates: string; parts: CastlePart[] };
if (data.version !== 1 || data.coordinates !== 'three-y-up') {
  throw new Error('Unsupported castle geometry format');
}

const parts = data.parts.map(part => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(part.positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(part.normals, 3));
  geometry.setIndex(part.indices);
  if (part.material === 'roofTiles') {
    if (part.colors?.length !== part.positions.length) {
      throw new Error(`Missing castle roof colors: ${part.name}`);
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(part.colors, 3));
  }
  return { ...part, geometry, materialObject: MAT[part.material] };
});

// The scene collector clones for material batching. These source buffers persist.
export const CASTLE_SHARED_GEOMETRIES: ReadonlySet<THREE.BufferGeometry> = new Set(parts.map(part => part.geometry));

export function castleBuilding(plot: PlotState, mobile: boolean): THREE.Group {
  const group = new THREE.Group();
  group.position.set(plot.x, .48, plot.z);
  if (plot.stage < 1) return group;

  const lod = mobile ? 1 : 0;
  for (const part of parts) {
    if (part.lod !== lod || plot.stage < part.minStage || plot.stage > part.maxStage) continue;
    const mesh = new THREE.Mesh(part.geometry, part.materialObject);
    mesh.name = part.name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}
