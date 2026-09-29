import * as THREE from 'three';
import type { Idea } from './game';

/** Frame the extent of the change; only a single new crossing needs a close-up. */
export function planetEventView(idea:Idea,level:number,singleCrossing=false):'planet'|'site'{
  if(idea==='grove'&&level>1)return 'planet';
  if(idea==='roads'&&!singleCrossing)return 'planet';
  if(idea==='walls'||(idea==='river'&&level>=3))return 'planet';
  return 'site';
}

/** Smooth shortest-arc orbit: the camera never takes a chord through the globe. */
export class PlanetCameraMove {
  readonly duration:number;
  private readonly startRadius:number;
  private readonly endRadius:number;
  private readonly direction:THREE.Vector3;
  private readonly turn:THREE.Quaternion;
  private readonly rotation=new THREE.Quaternion();
  constructor(start:THREE.Vector3,end:THREE.Vector3,private readonly startLook:THREE.Vector3,private readonly endLook:THREE.Vector3){
    this.startRadius=start.length();this.endRadius=end.length();
    this.direction=start.clone().normalize();
    const endDirection=end.clone().normalize();
    this.turn=new THREE.Quaternion().setFromUnitVectors(this.direction,endDirection);
    const angle=this.direction.angleTo(endDirection);
    this.duration=THREE.MathUtils.clamp(.65+angle*.5+Math.abs(this.startRadius-this.endRadius)*.0015,.65,1.9);
  }
  sample(seconds:number,position:THREE.Vector3,look:THREE.Vector3){
    const t=THREE.MathUtils.clamp(seconds/this.duration,0,1);
    const ease=t*t*t*(t*(t*6-15)+10);
    this.rotation.identity().slerp(this.turn,ease);
    position.copy(this.direction).applyQuaternion(this.rotation).multiplyScalar(THREE.MathUtils.lerp(this.startRadius,this.endRadius,ease));
    look.lerpVectors(this.startLook,this.endLook,ease);
    return t===1;
  }
}
