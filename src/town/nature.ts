import * as THREE from 'three';
import natureData from './generated/nature.json';
import { MAT } from './materials';
import type { Mat } from './materials';

export type NatureFamily = 'Pine_A' | 'Pine_B' | 'Pine_C'
  | 'Shrub_A' | 'Shrub_B' | 'Rock_A' | 'Rock_B' | 'Rock_C' | 'Rock_Path';
export type NatureRole = 'trunk' | 'canopy' | 'shrub' | 'rock';

type NaturePart = {
  name: string;
  family: NatureFamily;
  lod: 0 | 1;
  role: NatureRole;
  material: keyof typeof MAT;
  positions: number[];
  normals: number[];
  indices: number[];
  colors?: number[];
};

type NatureAssetPart = {
  geometry: THREE.BufferGeometry;
  material: Mat;
  role: NatureRole;
};

const data = natureData as { version: number; coordinates: string; parts: NaturePart[] };
if (data.version !== 1 || data.coordinates !== 'three-y-up') {
  throw new Error('Unsupported nature geometry format');
}

// These are shared once across every instance. Vertex colors carry the bough,
// leaf, bark, and stone palette while the source MAT defines the surface family.
const coloredMaterials = new Map<keyof typeof MAT, Mat>();
function materialFor(part: NaturePart): Mat {
  if (!part.colors) return MAT[part.material];
  let material = coloredMaterials.get(part.material);
  if (!material) {
    const colored = MAT[part.material].clone() as THREE.MeshStandardMaterial;
    colored.color.set(0xffffff);
    colored.vertexColors = true;
    colored.onBeforeCompile = MAT[part.material].onBeforeCompile;
    colored.customProgramCacheKey = MAT[part.material].customProgramCacheKey;
    colored.needsUpdate = true;
    material = colored;
    coloredMaterials.set(part.material, colored);
  }
  return material;
}

const assets = new Map<NatureFamily, [NatureAssetPart[], NatureAssetPart[]]>();
const sharedGeometries = new Set<THREE.BufferGeometry>();
export const NATURE_SHARED_GEOMETRIES: ReadonlySet<THREE.BufferGeometry> = sharedGeometries;

for (const part of data.parts) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(part.positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(part.normals, 3));
  geometry.setIndex(part.indices);
  if (part.colors?.length === part.positions.length) {
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(part.colors, 3));
  }
  geometry.computeBoundingSphere();
  sharedGeometries.add(geometry);
  const levels = assets.get(part.family) ?? [[], []];
  levels[part.lod].push({ geometry, material: materialFor(part), role: part.role });
  assets.set(part.family, levels);
}

export function getNatureAsset(family: NatureFamily, mobile: boolean): readonly NatureAssetPart[] {
  const asset = assets.get(family);
  if (!asset) throw new Error(`Unknown nature asset: ${family}`);
  return asset[mobile ? 1 : 0];
}
