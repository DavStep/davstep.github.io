import type { Plot } from './model';
import { MILL_SITE } from './windmill-layout';

const MINUTE = 60_000;

// The settlement is a designed map with fixed sites and construction times.
const projectPlots: Plot[] = [
  { id: 'project-outpost', kind: 'project', project: 'outpost', x: -22, z: 7, start: 0, step: 4 * MINUTE, variant: 0 },
  { id: 'project-sandship', kind: 'project', project: 'sandship', x: 22, z: 9, start: 0, step: 4.2 * MINUTE, variant: 1 },
  { id: 'project-battle', kind: 'project', project: 'battle', x: 8, z: -23, start: 0, step: 4.4 * MINUTE, variant: 2 },
  { id: 'project-wizard', kind: 'project', project: 'wizard', x: -8, z: 23, start: 0, step: 4 * MINUTE, variant: 3 },
  { id: 'home-east-square', kind: 'home', x: 22, z: -13, start: 0, step: 4.3 * MINUTE, variant: 4 },
  { id: 'project-dwarves', kind: 'project', project: 'dwarves', x: -23, z: -15, start: 0, step: 4.5 * MINUTE, variant: 5 },
];

const civicPlots: Plot[] = [
  { id: 'castle', kind: 'castle', x: 0, z: 0, start: 0, step: 3.4 * MINUTE },
  { id: 'market', kind: 'market', x: -10, z: -7, start: 7 * MINUTE, step: 72_000 },
  { id: 'market-annex', kind: 'market', x: -14, z: -8, start: 9 * MINUTE, step: 75_000, variant: 1 },
  { id: 'tavern', kind: 'tavern', x: 14, z: 19, start: 10 * MINUTE, step: 90_000 },
  { id: 'inn', kind: 'tavern', x: 18, z: 21, start: 13 * MINUTE, step: 90_000, variant: 1 },
  { id: 'forge', kind: 'forge', x: -12, z: -23, start: 11 * MINUTE, step: 80_000 },
  { id: 'workshop', kind: 'forge', x: -17, z: -24, start: 14 * MINUTE, step: 80_000, variant: 1 },
  { id: 'mill', kind: 'mill', ...MILL_SITE, start: 14 * MINUTE, step: 95_000 },
  { id: 'guild', kind: 'guild', x: 10, z: 28, start: 18 * MINUTE, step: 90_000 },
  { id: 'post', kind: 'post', x: 10, z: -8, start: 4 * MINUTE, step: 75_000 },
];

const innerHomes: [number, number][] = [[-17,15],[-23,-5],[-12,7],[-6,-15],[7,-15],[18,-5.5],[13,5],[7,13],[5.8,21],[-14,-17]];
const outerHomes: [number, number][] = [
  [-39,5],[-40,12],[-39,-11],[-34,24],[-33,-24],[-27,34],[-24,-35],[-13,39],[-11,-42],
  [7,41],[7,-42],[15,38],[15,-40],[28,32],[28,-33],[39,17],[40,-16],[43,7],
];
const homes: Plot[] = [...innerHomes, ...outerHomes].map(([x,z], i) => ({
  id: `home-${i}`, kind: 'home', x, z,
  start: i < 5 ? -155_000 + i * 16_000 : i < innerHomes.length ? i * 52_000 - 110_000 : 12 * MINUTE + (i - innerHomes.length) * 38_000,
  step: 38_000 + (i % 3) * 8_000, variant: i % 4,
}));

export const PLOTS: readonly Plot[] = [...projectPlots, ...civicPlots, ...homes];

export const INFRASTRUCTURE = {
  squareRadius: 7.8,
  road: {
    summitRadius: 11.8,
    spokeLength: 55,
    ringRadius: 31.5,
    ringSegments: 40,
    stoneStart: 45_000,
    stoneStep: 28_000,
    outerRingRadius: 52,
    outerRingSegments: 48,
    outerRingStart: 9 * MINUTE,
    outerRingStep: 3_750,
  },
  wall: {
    innerRadius: 34,
    outerRadius: 55,
    segments: 32,
    gateInterval: 8,
    innerWoodStart: 3 * MINUTE,
    innerWoodStep: 7_500,
    innerStoneStart: 11 * MINUTE,
    innerStoneStep: 9_000,
    outerWoodStart: 17 * MINUTE,
    outerWoodStep: 11_000,
  },
  lamps: { radius: 30, count: 24 },
  residentRoutes: { innerRadius: 31, outerRadius: 52 },
} as const;

export const MERGES: readonly { id: string; children: [string,string]; at: number }[] = [
  { id: 'courtyard-west', children: ['home-10','home-11'], at: 32 * MINUTE },
  { id: 'market-hall', children: ['market','market-annex'], at: 35 * MINUTE },
  { id: 'artisan-yard', children: ['forge','workshop'], at: 39 * MINUTE },
  { id: 'grand-inn', children: ['tavern','inn'], at: 43 * MINUTE },
  { id: 'courtyard-east', children: ['home-5','home-6'], at: 48 * MINUTE },
];

export const MILESTONES = [
  { at: 3 * MINUTE, label: 'The first new homes are taking shape.' },
  { at: 7 * MINUTE, label: 'A timber wall now guards the settlement.' },
  { at: 12 * MINUTE, label: 'Market stalls have gathered around the square.' },
  { at: 16 * MINUTE, label: 'The inner wall has become stone.' },
  { at: 23 * MINUTE, label: 'A second wall circles the growing town.' },
  { at: 28 * MINUTE, label: 'The town hall has grown into a castle.' },
];

export function accessPathFor(plot: Plot): { x1: number; z1: number; x2: number; z2: number } | null {
  if (plot.kind === 'castle') return null;
  const { x, z } = plot;
  const radius = Math.hypot(x, z);
  // Approach the front door from the outer road without cutting through the grain sheds.
  if (plot.kind === 'mill') {
    const entranceZ = z + 3.4;
    return { x1: x, z1: entranceZ, x2: Math.sqrt(INFRASTRUCTURE.road.outerRingRadius ** 2 - entranceZ ** 2), z2: entranceZ };
  }
  // These closely spaced homes use the other approach to keep paths clear.
  if (plot.id === 'home-1') return { x1: x, z1: z, x2: x * INFRASTRUCTURE.road.ringRadius / radius, z2: z * INFRASTRUCTURE.road.ringRadius / radius };
  if (plot.id === 'home-3') return { x1: x, z1: z, x2: x, z2: 0 };
  if (plot.id === 'home-5') return { x1: x, z1: z, x2: x * INFRASTRUCTURE.road.ringRadius / radius, z2: z * INFRASTRUCTURE.road.ringRadius / radius };
  if (plot.id === 'home-7') return { x1: x, z1: z, x2: 0, z2: z };
  const ringRadius = radius > INFRASTRUCTURE.wall.innerRadius
    ? INFRASTRUCTURE.road.outerRingRadius : INFRASTRUCTURE.road.ringRadius;
  const ringGap = Math.abs(radius - ringRadius);
  if (radius <= INFRASTRUCTURE.wall.innerRadius && Math.min(Math.abs(x), Math.abs(z)) < ringGap) {
    return Math.abs(x) < Math.abs(z)
      ? { x1: x, z1: z, x2: 0, z2: z }
      : { x1: x, z1: z, x2: x, z2: 0 };
  }
  return { x1: x, z1: z, x2: x * ringRadius / radius, z2: z * ringRadius / radius };
}


/** Reserve the mill's approach and its outer farm lane when scattering scenery. */
export function millAccessDistance(x: number, z: number): number {
  const path = accessPathFor(PLOTS.find(plot => plot.id === 'mill')!)!;
  const dx = path.x2 - path.x1, dz = path.z2 - path.z1;
  const t = Math.max(0, Math.min(1, ((x-path.x1)*dx + (z-path.z1)*dz)/(dx*dx+dz*dz)));
  const straight = Math.hypot(x-path.x1-dx*t, z-path.z1-dz*t);
  const angle = Math.atan2(z, x), startAngle = Math.atan2(path.z2, path.x2);
  return angle >= startAngle && angle <= 0
    ? Math.min(straight, Math.abs(Math.hypot(x,z)-INFRASTRUCTURE.road.outerRingRadius)) : straight;
}
