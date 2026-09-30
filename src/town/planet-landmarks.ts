import type { PlotState } from './model';
import landmarks from './generated/landmarks.json';

/** Hero architecture dominates its district while leaving the neighboring streets open. */
export const PLANET_LANDMARK_SCALE={footprint:1.7,height:2.2} as const;
const heights=new Map<string,number>();
/** Source-plane height shared by geometry, labels, picking and the summit attachment. */
export function planetLandmarkHeight(project:NonNullable<PlotState['project']>,stage:number){
  const tier=Math.max(3,Math.min(6,stage)),key=`${project}/${tier}`;
  let height=heights.get(key);
  if(height===undefined){
    height=0;
    for(const part of landmarks.parts)if(part.family===project&&part.lod===0&&tier>=part.minStage&&tier<=part.maxStage)
      for(let i=1;i<part.positions.length;i+=3)height=Math.max(height,part.positions[i]);
    height*=PLANET_LANDMARK_SCALE.height;heights.set(key,height);
  }
  return height;
}
