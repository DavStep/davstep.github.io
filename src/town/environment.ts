import * as THREE from 'three';
import { PLOTS } from './model';
import { INFRASTRUCTURE } from './town-plan';
import { MAT } from './materials';
import { addNatureInstances, type NaturePlacement } from './nature-placement';
import { millStreamDistance } from './game-path';

const hash=(n:number)=>{let x=n|0;x^=x>>>16;x=Math.imul(x,0x7feb352d);x^=x>>>15;return (x^x>>>16)>>>0;};
const rand=(seed:number)=>hash(seed)/0xffffffff;

function baseTerrainHeight(x:number,z:number):number{
  const r=Math.hypot(x,z),outer=Math.max(0,r-68);
  return .48+outer*.048+outer*outer*.00055*(.72+.28*Math.sin(x*.075+z*.034));
}
export const riverCenter=(x:number)=>-86+7*Math.sin(x*.027)+3*Math.sin(x*.071+1.3);
export const riverHalfWidth=(x:number)=>4.35+.42*Math.sin(x*.037)+.18*Math.sin(x*.11+1);
export const riverSurfaceHeight=(x:number)=>baseTerrainHeight(x,riverCenter(x))-.78;
export const PONDS=([{x:-82,z:-27,r:8},{x:83,z:-34,r:6.5}] as const);
const smoothstep=(min:number,max:number,value:number)=>{const t=THREE.MathUtils.clamp((value-min)/(max-min),0,1);return t*t*(3-2*t);};
function terrainHeightAtStreamProgress(x:number,z:number,progress:number):number{
  const riverDepth=1.5*(1-smoothstep(riverHalfWidth(x)-.3,riverHalfWidth(x)+2.5,Math.abs(z-riverCenter(x))));
  const branchDepth=progress*1.65*(1-smoothstep(3,7,millStreamDistance(x,z)));
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
      vec3 deep=vec3(.035,.23,.25),shallow=vec3(.16,.43,.37);
      diffuseColor.rgb=(mix(deep,shallow,edge)+ripple*.012)*(townWaterLight);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.60,.76,.66)*townWaterLight,glint*.4+foam*.55);
    `);
  };
  material.customProgramCacheKey=()=>pond?'town-pond-v1':'town-river-v1';
  return material;
}

export class Environment {
  readonly group=new THREE.Group();
  readonly trees:{x:number;z:number;r:number}[]=[];
  private readonly grassPaint=new THREE.MeshLambertMaterial({color:0xffffff,side:THREE.DoubleSide,vertexColors:true});
  private readonly wind={value:0};
  private readonly waterTime={value:0};
  private readonly waterLight={value:1};
  private readonly reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  private currentSeason='';
  private terrainGeometry:THREE.PlaneGeometry|null=null;
  private townSquare:THREE.Mesh|null=null;
  private streamVertices:{index:number;natural:number;carved:number}[]=[];
  private streamStep=-1;
  constructor(scene:THREE.Scene,private mobile:boolean,private gameMode=false){
    this.buildTerrain();this.buildWater();this.buildMountains();this.buildForest();this.buildGrass();
    scene.add(this.group);
  }
  createRiverMaterial():THREE.MeshBasicMaterial{return waterMaterial(this.waterTime,this.waterLight);}
  setRoadCenterProgress(progress:number):void{
    if(!this.gameMode||!this.townSquare)return;
    const size=THREE.MathUtils.clamp(progress,0,1);
    this.townSquare.visible=size>0;
    this.townSquare.scale.set(Math.max(.001,size),1,Math.max(.001,size));
  }
  setRoadCenterVisible(visible:boolean):void{this.setRoadCenterProgress(visible?1:0);}
  setStreamProgress(progress:number):void{
    if(!this.gameMode||!this.terrainGeometry)return;
    const step=Math.round(THREE.MathUtils.clamp(progress,0,1)*16);
    if(step===this.streamStep)return;
    this.streamStep=step;
    const positions=this.terrainGeometry.getAttribute('position');
    for(const vertex of this.streamVertices)positions.setY(vertex.index,THREE.MathUtils.lerp(vertex.natural,vertex.carved,step/16));
    positions.needsUpdate=true;
    this.terrainGeometry.computeVertexNormals();
    this.terrainGeometry.getAttribute('normal').needsUpdate=true;
  }
  private buildTerrain(){
    const divisions=this.mobile?144:200;
    const g=new THREE.PlaneGeometry(700,700,divisions,divisions);g.rotateX(-Math.PI/2);
    this.terrainGeometry=g;
    const positions=g.getAttribute('position'),colors:number[]=[];
    const low=new THREE.Color(0x789667),high=new THREE.Color(0x678566),sand=new THREE.Color(0x91a378),shoreColor=new THREE.Color(0x615f4e);
    for(let i=0;i<positions.count;i++){
      const x=positions.getX(i),z=positions.getZ(i),r=Math.hypot(x,z);
      const carved=terrainHeight(x,z),natural=this.gameMode?naturalTerrainHeight(x,z):carved;
      positions.setY(i,natural);
      if(this.gameMode&&natural-carved>.001)this.streamVertices.push({index:i,natural,carved});
      const c=low.clone().lerp(high,THREE.MathUtils.smoothstep(r,70,220)*.8).lerp(sand,rand(i*741)*.13);
      if(isWater(x,z,2.5))c.lerp(shoreColor,.2);
      colors.push(c.r,c.g,c.b);
    }
    g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();
    const terrain=new THREE.Mesh(g,MAT.terrain);
    terrain.receiveShadow=true;this.group.add(terrain);
    const square=new THREE.Mesh(new THREE.CylinderGeometry(INFRASTRUCTURE.squareRadius,INFRASTRUCTURE.squareRadius,.08,32),MAT.path);square.position.y=.55;square.receiveShadow=true;square.visible=!this.gameMode;this.townSquare=square;this.group.add(square);
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
        quad(banks,[inner0.x,waterY(x0)-.025,inner0.z],[outer0.x,baseTerrainHeight(outer0.x,outer0.z)+.04,outer0.z],
          [inner1.x,waterY(x1)-.025,inner1.z],[outer1.x,baseTerrainHeight(outer1.x,outer1.z)+.04,outer1.z]);
      }
    }
    const bankGeometry=new THREE.BufferGeometry();bankGeometry.setAttribute('position',new THREE.Float32BufferAttribute(banks,3));bankGeometry.computeVertexNormals();
    const bankMaterial=new THREE.MeshStandardMaterial({color:0x827e68,roughness:1,side:THREE.DoubleSide});
    const riverBanks=new THREE.Mesh(bankGeometry,bankMaterial);riverBanks.receiveShadow=true;
    const waterGeometry=new THREE.BufferGeometry();waterGeometry.setAttribute('position',new THREE.Float32BufferAttribute(water,3));waterGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(waterUv,2));waterGeometry.computeVertexNormals();
    const river=new THREE.Mesh(waterGeometry,waterMaterial(this.waterTime,this.waterLight));
    this.group.add(riverBanks,river);
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
      this.group.add(shore,pond);
      for(let j=0;j<9;j++){const a=j*2.4,rr=p.r+2.1+(j%3)*.45,x=p.x+Math.cos(a)*rr,z=p.z+Math.sin(a)*rr;const reed=new THREE.Mesh(new THREE.ConeGeometry(.24,1.5,4),MAT.grassDark);reed.position.set(x,terrainHeight(x,z)+.75,z);this.group.add(reed);}
    }
    const stones:NaturePlacement[]=[];
    const count=this.mobile?28:52;
    for(let i=0;i<count;i++){
      const x=-205+i*410/count+rand(i*43)*3,side=i%2?1:-1,z=riverCenter(x)+side*(riverHalfWidth(x)+2.7+rand(i*19)*1.8);
      stones.push({family:i%2?'Rock_A':'Rock_B',x,y:terrainHeight(x,z)-.045,z,rotation:i*2.4,
        sx:.72+rand(i*17)*1.04,sy:.45+rand(i*29)*.52,sz:.68+rand(i*13)*.8});
    }
    addNatureInstances(this.group,stones,this.mobile,false);
  }
  private buildMountains(){
    // A connected ridge replaces the detached boulders. Its spine wanders in
    // radius, rises into several sharp summits, and falls into two river passes.
    const segments=this.mobile?72:120;
    const bands=[0,.08,.25,.72,1,.66,.16,0];
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
      const radii=[150,174,190,spine-16,spine,spine+21,286,338];
      points.push(radii.map((radius,j)=>{
        const x=Math.cos(a)*radius,z=Math.sin(a)*radius;
        const lift=bands[j]*peak+(j>0&&j<7?Math.sin(a*19+j*1.7)*bands[j]*1.3:0);
        return {position:new THREE.Vector3(x,terrainHeight(x,z)+lift+.06,z),lift:bands[j],peak};
      }));
    }
    const positions:number[]=[],colors:number[]=[];
    const turf=new THREE.Color(0x708365),rock=new THREE.Color(0x918b7f),high=new THREE.Color(0xafa698),summitColor=new THREE.Color(0xcac2b3);
    const addFace=(a:typeof points[number][number],b:typeof points[number][number],c:typeof points[number][number],cell:number)=>{
      const lift=(a.lift+b.lift+c.lift)/3,peak=(a.peak+b.peak+c.peak)/3;
      const color=turf.clone().lerp(rock,THREE.MathUtils.smoothstep(lift,.12,.57))
        .lerp(high,THREE.MathUtils.smoothstep(lift,.55,1)*.75)
        .lerp(summitColor,THREE.MathUtils.smoothstep(peak,54,73)*THREE.MathUtils.smoothstep(lift,.73,1)*.72);
      color.multiplyScalar(.91+rand(cell*131+7)*.16);
      for(const point of [a,b,c]){positions.push(point.position.x,point.position.y,point.position.z);colors.push(color.r,color.g,color.b);}
    };
    for(let i=0;i<segments;i++)for(let j=0;j<bands.length-1;j++){
      const near=points[i][j],next=points[i+1][j],far=points[i][j+1],diagonal=points[i+1][j+1];
      addFace(near,next,far,i*31+j*2);
      addFace(next,diagonal,far,i*31+j*2+1);
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    geometry.computeVertexNormals();
    const ridge=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,flatShading:true,side:THREE.DoubleSide}));
    ridge.receiveShadow=true;this.group.add(ridge);
  }
  private buildForest(){
    const count=this.mobile?250:520;
    for(let i=0;i<count;i++){
      const a=rand(i*311+9)*Math.PI*2,r=69+Math.sqrt(rand(i*797+18))*90,x=Math.cos(a)*r,z=Math.sin(a)*r;
      if(isWater(x,z)||millStreamDistance(x,z)<7.4||PLOTS.some(p=>Math.hypot(p.x-x,p.z-z)<(p.kind==='project'?8:5.6))||r<67&&(Math.abs(x)<3.5||Math.abs(z)<3.5||Math.abs(r-INFRASTRUCTURE.road.ringRadius)<3.8||Math.abs(r-INFRASTRUCTURE.road.outerRingRadius)<3.5||Math.abs(r-INFRASTRUCTURE.wall.outerRadius)<4))continue;
      this.trees.push({x,z,r:.7+rand(i*27)*.5});
    }
    const pineFamilies=['Pine_A','Pine_B','Pine_C'] as const;
    addNatureInstances(this.group,this.trees.map((t,i)=>{
      const scale=.86+rand(i*83)*.9;
      return {family:pineFamilies[i%3],x:t.x,y:terrainHeight(t.x,t.z)-.03,z:t.z,
        sx:3.6*scale,sy:5.1*scale,sz:3.6*scale,rotation:rand(i*5)*Math.PI*2};
    }),this.mobile);
    const rocks:NaturePlacement[]=[];
    const rockFamilies=['Rock_A','Rock_B','Rock_C'] as const;
    for(let i=0;i<(this.mobile?50:95);i++){
      const a=i*2.399,r=70+rand(i*313)*92,x=Math.cos(a)*r,z=Math.sin(a)*r;
      rocks.push({family:rockFamilies[i%3],x,y:terrainHeight(x,z)-.06,z,rotation:a,
        sx:1+rand(i*13)*2.4,sy:.5+rand(i*19)*1.2,sz:1.2+rand(i*23)*2.2});
    }
    addNatureInstances(this.group,rocks,this.mobile);
  }
  private buildGrass(){
    // Each instance is a small tuft. Five tapered leaves share a root and
    // sway at their tips, so grass reads as continuous ground cover up close.
    const vertices:number[]=[],colors:number[]=[];
    const root=new THREE.Color(0x77935b),middle=new THREE.Color(0x93ad68),tip=new THREE.Color(0xa9bf7a);
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
      if(rand(i*631+5)>.72+meadow*.24||isWater(x,z)||millStreamDistance(x,z)<7.1||PLOTS.some(p=>Math.hypot(p.x-x,p.z-z)<(p.kind==='project'?6.7:3.8))||r<67&&(Math.abs(x)<2.7||Math.abs(z)<2.7||Math.abs(r-INFRASTRUCTURE.road.ringRadius)<2.3||Math.abs(r-INFRASTRUCTURE.road.outerRingRadius)<2.3||Math.abs(r-INFRASTRUCTURE.wall.outerRadius)<2.5))continue;
      positions.push({x,z,s:.68+rand(i*13)*.72,a:rand(i*27)*6.28,color:i%5});
    }
    const grass=new THREE.InstancedMesh(geometry,this.grassPaint,positions.length),d=new THREE.Object3D();
    positions.forEach((p,i)=>{d.position.set(p.x,terrainHeight(p.x,p.z)+.015,p.z);d.rotation.set(0,p.a,0);d.scale.setScalar(p.s);d.updateMatrix();grass.setMatrixAt(i,d.matrix);grass.setColorAt(i,new THREE.Color([0xe1e8c7,0xd7e2bc,0xe5eccb,0xcddcb4,0xe0e6bf][p.color]));});
    grass.instanceMatrix.needsUpdate=true;if(grass.instanceColor)grass.instanceColor.needsUpdate=true;grass.frustumCulled=false;grass.receiveShadow=true;
    this.group.add(grass);
  }
  update(seconds:number,season:string,night:number){
    this.wind.value=seconds;
    this.waterTime.value=this.reducedMotion.matches?0:seconds;
    this.waterLight.value=1-night*.38;
    if(season!==this.currentSeason)this.currentSeason=season;
    this.grassPaint.color.set(season==='winter'?0xd5ddd0:season==='autumn'?0xd8c594:0xffffff);
  }
}
