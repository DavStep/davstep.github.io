import * as THREE from 'three';
import type { Plot } from './model';
import { accessPathFor } from './town-plan';
import { districtForPlot, IDEA_DISTRICTS } from './idea-districts';

/** Authored entrances face +Z. Keep a stable street-facing heading through every upgrade. */
export function planetBuildingYaw(plot:Plot):number {
  // The mill has a separately animated rotor, race and farm; the castle anchors the square.
  if(plot.kind==='mill'||plot.kind==='castle')return 0;
  let destination:{x:number;z:number}|undefined;
  const district=districtForPlot(plot.id);
  if(district&&Math.hypot(plot.x,plot.z)>55){
    const route=IDEA_DISTRICTS[district].route;
    let nearest=Infinity;
    for(let i=1;i<route.length;i++){
      const a=route[i-1],b=route[i],dx=b[0]-a[0],dz=b[1]-a[1];
      const t=THREE.MathUtils.clamp(((plot.x-a[0])*dx+(plot.z-a[1])*dz)/(dx*dx+dz*dz),0,1);
      const point={x:a[0]+dx*t,z:a[1]+dz*t},distance=Math.hypot(point.x-plot.x,point.z-plot.z);
      if(distance<nearest){nearest=distance;destination=point;}
    }
  }else{
    const access=accessPathFor(plot);
    if(access)destination={x:access.x2,z:access.z2};
  }
  if(!destination)return 0;
  const dx=destination.x-plot.x,dz=destination.z-plot.z;
  return Math.hypot(dx,dz)<.01?Math.atan2(-plot.x,-plot.z):Math.atan2(dx,dz);
}

/** Camera orbit is equivalent to spinning the globe beneath this fixed studio sun. */
export function planetSunDirection(cameraRotation:THREE.Quaternion,target=new THREE.Vector3()){
  return target.set(-.65,.85,1.2).normalize().applyQuaternion(cameraRotation);
}

export const PLANET_CAMERA_NEAR=10;
