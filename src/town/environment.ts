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
  private readonly grassPaint=new THREE.MeshBasicMaterial({color:0xffffff,side:THREE.DoubleSide,vertexColors:true,toneMapped:true});
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
    const low=new THREE.Color(0x789667),high=new THREE.Color(0x678566),sand=new THREE.Color(0x91a378);
    for(let i=0;i<positions.count;i++){
      const x=positions.getX(i),z=positions.getZ(i),r=Math.hypot(x,z);
      positions.setY(i,terrainHeight(x,z));
      const c=low.clone().lerp(high,THREE.MathUtils.smoothstep(r,70,220)*.8).lerp(sand,rand(i*741)*.13);
      colors.push(c.r,c.g,c.b);
    }
    g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();
    const terrain=new THREE.Mesh(g,MAT.terrain);
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
      if(isWater(x,z)||PLOTS.some(p=>Math.hypot(p.x-x,p.z-z)<(p.kind==='project'?8:5.6))||r<67&&(Math.abs(x)<3.5||Math.abs(z)<3.5||Math.abs(r-31.5)<3.8||Math.abs(r-55)<4))continue;
      this.trees.push({x,z,r:.7+rand(i*27)*.5});
    }
    const n=this.trees.length,d=new THREE.Object3D();
    const trunk=new THREE.InstancedMesh(new THREE.CylinderGeometry(.32,.47,1.8,6),MAT.woodDark,n);
    const canopy=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.45,1),MAT.foliage,n);
    const crown=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.1,1),MAT.foliage,n);
    const pineGeo=new THREE.ConeGeometry(1,1,7,1),pineTiers=[0,1,2].map(()=>new THREE.InstancedMesh(pineGeo,MAT.pine,n));
    this.trees.forEach((t,i)=>{
      const s=.86+rand(i*83)*.9,y=terrainHeight(t.x,t.z);
      d.position.set(t.x,y+.85*s,t.z);d.rotation.set(0,rand(i*5)*6.28,0);d.scale.setScalar(s);d.updateMatrix();trunk.setMatrixAt(i,d.matrix);
      const pine=i%5!==0;
      d.position.y=y+2.1*s;d.scale.set(pine?.0001:1.15*s,pine?.0001:(1.2+rand(i*59)*.45)*s,pine?.0001:1.05*s);d.updateMatrix();canopy.setMatrixAt(i,d.matrix);
      d.position.y=y+3.15*s;d.scale.setScalar(pine?.0001:.85*s);d.updateMatrix();crown.setMatrixAt(i,d.matrix);
      const tint=new THREE.Color([0x628a6c,0x567c68,0x779268,0x6f8660][i%4]);canopy.setColorAt(i,tint);crown.setColorAt(i,tint.clone().multiplyScalar(1.13));
      for(let tier=0;tier<3;tier++){
        d.position.y=y+(2.05+tier*1.02)*s;
        d.scale.set(pine?(1.68-tier*.29)*s:.0001,pine?(2.15-tier*.24)*s:.0001,pine?(1.68-tier*.29)*s:.0001);
        d.updateMatrix();pineTiers[tier].setMatrixAt(i,d.matrix);
        pineTiers[tier].setColorAt(i,new THREE.Color([0x5a7050,0x627a4f,0x6d8159,0x536b55][(i+tier)%4]).multiplyScalar(1+tier*.055));
      }
    });
    for(const mesh of [trunk,canopy,crown,...pineTiers]){mesh.instanceMatrix.needsUpdate=true;mesh.castShadow=!this.mobile;mesh.receiveShadow=true;this.group.add(mesh);}
    if(canopy.instanceColor)canopy.instanceColor.needsUpdate=true;if(crown.instanceColor)crown.instanceColor.needsUpdate=true;
    for(const tier of pineTiers)if(tier.instanceColor)tier.instanceColor.needsUpdate=true;
    const rocks=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),MAT.stone,this.mobile?50:95);
    for(let i=0;i<rocks.count;i++){
      const a=i*2.399,r=70+rand(i*313)*92,x=Math.cos(a)*r,z=Math.sin(a)*r;
      d.position.set(x,terrainHeight(x,z)+.38,z);d.rotation.set(rand(i*7),a,rand(i*11));d.scale.set(.5+rand(i*13)*1.2,.35+rand(i*19)*.8,.6+rand(i*23)*1.1);d.updateMatrix();rocks.setMatrixAt(i,d.matrix);
    }
    rocks.instanceMatrix.needsUpdate=true;rocks.receiveShadow=true;this.group.add(rocks);
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
      shader.vertexShader='uniform float townWind;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
        #ifdef USE_INSTANCING
          float tipWeight=smoothstep(.08,.72,transformed.y);
          transformed.x+=sin(townWind*1.45+instanceMatrix[3].x*.13+instanceMatrix[3].z*.19)*tipWeight*.11;
          transformed.z+=cos(townWind*1.1+instanceMatrix[3].z*.11)*tipWeight*.065;
        #endif
      `);
    };
    this.grassPaint.customProgramCacheKey=()=> 'town-wind-grass-v2';
    const positions:{x:number;z:number;s:number;a:number;color:number}[]=[];
    const attempts=this.mobile?6500:17000;
    for(let i=0;i<attempts;i++){
      const a=rand(i*167+2)*Math.PI*2,r=i%2===0?Math.sqrt(rand(i*911+9))*71:71+Math.sqrt(rand(i*911+9))*75,x=Math.cos(a)*r,z=Math.sin(a)*r;
      const meadow=Math.sin(x*.045)*Math.sin(z*.059);
      if(rand(i*631+5)>.72+meadow*.24||isWater(x,z)||PLOTS.some(p=>Math.hypot(p.x-x,p.z-z)<(p.kind==='project'?6.7:3.8))||r<67&&(Math.abs(x)<2.7||Math.abs(z)<2.7||Math.abs(r-31.5)<2.3||Math.abs(r-55)<2.5))continue;
      positions.push({x,z,s:.68+rand(i*13)*.72,a:rand(i*27)*6.28,color:i%5});
    }
    const grass=new THREE.InstancedMesh(geometry,this.grassPaint,positions.length),d=new THREE.Object3D();
    positions.forEach((p,i)=>{d.position.set(p.x,terrainHeight(p.x,p.z)+.015,p.z);d.rotation.set(0,p.a,0);d.scale.setScalar(p.s);d.updateMatrix();grass.setMatrixAt(i,d.matrix);grass.setColorAt(i,new THREE.Color([0xe1e8c7,0xd7e2bc,0xe5eccb,0xcddcb4,0xe0e6bf][p.color]));});
    grass.instanceMatrix.needsUpdate=true;if(grass.instanceColor)grass.instanceColor.needsUpdate=true;grass.frustumCulled=false;
    this.group.add(grass);
  }
  update(seconds:number,season:string,night:number){
    this.wind.value=seconds;
    if(season!==this.currentSeason)this.currentSeason=season;
    this.grassPaint.color.set(season==='winter'?0xd5ddd0:season==='autumn'?0xd8c594:0xffffff).multiplyScalar(1-night*.42);
    for(const water of this.water)water.material instanceof THREE.MeshStandardMaterial&&(water.material.emissive.setHex(0x102b36),water.material.emissiveIntensity=.16+.06*Math.sin(seconds*.7));
  }
}
