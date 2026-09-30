import * as THREE from 'three';
import { planetSourceGroundHeight } from './planet-layout';
import { planetElevation, surfaceNormal } from './planet-geography';
import { RiverWorks } from './river-works';

const STEPS=96,ACROSS=4,VERTICES_PER_STEP=ACROSS*6;
/** A downhill reach beside the mill, ending at the ocean rather than in a field. */
export function planetRiverPoint(t:number){
  const s=1-t;
  return {x:s*s*s*50+3*s*s*t*47+3*s*t*t*46+t*t*t*43,
    z:s*s*s*-7+3*s*s*t*-14+3*s*t*t*-26+t*t*t*-40};
}
export function planetCropGrowth(river:number,mill:number){
  return river>=3&&mill>=5?Math.min(1,.58+.08*(mill-5)+.05*(river-3)):0;
}
const CROP_COLUMNS=35,CROP_ROWS=39,CROP_SPACING=.55;
export const PLANET_CROP_CANDIDATES=CROP_COLUMNS*CROP_ROWS;
/** A broad harvest area spans both banks; river and road clearances cut through it. */
export function planetCropContains(x:number,z:number,margin=0){
  return Math.hypot((x-42)/(15+margin),(z+21)/(14+margin))<1
    &&Math.hypot(x,z)>36.5-margin
    &&Math.hypot(x-37,z+25)>4.8-margin;
}
export function planetCropSite(index:number){
  const column=index%CROP_COLUMNS,row=Math.floor(index/CROP_COLUMNS);
  return {x:27.65+column*CROP_SPACING+(row%2)*.15,z:-11.55-row*CROP_SPACING};
}
function ribbon(width:number,lift:number){
  const positions:number[]=[],uv:number[]=[];
  const point=(t:number,side:number)=>{
    const p=planetRiverPoint(t),a=planetRiverPoint(Math.max(0,t-.001)),b=planetRiverPoint(Math.min(1,t+.001));
    const dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz);
    const x=p.x+dz/length*side*width/2,z=p.z-dx/length*side*width/2;
    return [x,planetSourceGroundHeight(x,z)+lift,z];
  };
  for(let i=0;i<STEPS;i++)for(let across=0;across<ACROSS;across++){
    const a=i/STEPS,b=(i+1)/STEPS,left=across/ACROSS*2-1,right=(across+1)/ACROSS*2-1;
    for(const [t,side] of [[a,left],[a,right],[b,left],[a,right],[b,right],[b,left]]){
      positions.push(...point(t,side));uv.push(side,t);
    }
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.computeVertexNormals();geo.setDrawRange(0,0);return geo;
}
/** Terrain-following banks and flowing water use the town's shared planet projection. */
export class PlanetRivers{
  readonly group=new THREE.Group();
  readonly works:RiverWorks;
  readonly water:THREE.Mesh;
  readonly banks:THREE.Mesh;
  private time={value:0};
  private level=0;
  constructor(parent:THREE.Group,mobile:boolean){
    this.group.name='Built river and irrigation';parent.add(this.group);
    const bankMaterial=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.96,side:THREE.DoubleSide});
    bankMaterial.onBeforeCompile=shader=>{
      shader.vertexShader='varying vec2 riverBankUv;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nriverBankUv=uv;');
      shader.fragmentShader='varying vec2 riverBankUv;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        float bankSide=abs(riverBankUv.x);
        float bankGrain=sin(riverBankUv.y*370.+riverBankUv.x*21.)*sin(riverBankUv.y*189.-riverBankUv.x*37.);
        float bankEdge=smoothstep(.67,.94,bankSide+bankGrain*.018);
        vec3 bankColor=mix(vec3(.38,.42,.29),vec3(.63,.55,.37),bankEdge);
        bankColor*=.97+bankGrain*.035;
        diffuseColor.rgb=pow(bankColor,vec3(2.2));
      `);
    };
    bankMaterial.customProgramCacheKey=()=> 'planet-river-bank-v1';
    this.banks=new THREE.Mesh(ribbon(3.8,.12),bankMaterial);
    this.banks.name='Excavated riverbanks';this.banks.receiveShadow=true;this.group.add(this.banks);
    const waterMaterial=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.3,metalness:0,side:THREE.DoubleSide});
    waterMaterial.onBeforeCompile=shader=>{
      shader.uniforms.riverTime=this.time;
      shader.vertexShader='varying vec2 riverUv;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nriverUv=uv;');
      shader.fragmentShader='uniform float riverTime;varying vec2 riverUv;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        float riverPhase=riverUv.y*115.-riverTime*2.4+sin(riverUv.x*5.)*.8;
        float riverFinePhase=riverUv.y*203.-riverTime*3.8-riverUv.x*4.;
        float riverFineFade=1.-smoothstep(.5,1.8,fwidth(riverFinePhase));
        float riverWaveHeight=sin(riverPhase)*.028+sin(riverFinePhase)*.009*riverFineFade;
        float riverEdge=smoothstep(.68,.97,abs(riverUv.x));
        float rippleWidth=max(fwidth(riverPhase),.035);
        float ripple=(1.-smoothstep(.08,.08+rippleWidth,abs(sin(riverPhase))))*(1.-smoothstep(.5,1.8,rippleWidth));
        ripple*=.16+.14*sin(riverUv.x*9.+riverUv.y*17.)*sin(riverUv.x*9.+riverUv.y*17.);
        float edgeFoam=riverEdge*(.15+.18*sin(riverFinePhase)*sin(riverFinePhase));
        float riverChannel=.5+.5*sin(riverUv.x*3.+riverUv.y*11.-riverTime*.2);
        vec3 riverColor=mix(vec3(.055,.43,.54),vec3(.13,.63,.66),riverChannel*.35+riverEdge*.65);
        riverColor=mix(riverColor,vec3(.78,.93,.86),min(.6,ripple+edgeFoam));
        diffuseColor.rgb=pow(riverColor,vec3(2.2));
      `);
      shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
        roughnessFactor=.27+riverEdge*.2;
      `);
      shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
        // Screen derivatives follow the projected river surface without needing
        // another texture or a separate globe-coordinate normal implementation.
        vec3 riverDx=dFdx(-vViewPosition),riverDy=dFdy(-vViewPosition);
        vec3 riverR1=cross(riverDy,normal),riverR2=cross(normal,riverDx);
        float riverDet=dot(riverDx,riverR1);
        vec3 riverGradient=sign(riverDet)*(dFdx(riverWaveHeight)*riverR1+dFdy(riverWaveHeight)*riverR2);
        normal=normalize(normal-riverGradient/max(abs(riverDet),.00001));
      `);
    };
    waterMaterial.customProgramCacheKey=()=> 'planet-river-flow-v2';
    this.water=new THREE.Mesh(ribbon(2.6,.24),waterMaterial);this.water.name='Flowing mill river';this.water.receiveShadow=true;this.group.add(this.water);
    this.works=new RiverWorks(this.group,mobile,planetRiverPoint,planetSourceGroundHeight,
      t=>{const p=planetRiverPoint(t);return planetSourceGroundHeight(p.x,p.z)+.26;},2.1);
  }
  setLevel(level:number,instant:boolean){
    if(level!==this.level){
      this.level=level;
      const width=2.6+Math.max(0,level-1)*.12;
      this.water.geometry.dispose();this.banks.geometry.dispose();
      this.water.geometry=ribbon(width,.24);this.banks.geometry=ribbon(width+1.2,.12);
    }
    this.works.setActive(level>0,instant);this.works.markers.visible=level>0&&!instant&&this.works.working;this.group.visible=level>0;
  }
  update(dt:number,reduced:boolean,seconds:number){
    this.works.update(dt,reduced);this.time.value=reduced?0:seconds;
    this.works.markers.visible=this.works.working;
    this.banks.geometry.setDrawRange(0,Math.floor(this.works.digProgress*STEPS)*VERTICES_PER_STEP);
    this.water.geometry.setDrawRange(0,Math.floor(this.works.flowProgress*STEPS)*VERTICES_PER_STEP);
  }
  dispose(){this.works.dispose();for(const mesh of [this.water,this.banks]){mesh.geometry.dispose();(mesh.material as THREE.Material).dispose();}this.group.removeFromParent();}
}
export function planetCropDry(x:number,z:number){return planetElevation(surfaceNormal(x,z))>.35;}
