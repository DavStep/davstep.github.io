import type { ProjectKey } from './projects';
import { PLOTS, MERGES, MILESTONES, INFRASTRUCTURE } from './town-plan';

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
  outerRoad: number;
  phase: number;
  season: 'spring' | 'summer' | 'autumn' | 'winter';
  dayFraction: number;
  weather: 'clear' | 'cloudy' | 'rain';
  matureCycles: number;
  residents: number;
  buildings: number;
}

export { PLOTS, MILESTONES } from './town-plan';
export const WALL_SEGMENTS = INFRASTRUCTURE.wall.segments;

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
    const start = p.kind === 'project' ? p.start : p.start + (hash(save.seed + index) % 8_000);
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
    innerWood: clamp(Math.floor((elapsed - INFRASTRUCTURE.wall.innerWoodStart) / INFRASTRUCTURE.wall.innerWoodStep), 0, WALL_SEGMENTS),
    innerStone: clamp(Math.floor((elapsed - INFRASTRUCTURE.wall.innerStoneStart) / INFRASTRUCTURE.wall.innerStoneStep), 0, WALL_SEGMENTS),
    outerWood: clamp(Math.floor((elapsed - INFRASTRUCTURE.wall.outerWoodStart) / INFRASTRUCTURE.wall.outerWoodStep), 0, WALL_SEGMENTS),
    roads: clamp(Math.floor((elapsed - INFRASTRUCTURE.road.stoneStart) / INFRASTRUCTURE.road.stoneStep), 0, INFRASTRUCTURE.road.ringSegments), phase, season,
    outerRoad: clamp(Math.floor((elapsed - INFRASTRUCTURE.road.outerRingStart) / INFRASTRUCTURE.road.outerRingStep), 0, INFRASTRUCTURE.road.outerRingSegments),
    dayFraction: (elapsed % (12 * MINUTE)) / (12 * MINUTE),
    weather: weatherRoll < 6 ? 'clear' : weatherRoll < 9 ? 'cloudy' : 'rain',
    matureCycles,
    residents: Math.min(28, 8 + Math.floor(elapsed / MINUTE)),
    buildings: plots.filter(p => p.stage >= 4).length,
  };
}
