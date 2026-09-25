import * as THREE from 'three';
import civicData from './generated/civic.json';
import { MAT } from './materials';
import type { PlotKind, PlotState } from './model';
import { MILL_ROTOR_SOCKET } from './windmill-layout';

export type CivicFamily = Extract<PlotKind, 'market' | 'tavern' | 'forge' | 'mill' | 'guild' | 'post'> | 'archive';
type CivicPart = {
  name: string;
  family: CivicFamily;
  lod: 0 | 1;
  minStage: number;
  maxStage: number;
  material: keyof typeof MAT;
  positions: number[];
  normals: number[];
  indices: number[];
  colors?: number[];
};

const data = civicData as { version: number; coordinates: string; parts: CivicPart[] };
if (data.version !== 1 || data.coordinates !== 'three-y-up') {
  throw new Error('Unsupported civic geometry format');
}

const parts = data.parts.map(part => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(part.positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(part.normals, 3));
  geometry.setIndex(part.indices);
  if (part.material === 'roofTiles') {
    if (!part.colors || part.colors.length !== part.positions.length) {
      throw new Error(`Civic roof tile colors missing from ${part.name}`);
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(part.colors, 3));
  }
  return { ...part, geometry, materialObject: MAT[part.material] };
});

// buildStructures clones these buffers into its material batches. The originals
// remain cached across scene rebuilds and must not be disposed by the collector.
export const CIVIC_SHARED_GEOMETRIES: ReadonlySet<THREE.BufferGeometry> = new Set(
  parts.map(part => part.geometry),
);

export function civicFamilyFor(plot: Pick<PlotState, 'id' | 'kind'>): CivicFamily {
  return plot.id === 'post' || plot.id === 'district-archive-great-library'
    ? 'archive' : plot.kind as CivicFamily;
}

export function civicBuilding(plot: PlotState, mobile: boolean, animateMillSails = false): THREE.Group {
  const group = new THREE.Group();
  group.position.set(plot.x, .48, plot.z);
  if (plot.stage <= 0) return group;
  const family = civicFamilyFor(plot);
  const lod = mobile ? 1 : 0;
  for (const part of parts) {
    if (part.family !== family || part.lod !== lod
      || plot.stage < part.minStage || plot.stage > part.maxStage) continue;
    if (animateMillSails && family === 'mill' && part.name.includes('_mill_sails_')) continue;
    const mesh = new THREE.Mesh(part.geometry, part.materialObject);
    mesh.name = part.name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}

// Own cloned buffers/materials: GameScenery disposes its children independently.
export function millRotor(mobile: boolean): THREE.Group {
  const rotor = new THREE.Group();
  rotor.name = 'windmill-rotor';
  for (const part of parts) {
    if (part.family !== 'mill' || part.lod !== (mobile ? 1 : 0)
      || !part.name.includes('_mill_sails_')) continue;
    const geometry = part.geometry.clone().translate(-MILL_ROTOR_SOCKET.x, -MILL_ROTOR_SOCKET.y, -MILL_ROTOR_SOCKET.z);
    const material = part.materialObject.clone();
    material.onBeforeCompile = part.materialObject.onBeforeCompile;
    material.customProgramCacheKey = part.materialObject.customProgramCacheKey;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = part.name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    rotor.add(mesh);
  }
  return rotor;
}
