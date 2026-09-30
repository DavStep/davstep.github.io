import * as THREE from 'three';
import type { TownSnapshot } from './model';
import type { WorldEventState } from './world-event-types';
import type { RoadSegment } from './planet-roads';
import { roadGroundSafe } from './planet-roads';
import type { RoadPoint } from './planet-building-access';
import { PLANET_RADIUS as R, surfaceNormal, planetElevation } from './planet-geography';
import { MAX_LEVEL } from './milestones';

const UP=new THREE.Vector3(0,1,0);
/** Follow actual connected road edges; never invent a straight line between districts. */
export function caravanRoute(segments:RoadSegment[],seed=0):RoadPoint[]{
  const key=(p:RoadPoint)=>`${p.x.toFixed(4)}/${p.z.toFixed(4)}`;
  const graph=new Map<string,{point:RoadPoint;neighbors:string[]}>();
  for(const {a,b} of segments){
    if(![0,.5,1].every(t=>roadGroundSafe(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t,true)))continue;
    for(const [p,q] of [[a,b],[b,a]]){const k=key(p),entry=graph.get(k)??{point:p,neighbors:[]};if(!entry.neighbors.includes(key(q)))entry.neighbors.push(key(q));graph.set(k,entry);}
  }
  const nodes=[...graph.keys()];if(!nodes.length)return [];
  // A long simple path avoids tiny back-and-forth trips on doorway spurs.
  let best:RoadPoint[]=[];
  for(let attempt=0;attempt<12;attempt++){
    let current=nodes[(seed*37+attempt*97)%nodes.length];const visited=new Set<string>(),path:RoadPoint[]=[];
    while(current&&!visited.has(current)&&path.length<100){
      visited.add(current);const node=graph.get(current)!;path.push(node.point);
      const next=node.neighbors.filter(k=>!visited.has(k)).sort((a,b)=>graph.get(b)!.neighbors.length-graph.get(a)!.neighbors.length);
      current=next[(seed+attempt)%Math.max(1,next.length)];
    }
    if(path.length>best.length)best=path;
  }
  return best.length>=8?best:[];
}
export function activityState(snapshot:TownSnapshot){
  return {caravans:snapshot.residents>0&&snapshot.roads>0&&(snapshot.marketLevel??0)>=MAX_LEVEL?2:0,
    magic:(snapshot.observatoryLevel??0)>=MAX_LEVEL};
}

/** A small, bounded cast of ambient actors, all using native spherical frames. */
export class PlanetActivity{
  readonly group=new THREE.Group();
  private box=new THREE.BoxGeometry(1,1,1);
  private wheel=new THREE.CylinderGeometry(.23,.23,.1,10);
  private spark=new THREE.IcosahedronGeometry(1,0);
  private paints=[0x855435,0xf1d9a0,0x387f87,0x483726,0xc58445].map(color=>new THREE.MeshStandardMaterial({color,roughness:.9}));
  private magicPaint=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,depthWrite:false});
  private bursts:THREE.InstancedMesh;
  private magic=new THREE.Group();
  private carts:{root:THREE.Group;wheels:THREE.Mesh[];legs:THREE.Mesh[];route:RoadPoint[];index:number;distance:number;direction:number}[]=[];
  private revision=-1;
  private eventWorld:WorldEventState|null=null;
  setWorldEventState(world:WorldEventState){this.eventWorld=world;this.magic.visible=false;}
  private last:number|null=null;
  private time=0;
  private dummy=new THREE.Object3D();
  private normal=new THREE.Vector3();
  private forward=new THREE.Vector3();
  private right=new THREE.Vector3();
  private frame=new THREE.Matrix4();
  constructor(parent:THREE.Group,mobile:boolean){
    this.group.name='Max-level town life';parent.add(this.group);
    this.bursts=new THREE.InstancedMesh(this.spark,this.magicPaint,mobile?32:56);this.bursts.name='Wizard sky confetti';this.bursts.frustumCulled=false;
    const palette=[0xb68cff,0x65e5ee,0xffd578,0xff8bbd];for(let i=0;i<this.bursts.count;i++)this.bursts.setColorAt(i,new THREE.Color(palette[i%4]));
    this.magic.add(this.bursts);this.group.add(this.magic);this.magic.visible=false;
    for(let i=0;i<2;i++)this.makeCart(i);
    this.group.traverse(o=>o.userData.planetNative=true);
  }
  private makeCart(index:number){
    const root=new THREE.Group(),wheels:THREE.Mesh[]=[],legs:THREE.Mesh[]=[];root.name='Merchant caravan';root.visible=false;this.group.add(root);
    const block=(x:number,y:number,z:number,w:number,h:number,d:number,paint:number)=>{const m=new THREE.Mesh(this.box,this.paints[paint]);m.position.set(x,y,z);m.scale.set(w,h,d);m.castShadow=true;root.add(m);return m;};
    block(0,.58,0,.76,.18,1.35,0);block(0,.98,0,.8,.65,1.25,index?2:1);
    block(0,1.34,0,.88,.12,1.4,1);block(0,.7,.92,.14,.12,.65,0);
    for(const x of [-.45,.45])for(const z of [-.45,.45]){const m=new THREE.Mesh(this.wheel,this.paints[3]);m.rotation.z=Math.PI/2;m.position.set(x,.25,z);root.add(m);wheels.push(m);}
    // A harnessed pack pony leads each covered supply wagon.
    block(0,.68,1.62,.4,.48,.85,4);block(0,1.02,1.94,.29,.52,.3,4);block(0,1.17,2.14,.3,.2,.31,4);
    for(const x of [-.12,.12]){block(x,1.38,1.94,.08,.22,.1,3);for(const z of [1.34,1.88])legs.push(block(x,.29,z,.1,.48,.11,3));}
    this.carts.push({root,wheels,legs,route:[],index:0,distance:0,direction:1});
  }
  update(snapshot:TownSnapshot,segments:RoadSegment[],revision:number){
    const state=activityState(snapshot);
    this.carts.forEach((cart,i)=>{
      if(this.revision!==revision){cart.route=caravanRoute(segments,i);cart.index=0;cart.distance=0;cart.direction=1;}
      cart.root.visible=i<state.caravans&&cart.route.length>1;
    });this.revision=revision;
    const wizard=snapshot.plots.find(p=>p.project==='wizard'&&p.stage>0);this.magic.visible=state.magic&&!!wizard&&!this.eventWorld;
    if(wizard){const n=surfaceNormal(wizard.x,wizard.z);this.magic.position.copy(n).multiplyScalar(R+planetElevation(n));this.magic.quaternion.setFromUnitVectors(UP,n);}
  }
  render(now:number,reduced:boolean){
    const dt=this.last===null?0:Math.min(.1,Math.max(0,(now-this.last)/1000));this.last=now;if(!reduced)this.time+=dt;
    for(const cart of this.carts){
      if(!cart.root.visible)continue;
      let a=cart.route[cart.index],b=cart.route[cart.index+cart.direction];
      const length=Math.hypot(b.x-a.x,b.z-a.z);
      if(!reduced)cart.distance+=dt*.85;
      if(cart.distance>=length){cart.distance-=length;cart.index+=cart.direction;if(cart.index===0||cart.index===cart.route.length-1)cart.direction*=-1;a=cart.route[cart.index];b=cart.route[cart.index+cart.direction];}
      const t=Math.min(1,cart.distance/Math.hypot(b.x-a.x,b.z-a.z)),x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t;
      this.normal.copy(surfaceNormal(x,z));cart.root.position.copy(this.normal).multiplyScalar(R+planetElevation(this.normal)+.18);
      this.forward.copy(surfaceNormal(b.x,b.z)).sub(surfaceNormal(a.x,a.z));this.forward.addScaledVector(this.normal,-this.forward.dot(this.normal)).normalize();this.right.crossVectors(this.normal,this.forward).normalize();
      cart.root.quaternion.setFromRotationMatrix(this.frame.makeBasis(this.right,this.normal,this.forward));
      cart.wheels.forEach(w=>w.rotation.y=this.time*.85/.23);cart.legs.forEach((leg,i)=>leg.rotation.x=reduced?0:Math.sin(this.time*6+i*Math.PI/2)*.3);
    }
    // One leisurely rocket, then a colorful expanding starburst. No flashing lights.
    this.bursts.visible=this.magic.visible&&!reduced;if(!this.bursts.visible)return;
    const cycle=this.time%9,launch=cycle<1.8,age=cycle-1.8;
    for(let i=0;i<this.bursts.count;i++){
      const angle=i*2.399963,r=Math.sqrt((i+.5)/this.bursts.count),spread=Math.max(0,age)*3.2;
      if(launch)this.dummy.position.set(Math.sin(cycle*3)*.35,10+cycle*6-i*.11,0);
      else this.dummy.position.set(Math.cos(angle)*r*spread,21+Math.sin(angle)*r*spread-age*age*.65,Math.cos(i*1.7)*spread*.45);
      const size=launch?(i<8?.16*(1-i/9):0):age<2.8?.22*(1-age/2.8):0;
      this.dummy.scale.setScalar(size);this.dummy.rotation.set(i+this.time,i*.7,this.time);this.dummy.updateMatrix();this.bursts.setMatrixAt(i,this.dummy.matrix);
    }this.bursts.instanceMatrix.needsUpdate=true;
  }
  dispose(){this.bursts.dispose();this.box.dispose();this.wheel.dispose();this.spark.dispose();this.paints.forEach(m=>m.dispose());this.magicPaint.dispose();this.group.removeFromParent();}
}
