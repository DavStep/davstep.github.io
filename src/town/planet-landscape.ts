import * as THREE from 'three';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
import { createFirGeometry } from './planet-assets';
import { createPlanetTerrainMaterial, createPlanetOceanMaterial } from './planet-materials';
import { PLANET_RADIUS as R, planetElevation, globeDirection, TOWN_SITES, createPlanetHeightTexture } from './planet-geography';
import type { TownSnapshot } from './model';
import { planetRoadRadius } from './planet-placement';
import { PlanetClouds } from './planet-clouds';
const rand=(n:number)=>{const v=Math.sin(n*127.1+311.7)*43758.5453123;return v-Math.floor(v);};
const UP=new THREE.Vector3(0,1,0);

/** Native spherical geography. It has no valley mesh or inherited mountain ring. */
export class PlanetLandscape {
  readonly group=new THREE.Group();
  private water:THREE.Mesh;
  private terrain:THREE.Mesh;
  private clouds:PlanetClouds;
  private roads=new THREE.Group();
  private forest:THREE.InstancedMesh[]=[];
  private forestTotal=0;
  private heights=createPlanetHeightTexture();
  private waterOn=false;
  private grove=-1;
  private roadLevel=-1;
  private waterStart=0;
  private reduced=matchMedia('(prefers-reduced-motion: reduce)');
  private geometry=new Set<THREE.BufferGeometry>();
  private materials=new Set<THREE.Material>();
  private roadMaterial?:THREE.MeshStandardMaterial;
  private roadMarkings?:THREE.MeshStandardMaterial;
  private treeGrowth=0;
  private treeTarget=0;
  constructor(scene:THREE.Scene,private mobile:boolean){
    this.clouds=new PlanetClouds(mobile);
    this.group.name='Native planet landscape';this.group.userData.planetNative=true;scene.add(this.group);
    const geo=this.own(new THREE.SphereGeometry(1,mobile?320:576,mobile?192:384));
    const p=geo.getAttribute('position'),n=new THREE.Vector3();
    for(let i=0;i<p.count;i++){
      n.fromBufferAttribute(p,i).normalize();const h=planetElevation(n);
      n.multiplyScalar(R+h);p.setXYZ(i,n.x,n.y,n.z);
    }
    geo.computeVertexNormals();
    this.terrain=new THREE.Mesh(geo,this.mat(createPlanetTerrainMaterial()));
    this.terrain.name='Continents, beaches and mountain ranges';this.terrain.receiveShadow=true;this.terrain.castShadow=true;this.group.add(this.terrain);this.paint(false);
    const waterMaterial=this.mat(createPlanetOceanMaterial(this.heights));
    this.water=new THREE.Mesh(this.own(new THREE.SphereGeometry(R,mobile?128:224,128)),waterMaterial);
    this.water.name='Player-placed ocean';this.water.visible=false;this.water.receiveShadow=true;this.group.add(this.water);
    this.group.add(this.clouds.group,this.roads);this.buildForest();this.buildRocks();this.buildStars();this.buildAtmosphere();this.markNative();
  }
  private own<T extends THREE.BufferGeometry>(geometry:T){this.geometry.add(geometry);return geometry;}
  private mat<T extends THREE.Material>(material:T){this.materials.add(material);return material;}
  private markNative(){this.group.traverse(o=>o.userData.planetNative=true);}
  private paint(lush:boolean){
    const material=this.terrain.material as THREE.Material;
    material.userData.water.value=this.waterOn?1:0;
    material.userData.lush.value=lush?1:0;
  }
  private buildForest(){
    const sites:THREE.Vector3[]=[];
    const noise=new ImprovedNoise();
    for(let i=0;i<(this.mobile?7000:14500);i++){
      const n=globeDirection(Math.asin(rand(i*3+600)*2-1),rand(i*3+601)*Math.PI*2);
      const h=planetElevation(n),patch=noise.noise(n.x*13,n.y*13,n.z*13);
      if(h<.95||h>8||patch<-.22||TOWN_SITES.some(site=>n.dot(site)>.9978))continue;
      sites.push(n);
    }
    this.forestTotal=sites.length;
    const trunk=new THREE.InstancedMesh(this.own(new THREE.CylinderGeometry(.095,.17,.9,6)),this.mat(new THREE.MeshStandardMaterial({color:0x71563b,roughness:1})),sites.length);
    const crown=new THREE.InstancedMesh(this.own(createFirGeometry()),this.mat(new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:1})),sites.length);
    const dummy=new THREE.Object3D(),q=new THREE.Quaternion(),color=new THREE.Color();
    sites.forEach((n,i)=>{
      const size=.6+rand(i+12000)*.85,base=n.clone().multiplyScalar(R+planetElevation(n));
      q.setFromUnitVectors(UP,n);dummy.quaternion.copy(q);dummy.rotateY(rand(i+8200)*Math.PI*2);
      dummy.position.copy(base).addScaledVector(n,.3*size);dummy.scale.set(size,size,size);dummy.updateMatrix();trunk.setMatrixAt(i,dummy.matrix);
      dummy.position.copy(base);dummy.scale.set(size,size*(.9+rand(i+300)*.3),size);dummy.updateMatrix();crown.setMatrixAt(i,dummy.matrix);
      color.setHSL(.26+rand(i)*.085,.4+rand(i+20)*.16,.33+rand(i+50)*.13);crown.setColorAt(i,color);
    });
    for(const mesh of [trunk,crown]){mesh.castShadow=true;mesh.receiveShadow=true;mesh.count=0;mesh.frustumCulled=false;this.group.add(mesh);this.forest.push(mesh);}
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
    rocks.name='Coastal boulders and alpine scree';rocks.castShadow=true;rocks.receiveShadow=true;this.group.add(rocks);
  }
  private buildStars(){
    const p:number[]=[];
    for(let i=0;i<950;i++){const n=globeDirection(Math.asin(rand(i+7000)*2-1),rand(i+8000)*Math.PI*2).multiplyScalar(950);p.push(n.x,n.y,n.z);}
    const geo=this.own(new THREE.BufferGeometry());geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
    const stars=new THREE.Points(geo,this.mat(new THREE.PointsMaterial({color:0xf3deff,size:1.7,transparent:true,opacity:.7})));stars.name='Space stars';this.group.add(stars);
  }
  private buildAtmosphere(){
    const material=this.mat(new THREE.ShaderMaterial({transparent:true,side:THREE.BackSide,depthWrite:false,blending:THREE.AdditiveBlending,
      vertexShader:'varying vec3 n; varying vec3 v; void main(){vec4 p=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);v=normalize(-p.xyz);gl_Position=projectionMatrix*p;}',
      fragmentShader:'varying vec3 n; varying vec3 v; void main(){float edge=pow(1.-abs(dot(normalize(n),normalize(v))),3.);gl_FragColor=vec4(.2,.52,1.,edge*.12);}'
    }));this.group.add(new THREE.Mesh(this.own(new THREE.SphereGeometry(R+2,128,80)),material));
  }
  private buildRoads(level:number){
    this.roads.traverse(o=>{if(o instanceof THREE.Mesh){this.geometry.delete(o.geometry);o.geometry.dispose();}});this.roads.clear();if(!level)return;
    const roadMaterial=this.roadMaterial??=this.mat(new THREE.MeshStandardMaterial({color:0x514b51,roughness:.95,side:THREE.DoubleSide}));
    const markings=this.roadMarkings??=this.mat(new THREE.MeshStandardMaterial({color:0xe9d29e,roughness:1,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}));
    for(let ring=0;ring<(level>=3?3:level>=2?2:1);ring++){
      const positions:number[]=[],lines:number[]=[],count=720,axis=new THREE.Vector3(0,0,1),tilt=[.28,-.62,1.06][ring];
      const point=(a:number,offset:number,lift:number)=>{
        const n=new THREE.Vector3(Math.cos(a),offset/R,Math.sin(a)).normalize().applyAxisAngle(axis,tilt);
        return n.multiplyScalar(planetRoadRadius(R,planetElevation(n),ring)+lift);
      };
      for(let i=0;i<count;i++){
        const a=i/count*Math.PI*2,b=(i+1)/count*Math.PI*2;
        const emit=(target:number[],width:number,lift:number)=>{
          const p=[point(a,-width/2,lift),point(a,width/2,lift),point(b,-width/2,lift),point(b,width/2,lift)];
          for(const k of [0,1,2,2,1,3])target.push(...p[k].toArray());
        };
        emit(positions,2,0);if(i%8<4)emit(lines,.13,.055);
      }
      for(const [positionsArray,material] of [[positions,roadMaterial],[lines,markings]] as const){
        const geo=this.own(new THREE.BufferGeometry());geo.setAttribute('position',new THREE.Float32BufferAttribute(positionsArray,3));geo.computeVertexNormals();
        const mesh=new THREE.Mesh(geo,material);mesh.receiveShadow=true;mesh.castShadow=material===roadMaterial;this.roads.add(mesh);
      }
    }this.markNative();
  }
  update(snapshot:TownSnapshot,animate:boolean){
    const water=(snapshot.riverLevel??0)>0;
    if(water!==this.waterOn){this.waterOn=water;this.water.visible=water;this.waterStart=water&&animate&&!this.reduced.matches?performance.now():0;this.paint(this.grove>0);}
    const grove=snapshot.groveLevel??0;
    if(this.grove!==grove){this.grove=grove;this.treeTarget=grove/8;if(!animate||this.reduced.matches)this.treeGrowth=this.treeTarget;this.paint(grove>0);}
    const roads=snapshot.roads===0?0:snapshot.roads<20?1:snapshot.roads<36?2:3;
    if(roads!==this.roadLevel){this.roadLevel=roads;this.buildRoads(roads);}
    this.clouds.update(water,snapshot.weather,!animate||this.reduced.matches);
    if(!animate)this.waterStart=0;
  }
  render(now:number){
    if(this.waterOn){const t=this.waterStart?Math.min(1,(now-this.waterStart)/1600):1;this.water.scale.setScalar(1-.08*Math.pow(1-t,3));}
    (this.water.material as THREE.Material).userData.time.value=this.reduced.matches?0:now/1000;
    this.treeGrowth+=(this.treeTarget-this.treeGrowth)*.06;
    this.forest[0].count=Math.floor(this.forestTotal*this.treeGrowth);this.forest[1].count=this.forest[0].count;
    this.clouds.render(now,this.reduced.matches);
  }
  dispose(){this.clouds.dispose();this.geometry.forEach(g=>g.dispose());this.materials.forEach(m=>m.dispose());this.heights.dispose();this.group.removeFromParent();}
}
