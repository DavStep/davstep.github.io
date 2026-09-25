import * as THREE from 'three';
import { INFRASTRUCTURE } from './town-plan';
import { terrainHeight } from './environment';
import residentData from './generated/residents.json';

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
export const bodyGeometry = meshGeometry(residentData.body);
export const limbGeometries = {
  arm_left: meshGeometry(residentData.parts.arm_left),
  arm_right: meshGeometry(residentData.parts.arm_right),
  leg_left: meshGeometry(residentData.parts.leg_left),
  leg_right: meshGeometry(residentData.parts.leg_right),
};
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
