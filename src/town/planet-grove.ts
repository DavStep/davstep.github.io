import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
import { createFirGeometry } from './planet-assets';
import { getNatureAsset } from './nature';
import { PLANET_RADIUS as R,planetElevation,globeDirection,surfaceNormal } from './planet-geography';
import { planetRoadClearance } from './planet-road-clearance';
import { snapshotForGame } from './game-snapshot';
import { IDEAS,type Levels } from './game';
import { createLivingAnimal } from './living-world';
import type { RoadPoint } from './planet-building-access';

import { GROVE_ORIGIN,GROVE_SEEDS } from './planet-grove-sites';
export { GROVE_ORIGIN } from './planet-grove-sites';
const UP=new THREE.Vector3(0,1,0),origin=surfaceNormal(GROVE_ORIGIN.x,GROVE_ORIGIN.z);
const rand=(n:number)=>{const v=Math.sin(n*127.1+311.7)*43758.5453123;return v-Math.floor(v);};
export type GroveSite={normal:THREE.Vector3;level:number;seed:number};
type Clearance=(point:RoadPoint,radius:number)=>boolean;
export function groveTreeBudget(level:number,total:number,mobile=false){
  const counts=mobile?[0,3,12,32,90,230,550,1100,total]:[0,3,12,40,150,450,1100,2200,total];
  return Math.min(total,counts[Math.max(0,Math.min(8,Math.floor(level)))]);
}
function sourcePoint(n:THREE.Vector3):RoadPoint{return {x:2*R*n.x/(1+n.y),z:2*R*n.z/(1+n.y)};}
function obstructed(n:THREE.Vector3,radius:number,blocked:Clearance){return n.y>-.5&&blocked(sourcePoint(n),radius*2/(1+n.y));}
function offset(n:THREE.Vector3,x:number,z:number){
  const basis=new THREE.Quaternion().setFromUnitVectors(UP,n);
  return n.clone().multiplyScalar(R).add(new THREE.Vector3(x,0,z).applyQuaternion(basis)).normalize();
}
function gentle(n:THREE.Vector3){
  const h=planetElevation(n);
  return h>1&&h<7&&[[1,0],[-1,0],[0,1],[0,-1]].every(([x,z])=>Math.abs(planetElevation(offset(n,x,z))-h)<.6);
}
/** Stable, castle-first ordering: an upgrade extends the same grove, never reseeds it. */
export function createGroveSites(mobile:boolean):GroveSite[]{
  const reserved=planetRoadClearance(snapshotForGame(Object.fromEntries(IDEAS.map(id=>[id,8])) as Levels),[]);
  const seeds=GROVE_SEEDS.map(({x,z})=>surfaceNormal(x,z));
  const candidates:THREE.Vector3[]=[],noise=new ImprovedNoise();
  // Enough local candidates for small, readable early upgrades at either quality tier.
  for(let i=0;i<160;i++){
    const a=i*2.399,r=4+Math.sqrt(i/160)*36,n=surfaceNormal(GROVE_ORIGIN.x+Math.cos(a)*r,GROVE_ORIGIN.z+Math.sin(a)*r);
    if(gentle(n)&&!obstructed(n,1.7,reserved)&&seeds.every(p=>p.distanceTo(n)*R>2.4))candidates.push(n);
  }
  for(let i=0;i<(mobile?7000:14500);i++){
    const n=globeDirection(Math.asin(rand(i*3+600)*2-1),rand(i*3+601)*Math.PI*2);
    if(origin.distanceTo(n)*R<40||!gentle(n)||noise.noise(n.x*13,n.y*13,n.z*13)<-.22||obstructed(n,1.7,reserved))continue;
    candidates.push(n);
  }
  candidates.sort((a,b)=>b.dot(origin)-a.dot(origin));
  const all=[...seeds,...candidates],total=all.length;
  return all.map((normal,i)=>{let level=1;while(level<8&&i>=groveTreeBudget(level,total,mobile))level++;return {normal,level,seed:i};});
}

function flowerGeometry(){
  const pieces:THREE.BufferGeometry[]=[];
  const add=(geometry:THREE.BufferGeometry,hex:number)=>{
    const color=new THREE.Color(hex),colors:number[]=[];
    for(let i=0;i<geometry.getAttribute('position').count;i++)colors.push(color.r,color.g,color.b);
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    // Octahedron centres have no UVs; these untextured flowers do not need them.
    geometry.deleteAttribute('uv');pieces.push(geometry.index?geometry.toNonIndexed():geometry);
    if(geometry.index)geometry.dispose();
  };
  for(let i=0;i<5;i++){
    const a=i*2.399,x=Math.cos(a)*.65,z=Math.sin(a)*.65,y=.3+(i%3)*.13;
    add(new THREE.CylinderGeometry(.022,.035,y,4,1,true).translate(x,y/2,z),0x537436);
    const petals=new THREE.CircleGeometry(.23,10),p=petals.getAttribute('position');
    for(let j=1;j<p.count;j++)if(j%2===0){p.setX(j,p.getX(j)*.48);p.setY(j,p.getY(j)*.48);}
    add(petals.rotateX(-Math.PI/2).translate(x,y,z),0xffffff);
    add(new THREE.OctahedronGeometry(.075).scale(1,.5,1).translate(x,y+.015,z),0xf4c85f);
  }
  const geometry=mergeGeometries(pieces)!;pieces.forEach(p=>p.dispose());return geometry;
}
interface Layer {meshes:THREE.InstancedMesh[];sites:GroveSite[];bases:Float32Array[];clear:boolean[];kind:'tree'|'bush'|'flower'}

/** Native spherical ecosystem, including gradual growth and safe grazing habitats. */
export class PlanetGrove {
  readonly group=new THREE.Group();
  readonly sites:GroveSite[];
  private layers:Layer[]=[];
  private geometry=new Set<THREE.BufferGeometry>();
  private materials=new Set<THREE.Material>();
  private wildlife:{model:ReturnType<typeof createLivingAnimal>;site:GroveSite;family:'bird'|'deer'|'sheep';seed:number;clear:boolean}[]=[];
  private target=0;
  private growth=0;
  private from=0;
  private progress=1;
  private lastTime:number|null=null;
  private time=0;
  constructor(parent:THREE.Group,private mobile:boolean){
    this.group.name='Grove succession';parent.add(this.group);this.sites=createGroveSites(mobile);
    const trunks=new THREE.CylinderGeometry(.095,.17,.9,6),crowns=createFirGeometry();
    this.addLayer('tree',this.sites,[trunks,crowns],[0x71563b,0xffffff]);
    const flora=this.sites.flatMap((site,i)=>{
      const n=offset(site.normal,2.2*Math.cos(i*2.399),2.2*Math.sin(i*2.399));
      return gentle(n)?[{normal:n,level:Math.max(3,site.level),seed:i}]:[];
    });
    const shrubs=getNatureAsset('Shrub_A',mobile)[0].geometry.clone().scale(1.35,.8,1.35);
    this.addLayer('bush',flora.filter((_,i)=>i%3===0),[shrubs],[0xffffff]);
    this.addLayer('flower',flora.filter((_,i)=>i%2===0),[flowerGeometry()],[0xffffff]);
    const clones=new Map<THREE.Material,THREE.Material>();
    for(let level=4;level<=8;level++)for(let i=0;i<(mobile?2:4);i++){
      const family=level===4||i===0?'bird':level>=7&&i===3?'sheep':'deer';
      const band=this.sites.filter(s=>s.level<=level&&s.level>=Math.max(2,level-2));
      const chosen=(level===4&&i===0||level===5&&i===1)?this.sites[0]:band[Math.floor(rand(level*51+i*17)*band.length)]??this.sites[0];
      const site={...chosen,normal:offset(chosen.normal,3,0),level};
      const model=createLivingAnimal(family,mobile);
      model.root.traverse(o=>{if(o instanceof THREE.Mesh){const original=o.material as THREE.Material;let clone=clones.get(original);if(!clone){clone=original.clone();clones.set(original,clone);this.materials.add(clone);}o.material=clone;}});
      this.group.add(model.root);this.wildlife.push({model,site,family,seed:level*9+i,clear:false});
    }
    this.group.traverse(o=>o.userData.planetNative=true);
    this.reconcile();
  }
  private addLayer(kind:Layer['kind'],sites:GroveSite[],geometries:THREE.BufferGeometry[],colors:number[]){
    const dummy=new THREE.Object3D(),color=new THREE.Color();
    const meshes=geometries.map((geometry,part)=>{
      this.geometry.add(geometry);
      const material=new THREE.MeshStandardMaterial({color:colors[part],vertexColors:geometry.hasAttribute('color'),roughness:1,side:kind==='flower'?THREE.DoubleSide:THREE.FrontSide});this.materials.add(material);
      const mesh=new THREE.InstancedMesh(geometry,material,sites.length);mesh.name=`Grove ${kind} ${part}`;mesh.castShadow=kind==='tree';mesh.receiveShadow=true;mesh.frustumCulled=false;
      sites.forEach((site,i)=>{
        const n=site.normal,size=kind==='tree'?.75+rand(site.seed+12000)*.65:.7+rand(site.seed+40)*.5;
        dummy.position.copy(n).multiplyScalar(R+planetElevation(n)+(kind==='tree'&&part===0?.3*size:.06));
        dummy.quaternion.setFromUnitVectors(UP,n);dummy.rotateY(rand(site.seed+8200)*Math.PI*2);dummy.scale.setScalar(size);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
        if(kind==='flower'){color.set([0xf9dd73,0xf2e8ce,0xd897c5,0xaebeed][i%4]);mesh.setColorAt(i,color);}
        else if(kind==='tree'&&part===1){color.setHSL(.26+rand(i)*.07,.4+rand(i+20)*.16,.33+rand(i+50)*.13);mesh.setColorAt(i,color);}
      });
      mesh.count=0;this.group.add(mesh);return mesh;
    });
    this.layers.push({kind,sites,meshes,bases:meshes.map(m=>new Float32Array(m.instanceMatrix.array)),clear:sites.map(()=>true)});
  }
  setLevel(level:number,instant=false){
    const target=Math.max(0,Math.min(8,level));
    if(target===this.target){if(instant&&this.growth!==target){this.growth=target;this.progress=1;this.reconcile();}return;}
    this.from=this.growth;this.target=target;this.progress=instant||target===0?1:0;
    if(this.progress===1)this.growth=target;
    this.reconcile();
  }
  setClearance(blocked:Clearance){
    for(const layer of this.layers)layer.clear=layer.sites.map(site=>!obstructed(site.normal,layer.kind==='tree'?1.65:1,blocked));
    for(const creature of this.wildlife){
      // Reserve the entire small roaming patch, including its shoreline and road margins.
      creature.clear=[creature.site.normal,...Array.from({length:12},(_,i)=>offset(creature.site.normal,Math.cos(i*Math.PI/6)*2.1,Math.sin(i*Math.PI/6)*2.1))]
        .every(n=>gentle(n)&&!obstructed(n,1.2,blocked));
    }
    this.reconcile();
  }
  private reconcile(){
    for(const layer of this.layers){
      const count=layer.sites.findIndex(site=>site.level>Math.ceil(this.growth));
      for(const [part,mesh] of layer.meshes.entries()){
        mesh.count=count<0?layer.sites.length:count;
        for(let i=0;i<mesh.count;i++){
          const site=layer.sites[i],born=THREE.MathUtils.clamp((this.growth-site.level+1)*1.5-rand(site.seed)*.45,0,1);
          const maturity=layer.kind==='tree'?Math.min(1,.62+Math.max(0,this.growth-site.level)*.19):1;
          const size=layer.clear[i]?born*maturity:0;
          for(let j=0;j<16;j++)mesh.instanceMatrix.array[i*16+j]=layer.bases[part][i*16+j]*(j<12?size:1);
          if(layer.kind==='tree'&&part===0){
            const baseSize=.75+rand(site.seed+12000)*.65,lower=.3*baseSize*(1-size);
            mesh.instanceMatrix.array[i*16+12]-=site.normal.x*lower;
            mesh.instanceMatrix.array[i*16+13]-=site.normal.y*lower;
            mesh.instanceMatrix.array[i*16+14]-=site.normal.z*lower;
          }
        }
        mesh.instanceMatrix.needsUpdate=true;
      }
    }
    for(const animal of this.wildlife)animal.model.root.visible=animal.clear&&this.growth>=animal.site.level;
  }
  render(now:number,reduced=false){
    const dt=this.lastTime===null?0:Math.max(0,Math.min(.1,(now-this.lastTime)/1000));this.lastTime=now;
    if(this.progress<1){this.progress=reduced?1:Math.min(1,this.progress+dt/2.4);const t=this.progress*this.progress*(3-2*this.progress);this.growth=THREE.MathUtils.lerp(this.from,this.target,t);this.reconcile();}
    if(!reduced)this.time+=dt;
    const t=reduced?0:this.time;
    for(const creature of this.wildlife){
      const {model,site,family,seed}=creature;if(!model.root.visible)continue;
      const angle=t*(family==='bird'?.35:.12)+seed,walking=family!=='bird'&&!reduced&&(t+seed)%14<6;
      const phase=family==='bird'?angle:(Math.floor((t+seed)/14)*6+Math.min((t+seed)%14,6))*.12+seed;
      const n=offset(site.normal,Math.cos(phase)*1.7,Math.sin(phase)*1.7);
      model.root.position.copy(n).multiplyScalar(R+planetElevation(n)+(family==='bird'?4.5+Math.sin(angle)*.4:.08));
      model.root.quaternion.setFromUnitVectors(UP,n);model.root.rotateY(-phase-Math.PI/2);model.root.scale.setScalar(.8);
      if(family==='bird'){
        model.parts.get('wingL')!.rotation.x=reduced?.14:Math.sin(t*6+seed)*.42;model.parts.get('wingR')!.rotation.x=-model.parts.get('wingL')!.rotation.x;
      }else{
        for(const [i,role] of ['legFL','legFR','legBL','legBR'].entries())model.parts.get(role)!.rotation.z=walking?Math.sin(t*5+seed+(i===0||i===3?0:Math.PI))*.24:0;
        model.parts.get('head')!.rotation.z=walking?0:family==='deer'?-1.1:-.6;
      }
    }
  }
  get level(){return this.growth;}
  dispose(){for(const layer of this.layers)layer.meshes.forEach(m=>m.dispose());this.geometry.forEach(g=>g.dispose());this.materials.forEach(m=>m.dispose());this.group.removeFromParent();}
}
