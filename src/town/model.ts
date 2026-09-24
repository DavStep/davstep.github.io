import type { ProjectKey } from './projects';

export const TOWN_SAVE_KEY = 'davstep.town.v2';
export const MINUTE = 60_000;
export type PlotKind = 'home' | 'market' | 'tavern' | 'forge' | 'mill' | 'guild' | 'post' | 'project' | 'castle';
export interface Plot { id: string; kind: PlotKind; x: number; z: number; start: number; step: number; project?: ProjectKey; variant?: number; }
export interface PlotState extends Plot { stage: number; renovation: number; complexId?: string; }
export interface TownSave { version: 2; seed: number; createdAt: number; lastSeenAt: number; eventCursor: number; elapsedFloorMs: number; }
export interface TownSnapshot {
  elapsed: number;
  plots: PlotState[];
  innerWood: number;
  innerStone: number;
  outerWood: number;
  roads: number;
  phase: number;
  season: 'spring' | 'summer' | 'autumn' | 'winter';
  dayFraction: number;
  weather: 'clear' | 'cloudy' | 'rain';
  matureCycles: number;
  residents: number;
  buildings: number;
}

const projectPlots: Plot[] = [
  { id: 'project-outpost', kind: 'project', project: 'outpost', x: -22, z: 7, start: 0, step: 4 * MINUTE, variant: 0 },
  { id: 'project-sandship', kind: 'project', project: 'sandship', x: 22, z: 9, start: 0, step: 4.2 * MINUTE, variant: 1 },
  { id: 'project-battle', kind: 'project', project: 'battle', x: 8, z: -23, start: 0, step: 4.4 * MINUTE, variant: 2 },
  { id: 'project-wizard', kind: 'project', project: 'wizard', x: -8, z: 23, start: 0, step: 4 * MINUTE, variant: 3 },
  { id: 'project-shmixel', kind: 'project', project: 'shmixel', x: 24, z: -13, start: 0, step: 4.3 * MINUTE, variant: 4 },
  { id: 'project-dwarves', kind: 'project', project: 'dwarves', x: -25, z: -14, start: 0, step: 4.5 * MINUTE, variant: 5 },
];
const civicPlots: Plot[] = [
  { id: 'castle', kind: 'castle', x: 0, z: 0, start: 0, step: 3.4 * MINUTE },
  { id: 'market', kind: 'market', x: -10, z: -7, start: 7 * MINUTE, step: 72_000 },
  { id: 'market-annex', kind: 'market', x: -14, z: -8, start: 9 * MINUTE, step: 75_000, variant: 1 },
  { id: 'tavern', kind: 'tavern', x: 14, z: 19, start: 10 * MINUTE, step: 90_000 },
  { id: 'inn', kind: 'tavern', x: 18, z: 21, start: 13 * MINUTE, step: 90_000, variant: 1 },
  { id: 'forge', kind: 'forge', x: -12, z: -23, start: 11 * MINUTE, step: 80_000 },
  { id: 'workshop', kind: 'forge', x: -17, z: -24, start: 14 * MINUTE, step: 80_000, variant: 1 },
  { id: 'mill', kind: 'mill', x: 17, z: -30, start: 14 * MINUTE, step: 95_000 },
  { id: 'guild', kind: 'guild', x: 10, z: 28, start: 18 * MINUTE, step: 90_000 },
  { id: 'post', kind: 'post', x: 10, z: -8, start: 4 * MINUTE, step: 75_000 },
];
const innerHomes: [number, number][] = [[-16,16],[-17,-2],[-14,4],[-5,-14],[1,-15],[15,-5],[15,2],[15,10],[2,17],[-18,-17]];
const outerHomes: [number, number][] = [
  [-42,0],[-40,11],[-39,-11],[-34,24],[-33,-24],[-27,34],[-24,-35],[-13,39],[-11,-42],
  [1,41],[3,-42],[15,38],[15,-40],[28,32],[28,-33],[39,17],[40,-16],[43,2],
];
const homes: Plot[] = [...innerHomes, ...outerHomes].map(([x,z], i) => ({
  id: `home-${i}`, kind: 'home', x, z,
  start: i < 5 ? -155_000 + i * 16_000 : i < innerHomes.length ? i * 52_000 - 110_000 : 12 * MINUTE + (i - innerHomes.length) * 38_000,
  step: 38_000 + (i % 3) * 8_000, variant: i % 4,
}));
export const PLOTS: readonly Plot[] = [...projectPlots, ...civicPlots, ...homes];
export const WALL_SEGMENTS = 32;
const MERGES: readonly { id: string; children: [string,string]; at: number }[] = [
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
function hash(n: number): number { let x = n | 0; x ^= x >>> 16; x = Math.imul(x, 0x7feb352d); x ^= x >>> 15; x = Math.imul(x, 0x846ca68b); return (x ^ (x >>> 16)) >>> 0; }
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
export function createSave(now: number, seed = Math.floor(Math.random() * 0x7fffffff)): TownSave {
  return { version: 2, seed, createdAt: now, lastSeenAt: now, eventCursor: 0, elapsedFloorMs: 0 };
}
export function parseSave(raw: string | null, now: number): TownSave {
  if (!raw) return createSave(now);
  try {
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== 'object') return createSave(now);
    const s = data as Partial<TownSave>;
    if (s.version !== 2 || !Number.isFinite(s.createdAt) || !Number.isFinite(s.seed) || !Number.isFinite(s.lastSeenAt)) return createSave(now);
    return { version: 2, seed: Number(s.seed) >>> 0, createdAt: clamp(Number(s.createdAt), 0, now), lastSeenAt: clamp(Number(s.lastSeenAt), 0, now), eventCursor: Math.max(0, Number(s.eventCursor) || 0), elapsedFloorMs: Math.max(0, Number(s.elapsedFloorMs) || 0) };
  } catch { return createSave(now); }
}
export function milestoneRecap(save: TownSave, now: number): string[] {
  const before = Math.max(0, save.lastSeenAt - save.createdAt);
  const after = Math.max(before, now - save.createdAt);
  return MILESTONES.filter(m => m.at > before && m.at <= after).slice(-3).map(m => m.label);
}
export function townAt(save: TownSave, now: number): TownSnapshot {
  const elapsed = Math.max(0, now - save.createdAt, save.elapsedFloorMs);
  const matureCycles = Math.max(0, Math.floor((elapsed - 30 * MINUTE) / (2 * MINUTE)));
  const plots: PlotState[] = PLOTS.map((p, index) => {
    const start = p.kind === 'project' ? p.start : p.start + (hash(save.seed + index) % 12_000);
    let stage = p.kind === 'project' ? Math.min(6, 3 + Math.floor(elapsed / (8 * MINUTE))) : elapsed < start ? 0 : Math.min(6, 1 + Math.floor((elapsed - start) / p.step));
    if (p.kind === 'castle') stage = elapsed < 16 * MINUTE ? 2 : Math.min(6, 3 + Math.floor((elapsed - 16 * MINUTE) / (3 * MINUTE)));
    const renovation = stage === 6 && matureCycles ? Math.floor((matureCycles + index * 3) / 5) % 4 : 0;
    const complexId = MERGES.find(m => elapsed >= m.at && m.children.includes(p.id))?.id;
    return { ...p, stage, renovation, complexId };
  });
  const seasons = ['spring','summer','autumn','winter'] as const;
  const season = seasons[(1 + Math.floor(elapsed / (24 * MINUTE))) % 4];
  const weatherRoll = hash(save.seed + Math.floor(elapsed / (6 * MINUTE))) % 10;
  const phase = elapsed < 7 * MINUTE ? 0 : elapsed < 16 * MINUTE ? 1 : elapsed < 23 * MINUTE ? 2 : elapsed < 28 * MINUTE ? 3 : 4;
  return {
    elapsed, plots,
    innerWood: clamp(Math.floor((elapsed - 3 * MINUTE) / 7_500), 0, WALL_SEGMENTS),
    innerStone: clamp(Math.floor((elapsed - 11 * MINUTE) / 9_000), 0, WALL_SEGMENTS),
    outerWood: clamp(Math.floor((elapsed - 17 * MINUTE) / 11_000), 0, WALL_SEGMENTS),
    roads: clamp(Math.floor((elapsed - 45_000) / 28_000), 0, 40), phase, season,
    dayFraction: (elapsed % (12 * MINUTE)) / (12 * MINUTE),
    weather: weatherRoll < 6 ? 'clear' : weatherRoll < 9 ? 'cloudy' : 'rain',
    matureCycles,
    residents: Math.min(28, 8 + Math.floor(elapsed / MINUTE)),
    buildings: plots.filter(p => p.stage >= 4).length,
  };
}
