import { riverCenter } from './river-layout';
export interface RegionPoint {x:number;z:number}
const points=(rows:number[][]):RegionPoint[]=>rows.map(([x,z])=>({x,z}));
export const FRONTIER_RIVERS=[
  points([[110,riverCenter(110)],[114,-48],[115,0],[116,55]]),
  points([[-118,riverCenter(-118)],[-119,-48],[-120,5],[-120,40]]),
  points([[116,55],[108,90],[80,117],[20,117],[-70,117]]),
  points([[116,55],[128,69]]),
  points([[174,44],[163,46],[158,53],[151,57],[140,62],[124,65]]),
];
export const FRONTIER_ROADS=[
  points([[-112,0],[-130,12],[-130,49],[-132,73]]),
  points([[106,29],[105,8],[128,8],[137,23],[137,37]]),
  points([[0,105],[0,133],[-46,133],[-80,142],[0,133],[43,136],[72,140],[100,145]]),
  points([[128,8],[145,0],[155,-12],[160,-12],[163,3],[173,18]]),
  points([[-130,49],[-140,70],[-150,90],[-150,100],[-128,110],[-140,122],[-150,132]]),
];
export function routeSample(route:readonly RegionPoint[],t:number):RegionPoint{
  const lengths=route.slice(1).map((p,i)=>Math.hypot(p.x-route[i].x,p.z-route[i].z)),total=lengths.reduce((a,b)=>a+b,0);
  let left=Math.max(0,Math.min(1,t))*total;
  for(let i=0;i<lengths.length;i++){if(left<=lengths[i]||i===lengths.length-1){const a=route[i],b=route[i+1],f=left/lengths[i];return {x:a.x+(b.x-a.x)*f,z:a.z+(b.z-a.z)*f};}left-=lengths[i];}
  return route[0];
}
export function routeNearest(route:readonly RegionPoint[],x:number,z:number){
  let distance=Infinity,t=0,walked=0;
  const lengths=route.slice(1).map((p,i)=>Math.hypot(p.x-route[i].x,p.z-route[i].z)),total=lengths.reduce((a,b)=>a+b,0);
  for(let i=0;i<lengths.length;i++){
    const a=route[i],b=route[i+1],dx=b.x-a.x,dz=b.z-a.z;
    const f=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(lengths[i]**2)));
    const d=Math.hypot(x-a.x-dx*f,z-a.z-dz*f);
    if(d<distance){distance=d;t=(walked+f*lengths[i])/total;}walked+=lengths[i];
  }
  return {distance,t};
}
export function regionalRiverWidth(index:number,t:number){return index===3?2.5+5.5*Math.sin(Math.PI*Math.max(0,(t-.15)/.85)):(index===4?2.1:2.7);}
export function isFrontierCorridor(x:number,z:number){
  return FRONTIER_ROADS.some(r=>routeNearest(r,x,z).distance<5)||FRONTIER_RIVERS.some((r,i)=>{const n=routeNearest(r,x,z);return n.distance<regionalRiverWidth(i,n.t)+5;});
}
export function isRegionalRiverCorridor(x:number,z:number){
  return FRONTIER_RIVERS.some((route,index)=>{const near=routeNearest(route,x,z);return near.distance<regionalRiverWidth(index,near.t)+5;});
}
