import * as THREE from 'three';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';

/** Branch tiers taper into a single crown; deliberately irregular, never stacked cones. */
export function createFirGeometry(){
  const positions:number[]=[],colors:number[]=[],indices:number[]=[];
  const profile=[[.35,.25],[.48,1.05],[.75,.78],[1.0,.6],[1.02,.92],[1.35,.58],[1.56,.44],[1.57,.69],[1.92,.39],[2.12,.28],[2.13,.43],[2.52,.18],[2.95,.012]];
  const segments=12,color=new THREE.Color();
  for(let row=0;row<profile.length;row++)for(let side=0;side<=segments;side++){
    const [y,r]=profile[row],a=side/segments*Math.PI*2;
    const irregular=1+Math.sin(a*5+row*.6)*.09;
    positions.push(Math.cos(a)*r*irregular,y,Math.sin(a)*r*irregular);
    color.setRGB(.58,.74,.53).multiplyScalar(.74+y*.075+Math.sin(a*3)*.06);
    colors.push(color.r,color.g,color.b);
    if(row<profile.length-1&&side<segments){const k=row*(segments+1)+side;indices.push(k,k+segments+1,k+1,k+1,k+segments+1,k+segments+2);}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}

/** A fused volume gives cumulus clouds soft shoulders and a continuous underside. */
export function createCloudGeometry(seed=0){
  const material=new THREE.MeshBasicMaterial();
  const field=new MarchingCubes(44,material,false,false,18000);
  field.isolation=55;
  // A broad, low base with several taller lobes gives a cumulus silhouette from every angle.
  const lobes=[[.29,.43,.47,.17],[.44,.44,.37,.22],[.60,.43,.40,.19],[.72,.44,.51,.15],
    [.35,.46,.60,.17],[.53,.46,.60,.23],[.65,.46,.60,.16],
    [.42,.62,.48,.23],[.56,.66,.49,.27],[.65,.57,.53,.17]];
  for(const [x,y,z,s] of lobes){
    const variation=Math.sin(seed*3.4+x*17+z*9);
    field.addBall(x,y+variation*.025,z+Math.cos(seed+y*13)*.017,s*(6.3+variation*.5),65);
  }
  field.update();
  const geometry=new THREE.BufferGeometry();
  for(const key of ['position','normal']){
    const attr=field.geometry.getAttribute(key);
    geometry.setAttribute(key,new THREE.Float32BufferAttribute((attr.array as Float32Array).slice(0,field.count*3),3));
  }
  geometry.scale(12.5,8.5,11.5);geometry.computeBoundingBox();geometry.center();
  const p=geometry.getAttribute('position'),color=new THREE.Color(),colors:number[]=[];
  for(let i=0;i<p.count;i++){
    const t=THREE.MathUtils.smoothstep(p.getY(i),-1.4,1.6);
    color.set(0xc0ccdc).lerp(new THREE.Color(0xfffdf3),t);colors.push(color.r,color.g,color.b);
  }
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  field.geometry.dispose();material.dispose();return geometry;
}
