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
import { ATMOSPHERE } from './atmosphere';

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

/** Linear-space water palette (hex values are sRGB and converted by THREE.Color). */
const WATER_DEEP=new THREE.Color(0x1f5a6b),WATER_SHALLOW=new THREE.Color(0x579c95),WATER_BED=new THREE.Color(0x6f6650);
/** Bank vertex colours: damp earth at the waterline, grass-tinted at the top. */
const NIGHT_GRASS=new THREE.Color(0x8d9cc0);
const BANK_WET=new THREE.Color(0x8c9a5f),BANK_TOP=new THREE.Color(0x88b165);
/** Default world units per uv unit [across (uv.x is -1..1), along (uv.y)] for the main river ribbon. */
const RIVER_FLOW_SCALE:readonly [number,number]=[4.4,1/.7];
export type WaterMaterial=THREE.MeshStandardMaterial;
/** Matte bank material driven by `pushBankColors` vertex colours. */
export function createBankMaterial():THREE.MeshStandardMaterial{
  const material=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:1,side:THREE.DoubleSide});
  // Bend bank normals toward world up so slopes facing away from the sun read
  // as a gentle dip instead of a black band along every moat and shore.
  material.onBeforeCompile=shader=>{
    shader.uniforms.townNight=ATMOSPHERE.night;shader.uniforms.townNightTint={value:NIGHT_GRASS};
    shader.fragmentShader='uniform float townNight; uniform vec3 townNightTint;\n'+shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n      diffuseColor.rgb*=mix(vec3(1.0),townNightTint,townNight*.7);');
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      normal=normalize(mix(normal,(viewMatrix*vec4(0.0,1.0,0.0,0.0)).xyz,.6));`);
  };
  material.customProgramCacheKey=()=>'town-bank-soft-v2';
  return material;
}
/**
 * Vertex colours for one bank quad laid out as [inner0,outer0,inner1,outer1,outer1,inner1]
 * (the order produced by pushing a,b,c,b,d,c with a/c at the water and b/d at the top).
 */
export function pushBankColors(target:number[],edge:number,wet:THREE.Color=BANK_WET,top:THREE.Color=BANK_TOP):void{
  // Jitter per cross-section (edge, edge+1) so neighbouring quads share colours.
  const shade=(e:number,outer:boolean)=>.95+rand(Math.floor(e)*977+(outer?31:7))*.1;
  for(const [outer,next] of [[false,0],[true,0],[false,1],[true,0],[true,1],[false,1]] as const){
    const c=outer?top:wet,s=shade(edge+next,outer);target.push(c.r*s,c.g*s,c.b*s);
  }
}

// Lit, shadow-receiving stylised water shared by the river, ponds, moat and
// channels. Ribbons carry uv.x=-1..1 across and uv.y along the flow; ponds use
// a 0..1 disc uv and stay still. No extra passes or render targets.
function waterMaterial(time:{value:number},pond=false,flowScale:readonly [number,number]=RIVER_FLOW_SCALE):WaterMaterial{
  const material=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.22,metalness:0,side:THREE.DoubleSide});
  const scale=new THREE.Vector2(flowScale[0],flowScale[1]);
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,{townWaterTime:time,townFlowScale:{value:scale},
      townWaterDeep:{value:WATER_DEEP},townWaterShallow:{value:WATER_SHALLOW},townWaterBed:{value:WATER_BED},
      townSunDir:ATMOSPHERE.sunDirection,townSkyHorizon:ATMOSPHERE.skyHorizon,townSkyZenith:ATMOSPHERE.skyZenith,townNight:ATMOSPHERE.night});
    shader.vertexShader='varying vec2 vTownWaterUv;\nvarying vec3 vTownWaterWorld;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvTownWaterUv=uv;\nvTownWaterWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');
    shader.fragmentShader=`uniform float townWaterTime; uniform vec2 townFlowScale;
uniform vec3 townWaterDeep; uniform vec3 townWaterShallow; uniform vec3 townWaterBed;
uniform vec3 townSunDir; uniform vec3 townSkyHorizon; uniform vec3 townSkyZenith; uniform float townNight;
varying vec2 vTownWaterUv; varying vec3 vTownWaterWorld;
// Dave Hoskins hash12: no sin(), stable at large inputs and on mobile GPUs.
float townWaterHash(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
// Value noise with analytic derivatives: x=value, yz=d/dp.
vec3 townWaterNoise(vec2 p){
  vec2 i=floor(p),f=fract(p),u=f*f*(3.0-2.0*f),du=6.0*f*(1.0-f);
  float a=townWaterHash(i),b=townWaterHash(i+vec2(1,0)),c=townWaterHash(i+vec2(0,1)),d=townWaterHash(i+vec2(1,1));
  float k1=b-a,k2=c-a,k4=a-b-c+d;
  return vec3(a+k1*u.x+k2*u.y+k4*u.x*u.y,du*vec2(k1+k4*u.y,k2+k4*u.x));
}
`+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float townT=townWaterTime;
      ${pond?`
      // Still water: two slow, low-amplitude noise layers in world space.
      vec2 townW=vTownWaterWorld.xz;
      float townAcross=length((vTownWaterUv-.5)*2.0);
      vec3 townNa=townWaterNoise(townW*.34+vec2(townT*.035,townT*.022));
      vec3 townNb=townWaterNoise(mat2(.8,-.6,.6,.8)*townW*.9-vec2(townT*.02,townT*.045));
      vec2 townGrad=vec2(townNa.y*.34+townNb.y*.9*.5,townNa.z*.34+townNb.z*.9*.5)*.55;
      float townSpark=townWaterNoise(mat2(.8,-.6,.6,.8)*townW*2.8+vec2(townT*.06,0.)).x;
      `:`
      // Flowing water: streaks stretched along the current plus a faster
      // cross-rippled layer at another angle, both advected downstream.
      vec2 townQ=vec2(vTownWaterUv.x*townFlowScale.x,vTownWaterUv.y*townFlowScale.y);
      float townAcross=abs(vTownWaterUv.x);
      vec3 townNa=townWaterNoise(vec2(townQ.x*.8+townQ.y*.1,townQ.y*.24-townT*.5));
      vec2 townPb=mat2(.83,-.56,.56,.83)*vec2(townQ.x,townQ.y-townT*1.05);
      vec3 townNb=townWaterNoise(townPb*.62+vec2(townT*.08,0.));
      vec2 townGb=mat2(.83,.56,-.56,.83)*townNb.yz*.62;
      vec2 townGrad=vec2(townNa.y*.8,townNa.y*.1+townNa.z*.24)*.9+townGb*.75;
      float townSpark=townWaterNoise(mat2(.8,-.6,.6,.8)*vec2(townQ.x*3.1,townQ.y*2.2-townT*1.4)).x;
      `}
      float townH=townNa.x*.6+townNb.x*.4;
      // Depth: dark in the middle, lighter towards the shore, then the bed shows through.
      float townDepth=clamp(1.0-smoothstep(.12,.96,townAcross)+(townH-.5)*.3,0.0,1.0);
      vec3 townCol=mix(townWaterShallow,townWaterDeep,townDepth);
      float townBed=smoothstep(.8,1.0,townAcross+(townNb.x-.5)*.1);
      townCol=mix(townCol,mix(townWaterBed,townWaterShallow,.3),townBed*.6);
      townCol*=.84+.32*townH;
      // Broken, soft foam hugging the waterline instead of a drawn outline.
      float townFoam=smoothstep(.9,1.0,townAcross)*smoothstep(.5,.85,townSpark*.6+townNa.x*.4)*${pond?'.12':'.3'};
      townCol=mix(townCol,vec3(.56,.64,.6),townFoam);
      diffuseColor.rgb=townCol;
    `);
    // Replace the geometry normal with a world-up normal tilted by the noise
    // gradient; this is independent of ribbon winding and breaks the sun
    // highlight into sparkles.
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`
      vec3 townWn=normalize(vec3(-townGrad.y*${pond?'.12':'.32'},1.0,-townGrad.x*${pond?'.12':'.32'}));
      normal=normalize((viewMatrix*vec4(townWn,0.0)).xyz);
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_begin>',`#include <lights_fragment_begin>
      vec3 townSunLit=vec3(0.0);
      #if NUM_DIR_LIGHTS > 0
      townSunLit=directLight.color; // includes the sun's shadow term
      #endif
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
      {
        // Fresnel from a calmer normal so the sky tint stays a soft gradient, not blotches.
        vec3 townCalm=normalize(mix((viewMatrix*vec4(0.0,1.0,0.0,0.0)).xyz,normal,.35));
        float townNv=saturate(dot(townCalm,geometryViewDir)),townGraze=1.0-townNv;
        vec3 townSky=mix(townSkyZenith,townSkyHorizon,townGraze*townGraze)*(1.0-.55*townNight);
        townSky=mix(vec3(dot(townSky,vec3(.2126,.7152,.0722))),townSky,.7); // muted reflection
        float townFres=.04+.22*townGraze*townGraze*townGraze*townGraze;
        outgoingLight=mix(outgoingLight,townSky,townFres*(1.0-townFoam));
        vec3 townSunV=normalize((viewMatrix*vec4(townSunDir,0.0)).xyz);
        // Wide Blinn lobe gated by fine noise: sparse sun sparkles that also read from
        // the high game camera, and vanish in shadow (townSunLit carries the shadow term).
        float townGlint=pow(saturate(dot(normal,normalize(townSunV+geometryViewDir))),24.0);
        // Two overlapping noise masks give small, rounded, sparse sparkles instead of lattice-shaped flakes.
        float townSparkle=smoothstep(.66,.92,townSpark)*smoothstep(.5,.8,townNb.x);
        outgoingLight+=townSunLit*townGlint*townSparkle*${pond?'.16':'.26'};
      }
      #include <opaque_fragment>`);
  };
  material.customProgramCacheKey=()=>pond?'town-pond-v3':'town-river-v3';
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
  private readonly grassPaint=new THREE.MeshStandardMaterial({color:0xffffff,side:THREE.DoubleSide,vertexColors:true,roughness:1,metalness:0});
  private readonly wind={value:0};
  private readonly waterTime={value:0};
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
  /** `flowScale`: world units per uv unit [across, along] of the caller's ribbon, so ripples keep one size everywhere. */
  createRiverMaterial(flowScale?:readonly [number,number]):WaterMaterial{return waterMaterial(this.waterTime,false,flowScale);}
  createPondMaterial():WaterMaterial{return waterMaterial(this.waterTime,true);}
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
    const low=new THREE.Color(0x88b165),high=new THREE.Color(0x79a165),sand=new THREE.Color(0xaabd78),shoreColor=new THREE.Color(0x8fa366);
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
    const water:number[]=[],waterUv:number[]=[],banks:number[]=[],bankColors:number[]=[];
    const steps=140,first=-225,last=225,bankWidth=2.6;
    const frame=(i:number,side:number,margin=0)=>{
      const x=first+(last-first)*i/steps,z=riverCenter(x)+side*(riverHalfWidth(x)+margin);
      return {x,z};
    };
    const waterY=riverSurfaceHeight;
    const quad=(target:number[],a:[number,number,number],b:[number,number,number],c:[number,number,number],d:[number,number,number])=>{
      for(const p of [a,b,c,b,d,c])target.push(...p);
    };
    // Bank quads are (inner0,outer0,inner1,outer1): wet earth at the water, grass at the top.
    const bankShade=(target:number[],seed:number)=>pushBankColors(target,seed);
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
        bankShade(bankColors,i+(side>0?1000:0));
      }
    }
    const bankGeometry=new THREE.BufferGeometry();bankGeometry.setAttribute('position',new THREE.Float32BufferAttribute(banks,3));bankGeometry.setAttribute('color',new THREE.Float32BufferAttribute(bankColors,3));bankGeometry.computeVertexNormals();
    bankGeometry.setIndex(this.closedRiverBankIndices);
    this.riverBankGeometry=bankGeometry;
    const bankMaterial=createBankMaterial();
    const riverBanks=new THREE.Mesh(bankGeometry,bankMaterial);riverBanks.receiveShadow=true;
    const waterGeometry=new THREE.BufferGeometry();waterGeometry.setAttribute('position',new THREE.Float32BufferAttribute(water,3));waterGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(waterUv,2));waterGeometry.computeVertexNormals();
    const river=new THREE.Mesh(waterGeometry,waterMaterial(this.waterTime));river.receiveShadow=true;
    this.mainWater.add(riverBanks,river);
    for(const p of PONDS){
      const y=baseTerrainHeight(p.x,p.z)-.72,slope:number[]=[],slopeColors:number[]=[];
      for(let j=0;j<40;j++){
        const a=j*Math.PI*2/40,b=(j+1)*Math.PI*2/40;
        const inner=(t:number):[number,number,number]=>[p.x+Math.cos(t)*p.r,y-.025,p.z+Math.sin(t)*p.r];
        const outer=(t:number):[number,number,number]=>{const x=p.x+Math.cos(t)*(p.r+2.2),z=p.z+Math.sin(t)*(p.r+2.2);return [x,baseTerrainHeight(x,z)+.04,z];};
        quad(slope,inner(a),outer(a),inner(b),outer(b));bankShade(slopeColors,(j%40)+p.x*100);
      }
      const shoreGeometry=new THREE.BufferGeometry();shoreGeometry.setAttribute('position',new THREE.Float32BufferAttribute(slope,3));shoreGeometry.setAttribute('color',new THREE.Float32BufferAttribute(slopeColors,3));shoreGeometry.computeVertexNormals();
      const shore=new THREE.Mesh(shoreGeometry,bankMaterial);shore.receiveShadow=true;
      const pond=new THREE.Mesh(new THREE.CircleGeometry(p.r,40),waterMaterial(this.waterTime,true));pond.rotation.x=-Math.PI/2;pond.position.set(p.x,y,p.z);pond.receiveShadow=true;
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
    const root=new THREE.Color(0x5b844a),middle=new THREE.Color(0x86b05a),tip=new THREE.Color(0xb4cf76);
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
    this.grassPaint.customProgramCacheKey=()=> 'town-lit-wind-grass-v4';
    const positions:{x:number;z:number;s:number;a:number;color:number}[]=[];
    const attempts=this.mobile?6500:17000;
    for(let i=0;i<attempts;i++){
      const a=rand(i*167+2)*Math.PI*2,r=i%2===0?Math.sqrt(rand(i*911+9))*71:71+Math.sqrt(rand(i*911+9))*75,x=Math.cos(a)*r,z=Math.sin(a)*r;
      const meadow=Math.sin(x*.045)*Math.sin(z*.059);
      if((this.gameMode&&(moatDistance(x,z)<7||(isDistrictSite(x,z)||isRegionalRiverCorridor(x,z))))||isLivingWorldSite(x,z)||isMountWorksite(x,z)||rand(i*631+5)>.72+meadow*.24||isWater(x,z)||millStreamDistance(x,z)<7.1||PLOTS.some(p=>Math.hypot(p.x-x,p.z-z)<(p.kind==='project'?6.7:3.8))||r<67&&(Math.abs(x)<2.7||Math.abs(z)<2.7||Math.abs(r-INFRASTRUCTURE.road.ringRadius)<2.3||Math.abs(r-INFRASTRUCTURE.road.outerRingRadius)<2.3||Math.abs(r-INFRASTRUCTURE.wall.outerRadius)<2.5))continue;
      positions.push({x,z,s:.68+rand(i*13)*.72,a:rand(i*27)*6.28,color:i%5});
    }
    const grass=new THREE.InstancedMesh(geometry,this.grassPaint,positions.length),d=new THREE.Object3D();
    positions.forEach((p,i)=>{d.position.set(p.x,terrainHeight(p.x,p.z)+.015,p.z);d.rotation.set(0,p.a,0);d.scale.setScalar(p.s);d.updateMatrix();grass.setMatrixAt(i,d.matrix);grass.setColorAt(i,new THREE.Color([0xf0f2dc,0xe6ecd0,0xfaf6de,0xdce6c4,0xf2f0d4][p.color]));});
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
    const mesh=new THREE.InstancedMesh(geometry,new THREE.MeshStandardMaterial({color:0xffffff,side:THREE.DoubleSide,roughness:1,metalness:0}),blooms.length);
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
    if(season!==this.currentSeason)this.currentSeason=season;
    this.grassPaint.color.set(season==='winter'?0xd5ddd0:season==='autumn'?0xd8c594:0xffffff).lerp(NIGHT_GRASS,night*.7);
  }
}
