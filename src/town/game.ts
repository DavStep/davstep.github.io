export const GAME_SAVE_KEY = 'davstep.choice-town.v1';

export const IDEAS = [
  'settlers', 'grove', 'workshop', 'roads', 'market', 'windmill', 'archive', 'observatory',
] as const;
export type Idea = typeof IDEAS[number];
export type Levels = Record<Idea, number>;

export const IDEA_INFO: Record<Idea, { name: string; icon: string; place: string; hint: string }> = {
  settlers: { name: 'Settlers', icon: '⌂', place: 'Homes', hint: 'Someone must tend the first garden.' },
  grove: { name: 'Grove', icon: '✿', place: 'Gardens', hint: 'The workshop needs living timber.' },
  workshop: { name: 'Workshop', icon: '⚒', place: 'Forge', hint: 'A bridge needs a forged gear.' },
  roads: { name: 'Roads', icon: '⌁', place: 'Bridge', hint: 'A caravan needs a crossing.' },
  market: { name: 'Market', icon: '◈', place: 'Trading Hall', hint: 'The windmill needs a part from the caravan.' },
  windmill: { name: 'Windmill', icon: '✳', place: 'River Mill', hint: 'The Archive needs the mill working.' },
  archive: { name: 'Archive', icon: '▤', place: 'Town Post', hint: 'The Observatory needs the town’s plans.' },
  observatory: { name: 'Observatory', icon: '✦', place: 'Star Tower', hint: 'The final lens needs the Archive.' },
};

const predecessor: Partial<Record<Idea, Idea>> = {
  grove: 'settlers', workshop: 'grove', roads: 'workshop', market: 'roads',
  windmill: 'market', archive: 'windmill', observatory: 'archive',
};

export const SECRET_ORDER: readonly Idea[] = [
  'settlers', 'grove', 'workshop', 'roads', 'market', 'archive', 'windmill', 'observatory',
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
  levels: Levels;
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
  const missed: Idea[] = [];
  for (const idea of order) {
    if (!IDEAS.includes(idea) || levels[idea] !== 0) throw new Error(`Invalid idea sequence: ${idea}`);
    levels[idea] = 1;
    const needed = predecessor[idea];
    if (needed) {
      if (levels[needed] >= (idea === 'grove' ? 1 : 2)) levels[idea] = 2;
      else missed.push(idea);
    }
    // Each new arrival can change buildings that were already in the world.
    // Iterate until every causal reaction for this turn has settled.
    let changed = true;
    while (changed) {
      const before = IDEAS.map(key => levels[key]).join('');
      if (levels.settlers && levels.roads >= 2) levels.settlers = Math.max(levels.settlers, 2);
      if (levels.settlers >= 2 && levels.market >= 2) levels.settlers = 3;
      if (levels.grove >= 2 && levels.windmill >= 2) levels.grove = 3;
      if (levels.workshop >= 2 && levels.roads >= 2 && levels.windmill >= 2) levels.workshop = 3;
      if (levels.roads >= 2 && levels.market >= 2) levels.roads = 3;
      if (levels.market >= 2 && levels.archive >= 2) levels.market = 3;
      if (levels.windmill >= 2 && levels.workshop >= 2 && levels.grove >= 2) levels.windmill = 3;
      if (levels.archive >= 2 && levels.settlers >= 2 && levels.market >= 2) levels.archive = 3;
      if (levels.observatory >= 2 && IDEAS.slice(0, -1).every(key => levels[key] === 3)) levels.observatory = 3;
      changed = before !== IDEAS.map(key => levels[key]).join('');
    }
  }
  const maxCount = IDEAS.filter(idea => levels[idea] === 3).length;
  const finished = order.length === IDEAS.length;
  return {
    order: [...order], levels, missed, maxCount, finished,
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
