import * as THREE from 'three';
import { PLOTS } from './model';
import { MAT } from './materials';

const hash=(n:number)=>{let x=n|0;x^=x>>>16;x=Math.imul(x,0x7feb352d);x^=x>>>15;return (x^x>>>16)>>>0;};
const rand=(seed:number)=>hash(seed)/0xffffffff;

export function terrainHeight(x:number,z:number):number{
  const r=Math.hypot(x,z),outer=Math.max(0,r-68);
  return .48+outer*.048+outer*outer*.00055*(.72+.28*Math.sin(x*.075+z*.034));
}
export const riverCenter=(x:number)=>-86+7*Math.sin(x*.027)+3*Math.sin(x*.071+1.3);
export const PONDS=([{x:-82,z:-27,r:8},{x:83,z:-34,r:6.5}] as const);
export function isWater(x:number,z:number,clearance=0):boolean{
  return Math.abs(z-riverCenter(x))<4.6+clearance||PONDS.some(p=>Math.hypot(x-p.x,z-p.z)<p.r+clearance);
}

function ribbon(width:number,color:number,opacity=1):THREE.Mesh{
  const positions:number[]=[],indices:number[]=[];
  for(let i=0;i<=100;i++){
    const x=-220+i*4.4,z=riverCenter(x),y=terrainHeight(x,z)+.14;
    positions.push(x,y,z-width/2,x,y,z+width/2);
    if(i<100){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();
  return new THREE.Mesh(g,new THREE.MeshStandardMaterial({color,roughness:.48,transparent:opacity<1,opacity,side:THREE.DoubleSide,depthWrite:opacity===1}));
}

export class Environment {
  readonly group=new THREE.Group();
  readonly trees:{x:number;z:number;r:number}[]=[];
  private readonly grassPaint=new THREE.MeshStandardMaterial({color:0x8cac67,roughness:1,side:THREE.DoubleSide});
  private readonly wind={value:0};
  private readonly water:THREE.Mesh[]=[];
  private currentSeason='';
  constructor(scene:THREE.Scene,private mobile:boolean){
    this.buildTerrain();this.buildWater();this.buildMountains();this.buildForest();this.buildGrass();
    scene.add(this.group);
  }
  private buildTerrain(){
    const g=new THREE.PlaneGeometry(700,700,88,88);g.rotateX(-Math.PI/2);
    const positions=g.getAttribute('position'),colors:number[]=[];
    const low=new THREE.Color(0x789667),high=new THREE.Color(0x617b65),sand=new THREE.Color(0x9da17a);
    for(let i=0;i<positions.count;i++){
      const x=positions.getX(i),z=positions.getZ(i),r=Math.hypot(x,z);
      positions.setY(i,terrainHeight(x,z));
      const c=low.clone().lerp(high,THREE.MathUtils.smoothstep(r,70,220)*.8).lerp(sand,rand(i*741)*.13);
      colors.push(c.r,c.g,c.b);
    }
    g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();
    const terrain=new THREE.Mesh(g,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,side:THREE.DoubleSide}));
    terrain.receiveShadow=true;this.group.add(terrain);
    const square=new THREE.Mesh(new THREE.CylinderGeometry(7.8,7.8,.08,32),MAT.path);square.position.y=.55;square.receiveShadow=true;this.group.add(square);
  }
  private buildWater(){
    const bank=ribbon(15,0xbab597),stream=ribbon(9.4,0x578d9e,.96);
    bank.position.y=.015;stream.position.y=.045;(stream.material as THREE.Material).depthWrite=false;
    this.group.add(bank,stream);this.water.push(stream);
    for(const p of PONDS){
      const y=terrainHeight(p.x,p.z)+.15;
      const shore=new THREE.Mesh(new THREE.CircleGeometry(p.r+1.6,32),MAT.path);shore.rotation.x=-Math.PI/2;shore.position.set(p.x,y,p.z);
      const pond=new THREE.Mesh(new THREE.CircleGeometry(p.r,32),stream.material);pond.rotation.x=-Math.PI/2;pond.position.set(p.x,y+.035,p.z);this.group.add(shore,pond);this.water.push(pond);
      for(let j=0;j<9;j++){const a=j*2.4,rr=p.r+2.1+(j%3)*.45;const reed=new THREE.Mesh(new THREE.ConeGeometry(.24,1.5,4),MAT.grassDark);reed.position.set(p.x+Math.cos(a)*rr,y+.75,p.z+Math.sin(a)*rr);this.group.add(reed);}
    }
  }
  private buildMountains(){
    const count=this.mobile?17:23,baseGeo=new THREE.ConeGeometry(1,1,6,1);
    const base=new THREE.InstancedMesh(baseGeo,new THREE.MeshStandardMaterial({color:0xffffff,roughness:1,flatShading:true}),count);
    const caps=new THREE.InstancedMesh(baseGeo,new THREE.MeshStandardMaterial({color:0xe2e5d8,roughness:1,flatShading:true}),count);
    const d=new THREE.Object3D();
    for(let i=0;i<count;i++){
      const a=i*Math.PI*2/count+.12*(rand(i*13)-.5),r=230+rand(i*37)*58,x=Math.cos(a)*r,z=Math.sin(a)*r;
      const height=41+rand(i*47)*28,width=22+rand(i*23)*13;
      d.position.set(x,terrainHeight(x,z)+height*.48,z);d.scale.set(width,height,width*.88);d.rotation.set(0,a,.1*(rand(i*11)-.5));d.updateMatrix();base.setMatrixAt(i,d.matrix);
      base.setColorAt(i,new THREE.Color([0x697a78,0x7e8580,0x647572,0x938f82][i%4]));
      d.position.y+=height*.38;d.scale.set(width*.33,height*.27,width*.29);d.updateMatrix();caps.setMatrixAt(i,d.matrix);
    }
    base.instanceMatrix.needsUpdate=true;caps.instanceMatrix.needsUpdate=true;
    if(base.instanceColor)base.instanceColor.needsUpdate=true;
    base.receiveShadow=true;this.group.add(base,caps);
    const foothills=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),MAT.grassDark,this.mobile?14:20);
    for(let i=0;i<foothills.count;i++){
      const a=i*2.399,r=150+rand(i*97)*48,x=Math.cos(a)*r,z=Math.sin(a)*r;
      d.position.set(x,terrainHeight(x,z)+3,z);d.rotation.set(0,a,0);d.scale.set(7+rand(i*3)*6,4+rand(i*7)*5,6+rand(i*17)*6);d.updateMatrix();foothills.setMatrixAt(i,d.matrix);
    }
    foothills.instanceMatrix.needsUpdate=true;foothills.receiveShadow=true;this.group.add(foothills);
  }
  private buildForest(){
    const count=this.mobile?250:520;
    for(let i=0;i<count;i++){
      const a=rand(i*311+9)*Math.PI*2,r=69+Math.sqrt(rand(i*797+18))*90,x=Math.cos(a)*r,z=Math.sin(a)*r;
      if(isWater(x,z)||PLOTS.some(p=>Math.hypot(p.x-x,p.z-z)<(p.kind==='project'?8:5.6))||r<67&&(Math.abs(x)<3.5||Math.abs(z)<3.5||Math.abs(r-31.5)<3.8||Math.abs(r-55)<4))continue;
      this.trees.push({x,z,r:.7+rand(i*27)*.5});
    }
    const n=this.trees.length,d=new THREE.Object3D();
    const trunk=new THREE.InstancedMesh(new THREE.CylinderGeometry(.32,.47,1.8,6),MAT.woodDark,n);
    const canopy=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.45,1),MAT.leaf,n);
    const crown=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.1,1),MAT.leafLight,n);
    this.trees.forEach((t,i)=>{
      const s=.86+rand(i*83)*.9,y=terrainHeight(t.x,t.z);
      d.position.set(t.x,y+.85*s,t.z);d.rotation.set(0,rand(i*5)*6.28,0);d.scale.setScalar(s);d.updateMatrix();trunk.setMatrixAt(i,d.matrix);
      d.position.y=y+2.1*s;d.scale.set(1.15*s,(1.2+rand(i*59)*.45)*s,1.05*s);d.updateMatrix();canopy.setMatrixAt(i,d.matrix);
      d.position.y=y+3.15*s;d.scale.set(.78*s,.92*s,.75*s);d.updateMatrix();crown.setMatrixAt(i,d.matrix);
      const tint=new THREE.Color([0x628a6c,0x567c68,0x779268,0x6f8660][i%4]);canopy.setColorAt(i,tint);crown.setColorAt(i,tint.clone().multiplyScalar(1.13));
    });
    for(const mesh of [trunk,canopy,crown]){mesh.instanceMatrix.needsUpdate=true;mesh.castShadow=!this.mobile;mesh.receiveShadow=true;this.group.add(mesh);}
    if(canopy.instanceColor)canopy.instanceColor.needsUpdate=true;if(crown.instanceColor)crown.instanceColor.needsUpdate=true;
    const rocks=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),MAT.stone,this.mobile?50:95);
    for(let i=0;i<rocks.count;i++){
      const a=i*2.399,r=70+rand(i*313)*92,x=Math.cos(a)*r,z=Math.sin(a)*r;
      d.position.set(x,terrainHeight(x,z)+.38,z);d.rotation.set(rand(i*7),a,rand(i*11));d.scale.set(.5+rand(i*13)*1.2,.35+rand(i*19)*.8,.6+rand(i*23)*1.1);d.updateMatrix();rocks.setMatrixAt(i,d.matrix);
    }
    rocks.instanceMatrix.needsUpdate=true;rocks.receiveShadow=true;this.group.add(rocks);
  }
  private buildGrass(){
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute([
      -.17,0,0, .17,0,0, .025,1,0,
      0,0,-.17, 0,0,.17, 0,1,.025,
    ],3));geometry.computeVertexNormals();
    this.grassPaint.onBeforeCompile=shader=>{
      shader.uniforms.townWind=this.wind;
      shader.vertexShader='uniform float townWind;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
        #ifdef USE_INSTANCING
          transformed.x+=sin(townWind*1.8+instanceMatrix[3].x*.13+instanceMatrix[3].z*.19)*transformed.y*.22;
          transformed.z+=cos(townWind*1.25+instanceMatrix[3].z*.11)*transformed.y*.11;
        #endif
      `);
    };
    this.grassPaint.customProgramCacheKey=()=> 'town-wind-grass-v1';
    const positions:{x:number;z:number;s:number;a:number;color:number}[]=[];
    const attempts=this.mobile?4400:13500;
    for(let i=0;i<attempts;i++){
      const a=rand(i*167+2)*Math.PI*2,r=Math.sqrt(rand(i*911+9))*146,x=Math.cos(a)*r,z=Math.sin(a)*r;
      if(isWater(x,z)||PLOTS.some(p=>Math.hypot(p.x-x,p.z-z)<(p.kind==='project'?7:4.3))||r<67&&(Math.abs(x)<3.1||Math.abs(z)<3.1||Math.abs(r-31.5)<2.6||Math.abs(r-55)<2.8))continue;
      positions.push({x,z,s:.45+rand(i*13)*1.05,a:rand(i*27)*6.28,color:i%5});
    }
    const grass=new THREE.InstancedMesh(geometry,this.grassPaint,positions.length),d=new THREE.Object3D();
    positions.forEach((p,i)=>{d.position.set(p.x,terrainHeight(p.x,p.z)+.03,p.z);d.rotation.set(0,p.a,0);d.scale.setScalar(p.s);d.updateMatrix();grass.setMatrixAt(i,d.matrix);grass.setColorAt(i,new THREE.Color([0x98ad66,0x7eaa68,0xb5a768,0x6d9961,0x91ad75][p.color]));});
    grass.instanceMatrix.needsUpdate=true;if(grass.instanceColor)grass.instanceColor.needsUpdate=true;grass.frustumCulled=false;
    this.group.add(grass);
  }
  update(seconds:number,season:string){
    this.wind.value=seconds;
    if(season!==this.currentSeason){this.currentSeason=season;this.grassPaint.color.set(season==='winter'?0xabb7a4:season==='autumn'?0xd0ae7d:0xa6c17f);}
    for(const water of this.water)water.material instanceof THREE.MeshStandardMaterial&&(water.material.emissive.setHex(0x102b36),water.material.emissiveIntensity=.16+.06*Math.sin(seconds*.7));
  }
}
