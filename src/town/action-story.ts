import { evaluate, IDEAS, IDEA_INFO, upgradeBlocker, type GameState, type Idea, type TownEvent } from './game';
import { MILESTONES, MAX_LEVEL } from './milestones';

export type ActionStyle = 'settle' | 'fortify' | 'grow' | 'forge' | 'connect' | 'trade' | 'water' | 'harvest' | 'knowledge' | 'stars';
export const ACTIONS: Record<Idea, { verb: string; need: string; promise: string; style: ActionStyle }> = {
  settlers: { verb: 'Welcome the settlers', need: 'An empty valley has no one to build or tend it.', promise: 'Establish the first homes and bring in the gardening and digging crews.', style: 'settle' },
  grove: { verb: 'Plant the grove', need: 'The builders need a renewable source of timber.', promise: 'Plant saplings. With gardeners, the grove supplies timber to the forge.', style: 'grow' },
  workshop: { verb: 'Call in Sandship', need: 'Bare hands cannot build crossings or cut a water channel.', promise: 'Land the workshop. Timber lets its smiths forge the tools the town needs.', style: 'forge' },
  roads: { verb: 'Connect the valley', need: 'People and supplies need a way to reach the town.', promise: 'Survey paths. Forged tools turn them into crossings and open supply gates.', style: 'connect' },
  walls: { verb: 'Protect the homes', need: 'A growing settlement needs a safe boundary.', promise: 'Raise a timber enclosure. Surveyed roads let the masons add gates and stone defenses.', style: 'fortify' },
  market: { verb: 'Invite the caravans', need: 'Local builders cannot make every supply themselves.', promise: 'Open the outpost. A working crossing brings caravans and construction supplies.', style: 'trade' },
  windmill: { verb: 'Bring in the harvest', need: 'A larger town needs a dependable food supply.', promise: 'Build the mill. Irrigation and merchant supplies activate it; tools and timber complete the fields.', style: 'harvest' },
  archive: { verb: 'Share the town’s plans', need: 'Separate builders need a shared plan for the valley.', promise: 'Found the archive. Messengers carry plans over the roads, unlocking trade records and telescope surveys.', style: 'knowledge' },
  river: { verb: 'Release the river', need: 'Dry ground limits what the gardens and grain fields can grow.', promise: 'Mark a channel. Settlers with forged picks dig it, then release the water.', style: 'water' },
  observatory: { verb: 'Chart the horizon', need: 'The town needs precise surveys to expand into the hills.', promise: 'Build the star platform. Archive notes align its lens; a complete town unlocks the valley atlas.', style: 'stars' },
};
export const GUIDED_ORDER: readonly Idea[] = ['settlers', 'grove', 'workshop', 'roads', 'market', 'river', 'windmill', 'walls', 'archive', 'observatory'];
export function nextSuggestion(state: GameState): Idea | undefined { return GUIDED_ORDER.find(idea => state.levels[idea] === 0); }
export function chapter(state: GameState): { name: string; goal: string } {
  if (!state.levels.settlers || state.levels.workshop < 2) return { name: '01 · A foothold', goal: 'People tend timber. Timber becomes tools.' };
  if (state.levels.roads < 2 || state.levels.market < 2) return { name: '02 · Open the routes', goal: 'Tools build crossings. Crossings bring caravans.' };
  if (state.levels.river < 2 || state.levels.windmill < 3) return { name: '03 · Make the valley bloom', goal: 'Dig the channel. Irrigate the fields. Bring in a harvest.' };
  if (state.levels.archive < 3 || state.levels.walls < 3) return { name: '04 · Build a community', goal: 'Protect the homes and share the town’s plans.' };
  return { name: state.perfect ? '05 · A valley connected' : '05 · Beyond the town', goal: 'Use the town atlas to chart the hills and complete the valley.' };
}
export function explainEvent(event: TownEvent): string {
  if (event.level === 1) return ACTIONS[event.idea].need;
  return event.sources.map(source => `${IDEA_INFO[source.idea].name} supplies ${source.purpose}`).join('; ') + '.';
}
export function eventTitle(event: TownEvent): string { const milestone = MILESTONES[event.idea][event.level - 1]; return milestone.frontierName ?? milestone.name; }
export function forecast(state: GameState, idea: Idea): GameState { return evaluate([...state.order, idea]); }
export function changedIdeas(before: GameState, after: GameState): Idea[] { return IDEAS.filter(idea => after.levels[idea] > before.levels[idea]); }
export function turnSummary(before: GameState, after: GameState): string {
  const chosen = after.order[after.order.length - 1];
  const reactions = changedIdeas(before, after).filter(idea => idea !== chosen);
  const ownEvents = after.events.filter(event => event.idea === chosen);
  const latest = ownEvents[ownEvents.length - 1];
  const outcome = latest.level > 1 ? `${eventTitle(latest)}. ${explainEvent(latest)}` : `${IDEA_INFO[chosen].name} established. ${upgradeBlocker(chosen, after.levels) ? `Next it needs ${upgradeBlocker(chosen, after.levels)}` : ''}`;
  return `${outcome}${reactions.length ? ` This also developed ${reactions.map(idea => IDEA_INFO[idea].name).join(', ')}.` : ''}`;
}
export function eventWaves(state: GameState): TownEvent[][] {
  const waves: TownEvent[][] = [];
  for (const event of state.events) (waves[event.wave] ??= []).push(event);
  return waves;
}
export function levelLabel(level: number): string { return level === MAX_LEVEL ? 'Complete' : level === 0 ? 'Not established' : `${level} / ${MAX_LEVEL}`; }
