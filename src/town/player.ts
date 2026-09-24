import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { moveWithCollisions, type Collider } from './collision';
import { terrainHeight } from './environment';

const bodyGeo=new RoundedBoxGeometry(1,1,1,3,.22);
const roundGeo=new THREE.IcosahedronGeometry(1,2);
const bootGeo=new RoundedBoxGeometry(1,1,1,2,.12);
const paint={
  skin:new THREE.MeshStandardMaterial({color:0xdba985,roughness:.94}),
  shirt:new THREE.MeshStandardMaterial({color:0x477b79,roughness:.9}),
  coat:new THREE.MeshStandardMaterial({color:0x315a60,roughness:.93}),
  pants:new THREE.MeshStandardMaterial({color:0x665c63,roughness:.95}),
  boots:new THREE.MeshStandardMaterial({color:0x59473c,roughness:.92}),
  hair:new THREE.MeshStandardMaterial({color:0x463833,roughness:1}),
  eyes:new THREE.MeshStandardMaterial({color:0x242d30,roughness:1}),
  bag:new THREE.MeshStandardMaterial({color:0x9b704d,roughness:.95}),
  gold:new THREE.MeshStandardMaterial({color:0xd8ad62,roughness:.8}),
};

function piece(parent:THREE.Object3D,geo:THREE.BufferGeometry,mat:THREE.Material,x:number,y:number,z:number,sx:number,sy:number,sz:number){
  const mesh=new THREE.Mesh(geo,mat);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}

export class Player {
  readonly group=new THREE.Group();
  readonly position={x:8,z:11};
  private velocity={x:0,z:0};
  private time=0;
  private leftLeg=new THREE.Group();
  private rightLeg=new THREE.Group();
  private leftArm=new THREE.Group();
  private rightArm=new THREE.Group();
  private head=new THREE.Group();
  constructor(scene:THREE.Scene){
    this.group.name='Town walker';this.group.visible=false;
    piece(this.group,bodyGeo,paint.coat,0,1.65,0,.87,1.18,.59);
    piece(this.group,bodyGeo,paint.shirt,0,1.93,.32,.58,.44,.11);
    piece(this.group,bodyGeo,paint.bag,0,1.47,-.44,.65,.81,.32);
    piece(this.group,bodyGeo,paint.gold,0,1.6,-.62,.25,.19,.07);
    this.head.position.set(0,2.46,0);this.group.add(this.head);
    piece(this.head,roundGeo,paint.skin,0,.16,0,.49,.55,.47);
    piece(this.head,roundGeo,paint.hair,0,.52,-.06,.53,.22,.49);
    piece(this.head,roundGeo,paint.hair,-.43,.36,0,.18,.27,.34);
    piece(this.head,roundGeo,paint.hair,.43,.36,0,.18,.27,.34);
    for(const side of [-1,1]){
      piece(this.head,roundGeo,paint.eyes,side*.19,.19,.448,.055,.074,.035);
      piece(this.head,roundGeo,paint.skin,side*.49,.12,0,.12,.17,.16);
    }
    piece(this.head,roundGeo,paint.skin,0,-.06,.49,.11,.1,.12);
    for(const [pivot,side] of [[this.leftLeg,-1],[this.rightLeg,1]] as const){
      pivot.position.set(side*.25,1.08,0);this.group.add(pivot);
      piece(pivot,bootGeo,paint.pants,0,-.49,0,.32,1.03,.34);
      piece(pivot,bootGeo,paint.boots,0,-1.02,.13,.39,.32,.56);
    }
    for(const [pivot,side] of [[this.leftArm,-1],[this.rightArm,1]] as const){
      pivot.position.set(side*.59,2.06,0);this.group.add(pivot);
      piece(pivot,bodyGeo,paint.shirt,side*.06,-.35,0,.3,.76,.36);
      piece(pivot,roundGeo,paint.skin,side*.08,-.82,.04,.18,.19,.19);
    }
    this.group.scale.setScalar(1.15);
    scene.add(this.group);this.sync();
  }
  private sync(){this.group.position.set(this.position.x,terrainHeight(this.position.x,this.position.z),this.position.z);}
  setVisible(value:boolean){this.group.visible=value;if(!value)this.velocity={x:0,z:0};}
  update(dt:number,input:{x:number;z:number;sprint:boolean},azimuth:number,colliders:readonly Collider[]){
    if(!this.group.visible)return;
    dt=Math.min(dt,.05);this.time+=dt;
    const len=Math.hypot(input.x,input.z),ix=len?input.x/Math.max(1,len):0,iz=len?input.z/Math.max(1,len):0;
    const speed=input.sprint?11.5:7.2;
    const dx=(Math.sin(azimuth)*ix-Math.cos(azimuth)*iz)*speed;
    const dz=(-Math.cos(azimuth)*ix-Math.sin(azimuth)*iz)*speed;
    const damping=1-Math.exp(-dt*(len?11:8));
    this.velocity.x+=(dx-this.velocity.x)*damping;this.velocity.z+=(dz-this.velocity.z)*damping;
    const next=moveWithCollisions(this.position,{x:this.velocity.x*dt,z:this.velocity.z*dt},colliders,.82);
    if(Math.abs(next.x-this.position.x)<.0001)this.velocity.x=0;
    if(Math.abs(next.z-this.position.z)<.0001)this.velocity.z=0;
    this.position.x=next.x;this.position.z=next.z;this.sync();
    const moving=Math.hypot(this.velocity.x,this.velocity.z)>1;
    if(moving){
      const desired=Math.atan2(this.velocity.x,this.velocity.z);
      const delta=Math.atan2(Math.sin(desired-this.group.rotation.y),Math.cos(desired-this.group.rotation.y));
      this.group.rotation.y+=delta*Math.min(1,dt*10);
    }
    const stride=moving?Math.sin(this.time*(input.sprint?16:11))*.58:0;
    this.leftLeg.rotation.x=stride;this.rightLeg.rotation.x=-stride;
    this.leftArm.rotation.x=-stride*.75;this.rightArm.rotation.x=stride*.75;
    this.head.rotation.y=moving?Math.sin(this.time*1.8)*.035:Math.sin(this.time*.7)*.1;
    this.group.position.y+=moving?Math.abs(Math.sin(this.time*11))*.09:Math.sin(this.time*1.8)*.028;
  }
}
