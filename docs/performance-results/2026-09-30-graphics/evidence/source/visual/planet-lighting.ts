import * as THREE from 'three';

const planetGround=new THREE.Color(0x718599),planetNightGround=new THREE.Color(0x35445c);
export const PLANET_LIGHT_DISTANCE=400;

/** Keep globe relief readable while still allowing weather and moonlight to change the scene. */
export function applyPlanetLighting(sun:THREE.DirectionalLight,fill:THREE.HemisphereLight,night:number,overcast:number){
  sun.intensity=(3.1-overcast*1.15)*(1-night*.73);
  fill.intensity=(.88+overcast*.26)*(1-night*.19);
  fill.groundColor.copy(planetGround).lerp(planetNightGround,night*.85);
  sun.shadow.intensity=1-overcast*.32;
  return 1.08-night*.035;
}

/** One globe-sized map covers every orbit, including the tallest authored landmarks. */
export function configurePlanetShadows(sun:THREE.DirectionalLight,mobile:boolean,radius:number,resolution=mobile?1024:4096){
  const shadow=sun.shadow,reach=radius+40;
  if(shadow.map&&shadow.map.width!==resolution){shadow.map.dispose();shadow.map=null;}
  shadow.mapSize.setScalar(resolution);
  const texel=reach*2/shadow.mapSize.x;
  // Bias stays below one texel so roofs and tree trunks retain their contact shadows.
  shadow.normalBias=texel*.45;shadow.bias=-.00008;
  const camera=shadow.camera;
  camera.left=camera.bottom=-reach;camera.right=camera.top=reach;
  camera.near=PLANET_LIGHT_DISTANCE-reach-8;camera.far=PLANET_LIGHT_DISTANCE+reach+8;
  camera.updateProjectionMatrix();
}
