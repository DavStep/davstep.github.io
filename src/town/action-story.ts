import type { GameState, Idea, TownEvent } from './game';
import { MILESTONES } from './milestones';

export type ActionStyle = 'settle' | 'fortify' | 'grow' | 'forge' | 'connect' | 'trade' | 'water' | 'harvest' | 'knowledge' | 'stars';
export const ACTION_STYLES: Record<Idea, ActionStyle> = {
  settlers: 'settle', walls: 'fortify', grove: 'grow', workshop: 'forge', roads: 'connect',
  market: 'trade', river: 'water', windmill: 'harvest', archive: 'knowledge', observatory: 'stars',
};
const LOCAL_GROWTH_TITLES: Partial<Record<Idea, readonly string[]>> = {
  settlers: ['Home extensions', 'Stone homes', 'Townhouses', 'Settled neighborhood', 'Town complete'],
  grove: ['Town trees', 'Growing canopy', 'Woodland paths', 'Mature groves', 'Valley forest'],
  walls: ['Watch posts', 'Parapet repairs', 'Guard stations', 'Gate banners', 'Town defenses'],
  windmill: ['New field rows', 'Wider harvest', 'Full granary', 'Golden fields', 'Harvest complete'],
};
export function eventTitle(event: TownEvent): string {
  const local=LOCAL_GROWTH_TITLES[event.idea]?.[event.level-4];
  if(local)return local;
  const milestone = MILESTONES[event.idea][event.level - 1];
  return milestone.name;
}
export function eventWaves(state: GameState): TownEvent[][] {
  const waves: TownEvent[][] = [];
  for (const event of state.events) (waves[event.wave] ??= []).push(event);
  return waves;
}
