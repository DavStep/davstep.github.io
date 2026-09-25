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

// In the choice game, level 1 maps to stage 2. The authored hero meshes start
// at stage 3, so each project needs its own recognizable first foothold.
function landmarkFoundation(project: ProjectKey, group: THREE.Group): void {
  const block = (name: string, x: number, y: number, z: number,
    width: number, height: number, depth: number, material: keyof typeof MAT) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), MAT[material]);
    mesh.name = name;
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  };
  const round = (name: string, x: number, y: number, z: number,
    radius: number, height: number, material: keyof typeof MAT, sides = 12) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, sides), MAT[material]);
    mesh.name = name;
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  };
  const beam = (name: string, from: THREE.Vector3, to: THREE.Vector3,
    radius: number, material: keyof typeof MAT) => {
    const direction = to.clone().sub(from);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, direction.length(), 6), MAT[material]);
    mesh.name = name;
    mesh.position.copy(from).add(to).multiplyScalar(.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    mesh.castShadow = true;
    group.add(mesh);
  };
  const point = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

  switch (project) {
    case 'outpost':
      block('outpost-foundation', 0, .16, 0, 7.7, .32, 6.5, 'earth');
      block('outpost-trade-counter', 0, 1.02, 2.35, 5.4, 1.45, .75, 'woodDark');
      block('outpost-counter-cap', 0, 1.8, 2.35, 5.8, .18, 1.02, 'woodLight');
      for (const x of [-2.7, 2.7]) {
        block('outpost-awning-post', x, 1.72, 2.22, .2, 3.3, .2, 'woodDark');
        beam('outpost-awning-brace', point(x, 3.25, 2.22), point(x * .72, 2.5, 1.25), .09, 'woodLight');
      }
      block('outpost-awning-crossbar', 0, 3.3, 2.22, 5.55, .18, .2, 'woodLight');
      break;
    case 'battle':
      round('battle-arena-footing', 0, .24, 0, 4.15, .48, 'stoneDark', 16);
      round('battle-duel-ring', 0, .52, 0, 3.2, .09, 'sand', 16);
      block('battle-card-plinth', 0, .87, -1.5, 2.25, .72, 1.25, 'stone');
      block('battle-card-frame', 0, 1.82, -1.5, 1.8, 1.18, .2, 'ink');
      block('battle-card-face', 0, 1.82, -1.37, 1.5, .9, .08, 'plasterIvory');
      for (const x of [-3.25, 3.25]) {
        block('battle-pennant-post', x, 1.35, -1.6, .18, 2.7, .18, 'woodDark');
        block('battle-pennant', x + .35, 2.36, -1.6, .7, .4, .09, x < 0 ? 'red' : 'blue');
      }
      break;
    case 'wizard':
      round('wizard-observatory-footing', 0, .26, 0, 3.85, .52, 'stoneDark');
      round('wizard-tower-core', -1, 1.55, -.7, 1.3, 2.3, 'stone', 10);
      round('wizard-tower-cap', -1, 2.8, -.7, 1.48, .25, 'violet', 10);
      for (const x of [-3.05, 3.05]) {
        block('wizard-lens-tripod', x, 1.45, 1.5, .26, 2.25, .26, 'stone');
        round('wizard-lens-socket', x, 2.7, 1.5, .38, .35, 'magic', 8);
      }
      break;
    case 'dwarves':
      block('dwarves-mine-footing', 0, .17, 0, 7.8, .34, 6.4, 'earth');
      block('dwarves-tunnel-mouth', 0, 1.56, -1.8, 3.45, 2.85, .3, 'ink');
      for (const x of [-1.85, 1.85]) block('dwarves-portal-post', x, 1.73, -1.55, .44, 3.35, .5, 'woodDark');
      block('dwarves-portal-header', 0, 3.38, -1.55, 4.05, .45, .55, 'woodLight');
      for (const x of [-.42, .42]) block('dwarves-first-rail', x, .56, 1.15, .12, .14, 3.9, 'iron');
      for (const z of [0, 1.05, 2.1, 3.15]) block('dwarves-rail-tie', 0, .48, z, 1.35, .16, .25, 'woodDark');
      break;
  }
}

export function authoredLandmarkBuilding(plot: PlotState, mobile: boolean): THREE.Group {
  const group = new THREE.Group();
  group.position.set(plot.x, 0, plot.z);
  if (!plot.project || plot.stage < 2) return group;
  if (plot.stage === 2 && plot.project !== 'sandship') {
    landmarkFoundation(plot.project, group);
    return group;
  }
  // Sandship arrives as a complete starter hull. Keep its stone landing pad
  // separate so the same hull can descend and remain after the arrival.
  const payload = new THREE.Group();
  payload.name = 'sandship-payload';
  if (plot.project === 'sandship') group.add(payload);
  const stage = Math.max(3, Math.min(plot.stage, 6));
  const lod = mobile ? 1 : 0;
  for (const part of parts) {
    if (part.family !== plot.project || part.lod !== lod
      || stage < part.minStage || stage > part.maxStage) continue;
    const mesh = new THREE.Mesh(part.geometry, part.materialObject);
    mesh.name = part.name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    (plot.project === 'sandship' && part.material !== 'stoneDark' ? payload : group).add(mesh);
  }
  return group;
}
