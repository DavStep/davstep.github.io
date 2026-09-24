import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { PLOTS, type TownSnapshot } from './model';

type Role='builder'|'merchant'|'guard'|'mage'|'warrior'|'resident'|'artist'|'miner';
interface Node { x:number;z:number;links:number[]; }
const nodes:Node[]=[{x:0,z:0,links:[]}];
for(let i=0;i<12;i++){const a=i*Math.PI*2/12;nodes.push({x:Math.cos(a)*31,z:Math.sin(a)*31,links:[]});}
for(let i=1;i<=12;i++){nodes[i].links.push(i===1?12:i-1,i===12?1:i+1);if(i%3===1){nodes[i].links.push(0);nodes[0].links.push(i);}}
for(let i=0;i<16;i++){const a=i*Math.PI*2/16;nodes.push({x:Math.cos(a)*52,z:Math.sin(a)*52,links:[]});}
for(let i=13;i<=28;i++){nodes[i].links.push(i===13?28:i-1,i===28?13:i+1);if((i-13)%4===0){const inner=1+Math.round((i-13)/16*12)%12;nodes[i].links.push(inner);nodes[inner].links.push(i);}}
const dist=(a:{x:number;z:number},b:{x:number;z:number})=>Math.hypot(a.x-b.x,a.z-b.z);
function nearest(p:{x:number;z:number}){let best=0,d=Infinity;for(let i=0;i<nodes.length;i++){const q=dist(p,nodes[i]);if(q<d){best=i;d=q;}}return best;}
const routeCache=new Map<string,THREE.Vector3[]>();
export function routeBetween(a:{x:number;z:number},b:{x:number;z:number}):THREE.Vector3[]{
  const start=nearest(a),goal=nearest(b),key=`${start}:${goal}`;
  let mid=routeCache.get(key);
  if(!mid){
    const costs=nodes.map(()=>Infinity),prev=nodes.map(()=>-1),remaining=new Set(nodes.map((_,i)=>i));costs[start]=0;
    while(remaining.size){let current=-1,min=Infinity;for(const i of remaining)if(costs[i]<min){current=i;min=costs[i];}if(current<0||current===goal)break;remaining.delete(current);for(const next of nodes[current].links){const n=costs[current]+dist(nodes[current],nodes[next]);if(n<costs[next]){costs[next]=n;prev[next]=current;}}}
    const path:number[]=[];let at=goal;while(at>=0){path.unshift(at);if(at===start)break;at=prev[at];}
    mid=path.map(i=>new THREE.Vector3(nodes[i].x,.58,nodes[i].z));routeCache.set(key,mid);
  }
  return [new THREE.Vector3(a.x,.58,a.z),...mid,new THREE.Vector3(b.x,.58,b.z)];
}
function sampleRoute(path:THREE.Vector3[],progress:number){
  let length=0;for(let i=1;i<path.length;i++)length+=path[i-1].distanceTo(path[i]);
  let left=progress*length;
  for(let i=1;i<path.length;i++){const segment=path[i-1].distanceTo(path[i]);if(left<=segment)return path[i-1].clone().lerp(path[i],segment?left/segment:0);left-=segment;}
  return path[path.length-1].clone();
}
const palettes={
  skin:[0xe5bda0,0xc68f74,0x9d6b54,0xf0cfb1],
  cloth:[0x748b87,0xb06f61,0x797392,0x9a9b6a,0x6480a3],
};
const roles:Role[]=['builder','resident','merchant','resident','guard','mage','resident','warrior','resident','artist','resident','miner'];
interface Resident { role:Role;home:{x:number;z:number};work:{x:number;z:number};id:number; }
type Part='torso'|'head'|'hair'|'leftEye'|'rightEye'|'nose'|'leftLeg'|'rightLeg'|'leftFoot'|'rightFoot'|'leftArm'|'rightArm'|'leftHand'|'rightHand'|'hat'|'mageHat'|'apron'|'shield'|'parcel'|'food';
const BOX=new RoundedBoxGeometry(1,1,1,2,.16),PLAIN_BOX=new THREE.BoxGeometry(1,1,1),HEAD=new THREE.SphereGeometry(1,10,8),LOW_HEAD=new THREE.IcosahedronGeometry(1,1),HAT=new THREE.ConeGeometry(1,1,7);
const PARTS:Part[]=['torso','head','hair','leftEye','rightEye','nose','leftLeg','rightLeg','leftFoot','rightFoot','leftArm','rightArm','leftHand','rightHand','hat','mageHat','apron','shield','parcel','food'];
const COLOR={wood:0x5a514b,guard:0x8f9694,builder:0xe0bc71,mage:0x756594,merchant:0xd4bb8b,artist:0xb78180,miner:0xe4c38a,plain:0x6d5142,shield:0xa3a9a4};
export class Residents {
  readonly group=new THREE.Group();
  private readonly mobile=matchMedia('(max-width: 700px)').matches;
  private readonly capacity=this.mobile?12:24;
  private readonly residents:Resident[]=[];
  private readonly meshes=new Map<Part,THREE.InstancedMesh>();
  private readonly dummy=new THREE.Object3D();
  constructor(scene:THREE.Scene){
    const base=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.87});
    for(const part of PARTS){
      const geo=part==='mageHat'?HAT:['head','hair','leftEye','rightEye','nose','leftHand','rightHand','food'].includes(part)?this.mobile?LOW_HEAD:HEAD:this.mobile?PLAIN_BOX:BOX;
      const mesh=new THREE.InstancedMesh(geo,base,this.capacity);
      mesh.count=0;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled=false;
      mesh.castShadow=!this.mobile&&(part==='torso'||part==='head'||part==='hat');
      mesh.receiveShadow=true;this.meshes.set(part,mesh);this.group.add(mesh);
    }
    const homes=PLOTS.filter(p=>p.kind==='home');
    const jobs=PLOTS.filter(p=>p.kind==='project'||p.kind==='market'||p.kind==='forge'||p.kind==='post'||p.kind==='tavern');
    const landmark=(key:string)=>PLOTS.find(p=>p.project===key)!;
    for(let id=0;id<this.capacity;id++){
      const role=roles[id%roles.length],home=homes[(id*5)%homes.length];
      const job=role==='merchant'?PLOTS.find(p=>p.id==='market')!:role==='mage'?landmark('wizard'):role==='artist'?landmark('shmixel'):role==='miner'?landmark('dwarves'):role==='guard'?{x:32,z:0}:role==='warrior'?{x:-32,z:0}:jobs[(id*3+2)%jobs.length];
      this.residents.push({id,role,home:{x:home.x,z:home.z},work:{x:job.x,z:job.z}});
      const cloth=palettes.cloth[id%palettes.cloth.length],skin=palettes.skin[(id*7)%palettes.skin.length];
      const colors:Record<Part,number>={
        torso:cloth,head:skin,hair:[0x42382f,0x6c4a35,0x393942,0x8a6243][id%4],leftEye:0x263038,rightEye:0x263038,nose:skin,
        leftLeg:COLOR.wood,rightLeg:COLOR.wood,leftFoot:COLOR.wood,rightFoot:COLOR.wood,leftArm:cloth,rightArm:cloth,leftHand:skin,rightHand:skin,
        hat:role==='builder'?COLOR.builder:role==='guard'||role==='warrior'?COLOR.guard:role==='merchant'?COLOR.merchant:role==='artist'?COLOR.artist:role==='miner'?COLOR.miner:COLOR.plain,
        mageHat:COLOR.mage,apron:COLOR.merchant,shield:COLOR.shield,parcel:role==='miner'?COLOR.wood:COLOR.builder,food:0xc47d53,
      };
      for(const part of PARTS)this.meshes.get(part)!.setColorAt(id,new THREE.Color(colors[part]));
    }
    for(const mesh of this.meshes.values())if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
    scene.add(this.group);
  }
  private put(part:Part,id:number,x:number,y:number,z:number,sx:number,sy:number,sz:number,yaw:number,tilt=0){
    const d=this.dummy;d.position.set(x,y,z);d.rotation.set(tilt,yaw,0);d.scale.set(sx,sy,sz);d.updateMatrix();this.meshes.get(part)!.setMatrixAt(id,d.matrix);
  }
  update(snapshot:TownSnapshot){
    const count=Math.min(this.capacity,snapshot.residents),t=snapshot.dayFraction;
    for(const mesh of this.meshes.values())mesh.count=count;
    for(let id=0;id<count;id++){
      const p=this.residents[id],offset=(id%5)*.013,shift=(t+offset)%1;
      const market={x:-10,z:-7},square={x:0,z:0};
      const activeSite=p.role==='builder'&&snapshot.elapsed<28*60_000?snapshot.plots.find(q=>q.stage>0&&q.stage<4&&q.kind!=='project'):undefined;
      const job=activeSite?{x:activeSite.x,z:activeSite.z}:p.role==='guard'||p.role==='warrior'?snapshot.outerWood>8?{x:p.role==='guard'?53:-53,z:0}:p.work:p.work;
      let from=p.home,to=job,progress=0,moving=false;
      if(shift<.13){from=p.home;to=job;progress=shift/.13;moving=true;}
      else if(shift<.50){from=job;to=job;}
      else if(shift<.63){from=job;to=id%3===0?square:market;progress=(shift-.5)/.13;moving=true;}
      else if(shift<.74){from=id%3===0?square:market;to=from;}
      else if(shift<.87){from=id%3===0?square:market;to=p.home;progress=(shift-.74)/.13;moving=true;}
      else {from=p.home;to=p.home;}
      const path=routeBetween(from,to),pos=moving?sampleRoute(path,progress):new THREE.Vector3(to.x,.58,to.z);
      const next=moving?sampleRoute(path,Math.min(1,progress+.01)):pos;
      const yaw=moving?Math.atan2(next.x-pos.x,next.z-pos.z):0;
      const step=moving?Math.sin(snapshot.elapsed/310+id*2)*.46:0;
      const bob=moving?Math.abs(Math.sin(snapshot.elapsed/310+id*2))*.08:0;
      const size=.8+(id%4)*.07,yy=.58+bob;
      const greeting=!moving&&shift>=.63&&shift<.74&&id%3===0;
      const armSwing=moving?-step*.7:p.role==='builder'&&activeSite?Math.sin(snapshot.elapsed/230+id)*.75:greeting?Math.sin(snapshot.elapsed/260+id)*.6:Math.sin(snapshot.elapsed/1200+id)*.1;
      const dx=Math.cos(yaw),dz=-Math.sin(yaw);
      const local=(x:number,z:number):[number,number]=>[pos.x+x*dx+z*Math.sin(yaw),pos.z+z*Math.cos(yaw)+x*dz];
      let q=local(0,0);this.put('torso',id,q[0],yy+1.43*size,q[1],.87*size,1.2*size,.68*size,yaw);
      this.put('head',id,q[0],yy+2.36*size,q[1],.49*size,.53*size,.48*size,yaw);
      this.put('hair',id,q[0],yy+2.73*size,q[1]-.04,.51*size,.21*size,.49*size,yaw);
      q=local(-.18*size,.44*size);this.put('leftEye',id,q[0],yy+2.43*size,q[1],.052*size,.072*size,.042*size,yaw);
      q=local(.18*size,.44*size);this.put('rightEye',id,q[0],yy+2.43*size,q[1],.052*size,.072*size,.042*size,yaw);
      q=local(0,.49*size);this.put('nose',id,q[0],yy+2.23*size,q[1],.1*size,.11*size,.12*size,yaw);
      q=local(-.25*size,0);this.put('leftLeg',id,q[0],yy+.55*size,q[1],.29*size,1.1*size,.35*size,yaw,step);
      q=local(.25*size,0);this.put('rightLeg',id,q[0],yy+.55*size,q[1],.29*size,1.1*size,.35*size,yaw,-step);
      q=local(-.25*size,.14*size);this.put('leftFoot',id,q[0],yy+.11*size,q[1],.36*size,.24*size,.51*size,yaw);
      q=local(.25*size,.14*size);this.put('rightFoot',id,q[0],yy+.11*size,q[1],.36*size,.24*size,.51*size,yaw);
      q=local(-.58*size,0);this.put('leftArm',id,q[0],yy+1.53*size,q[1],.29*size,.8*size,.33*size,yaw,-armSwing);
      q=local(.58*size,0);this.put('rightArm',id,q[0],yy+1.53*size,q[1],.29*size,.8*size,.33*size,yaw,armSwing);
      q=local(-.61*size,.04*size);this.put('leftHand',id,q[0],yy+1.07*size,q[1],.18*size,.2*size,.18*size,yaw);
      q=local(.61*size,.04*size);this.put('rightHand',id,q[0],yy+1.07*size,q[1],.18*size,.2*size,.18*size,yaw);
      this.put('hat',id,pos.x,yy+2.76*size,pos.z,.85*size,.28*size,.82*size,yaw);
      this.put('mageHat',id,pos.x,yy+2.98*size,pos.z,p.role==='mage'?.8*size:.0001, p.role==='mage'?1.05*size:.0001,p.role==='mage'?.8*size:.0001,yaw);
      q=local(0,.36*size);this.put('apron',id,q[0],yy+1.34*size,q[1],p.role==='merchant'?.75*size:.0001,p.role==='merchant'?.9*size:.0001,.12*size,yaw);
      q=local(-.75*size,.25*size);this.put('shield',id,q[0],yy+1.38*size,q[1],p.role==='warrior'?.65*size:.0001,p.role==='warrior'?.85*size:.0001,.2*size,yaw);
      const carrying=moving&&(p.role==='builder'||p.role==='miner'||p.role==='merchant');
      q=local(.8*size,.32*size);this.put('parcel',id,q[0],yy+.98*size,q[1],carrying?.45*size:.0001,carrying?.42*size:.0001,carrying?.48*size:.0001,yaw);
      const eating=!moving&&shift>=.63&&shift<.74&&id%3!==0;
      q=local(.23*size,.4*size);this.put('food',id,q[0],yy+2.14*size,q[1],eating?.22*size:.0001,eating?.18*size:.0001,eating?.22*size:.0001,yaw);
    }
    for(const mesh of this.meshes.values())mesh.instanceMatrix.needsUpdate=true;
  }
  dispose(){this.group.removeFromParent();this.group.clear();for(const mesh of this.meshes.values())mesh.dispose();}
}
