import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MAT } from './materials';
import { terrainHeight } from './environment';
import { cottageBuilding } from './cottages';
import { addNatureInstances } from './nature-placement';
import { placeProp } from './prop-placement';
import { pathRibbon,linePoints } from './paths';
import { TerrainSurface } from './terrain-surface';
import { OUTSKIRT_SITES,COUNTRY_ROUTES,outskirtsForLevels,type Outskirt } from './outskirts-state';
import type { Levels } from './game';
import wheat from './generated/wheat-tile.json';

/** Countryside districts built once, reconciled from the same choices as town. */
export class Outskirts {
  readonly group=new THREE.Group();
  private readonly stages=new Map<Outskirt,THREE.Group[]>();
  private readonly routes=new THREE.Group();
  private readonly saplings=new Map<Outskirt,THREE.Group>();
  private readonly carts:THREE.Group[]=[];
  private readonly boats:THREE.Group[]=[];
  private readonly owned=new Set<THREE.BufferGeometry>();
  private readonly materials=new Set<THREE.Material>();
  private readonly cube=new THREE.BoxGeometry(1,1,1);
  private readonly round=new THREE.IcosahedronGeometry(1,1);
  private readonly wheel=new THREE.CylinderGeometry(1,1,1,10);
  private state:Record<Outskirt,number>={woodland:0,farms:0,orchard:0,caravan:0,fishery:0};
  private readonly ground:TerrainSurface;
  private pathLayer=0;
  constructor(parent:THREE.Group,private readonly mobile:boolean){
    this.group.name='Growing_countryside';this.routes.name='Country_lanes';this.group.add(this.routes);
    this.ground=new TerrainSurface(mobile);
    [this.cube,this.round,this.wheel].forEach(g=>this.owned.add(g));
    for(const key of Object.keys(OUTSKIRT_SITES) as Outskirt[]){
      const stages=[1,2,3].map(t=>{const g=new THREE.Group();g.name=`${key}_level_${t}`;g.visible=false;this.group.add(g);return g;});this.stages.set(key,stages);
    }
    for(const route of COUNTRY_ROUTES)for(let i=1;i<route.length;i++)this.path(this.routes,route[i-1],route[i],1.8);
    this.woodland();this.farms();this.orchard();this.caravan();this.fishery();
    for(const stages of this.stages.values())for(const stage of stages)this.batch(stage);
    this.batch(this.routes);
    parent.add(this.group);this.routes.visible=false;this.carts.forEach(c=>c.visible=false);this.boats.forEach(b=>b.visible=false);this.saplings.forEach(g=>g.visible=false);
  }
  private mesh(g:THREE.Group,geometry:THREE.BufferGeometry,material:THREE.Material,x:number,y:number,z:number,sx:number,sy:number,sz:number){
    const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=!this.mobile;m.receiveShadow=true;g.add(m);return m;
  }
  private box(g:THREE.Group,x:number,y:number,z:number,w:number,h:number,d:number,material:THREE.Material){return this.mesh(g,this.cube,material,x,y,z,w,h,d);}
  private y(x:number,z:number){return this.ground.sample(x,z).height;}
  private path(g:THREE.Group,a:{x:number;z:number},b:{x:number;z:number},width:number,material:THREE.Material=MAT.path){
    const geometry=pathRibbon(linePoints(a,b),width,this.mobile,this.ground);geometry.translate(0,this.pathLayer++*.0005,0);this.owned.add(geometry);
    this.mesh(g,geometry,material,0,0,0,1,1,1);
  }
  private hut(g:THREE.Group,x:number,z:number,variant=0,scale=.9){
    const home=cottageBuilding({id:'country-home',kind:'home',x:0,z:0,start:0,step:1,stage:4,renovation:0,variant},this.mobile);
    const y=this.y(x,z)+.2;home.position.set(x,y,z);home.scale.setScalar(scale);g.add(home);
    this.box(g,x,y-.3,z,5*scale,.7,4*scale,MAT.stoneDark);
  }
  private fence(g:THREE.Group,x:number,z:number,length:number,alongX=true){
    const count=Math.ceil(length/2.4);
    for(let i=0;i<=count;i++){
      const px=x+(alongX?i*length/count:0),pz=z+(alongX?0:i*length/count),y=this.y(px,pz);
      this.box(g,px,y+.6,pz,.16,1.2,.16,MAT.woodDark);
      if(i<count){const mx=px+(alongX?length/count/2:0),mz=pz+(alongX?0:length/count/2),my=this.y(mx,mz);
        for(const h of [.4,.85])this.box(g,mx,my+h,mz,alongX?length/count:.12,.12,alongX?.12:length/count,MAT.woodLight);
      }
    }
  }
  private tree(g:THREE.Group,x:number,z:number,size:number,fruit=false){
    const y=this.y(x,z);this.box(g,x,y+size*1.4,z,.24*size,2.8*size,.24*size,MAT.woodDark);
    this.mesh(g,this.round,MAT.leafLight,x,y+size*3,z,1.7*size,1.8*size,1.7*size);
    if(fruit)for(let i=0;i<6;i++){const a=i*2.4;this.mesh(g,this.round,i%2?MAT.red:MAT.gold,x+Math.cos(a)*size*1.3,y+size*(2.8+(i%3)*.35),z+Math.sin(a)*size*1.3,.16,.18,.16);}
  }
  private woodland(){
    const [a,b,c]=this.stages.get('woodland')!;
    const young=new THREE.Group();young.name='Woodland_saplings';a.add(young);this.saplings.set('woodland',young);
    const trees=Array.from({length:this.mobile?10:18},(_,i)=>{const angle=i*2.4,r=4+(i%4)*2;return {family:'Pine_A' as const,x:-98+Math.cos(angle)*r,z:24+Math.sin(angle)*r,y:0,sx:2.3,sy:3.8,sz:2.3,rotation:angle};});
    trees.forEach(t=>t.y=this.y(t.x,t.z));
    addNatureInstances(young,trees.map(t=>({...t,sx:t.sx*.38,sy:t.sy*.38,sz:t.sz*.38})),this.mobile);
    addNatureInstances(b,trees,this.mobile);this.hut(b,-105,12,1,.8);
    this.path(b,{x:-110,z:12},{x:-105,z:12},1.2);
    for(let i=0;i<4;i++)placeProp(c,'Logpile_A',this.mobile,-92+i*1.3,this.y(-92+i*1.3,11),11,0,.9);
    this.fence(c,-107,35,19);this.makeCart(-107,0,'woodland');
  }
  private farms(){
    const [a,b,c]=this.stages.get('farms')!;
    for(const x of [84,96]){
      this.path(a,{x,z:20},{x,z:37},8.5,MAT.earth);
      for(let row=0;row<5;row++)this.path(a,{x:x-3.2+row*1.6,z:20},{x:x-3.2+row*1.6,z:37},.18,MAT.sand);
    }
    this.fence(a,79,39,23);this.hut(b,93,12,0,1.05);
    this.path(b,{x:106,z:12},{x:94,z:12},1.6);
    for(let i=0;i<(this.mobile?40:80);i++){
      const x=81+(i%5)*1.4,z=21+Math.floor(i/5)*.95;
      this.mesh(b,this.round,MAT.leaf,x,this.y(x,z)+.28,z,.34,.28,.34);
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(wheat.positions,3));geo.setAttribute('normal',new THREE.Float32BufferAttribute(wheat.normals,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(wheat.colors,3));this.owned.add(geo);
    const paint=new THREE.MeshStandardMaterial({color:0xe7bd5b,vertexColors:true,roughness:1});this.materials.add(paint);
    const count=this.mobile?60:130,crops=new THREE.InstancedMesh(geo,paint,count),dummy=new THREE.Object3D();crops.name='Country_wheat';
    for(let i=0;i<count;i++){const x=92.7+(i%7)*.98,z=21+Math.floor(i/7)*.85;dummy.position.set(x,this.y(x,z),z);dummy.scale.setScalar(.8);dummy.rotation.y=i*2.4;dummy.updateMatrix();crops.setMatrixAt(i,dummy.matrix);}
    crops.computeBoundingSphere();crops.receiveShadow=true;c.add(crops);
    this.hut(c,82,13,3,.8);for(let i=0;i<4;i++)placeProp(c,'Crate_A',this.mobile,99,this.y(99,12+i),12+i,0,.5);
  }
  private orchard(){
    const [a,b,c]=this.stages.get('orchard')!;
    const young=new THREE.Group();young.name='Orchard_saplings';this.group.add(young);this.saplings.set('orchard',young);
    this.fence(a,-35,79,23);this.fence(a,-35,79,19,false);
    for(let row=0;row<3;row++)for(let col=0;col<4;col++){
      const x=-33+col*5.5,z=83+row*5;
      this.tree(young,x,z,.3);this.tree(b,x,z,.75);
      for(let i=0;i<5;i++){const angle=i*2.4;this.mesh(c,this.round,i%2?MAT.red:MAT.gold,x+Math.cos(angle)*1.05,this.y(x,z)+2.1+(i%2)*.45,z+Math.sin(angle)*1.05,.18,.2,.18);}
    }
    this.batch(young);
    this.hut(c,-12,96,1,.75);for(let i=0;i<4;i++)placeProp(c,'Barrel_A',this.mobile,-17+i*1.1,this.y(-17+i*1.1,98),98,0,.6);
  }
  private caravan(){
    const [a,b,c]=this.stages.get('caravan')!;
    for(const [x,z] of [[3,73],[-69,3],[69,3]]){
      const y=this.y(x,z);this.box(a,x,y+1.2,z,.2,2.4,.2,MAT.woodDark);this.box(a,x+.45,y+2,z,1.3,.5,.15,MAT.woodLight);
    }
    this.hut(b,20,83,0,1.15);this.path(b,{x:20,z:87},{x:23,z:100},2);
    this.box(b,27,this.y(27,86)+.8,86,3,.22,1.4,MAT.woodLight);
    for(const x of [25.8,28.2])this.box(b,x,this.y(x,86)+.4,86,.2,.8,.7,MAT.woodDark);
    this.fence(b,12,78,21);
    this.hut(c,31,88,1,.85);
    for(let i=0;i<6;i++)placeProp(c,i%2?'Barrel_A':'Crate_A',this.mobile,14+i*1.2,this.y(14+i*1.2,94),94,0,.65);
    this.makeCart(0,80,'caravan');
  }
  private fishery(){
    const [a,b,c]=this.stages.get('fishery')!;
    const y=this.y(-82,-12)+.18;
    for(const x of [-84,-80])this.box(a,x,this.y(x,-13)+.8,-13,.18,1.6,.18,MAT.woodDark);
    this.hut(b,-94,-14,2,.85);this.path(b,{x:-96,z:-14},{x:-82,z:-12},1.3);
    for(let i=0;i<22;i++)this.box(b,-82,y,-12-i*.5,2.4,.17,.46,MAT.woodLight);
    for(const z of [-14,-18,-22])for(const x of [-83,-81])this.box(b,x,y-1,z,.16,2,.16,MAT.woodDark);
    for(let i=0;i<4;i++)placeProp(c,'Crate_A',this.mobile,-86-i,this.y(-86-i,-13),-13,0,.6);
    const ny=this.y(-91,-19);for(const x of [-94,-88])this.box(c,x,ny+1.8,-19,.18,3.6,.18,MAT.woodDark);
    for(let i=0;i<12;i++)this.box(c,-94+i*.5,ny+2,-19,.035,2.4,.035,MAT.woodDark);
    for(let i=0;i<5;i++)this.box(c,-91,ny+.8+i*.55,-19,6,.035,.035,MAT.woodDark);
    const boat=new THREE.Group();boat.name='Pond_fishing_boat';
    this.box(boat,0,0,0,1.3,.35,3.2,MAT.woodDark);
    for(const x of [-.7,.7])this.box(boat,x,.3,0,.14,.5,3.4,MAT.woodLight);
    for(const z of [-1.65,1.65])this.box(boat,0,.3,z,1.5,.5,.15,MAT.woodLight);
    for(const z of [-.8,.8])this.box(boat,0,.38,z,1.25,.13,.35,MAT.woodDark);
    this.batch(boat);this.boats.push(boat);this.group.add(boat);
  }
  private makeCart(x:number,z:number,district:'woodland'|'caravan'){
    const cart=new THREE.Group();cart.name=`${district}_wagon`;
    this.box(cart,0,.9,0,2,.25,3.1,MAT.woodDark);
    for(const side of [-1,1])this.box(cart,side,1.4,0,.13,.9,3.1,MAT.woodLight);
    for(const px of [-1.13,1.13])for(const pz of [-1,1]){const w=this.mesh(cart,this.wheel,MAT.iron,px,.55,pz,.52,.18,.52);w.rotation.z=Math.PI/2;}
    for(let i=0;i<3;i++)this.box(cart,(i%2)*.75-.4,1.4+i*.15,-.7+i*.7,.8,.75,.8,MAT.wood);
    this.box(cart,0,.65,2.5,.12,.12,2.2,MAT.woodDark);this.batch(cart);
    cart.position.set(x,this.y(x,z),z);this.carts.push(cart);this.group.add(cart);
  }
  private batch(group:THREE.Group){
    group.updateMatrixWorld(true);const buckets=new Map<THREE.Material,THREE.BufferGeometry[]>(),remove:THREE.Mesh[]=[];
    group.traverse(o=>{
      if(!(o instanceof THREE.Mesh)||o instanceof THREE.InstancedMesh)return;
      let g=o.geometry.clone().applyMatrix4(o.matrixWorld);if(g.index){const plain=g.toNonIndexed();g.dispose();g=plain;}
      const material=o.material as THREE.Material;
      for(const name of Object.keys(g.attributes))if(name!=='position'&&name!=='normal'&&!(name==='color'&&(material as THREE.MeshStandardMaterial).vertexColors))g.deleteAttribute(name);
      const list=buckets.get(material)??[];list.push(g);buckets.set(material,list);remove.push(o);
    });
    remove.forEach(o=>o.removeFromParent());
    for(const [material,parts] of buckets){const geometry=mergeGeometries(parts)!;parts.forEach(g=>g.dispose());this.owned.add(geometry);this.mesh(group,geometry,material,0,0,0,1,1,1);}
  }
  setLevels(levels:Levels){
    this.state=outskirtsForLevels(levels);
    for(const [key,stages] of this.stages)stages.forEach((g,i)=>g.visible=this.state[key]>i);
    for(const [key,young] of this.saplings)young.visible=this.state[key]===1;
    this.routes.visible=levels.roads>=2;
    this.carts[0].visible=this.state.woodland===3;this.carts[1].visible=this.state.caravan===3;
    this.boats[0].visible=this.state.fishery===3;
    this.update(0,true);
  }
  update(seconds:number,reduced:boolean){
    const t=reduced?0:seconds;
    for(const [i,cart] of this.carts.entries()){
      if(!cart.visible)continue;
      const wave=(Math.sin(t*.07+i)+1)/2;
      const x=i===0?-70-wave*36:0,z=i===0?0:70+wave*28;
      cart.position.set(x,this.y(x,z)+.07,z);cart.rotation.y=(i===0?-Math.PI/2:0)+(Math.cos(t*.07+i)<0?Math.PI:0);
    }
    for(const boat of this.boats){boat.position.set(-79,terrainHeight(-82,-27)+.8+(reduced?0:Math.sin(t*.9)*.06),-25);boat.rotation.y=.2;boat.rotation.z=reduced?0:Math.sin(t*.7)*.025;}
  }
  dispose(){
    this.group.removeFromParent();this.group.traverse(o=>{if(o instanceof THREE.InstancedMesh)o.dispose();});
    this.owned.forEach(g=>g.dispose());this.materials.forEach(m=>m.dispose());this.group.clear();
  }
}
