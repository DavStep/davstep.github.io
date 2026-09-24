import { moveWithCollisions, type Collider, type Point } from './collision';

export interface MoveInput {x:number;z:number;sprint:boolean}

// Camera movement shares the town's ground collision map without creating an
// avatar. Velocity eases in and out; the final position always respects walls.
export class RoamController {
  readonly position:Point={x:7,z:10};
  private velocity:Point={x:0,z:0};
  setPosition(point:Point){this.position.x=point.x;this.position.z=point.z;this.velocity.x=0;this.velocity.z=0;}
  stop(){this.velocity.x=0;this.velocity.z=0;}
  update(dt:number,input:MoveInput,azimuth:number,colliders:readonly Collider[]){
    dt=Math.min(dt,.05);
    const length=Math.hypot(input.x,input.z);
    const side=length?input.x/Math.max(1,length):0;
    const forward=length?input.z/Math.max(1,length):0;
    const speed=input.sprint?12:7.5;
    const targetX=(Math.sin(azimuth)*side-Math.cos(azimuth)*forward)*speed;
    const targetZ=(-Math.cos(azimuth)*side-Math.sin(azimuth)*forward)*speed;
    const easing=1-Math.exp(-dt*(length?12:9));
    this.velocity.x+=(targetX-this.velocity.x)*easing;
    this.velocity.z+=(targetZ-this.velocity.z)*easing;
    const previousX=this.position.x,previousZ=this.position.z;
    const next=moveWithCollisions(this.position,{x:this.velocity.x*dt,z:this.velocity.z*dt},colliders,.72);
    if(Math.abs(next.x-previousX)<.0001)this.velocity.x=0;
    if(Math.abs(next.z-previousZ)<.0001)this.velocity.z=0;
    this.position.x=next.x;this.position.z=next.z;
  }
}
