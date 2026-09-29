import * as THREE from 'three';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
import { snapshotForGame } from './game-snapshot';
import { IDEAS, type Levels } from './game';

export const PLANET_RADIUS=85;
const noise=new ImprovedNoise();
export function surfaceNormal(x:number,z:number):THREE.Vector3 {
  const u=x/(2*PLANET_RADIUS),v=z/(2*PLANET_RADIUS),d=1+u*u+v*v;
  return new THREE.Vector3(2*u/d,(1-u*u-v*v)/d,2*v/d);
}
export function globeDirection(lat:number,lon:number){return new THREE.Vector3(Math.cos(lat)*Math.cos(lon),Math.sin(lat),Math.cos(lat)*Math.sin(lon));}
const levels=Object.fromEntries(IDEAS.map(idea=>[idea,8])) as Levels;
const plots=snapshotForGame(levels).plots.filter(plot=>plot.stage>0);
export const TOWN_SITES=plots.map(p=>surfaceNormal(p.x,p.z));
export const MOUNTAIN_SITES=[[-.1,-1.6],[.45,2.6],[-.65,.2],[-.55,2.2],[.7,-2.3],[.35,.85],[-1.15,-1.6]].map(([lat,lon])=>globeDirection(lat,lon));
// Connected ranges: overlapping asymmetric peaks share foothills and saddles.
// Tangent coordinates avoid the pinched latitude/longitude look at the poles.
const ranges=MOUNTAIN_SITES.map((normal,i)=>{
  const east=new THREE.Vector3().crossVectors(normal,new THREE.Vector3(.2,1,.1)).normalize();
  const north=new THREE.Vector3().crossVectors(east,normal).normalize();
  const angle=i*.93;
  const x=east.clone().multiplyScalar(Math.cos(angle)).addScaledVector(north,Math.sin(angle));
  const z=new THREE.Vector3().crossVectors(normal,x).normalize();
  return {normal,x,z};
});
export function rawPlanetHeight(n:THREE.Vector3):number {
  const warp=noise.noise(n.x*3+17,n.y*3-2,n.z*3+9)*.16;
  const f=noise.noise(n.x*2.1+3.4+warp,n.y*2.1+8.1,n.z*2.1-1.6)*.76
    +noise.noise(n.x*4.7-4,n.y*4.7+1,n.z*4.7+5)*.19
    +noise.noise(n.x*11+7,n.y*11,n.z*11)*.05;
  let h=(f-.015)*19;
  if(h>0){
    const uplands=THREE.MathUtils.smoothstep(h,.6,2.5);
    h=Math.tanh(h/4)*3.8+uplands*(noise.noise(n.x*18+2,n.y*18,n.z*18)*.65+noise.noise(n.x*35,n.y*35+4,n.z*35)*.22);
  }
  // Broader smooth shelves support the original town's entire animated footprint.
  for(const site of TOWN_SITES){const d=1-n.dot(site);if(d<.025){
    const shelf=2.3-140*d; const blend=.7;
    const t=Math.max(blend-Math.abs(h-shelf),0)/blend;
    h=THREE.MathUtils.lerp(h,Math.max(h,shelf)+t*t*blend*.25,1-THREE.MathUtils.smoothstep(d,.006,.025));
  }}
  for(let i=0;i<ranges.length;i++){
    const range=ranges[i];if(n.dot(range.normal)<.9)continue;
    const x=n.dot(range.x)*PLANET_RADIUS,z=n.dot(range.z)*PLANET_RADIUS;
    const envelope=1-THREE.MathUtils.smoothstep(Math.abs(x),9,27);
    const crest=(13+Math.cos(x*.25+i)*3.5+Math.sin(x*.43-i)*2)*envelope;
    const spine=Math.sin(x*.17+i)*2.8;
    const ridge=Math.max(0,crest-Math.abs(z-spine)*(1.15+.18*Math.sin(x*.7)));
    const erosion=noise.noise(n.x*30,n.y*30,n.z*30)*1.1
      +noise.noise(n.x*95+2,n.y*95,n.z*95)*.15;
    if(ridge>0)h=THREE.MathUtils.lerp(h,Math.max(h,ridge+erosion-.6),THREE.MathUtils.smoothstep(ridge,0,2));
  }
  return h;
}
// Shared by rendering, construction, water and picking: no mismatched shorelines.
const WIDTH=1536,HEIGHT=768;
const heightData=new Float32Array(WIDTH*HEIGHT);
const direction=new THREE.Vector3();
for(let y=0;y<HEIGHT;y++)for(let x=0;x<WIDTH;x++){
  const lon=((x+.5)/WIDTH-.5)*Math.PI*2,lat=((y+.5)/HEIGHT-.5)*Math.PI;
  direction.set(Math.cos(lat)*Math.cos(lon),Math.sin(lat),Math.cos(lat)*Math.sin(lon));
  heightData[y*WIDTH+x]=rawPlanetHeight(direction);
}
/** Bilinear sampling matches the GPU's height map, including its longitude seam. */
export function planetElevation(n:THREE.Vector3):number {
  const x=(Math.atan2(n.z,n.x)/(2*Math.PI)+.5)*WIDTH-.5,y=(Math.asin(THREE.MathUtils.clamp(n.y,-1,1))/Math.PI+.5)*HEIGHT-.5;
  const ix=Math.floor(x),iy=Math.floor(y),tx=x-ix,ty=y-iy;
  const value=(a:number,b:number)=>heightData[Math.max(0,Math.min(HEIGHT-1,b))*WIDTH+(a+WIDTH)%WIDTH];
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(value(ix,iy),value(ix+1,iy),tx),THREE.MathUtils.lerp(value(ix,iy+1),value(ix+1,iy+1),tx),ty);
}
export function createPlanetHeightTexture(){
  const texture=new THREE.DataTexture(heightData,WIDTH,HEIGHT,THREE.RedFormat,THREE.FloatType);
  texture.wrapS=THREE.RepeatWrapping;texture.wrapT=THREE.ClampToEdgeWrapping;
  texture.magFilter=texture.minFilter=THREE.LinearFilter;texture.needsUpdate=true;return texture;
}
