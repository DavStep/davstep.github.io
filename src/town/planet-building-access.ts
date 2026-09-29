import type { PlotState } from './model';
import { planetBuildingYaw } from './planet-placement';
import cottages from './generated/cottages.json';
import civic from './generated/civic.json';
import identity from './generated/civic-identity.json';
import landmarks from './generated/landmarks.json';
import castle from './generated/castle.json';

export type RoadPoint={x:number;z:number};
type Bounds={minX:number;maxX:number;minZ:number;maxZ:number};
const cache=new Map<string,Bounds>();
/** Ground-level authored geometry includes the wings, porches and landing pads. */
function footprint(plot:PlotState):Bounds{
  const family=plot.kind==='home'?['A','B','C'][((plot.variant??0)%3+3)%3]
    :plot.kind==='project'?plot.project:plot.kind==='castle'?'CASTLE'
    :plot.id==='post'||plot.id==='district-archive-great-library'?'archive':plot.kind;
  const porch=((plot.variant??0)%4+4)%4===2;
  const key=`${plot.kind}/${family}/${plot.stage}/${porch}`;
  const existing=cache.get(key);if(existing)return existing;
  const bounds:Bounds={minX:Infinity,maxX:-Infinity,minZ:Infinity,maxZ:-Infinity};
  const parts=plot.kind==='home'?cottages.parts:plot.kind==='project'?landmarks.parts
    :plot.kind==='castle'?castle.parts:[...civic.parts,...identity.parts];
  for(const part of parts){
    if(part.lod!==0||(part.family!==family&&part.family!=='COMMON')||plot.stage<part.minStage||plot.stage>part.maxStage)continue;
    if('porchOnly' in part&&part.porchOnly&&!porch)continue;
    for(let i=0;i<part.positions.length;i+=3){
      if(part.positions[i+1]>1.3)continue;
      bounds.minX=Math.min(bounds.minX,part.positions[i]);bounds.maxX=Math.max(bounds.maxX,part.positions[i]);
      bounds.minZ=Math.min(bounds.minZ,part.positions[i+2]);bounds.maxZ=Math.max(bounds.maxZ,part.positions[i+2]);
    }
  }
  if(!Number.isFinite(bounds.minX))Object.assign(bounds,plot.kind==='project'
    ?{minX:-4,maxX:4,minZ:-3.3,maxZ:3.3}:{minX:-2.3,maxX:2.3,minZ:-2,maxZ:2.9});
  // Household fences and log stores are added by the scene beside the authored shell.
  if(plot.kind==='home'&&plot.stage>=5)bounds.maxX=Math.max(bounds.maxX,3.35);
  cache.set(key,bounds);return bounds;
}
export function planetBuildingAccess(plot:PlotState){
  const yaw=planetBuildingYaw(plot),sin=Math.sin(yaw),cos=Math.cos(yaw),bounds=footprint(plot);
  // Doorsteps exported from Blender face +Z. Hero landmarks meet their landing pad.
  const front=plot.kind==='home'?(plot.stage<3?2.5:((plot.variant??0)%4===2?4.2:2.1))
    :plot.kind==='castle'?5.12:plot.kind==='project'?bounds.maxZ-.08
    :plot.kind==='mill'?2.48:2.68;
  const world=(x:number,z:number):RoadPoint=>({x:plot.x+x*cos+z*sin,z:plot.z-x*sin+z*cos});
  return {plot,door:world(0,front),approach:world(0,Math.max(front,bounds.maxZ)+1.8),
    contains(p:RoadPoint,margin=.82){
      const dx=p.x-plot.x,dz=p.z-plot.z,x=dx*cos-dz*sin,z=dx*sin+dz*cos;
      return x>bounds.minX-margin&&x<bounds.maxX+margin&&z>bounds.minZ-margin&&z<bounds.maxZ+margin;
    }};
}
