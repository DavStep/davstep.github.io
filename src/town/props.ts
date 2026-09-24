import * as THREE from 'three';
import propData from './generated/props.json';
import { MAT } from './materials';

export type PropFamily = 'Fence_A' | 'Barrel_A' | 'Crate_A' | 'Lantern_A' | 'Logpile_A';
export type PropAssetPart = {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  role: string;
};

type PropPart = {
  name: string;
  family: PropFamily;
  lod: 0 | 1;
  role: string;
  material: keyof typeof MAT;
  positions: number[];
  normals: number[];
  indices: number[];
};

const data = propData as { version: number; coordinates: string; parts: PropPart[] };
if (data.version !== 1 || data.coordinates !== 'three-y-up') {
  throw new Error('Unsupported prop geometry format');
}

const parts = data.parts.map(part => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(part.positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(part.normals, 3));
  geometry.setIndex(part.indices);
  return { ...part, geometry, materialObject: MAT[part.material] };
});

export const PROPS_SHARED_GEOMETRIES: ReadonlySet<THREE.BufferGeometry> = new Set(parts.map(part => part.geometry));

export function getPropAsset(family: PropFamily, mobile: boolean): PropAssetPart[] {
  const lod = mobile ? 1 : 0;
  return parts.filter(part => part.family === family && part.lod === lod)
    .map(part => ({ geometry: part.geometry, material: part.materialObject, role: part.role }));
}
