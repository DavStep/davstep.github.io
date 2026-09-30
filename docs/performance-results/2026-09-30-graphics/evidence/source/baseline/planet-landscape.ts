import * as THREE from 'three';
import { PlanetGrove,GROVE_ORIGIN } from './planet-grove';
import { createPlanetTerrainMaterial, createPlanetOceanMaterial } from './planet-materials';
import { PLANET_RADIUS as R, planetElevation, globeDirection, surfaceNormal, TOWN_SITES, createPlanetHeightTexture } from './planet-geography';
import type { TownSnapshot } from './model';
import type { WorldEventState } from './world-event-types';
import { WORLD_EVENT_SITES } from './world-event-terrain';
import { PlanetRoads } from './planet-roads';
import { planetRoadClearance } from './planet-road-clearance';
import type { RoadPoint } from './planet-building-access';
import { PlanetSettlements } from './planet-settlements';
import { PlanetTransport } from './planet-transport';
import { PlanetActivity } from './planet-activity';
import { PlanetClouds } from './planet-clouds';
import { ATMOSPHERE } from './atmosphere';
const rand=(n:number)=>{const v=Math.sin(n*127.1+311.7)*43758.5453123;return v-Math.floor(v);};
const UP=new THREE.Vector3(0,1,0);

/** Native spherical geography. It has no valley mesh or inherited mountain ring. */
export class PlanetLandscape {
  readonly group=new THREE.Group();
  private water:THREE.Mesh;
  private terrain:THREE.Mesh;
  private clouds:PlanetClouds;
  private roads:PlanetRoads;
  private settlements:PlanetSettlements;
  private transport:PlanetTransport;
  private activity:PlanetActivity;
  private ecosystem:PlanetGrove;
  private clearedRevision=-1;
  private eventWorld:WorldEventState|null=null;
  setWorldEventState(world:WorldEventState){if(!this.eventWorld)this.clearedRevision=-1;this.eventWorld=world;this.activity.setWorldEventState(world);}
  setExpeditionActive(active:boolean){this.transport.setExpeditionActive(active);}
  cropClearance: (point:RoadPoint,radius:number)=>boolean=()=>false;
  roadClearance: (point:RoadPoint,radius:number)=>boolean=()=>false;
  private dressing:{mesh:THREE.InstancedMesh;matrices:Float32Array;sites:THREE.Vector3[];radius:number}[]=[];
  private heights=createPlanetHeightTexture();
  private reduced=matchMedia('(prefers-reduced-motion: reduce)');
  private geometry=new Set<THREE.BufferGeometry>();
  private materials=new Set<THREE.Material>();
  constructor(scene:THREE.Scene,private mobile:boolean){
    this.clouds=new PlanetClouds(mobile);
    this.roads=new PlanetRoads(this.group,mobile);this.settlements=new PlanetSettlements(this.group);this.transport=new PlanetTransport(this.group,mobile);this.activity=new PlanetActivity(this.group,mobile);
    this.group.name='Native planet landscape';this.group.userData.planetNative=true;scene.add(this.group);
    const geo=this.own(new THREE.SphereGeometry(1,mobile?320:576,mobile?192:384));
    const p=geo.getAttribute('position'),n=new THREE.Vector3();
    for(let i=0;i<p.count;i++){
      n.fromBufferAttribute(p,i).normalize();const h=planetElevation(n);
      n.multiplyScalar(R+h);p.setXYZ(i,n.x,n.y,n.z);
    }
    geo.computeVertexNormals();
    this.terrain=new THREE.Mesh(geo,this.mat(createPlanetTerrainMaterial()));
    this.terrain.name='Continents, beaches and mountain ranges';this.terrain.receiveShadow=true;this.terrain.castShadow=true;this.group.add(this.terrain);this.paint(0);
    const waterMaterial=this.mat(createPlanetOceanMaterial(this.heights));
    this.water=new THREE.Mesh(this.own(new THREE.SphereGeometry(R,mobile?128:224,128)),waterMaterial);
    this.water.name='Permanent planet ocean';this.water.receiveShadow=true;this.group.add(this.water);
    this.group.add(this.clouds.group);this.ecosystem=new PlanetGrove(this.group,mobile);this.buildRocks();this.buildStars();this.buildAtmosphere();this.markNative();
  }
  private own<T extends THREE.BufferGeometry>(geometry:T){this.geometry.add(geometry);return geometry;}
  private mat<T extends THREE.Material>(material:T){this.materials.add(material);return material;}
  private markNative(){this.group.traverse(o=>o.userData.planetNative=true);}
  private paint(level:number){
    const material=this.terrain.material as THREE.Material;
    material.userData.water.value=1;
    material.userData.lush.value=level/8;
    material.userData.groveOrigin.value.copy(surfaceNormal(GROVE_ORIGIN.x,GROVE_ORIGIN.z));
    const reaches=[0,5,12,27,50,85,130,190,275];
    const low=Math.floor(level),high=Math.min(8,low+1);
    material.userData.groveReach.value=THREE.MathUtils.lerp(reaches[low],reaches[high],level-low);
  }
  private buildRocks(){
    const geometry=this.own(new THREE.IcosahedronGeometry(1,1));
    const position=geometry.getAttribute('position');
    for(let i=0;i<position.count;i++){
      const x=position.getX(i),y=position.getY(i),z=position.getZ(i);
      const shape=1+Math.sin(x*7+z*4)*.08+Math.cos(y*9-x*2)*.06;
      position.setXYZ(i,x*shape,y*shape,z*shape);
    }
    geometry.computeVertexNormals();
    const sites:THREE.Vector3[]=[];
    for(let i=0;i<(this.mobile?650:1100);i++){
      const n=globeDirection(Math.asin(rand(i+23200)*2-1),rand(i+27600)*Math.PI*2),h=planetElevation(n);
      if((h>.12&&h<1.15||h>4&&h<10)&&!TOWN_SITES.some(site=>site.dot(n)>.998))sites.push(n);
    }
    const rocks=new THREE.InstancedMesh(geometry,this.mat(new THREE.MeshStandardMaterial({roughness:1,color:0xffffff})),sites.length);
    const dummy=new THREE.Object3D(),color=new THREE.Color();
    sites.forEach((n,i)=>{
      const size=.5+rand(i+928)*1.1;
      dummy.position.copy(n).multiplyScalar(R+planetElevation(n)+size*.18);
      dummy.quaternion.setFromUnitVectors(UP,n);dummy.rotateY(rand(i+980)*Math.PI*2);
      dummy.scale.set(size*(1+rand(i)*.6),size*(.45+rand(i+7)*.65),size);dummy.updateMatrix();rocks.setMatrixAt(i,dummy.matrix);
      color.set(0x85877b).lerp(new THREE.Color(0xc6b99a),rand(i+273));rocks.setColorAt(i,color);
    });
    this.dressing.push({mesh:rocks,matrices:new Float32Array(rocks.instanceMatrix.array),sites,radius:2.6});
    rocks.name='Coastal boulders and alpine scree';rocks.castShadow=true;rocks.receiveShadow=true;this.group.add(rocks);
  }
  private buildStars(){
    const p:number[]=[];
    for(let i=0;i<950;i++){const n=globeDirection(Math.asin(rand(i+7000)*2-1),rand(i+8000)*Math.PI*2).multiplyScalar(950);p.push(n.x,n.y,n.z);}
    const geo=this.own(new THREE.BufferGeometry());geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
    const stars=new THREE.Points(geo,this.mat(new THREE.PointsMaterial({color:0xf3deff,size:1.7,transparent:true,opacity:.7})));stars.name='Space stars';this.group.add(stars);
  }
  private buildAtmosphere(){
    // A shallow shell behind the surface adds air only around the silhouette.
    // Fade both ends of the band so it never reads as a hard neon outline.
    const material=this.mat(new THREE.ShaderMaterial({
      transparent:true,side:THREE.BackSide,depthWrite:false,toneMapped:false,
      uniforms:{sunDirection:ATMOSPHERE.sunDirection,tint:{value:new THREE.Color(0xa3d4ef)}},
      vertexShader:`varying vec3 worldPosition;
        void main(){
          vec4 p=modelMatrix*vec4(position,1.0);
          worldPosition=p.xyz;
          gl_Position=projectionMatrix*viewMatrix*p;
        }`,
      fragmentShader:`uniform vec3 sunDirection;uniform vec3 tint;
        varying vec3 worldPosition;
        void main(){
          vec3 ray=normalize(worldPosition-cameraPosition);
          vec3 closest=cameraPosition-ray*dot(cameraPosition,ray);
          float altitude=length(closest)-${R.toFixed(1)};
          float inner=smoothstep(-1.0,1.5,altitude);
          float outer=1.0-smoothstep(1.0,7.0,altitude);
          float sunlight=smoothstep(-.6,.8,dot(normalize(closest),sunDirection));
          float opacity=inner*outer*mix(.065,.16,sunlight);
          gl_FragColor=vec4(tint,opacity);
          #include <colorspace_fragment>
        }`,
    }));
    const shell=new THREE.Mesh(this.own(new THREE.SphereGeometry(R+7,128,80)),material);
    shell.name='Soft atmospheric rim';shell.renderOrder=1;
    this.group.add(shell);
  }
  update(snapshot:TownSnapshot,animate:boolean){
    const grove=snapshot.groveLevel??0;
    this.ecosystem.setLevel(grove,!animate||this.reduced.matches);
    this.roads.update(snapshot);this.settlements.update(snapshot);this.transport.update(snapshot,animate&&!this.reduced.matches);this.activity.update(snapshot,this.roads.segments,this.roads.revision);
    if(this.clearedRevision!==this.roads.revision){
      this.clearedRevision=this.roads.revision;
      const roadBlocked=planetRoadClearance(snapshot,this.roads.segments);
      const blocked=this.roadClearance=(point,radius)=>roadBlocked(point,radius)||!!this.eventWorld&&Object.values(WORLD_EVENT_SITES).some(site=>Math.hypot(site.x-point.x,site.z-point.z)<radius+5);
      this.cropClearance=planetRoadClearance(snapshot,this.roads.segments,false);
      this.ecosystem.setClearance(blocked);
      for(const {mesh,matrices,sites,radius} of this.dressing){
        mesh.instanceMatrix.array.set(matrices);
        sites.forEach((n,i)=>{
          // Inverse stereographic projection puts vegetation in the same space as paths.
          if(n.y<-.5)return;
          const scale=(1+n.y)/2,x=R*n.x/scale,z=R*n.z/scale;
          if(blocked({x,z},radius/scale))mesh.instanceMatrix.array.fill(0,i*16,i*16+12);
        });
        mesh.instanceMatrix.needsUpdate=true;
      }
    }
    this.clouds.update(true,snapshot.weather,!animate||this.reduced.matches);
  }
  render(now:number){
    (this.water.material as THREE.Material).userData.time.value=this.reduced.matches?0:now/1000;
    this.ecosystem.render(now,this.reduced.matches);this.paint(this.ecosystem.level);
    this.clouds.render(now,this.reduced.matches);this.transport.render(now,this.reduced.matches);this.activity.render(now,this.reduced.matches);this.settlements.render(now,this.reduced.matches);
  }
  dispose(){this.activity.dispose();this.transport.dispose();this.ecosystem.dispose();this.settlements.dispose();this.roads.dispose();this.clouds.dispose();this.geometry.forEach(g=>g.dispose());this.materials.forEach(m=>m.dispose());this.heights.dispose();this.group.removeFromParent();}
}
