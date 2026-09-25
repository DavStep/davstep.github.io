import * as THREE from 'three';
import type { Idea } from './game';
import { terrainHeight } from './environment';
import { IDEA_COLORS } from './idea-colors';
import { bodyGeometry, limbGeometries, planConstructionCrew } from './residents';
import residentData from './generated/residents.json';

type WorkPoint = { x:number; z:number };
type LimbName = keyof typeof limbGeometries;
interface Visit {
  origin:WorkPoint;
  spot:WorkPoint;
  target:WorkPoint;
  started:number;
  leavingAt:number|null;
  reduced:boolean;
}
const ease=(value:number)=>{const t=THREE.MathUtils.clamp(value,0,1);return t*t*(3-2*t);};

/** One colored visitor for the clicked idea, hidden between choices. */
export class ChoiceWorker {
  readonly group=new THREE.Group();
  private readonly root=new THREE.Group();
  private readonly body=new THREE.Group();
  private readonly arms:[THREE.Group,THREE.Group];
  private readonly legs:[THREE.Group,THREE.Group];
  private readonly paint=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.87});
  private readonly shadowPaint=new THREE.MeshBasicMaterial({color:0x37585a,transparent:true,opacity:.18,depthWrite:false});
  private readonly shadowGeometry=new THREE.CircleGeometry(.48,12);
  private visit:Visit|null=null;

  constructor(scene:THREE.Scene){
    this.group.name='Choice_worker_visit';
    this.root.name='Choice_worker';
    const torso=new THREE.Mesh(bodyGeometry,this.paint);torso.castShadow=true;this.body.add(torso);
    const limb=(name:LimbName)=>{
      const pivot=new THREE.Group();pivot.position.fromArray(residentData.parts[name].pivot);
      const mesh=new THREE.Mesh(limbGeometries[name],this.paint);mesh.castShadow=true;pivot.add(mesh);this.body.add(pivot);
      return pivot;
    };
    this.arms=[limb('arm_left'),limb('arm_right')];
    this.legs=[limb('leg_left'),limb('leg_right')];
    this.root.add(this.body);
    const shadow=new THREE.Mesh(this.shadowGeometry,this.shadowPaint);shadow.rotation.x=-Math.PI/2;shadow.position.y=.03;this.root.add(shadow);
    this.root.scale.setScalar(1.6);
    this.root.visible=false;this.group.add(this.root);scene.add(this.group);
  }

  startCue(idea:Idea,target:WorkPoint,isClear:(x:number,z:number)=>boolean,reduced=false,now=performance.now()/1000):void{
    const route=planConstructionCrew(target,1,isClear)[0];
    const spot=route?.spot??{x:target.x+4,z:target.z+4};
    const origin=route?.origin??{x:spot.x+4,z:spot.z+4};
    this.visit={origin,spot,target,started:now,leavingAt:null,reduced};
    this.root.name=`Choice_worker_${idea}`;
    this.paint.color.setHex(IDEA_COLORS[idea]);
    this.root.visible=true;
    this.update(now);
  }

  finishCue(instant=false,now=performance.now()/1000):void{
    if(!this.visit)return;
    if(instant||this.visit.reduced){this.visit=null;this.root.visible=false;return;}
    if(this.visit.leavingAt===null)this.visit.leavingAt=now;
  }

  update(now=performance.now()/1000):void{
    const visit=this.visit;
    if(!visit){this.root.visible=false;return;}
    const arriving=visit.leavingAt===null;
    const progress=visit.reduced?1:ease(arriving?(now-visit.started)/.85:(now-visit.leavingAt!)/1.05);
    if(!arriving&&progress>=1){this.visit=null;this.root.visible=false;return;}
    const from=arriving?visit.origin:visit.spot,to=arriving?visit.spot:visit.origin;
    const x=THREE.MathUtils.lerp(from.x,to.x,progress),z=THREE.MathUtils.lerp(from.z,to.z,progress);
    this.root.position.set(x,terrainHeight(x,z),z);
    const facing=arriving&&progress>.85?visit.target:{x:to.x,z:to.z};
    this.root.rotation.y=Math.atan2(facing.x-x,facing.z-z);
    const walking=!visit.reduced&&(arriving?progress<.98:true);
    const stride=walking?Math.sin(now*11)*.45:0;
    const working=arriving&&progress>.96&&!visit.reduced;
    const strike=working?Math.sin(now*8):0;
    this.legs[0].rotation.x=stride;this.legs[1].rotation.x=-stride;
    this.arms[0].rotation.x=working?-.45-strike*.35:-stride*.65;
    this.arms[1].rotation.x=working?-.85+strike*.65:stride*.65;
    this.arms[0].rotation.z=1.7;this.arms[1].rotation.z=-1.7;
    this.body.rotation.x=working?Math.max(0,strike)*.14:0;
    this.body.position.y=walking?Math.abs(stride)*.12:0;
  }

  dispose():void{
    this.group.removeFromParent();
    this.paint.dispose();this.shadowPaint.dispose();this.shadowGeometry.dispose();
  }
}
