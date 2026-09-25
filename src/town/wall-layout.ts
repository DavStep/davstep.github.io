import { WALL_SEGMENTS } from './model';
import { INFRASTRUCTURE } from './town-plan';
import { MILL_POOL, millStreamDistance } from './game-path';

export interface WallPoint {x:number;z:number}
export const WALL_GATE_INTERVAL=INFRASTRUCTURE.wall.gateInterval;
// A crossing straddles two sectors so the road centerline has real clearance.
export const CARDINAL_GATE_MASK=[0,7,8,15,16,23,24,31].reduce((mask,index)=>mask|(1<<index),0);
export const wallIsGate=(index:number,mask?:number)=>mask===undefined?index%WALL_GATE_INTERVAL===0:(mask&(1<<index))!==0;

export function wallSection(radius:number,index:number){
  const step=Math.PI*2/WALL_SEGMENTS;
  const startAngle=index*step,endAngle=(index+1)*step,midAngle=(startAngle+endAngle)*.5;
  const start={x:Math.cos(startAngle)*radius,z:Math.sin(startAngle)*radius};
  const end={x:Math.cos(endAngle)*radius,z:Math.sin(endAngle)*radius};
  return {start,end,center:{x:(start.x+end.x)*.5,z:(start.z+end.z)*.5},angle:midAngle,
    length:Math.hypot(end.x-start.x,end.z-start.z),rotation:-midAngle-Math.PI/2};
}

export function wallSectionFlooded(radius:number,index:number,streamOpen:boolean):boolean{
  if(!streamOpen)return false;
  const section=wallSection(radius,index);
  for(let sample=0;sample<=8;sample++){
    const t=sample/8,x=section.start.x+(section.end.x-section.start.x)*t,z=section.start.z+(section.end.z-section.start.z)*t;
    if(millStreamDistance(x,z)<4.1||Math.hypot(x-MILL_POOL.x,z-MILL_POOL.z)<MILL_POOL.radius+.6)return true;
  }
  return false;
}
