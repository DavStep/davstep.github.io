import * as THREE from 'three';
import { PLOTS, type TownSnapshot } from './model';
import { INFRASTRUCTURE } from './town-plan';
import type { Idea } from './game';
import { terrainHeight } from './environment';
import residentData from './generated/residents.json';
import pickaxeData from './generated/resident-pickaxe.json';

interface Node { x: number; z: number; links: number[] }
// All three rings use the same geometry as the visible roads. There is no
// center node inside the castle: residents walk around its summit apron.
const nodes: Node[] = [];
for(const radius of [INFRASTRUCTURE.road.summitRadius,INFRASTRUCTURE.road.ringRadius,INFRASTRUCTURE.road.outerRingRadius]){
  const offset=nodes.length;
  for(let i=0;i<16;i++){
    const a=i*Math.PI*2/16;
    nodes.push({x:Math.cos(a)*radius,z:Math.sin(a)*radius,links:[offset+(i+15)%16,offset+(i+1)%16]});
    if(offset&&i%4===0){nodes[offset+i].links.push(offset-16+i);nodes[offset-16+i].links.push(offset+i);}
  }
}
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
    mid=[];
    for(let j=0;j<path.length;j++){
      const node=nodes[path[j]],previous=j?nodes[path[j-1]]:null;
      const radius=Math.hypot(node.x,node.z);
      if(previous&&Math.abs(Math.hypot(previous.x,previous.z)-radius)<.01){
        const a=Math.atan2(previous.z,previous.x),b=Math.atan2(node.z,node.x);
        const sweep=Math.atan2(Math.sin(b-a),Math.cos(b-a));
        for(let k=1;k<5;k++){const angle=a+sweep*k/5,x=Math.cos(angle)*radius,z=Math.sin(angle)*radius;mid.push(new THREE.Vector3(x,terrainHeight(x,z)+.1,z));}
      }
      mid.push(new THREE.Vector3(node.x,terrainHeight(node.x,node.z)+.1,node.z));
    }
    routeCache.set(key, mid);
  }
  return [new THREE.Vector3(a.x, terrainHeight(a.x,a.z)+.1, a.z), ...mid, new THREE.Vector3(b.x, terrainHeight(b.x,b.z)+.1, b.z)];
}

type ResidentGeometry = { positions: number[]; normals?: number[]; indices: number[] };
const meshGeometry = (data: ResidentGeometry) => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
  geometry.setIndex(data.indices);
  if (data.normals) geometry.setAttribute('normal', new THREE.Float32BufferAttribute(data.normals, 3));
  else geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
};
if (residentData.version !== 3 || residentData.coordinates !== 'three-y-up') throw new Error('Unsupported resident geometry');
if (pickaxeData.version !== 1 || pickaxeData.coordinates !== 'three-y-up') throw new Error('Unsupported resident pickaxe geometry');
const bodyGeometry = meshGeometry(residentData.body);
const limbGeometries = {
  arm_left: meshGeometry(residentData.parts.arm_left),
  arm_right: meshGeometry(residentData.parts.arm_right),
  leg_left: meshGeometry(residentData.parts.leg_left),
  leg_right: meshGeometry(residentData.parts.leg_right),
};
type LimbName = keyof typeof limbGeometries;
const bodyMaterials = [0xf0dc8b, 0xa8ceb8, 0xe4a69e, 0xb6b6d5, 0xe3b98c, 0x94c4cc]
  .map(color => new THREE.MeshStandardMaterial({ color, roughness: .9 }));
const shadowMaterial = new THREE.MeshBasicMaterial({ color: 0x42696a, transparent: true, opacity: .15, depthWrite: false });
const shadowGeometry = new THREE.CircleGeometry(.43, 12);
const pickaxeGeometry = (name: string) => {
  const part = pickaxeData.parts.find(item => item.name === name);
  if (!part) throw new Error(`Missing pickaxe part: ${name}`);
  return meshGeometry(part);
};
const pickHandleGeometry = pickaxeGeometry('handle');
const pickSocketGeometry = pickaxeGeometry('socket');
const pickHeadGeometry = pickaxeGeometry('head');
const pickHandleMaterial = new THREE.MeshStandardMaterial({ color: 0x75543a, roughness: .9 });
const pickHeadMaterial = new THREE.MeshStandardMaterial({ color: 0x697d80, metalness: .25, roughness: .65 });
const ease = (n: number) => { const x = THREE.MathUtils.clamp(n, 0, 1); return x * x * (3 - 2 * x); };
function routeLength(path: THREE.Vector3[]): number {
  let length = 0; for (let i = 1; i < path.length; i++) length += path[i - 1].distanceTo(path[i]);
  return length;
}
function sampleRoute(path: THREE.Vector3[], progress: number, length: number): THREE.Vector3 {
  let left = progress * length;
  for (let i = 1; i < path.length; i++) { const segment = path[i - 1].distanceTo(path[i]); if (left <= segment) return path[i - 1].clone().lerp(path[i], segment ? left / segment : 0); left -= segment; }
  return path[path.length - 1].clone();
}

interface Figure {
  root: THREE.Group;
  body: THREE.Group;
  arms: [THREE.Group, THREE.Group];
  legs: [THREE.Group, THREE.Group];
  pickaxe: THREE.Group;
  home: THREE.Vector3;
  work: THREE.Vector3;
  path: THREE.Vector3[];
  pathLength: number;
  gaitCycles: number;
}
interface Cue { target: THREE.Vector3; failed: boolean; started: number; duration: number; origins: THREE.Vector3[]; spots: THREE.Vector3[]; crewCount: number }

type WorkPoint = { x: number; z: number };
export interface WorkRoute { origin: WorkPoint; spot: WorkPoint }

/** Keep the entire approach outside the completed structure and nearby obstacles. */
export function planConstructionCrew(target: WorkPoint, count: number, isClear: (x: number, z: number) => boolean): WorkRoute[] {
  const routes: WorkRoute[] = [];
  const facing = Math.atan2(-target.z, -target.x);
  const radii = [2.5, 3.5, 4.5, 5.5, 7, 8.5, 10, 12, 14, 17, 20];
  for (let i = 0; i < count; i++) {
    const preferred = facing + (i - (count - 1) / 2) * .78;
    let found = false;
    for (const radius of radii) {
      for (let turn = 0; turn < 32; turn++) {
        const angle = preferred + (turn % 2 ? -1 : 1) * Math.ceil(turn / 2) * Math.PI / 16;
        const dx = Math.cos(angle), dz = Math.sin(angle);
        const spot = { x: target.x + dx * radius, z: target.z + dz * radius };
        if (routes.some(route => Math.hypot(route.spot.x - spot.x, route.spot.z - spot.z) < 2.5)) continue;
        if (!isClear(spot.x, spot.z)) continue;
        const origin = { x: spot.x + dx * 3.6, z: spot.z + dz * 3.6 };
        let safe = true;
        for (let step = 1; step <= 8; step++) {
          const fraction = step / 8;
          if (!isClear(spot.x + (origin.x - spot.x) * fraction, spot.z + (origin.z - spot.z) * fraction)) { safe = false; break; }
        }
        if (!safe) continue;
        routes.push({ origin, spot });
        found = true;
        break;
      }
      if (found) break;
    }
  }
  return routes;
}

/** Simple Blender-authored figures with touching, rounded parts. */
export class Residents {
  readonly group = new THREE.Group();
  private readonly figures: Figure[] = [];
  private readonly capacity = matchMedia('(max-width: 700px)').matches ? 10 : 17;
  private cue: Cue | null = null;
  private crewExitUntil = 0;

  constructor(scene: THREE.Scene) {
    const homes = PLOTS.filter(plot => plot.kind === 'home');
    const jobs = PLOTS.filter(plot => ['project', 'market', 'forge', 'post', 'tavern'].includes(plot.kind));
    for (let i = 0; i < this.capacity; i++) {
      const root = new THREE.Group(), body = new THREE.Group();
      const material = bodyMaterials[i % bodyMaterials.length];
      const figure = new THREE.Mesh(bodyGeometry, material);
      figure.castShadow = true;
      body.add(figure);
      const limb = (name: LimbName): THREE.Group => {
        const group = new THREE.Group();
        const [x, y, z] = residentData.parts[name].pivot;
        group.position.set(x, y, z);
        const mesh = new THREE.Mesh(limbGeometries[name], material);
        mesh.castShadow = true;
        group.add(mesh);
        body.add(group);
        return group;
      };
      const arms: [THREE.Group, THREE.Group] = [limb('arm_left'), limb('arm_right')];
      const legs: [THREE.Group, THREE.Group] = [limb('leg_left'), limb('leg_right')];
      const pickaxe = new THREE.Group();
      for (const [geometry, pickMaterial] of [
        [pickHandleGeometry, pickHandleMaterial],
        [pickSocketGeometry, pickHeadMaterial],
        [pickHeadGeometry, pickHeadMaterial],
      ] as const) {
        const mesh = new THREE.Mesh(geometry, pickMaterial);
        mesh.position.y = -.43;
        mesh.castShadow = true;
        pickaxe.add(mesh);
      }
      pickaxe.position.set(.60, .25, .14);
      pickaxe.visible = false;
      arms[1].add(pickaxe);
      root.add(body);
      const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
      shadow.rotation.x = -Math.PI / 2; shadow.position.y = .035; root.add(shadow);
      const home = homes[(i * 5) % homes.length], job = jobs[(i * 3 + 2) % jobs.length];
      const homePoint = new THREE.Vector3(home.x, 0, home.z), workPoint = new THREE.Vector3(job.x, 0, job.z);
      const path = routeBetween(homePoint, workPoint), pathLength = routeLength(path);
      const gaitCycles = Math.round(THREE.MathUtils.clamp(pathLength / 5, 10, 20));
      this.figures.push({ root, body, arms, legs, pickaxe, home: homePoint, work: workPoint, path, pathLength, gaitCycles });
      this.group.add(root);
    }
    scene.add(this.group);
  }

  startCue(_idea: Idea, target: WorkPoint, failed: boolean, duration = 8, isClear: (x: number, z: number) => boolean = () => true): void {
    const routes = planConstructionCrew(target, Math.min(this.capacity,4), isClear);
    const origins = routes.map(({ origin }) => new THREE.Vector3(origin.x, 0, origin.z));
    const spots = routes.map(({ spot }) => new THREE.Vector3(spot.x, 0, spot.z));
    const crewCount = routes.length;
    this.cue={target:new THREE.Vector3(target.x,0,target.z),failed,started:performance.now()/1000,duration,origins,spots,crewCount};
    this.crewExitUntil=0;
  }

  finishCue(): void {
    if(this.cue)this.crewExitUntil=performance.now()/1000+.32;
    this.cue=null;
  }

  update(snapshot: TownSnapshot): void {
    const seconds = performance.now() / 1000;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const count = Math.min(this.capacity, snapshot.residents);
    this.figures.forEach((figure, i) => {
      const starring = this.cue !== null && i < this.cue.crewCount;
      figure.root.visible = (i < count || starring) && !(this.cue===null&&i<4&&seconds<this.crewExitUntil);
      if (!figure.root.visible) return;
      let x: number, z: number, walk = 0, gaitPhase = 0, toolPitch = .12, windup = 0, impact = 0, failed = false;
      if (starring) {
        const cue = this.cue!;
        const elapsed=seconds-cue.started;
        const approach=THREE.MathUtils.clamp((elapsed-i*.12)/.9,0,1);
        const travel=ease(approach);
        x=THREE.MathUtils.lerp(cue.origins[i].x,cue.spots[i].x,travel);
        z=THREE.MathUtils.lerp(cue.origins[i].z,cue.spots[i].z,travel);
        walk=4*approach*(1-approach);
        gaitPhase=travel*Math.PI*4;
        const workElapsed=elapsed-i*.12-.9;
        if(workElapsed>=0&&elapsed<cue.duration&&!cue.failed){
          const strike=(workElapsed/1.08+i*.18)%1;
          if(strike<.38){
            windup=ease(strike/.38);
            toolPitch=.12-.4*windup;
          }
          else if(strike<.57){
            const down=ease((strike-.38)/.19);
            windup=1-down;
            toolPitch=-.28+1.1*down;
            impact=Math.sin(down*Math.PI)*.35+down*.65;
          }else if(strike<.8){
            const recover=ease((strike-.57)/.23);
            toolPitch=.82-.7*recover;
            impact=1-recover;
          }
        }
        failed=cue.failed;
        const facing=travel<1?cue.spots[i].clone().sub(cue.origins[i]):cue.target.clone().sub(cue.spots[i]);
        figure.root.rotation.y=Math.atan2(facing.x,facing.z);
      } else {
        const phase = (seconds * .028 + i * .17) % 1;
        const outward=phase<.39, returning=phase>=.55&&phase<.94;
        const legProgress=outward?phase/.39:returning?(phase-.55)/.39:0;
        const move = outward ? ease(legProgress) : phase < .55 ? 1 : returning ? 1 - ease(legProgress) : 0;
        const point = sampleRoute(figure.path, move, figure.pathLength);
        x = point.x; z = point.z;
        walk=(outward||returning)?4*legProgress*(1-legProgress):0;
        gaitPhase=(outward?move:returning?2-move:phase<.55?1:2)*figure.gaitCycles*Math.PI*2;
        if(outward||returning){
          const before=sampleRoute(figure.path,Math.max(0,move-.003),figure.pathLength);
          const after=sampleRoute(figure.path,Math.min(1,move+.003),figure.pathLength);
          const direction=returning?-1:1,dx=(after.x-before.x)*direction,dz=(after.z-before.z)*direction;
          if(dx*dx+dz*dz>.000001)figure.root.rotation.y=Math.atan2(dx,dz);
        }
      }
      const step=Math.sin(gaitPhase);
      figure.root.position.set(x,terrainHeight(x,z),z);
      figure.body.scale.y=1;
      figure.body.rotation.z=reduced?0:failed?Math.sin(seconds*8+i)*.08:(1-walk)*Math.sin(seconds*2.4+i)*.025-impact*.06;
      figure.body.rotation.x=reduced?0:failed?-.08:impact*.26;
      figure.arms[0].rotation.x = reduced ? 0 : -step*walk*.45;
      figure.arms[1].rotation.x = starring ? reduced ? 0 : -2.6*windup-1.1*impact : reduced ? 0 : step*walk*.45;
      figure.arms[0].rotation.y = 0;
      figure.arms[1].rotation.y = starring ? -.12-impact*.2 : 0;
      figure.arms[0].rotation.z = 1.85;
      const rightArmAngle=starring?-1.55:-1.85;
      figure.arms[1].rotation.z = rightArmAngle;
      const leftStep=reduced?0:-step*walk*.52,rightStep=-leftStep;
      figure.legs[0].rotation.x=leftStep;
      figure.legs[1].rotation.x=rightStep;
      figure.legs[0].position.y=residentData.parts.leg_left.pivot[1]-.72*(1-Math.cos(leftStep))+(reduced?0:Math.max(0,step)*walk*.12);
      figure.legs[1].position.y=residentData.parts.leg_right.pivot[1]-.72*(1-Math.cos(rightStep))+(reduced?0:Math.max(0,-step)*walk*.12);
      figure.pickaxe.visible=starring;
      // Keep the tool above the hand on the lift, then point its tip forward on impact.
      figure.pickaxe.rotation.set(starring&&!reduced?toolPitch:.12,starring?-.25-impact*.8:0,starring?1.55-3.1*windup-2.25*impact:0);
    });
  }

  dispose(): void {
    this.group.removeFromParent();
    this.group.clear();
  }
}
