import * as THREE from 'three';
import { createCloudGeometry } from './planet-assets';
import { PLANET_RADIUS, planetElevation, globeDirection, TOWN_SITES } from './planet-geography';
import type { TownSnapshot } from './model';

const random=(i:number)=>{const x=Math.sin(i*127.1+73.7)*43758.5453;return x-Math.floor(x);};
const UP=new THREE.Vector3(0,1,0),STEP=1/30;
export interface CloudParcel {
  direction:THREE.Vector3; latitude:number; longitude:number; wind:number;
  lifetime:number; phase:number; humidity:number; strength:number; radius:number; size:number;
}

/** Small deterministic weather model: wind belts advect moisture through a fixed cloud pool. */
export class CloudSimulation {
  readonly parcels:CloudParcel[];
  elapsed=0;
  weatherAmount=0;
  private remainder=0;
  private enabled=false;
  private activation=0;
  private weather:TownSnapshot['weather']='clear';
  constructor(count:number,private readonly heightAt=planetElevation){
    this.parcels=Array.from({length:count},(_,i)=>{
      const latitude=Math.asin(1-2*(i+.5)/count)*.9,longitude=i*2.399963+.7;
      return {direction:globeDirection(latitude,longitude),latitude,longitude,
        wind:(Math.abs(latitude)<.5?1:-1)*(.0035+random(i+21)*.003),
        lifetime:80+random(i+35)*80,phase:random(i+97),humidity:.7,strength:0,
        radius:PLANET_RADIUS+18,size:.9+random(i+93)*.6};
    });
  }
  setEnvironment(water:boolean,weather:TownSnapshot['weather'],immediate=false){
    this.weather=weather;
    if(!water){this.enabled=false;this.activation=0;this.elapsed=0;this.remainder=0;this.weatherAmount=0;this.parcels.forEach(p=>p.humidity=.7);this.updateParcels(0);return;}
    const starting=!this.enabled;
    if(starting){this.enabled=true;this.activation=immediate?1:0;this.parcels.forEach(p=>p.humidity=this.heightAt(p.direction)<0?.98:.55);}
    if(immediate){this.activation=1;this.weatherAmount=weather==='clear'?0:weather==='cloudy'?.6:1;}
    if(starting||immediate)this.updateParcels(0);
  }
  advance(seconds:number){
    if(!this.enabled)return;
    // Returning from a hidden tab never fast-forwards an entire weather cycle.
    this.remainder+=Math.min(.25,Math.max(0,seconds));
    while(this.remainder+1e-9>=STEP){
      this.remainder-=STEP;this.elapsed+=STEP;
      this.activation+=(1-this.activation)*(1-Math.exp(-STEP*.7));
      this.updateParcels(STEP);
    }
  }
  private updateParcels(dt:number){
    const targetWeather=this.weather==='clear'?0:this.weather==='cloudy'?.6:1;
    this.weatherAmount+=(targetWeather-this.weatherAmount)*(1-Math.exp(-dt*.2));
    const coverage=.8+this.weatherAmount*.35;
    this.parcels.forEach((p,i)=>{
      const latitude=p.latitude+Math.sin(this.elapsed*.025+i)*.025;
      p.direction.set(Math.cos(latitude)*Math.cos(p.longitude+p.wind*this.elapsed),Math.sin(latitude),Math.cos(latitude)*Math.sin(p.longitude+p.wind*this.elapsed));
      const h=this.heightAt(p.direction);
      // Oceans replenish moisture; hills lift it; inland air slowly dries.
      const moisture=h<0?.98:h>5?.8:.48;
      p.humidity+=(moisture-p.humidity)*(1-Math.exp(-dt*.12));
      const phase=(this.elapsed/p.lifetime+p.phase)%1;
      const life=THREE.MathUtils.smoothstep(phase,0,.18)*(1-THREE.MathUtils.smoothstep(phase,.72,1));
      p.strength=this.activation*life*THREE.MathUtils.clamp(p.humidity*coverage,0,1);
      const nearTown=TOWN_SITES.some(site=>site.dot(p.direction)>.994);
      const altitude=Math.max(13+(i%3)*2.5,h+(nearTown?25:9));
      const radius=PLANET_RADIUS+altitude;
      p.radius=dt===0?radius:THREE.MathUtils.lerp(p.radius,radius,1-Math.exp(-dt*2));
    });
  }
}

/** Reuses five sculpted clouds. Only transforms, opacity and shader uniforms change per frame. */
export class PlanetClouds {
  readonly group=new THREE.Group();
  readonly simulation:CloudSimulation;
  private shapes:THREE.BufferGeometry[];
  private meshes:THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>[]=[];
  private depths:THREE.MeshDepthMaterial[]=[];
  private times:{value:number}[]=[];
  private lastTime:number|undefined;
  private shade=new THREE.Color();
  constructor(mobile:boolean){
    this.group.name='Simulated cloud weather';this.group.visible=false;
    this.simulation=new CloudSimulation(mobile?24:36);
    this.shapes=[0,1,2,3,4].map(seed=>createCloudGeometry(seed));
    this.simulation.parcels.forEach((_p,i)=>{
      const time={value:0};this.times.push(time);
      const deform=(material:THREE.Material)=>{
        material.onBeforeCompile=shader=>{
          shader.uniforms.cloudTime=time;shader.uniforms.cloudSeed={value:i*1.71};
          shader.vertexShader='uniform float cloudTime;uniform float cloudSeed;\n'+shader.vertexShader;
          shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
            float puff=smoothstep(-.6,2.8,position.y);
            transformed.y+=sin(position.x*.65+cloudTime*.32+cloudSeed)*.22*puff;
            transformed.z+=sin(position.y*.8+cloudTime*.2+cloudSeed)*.12*puff;
          `);
        };
        material.customProgramCacheKey=()=>'cumulus-breathing-v1';
      };
      const material=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:1,transparent:true,depthWrite:false});
      deform(material);
      // Hash only the shadow pass, so fading clouds do not leave opaque shadow silhouettes.
      const depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,alphaHash:true});deform(depth);this.depths.push(depth);
      const mesh=new THREE.Mesh(this.shapes[i%this.shapes.length],material);
      mesh.name=`Cumulus ${i+1}`;mesh.castShadow=true;mesh.customDepthMaterial=depth;mesh.frustumCulled=false;
      this.meshes.push(mesh);this.group.add(mesh);
    });
    this.group.traverse(object=>object.userData.planetNative=true);
  }
  update(water:boolean,weather:TownSnapshot['weather'],immediate:boolean){
    this.group.visible=water;
    this.simulation.setEnvironment(water,weather,immediate);
    if(!water){this.lastTime=undefined;this.times.forEach(time=>time.value=0);}
    this.sync();
  }
  render(now:number,reducedMotion:boolean){
    const dt=this.lastTime===undefined?0:(now-this.lastTime)/1000;this.lastTime=now;
    if(!this.group.visible)return;
    if(!reducedMotion)this.simulation.advance(dt);
    this.sync();
  }
  private sync(){
    this.shade.setRGB(1-this.simulation.weatherAmount*.24,1-this.simulation.weatherAmount*.2,1-this.simulation.weatherAmount*.15);
    this.simulation.parcels.forEach((p,i)=>{
      const mesh=this.meshes[i],growth=.65+Math.sqrt(p.strength)*.35;
      mesh.visible=p.strength>.002;
      mesh.position.copy(p.direction).multiplyScalar(p.radius);
      mesh.quaternion.setFromUnitVectors(UP,p.direction);
      mesh.rotateY(Math.sin(i*3.7)*.75);
      mesh.scale.set(p.size*growth,p.size*growth*(1+.06*Math.sin(this.simulation.elapsed*.23+i)),p.size*growth);
      const opacity=THREE.MathUtils.smoothstep(p.strength,0,.6);
      mesh.material.opacity=opacity;mesh.material.color.copy(this.shade);
      this.depths[i].opacity=opacity;
      this.times[i].value=this.simulation.elapsed;
    });
  }
  dispose(){
    this.shapes.forEach(g=>g.dispose());this.meshes.forEach(m=>m.material.dispose());this.depths.forEach(m=>m.dispose());this.group.removeFromParent();
  }
}
