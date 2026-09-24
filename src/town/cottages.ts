import * as THREE from 'three';
import cottageData from './generated/cottages.json';
import { MAT } from './materials';
import type { PlotState } from './model';

type Family = 'A' | 'B' | 'C' | 'COMMON';
type CottagePart = {
  name: string;
  family: Family;
  lod: 0 | 1;
  minStage: number;
  maxStage: number;
  porchOnly: boolean;
  material: keyof typeof MAT;
  positions: number[];
  normals: number[];
  indices: number[];
  colors?: number[];
};

const data = cottageData as { version: number; coordinates: string; parts: CottagePart[] };
if (data.version !== 1 || data.coordinates !== 'three-y-up') {
  throw new Error('Unsupported cottage geometry format');
}

const familyFor = (variant: number): Family => (['A', 'B', 'C'] as const)[((variant % 3) + 3) % 3];
const flowerGeometry = new THREE.IcosahedronGeometry(1, 1);

const parts = data.parts.map(part => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(part.positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(part.normals, 3));
  geometry.setIndex(part.indices);
  if (part.material === 'roofTiles') {
    const colors = part.colors?.length === part.positions.length
      ? part.colors : Array(part.positions.length).fill(1);
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  }
  return { ...part, geometry, materialObject: MAT[part.material] };
});

// Scene rebuilds clone these for batching; their source buffers stay alive.
export const COTTAGE_SHARED_GEOMETRIES: ReadonlySet<THREE.BufferGeometry> = new Set([
  ...parts.map(part => part.geometry), flowerGeometry,
]);

export function cottageBuilding(plot: PlotState, mobile: boolean): THREE.Group {
  const group = new THREE.Group();
  group.position.set(plot.x, .48, plot.z);
  if (plot.stage <= 0) return group;

  const family = familyFor(plot.variant ?? 0);
  const porch = ((plot.variant ?? 0) % 4 + 4) % 4 === 2;
  const lod = mobile ? 1 : 0;
  for (const part of parts) {
    if (part.lod !== lod || (part.family !== 'COMMON' && part.family !== family)
      || plot.stage < part.minStage || plot.stage > part.maxStage
      || (part.porchOnly && !porch)) continue;
    const mesh = new THREE.Mesh(part.geometry, part.materialObject);
    mesh.name = part.name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  if (plot.stage >= 6) {
    for (let i = 0; i < Math.min(3, plot.renovation); i++) {
      const flower = new THREE.Mesh(flowerGeometry, i % 2 ? MAT.leaf : MAT.red);
      flower.name = 'renovation-flower';
      flower.position.set(-1.32 + i * .19, 1.36, 1.96);
      flower.scale.set(.08, .1, .08);
      flower.castShadow = true;
      group.add(flower);
    }
  }
  return group;
}
