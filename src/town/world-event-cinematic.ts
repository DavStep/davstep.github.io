import type { WorldEventKind } from './world-event-types';

export type EventPhase='source'|'travel'|'interaction'|'delivery'|'consequence';
export interface EventCue {phase:EventPhase;local:number;progress:number}
const durations:Record<WorldEventKind,number>={
  expedition:11500,'dragon-warning':3200,'dragon-tamed':8500,'dragon-raid':8000,
  'volcano-warning':3400,'mine-prepared':6500,'eruption-safe':8500,'eruption-damage':7500,
  'pass-repaired':6000,'core-recovered':6500,'lens-delivery':9500,'caravan-waiting':3500,
  'orchard-restored':5500,'artifact-installed':4500,'beacon-lit':5000,
};
export function worldEventDuration(kind:WorldEventKind):number{return durations[kind];}
/** Absolute phases make seeking, pausing, cancellation and replay independent of frame rate. */
export function worldEventCue(progress:number):EventCue{
  const p=Math.max(0,Math.min(1,Number.isFinite(progress)?progress:0));
  const cuts=[0,.12,.38,.58,.86,1],phases:EventPhase[]=['source','travel','interaction','delivery','consequence'];
  const index=p===1?4:cuts.findIndex((v,i)=>i<5&&p>=v&&p<cuts[i+1]);
  return {phase:phases[index],local:(p-cuts[index])/(cuts[index+1]-cuts[index]),progress:p};
}
export const eventEase=(t:number)=>{const p=Math.max(0,Math.min(1,t));return p*p*(3-2*p);};
