import * as THREE from 'three';
import residentData from './generated/residents.json';
import { MAT } from './materials';

export const RIVER_DIG_SECONDS=4.4;
export const RIVER_FLOW_SECONDS=2.8;
export const RIVER_WORK_SECONDS=RIVER_DIG_SECONDS+RIVER_FLOW_SECONDS;
export type RiverPoint={x:number;z:number};
export const channelFront=(progress:number,position:number)=>THREE.MathUtils.clamp((progress*1.12-position)/.12,0,1);
export function riverWorkProgress(seconds:number){
  return {dig:THREE.MathUtils.clamp(seconds/RIVER_DIG_SECONDS,0,1),flow:THREE.MathUtils.clamp((seconds-RIVER_DIG_SECONDS)/RIVER_FLOW_SECONDS,0,1)};
}

/** A dedicated bank crew: authored residents with articulated shovels, soil and a moving foam front. */
export class RiverWorks {
  readonly group=new THREE.Group();
  readonly markers=new THREE.Group();
  private readonly workers:{root:THREE.Group;body:THREE.Group;arms:THREE.Group[]}[]=[];
  private readonly dirt:THREE.InstancedMesh;
  private readonly foam:THREE.InstancedMesh;
  private readonly geometries=new Set<THREE.BufferGeometry>();
  private readonly paint=new THREE.MeshStandardMaterial({color:0xc4a369,roughness:1});
  private readonly foamPaint=new THREE.MeshBasicMaterial({color:0xd6f7eb,transparent:true,opacity:.85,depthWrite:false});
  private readonly dummy=new THREE.Object3D();
  private active=false;
  private elapsed=0;
  get digProgress(){return this.active?riverWorkProgress(this.elapsed).dig:0;}
  get flowProgress(){return this.active?riverWorkProgress(this.elapsed).flow:0;}
  get working(){return this.active&&this.elapsed<RIVER_WORK_SECONDS;}
  constructor(parent:THREE.Group,mobile:boolean,private readonly point:(t:number)=>RiverPoint,private readonly ground:(x:number,z:number)=>number,private readonly surface:(t:number)=>number,private readonly bankWidth=7.6,private readonly workRange:readonly [number,number]=[.04,.98]){
    this.group.name='River_excavation';this.markers.name='River_survey';this.group.add(this.markers);parent.add(this.group);
    const geometry=(data:{positions:number[];normals:number[];indices:number[]})=>{
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(data.positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(data.normals,3));g.setIndex(data.indices);this.geometries.add(g);return g;
    };
    const bodyGeo=geometry(residentData.body);
    const limbs=Object.fromEntries(Object.entries(residentData.parts).map(([key,data])=>[key,geometry(data)]));
    const box=new THREE.BoxGeometry(1,1,1),soil=new THREE.IcosahedronGeometry(1,0);this.geometries.add(box);this.geometries.add(soil);
    const block=(parent:THREE.Group,x:number,y:number,z:number,w:number,h:number,d:number,mat:THREE.Material)=>{
      const m=new THREE.Mesh(box,mat);m.position.set(x,y,z);m.scale.set(w,h,d);m.castShadow=!mobile;parent.add(m);return m;
    };
    for(let i=1;i<10;i++){
      const p=this.bankPoint(this.workRange[0]+i/10*(this.workRange[1]-this.workRange[0]),1);block(this.markers,p.x,this.ground(p.x,p.z)+.5,p.z,.12,1,.12,MAT.woodDark);
      block(this.markers,p.x+.18,this.ground(p.x,p.z)+.9,p.z,.45,.25,.08,MAT.gold);
    }
    for(let i=0;i<(mobile?3:5);i++){
      const root=new THREE.Group(),body=new THREE.Group();root.name=`River_digger_${i}`;root.add(body);
      const mesh=new THREE.Mesh(bodyGeo,this.paint);mesh.castShadow=!mobile;body.add(mesh);
      const arms:THREE.Group[]=[];
      for(const key of ['arm_left','arm_right','leg_left','leg_right'] as const){
        const pivot=new THREE.Group();pivot.position.fromArray(residentData.parts[key].pivot);pivot.add(new THREE.Mesh(limbs[key],this.paint));body.add(pivot);
        if(key.startsWith('arm'))arms.push(pivot);
      }
      const shovel=new THREE.Group();shovel.position.set(.35,-.3,.2);shovel.rotation.x=.25;
      block(shovel,0,.1,0,.09,1.5,.09,MAT.woodDark);block(shovel,0,-.75,0,.46,.46,.08,MAT.iron);
      arms[1].add(shovel);root.scale.setScalar(1.25);this.workers.push({root,body,arms});this.group.add(root);
    }
    this.dirt=new THREE.InstancedMesh(soil,MAT.earth,this.workers.length*6);this.dirt.frustumCulled=false;this.group.add(this.dirt);
    this.foam=new THREE.InstancedMesh(soil,this.foamPaint,mobile?10:20);this.foam.frustumCulled=false;this.group.add(this.foam);
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
    const digging=this.working&&this.digProgress<1;
    for(const [i,w] of this.workers.entries()){
      w.root.visible=digging;
      if(!digging)continue;
      // Crew members each excavate a section, advancing along their bank.
      const local=(i+this.digProgress)/this.workers.length;
      const t=this.workRange[0]+local*(this.workRange[1]-this.workRange[0]),p=this.bankPoint(t,1);
      w.root.position.set(p.x,this.ground(p.x,p.z)+.04,p.z);w.root.rotation.y=p.yaw;
      const strike=Math.sin(this.elapsed*7+i*1.9);w.body.rotation.x=.12+Math.max(0,strike)*.3;
      w.arms[0].rotation.x=-.8+strike*.5;w.arms[1].rotation.x=-1.1+strike*1.1;
      for(let j=0;j<6;j++){
        const cycle=(this.elapsed*1.5+i*.17+j/6)%1,angle=j*2.4;
        this.dummy.position.set(p.x+Math.cos(angle)*cycle*1.6,w.root.position.y+.25+Math.sin(cycle*Math.PI)*1.7,p.z+Math.sin(angle)*cycle*1.6);
        this.dummy.rotation.set(cycle*4,angle,cycle*2);this.dummy.scale.setScalar(.18*(1-cycle));this.dummy.updateMatrix();this.dirt.setMatrixAt(i*6+j,this.dummy.matrix);
      }
    }
    this.dirt.visible=digging;this.dirt.instanceMatrix.needsUpdate=true;
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
    this.group.removeFromParent();this.dirt.dispose();this.foam.dispose();this.geometries.forEach(g=>g.dispose());this.paint.dispose();this.foamPaint.dispose();this.group.clear();
  }
}
