import { PLOTS } from './town-plan';
import { MILL_SITE } from './windmill-layout';

export const VALLEY_FLOOR = .48;
export const MOUNT_HEIGHT = 16;
export const MOUNT_RADIUS = 43;
const smooth = (a: number, b: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** The mount is geology: it exists before the first choice and never moves
 * under a building or walker. Progression adds worked stone and cultivation. */
export function mountProfile(x: number, z: number): number {
  const r = Math.hypot(x,z);
  const escarpment = 2.3*smooth(10.2,12.2,r)*(1-smooth(13.5,19,r));
  const approach = smooth(3.5,5.5,Math.min(Math.abs(x),Math.abs(z)));
  return MOUNT_HEIGHT*(1-smooth(11,MOUNT_RADIUS,r))-escarpment*approach;
}

const shelves = PLOTS.filter(p => Math.hypot(p.x, p.z) < 35).map(p => ({
  x: p.x, z: p.z, y: mountProfile(p.x, p.z),
  hx: p.kind === 'castle' ? 7 : p.kind === 'project' ? 5.5 : p.kind === 'home' ? 3.7 : 3.8,
  hz: p.kind === 'castle' ? 6.5 : p.kind === 'project' ? 5.2 : p.kind === 'home' ? 3.5 : 3.8,
}));

/** Small natural building shelves blend into the mount. Cardinal approaches
 * retain a smooth grade; fixed X/Z plots and wall entrances remain connected. */
export function mountHeight(x: number, z: number): number {
  if (Math.hypot(x, z) >= MOUNT_RADIUS) return 0;
  const profile = mountProfile(x, z);
  let weightSum = 0, weightedHeight = 0, influence = 0;
  for (const shelf of shelves) {
    const distance = Math.max(Math.abs(x-shelf.x)/shelf.hx, Math.abs(z-shelf.z)/shelf.hz);
    const blend = 1-smooth(.8, 1.8, distance);
    const weight = blend ** 8;
    weightedHeight += shelf.y * weight;
    weightSum += weight;
    influence = Math.max(influence, blend);
  }
  // Blend all nearby shelves continuously; choosing the nearest shelf made
  // a cliff wherever two plots exchanged priority.
  const height = weightSum > 0 ? weightedHeight / weightSum : profile;
  const approach = smooth(3.5, 5.5, Math.min(Math.abs(x), Math.abs(z)));
  const wallApproach = smooth(.8, 3, Math.abs(Math.hypot(x, z) - 34));
  const millClearance = smooth(7.8, 11, Math.hypot(x-MILL_SITE.x,z-MILL_SITE.z));
  return (profile + (height-profile)*influence*approach*wallApproach*smooth(13,15,Math.hypot(x,z)))*millClearance;
}

export function valleyHeight(x: number, z: number): number {
  const outer = Math.max(0, Math.hypot(x, z) - 68);
  return VALLEY_FLOOR + outer * .048 + outer * outer * .00055 * (.72 + .28 * Math.sin(x * .075 + z * .034));
}

export function landHeight(x: number, z: number): number {
  return valleyHeight(x, z) + mountHeight(x, z);
}

/** Detail is concentrated on the inhabited mount, not the far backdrop. */
export const terrainGridDivisions=(mobile:boolean):number=>mobile?192:240;
export function terrainGridCoordinate(unit: number): number {
  const a = Math.abs(unit);
  return Math.sign(unit)*(a<=.65?a/.65*75:a<=.92?75+(a-.65)/.27*80:155+(a-.92)/.08*195);
}
