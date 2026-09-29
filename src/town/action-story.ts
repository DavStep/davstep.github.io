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

export interface ChoiceBeat {
  event: TownEvent;
  arrival: boolean;
  projects: string[];
}

/** One choice, one visit per site. Stage grants are rewards, not new triggers. */
export function choiceSequence(state: GameState): ChoiceBeat[] {
  const selected=state.order.at(-1);
  if(!selected)return [];
  const sites=new Map<Idea,ChoiceBeat>();
  for(const grant of state.events){
    let beat=sites.get(grant.idea);
    if(!beat){
      beat={event:{...grant,sources:[]},arrival:grant.idea===selected,projects:[]};
      sites.set(grant.idea,beat);
    }
    beat.event.level=grant.level;
    if(grant.project&&!beat.projects.includes(grant.project))beat.projects.push(grant.project);
  }
  return [...sites.values()].map((beat,index)=>{
    beat.event.wave=index;
    if(beat.arrival){
      // The new idea arrives once with all benefits of the existing town.
      // Do not send reciprocal reaction trails back to this site later.
      delete beat.event.project;
    }else{
      beat.event.project=beat.projects[0];
      beat.event.sources=[{idea:selected,level:state.levels[selected],purpose:'New choice'}];
    }
    return beat;
  });
}
