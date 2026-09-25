import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PLOTS } from './model';
import { INFRASTRUCTURE } from './town-plan';
import { MAT } from './materials';
import { addNatureInstances, type NaturePlacement } from './nature-placement';
import { channelFront } from './river-works';
import { MILL_POOL, millStreamDistance, millStreamParameter } from './game-path';
import { isLivingWorldSite } from './living-world-state';
import { isMountWorksite } from './landscape-state';
import { isRegionalRiverCorridor, routeNearest, type RegionPoint } from './frontier-layout';
import { isDistrictSite } from './idea-districts';
import { landHeight, terrainGridCoordinate, terrainGridDivisions } from './topography';
import { riverCenter, riverHalfWidth, riverSurfaceHeight } from './river-layout';
export { riverCenter, riverHalfWidth, riverSurfaceHeight } from './river-layout';
import { moatBedHeight, moatDistance, moatRouteParameter, MOAT_FEED_X } from './moat-layout';

const hash=(n:number)=>{let x=n|0;x^=x>>>16;x=Math.imul(x,0x7feb352d);x^=x>>>15;return (x^x>>>16)>>>0;};
const rand=(seed:number)=>hash(seed)/0xffffffff;

const baseTerrainHeight=landHeight;
export const PONDS=([{x:-82,z:-27,r:8},{x:83,z:-34,r:6.5}] as const);
const smoothstep=(min:number,max:number,value:number)=>{const t=THREE.MathUtils.clamp((value-min)/(max-min),0,1);return t*t*(3-2*t);};
function terrainHeightAtStreamProgress(x:number,z:number,progress:number):number{
  const riverDepth=1.5*(1-smoothstep(riverHalfWidth(x)-.3,riverHalfWidth(x)+2.5,Math.abs(z-riverCenter(x))));
  const streamDistance=Math.min(millStreamDistance(x,z),Math.hypot(x-MILL_POOL.x,z-MILL_POOL.z)-MILL_POOL.radius+3.1);
  const branchDepth=progress*Math.max(1.65,baseTerrainHeight(x,z)+1.17)*(1-smoothstep(2.2,4.3,streamDistance));
  let pondDepth=0;
  for(const p of PONDS)pondDepth=Math.max(pondDepth,1.35*(1-smoothstep(p.r-.35,p.r+2.1,Math.hypot(x-p.x,z-p.z))));
  return baseTerrainHeight(x,z)-Math.max(riverDepth,pondDepth,branchDepth);
}
export const terrainHeight=(x:number,z:number):number=>terrainHeightAtStreamProgress(x,z,1);
export const naturalTerrainHeight=(x:number,z:number):number=>terrainHeightAtStreamProgress(x,z,0);
export function isWater(x:number,z:number,clearance=0):boolean{
  return Math.abs(z-riverCenter(x))<riverHalfWidth(x)+clearance||PONDS.some(p=>Math.hypot(x-p.x,z-p.z)<p.r+clearance);
}

function waterMaterial(time:{value:number},light:{value:number},pond=false):THREE.MeshBasicMaterial{
  const material=new THREE.MeshBasicMaterial({color:0xffffff,side:THREE.DoubleSide});
  material.onBeforeCompile=shader=>{
    shader.uniforms.townWaterTime=time;shader.uniforms.townWaterLight=light;
    shader.vertexShader='varying vec2 vTownWaterUv;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvTownWaterUv=uv;');
    shader.fragmentShader='uniform float townWaterTime; uniform float townWaterLight; varying vec2 vTownWaterUv;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float edge=${pond?'smoothstep(.63,.98,length((vTownWaterUv-.5)*2.0))':'smoothstep(.45,1.0,abs(vTownWaterUv.x))'};
      float flow=${pond?'length((vTownWaterUv-.5)*2.0)*16.0-townWaterTime*.8':'vTownWaterUv.y*.82-townWaterTime*.55'};
      float ripple=sin(flow+sin(vTownWaterUv.x*8.0+vTownWaterUv.y*.24)*.5);
      float broken=smoothstep(.1,.7,sin(vTownWaterUv.y*1.7+vTownWaterUv.x*13.0));
      float glint=smoothstep(.975,.999,ripple)*broken;
      float foam=smoothstep(.92,.99,edge)*(.25+.15*sin(flow*1.3));
      vec3 deep=vec3(.035,.31,.43),shallow=vec3(.16,.62,.65);
      diffuseColor.rgb=(mix(deep,shallow,edge)+ripple*.012)*(townWaterLight);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.76,.94,.89)*townWaterLight,glint*.4+foam*.55);
    `);
  };
  material.customProgramCacheKey=()=>pond?'town-pond-v1':'town-river-v1';
  return material;
}

export class Environment {
  readonly group=new THREE.Group();
  readonly trees:{x:number;z:number;r:number}[]=[];
  readonly activeTrees:{x:number;z:number;r:number}[]=[];
  private readonly forestLayers:THREE.Group[]=[];
  private readonly mainWater=new THREE.Group();
  private riverLevel=0;
  private groveLevel=0;
  private readonly grassPaint=new THREE.MeshLambertMaterial({color:0xffffff,side:THREE.DoubleSide,vertexColors:true});
  private readonly wind={value:0};
  private readonly waterTime={value:0};
  private readonly waterLight={value:1};
  private readonly reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  private currentSeason='';
  private terrainGeometry:THREE.PlaneGeometry|null=null;
  private mountainMesh:THREE.Mesh|null=null;
  private readonly groundRay=new THREE.Raycaster();
  private readonly groundCache=new Map<string,number>();
  private readonly regionalCuts=new Map<string,{progress:number;vertices:{geometry:THREE.BufferGeometry;index:number;base:number;target:number;t:number}[]}>();
  private readonly regionalOriginal=new Map<THREE.BufferGeometry,Map<number,number>>();
  private townSquare:THREE.Mesh|null=null;
  private streamVertices:{index:number;x:number;z:number;base:number;natural:number;carved:number;streamT:number;moatT:number}[]=[];
  private readonly streamVertexByIndex=new Map<number,(typeof this.streamVertices)[number]>();
  private streamStep=-1;
  private moatStep=0;
  private riverBankGeometry:THREE.BufferGeometry|null=null;
  private closedRiverBankIndices:number[]=[];
  private openRiverBankIndices:number[]=[];
  constructor(scene:THREE.Scene,private mobile:boolean,private gameMode=false){
    this.mainWater.name='Main_river_and_ponds';
    this.buildTerrain();this.buildWater();this.buildMountains();this.buildForest();this.buildGrass();this.buildFlowers();
    scene.add(this.group);
  }
  landscapeHeight(x:number,z:number):number{
    if(Math.hypot(x,z)<150||!this.mountainMesh)return naturalTerrainHeight(x,z);
    const key=`${x.toFixed(3)},${z.toFixed(3)}`,cached=this.groundCache.get(key);if(cached!==undefined)return cached;
    this.mountainMesh.updateMatrixWorld();this.groundRay.set(new THREE.Vector3(x,150,z),new THREE.Vector3(0,-1,0));
    const y=Math.max(naturalTerrainHeight(x,z),this.groundRay.intersectObject(this.mountainMesh)[0]?.point.y??0);
    this.groundCache.set(key,y);return y;
  }
  registerRegionalChannel(id:string,route:readonly RegionPoint[],width:(t:number)=>number,surface:(t:number)=>number){
    const vertices:{geometry:THREE.BufferGeometry;index:number;base:number;target:number;t:number}[]=[];
    for(const geometry of [this.terrainGeometry,this.mountainMesh?.geometry]){
      if(!geometry)continue;const p=geometry.getAttribute('position'),original=this.regionalOriginal.get(geometry)??new Map<number,number>();this.regionalOriginal.set(geometry,original);
      for(let i=0;i<p.count;i++){
        const n=routeNearest(route,p.getX(i),p.getZ(i)),w=width(n.t);if(n.distance>w+3.5)continue;
        const base=original.get(i)??p.getY(i);original.set(i,base);
        const blend=smoothstep(w,w+3.5,n.distance),target=Math.min(base,surface(n.t)-1.1+(base-surface(n.t)+1.1)*blend);
        vertices.push({geometry,index:i,base,target,t:n.t});
      }
    }
    this.regionalCuts.set(id,{progress:0,vertices});
  }
  setRegionalChannelProgress(id:string,progress:number){
    const cut=this.regionalCuts.get(id);if(!cut)return;const step=Math.round(THREE.MathUtils.clamp(progress,0,1)*32)/32;if(step===cut.progress)return;cut.progress=step;
    this.applyRegionalCuts();
  }
  private applyRegionalCuts():void{
    for(const [geometry,original] of this.regionalOriginal){const p=geometry.getAttribute('position');for(const [i,y] of original){const stream=geometry===this.terrainGeometry?this.streamVertexByIndex.get(i):undefined;p.setY(i,stream?this.channelGround(stream):y);}}
    for(const {progress,vertices} of this.regionalCuts.values())for(const v of vertices){const p=v.geometry.getAttribute('position'),base=p.getY(v.index);p.setY(v.index,Math.min(base,THREE.MathUtils.lerp(base,v.target,channelFront(progress,v.t))));}
    for(const geometry of this.regionalOriginal.keys()){geometry.getAttribute('position').needsUpdate=true;geometry.computeVertexNormals();}
  }
  createRiverMaterial():THREE.MeshBasicMaterial{return waterMaterial(this.waterTime,this.waterLight);}
  createPondMaterial():THREE.MeshBasicMaterial{return waterMaterial(this.waterTime,this.waterLight,true);}
  setRoadCenterProgress(progress:number):void{
    if(!this.gameMode||!this.townSquare)return;
    const size=THREE.MathUtils.clamp(progress,0,1);
    this.townSquare.visible=size>0;
    this.townSquare.scale.set(Math.max(.001,size),1,Math.max(.001,size));
  }
  setRoadCenterVisible(visible:boolean):void{this.setRoadCenterProgress(visible?1:0);}
  setRiverLevel(level:number):void{
    if(!this.gameMode||level===this.riverLevel)return;
    this.riverLevel=level;
    this.mainWater.visible=level>0;
    this.refreshChannels();
  }
  setGroveLevel(level:number):void{
    if(!this.gameMode||level===this.groveLevel)return;
    this.groveLevel=level;
    this.forestLayers.forEach((layer,index)=>layer.visible=level>index);
    this.activeTrees.splice(0,this.activeTrees.length,...this.trees.filter((_,index)=>index%8<level));
  }
  setStreamProgress(progress:number):void{
    if(!this.gameMode||!this.terrainGeometry)return;
    const step=Math.round(THREE.MathUtils.clamp(progress,0,1)*64);
    if(step===this.streamStep)return;
    this.streamStep=step;
    this.refreshChannels();
  }
  setMoatProgress(progress:number):void{
    const step=Math.round(THREE.MathUtils.clamp(progress,0,1)*64);
    if(!this.gameMode||step===this.moatStep)return;
    if((step>0)!==(this.moatStep>0))this.riverBankGeometry?.setIndex(step>0?this.openRiverBankIndices:this.closedRiverBankIndices);
    this.moatStep=step;this.refreshChannels();
  }
  private refreshChannels():void{
    if(!this.terrainGeometry)return;
    const positions=this.terrainGeometry.getAttribute('position');
    for(const v of this.streamVertices)positions.setY(v.index,this.channelGround(v));
    if(this.regionalOriginal.size){this.applyRegionalCuts();return;}
    positions.needsUpdate=true;
    this.terrainGeometry.computeVertexNormals();
    this.terrainGeometry.getAttribute('normal').needsUpdate=true;
  }
  private channelGround(v:(typeof this.streamVertices)[number]):number{
    const plain=this.riverLevel>0?v.natural:v.base;
    const ground=plain-(v.natural-v.carved)*channelFront(Math.max(0,this.streamStep)/64,v.streamT);
    return THREE.MathUtils.lerp(ground,moatBedHeight(v.x,v.z,ground),channelFront(this.moatStep/64,v.moatT));
  }
  private buildTerrain(){
    const divisions=terrainGridDivisions(this.mobile);
    const g=new THREE.PlaneGeometry(700,700,divisions,divisions);g.rotateX(-Math.PI/2);
    this.terrainGeometry=g;
    const positions=g.getAttribute('position'),colors:number[]=[];
    const low=new THREE.Color(0x83bb65),high=new THREE.Color(0x72a66e),sand=new THREE.Color(0xa9c77a),shoreColor=new THREE.Color(0x8d9670);
    for(let i=0;i<positions.count;i++){
      const x=terrainGridCoordinate(positions.getX(i)/350),z=terrainGridCoordinate(positions.getZ(i)/350),r=Math.hypot(x,z);
      positions.setX(i,x);positions.setZ(i,z);
      const carved=terrainHeight(x,z),natural=this.gameMode?naturalTerrainHeight(x,z):carved,base=this.gameMode?baseTerrainHeight(x,z):natural;
      positions.setY(i,base);
      if(this.gameMode&&(base-natural>.001||natural-carved>.001||moatDistance(x,z)<6)){const vertex={index:i,x,z,base,natural,carved,streamT:millStreamParameter(x,z),moatT:moatRouteParameter(x,z)};this.streamVertices.push(vertex);this.streamVertexByIndex.set(i,vertex);}
      const c=low.clone().lerp(high,THREE.MathUtils.smoothstep(r,70,220)*.8).lerp(sand,rand(i*741)*.13);
      if(isWater(x,z,2.5))c.lerp(shoreColor,.2);
      colors.push(c.r,c.g,c.b);
    }
    g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();
    const terrain=new THREE.Mesh(g,MAT.terrain);
    terrain.receiveShadow=true;this.group.add(terrain);
    const square=new THREE.Mesh(new THREE.CylinderGeometry(INFRASTRUCTURE.squareRadius,INFRASTRUCTURE.squareRadius,.08,32),MAT.path);square.position.y=terrainHeight(0,0)+.07;square.receiveShadow=true;square.visible=!this.gameMode;this.townSquare=square;this.group.add(square);
  }
  private buildWater(){
    const water:number[]=[],waterUv:number[]=[],banks:number[]=[];
    const steps=140,first=-225,last=225,bankWidth=2.6;
    const frame=(i:number,side:number,margin=0)=>{
      const x=first+(last-first)*i/steps,z=riverCenter(x)+side*(riverHalfWidth(x)+margin);
      return {x,z};
    };
    const waterY=riverSurfaceHeight;
    const quad=(target:number[],a:[number,number,number],b:[number,number,number],c:[number,number,number],d:[number,number,number])=>{
      for(const p of [a,b,c,b,d,c])target.push(...p);
    };
    for(let i=0;i<steps;i++){
      const x0=first+(last-first)*i/steps,x1=first+(last-first)*(i+1)/steps;
      const a=frame(i,-1),b=frame(i,1),c=frame(i+1,-1),d=frame(i+1,1);
      quad(water,[a.x,waterY(x0),a.z],[b.x,waterY(x0),b.z],[c.x,waterY(x1),c.z],[d.x,waterY(x1),d.z]);
      for(const [side,j] of [[-1,i],[1,i],[-1,i+1],[1,i],[1,i+1],[-1,i+1]])waterUv.push(side,(first+(last-first)*j/steps)*.7);
      for(const side of [-1,1]){
        const inner0=frame(i,side),outer0=frame(i,side,bankWidth),inner1=frame(i+1,side),outer1=frame(i+1,side,bankWidth);
        const streamMouth=side>0&&x0<34&&x1>26;
        const moatMouth=side>0&&x0<MOAT_FEED_X+5&&x1>MOAT_FEED_X-5;
        if(!streamMouth)for(let j=0;j<6;j++)this.closedRiverBankIndices.push(banks.length/3+j);
        if(!streamMouth&&!moatMouth)for(let j=0;j<6;j++)this.openRiverBankIndices.push(banks.length/3+j);
        quad(banks,[inner0.x,waterY(x0)-.025,inner0.z],[outer0.x,baseTerrainHeight(outer0.x,outer0.z)+.04,outer0.z],
          [inner1.x,waterY(x1)-.025,inner1.z],[outer1.x,baseTerrainHeight(outer1.x,outer1.z)+.04,outer1.z]);
      }
    }
    const bankGeometry=new THREE.BufferGeometry();bankGeometry.setAttribute('position',new THREE.Float32BufferAttribute(banks,3));bankGeometry.computeVertexNormals();
    bankGeometry.setIndex(this.closedRiverBankIndices);
    this.riverBankGeometry=bankGeometry;
    const bankMaterial=new THREE.MeshStandardMaterial({color:0xa69b78,roughness:1,side:THREE.DoubleSide});
    const riverBanks=new THREE.Mesh(bankGeometry,bankMaterial);riverBanks.receiveShadow=true;
    const waterGeometry=new THREE.BufferGeometry();waterGeometry.setAttribute('position',new THREE.Float32BufferAttribute(water,3));waterGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(waterUv,2));waterGeometry.computeVertexNormals();
    const river=new THREE.Mesh(waterGeometry,waterMaterial(this.waterTime,this.waterLight));
    this.mainWater.add(riverBanks,river);
    for(const p of PONDS){
      const y=baseTerrainHeight(p.x,p.z)-.72,slope:number[]=[];
      for(let j=0;j<40;j++){
        const a=j*Math.PI*2/40,b=(j+1)*Math.PI*2/40;
        const inner=(t:number):[number,number,number]=>[p.x+Math.cos(t)*p.r,y-.025,p.z+Math.sin(t)*p.r];
        const outer=(t:number):[number,number,number]=>{const x=p.x+Math.cos(t)*(p.r+2.2),z=p.z+Math.sin(t)*(p.r+2.2);return [x,baseTerrainHeight(x,z)+.04,z];};
        quad(slope,inner(a),outer(a),inner(b),outer(b));
      }
      const shoreGeometry=new THREE.BufferGeometry();shoreGeometry.setAttribute('position',new THREE.Float32BufferAttribute(slope,3));shoreGeometry.computeVertexNormals();
      const shore=new THREE.Mesh(shoreGeometry,bankMaterial);shore.receiveShadow=true;
      const pond=new THREE.Mesh(new THREE.CircleGeometry(p.r,40),waterMaterial(this.waterTime,this.waterLight,true));pond.rotation.x=-Math.PI/2;pond.position.set(p.x,y,p.z);
      this.mainWater.add(shore,pond);
      for(let j=0;j<9;j++){const a=j*2.4,rr=p.r+2.1+(j%3)*.45,x=p.x+Math.cos(a)*rr,z=p.z+Math.sin(a)*rr;const reed=new THREE.Mesh(new THREE.ConeGeometry(.24,1.5,4),MAT.grassDark);reed.position.set(x,terrainHeight(x,z)+.75,z);this.mainWater.add(reed);}
    }
    const stones:NaturePlacement[]=[];
    const count=this.gameMode?(this.mobile?10:18):(this.mobile?28:52);
    for(let i=0;i<count;i++){
      const x=-205+i*410/count+rand(i*43)*3,side=i%2?1:-1,z=riverCenter(x)+side*(riverHalfWidth(x)+2.7+rand(i*19)*1.8);
      if(millStreamDistance(x,z)<5.5||moatDistance(x,z)<4)continue;
      stones.push({family:i%2?'Rock_A':'Rock_B',x,y:terrainHeight(x,z)-.045,z,rotation:i*2.4,
        sx:.72+rand(i*17)*1.04,sy:.45+rand(i*29)*.52,sz:.68+rand(i*13)*.8});
    }
    addNatureInstances(this.mainWater,stones,this.mobile,false);
    this.mainWater.visible=!this.gameMode;
    this.group.add(this.mainWater);
  }
  private buildMountains(){
    // A connected ridge replaces the detached boulders. Its spine wanders in
    // radius, rises into several sharp summits, and falls into two river passes.
    const segments=this.mobile?120:192;
    // More closely spaced, staggered bands keep the slopes from reading as
    // a handful of long triangular strips when the whole valley is visible.
    const bands=[0,.035,.105,.24,.43,.65,.84,1,.9,.72,.44,.2,.07,0];
    const points:{position:THREE.Vector3;lift:number;peak:number}[][]=[];
    const angularDistance=(a:number,b:number)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));
    for(let i=0;i<=segments;i++){
      const a=i*Math.PI*2/segments;
      const spine=229+13*Math.sin(a*3+.6)+7*Math.sin(a*7+1.5);
      const summit=Math.pow(Math.max(0,Math.sin(a*7+.15)),4)*21;
      let peak=42+10*Math.sin(a*4+.5)+9*Math.sin(a*9+1.9)+6*Math.sin(a*15+1.4)+summit;
      for(const pass of [-.38,-2.76]){
        const d=angularDistance(a,pass);
        peak*=1-.64*Math.exp(-d*d/.022);
      }
      peak=THREE.MathUtils.clamp(peak,15,79);
      const near=spine-190,far=286-spine;
      const radii=[150,164,178,190,190+near*.25,190+near*.5,190+near*.75,spine,
        spine+far*.28,spine+far*.55,spine+far*.8,286,312,338];
      points.push(radii.map((radius,j)=>{
        const stagger=j>0&&j<bands.length-1 ? .006*Math.sin(a*7+j*2.17) : 0;
        const angle=a+stagger;
        const x=Math.cos(angle)*radius,z=Math.sin(angle)*radius;
        const detail=j>0&&j<bands.length-1
          ?(Math.sin(a*19+j*1.7)*1.3+Math.sin(a*31-j*.83)*.75)*bands[j]:0;
        const lift=bands[j]*peak+detail;
        return {position:new THREE.Vector3(x,terrainHeight(x,z)+lift+.06,z),lift:bands[j],peak};
      }));
    }
    const positions:number[]=[],colors:number[]=[];
    const turf=new THREE.Color(0x86aa72),rock=new THREE.Color(0xa59f90),high=new THREE.Color(0xc3b6a5),summitColor=new THREE.Color(0xe2d9c8);
    const addFace=(a:typeof points[number][number],b:typeof points[number][number],c:typeof points[number][number],cell:number)=>{
      const lift=(a.lift+b.lift+c.lift)/3,peak=(a.peak+b.peak+c.peak)/3;
      const color=turf.clone().lerp(rock,THREE.MathUtils.smoothstep(lift,.12,.57))
        .lerp(high,THREE.MathUtils.smoothstep(lift,.55,1)*.75)
        .lerp(summitColor,THREE.MathUtils.smoothstep(peak,54,73)*THREE.MathUtils.smoothstep(lift,.73,1)*.72);
      color.multiplyScalar(.91+rand(cell*131+7)*.16);
      const emit=(p:THREE.Vector3,q:THREE.Vector3,r:THREE.Vector3,depth=0)=>{
        // Retain the original mountain silhouette, but give excavation enough
        // vertices to cut a narrow channel without dragging an entire hillside.
        const nearWater=this.gameMode&&Math.max(p.x,q.x,r.x)>115&&Math.min(p.x,q.x,r.x)<190&&Math.max(p.z,q.z,r.z)>30&&Math.min(p.z,q.z,r.z)<85;
        if(nearWater&&depth<5&&Math.max(p.distanceTo(q),q.distanceTo(r),r.distanceTo(p))>2){
          const pq=p.clone().lerp(q,.5),qr=q.clone().lerp(r,.5),rp=r.clone().lerp(p,.5);
          emit(p,pq,rp,depth+1);emit(pq,q,qr,depth+1);emit(rp,qr,r,depth+1);emit(pq,qr,rp,depth+1);return;
        }
        for(const point of [p,q,r]){positions.push(point.x,point.y,point.z);colors.push(color.r,color.g,color.b);}
      };
      emit(a.position,b.position,c.position);
    };
    for(let i=0;i<segments;i++)for(let j=0;j<bands.length-1;j++){
      const near=points[i][j],next=points[i+1][j],far=points[i][j+1],diagonal=points[i+1][j+1];
      if((i+j)%2){
        addFace(near,next,diagonal,i*31+j*2);
        addFace(near,diagonal,far,i*31+j*2+1);
      }else{
        addFace(near,next,far,i*31+j*2);
        addFace(next,diagonal,far,i*31+j*2+1);
      }
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    geometry.computeVertexNormals();
    const ridge=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,flatShading:true,side:THREE.DoubleSide}));
    ridge.receiveShadow=true;this.mountainMesh=ridge;this.group.add(ridge);
  }
  private buildForest(){
    const count=this.gameMode?(this.mobile?110:220):(this.mobile?250:520);
    for(let i=0;i<count;i++){
      const a=rand(i*311+9)*Math.PI*2,r=69+Math.sqrt(rand(i*797+18))*90,x=Math.cos(a)*r,z=Math.sin(a)*r;
      if((this.gameMode&&(moatDistance(x,z)<7||(isDistrictSite(x,z)||isRegionalRiverCorridor(x,z))))||isLivingWorldSite(x,z)||isWater(x,z)||millStreamDistance(x,z)<7.4||PLOTS.some(p=>Math.hypot(p.x-x,p.z-z)<(p.kind==='project'?8:5.6))||r<67&&(Math.abs(x)<3.5||Math.abs(z)<3.5||Math.abs(r-INFRASTRUCTURE.road.ringRadius)<3.8||Math.abs(r-INFRASTRUCTURE.road.outerRingRadius)<3.5||Math.abs(r-INFRASTRUCTURE.wall.outerRadius)<4))continue;
      this.trees.push({x,z,r:.7+rand(i*27)*.5});
    }
    const pineFamilies=['Pine_A','Pine_B','Pine_C'] as const;
    for(let tier=0;tier<8;tier++){
      const layer=new THREE.Group();layer.name=`Grove_outer_trees_${tier+1}`;
      addNatureInstances(layer,this.trees.flatMap((t,i)=>{
        if(i%8!==tier)return [];
        const scale=.86+rand(i*83)*.9;
        return [{family:pineFamilies[i%3],x:t.x,y:terrainHeight(t.x,t.z)-.03,z:t.z,
          sx:3.6*scale,sy:5.1*scale,sz:3.6*scale,rotation:rand(i*5)*Math.PI*2}];
      }),this.mobile);
      layer.visible=!this.gameMode;this.group.add(layer);this.forestLayers.push(layer);
    }
    if(!this.gameMode)this.activeTrees.push(...this.trees);
    const rocks:NaturePlacement[]=[];
    const rockFamilies=['Rock_A','Rock_B','Rock_C'] as const;
    for(let i=0;i<(this.gameMode?(this.mobile?14:26):(this.mobile?50:95));i++){
      const a=i*2.399,r=70+rand(i*313)*92,x=Math.cos(a)*r,z=Math.sin(a)*r;
      if(isLivingWorldSite(x,z)||isWater(x,z,2)||millStreamDistance(x,z)<5||(this.gameMode&&(moatDistance(x,z)<4||isDistrictSite(x,z)||isRegionalRiverCorridor(x,z))))continue;
      rocks.push({family:rockFamilies[i%3],x,y:terrainHeight(x,z)-.06,z,rotation:a,
        sx:1+rand(i*13)*2.4,sy:.5+rand(i*19)*1.2,sz:1.2+rand(i*23)*2.2});
    }
    addNatureInstances(this.group,rocks,this.mobile);
  }
  private buildGrass(){
    // Each instance is a small tuft. Five tapered leaves share a root and
    // sway at their tips, so grass reads as continuous ground cover up close.
    const vertices:number[]=[],colors:number[]=[];
    const root=new THREE.Color(0x5e9c51),middle=new THREE.Color(0x83be5c),tip=new THREE.Color(0xb2d877);
    const add=(x:number,y:number,z:number,c:THREE.Color)=>{vertices.push(x,y,z);colors.push(c.r,c.g,c.b);};
    for(let blade=0;blade<5;blade++){
      const a=blade*2.399,dx=Math.cos(a),dz=Math.sin(a),sideX=-dz,sideZ=dx;
      const height=[.54,.76,.62,.69,.48][blade],width=.1+(blade%2)*.025,spread=.1+(blade%3)*.045;
      const bx=dx*.055,bz=dz*.055,mx=bx+dx*spread*.58,mz=bz+dz*spread*.58,tx=bx+dx*spread*1.2,tz=bz+dz*spread*1.2;
      add(bx-sideX*width,0,bz-sideZ*width,root);add(bx+sideX*width,0,bz+sideZ*width,root);add(mx,height*.58,mz,middle);
      add(bx+sideX*width,0,bz+sideZ*width,root);add(tx,height,tz,tip);add(mx,height*.58,mz,middle);
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    const normals:number[]=[];for(let i=0;i<vertices.length;i+=3)normals.push(0,1,0);
    geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
    this.grassPaint.onBeforeCompile=shader=>{
      shader.uniforms.townWind=this.wind;
      // Both sides of a thin blade share its upward meadow normal. Flipping
      // the back face would turn half of each tuft black in direct sunlight.
      shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_begin>',`#include <normal_fragment_begin>
        #ifdef DOUBLE_SIDED
          normal *= faceDirection;
        #endif
      `);
      shader.vertexShader='uniform float townWind;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
        #ifdef USE_INSTANCING
          float tipWeight=smoothstep(.08,.72,transformed.y);
          transformed.x+=sin(townWind*1.45+instanceMatrix[3].x*.13+instanceMatrix[3].z*.19)*tipWeight*.11;
          transformed.z+=cos(townWind*1.1+instanceMatrix[3].z*.11)*tipWeight*.065;
        #endif
      `);
    };
    this.grassPaint.customProgramCacheKey=()=> 'town-lit-wind-grass-v3';
    const positions:{x:number;z:number;s:number;a:number;color:number}[]=[];
    const attempts=this.mobile?6500:17000;
    for(let i=0;i<attempts;i++){
      const a=rand(i*167+2)*Math.PI*2,r=i%2===0?Math.sqrt(rand(i*911+9))*71:71+Math.sqrt(rand(i*911+9))*75,x=Math.cos(a)*r,z=Math.sin(a)*r;
      const meadow=Math.sin(x*.045)*Math.sin(z*.059);
      if((this.gameMode&&(moatDistance(x,z)<7||(isDistrictSite(x,z)||isRegionalRiverCorridor(x,z))))||isLivingWorldSite(x,z)||isMountWorksite(x,z)||rand(i*631+5)>.72+meadow*.24||isWater(x,z)||millStreamDistance(x,z)<7.1||PLOTS.some(p=>Math.hypot(p.x-x,p.z-z)<(p.kind==='project'?6.7:3.8))||r<67&&(Math.abs(x)<2.7||Math.abs(z)<2.7||Math.abs(r-INFRASTRUCTURE.road.ringRadius)<2.3||Math.abs(r-INFRASTRUCTURE.road.outerRingRadius)<2.3||Math.abs(r-INFRASTRUCTURE.wall.outerRadius)<2.5))continue;
      positions.push({x,z,s:.68+rand(i*13)*.72,a:rand(i*27)*6.28,color:i%5});
    }
    const grass=new THREE.InstancedMesh(geometry,this.grassPaint,positions.length),d=new THREE.Object3D();
    positions.forEach((p,i)=>{d.position.set(p.x,terrainHeight(p.x,p.z)+.015,p.z);d.rotation.set(0,p.a,0);d.scale.setScalar(p.s);d.updateMatrix();grass.setMatrixAt(i,d.matrix);grass.setColorAt(i,new THREE.Color([0xe1f4c3,0xd5edb0,0xf0f5cb,0xc2e79e,0xe5f2b8][p.color]));});
    grass.instanceMatrix.needsUpdate=true;if(grass.instanceColor)grass.instanceColor.needsUpdate=true;grass.frustumCulled=false;grass.receiveShadow=true;
    this.group.add(grass);
  }
  private buildFlowers(){
    // Small color pockets make the opening meadow feel alive without covering
    // the paths and building sites that appear as the game progresses.
    const petals:THREE.BufferGeometry[]=[];
    for(let i=0;i<5;i++){
      const angle=i*Math.PI*2/5;
      const petal=new THREE.SphereGeometry(.19,5,3);
      petal.scale(1,.55,.72);
      petal.translate(Math.cos(angle)*.19,0,Math.sin(angle)*.19);
      petals.push(petal);
    }
    const geometry=mergeGeometries(petals)!;
    petals.forEach(petal=>petal.dispose());
    const blooms:{x:number;z:number;size:number;color:number}[]=[];
    const palette=[0xffd35c,0xff8177,0xf5a4cb,0xb3a4ec,0xfff0ba];
    for(let i=0;i<(this.gameMode?(this.mobile?90:150):(this.mobile?350:850));i++){
      const cluster=Math.floor(rand(i*79+17)*22);
      const angle=cluster*2.399,radius=32+(cluster%5)*23;
      const centerX=Math.cos(angle)*radius,centerZ=Math.sin(angle)*radius;
      const spread=2+Math.sqrt(rand(i*41+8))*11;
      const direction=rand(i*113+3)*Math.PI*2;
      const x=centerX+Math.cos(direction)*spread,z=centerZ+Math.sin(direction)*spread,r=Math.hypot(x,z);
      if((this.gameMode&&(moatDistance(x,z)<7||(isDistrictSite(x,z)||isRegionalRiverCorridor(x,z))))||isLivingWorldSite(x,z)||isMountWorksite(x,z)||r>153||isWater(x,z,2.2)||millStreamDistance(x,z)<8||PLOTS.some(p=>Math.hypot(p.x-x,p.z-z)<(p.kind==='project'?8:6))||r<67&&(Math.abs(x)<4||Math.abs(z)<4||Math.abs(r-INFRASTRUCTURE.road.ringRadius)<3||Math.abs(r-INFRASTRUCTURE.road.outerRingRadius)<3||Math.abs(r-INFRASTRUCTURE.wall.outerRadius)<3))continue;
      blooms.push({x,z,size:.75+rand(i*37+11)*.65,color:Math.floor(rand(i*67+19)*palette.length)});
    }
    const mesh=new THREE.InstancedMesh(geometry,new THREE.MeshLambertMaterial({color:0xffffff,side:THREE.DoubleSide}),blooms.length);
    const transform=new THREE.Object3D();
    blooms.forEach((flower,i)=>{
      transform.position.set(flower.x,terrainHeight(flower.x,flower.z)+.45*flower.size,flower.z);
      transform.rotation.y=rand(i*101+5)*Math.PI*2;
      transform.scale.setScalar(flower.size);
      transform.updateMatrix();mesh.setMatrixAt(i,transform.matrix);
      mesh.setColorAt(i,new THREE.Color(palette[flower.color]));
    });
    mesh.instanceMatrix.needsUpdate=true;
    if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
    mesh.computeBoundingSphere();
    this.group.add(mesh);
  }
  update(seconds:number,season:string,night:number){
    this.wind.value=seconds;
    this.waterTime.value=this.reducedMotion.matches?0:seconds;
    this.waterLight.value=1-night*.38;
    if(season!==this.currentSeason)this.currentSeason=season;
    this.grassPaint.color.set(season==='winter'?0xd5ddd0:season==='autumn'?0xd8c594:0xffffff);
  }
}
