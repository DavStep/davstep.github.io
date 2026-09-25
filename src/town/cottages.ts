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
const constructionBox = new THREE.BoxGeometry(1, 1, 1);
const constructionRound = new THREE.CylinderGeometry(1, 1, 1, 10);

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
  ...parts.map(part => part.geometry), flowerGeometry, constructionBox, constructionRound,
]);

// The game's first home level is an active building site. Four different
// footprints make the settlement readable before the completed cottages rise.
export function gameCottageBuilding(plot: PlotState, mobile: boolean): THREE.Group {
  if (plot.stage >= 3 || plot.stage <= 0) return cottageBuilding(plot, mobile);
  const group = new THREE.Group();
  group.position.set(plot.x, .48, plot.z);
  const variant = ((plot.variant ?? 0) % 4 + 4) % 4;
  const block = (name: string, x: number, y: number, z: number, w: number, h: number, d: number, material: keyof typeof MAT) => {
    const mesh = new THREE.Mesh(constructionBox, MAT[material]);
    mesh.name = name; mesh.position.set(x, y, z); mesh.scale.set(w, h, d);
    mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh);
  };
  const rectangle = (name: string, x: number, z: number, w: number, d: number, height: number, material: keyof typeof MAT) => {
    block(`${name}-floor`, x, .11, z, w, .22, d, 'stoneDark');
    for (const side of [-1, 1]) {
      block(`${name}-rail`, x + side * w / 2, .48, z, .18, .72, d, material);
      for (const end of [-1, 1]) block(`${name}-post`, x + side * w / 2, height / 2, z + end * d / 2, .2, height, .2, 'woodDark');
    }
    block(`${name}-back`, x, .48, z - d / 2, w, .72, .18, material);
    block(`${name}-lintel`, x, height, z - d / 2, w, .17, .2, 'woodDark');
  };
  if (variant === 0) {
    rectangle('longhouse', 0, 0, 4.4, 3.1, 2.1, 'stone');
    block('doorstep', 0, .15, 2.05, 1.7, .3, .9, 'stone');
  } else if (variant === 1) {
    rectangle('corner-main', -.65, -.35, 3.2, 2.9, 2.4, 'plaster');
    rectangle('corner-wing', 1.25, .8, 1.75, 2.3, 1.65, 'woodLight');
  } else if (variant === 2) {
    const floor = new THREE.Mesh(constructionRound, MAT.stoneDark);
    floor.name = 'roundhouse-floor'; floor.position.y = .13; floor.scale.set(2.15, .26, 2.15);
    floor.castShadow = true; floor.receiveShadow = true; group.add(floor);
    for (let i = 0; i < 9; i++) {
      const angle = i * Math.PI * 2 / 9;
      block('roundhouse-post', Math.cos(angle) * 1.82, .95, Math.sin(angle) * 1.82, .22, 1.9, .22, 'woodDark');
    }
    block('roundhouse-entry', 0, .15, 2.35, 1.5, .3, 1.05, 'stone');
  } else {
    rectangle('twin-left', -1.1, 0, 1.85, 3.4, 1.7, 'stone');
    rectangle('twin-right', 1.05, -.35, 1.8, 2.7, 2.35, 'woodLight');
    block('twin-bridge', 0, .24, 1.35, 1.4, .18, 1.1, 'woodDark');
  }
  if (plot.stage === 1) {
    // Surveyed footing and short starter posts; the full frame rises at stage 2.
    for (const child of group.children) {
      if (!child.name.includes('floor') && !child.name.includes('entry') && !child.name.includes('doorstep')) {
        child.position.y *= .35; child.scale.y *= .35;
      }
    }
  }
  return group;
}

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
