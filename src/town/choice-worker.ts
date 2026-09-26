import * as THREE from 'three';
import type { Idea } from './game';
import { terrainHeight } from './environment';
import { IDEA_COLORS } from './idea-colors';
import { bodyDetailGeometry, bodyGeometry, limbDetailGeometries, limbGeometries, planConstructionCrew } from './residents';
import { easeOutBack, smooth } from './juice';
import residentData from './generated/residents.json';

type WorkPoint = { x:number; z:number };
type LimbName = keyof typeof limbGeometries;
type Phase = 'arrive' | 'work' | 'cheer' | 'leave' | 'gone';

export interface CrewHooks {
  /** A hammer lands on the worksite. */
  strike?: (x:number,y:number,z:number)=>void;
  /** A worker pops into or out of existence. */
  pop?: (x:number,y:number,z:number,appearing:boolean)=>void;
  /** The crew celebrates a finished stage. */
  cheer?: ()=>void;
}

const ARRIVE=1.05, LEAVE=.95, POP=.22, CHEER=1.05;
const lerp=THREE.MathUtils.lerp;

// Shared cartoon props: a carried plank or stone, a hat and a mallet.
const plankGeometry=new THREE.BoxGeometry(1.5,.18,.5);
const stoneGeometry=new THREE.BoxGeometry(.72,.5,.6);
const hatGeometry=new THREE.CylinderGeometry(.36,.56,.3,14).translate(0,.15,0);
const brimGeometry=new THREE.CylinderGeometry(.74,.74,.06,16);
const handleGeometry=new THREE.CylinderGeometry(.05,.05,.95,6).rotateX(Math.PI/2).translate(0,0,.42);
const malletGeometry=new THREE.BoxGeometry(.34,.26,.26).translate(0,0,.9);
const woodPaint=new THREE.MeshStandardMaterial({color:0xa66e3f,roughness:.8});
const stonePaint=new THREE.MeshStandardMaterial({color:0xb9b2a4,roughness:.9});
const ironPaint=new THREE.MeshStandardMaterial({color:0x4d5561,roughness:.5,metalness:.4});
// Skin, face, hair, trousers and boots keep their own colors; only the tunic is tinted.
const detailPaint=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.78});
const STONE_IDEAS=new Set<Idea>(['walls','roads','archive','observatory','river']);

class Worker {
  readonly root=new THREE.Group();
  readonly body=new THREE.Group();
  readonly arms:[THREE.Group,THREE.Group];
  readonly legs:[THREE.Group,THREE.Group];
  readonly carried=new THREE.Group();
  readonly mallet=new THREE.Group();
  readonly hat:THREE.Mesh;
  readonly brim:THREE.Mesh;
  origin:WorkPoint={x:0,z:0};
  spot:WorkPoint={x:0,z:0};
  delay=0;
  phase:Phase='gone';
  phaseStart=0;
  lastSwing=0;
  popped=false;
  readonly plank:THREE.Mesh;
  readonly stone:THREE.Mesh;

  constructor(paint:THREE.Material,hatPaint:THREE.Material,shadowGeometry:THREE.BufferGeometry,shadowPaint:THREE.Material){
    const torso=new THREE.Mesh(bodyGeometry,paint);torso.castShadow=true;this.body.add(torso);
    if(bodyDetailGeometry){const face=new THREE.Mesh(bodyDetailGeometry,detailPaint);face.castShadow=true;this.body.add(face);}
    const limb=(name:LimbName)=>{
      const pivot=new THREE.Group();pivot.position.fromArray(residentData.parts[name].pivot);
      if(limbGeometries[name].getAttribute('position').count){const mesh=new THREE.Mesh(limbGeometries[name],paint);mesh.castShadow=true;pivot.add(mesh);}
      const detail=limbDetailGeometries?.[name];
      if(detail){const mesh=new THREE.Mesh(detail,detailPaint);mesh.castShadow=true;pivot.add(mesh);}
      this.body.add(pivot);
      return pivot;
    };
    this.arms=[limb('arm_left'),limb('arm_right')];
    this.legs=[limb('leg_left'),limb('leg_right')];
    this.hat=new THREE.Mesh(hatGeometry,hatPaint);this.hat.position.set(0,2.5,.05);this.hat.rotation.x=-.12;this.hat.castShadow=true;
    this.brim=new THREE.Mesh(brimGeometry,hatPaint);this.brim.position.set(0,2.5,.05);this.brim.rotation.x=-.12;
    this.body.add(this.hat,this.brim);
    this.plank=new THREE.Mesh(plankGeometry,woodPaint);this.plank.castShadow=true;
    this.stone=new THREE.Mesh(stoneGeometry,stonePaint);this.stone.castShadow=true;
    this.carried.add(this.plank,this.stone);this.carried.position.y=3.1;this.body.add(this.carried);
    // The mallet sits in the right hand (end of the horizontal arm mesh).
    const handle=new THREE.Mesh(handleGeometry,woodPaint),head=new THREE.Mesh(malletGeometry,ironPaint);
    handle.castShadow=head.castShadow=true;
    this.mallet.add(handle,head);this.mallet.position.set(.58,0,0);this.arms[1].add(this.mallet);
    this.root.add(this.body);
    const shadow=new THREE.Mesh(shadowGeometry,shadowPaint);shadow.rotation.x=-Math.PI/2;shadow.position.y=.03;this.root.add(shadow);
    this.root.visible=false;
  }
}

/**
 * A small colored crew for the clicked idea. Workers hop in carrying
 * material, hammer while the stage is prepared, cheer when it lands, then
 * walk away and poof out. Nobody appears or vanishes in a single frame.
 */
export class ChoiceWorker {
  readonly group=new THREE.Group();
  private readonly paint=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.8});
  private readonly hatPaint=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.7});
  private readonly shadowPaint=new THREE.MeshBasicMaterial({color:0x37585a,transparent:true,opacity:.2,depthWrite:false});
  private readonly shadowGeometry=new THREE.CircleGeometry(.5,12);
  private readonly crew:Worker[]=[];
  private target:WorkPoint={x:0,z:0};
  private reduced=false;
  private active=false;
  hooks:CrewHooks={};

  constructor(scene:THREE.Scene){
    this.group.name='Choice_worker_visit';
    for(let i=0;i<4;i++){
      const worker=new Worker(this.paint,this.hatPaint,this.shadowGeometry,this.shadowPaint);
      worker.root.name=`Choice_worker_${i}`;
      worker.root.scale.setScalar(1.55);
      this.crew.push(worker);this.group.add(worker.root);
    }
    scene.add(this.group);
  }

  /** Number of visible crew members (for tests and QA). */
  get visibleCount():number{return this.crew.filter(worker=>worker.root.visible).length;}

  startCue(idea:Idea,target:WorkPoint,isClear:(x:number,z:number)=>boolean,reduced=false,now=performance.now()/1000,crewSize=3):void{
    this.finishCue(true);
    this.reduced=reduced;
    this.target=target;
    const size=reduced?1:THREE.MathUtils.clamp(crewSize,1,this.crew.length);
    const routes=planConstructionCrew(target,size,isClear);
    const color=new THREE.Color(IDEA_COLORS[idea]);
    this.paint.color.copy(color);
    this.hatPaint.color.copy(color).offsetHSL(0,.05,-.18);
    const stone=STONE_IDEAS.has(idea);
    this.crew.forEach((worker,index)=>{
      const route=routes[index];
      if(index>=size){worker.phase='gone';worker.root.visible=false;return;}
      const spot=route?.spot??{x:target.x+4+index*2.2,z:target.z+4};
      // Walk in from further away than the collision-safe approach so the trip reads.
      const dx=spot.x-target.x,dz=spot.z-target.z,len=Math.hypot(dx,dz)||1;
      let reach=route?Math.hypot(route.origin.x-spot.x,route.origin.z-spot.z):3.6;
      for(let extra=4;extra<=10;extra+=2){
        const x=spot.x+dx/len*extra,z=spot.z+dz/len*extra;
        if(!isClear(x,z))break;
        reach=extra;
      }
      worker.spot=spot;
      worker.origin={x:spot.x+dx/len*reach,z:spot.z+dz/len*reach};
      worker.delay=index*.14;
      worker.phase='arrive';worker.phaseStart=now;worker.popped=false;worker.lastSwing=0;
      worker.plank.visible=!stone;worker.stone.visible=stone;
      worker.carried.visible=true;worker.carried.scale.setScalar(1);
      worker.root.visible=!reduced||index===0;
    });
    this.active=true;
    this.update(now);
  }

  /** The stage landed: everyone jumps and throws their arms up. */
  celebrate(now=performance.now()/1000):void{
    if(!this.active||this.reduced)return;
    let any=false;
    for(const worker of this.crew)if(worker.phase==='work'||worker.phase==='arrive'){worker.phase='cheer';worker.phaseStart=now;worker.carried.visible=false;any=true;}
    if(any)this.hooks.cheer?.();
  }

  /** Back to hammering for the next causal wave. */
  resumeWork(now=performance.now()/1000):void{
    for(const worker of this.crew)if(worker.phase==='cheer'){worker.phase='work';worker.phaseStart=now;}
  }

  finishCue(instant=false,now=performance.now()/1000):void{
    if(!this.active)return;
    if(instant||this.reduced){
      for(const worker of this.crew){worker.phase='gone';worker.root.visible=false;}
      this.active=false;return;
    }
    this.crew.forEach((worker,index)=>{
      if(worker.phase==='gone'||worker.phase==='leave')return;
      worker.phase='leave';worker.phaseStart=now+index*.1;worker.carried.visible=false;
    });
  }

  update(now=performance.now()/1000):void{
    if(!this.active)return;
    let alive=false;
    for(const worker of this.crew){
      if(worker.phase==='gone')continue;
      alive=true;
      this.animate(worker,now);
    }
    if(!alive)this.active=false;
  }

  private place(worker:Worker,x:number,z:number,face:WorkPoint){
    worker.root.position.set(x,terrainHeight(x,z),z);
    worker.root.rotation.y=Math.atan2(face.x-x,face.z-z);
  }

  private pose(worker:Worker,{stride=0,armL=0,armR=0,spreadL=1.7,spreadR=-1.7,lean=0,hop=0,squash=1}:{stride?:number;armL?:number;armR?:number;spreadL?:number;spreadR?:number;lean?:number;hop?:number;squash?:number}){
    worker.legs[0].rotation.x=stride;worker.legs[1].rotation.x=-stride;
    worker.arms[0].rotation.set(armL,0,spreadL);worker.arms[1].rotation.set(armR,0,spreadR);
    worker.body.rotation.x=lean;worker.body.position.y=hop;
    worker.body.scale.set(1/Math.sqrt(squash),squash,1/Math.sqrt(squash));
  }

  private animate(worker:Worker,now:number){
    if(this.reduced){
      this.place(worker,worker.spot.x,worker.spot.z,this.target);
      worker.carried.visible=false;worker.mallet.visible=true;this.pose(worker,{});return;
    }
    const t=now-worker.phaseStart-worker.delay;
    if(worker.phase==='arrive'){
      if(t<0){worker.root.visible=false;return;}
      worker.root.visible=true;
      if(!worker.popped){worker.popped=true;this.hooks.pop?.(worker.origin.x,terrainHeight(worker.origin.x,worker.origin.z)+1.5,worker.origin.z,true);}
      const appear=easeOutBack(t/POP,2.4);
      worker.root.scale.setScalar(1.55*Math.max(.001,appear));
      const k=smooth(t/ARRIVE);
      const x=lerp(worker.origin.x,worker.spot.x,k),z=lerp(worker.origin.z,worker.spot.z,k);
      this.place(worker,x,z,worker.spot);
      const cycle=Math.sin(t*13);
      // Bouncy carrying gait: arms up holding the load over the head.
      this.pose(worker,{stride:cycle*.55,armL:-2.75,armR:-2.75,spreadL:1.45,spreadR:-1.45,hop:Math.abs(cycle)*.32,squash:1+Math.abs(Math.cos(t*13))*.06-.03});
      worker.mallet.visible=false;
      worker.carried.rotation.z=Math.sin(t*13)*.08;
      if(t>=ARRIVE){worker.phase='work';worker.phaseStart=now-worker.delay;}
      return;
    }
    if(worker.phase==='work'){
      this.place(worker,worker.spot.x,worker.spot.z,this.target);
      // Toss the carried material onto the site, then swing the mallet.
      if(worker.carried.visible){
        const toss=t/.25;
        worker.carried.position.set(0,3.1+Math.sin(Math.min(1,toss)*Math.PI)*.8,Math.min(1,toss)*1.4);
        worker.carried.scale.setScalar(Math.max(.001,1-smooth(toss)));
        if(toss>=1){worker.carried.visible=false;worker.carried.position.set(0,3.1,0);}
      }
      worker.mallet.visible=true;
      const phase=(t*2.9+worker.delay*3)%1;
      // Wind up slowly, strike fast.
      const swing=phase<.7?smooth(phase/.7):1-smooth((phase-.7)/.12);
      const struck=phase>=.82&&worker.lastSwing<.82;
      worker.lastSwing=phase;
      if(struck){
        const f=worker.root.rotation.y;
        const reach=1.6*worker.root.scale.x;
        this.hooks.strike?.(worker.root.position.x+Math.sin(f)*reach,worker.root.position.y+.4,worker.root.position.z+Math.cos(f)*reach);
      }
      this.pose(worker,{armL:-.7,armR:-.35-swing*2.4,lean:(1-swing)*.28,hop:0,squash:phase>.82&&phase<.9?.9:1,spreadL:1.6,spreadR:-1.6});
      return;
    }
    if(worker.phase==='cheer'){
      this.place(worker,worker.spot.x,worker.spot.z,this.target);
      worker.mallet.visible=true;
      const jumps=Math.abs(Math.sin(t*Math.PI*2.4));
      const k=t/CHEER;
      const wave=Math.sin(t*18)*.25;
      this.pose(worker,{armL:-3+wave,armR:-3-wave,spreadL:1.2,spreadR:-1.2,hop:k<1?jumps*1.1:0,squash:jumps<.15&&k<1?.86:1,stride:.2*jumps});
      if(t>=CHEER*1.6){worker.phase='work';worker.phaseStart=now-worker.delay;}
      return;
    }
    if(worker.phase==='leave'){
      if(t<0){this.place(worker,worker.spot.x,worker.spot.z,this.target);return;}
      worker.mallet.visible=true;
      const k=smooth(t/LEAVE);
      const x=lerp(worker.spot.x,worker.origin.x,k),z=lerp(worker.spot.z,worker.origin.z,k);
      this.place(worker,x,z,worker.origin);
      const cycle=Math.sin(t*12);
      this.pose(worker,{stride:cycle*.55,armL:-cycle*.6,armR:cycle*.6,hop:Math.abs(cycle)*.25});
      const vanish=(t-LEAVE)/POP;
      if(vanish>0){
        if(worker.popped){worker.popped=false;this.hooks.pop?.(x,worker.root.position.y+1.2,z,false);}
        worker.root.scale.setScalar(1.55*Math.max(.001,1-smooth(vanish))*(1+Math.sin(Math.min(1,vanish)*Math.PI)*.25));
      }
      if(vanish>=1){worker.phase='gone';worker.root.visible=false;worker.root.scale.setScalar(1.55);}
    }
  }

  dispose():void{
    this.group.removeFromParent();
    this.paint.dispose();this.hatPaint.dispose();this.shadowPaint.dispose();this.shadowGeometry.dispose();
  }
}
