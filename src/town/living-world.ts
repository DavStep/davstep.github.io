import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import data from './generated/living-world.json';
import { MAT } from './materials';
import { terrainHeight, riverCenter, riverSurfaceHeight } from './environment';
import { pathRibbon, linePoints } from './paths';
import { DEER_MEADOW, SHEEP_PASTURE, PORT_X, livingWorldForLevels } from './living-world-state';
import type { Levels } from './game';

type Family='bird'|'deer'|'sheep'|'boat';
type Animal={root:THREE.Group;parts:Map<string,THREE.Group>};
const paints=Object.fromEntries(Object.entries(data.colors).map(([key,color])=>[key,new THREE.MeshStandardMaterial({color:'#'+color,roughness:.88})]));
const source=new Map<string,{role:string;pivot:number[];geometry:THREE.BufferGeometry;material:THREE.Material}[]>();
for(const lod of [0,1])for(const family of ['bird','deer','sheep','boat']){
  const buckets=new Map<string,typeof data.parts>();
  for(const part of data.parts.filter(p=>p.lod===lod&&p.family===family)){
    const key=part.role+':'+part.material,bucket=buckets.get(key)??[];bucket.push(part);buckets.set(key,bucket);
  }
  source.set(`${family}:${lod}`,[...buckets.values()].map(parts=>{
    const geometries=parts.map(part=>{
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(part.positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(part.normals,3));return geometry;
    });
    const geometry=mergeGeometries(geometries)!;geometries.forEach(g=>g.dispose());geometry.computeBoundingSphere();
    return {role:parts[0].role,pivot:parts[0].pivot,geometry,material:paints[parts[0].material]};
  }));
}
export const LIVING_WORLD_SHARED_GEOMETRIES=new Set([...source.values()].flatMap(parts=>parts.map(p=>p.geometry)));
export const LIVING_WORLD_SHARED_MATERIALS=new Set(Object.values(paints));
function animal(family:Family,mobile:boolean):Animal {
  const root=new THREE.Group(),parts=new Map<string,THREE.Group>();root.name=family;root.visible=false;
  for(const part of source.get(`${family}:${mobile?1:0}`)!){
    let group=parts.get(part.role);
    if(!group){group=new THREE.Group();group.name=part.role;group.position.fromArray(part.pivot);parts.set(part.role,group);root.add(group);}
    const mesh=new THREE.Mesh(part.geometry,part.material);mesh.castShadow=!mobile;mesh.receiveShadow=true;group.add(mesh);
  }
  return {root,parts};
}

export interface RiverVisit {x:number;y:number;z:number;yaw:number;pitch:number;berthed:boolean}
/** Boats always follow the main river, pause alongside the quay, then depart. */
export function riverVisit(phase:number,out:RiverVisit={x:0,y:0,z:0,yaw:0,pitch:0,berthed:false}):RiverVisit {
  const t=((phase%1)+1)%1;
  out.x=t<.42?-145+145*t/.42:t<=.58?PORT_X:145*(t-.58)/.42;
  out.z=riverCenter(out.x);out.y=riverSurfaceHeight(out.x);
  out.yaw=-Math.atan2(riverCenter(out.x+.1)-riverCenter(out.x-.1),.2);
  out.pitch=Math.atan2(riverSurfaceHeight(out.x+.1)-riverSurfaceHeight(out.x-.1),Math.hypot(.2,riverCenter(out.x+.1)-riverCenter(out.x-.1)));
  out.berthed=t>=.42&&t<=.58;return out;
}

export class LivingWorld {
  readonly group=new THREE.Group();
  private readonly birds:Animal[]=[];
  private readonly deer:Animal[]=[];
  private readonly sheep:Animal[]=[];
  private readonly ships:Animal[]=[];
  private readonly landing=new THREE.Group();
  private readonly cargo=new THREE.Group();
  private readonly crane=new THREE.Group();
  private readonly loading=new THREE.Group();
  private readonly load:THREE.Mesh;
  private readonly rope:THREE.Mesh;
  private readonly ownedGeometries=new Set<THREE.BufferGeometry>();
  private readonly boxGeometry=new THREE.BoxGeometry(1,1,1);
  private readonly visit:RiverVisit={x:0,y:0,z:0,yaw:0,pitch:0,berthed:false};
  private readonly dockY=riverSurfaceHeight(PORT_X)+.9;
  private readonly riverZ=riverCenter(PORT_X);
  private readonly mobile:boolean;
  private counts={birds:0,deer:0,sheep:0,port:0,ships:0};

  constructor(parent:THREE.Group,mobile:boolean){
    this.mobile=mobile;this.group.name='Living_world';this.ownedGeometries.add(this.boxGeometry);
    for(const [family,list,count] of [['bird',this.birds,mobile?6:10],['deer',this.deer,mobile?2:4],['sheep',this.sheep,mobile?4:7],['boat',this.ships,2]] as const){
      for(let i=0;i<count;i++){const model=animal(family,mobile);model.root.name=`${family}_${i}`;this.group.add(model.root);list.push(model);}
    }
    for(const [group,name] of [[this.landing,'port_landing'],[this.cargo,'port_cargo'],[this.crane,'port_crane'],[this.loading,'port_loading']] as const){group.name=name;group.visible=false;this.group.add(group);}
    const z=this.riverZ+2.85,y=this.dockY;
    // Quay runs alongside the near bank; boats keep the unobstructed center lane.
    for(let i=0;i<22;i++)this.box(this.landing,-5.5+i*.52,y,z,.49,.18,1.6,MAT.woodLight);
    for(const x of [-5,-2.5,0,2.5,5])for(const side of [-1,1]){
      this.box(this.landing,x,y-1.4,z+side*.64,.23,3.25,.23,MAT.woodDark);
      if(Math.abs(x)>4)this.box(this.landing,x,y+.3,z+side*.64,.3,.55,.3,MAT.iron);
    }
    // Sloped gangplanks reach the dry bank without tunneling into it.
    const bankZ=this.riverZ+8;
    for(let i=0;i<11;i++){
      const t=i/10,pz=z+1+(bankZ-z-1)*t,py=THREE.MathUtils.lerp(y,terrainHeight(0,bankZ)+.15,t);
      this.box(this.landing,0,py,pz,2.1,.17,.48,MAT.woodLight);
    }
    const approach=pathRibbon(linePoints({x:0,z:-55},{x:0,z:bankZ}),2.5,mobile);this.ownedGeometries.add(approach);this.landing.add(new THREE.Mesh(approach,MAT.path));
    for(const [x,dz] of [[3,9],[4.1,9.4],[3.3,10.2],[-3.8,10.4]]){
      const py=terrainHeight(x,this.riverZ+dz);
      this.box(this.cargo,x,py+.55,this.riverZ+dz,.95,1.1,.85,MAT.wood);
      this.box(this.cargo,x,py+.55,this.riverZ+dz,.16,1.15,.91,MAT.iron);
    }
    this.box(this.crane,-2.5,y+2,z,.4,4,.4,MAT.woodDark);
    this.box(this.crane,-2.5,y+4,this.riverZ+1.35,.3,.3,4.4,MAT.woodLight);
    this.box(this.crane,-2.5,y+1.15,z,.8,.55,.7,MAT.iron);
    this.box(this.crane,4.8,y+2,z,.16,4,.16,MAT.woodDark);
    this.box(this.crane,4.8,y+3.6,z,.72,.55,.66,MAT.lamp);
    this.load=this.box(this.loading,-2.5,y+.8,this.riverZ,.72,.65,.7,MAT.wood);
    this.rope=this.box(this.loading,-2.5,y+2,this.riverZ,.04,2,.04,MAT.iron);
    for(const group of [this.landing,this.cargo,this.crane])this.batch(group);
    parent.add(this.group);
  }
  private box(parent:THREE.Group,x:number,y:number,z:number,w:number,h:number,d:number,material:THREE.Material){
    const mesh=new THREE.Mesh(this.boxGeometry,material);mesh.position.set(x,y,z);mesh.scale.set(w,h,d);mesh.castShadow=!this.mobile;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  }
  private batch(group:THREE.Group){
    const buckets=new Map<THREE.Material,THREE.BufferGeometry[]>();
    for(const child of group.children){
      const mesh=child as THREE.Mesh;mesh.updateMatrix();const geometry=mesh.geometry.clone().applyMatrix4(mesh.matrix);
      // Path ribbons are indexed and box geometries have UVs: normalize attributes.
      const normalized=geometry.index?geometry.toNonIndexed():geometry;
      if(normalized!==geometry)geometry.dispose();normalized.deleteAttribute('uv');
      const material=mesh.material as THREE.Material,bucket=buckets.get(material)??[];bucket.push(normalized);buckets.set(material,bucket);
    }
    group.clear();
    for(const [material,parts] of buckets){const geometry=mergeGeometries(parts)!;parts.forEach(g=>g.dispose());this.ownedGeometries.add(geometry);const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=!this.mobile;mesh.receiveShadow=true;group.add(mesh);}
  }
  setLevels(levels:Levels){
    this.counts=livingWorldForLevels(levels,this.mobile);
    for(const [models,count] of [[this.birds,this.counts.birds],[this.deer,this.counts.deer],[this.sheep,this.counts.sheep],[this.ships,this.counts.ships]] as const)models.forEach((model,i)=>model.root.visible=i<count);
    this.landing.visible=this.counts.port>0;this.cargo.visible=this.counts.port>=2;this.crane.visible=this.counts.port===3;
    this.update(0,true);
  }
  update(seconds:number,reduced:boolean){
    const time=reduced?0:seconds;
    this.birds.forEach((bird,i)=>{
      if(!bird.root.visible)return;
      const a=time*.14+i*2.399,r=26+(i%3)*7;
      bird.root.position.set(Math.cos(a)*r,terrainHeight(0,0)+12+i%3*1.7+Math.sin(a*2)*.7,Math.sin(a)*r);
      bird.root.rotation.y=-a-Math.PI/2;
      const flap=reduced?.14:Math.sin(time*6+i)*.42;
      bird.parts.get('wingL')!.rotation.x=flap;bird.parts.get('wingR')!.rotation.x=-flap;
    });
    for(const [herd,site,walkDuration] of [[this.deer,DEER_MEADOW,9],[this.sheep,SHEEP_PASTURE,6]] as const){
      herd.forEach((animal,i)=>{
        if(!animal.root.visible)return;
        const t=time+i*2,within=t%16,travel=Math.floor(t/16)*walkDuration+Math.min(within,walkDuration),a=travel*.04+i*Math.PI*2/herd.length,r=4.4;
        const x=site.x+Math.cos(a)*r,z=site.z+Math.sin(a)*r;
        animal.root.position.set(x,terrainHeight(x,z),z);animal.root.rotation.y=-a-Math.PI/2;
        const walking=!reduced&&within<walkDuration;
        for(const [j,role] of ['legFL','legFR','legBL','legBR'].entries())animal.parts.get(role)!.rotation.z=walking?Math.sin(time*5+i+(j===0||j===3?0:Math.PI))*.24:0;
        animal.parts.get('head')!.rotation.z=walking?0:(herd===this.deer?-1.15:-.6)+(reduced?0:Math.sin(time*.8+i)*.07);
      });
    }
    let unloading=false;
    this.ships.forEach((ship,i)=>{
      if(!ship.root.visible)return;
      const visit=riverVisit(time/100+.5+i*.5,this.visit);
      ship.root.position.set(visit.x,visit.y+(reduced?0:Math.sin(time*1.3+i)*.035),visit.z);ship.root.rotation.set(0,visit.yaw,visit.pitch+(reduced?0:Math.sin(time*.9+i)*.012),'YXZ');
      unloading ||= visit.berthed;
    });
    this.loading.visible=this.counts.port===3&&unloading;
    if(this.loading.visible){
      const bottom=this.dockY+.6+(reduced?.5:(Math.sin(time*.65)+1)*.6),top=this.dockY+4;
      this.load.position.y=bottom;this.rope.position.y=(bottom+.325+top)/2;this.rope.scale.y=top-bottom-.325;
    }
  }
  dispose(){this.group.removeFromParent();this.ownedGeometries.forEach(g=>g.dispose());this.group.clear();}
}
