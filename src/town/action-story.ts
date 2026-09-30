import type { GameState, Idea, TownEvent } from './game';
import { MILESTONES } from './milestones';
import type { WorldEvent, WorldEventState } from './world-event-types';

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
  if(event.title)return event.title;
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
  world: WorldEventState;
}
export type DecisionBeat = {kind:'development';beat:ChoiceBeat} | {kind:'world';event:WorldEvent};

/** Coalesce adjacent stages only. Deliveries must precede the buildings they enable. */
export function decisionSequence(state: GameState): DecisionBeat[] {
  const sequence:DecisionBeat[]=[];
  for(const step of state.timeline){
    if(step.kind==='world'){sequence.push(step);continue;}
    const grant=step.event,last=sequence.at(-1);
    if(last?.kind==='development'&&last.beat.event.idea===grant.idea){
      const beat=last.beat;
      beat.event={...grant,sources:[...beat.event.sources]};
      for(const source of grant.sources)if(!beat.event.sources.some(s=>s.idea===source.idea))beat.event.sources.push(source);
      if(grant.project&&!beat.projects.includes(grant.project))beat.projects.push(grant.project);
      beat.world=step.world;
    }else sequence.push({kind:'development',beat:{event:{...grant,sources:[...grant.sources]},arrival:grant.level===1,projects:grant.project?[grant.project]:[],world:step.world}});
  }
  return sequence;
}

export function choiceSequence(state: GameState): ChoiceBeat[] {
  return decisionSequence(state).flatMap(step=>step.kind==='development'?[step.beat]:[]);
}
