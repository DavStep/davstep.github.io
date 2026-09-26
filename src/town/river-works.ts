import * as THREE from 'three';
import { MAT } from './materials';

export const RIVER_DIG_SECONDS=4.4;
export const RIVER_FLOW_SECONDS=2.8;
export const RIVER_WORK_SECONDS=RIVER_DIG_SECONDS+RIVER_FLOW_SECONDS;
export type RiverPoint={x:number;z:number};
export const channelFront=(progress:number,position:number)=>THREE.MathUtils.clamp((progress*1.12-position)/.12,0,1);
export function riverWorkProgress(seconds:number){
  return {dig:THREE.MathUtils.clamp(seconds/RIVER_DIG_SECONDS,0,1),flow:THREE.MathUtils.clamp((seconds-RIVER_DIG_SECONDS)/RIVER_FLOW_SECONDS,0,1)};
}

/** Survey markers and a moving water front for staged excavation. */
export class RiverWorks {
  readonly group=new THREE.Group();
  readonly markers=new THREE.Group();
  private readonly foam:THREE.InstancedMesh;
  private readonly geometries=new Set<THREE.BufferGeometry>();
  // Lit so the working foam dims with the scene instead of glowing at night.
  private readonly foamPaint=new THREE.MeshStandardMaterial({color:0xdfe8e2,roughness:1,metalness:0,transparent:true,opacity:.7,depthWrite:false});
  private readonly dummy=new THREE.Object3D();
  private active=false;
  private elapsed=0;
  get digProgress(){return this.active?riverWorkProgress(this.elapsed).dig:0;}
  get flowProgress(){return this.active?riverWorkProgress(this.elapsed).flow:0;}
  get working(){return this.active&&this.elapsed<RIVER_WORK_SECONDS;}
  constructor(parent:THREE.Group,mobile:boolean,private readonly point:(t:number)=>RiverPoint,private readonly ground:(x:number,z:number)=>number,private readonly surface:(t:number)=>number,private readonly bankWidth=7.6,private readonly workRange:readonly [number,number]=[.04,.98]){
    this.group.name='River_excavation';this.markers.name='River_survey';this.group.add(this.markers);parent.add(this.group);
    const box=new THREE.BoxGeometry(1,1,1),foamGeometry=new THREE.IcosahedronGeometry(1,0);this.geometries.add(box);this.geometries.add(foamGeometry);
    const block=(parent:THREE.Group,x:number,y:number,z:number,w:number,h:number,d:number,mat:THREE.Material)=>{
      const m=new THREE.Mesh(box,mat);m.position.set(x,y,z);m.scale.set(w,h,d);m.castShadow=!mobile;parent.add(m);return m;
    };
    for(let i=1;i<10;i++){
      const p=this.bankPoint(this.workRange[0]+i/10*(this.workRange[1]-this.workRange[0]),1);block(this.markers,p.x,this.ground(p.x,p.z)+.5,p.z,.12,1,.12,MAT.woodDark);
      block(this.markers,p.x+.18,this.ground(p.x,p.z)+.9,p.z,.45,.25,.08,MAT.gold);
    }
    this.foam=new THREE.InstancedMesh(foamGeometry,this.foamPaint,mobile?10:20);this.foam.frustumCulled=false;this.group.add(this.foam);
    this.setActive(false,true);this.markers.visible=false;
  }
  private bankPoint(t:number,side:number){
    const p=this.point(t),a=this.point(Math.max(0,t-.002)),b=this.point(Math.min(1,t+.002)),dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz)||1;
    return {x:p.x+dz/length*this.bankWidth*side,z:p.z-dx/length*this.bankWidth*side,yaw:Math.atan2(-dz*side,dx*side)};
  }
  setActive(active:boolean,instant=false){
    if(active!==this.active){this.active=active;this.elapsed=0;}
    if(instant&&active)this.elapsed=RIVER_WORK_SECONDS;
    this.update(0);
  }
  update(dt:number,reduced=false){
    if(this.active)this.elapsed=reduced?RIVER_WORK_SECONDS:Math.min(RIVER_WORK_SECONDS,this.elapsed+Math.max(0,dt));
    this.foam.visible=this.working&&this.flowProgress>0;
    if(this.foam.visible)for(let i=0;i<this.foam.count;i++){
      const t=THREE.MathUtils.clamp(this.flowProgress*1.02-i*.0015,0,1),p=this.point(t),a=this.point(Math.max(0,t-.003)),b=this.point(Math.min(1,t+.003));
      const dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz)||1,side=(i/(this.foam.count-1)-.5)*4.5;
      this.dummy.position.set(p.x+dz/length*side,this.surface(t)+.05+Math.sin(i+this.elapsed*6)*.04,p.z-dx/length*side);
      this.dummy.rotation.set(0,0,0);this.dummy.scale.set(.24,.07,.3);this.dummy.updateMatrix();this.foam.setMatrixAt(i,this.dummy.matrix);
    }
    this.foam.instanceMatrix.needsUpdate=true;
  }
  dispose(){
    this.group.removeFromParent();this.foam.dispose();this.geometries.forEach(g=>g.dispose());this.foamPaint.dispose();this.group.clear();
  }
}
