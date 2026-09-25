import { MAX_LEVEL } from './milestones';
import { missingRequirements, requirements, type Requirement } from './action-rules';
export { MAX_LEVEL } from './milestones';
import { CARDINAL_GATE_MASK } from './wall-layout';

export const GAME_SAVE_KEY = 'davstep.choice-town.v1';

export const IDEAS = [
  'settlers', 'grove', 'workshop', 'roads', 'walls', 'market', 'windmill', 'archive', 'river', 'observatory',
] as const;
export type Idea = typeof IDEAS[number];
export type Levels = Record<Idea, number>;

export const IDEA_INFO: Record<Idea, { name: string; icon: string; place: string; hint: string }> = {
  settlers: { name: 'Settlers', icon: '/assets/idea-icons/settlers.webp', place: 'Homes', hint: 'Someone must tend the first garden.' },
  grove: { name: 'Grove', icon: '/assets/idea-icons/grove.webp', place: 'Gardens', hint: 'The workshop needs living timber.' },
  workshop: { name: 'Workshop', icon: '/assets/idea-icons/workshop.webp', place: 'Forge', hint: 'A bridge needs a forged gear.' },
  roads: { name: 'Roads', icon: '/assets/idea-icons/roads.webp', place: 'Bridge', hint: 'A caravan needs a crossing.' },
  walls: { name: 'Walls', icon: '/assets/idea-icons/walls.webp', place: 'Town Wall', hint: 'Protect the homes. Road builders mark the gates when the crossings are ready.' },
  market: { name: 'Market', icon: '/assets/idea-icons/market.webp', place: 'Idle Outpost market', hint: 'Build an outpost beyond the walls. Roads, trade and the Archive grow it into a connected marketplace.' },
  windmill: { name: 'Windmill', icon: '/assets/idea-icons/windmill.webp', place: 'River Mill', hint: 'Bring water and merchant supplies to turn dry fields into a harvest.' },
  archive: { name: 'Archive', icon: '/assets/idea-icons/archive.webp', place: 'Town Post', hint: 'The Observatory needs the town’s plans.' },
  river: { name: 'River', icon: '/assets/idea-icons/river.svg', place: 'Waterworks', hint: 'Settlers and workshop tools dig a channel. Roads and trade extend it around the castle.' },
  observatory: { name: 'Observatory', icon: '/assets/idea-icons/observatory.webp', place: 'Star Tower', hint: 'The final lens needs the Archive.' },
};

/** A concrete, recoverable need rather than a hidden score or idea count. */
export function upgradeBlocker(idea: Idea, levels: Levels, _gateMask = 0): string | null {
  if (levels[idea] === 0 || levels[idea] >= MAX_LEVEL) return null;
  const missing = missingRequirements(idea, levels[idea] + 1, levels);
  return missing.length ? missing.map(req => `${IDEA_INFO[req.idea].name} ${req.level}: ${req.purpose}`).join('; ') + '.' : null;
}

export interface TownEvent {
  idea: Idea;
  level: number;
  wave: number;
  sources: Requirement[];
}

export const SECRET_ORDER: readonly Idea[] = [
  'settlers', 'grove', 'workshop', 'roads', 'market', 'archive', 'walls', 'windmill', 'river', 'observatory',
];

export interface GameSave {
  version: 1;
  started: boolean;
  order: Idea[];
  bestMax: number;
  secretFound: boolean;
}

export interface GameState {
  order: readonly Idea[];
  /** Events for the last decision, in simultaneous causal waves. */
  events: TownEvent[];
  levels: Levels;
  gateMask: number;
  isolatedMill: boolean;
  missed: readonly Idea[];
  maxCount: number;
  finished: boolean;
  perfect: boolean;
  secret: boolean;
}

export function newGameSave(): GameSave {
  return { version: 1, started: false, order: [], bestMax: 0, secretFound: false };
}

export function parseGameSave(raw: string | null): GameSave {
  if (!raw) return newGameSave();
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return newGameSave();
    const data = value as Partial<GameSave>;
    if (data.version !== 1 || !Array.isArray(data.order) || data.order.length > IDEAS.length) return newGameSave();
    if (data.order.some(idea => !IDEAS.includes(idea as Idea)) || new Set(data.order).size !== data.order.length) return newGameSave();
    return {
      version: 1, started: Boolean(data.started) || data.order.length > 0,
      order: data.order as Idea[], bestMax: Math.max(0, Math.min(IDEAS.length, Number(data.bestMax) || 0)),
      secretFound: Boolean(data.secretFound),
    };
  } catch { return newGameSave(); }
}

function emptyLevels(): Levels {
  return Object.fromEntries(IDEAS.map(idea => [idea, 0])) as Levels;
}

export function evaluate(order: readonly Idea[]): GameState {
  const levels = emptyLevels();
  let gateMask = 0;
  let events: TownEvent[] = [];
  for (const idea of order) {
    if (!IDEAS.includes(idea) || levels[idea] !== 0) throw new Error(`Invalid idea sequence: ${idea}`);
    events = [{ idea, level: 1, wave: 0, sources: [] }];
    levels[idea] = 1;
    // A wave only consumes infrastructure that existed BEFORE that wave.
    // This trace is also the animation plan: causes always precede effects.
    for (let wave = 1; ; wave++) {
      const ready = IDEAS.filter(key => levels[key] > 0 && levels[key] < MAX_LEVEL
        && upgradeBlocker(key, levels, gateMask) === null);
      if (!ready.length) break;
      for (const key of ready) {
        const level = levels[key] + 1;
        events.push({ idea: key, level, wave, sources: requirements(key, level) });
      }
      for (const key of ready) levels[key]++;
      // Masons can retrofit gates once the road builders survey a route.
      if (levels.walls > 0 && levels.roads >= 2) gateMask = CARDINAL_GATE_MASK;
    }
    if (levels.walls > 0 && levels.roads >= 2) gateMask = CARDINAL_GATE_MASK;
  }
  const missed = IDEAS.filter(idea => levels[idea] > 0 && levels[idea] < MAX_LEVEL && upgradeBlocker(idea, levels, gateMask) !== null);
  const maxCount = IDEAS.filter(idea => levels[idea] >= MAX_LEVEL).length;
  const finished = order.length === IDEAS.length;
  return {
    order: [...order], levels, gateMask, events,
    isolatedMill: levels.walls > 0 && gateMask === 0 && levels.windmill > 0,
    missed, maxCount, finished,
    perfect: finished && maxCount === IDEAS.length,
    secret: finished && SECRET_ORDER.every((idea, index) => order[index] === idea),
  };
}

export function chooseIdea(save: GameSave, idea: Idea): GameState {
  if (!IDEAS.includes(idea) || save.order.includes(idea) || save.order.length >= IDEAS.length) throw new Error('Idea already chosen or run finished');
  save.started = true;
  save.order.push(idea);
  const state = evaluate(save.order);
  save.bestMax = Math.max(save.bestMax, state.maxCount);
  save.secretFound ||= state.secret;
  return state;
}

export function restartGame(save: GameSave): void {
  save.started = true;
  save.order = [];
}
