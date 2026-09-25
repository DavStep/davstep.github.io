import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MAT } from './materials';
import { cottageBuilding } from './cottages';
import { addNatureInstances } from './nature-placement';
import { placeProp } from './prop-placement';
import { MILESTONES } from './milestones';
import { FRONTIER_RIVERS,FRONTIER_ROADS,routeSample,routeNearest,regionalRiverWidth,isFrontierCorridor,type RegionPoint } from './frontier-layout';
import { RiverWorks } from './river-works';
import { naturalTerrainHeight,type Environment } from './environment';
import type { Idea,Levels } from './game';

interface Region { idea:Idea;level:number;group:THREE.Group;growth:number }
interface WaterRegion { works:RiverWorks;group:THREE.Group;water:THREE.Mesh;bed:THREE.Mesh;bank:THREE.Mesh;level:number;id:string }
/** Fifty individually revealed milestones beyond the original town. */
export class FrontierWorld {
  readonly group=new THREE.Group();
  private readonly regions:Region[]=[];
  private readonly waterways:WaterRegion[]=[];
  private readonly owned=new Set<THREE.BufferGeometry>();
  private readonly paints=new Set<THREE.Material>();
  private readonly rotors:THREE.Group[]=[];
  private readonly cube=new THREE.BoxGeometry(1,1,1);
  private readonly cone=new THREE.ConeGeometry(1,1,8);
  private readonly cylinder=new THREE.CylinderGeometry(1,1,1,10);
  private readonly ball=new THREE.IcosahedronGeometry(1,1);
  constructor(parent:THREE.Group,private readonly mobile:boolean,private readonly environment:Environment){
    this.group.name='Growing_valley_and_mountains';parent.add(this.group);
    [this.cube,this.cone,this.cylinder,this.ball].forEach(g=>this.owned.add(g));
    for(const idea of Object.keys(MILESTONES) as Idea[])for(let level=4;level<=8;level++){
      if(idea==='river'){this.waterway(level);continue;}
      const site=MILESTONES[idea][level-1],g=new THREE.Group();g.name=`${idea}_level_${level}_${site.name.replaceAll(' ','_')}`;g.position.set(site.x,this.height(site.x,site.z),site.z);
      this.build(g,idea,level,site.x,site.z);this.batch(g);g.visible=false;this.group.add(g);this.regions.push({idea,level,group:g,growth:0});
    }
  }
  private height(x:number,z:number){return this.environment.landscapeHeight?.(x,z)??naturalTerrainHeight(x,z);}
  private mesh(g:THREE.Group,geometry:THREE.BufferGeometry,material:THREE.Material,x:number,y:number,z:number,sx=1,sy=1,sz=1){
    const m=new THREE.Mesh(geometry,material);m.position.set(x-g.position.x,y-g.position.y,z-g.position.z);m.scale.set(sx,sy,sz);m.castShadow=!this.mobile;m.receiveShadow=true;g.add(m);return m;
  }
  private box(g:THREE.Group,x:number,y:number,z:number,w:number,h:number,d:number,mat:THREE.Material){return this.mesh(g,this.cube,mat,x,y,z,w,h,d);}
  private hut(g:THREE.Group,x:number,z:number,variant=0,scale=1){
    const home=cottageBuilding({id:'frontier-home',kind:'home',x:0,z:0,start:0,step:1,stage:6,renovation:0,variant},this.mobile);
    const y=this.height(x,z);home.position.set(x-g.position.x,y+.45-g.position.y,z-g.position.z);home.scale.setScalar(scale);g.add(home);
    this.box(g,x,y+.1,z,5.8*scale,.8,4.8*scale,MAT.stoneDark);
  }
  private prop(g:THREE.Group,family:Parameters<typeof placeProp>[1],x:number,z:number,scale=1){placeProp(g,family,this.mobile,x-g.position.x,this.height(x,z)-g.position.y,z-g.position.z,0,scale);}
  private tower(g:THREE.Group,x:number,z:number,height=8,beacon=false){
    const y=this.height(x,z);this.mesh(g,this.cylinder,MAT.stone,x,y+height/2,z,2.3,height,2.3);
    this.mesh(g,this.cone,MAT.roofBlue,x,y+height+1.5,z,3,3,3);
    for(const side of [-1,1])this.box(g,x+side*2.2,y+height*.7,z,.13,1.5,.7,MAT.window);
    if(beacon){this.mesh(g,this.ball,MAT.gold,x,y+height+3.7,z,1.25,1.4,1.25);this.box(g,x,y+height+3.2,z,.18,4,.18,MAT.gold);}
  }
  private plaza(g:THREE.Group,x:number,z:number,w=17,d=14){this.box(g,x,this.height(x,z)+.08,z,w,.16,d,MAT.path);}
  private lane(g:THREE.Group,route:readonly RegionPoint[],width=3.4){
    const positions:number[]=[];
    for(let j=1;j<route.length;j++){
      const a=route[j-1],b=route[j],dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz),n=Math.ceil(length/.8);
      const edge=(t:number,side:number)=>{const x=a.x+dx*t+dz/length*width*.5*side,z=a.z+dz*t-dx/length*width*.5*side;return [x-g.position.x,this.height(x,z)+.09-g.position.y,z-g.position.z];};
      for(let i=0;i<n;i++)for(const p of [edge(i/n,-1),edge(i/n,1),edge((i+1)/n,-1),edge(i/n,1),edge((i+1)/n,1),edge((i+1)/n,-1)])positions.push(...p);
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.computeVertexNormals();this.owned.add(geo);const m=new THREE.Mesh(geo,MAT.path);m.receiveShadow=true;g.add(m);
  }
  private bridge(g:THREE.Group,x:number,z:number,acrossX=false){
    const y=this.height(x,z)+.25;
    this.box(g,x,y,z,acrossX?12:4.5,.5,acrossX?4.5:12,MAT.woodDark);
    for(const side of [-1,1])this.box(g,x+(acrossX?0:side*2.5),y+1,z+(acrossX?side*2.5:0),acrossX?12:.2,.3,acrossX?.2:12,MAT.woodLight);
    for(const end of [-1,1])this.box(g,x+(acrossX?end*5:0),y-.6,z+(acrossX?0:end*5),acrossX?1:5,1.5,acrossX?5:1,MAT.stone);
  }
  private windmill(g:THREE.Group,x:number,z:number,size=1){
    const y=this.height(x,z);this.mesh(g,this.cylinder,MAT.plaster,x,y+3.3*size,z,1.8*size,6.6*size,1.8*size);this.mesh(g,this.cone,MAT.roof,x,y+7.2*size,z,2.2*size,2*size,2.2*size);
    const rotor=new THREE.Group();rotor.position.set(x-g.position.x,y+5.7*size-g.position.y,z+2*size-g.position.z);rotor.userData.rotor=true;g.add(rotor);
    for(let i=0;i<4;i++){const sail=new THREE.Mesh(this.cube,MAT.woodLight);sail.scale.set(.8*size,4.5*size,.16);sail.position.set(Math.sin(i*Math.PI/2)*2*size,Math.cos(i*Math.PI/2)*2*size,0);sail.rotation.z=-i*Math.PI/2;rotor.add(sail);}
    this.rotors.push(rotor);
  }
  private build(g:THREE.Group,idea:Idea,level:number,x:number,z:number){
    const n=level-4,y=this.height(x,z);
    if(idea==='settlers'){
      this.plaza(g,x,z);const count=this.mobile?3+n:5+n;
      for(let i=0;i<count;i++){const a=i/count*Math.PI*2;this.hut(g,x+Math.cos(a)*9,z+Math.sin(a)*9,i,.85+n*.04);}
      if(level===8)this.tower(g,x,z,13,true);
      this.lane(g,[{x,z:z-15},{x,z:z+15}],2.7);
    }else if(idea==='grove'){
      const sites=[];const count=this.mobile?22+n*3:38+n*6;
      for(let i=0;i<count;i++){
        const a=i*2.399,r=3+Math.sqrt(i/count)*13,px=x+Math.cos(a)*r,pz=z+Math.sin(a)*r;if(isFrontierCorridor(px,pz))continue;
        sites.push({family:(i%3?'Pine_A':'Pine_B') as 'Pine_A'|'Pine_B',x:px-x,y:this.height(px,pz)-g.position.y,z:pz-z,sx:2.5+n*.35,sy:4.2+n*.45,sz:2.5+n*.35,rotation:a});
      }
      addNatureInstances(g,sites,this.mobile);if(level===6)for(let i=0;i<12;i++){const a=i*2.4;this.mesh(g,this.ball,MAT.red,x+Math.cos(a)*8,y+2.6,z+Math.sin(a)*8,.35,.4,.35);}
    }else if(idea==='roads'){
      this.lane(g,FRONTIER_ROADS[n],level>=7?4:3.5);
      if(level===5)this.bridge(g,115,8,true);if(level===6)this.bridge(g,0,117);
      for(let i=0;i<5;i++){const p=routeSample(FRONTIER_ROADS[n],(i+.5)/5);this.prop(g,'Lantern_A',p.x+2.5,p.z,1);}
    }else if(idea==='walls'){
      if(level===6||level===8){for(let i=0;i<4;i++)this.tower(g,x-15+i*10,z+(i%2)*3,level===8?13:8,level===8);}
      else{
        for(const dx of [-7,7])for(const dz of [-7,7])this.tower(g,x+dx,z+dz,7+n);
        for(const side of [-1,1]){this.box(g,x+side*7,this.height(x+side*7,z)+2.5,z,1.3,5,14,MAT.stone);this.box(g,x,this.height(x,z+side*7)+2.5,z+side*7,10,5,1.3,MAT.stone);}
        this.hut(g,x,z,n,1.1);
      }
    }else if(idea==='market'){
      this.plaza(g,x,z,22,18);const count=this.mobile?4+n:6+n*2;
      for(let i=0;i<count;i++){const px=x-8+(i%4)*5,pz=z-6+Math.floor(i/4)*6,py=this.height(px,pz);this.box(g,px,py+.9,pz,3.3,1.5,2,MAT.wood);this.box(g,px,py+3.2,pz,4,.35,3,i%2?MAT.roof:MAT.gold);for(const side of [-1,1])this.box(g,px+side*1.5,py+2,pz,.15,2.5,.15,MAT.woodDark);this.prop(g,'Crate_A',px+1.2,pz+1.3,.7);}
      if(level>=6)this.hut(g,x+10,z+7,n,1.2);
    }else if(idea==='windmill'){
      if(level===6){for(let i=0;i<5;i++){const px=x-8+i*4;this.mesh(g,this.cylinder,MAT.woodLight,px,this.height(px,z)+3,z,1.7,6,1.7);this.mesh(g,this.cone,MAT.roof,px,this.height(px,z)+6.6,z,2,1.5,2);}this.hut(g,x,z+7,1,1.3);}
      else if(level===7){for(let i=0;i<5;i++){const pz=z-8+i*4,py=this.height(x,pz);this.box(g,x,py+.5,pz,19,1,3.5,MAT.stoneDark);for(let j=0;j<12;j++)this.mesh(g,this.ball,MAT.leafLight,x-8+j*1.4,py+1.4,pz,.55,.7,.65);}}
      else{for(let i=0;i<3+(level===8?1:0);i++)this.windmill(g,x-8+i*6,z+(i%2)*7,.85);for(let i=0;i<5;i++)this.box(g,x,y+.15,z-7+i*1.1,20,.3,.7,MAT.gold);}
    }else if(idea==='archive'){
      if(level===7){this.tower(g,x,z,9,true);for(const side of [-1,1])this.hut(g,x+side*7,z+5,2,.8);}
      else{this.plaza(g,x,z,20,16);this.hut(g,x-5,z,2,1.3+n*.08);this.hut(g,x+5,z,2,1.3+n*.08);this.tower(g,x,z-5,7+n*2,level===8);for(let i=0;i<5;i++)this.box(g,x-8+i*4,y+.8,z+6,2.5,1.4,.9,MAT.stone);}
    }else if(idea==='workshop'){
      this.hut(g,x-5,z+5,n,1.1);this.plaza(g,x,z,20,17);
      if(level===4){for(let i=0;i<8;i++)this.prop(g,'Logpile_A',x-7+i*2,z-5,1.5);this.windmill(g,x+5,z,1);}
      if(level===5){for(let i=0;i<4;i++){const pz=z-8+i*4,py=this.height(x,pz);this.box(g,x,py+1,pz,18-i*2,2,3,MAT.stoneDark);for(let j=0;j<4;j++)this.box(g,x-5+j*3,py+2.7,pz,2,1.5,2,MAT.stone);}}
      if(level===6){this.box(g,x,y+3,z,8,6,2,MAT.window);for(const side of [-1,1])this.box(g,x+side*4,y+3,z+1,1,7,2,MAT.woodDark);this.box(g,x,y+6.5,z+1,10,1,2,MAT.woodLight);for(const side of [-1,1])this.box(g,x+side*1.3,y+.15,z+6,.15,.2,11,MAT.iron);this.prop(g,'Crate_A',x,z+7,2);}
      if(level===7){for(let i=0;i<3;i++){const px=x-5+i*5;this.box(g,px,y+2,z-3,3,4,4,MAT.stoneDark);this.box(g,px,y+6,z-4,1.2,8,1.2,MAT.stone);this.box(g,px,y+1.5,z-.9,1.2,1,.1,MAT.gold);}}
      if(level===8){for(const side of [-1,1])this.box(g,x+side*4,y+6,z,1,12,1,MAT.woodDark);this.box(g,x,y+12,z,11,1,2,MAT.woodLight);this.box(g,x,y+7,z,.15,10,.15,MAT.iron);this.box(g,x,y+2,z,5,1,4,MAT.wood);this.windmill(g,x+8,z+6,1.3);}
    }else if(idea==='observatory'){
      if(level===5){for(let i=0;i<12;i++){const a=i*Math.PI/6,px=x+Math.cos(a)*10,pz=z+Math.sin(a)*10;this.box(g,px,this.height(px,pz)+3,pz,1.8,6,1.5,MAT.stone);}this.mesh(g,this.cylinder,MAT.gold,x,y+.2,z,6,.4,6);}
      else if(level===8){for(const [px,pz] of [[0,205],[200,20],[-200,20],[-100,-185],[100,-185]])this.tower(g,px,pz,16,true);}
      else{this.tower(g,x,z,10+n*2,true);this.plaza(g,x,z,13,13);for(const side of [-1,1])this.hut(g,x+side*7,z+6,2,.8);}
    }
  }
  private batch(g:THREE.Group){
    g.updateMatrixWorld(true);const inverse=g.matrixWorld.clone().invert(),buckets=new Map<THREE.Material,THREE.BufferGeometry[]>(),remove:THREE.Mesh[]=[];
    g.traverse(o=>{
      if(!(o instanceof THREE.Mesh)||o instanceof THREE.InstancedMesh||o.parent?.userData.rotor)return;
      let geo=o.geometry.clone().applyMatrix4(inverse.clone().multiply(o.matrixWorld));if(geo.index){const plain=geo.toNonIndexed();geo.dispose();geo=plain;}
      const mat=o.material as THREE.Material;for(const attr of Object.keys(geo.attributes))if(attr!=='position'&&attr!=='normal'&&!(attr==='color'&&(mat as THREE.MeshStandardMaterial).vertexColors))geo.deleteAttribute(attr);
      const list=buckets.get(mat)??[];list.push(geo);buckets.set(mat,list);remove.push(o);
    });remove.forEach(o=>o.removeFromParent());
    for(const [mat,parts] of buckets){const geo=mergeGeometries(parts)!;parts.forEach(p=>p.dispose());this.owned.add(geo);const mesh=new THREE.Mesh(geo,mat);mesh.castShadow=!this.mobile;mesh.receiveShadow=true;g.add(mesh);}
  }
  private waterway(level:number){
    const index=level-4,route=FRONTIER_RIVERS[index],id=`regional-river-${level}`,g=new THREE.Group();g.name=id;this.group.add(g);
    const sample=(t:number)=>routeSample(route,t),width=(t:number)=>regionalRiverWidth(index,t);
    // Follow the rising valley floor instead of cutting a deep trench through its foothills.
    const heights=Array.from({length:81},(_,i)=>{const p=sample(i/80);return Math.max(.48,this.height(p.x,p.z)-.85)+index*.014;});
    if(index===4)for(let i=1;i<heights.length;i++)heights[i]=Math.min(heights[i-1],heights[i]);
    const surface=(t:number)=>{const k=Math.min(79,Math.floor(t*80)),f=t*80-k;return heights[k]+(heights[k+1]-heights[k])*f;};
    this.environment.registerRegionalChannel?.(id,route,width,surface);
    const make=(bank:boolean,bed=false)=>{
      const positions:number[]=[],uv:number[]=[];
      const edge=(t:number,side:number,outer=false)=>{const p=sample(t),a=sample(Math.max(0,t-.002)),b=sample(Math.min(1,t+.002)),dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz)||1,w=width(t)+(outer?3.5:0),x=p.x+dz/len*w*side,z=p.z-dx/len*w*side;return [x,outer?this.height(x,z)+.025:surface(t)-(bed?.85:0),z];};
      for(let i=0;i<80;i++)for(const side of bank?[-1,1]:[0]){
        const a=edge(i/80,side||-1),b=edge(i/80,side||1,bank),c=edge((i+1)/80,side||-1),d=edge((i+1)/80,side||1,bank);
        for(const p of [a,b,c,b,d,c])positions.push(...p);for(const [s,t] of [[-1,i],[1,i],[-1,i+1],[1,i],[1,i+1],[-1,i+1]])uv.push(s,t*1.5);
      }
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.computeVertexNormals();this.owned.add(geo);
      const mat=bank?new THREE.MeshStandardMaterial({color:0xbaa782,roughness:1,side:THREE.DoubleSide}):bed?new THREE.MeshStandardMaterial({color:0x876e50,roughness:1,side:THREE.DoubleSide}):this.environment.createRiverMaterial();this.paints.add(mat);
      const mesh=new THREE.Mesh(geo,mat);mesh.name=bank?'Regional_banks':bed?'Regional_bed':'Regional_flow';g.add(mesh);return mesh;
    };
    const water=make(false),bed=make(false,true),bank=make(true),works=new RiverWorks(g,this.mobile,sample,(x,z)=>this.height(x,z),surface,index===3?14:7,[.15,.85]);
    this.waterways.push({works,group:g,water,bed,bank,level,id});g.visible=false;
  }
  setLevels(levels:Levels,instant=false){
    for(const r of this.regions){const visible=levels[r.idea]>=r.level;if(!visible)r.growth=0;else if(instant)r.growth=1;r.group.visible=visible;r.group.scale.y=Math.max(.01,r.growth);}
    for(const r of this.waterways){r.group.visible=levels.river>=r.level;r.works.setActive(r.group.visible,instant);}
    // Connected channels share an open mouth; old banks must not form a dam
    // across a later reservoir or branch. Preserve quad order for excavation.
    for(const r of this.waterways){
      const p=r.bank.geometry.getAttribute('position');
      const base=r.bank.userData.uncutBanks??=Float32Array.from(p.array);
      (p.array as Float32Array).set(base);
      for(let first=0;first<p.count;first+=6){
        const touches=this.waterways.some(other=>other!==r&&other.group.visible&&Array.from({length:6},(_,k)=>first+k).some(v=>{
          const near=routeNearest(FRONTIER_RIVERS[other.level-4],base[v*3],base[v*3+2]);return near.distance<regionalRiverWidth(other.level-4,near.t)+.15;
        }));
        if(touches)for(let v=first+1;v<first+6;v++)p.setXYZ(v,base[first*3],base[first*3+1],base[first*3+2]);
      }
      p.needsUpdate=true;
    }
    this.update(0,instant);
  }
  update(dt:number,reduced=false){
    for(const r of this.regions)if(r.group.visible){r.growth=reduced?1:Math.min(1,r.growth+Math.max(0,dt)*.8);r.group.scale.y=Math.max(.01,r.growth);}
    if(!reduced)for(const rotor of this.rotors)rotor.rotation.z-=Math.max(0,dt)*.45;
    for(const r of this.waterways){r.works.update(dt,reduced);const dig=r.works.digProgress,flow=r.works.flowProgress;this.environment.setRegionalChannelProgress?.(r.id,dig);r.water.geometry.setDrawRange(0,Math.floor(flow*80)*6);r.bed.geometry.setDrawRange(0,Math.floor(dig*80)*6);r.bank.geometry.setDrawRange(0,Math.floor(dig*80)*12);}
  }
  dispose(){
    for(const r of this.waterways){r.works.dispose();this.environment.setRegionalChannelProgress?.(r.id,0);}
    this.group.removeFromParent();this.group.traverse(o=>{if(o instanceof THREE.InstancedMesh)o.dispose();});this.owned.forEach(g=>g.dispose());this.paints.forEach(m=>m.dispose());this.group.clear();
  }
}
