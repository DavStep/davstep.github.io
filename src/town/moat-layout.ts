import type { Levels } from './game';
import { riverCenter, riverSurfaceHeight } from './river-layout';
import type { Collider } from './collision';
export const MOAT_RADIUS=60;
export const MOAT_HALF_WIDTH=2.6;
export const MOAT_WATER_Y=.02;
export const MOAT_FEED_X=-24;
export const MOAT_FEED_START=-Math.sqrt(MOAT_RADIUS**2-MOAT_FEED_X**2);
export const MOAT_FEED_END=riverCenter(MOAT_FEED_X);
export function moatDistance(x:number,z:number):number {
  const ring=Math.abs(Math.hypot(x,z)-MOAT_RADIUS);
  const closestZ=Math.max(MOAT_FEED_END,Math.min(MOAT_FEED_START,z));
  return Math.min(ring,Math.hypot(x-MOAT_FEED_X,z-closestZ));
}
export function moatSurfaceHeight(x:number,z:number):number {
  if(z>=MOAT_FEED_START||Math.abs(x-MOAT_FEED_X)>MOAT_HALF_WIDTH+3)return MOAT_WATER_Y;
  const t=Math.min(1,(z-MOAT_FEED_START)/(MOAT_FEED_END-MOAT_FEED_START));
  return MOAT_WATER_Y+(riverSurfaceHeight(MOAT_FEED_X)-MOAT_WATER_Y)*t;
}
export function moatBedHeight(x:number,z:number,ground:number):number {
  const t=Math.max(0,Math.min(1,(moatDistance(x,z)-MOAT_HALF_WIDTH-.8)/2.5));
  if(t===1)return ground;
  return Math.min(ground,moatSurfaceHeight(x,z)-1.2+(ground-moatSurfaceHeight(x,z)+1.2)*t*t*(3-2*t));
}
export function moatForLevels(levels:Levels){
  const filled=levels.river>=3;
  return {filled,bridges:filled&&levels.roads>=2,gates:filled&&levels.roads>=3};
}
export function moatArrival(before:Levels,after:Levels):string {
  const a=moatForLevels(before),b=moatForLevels(after);
  if(!a.filled&&b.filled)return b.gates?'River water circles the castle hill. Stone bridges and gatehouses secure the crossings.':b.bridges?'River water circles the castle hill, with bridges carrying the roads across.':'River water fills a moat around the castle hill. Developed roads will provide crossings.';
  if(!a.gates&&b.gates)return 'Stone gatehouses rise over the castle moat crossings.';
  if(!a.bridges&&b.bridges)return 'Bridges carry the developed roads across the castle moat.';
  return '';
}

export function moatColliders(levels:Levels):Collider[]{
  const state=moatForLevels(levels);if(!state.filled)return [];
  const result:Collider[]=[];
  for(let i=0;i<192;i++){
    const a=i*Math.PI*2/192,b=(i+1)*Math.PI*2/192;
    const x=Math.cos((a+b)/2)*MOAT_RADIUS,z=Math.sin((a+b)/2)*MOAT_RADIUS;
    if(state.bridges&&Math.min(Math.abs(x),Math.abs(z))<5.5)continue;
    result.push({kind:'segment',ax:Math.cos(a)*MOAT_RADIUS,az:Math.sin(a)*MOAT_RADIUS,bx:Math.cos(b)*MOAT_RADIUS,bz:Math.sin(b)*MOAT_RADIUS,r:MOAT_HALF_WIDTH});
  }
  result.push({kind:'segment',ax:MOAT_FEED_X,az:MOAT_FEED_START,bx:MOAT_FEED_X,bz:MOAT_FEED_END,r:MOAT_HALF_WIDTH});
  return result;
}

export const MOAT_FEED_SHARE=.12;
export const MOAT_START_ANGLE=Math.atan2(MOAT_FEED_START,MOAT_FEED_X);
export function moatRoutePoint(t:number){
  if(t<=MOAT_FEED_SHARE)return {x:MOAT_FEED_X,z:MOAT_FEED_END+(MOAT_FEED_START-MOAT_FEED_END)*t/MOAT_FEED_SHARE};
  const a=MOAT_START_ANGLE+(t-MOAT_FEED_SHARE)/(1-MOAT_FEED_SHARE)*Math.PI*2;
  return {x:Math.cos(a)*MOAT_RADIUS,z:Math.sin(a)*MOAT_RADIUS};
}
export function moatRouteParameter(x:number,z:number){
  if(z<MOAT_FEED_START&&Math.abs(x-MOAT_FEED_X)<6)return Math.max(0,Math.min(1,(z-MOAT_FEED_END)/(MOAT_FEED_START-MOAT_FEED_END)))*MOAT_FEED_SHARE;
  const angle=(Math.atan2(z,x)-MOAT_START_ANGLE+Math.PI*4)%(Math.PI*2);
  return MOAT_FEED_SHARE+angle/(Math.PI*2)*(1-MOAT_FEED_SHARE);
}
