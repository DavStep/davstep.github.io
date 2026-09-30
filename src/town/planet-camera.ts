import * as THREE from 'three';
import type { Idea } from './game';

/** Rotate the view around the globe using its screen axes, including over poles. */
export class PlanetOrbit {
  private readonly current=new THREE.Quaternion();
  private readonly desired=new THREE.Quaternion();
  private readonly inverse=new THREE.Quaternion();
  private readonly turn=new THREE.Quaternion();
  private readonly axis=new THREE.Vector3();
  private readonly direction=new THREE.Vector3();
  private readonly focus=new THREE.Vector3();
  private readonly velocity=new THREE.Vector2();
  private readonly spin=new THREE.Vector2(-1,0);
  private dragging=false;
  private lastDrag=0;
  start(camera:THREE.PerspectiveCamera,look:THREE.Vector3){
    this.cancelMotion();
    this.current.copy(camera.quaternion);this.desired.copy(this.current);
    this.inverse.copy(this.current).invert();
    this.direction.copy(camera.position).normalize().applyQuaternion(this.inverse);
    this.focus.copy(look).applyQuaternion(this.inverse);
  }
  rotate(dx:number,dy:number){
    const angle=Math.hypot(dx,dy);if(!angle)return;
    this.spin.set(dx,dy).divideScalar(angle);
    // Move the camera opposite the drag so the surface follows the hand.
    this.axis.set(-dy,-dx,0).divideScalar(angle);
    this.turn.setFromAxisAngle(this.axis,angle);
    this.desired.multiply(this.turn).normalize();
  }
  beginDrag(time:number){this.cancelMotion();this.dragging=true;this.lastDrag=time;}
  drag(dx:number,dy:number,time:number){
    this.rotate(dx,dy);
    const dt=Math.max((time-this.lastDrag)/1000,1/120),speed=Math.hypot(dx,dy)/dt;
    if(speed){
      this.spin.set(dx,dy).normalize();
      this.velocity.set(dx/dt,dy/dt).clampLength(0,1.8);
    }else this.velocity.set(0,0);
    this.lastDrag=time;
  }
  endDrag(time:number,cancelled=false){
    this.dragging=false;
    if(cancelled||time-this.lastDrag>100)this.velocity.set(0,0);
  }
  cancelMotion(){this.dragging=false;this.velocity.set(0,0);}
  /** Coast after release, easing into a slow spin along the last drag direction. */
  advance(dt:number,idleSpeed=0){
    if(this.dragging||dt<=0)return;
    const decay=Math.exp(-dt*3.5),travel=(1-decay)/3.5;
    const vx=this.spin.x*idleSpeed,vy=this.spin.y*idleSpeed;
    this.rotate(vx*dt+(this.velocity.x-vx)*travel,vy*dt+(this.velocity.y-vy)*travel);
    this.velocity.set(vx+(this.velocity.x-vx)*decay,vy+(this.velocity.y-vy)*decay);
  }
  sample(blend:number,radius:number,position:THREE.Vector3,look:THREE.Vector3,up:THREE.Vector3){
    this.current.slerp(this.desired,blend);
    position.copy(this.direction).applyQuaternion(this.current).multiplyScalar(radius);
    look.copy(this.focus).applyQuaternion(this.current);
    up.set(0,1,0).applyQuaternion(this.current);
  }
}

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
  private readonly startView:THREE.Quaternion;
  private readonly endView:THREE.Quaternion;
  private readonly view=new THREE.Quaternion();
  constructor(start:THREE.Vector3,end:THREE.Vector3,private readonly startLook:THREE.Vector3,private readonly endLook:THREE.Vector3,startUp=new THREE.Vector3(0,1,0),endUp=new THREE.Vector3(0,1,0)){
    this.startRadius=start.length();this.endRadius=end.length();
    this.direction=start.clone().normalize();
    const endDirection=end.clone().normalize();
    this.turn=new THREE.Quaternion().setFromUnitVectors(this.direction,endDirection);
    const angle=this.direction.angleTo(endDirection);
    this.duration=THREE.MathUtils.clamp(.65+angle*.5+Math.abs(this.startRadius-this.endRadius)*.0015,.65,1.9);
    const basis=new THREE.Matrix4();
    this.startView=new THREE.Quaternion().setFromRotationMatrix(basis.lookAt(start,startLook,startUp));
    this.endView=new THREE.Quaternion().setFromRotationMatrix(basis.lookAt(end,endLook,endUp));
  }
  sample(seconds:number,position:THREE.Vector3,look:THREE.Vector3,up?:THREE.Vector3){
    const t=THREE.MathUtils.clamp(seconds/this.duration,0,1);
    const ease=t*t*t*(t*(t*6-15)+10);
    this.rotation.identity().slerp(this.turn,ease);
    position.copy(this.direction).applyQuaternion(this.rotation).multiplyScalar(THREE.MathUtils.lerp(this.startRadius,this.endRadius,ease));
    look.lerpVectors(this.startLook,this.endLook,ease);
    if(up)up.set(0,1,0).applyQuaternion(this.view.copy(this.startView).slerp(this.endView,ease));
    return t===1;
  }
}
