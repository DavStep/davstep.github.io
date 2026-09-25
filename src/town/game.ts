import { MAX_LEVEL } from './milestones';
import { JOINT_PROJECTS, projectStages, type Requirement } from './action-rules';
import { CARDINAL_GATE_MASK } from './wall-layout';
export { MAX_LEVEL } from './milestones';

export const GAME_SAVE_KEY = 'davstep.choice-town.v2';

export const IDEAS = [
  'settlers', 'grove', 'workshop', 'roads', 'walls', 'market', 'windmill', 'archive', 'river', 'observatory',
] as const;
export type Idea = typeof IDEAS[number];
export type Levels = Record<Idea, number>;
export type Route = 'valley' | 'storybook';

export const IDEA_INFO: Record<Idea, { name: string; icon: string; place: string; hint: string }> = {
  settlers: { name: 'Settlers', icon: '/assets/idea-icons/settlers.webp', place: 'Homes', hint: 'Their crew can help the grove, forge, streets, market, archive and river.' },
  grove: { name: 'Grove', icon: '/assets/idea-icons/grove.webp', place: 'Gardens', hint: 'Gardens can grow with settlers, the forge, mill and river.' },
  workshop: { name: 'Workshop', icon: '/assets/idea-icons/workshop.webp', place: 'Forge', hint: 'The forge makes fittings, gears, sluices and instruments with its partners.' },
  roads: { name: 'Roads', icon: '/assets/idea-icons/roads.webp', place: 'Bridge', hint: 'Crossings connect homes, workshops, gates, caravans, messengers and canals.' },
  walls: { name: 'Walls', icon: '/assets/idea-icons/walls.webp', place: 'Town Wall', hint: 'The walls can gain forge fittings, mapped gates, deliveries and a lookout.' },
  market: { name: 'Market', icon: '/assets/idea-icons/market.webp', place: 'Idle Outpost market', hint: 'Trade grows with residents, roads, walls, the mill, archive and tower.' },
  windmill: { name: 'Windmill', icon: '/assets/idea-icons/windmill.webp', place: 'River Mill', hint: 'The mill needs partners for timber, gears, trade, water and seasons.' },
  archive: { name: 'Archive', icon: '/assets/idea-icons/archive.webp', place: 'Grand Archive', hint: 'Records connect residents, messengers, trade, waterways and stars.' },
  river: { name: 'River', icon: '/assets/idea-icons/river.svg', place: 'Waterworks', hint: 'Water can help homes, gardens, machinery, roads, the mill and maps.' },
  observatory: { name: 'Observatory', icon: '/assets/idea-icons/observatory.webp', place: 'Star Tower', hint: 'The tower grows with instruments, walls, trade, seasons, plans and waterways.' },
};

export interface TownEvent {
  idea: Idea;
  level: number;
  wave: number;
  sources: Requirement[];
  project?: string;
}

export interface MissedProject {
  idea: Idea;
  partner: Idea;
  project: string;
  reason: string;
}

/** Archive first opens a second, night-time route through the same projects. */
export const SECRET_ORDER: readonly Idea[] = [
  'archive', 'observatory', 'river', 'grove', 'settlers', 'workshop', 'windmill', 'roads', 'market', 'walls',
];

export interface GameSave {
  version: 2;
  started: boolean;
  order: Idea[];
  bestMax: number;
  bestScore: number;
  secretFound: boolean;
}

export interface GameState {
  order: readonly Idea[];
  route: Route;
  /** Events for the last decision. Each wave consumes the levels from the previous wave. */
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
  return { version: 2, started: false, order: [], bestMax: 0, bestScore: 0, secretFound: false };
}

export function parseGameSave(raw: string | null): GameSave {
  if (!raw) return newGameSave();
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return newGameSave();
    const data = value as Partial<GameSave>;
    if (data.version !== 2 || !Array.isArray(data.order) || data.order.length > IDEAS.length) return newGameSave();
    if (data.order.some(idea => !IDEAS.includes(idea as Idea)) || new Set(data.order).size !== data.order.length) return newGameSave();
    return {
      version: 2, started: Boolean(data.started) || data.order.length > 0,
      order: data.order as Idea[], bestMax: Math.max(0, Math.min(IDEAS.length, Number(data.bestMax) || 0)),
      bestScore: Math.max(0, Math.min(IDEAS.length * MAX_LEVEL, Number(data.bestScore) || 0)),
      secretFound: Boolean(data.secretFound),
    };
  } catch { return newGameSave(); }
}

function emptyLevels(): Levels {
  return Object.fromEntries(IDEAS.map(idea => [idea, 0])) as Levels;
}

/** Replay the route so save/load and previews use exactly the same one-time project rules. */
export function evaluate(order: readonly Idea[]): GameState {
  const levels = emptyLevels();
  const projects: string[] = [];
  const faults: MissedProject[] = [];
  const route: Route = order[0] === 'archive' ? 'storybook' : 'valley';
  const routeOrder = route === 'storybook' ? SECRET_ORDER : IDEAS;
  const rank = new Map<Idea, number>(routeOrder.map((idea, index) => [idea, index]));
  let events: TownEvent[] = [];
  for (const idea of order) {
    if (!IDEAS.includes(idea) || levels[idea] !== 0) throw new Error(`Invalid idea sequence: ${idea}`);
    events = [{ idea, level: 1, wave: 0, sources: [] }];
    levels[idea] = 1;
    let wave = 0;
    for (const project of JOINT_PROJECTS) {
      if (!project.ideas.includes(idea)) continue;
      const partner = project.ideas.find(candidate => candidate !== idea)!;
      if (!levels[partner]) continue;
      if (rank.get(partner)! > rank.get(idea)!) {
        faults.push({
          idea, partner, project: project.id,
          reason: `${project.name} missed: ${IDEA_INFO[partner].name} came before ${IDEA_INFO[idea].name}. Try ${IDEA_INFO[idea].name} before ${IDEA_INFO[partner].name} on the ${route === 'storybook' ? 'storybook' : 'valley'} route.`,
        });
        continue;
      }
      projects.push(project.id);
      const stages = Math.max(projectStages(project, idea), projectStages(project, partner));
      for (let stage = 0; stage < stages; stage++) {
        wave++;
        const upgrades: TownEvent[] = [];
        for (const target of project.ideas) {
          if (stage >= projectStages(project, target)) continue;
          upgrades.push({
            idea: target, level: levels[target] + 1, wave, project: project.id,
            sources: [{ idea: target === idea ? partner : idea, level: levels[target === idea ? partner : idea], purpose: project.name }],
          });
        }
        events.push(...upgrades);
        for (const upgrade of upgrades) levels[upgrade.idea] = upgrade.level;
      }
    }
  }
  const missed = IDEAS.filter(idea => levels[idea] > 0 && faults.some(fault => fault.idea === idea || fault.partner === idea));
  const maxCount = IDEAS.filter(idea => levels[idea] === MAX_LEVEL).length;
  const score = IDEAS.reduce((sum, idea) => sum + levels[idea], 0);
  const finished = order.length === IDEAS.length;
  const perfect = finished && maxCount === IDEAS.length;
  const gateMask = projects.includes('road-gates') && levels.walls > 0 ? CARDINAL_GATE_MASK : 0;
  return {
    order: [...order], route, levels, projects, gateMask, events, faults,
    isolatedMill: levels.walls > 0 && gateMask === 0 && levels.windmill > 0,
    missed, maxCount, score, finished, perfect, secret: perfect && route === 'storybook',
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
