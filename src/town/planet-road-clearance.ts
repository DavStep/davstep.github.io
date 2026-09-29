import type { TownSnapshot } from './model';
import { planetBuildingAccess,type RoadPoint } from './planet-building-access';
import type { RoadSegment } from './planet-roads';
import { planetRiverPoint,planetCropContains } from './planet-rivers';
import { wallFootprintSafe } from './planet-settlements';
import { wallIsGate } from './wall-layout';
import { planetTransportState,harborHut } from './planet-transport-layout';
import { INFRASTRUCTURE } from './town-plan';

/** Spatial lookup for vegetation: construction clears a corridor, not the whole island. */
export function planetRoadClearance(snapshot:TownSnapshot,segments:readonly RoadSegment[],reserveCrops=true){
  const transport=planetTransportState(snapshot);
  const buildings=snapshot.plots.filter(p=>p.stage>0).map(planetBuildingAccess);
  const river=snapshot.riverLevel?Array.from({length:65},(_,i)=>planetRiverPoint(i/64)):[];
  const cropField=Boolean(snapshot.riverLevel)&&snapshot.plots.some(p=>p.kind==='mill'&&p.stage>0);
  const walls=[...(snapshot.innerWood?[INFRASTRUCTURE.wall.innerRadius]:[]),...(snapshot.outerWood?[INFRASTRUCTURE.wall.outerRadius]:[])];
  const cells=new Map<string,RoadSegment[]>(),cellSize=8;
  const access=[...transport.bridges.map(({a,b})=>({a,b})),...transport.harbors.flatMap(h=>[{a:h.land,b:h.sea},...((snapshot.riverLevel??0)>=2?[{a:harborHut(h).door,b:h.land}]:[])])];
  for(const segment of [...segments,...access]){
    const {a,b}=segment;
    for(let x=Math.floor(Math.min(a.x,b.x)/cellSize);x<=Math.floor(Math.max(a.x,b.x)/cellSize);x++)
      for(let z=Math.floor(Math.min(a.z,b.z)/cellSize);z<=Math.floor(Math.max(a.z,b.z)/cellSize);z++){
        const key=`${x}/${z}`;cells.set(key,[...(cells.get(key)??[]),segment]);
      }
  }
  return (point:RoadPoint,radius:number)=>{
    if(transport.harbors.some(h=>Math.hypot(point.x-h.land.x,point.z-h.land.z)<radius+2||((snapshot.riverLevel??0)>=2&&Math.hypot(point.x-harborHut(h).center.x,point.z-harborHut(h).center.z)<radius+3)))return true;
    if(buildings.some(entry=>entry.contains(point,radius+.5)))return true;
    if(river.some(p=>Math.hypot(point.x-p.x,point.z-p.z)<radius+2.6))return true;
    if(reserveCrops&&cropField&&planetCropContains(point.x,point.z,radius+1))return true;
    const distance=Math.hypot(point.x,point.z),angle=(Math.atan2(point.z,point.x)+Math.PI*2)%(Math.PI*2);
    if(walls.some(w=>Math.abs(distance-w)<radius+1.2)&&!wallIsGate(Math.floor(angle/(Math.PI*2)*32),snapshot.wallGates)&&wallFootprintSafe(point.x,point.z))return true;
    const reach=radius+1;
    for(let x=Math.floor((point.x-reach)/cellSize);x<=Math.floor((point.x+reach)/cellSize);x++)
      for(let z=Math.floor((point.z-reach)/cellSize);z<=Math.floor((point.z+reach)/cellSize);z++)
        for(const {a,b} of cells.get(`${x}/${z}`)??[]){
          const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.z-a.z)*dz)/(dx*dx+dz*dz)));
          if(Math.hypot(point.x-a.x-dx*t,point.z-a.z-dz*t)<reach)return true;
        }
    return false;
  };
}
