import * as THREE from 'three';
import { terrainHeight } from './environment';
import { PLANET_RADIUS, planetElevation } from './planet-geography';
export { PLANET_RADIUS } from './planet-geography';

export const PLANET_SAVE_KEY = 'davstep.choice-planet.v3';

/** Stereographic projection: the original town coordinates remain the source of truth. */
export function planetNormal(x:number,z:number):THREE.Vector3 {
  const u=x/(2*PLANET_RADIUS),v=z/(2*PLANET_RADIUS),d=1+u*u+v*v;
  return new THREE.Vector3(2*u/d,(1-u*u-v*v)/d,2*v/d);
}
export function planetPoint(x:number,y:number,z:number):THREE.Vector3 {
  const scale=1/(1+(x*x+z*z)/(4*PLANET_RADIUS*PLANET_RADIUS));
  const n=planetNormal(x,z);
  return n.multiplyScalar(PLANET_RADIUS+planetElevation(n)+(y-terrainHeight(x,z))*scale);
}
/** Inverse projection for picking the original, unchanged project bounds. */
export function planetToTown(point:THREE.Vector3):THREE.Vector3 {
  const radius=point.length(),n=point.clone().divideScalar(radius);
  const x=2*PLANET_RADIUS*n.x/Math.max(1e-6,1+n.y),z=2*PLANET_RADIUS*n.z/Math.max(1e-6,1+n.y);
  return new THREE.Vector3(x,terrainHeight(x,z)+(radius-PLANET_RADIUS-planetElevation(n))*(1+(x*x+z*z)/(4*PLANET_RADIUS*PLANET_RADIUS)),z);
}

export const PLANET_GROUND_SIZE=768;
let sourceGroundData:Float32Array|undefined;
export function planetSourceGroundData():Float32Array {
  if(!sourceGroundData){
    const size=PLANET_GROUND_SIZE;
    sourceGroundData=new Float32Array(size*size);
    for(let z=0;z<size;z++)for(let x=0;x<size;x++)sourceGroundData[z*size+x]=terrainHeight(((x+.5)/size-.5)*512,((z+.5)/size-.5)*512);
  }
  return sourceGroundData;
}
/** Matches the GPU's bilinear source-ground lookup for thin projected surface layers. */
export function planetSourceGroundHeight(x:number,z:number):number {
  const size=PLANET_GROUND_SIZE,data=planetSourceGroundData(),gx=(x/512+.5)*size-.5,gz=(z/512+.5)*size-.5;
  const ix=Math.floor(gx),iz=Math.floor(gz),tx=gx-ix,tz=gz-iz;
  const value=(a:number,b:number)=>data[THREE.MathUtils.clamp(b,0,size-1)*size+THREE.MathUtils.clamp(a,0,size-1)];
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(value(ix,iz),value(ix+1,iz),tx),THREE.MathUtils.lerp(value(ix,iz+1),value(ix+1,iz+1),tx),tz);
}
