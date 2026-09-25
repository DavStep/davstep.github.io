/**
 * Small dioramas of each idea, built from the town's own builders and
 * materials so the card icons match what grows in the valley.
 * Level → stage mappings follow game-snapshot.ts.
 */
import * as THREE from 'three';
import { civicBuilding, millRotor } from '../town/civic';
import { gameCottageBuilding } from '../town/cottages';
import { authoredLandmarkBuilding } from '../town/authored-landmarks';
import { riverAsset } from '../town/river-assets';
import { addNatureInstances } from '../town/nature-placement';
import { getPropAsset, type PropFamily } from '../town/props';
import { placeLanterns } from '../town/prop-placement';
import { MAT } from '../town/materials';
import { MILL_ROTOR_SOCKET } from '../town/windmill-layout';
import type { PlotKind, PlotState } from '../town/model';
import type { ProjectKey } from '../town/projects';
import type { Idea } from '../town/game';

/** Top of the ground tile; the building builders place their base here. */
export const GROUND_Y = .48;

const plot = (id: string, kind: PlotKind, stage: number, extra: Partial<PlotState> = {}): PlotState =>
  ({ id, kind, x: 0, z: 0, start: 0, step: 1, variant: 0, stage, renovation: 0, ...extra });
const regular = (level: number) => Math.min(8, level + 2);
const tiered = (level: number, stages: readonly number[]) => stages[Math.min(stages.length - 1, level - 1)];

function prop(parent: THREE.Group, family: PropFamily, x: number, z: number, rotation = 0, scale: [number, number, number] = [1, 1, 1]) {
  for (const part of getPropAsset(family, false)) {
    const mesh = new THREE.Mesh(part.geometry, part.material);
    mesh.position.set(x, GROUND_Y, z);
    mesh.rotation.y = rotation;
    mesh.scale.set(...scale);
    mesh.castShadow = part.role !== 'warm_glass';
    mesh.receiveShadow = true;
    parent.add(mesh);
  }
}

function box(parent: THREE.Group, material: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number, ry = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.rotation.y = ry;
  mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

/** Stylised water matching the town's river palette. */
const water = new THREE.MeshStandardMaterial({ color: 0x2f9fb0, roughness: .25, metalness: .05, emissive: 0x0d4f5c, emissiveIntensity: .35 });
const channelBed = new THREE.MeshStandardMaterial({ color: 0x8d7355, roughness: 1 });

function channel(parent: THREE.Group, length: number, width: number, filled: boolean, rotation = 0) {
  const g = new THREE.Group();
  g.rotation.y = rotation;
  box(g, channelBed, width + .8, .12, length, 0, GROUND_Y + .01, 0);
  if (filled) box(g, water, width, .1, length, 0, GROUND_Y + .08, 0);
  parent.add(g);
  return g;
}

function trees(parent: THREE.Group, count: number, spread: number, grow: number) {
  const families = ['Pine_A', 'Pine_B', 'Pine_C'] as const;
  const golden = Math.PI * (3 - Math.sqrt(5));
  addNatureInstances(parent, Array.from({ length: count }, (_, i) => {
    const r = count === 1 ? 0 : spread * Math.sqrt((i + .5) / count);
    const a = i * golden + .6;
    const s = (.62 + ((i * 37) % 10) / 40) * grow;
    return { family: families[i % 3], x: Math.cos(a) * r, y: GROUND_Y - .03, z: Math.sin(a) * r, sx: 3.45 * s, sy: 5.1 * s, sz: 3.45 * s, rotation: i * 1.7 };
  }), false, true);
}

function wallArc(parent: THREE.Group, level: number) {
  const radius = 9, span = 1.9, segments = 7;
  const g = new THREE.Group();
  g.position.z = -radius + 2.5;
  for (let i = 0; i < segments; i++) {
    const a = -span / 2 + (span * (i + .5)) / segments;
    const x = Math.sin(a) * radius, z = Math.cos(a) * radius;
    const gate = i === (segments >> 1);
    if (level === 1) {
      // A timber palisade comes first.
      if (!gate) prop(g, 'Fence_A', x, z, a, [(span * radius) / segments / 2.4, 2.7, 2]);
      continue;
    }
    if (gate) continue;
    box(g, MAT.stone, (span * radius) / segments + .12, 2.6, 1.3, x, GROUND_Y + 1.3, z, a);
    if (level >= 5) for (const k of [-.3, .3]) box(g, MAT.stoneDark, .5, .5, 1.35, x + Math.cos(a) * k * 2, GROUND_Y + 2.85, z - Math.sin(a) * k * 2, a);
  }
  // Gate posts and lintel.
  const gx = 0, gz = radius;
  const postMat = level === 1 ? MAT.woodDark : MAT.stoneDark;
  for (const side of [-1.35, 1.35]) box(g, postMat, .8, level === 1 ? 3 : 3.6, 1.6, gx + side, GROUND_Y + (level === 1 ? 1.5 : 1.8), gz);
  box(g, level === 1 ? MAT.wood : MAT.stone, 3.5, .7, 1.7, gx, GROUND_Y + (level === 1 ? 3.1 : 3.8), gz);
  if (level >= 2) box(g, MAT.woodDark, 1.9, 2.5, .25, gx, GROUND_Y + 1.25, gz - .3);
  if (level >= 4) {
    // Watch towers at both ends.
    for (const a of [-span / 2 - .05, span / 2 + .05]) {
      const x = Math.sin(a) * radius, z = Math.cos(a) * radius;
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.45, 4.4, 8), MAT.stone);
      tower.position.set(x, GROUND_Y + 2.2, z);
      tower.castShadow = tower.receiveShadow = true;
      g.add(tower);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(1.75, 1.9, 8), level >= 6 ? MAT.roofBlue : MAT.roof);
      roof.position.set(x, GROUND_Y + 5.35, z);
      roof.castShadow = true;
      g.add(roof);
    }
  }
  if (level >= 7) {
    for (const side of [-1.35, 1.35]) {
      box(g, MAT.woodDark, .12, 1.8, .12, gx + side, GROUND_Y + 4.9, gz);
      box(g, level >= 8 ? MAT.gold : MAT.red, .75, .95, .06, gx + side + .42, GROUND_Y + 5.3, gz);
    }
  }
  parent.add(g);
}

export interface IconScene { group: THREE.Group; tileRadius: number; }

export function buildIdeaScene(idea: Idea, level: number): IconScene {
  const group = new THREE.Group();
  let tileRadius = 7;
  const add = (object: THREE.Object3D) => { group.add(object); return object; };
  switch (idea) {
    case 'settlers': {
      add(gameCottageBuilding(plot('home-2', 'home', level, { variant: 2 }), false));
      if (level >= 4) prop(group, 'Barrel_A', 3.2, 2.4, .4);
      if (level >= 5) prop(group, 'Logpile_A', -3.4, 2.1, -.5);
      tileRadius = 6.2;
      break;
    }
    case 'workshop': add(civicBuilding(plot('forge', 'forge', regular(level)), false)); tileRadius = 7.4; break;
    case 'market': add(civicBuilding(plot('market', 'market', regular(level)), false)); tileRadius = 7.4; break;
    case 'archive': add(civicBuilding(plot('post', 'post', tiered(level, [4, 5, 6])), false)); tileRadius = 7.6; break;
    case 'windmill': {
      add(civicBuilding(plot('mill', 'mill', tiered(level, [4, 5, 6])), false, true));
      if (level >= 2) {
        const rotor = millRotor(false);
        rotor.position.set(MILL_ROTOR_SOCKET.x, GROUND_Y + MILL_ROTOR_SOCKET.y, MILL_ROTOR_SOCKET.z);
        rotor.rotation.z = .35;
        add(rotor);
      }
      tileRadius = 6.6;
      break;
    }
    case 'observatory': {
      add(authoredLandmarkBuilding(plot('project-wizard', 'project', tiered(level, [3, 4, 6]), { project: 'wizard' as ProjectKey }), false));
      tileRadius = 8;
      break;
    }
    case 'grove': trees(group, level, 1.2 + level * .55, .75 + level * .05); tileRadius = 6.4; break;
    case 'walls': wallArc(group, level); tileRadius = 7.6; break;
    case 'river': {
      tileRadius = 6.6;
      const dir = .55, len = tileRadius * 1.92;
      channel(group, len, 2.1, level >= 2, dir);
      if (level === 1) for (const [x, z] of [[-1.7, -3.2], [1.7, -3.2], [-1.7, 0], [1.7, 0], [-1.7, 3.2], [1.7, 3.2]]) {
        box(group, MAT.woodLight, .2, 1.1, .2, x * Math.cos(dir) + z * Math.sin(dir), GROUND_Y + .55, -x * Math.sin(dir) + z * Math.cos(dir));
      }
      if (level >= 3) {
        // The waterworks sluice: stone piers and a timber gate across the flow.
        const g = new THREE.Group();
        g.rotation.y = dir;
        for (const side of [-1.55, 1.55]) box(g, MAT.stone, .9, 1.9, 1.3, side, GROUND_Y + .95, 0);
        box(g, MAT.woodDark, 2.3, level >= 5 ? .9 : 1.3, .25, 0, GROUND_Y + (level >= 5 ? 1.25 : .75), 0);
        box(g, MAT.wood, 4.2, .3, .6, 0, GROUND_Y + 2.05, 0);
        if (level >= 4) for (const z of [-4.2, 4.2]) for (const side of [-1.5, 1.5]) box(g, MAT.stoneDark, .5, .5, 2.2, side, GROUND_Y + .25, z);
        if (level >= 6) { box(g, MAT.woodDark, .18, 1.4, .18, 2.2, GROUND_Y + 2.7, 0); box(g, MAT.blue, .6, .45, .05, 2.52, GROUND_Y + 3.1, 0); }
        group.add(g);
      }
      if (level >= 7) addNatureInstances(group, [[-3.8, 2.6], [3.6, -2.2], [-2.4, -4]].map(([x, z], i) => ({ family: 'Shrub_A' as const, x, y: GROUND_Y, z, sx: 1.4, sy: 1.4, sz: 1.4, rotation: i })), false, true);
      break;
    }
    case 'roads': {
      tileRadius = 6.6;
      const flow = -.45;
      channel(group, tileRadius * 1.92, 2.6, true, flow);
      // The road crosses the stream at right angles.
      const road = flow + Math.PI / 2;
      const along = (d: number, side = 0) => ({ x: Math.sin(road) * d + Math.cos(road) * side, z: Math.cos(road) * d - Math.sin(road) * side });
      if (level >= 2) {
        const bridge = riverAsset('bridge');
        const b = new THREE.Box3().setFromObject(bridge), size = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
        const long = Math.max(size.x, size.z), scale = 7 / long;
        bridge.position.set(-c.x, -b.min.y, -c.z);
        const holder = new THREE.Group();
        holder.add(bridge);
        holder.scale.setScalar(scale);
        holder.position.y = GROUND_Y - .05;
        holder.rotation.y = road + (size.x > size.z ? Math.PI / 2 : 0);
        group.add(holder);
      }
      const stones = [];
      for (const side of [-1, 1]) for (let i = 0; i < (level >= 4 ? 3 : 2); i++) {
        const p = along(side * (level >= 2 ? 4.1 + i * 1.05 : 1.9 + i * 1.3), (i % 2 ? .35 : -.35));
        stones.push({ family: 'Rock_Path' as const, x: p.x, y: GROUND_Y, z: p.z, sx: 1.25, sy: 1, sz: 1.25, rotation: i + side });
      }
      addNatureInstances(group, stones, false, true);
      if (level >= 3) placeLanterns(group, [along(3.9, 1.6), along(-3.9, -1.6)].map(p => ({ ...p, y: GROUND_Y })), false);
      if (level >= 6) for (const side of [-1, 1]) { const p = along(side * 5.4, side * 1.9); prop(group, side > 0 ? 'Crate_A' : 'Barrel_A', p.x, p.z, road); }
      break;
    }
  }
  group.traverse(object => { if ((object as THREE.Mesh).isMesh) { object.castShadow = true; object.receiveShadow = true; } });
  return { group, tileRadius };
}

/** A low-poly island tile: grass top, earth sides. */
export function groundTile(radius: number): THREE.Group {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * .97, .5, 14), MAT.grass);
  top.position.y = GROUND_Y - .25;
  top.receiveShadow = true;
  const side = new THREE.Mesh(new THREE.CylinderGeometry(radius * .97, radius * .8, 1.3, 14), MAT.earth);
  side.position.y = GROUND_Y - .5 - .65;
  side.receiveShadow = true;
  g.add(top, side);
  return g;
}
