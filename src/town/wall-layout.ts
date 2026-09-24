import { WALL_SEGMENTS } from './model';
import { INFRASTRUCTURE } from './town-plan';

export interface WallPoint {x:number;z:number}
export const WALL_GATE_INTERVAL=INFRASTRUCTURE.wall.gateInterval;
export const wallIsGate=(index:number)=>index%WALL_GATE_INTERVAL===0;

export function wallSection(radius:number,index:number){
  const step=Math.PI*2/WALL_SEGMENTS;
  const startAngle=index*step,endAngle=(index+1)*step,midAngle=(startAngle+endAngle)*.5;
  const start={x:Math.cos(startAngle)*radius,z:Math.sin(startAngle)*radius};
  const end={x:Math.cos(endAngle)*radius,z:Math.sin(endAngle)*radius};
  return {start,end,center:{x:(start.x+end.x)*.5,z:(start.z+end.z)*.5},angle:midAngle,
    length:Math.hypot(end.x-start.x,end.z-start.z),rotation:-midAngle-Math.PI/2};
}
