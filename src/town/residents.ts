import * as THREE from 'three';
import { PLOTS, type TownSnapshot } from './model';
import { INFRASTRUCTURE } from './town-plan';
import type { Idea } from './game';
import { terrainHeight } from './environment';

interface Node { x: number; z: number; links: number[] }
const nodes: Node[] = [{ x: 0, z: 0, links: [] }];
for (let i = 0; i < 12; i++) { const a = i * Math.PI * 2 / 12; nodes.push({ x: Math.cos(a) * INFRASTRUCTURE.residentRoutes.innerRadius, z: Math.sin(a) * INFRASTRUCTURE.residentRoutes.innerRadius, links: [] }); }
for (let i = 1; i <= 12; i++) { nodes[i].links.push(i === 1 ? 12 : i - 1, i === 12 ? 1 : i + 1); if (i % 3 === 1) { nodes[i].links.push(0); nodes[0].links.push(i); } }
for (let i = 0; i < 16; i++) { const a = i * Math.PI * 2 / 16; nodes.push({ x: Math.cos(a) * INFRASTRUCTURE.residentRoutes.outerRadius, z: Math.sin(a) * INFRASTRUCTURE.residentRoutes.outerRadius, links: [] }); }
for (let i = 13; i <= 28; i++) { nodes[i].links.push(i === 13 ? 28 : i - 1, i === 28 ? 13 : i + 1); if ((i - 13) % 4 === 0) { const inner = 1 + Math.round((i - 13) / 16 * 12) % 12; nodes[i].links.push(inner); nodes[inner].links.push(i); } }
const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
function nearest(p: { x: number; z: number }) { let best = 0, d = Infinity; for (let i = 0; i < nodes.length; i++) { const q = dist(p, nodes[i]); if (q < d) { best = i; d = q; } } return best; }
const routeCache = new Map<string, THREE.Vector3[]>();
export function routeBetween(a: { x: number; z: number }, b: { x: number; z: number }): THREE.Vector3[] {
  const start = nearest(a), goal = nearest(b), key = `${start}:${goal}`;
  let mid = routeCache.get(key);
  if (!mid) {
    const costs = nodes.map(() => Infinity), prev = nodes.map(() => -1), remaining = new Set(nodes.map((_, i) => i)); costs[start] = 0;
    while (remaining.size) { let current = -1, min = Infinity; for (const i of remaining) if (costs[i] < min) { current = i; min = costs[i]; } if (current < 0 || current === goal) break; remaining.delete(current); for (const next of nodes[current].links) { const n = costs[current] + dist(nodes[current], nodes[next]); if (n < costs[next]) { costs[next] = n; prev[next] = current; } } }
    const path: number[] = []; let at = goal; while (at >= 0) { path.unshift(at); if (at === start) break; at = prev[at]; }
    mid = path.map(i => new THREE.Vector3(nodes[i].x, .58, nodes[i].z)); routeCache.set(key, mid);
  }
  return [new THREE.Vector3(a.x, .58, a.z), ...mid, new THREE.Vector3(b.x, .58, b.z)];
}

const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xf9f6e9, roughness: .92 });
const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x293b3d, roughness: .9 });
const shadowMaterial = new THREE.MeshBasicMaterial({ color: 0x42696a, transparent: true, opacity: .15, depthWrite: false });
const headGeometry = new THREE.SphereGeometry(1, 10, 8);
const torsoGeometry = new THREE.SphereGeometry(1, 8, 7);
const limbGeometry = new THREE.CylinderGeometry(1, 1, 1, 5);
const eyeGeometry = new THREE.SphereGeometry(1, 6, 5);
const badgeGeometry = new THREE.SphereGeometry(1, 6, 5);
const makeProp = (idea: Idea): THREE.Group => {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: markerColors[idea], roughness: .83 });
  const add = (geometry: THREE.BufferGeometry, position: [number, number, number], rotation?: [number, number, number]) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position); if (rotation) mesh.rotation.set(...rotation); group.add(mesh);
  };
  switch (idea) {
    case 'settlers': add(new THREE.SphereGeometry(.17, 7, 6), [0, 0, 0]); break;
    case 'grove':
      add(new THREE.CylinderGeometry(.035, .045, .46, 5), [0, .08, 0]);
      add(new THREE.ConeGeometry(.2, .36, 6), [0, .35, 0]); break;
    case 'workshop':
      add(new THREE.CylinderGeometry(.045, .045, .5, 6), [0, 0, 0]);
      add(new THREE.BoxGeometry(.35, .14, .15), [0, .23, 0]); break;
    case 'roads': add(new THREE.DodecahedronGeometry(.22, 0), [0, 0, 0]); break;
    case 'walls':
      add(new THREE.BoxGeometry(.42, .2, .16), [0, -.08, 0]);
      add(new THREE.BoxGeometry(.2, .2, .16), [0, .13, 0]); break;
    case 'market': add(new THREE.BoxGeometry(.4, .3, .34), [0, 0, 0]); break;
    case 'windmill':
      add(new THREE.TorusGeometry(.22, .07, 5, 8), [0, 0, 0]);
      add(new THREE.SphereGeometry(.07, 6, 5), [0, 0, 0]); break;
    case 'archive': add(new THREE.BoxGeometry(.37, .28, .035), [0, 0, 0]); break;
    case 'observatory': add(new THREE.IcosahedronGeometry(.23, 0), [0, 0, 0]); break;
  }
  group.position.set(.71, 1.02, .1);
  group.visible = false;
  return group;
};
const markerColors: Record<Idea, number> = {
  settlers: 0x8bbf80, grove: 0x66ad78, workshop: 0xe6aa68, roads: 0x9baabc, walls: 0x9d8c78,
  market: 0xe0bb70, windmill: 0x72bdbd, archive: 0xa593c3, observatory: 0xe4ca80,
};
const ease = (n: number) => { const x = THREE.MathUtils.clamp(n, 0, 1); return x * x * (3 - 2 * x); };
function sampleRoute(path: THREE.Vector3[], progress: number): THREE.Vector3 {
  let length = 0; for (let i = 1; i < path.length; i++) length += path[i - 1].distanceTo(path[i]);
  let left = progress * length;
  for (let i = 1; i < path.length; i++) { const segment = path[i - 1].distanceTo(path[i]); if (left <= segment) return path[i - 1].clone().lerp(path[i], segment ? left / segment : 0); left -= segment; }
  return path[path.length - 1].clone();
}

interface Figure {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  arms: [THREE.Group, THREE.Group];
  legs: [THREE.Group, THREE.Group];
  prop: THREE.Group;
  props: Record<Idea, THREE.Group>;
  badge: THREE.Mesh;
  home: THREE.Vector3;
  work: THREE.Vector3;
  path: THREE.Vector3[];
}
interface Cue { idea: Idea; target: THREE.Vector3; failed: boolean; started: number; duration: number; origin: THREE.Vector3 }

/** Small white figures with dot eyes. Their gestures carry the upgrade story. */
export class Residents {
  readonly group = new THREE.Group();
  private readonly figures: Figure[] = [];
  private readonly capacity = matchMedia('(max-width: 700px)').matches ? 10 : 17;
  private cue: Cue | null = null;

  constructor(scene: THREE.Scene) {
    const homes = PLOTS.filter(plot => plot.kind === 'home');
    const jobs = PLOTS.filter(plot => ['project', 'market', 'forge', 'post', 'tavern'].includes(plot.kind));
    for (let i = 0; i < this.capacity; i++) {
      const root = new THREE.Group(), body = new THREE.Group(), head = new THREE.Group();
      const sphere = (geo: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number) => {
        const mesh = new THREE.Mesh(geo, material); mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); return mesh;
      };
      const torso = sphere(torsoGeometry, bodyMaterial, 0, 1.15, 0, .38, .53, .29); torso.castShadow = true; body.add(torso);
      const face = sphere(headGeometry, bodyMaterial, 0, 2.03, .02, .49, .52, .45); face.castShadow = true; head.add(face);
      for (const x of [-.19, .19]) head.add(sphere(eyeGeometry, eyeMaterial, x, 2.07, .445, .048, .064, .028));
      const arms: [THREE.Group, THREE.Group] = [new THREE.Group(), new THREE.Group()];
      const legs: [THREE.Group, THREE.Group] = [new THREE.Group(), new THREE.Group()];
      for (const side of [-1, 1] as const) {
        const index = side === -1 ? 0 : 1;
        const arm = arms[index]; arm.position.set(side * .4, 1.43, 0);
        arm.add(sphere(limbGeometry, bodyMaterial, side * .08, -.31, 0, .09, .62, .09)); body.add(arm);
        const leg = legs[index]; leg.position.set(side * .18, .71, 0);
        leg.add(sphere(limbGeometry, bodyMaterial, 0, -.32, 0, .10, .66, .1)); body.add(leg);
      }
      const badge = sphere(badgeGeometry, new THREE.MeshStandardMaterial({ color: Object.values(markerColors)[i % 8], roughness: 1 }), 0, 1.45, .29, .095, .095, .04);
      body.add(badge);
      const props = Object.fromEntries((Object.keys(markerColors) as Idea[]).map(idea => [idea, makeProp(idea)])) as Record<Idea, THREE.Group>;
      for (const item of Object.values(props)) body.add(item);
      root.add(body, head);
      const shadow = new THREE.Mesh(new THREE.CircleGeometry(.43, 12), shadowMaterial);
      shadow.rotation.x = -Math.PI / 2; shadow.position.y = .035; root.add(shadow);
      const home = homes[(i * 5) % homes.length], job = jobs[(i * 3 + 2) % jobs.length];
      const homePoint = new THREE.Vector3(home.x, 0, home.z), workPoint = new THREE.Vector3(job.x, 0, job.z);
      this.figures.push({ root, body, head, arms, legs, prop: props.settlers, props, badge, home: homePoint, work: workPoint, path: routeBetween(homePoint, workPoint) });
      this.group.add(root);
    }
    scene.add(this.group);
  }

  startCue(idea: Idea, target: { x: number; z: number }, failed: boolean, duration = 1.7): void {
    const actor = this.figures[0];
    const direction = new THREE.Vector3(target.x, 0, target.z).normalize();
    const origin = new THREE.Vector3(target.x - direction.x * 4.5 - 2.5, 0, target.z - direction.z * 4.5 + 1.5);
    actor.root.position.copy(origin);
    this.cue = { idea, target: new THREE.Vector3(target.x, 0, target.z), failed, started: performance.now() / 1000, duration, origin };
    actor.prop.visible = false;
    actor.prop = actor.props[idea];
    actor.prop.visible = true;
    (actor.badge.material as THREE.MeshStandardMaterial).color.setHex(markerColors[idea]);
  }

  finishCue(): void { this.cue = null; this.figures[0].prop.visible = false; }

  update(snapshot: TownSnapshot): void {
    const seconds = performance.now() / 1000;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const count = Math.min(this.capacity, snapshot.residents);
    this.figures.forEach((figure, i) => {
      const starring = i === 0 && this.cue !== null;
      figure.root.visible = i < count || starring;
      if (!figure.root.visible) return;
      let x: number, z: number, walk = 0, gesture = 0, failed = false;
      if (starring) {
        const cue = this.cue!;
        const progress = THREE.MathUtils.clamp((seconds - cue.started) / cue.duration, 0, 1);
        const travel = ease(progress / .43);
        x = THREE.MathUtils.lerp(cue.origin.x, cue.target.x, travel);
        z = THREE.MathUtils.lerp(cue.origin.z, cue.target.z, travel);
        walk = progress < .43 ? 1 : 0;
        gesture = progress >= .43 ? Math.sin(Math.min(1, (progress - .43) / .57) * Math.PI) : 0;
        failed = cue.failed;
        figure.root.rotation.y = Math.atan2(cue.target.x - cue.origin.x, cue.target.z - cue.origin.z);
        figure.prop.visible = progress < .55;
      } else {
        const phase = (seconds * .028 + i * .17) % 1;
        const move = phase < .39 ? ease(phase / .39) : phase < .55 ? 1 : phase < .94 ? 1 - ease((phase - .55) / .39) : 0;
        const point = sampleRoute(figure.path, move);
        x = point.x; z = point.z;
        walk = phase < .39 || phase > .55 && phase < .94 ? 1 : 0;
        figure.root.rotation.y = phase > .55 ? Math.atan2(figure.home.x - figure.work.x, figure.home.z - figure.work.z) : Math.atan2(figure.work.x - figure.home.x, figure.work.z - figure.home.z);
        if (this.cue && i < 5) {
          const cueProgress = (seconds - this.cue.started) / this.cue.duration;
          gesture = cueProgress > .52 ? Math.sin(Math.min(1, (cueProgress - .52) / .48) * Math.PI) * .65 : 0;
        }
      }
      const stride = seconds * 13 + i;
      figure.root.position.set(x, terrainHeight(x, z) + (reduced ? 0 : walk * Math.abs(Math.sin(stride)) * .16), z);
      figure.body.scale.y = reduced ? 1 : 1 + (walk ? Math.sin(stride * 2) * .045 : Math.sin(seconds * 2.2 + i) * .025);
      figure.head.rotation.z = reduced ? 0 : failed ? Math.sin(seconds * 8) * .2 * gesture : Math.sin(seconds * 2.4 + i) * .06;
      figure.head.position.y = reduced ? 0 : gesture * (failed ? -.12 : .13);
      figure.arms[0].rotation.z = reduced ? 0 : failed ? -.7 * gesture : -gesture * 1.3 + walk * Math.sin(stride) * .45;
      figure.arms[1].rotation.z = reduced ? 0 : failed ? .7 * gesture : -gesture * 1.3 - walk * Math.sin(stride) * .45;
      figure.legs[0].rotation.x = reduced ? 0 : walk * Math.sin(stride) * .5;
      figure.legs[1].rotation.x = reduced ? 0 : -walk * Math.sin(stride) * .5;
    });
  }

  dispose(): void {
    this.group.removeFromParent();
    for (const figure of this.figures) {
      for (const prop of Object.values(figure.props)) {
        prop.traverse(object => { if (object instanceof THREE.Mesh) object.geometry.dispose(); });
        const first = prop.children[0]; if (first instanceof THREE.Mesh) (first.material as THREE.Material).dispose();
      }
      (figure.badge.material as THREE.Material).dispose();
    }
    this.group.clear();
  }
}
