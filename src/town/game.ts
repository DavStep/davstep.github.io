import { MAX_LEVEL } from './milestones';
import type { Requirement } from './action-rules';
import { evaluateWorld, type WorldProgression } from './world-event-logic';
import { CARDINAL_GATE_MASK } from './wall-layout';
export { MAX_LEVEL } from './milestones';

export const GAME_SAVE_KEY = 'davstep.choice-town.v3';

export const IDEAS = [
  'settlers', 'grove', 'workshop', 'roads', 'walls', 'market', 'windmill', 'archive', 'river', 'observatory',
] as const;
export type Idea = typeof IDEAS[number];
export type Levels = Record<Idea, number>;
export type Route = 'living-world';

/** Card art rendered from the town's own 3D builders (scripts/render-idea-icons.mjs). */
export const ideaIcon = (idea: string, level: number) => `/assets/idea-icons/3d/${idea}-${Math.max(1, Math.min(8, level))}.webp`;

export const IDEA_INFO: Record<Idea, { name: string; icon: string; place: string; hint: string }> = {
  settlers: { name: 'Settlers', icon: ideaIcon('settlers', 8), place: 'Homes', hint: 'Builders staff the grove, forge and harbor. Timber, food and dwarf stone improve their homes.' },
  grove: { name: 'Grove', icon: ideaIcon('grove', 8), place: 'Gardens', hint: 'Settlers harvest timber here. River channels irrigate fruit trees; gardeners can restore burned ground.' },
  workshop: { name: 'Workshop', icon: ideaIcon('workshop', 8), place: 'Forge', hint: 'Workers and timber make tools. Dwarf ore and river cooling enable precision machinery.' },
  roads: { name: 'Roads & Dwarves', icon: ideaIcon('roads', 8), place: 'Bridge', hint: 'Timber and tools build wagon bridges and a dwarf mine. Archive surveys enable lava diversion channels.' },
  walls: { name: 'Walls', icon: ideaIcon('walls', 8), place: 'Town Wall', hint: 'Wagon roads reserve wide gates. Dwarf stone strengthens defenses; Wizard signals link the watchtowers.' },
  market: { name: 'Market', icon: ideaIcon('market', 8), place: 'Idle Outpost market', hint: 'An open wagon route brings food and optical glass. Flour and records develop a harvest exchange.' },
  windmill: { name: 'Windmill', icon: ideaIcon('windmill', 8), place: 'River Mill', hint: 'Timber and forged gears turn the mill. Irrigation grows grain; the Wizard’s calendar improves the harvest.' },
  archive: { name: 'Archive', icon: ideaIcon('archive', 8), place: 'Grand Archive', hint: 'Workers and tools enable surveys, including safe dwarf lava channels. Rivers and discoveries complete the atlas.' },
  river: { name: 'Rivers', icon: ideaIcon('river', 8), place: 'Riverworks', hint: 'Workers, timber and tools build a seaworthy ship and irrigation channels. The first voyage retrieves an island treasure.' },
  observatory: { name: 'Wizard', icon: ideaIcon('observatory', 8), place: 'Star Tower', hint: 'The Wizard can calm an approaching dragon immediately. Glass and tools make a telescope; three artifacts power its beacon.' },
};

export interface TownEvent {
  idea: Idea;
  level: number;
  wave: number;
  sources: Requirement[];
  project?: string;
  title?: string;
  description?: string;
}

export interface MissedProject {
  idea: Idea;
  partner: Idea;
  project: string;
  reason: string;
}

/** Example of a prepared world; no special order is hardcoded into evaluation. */
export const SECRET_ORDER: readonly Idea[] = [
  'settlers', 'grove', 'workshop', 'roads', 'archive', 'river', 'observatory', 'market', 'windmill', 'walls',
];

export interface GameSave {
  version: 3;
  started: boolean;
  order: Idea[];
  bestMax: number;
  bestScore: number;
  secretFound: boolean;
}

export interface GameState extends WorldProgression {
  order: readonly Idea[];
  route: Route;
  /** Internal stage grants for the last decision; playback combines them into one beat per site. */
  events: TownEvent[];
  projects: readonly string[];
  levels: Levels;
  gateMask: number;
  isolatedMill: boolean;
  faults: readonly MissedProject[];
  missed: readonly Idea[];
  maxCount: number;
  score: number;
  finished: boolean;
  perfect: boolean;
  secret: boolean;
}

export function newGameSave(): GameSave {
  return { version: 3, started: false, order: [], bestMax: 0, bestScore: 0, secretFound: false };
}

export function parseGameSave(raw: string | null): GameSave {
  if (!raw) return newGameSave();
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return newGameSave();
    const data = value as Partial<GameSave>;
    if (data.version !== 3 || !Array.isArray(data.order) || data.order.length > IDEAS.length) return newGameSave();
    if (data.order.some(idea => !IDEAS.includes(idea as Idea)) || new Set(data.order).size !== data.order.length) return newGameSave();
    return {
      version: 3, started: Boolean(data.started) || data.order.length > 0,
      order: data.order as Idea[], bestMax: Math.max(0, Math.min(IDEAS.length, Number(data.bestMax) || 0)),
      bestScore: Math.max(0, Math.min(IDEAS.length * MAX_LEVEL, Number(data.bestScore) || 0)),
      secretFound: Boolean(data.secretFound),
    };
  } catch { return newGameSave(); }
}

/** Replay supplies, discoveries and irreversible event outcomes in choice order. */
export function evaluate(order: readonly Idea[]): GameState {
  const progression=evaluateWorld(order);
  const {levels,world}=progression;
  const maxCount=IDEAS.filter(idea=>levels[idea]===MAX_LEVEL).length;
  const score=IDEAS.reduce((sum,idea)=>sum+levels[idea],0);
  const finished=order.length===IDEAS.length;
  const perfect=finished&&maxCount===IDEAS.length;
  const gateMask=levels.walls>0&&progression.projects.includes('road-gates')?CARDINAL_GATE_MASK:0;
  return {
    ...progression,order:[...order],route:'living-world',gateMask,isolatedMill:false,
    faults:[],missed:[],maxCount,score,finished,perfect,
    secret:finished&&world.beacon&&world.dragon==='tamed'&&world.volcano==='contained',
  };
}

export function chooseIdea(save: GameSave, idea: Idea): GameState {
  if (!IDEAS.includes(idea) || save.order.includes(idea) || save.order.length >= IDEAS.length) throw new Error('Idea already chosen or run finished');
  save.started = true;
  save.order.push(idea);
  const state = evaluate(save.order);
  save.bestMax = Math.max(save.bestMax, state.maxCount);
  if (state.finished) save.bestScore = Math.max(save.bestScore, state.score);
  save.secretFound ||= state.secret;
  return state;
}

export function restartGame(save: GameSave): void {
  save.started = true;
  save.order = [];
}
