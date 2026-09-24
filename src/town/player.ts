import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { moveWithCollisions, type Collider } from './collision';
import { terrainHeight } from './environment';

const BODY=new RoundedBoxGeometry(1,1,1,3,.21);
const BOOT=new RoundedBoxGeometry(1,1,1,3,.17);
const ROUND=new THREE.SphereGeometry(1,12,10);
const PAINT={
  skin:new THREE.MeshStandardMaterial({color:0xd9a481,roughness:.91}),
  cream:new THREE.MeshStandardMaterial({color:0xe6caaa,roughness:.94}),
  tunic:new THREE.MeshStandardMaterial({color:0x497b80,roughness:.91}),
  tunicShade:new THREE.MeshStandardMaterial({color:0x315c63,roughness:.95}),
  trousers:new THREE.MeshStandardMaterial({color:0x665b61,roughness:.94}),
  boots:new THREE.MeshStandardMaterial({color:0x5e483e,roughness:.89}),
  leather:new THREE.MeshStandardMaterial({color:0x98704d,roughness:.9}),
  hair:new THREE.MeshStandardMaterial({color:0x4a3933,roughness:.98}),
  eyes:new THREE.MeshStandardMaterial({color:0x23343c,roughness:.85}),
  white:new THREE.MeshStandardMaterial({color:0xfff5e5,roughness:.9}),
  brass:new THREE.MeshStandardMaterial({color:0xd8b16e,roughness:.64,metalness:.12}),
  scarf:new THREE.MeshStandardMaterial({color:0xc88468,roughness:.94}),
};
function part(parent:THREE.Object3D,geo:THREE.BufferGeometry,mat:THREE.Material,x:number,y:number,z:number,sx:number,sy:number,sz:number){
  const mesh=new THREE.Mesh(geo,mat);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
interface Limb { root:THREE.Group;knee:THREE.Group;foot:THREE.Group; }

export class Player {
  readonly group=new THREE.Group();
  readonly position={x:8,z:11};
  private velocity={x:0,z:0};
  private time=0;
  private phase=0;
  private gait=0;
  private torso=new THREE.Group();
  private head=new THREE.Group();
  private scarfTail=new THREE.Group();
  private legs:Limb[]=[];
  private arms:THREE.Group[]=[];
  constructor(scene:THREE.Scene){
    this.group.name='Town walker';this.group.visible=false;
    this.torso.position.y=1.61;this.group.add(this.torso);
    part(this.torso,BODY,PAINT.tunic,0,0,0,.82,1.13,.62);
    part(this.torso,BODY,PAINT.tunicShade,0,-.39,.02,.88,.39,.65);
    part(this.torso,BODY,PAINT.cream,0,.29,.34,.57,.43,.12);
    part(this.torso,BODY,PAINT.leather,0,-.43,.35,.86,.15,.13);
    part(this.torso,BODY,PAINT.brass,0,-.43,.43,.17,.17,.07);
    part(this.torso,BODY,PAINT.leather,-.42,-.34,-.29,.37,.53,.25);
    part(this.torso,BODY,PAINT.brass,-.48,-.08,-.43,.16,.09,.06);
    part(this.torso,BODY,PAINT.scarf,0,.55,.1,.73,.24,.57);
    this.scarfTail.position.set(.33,.54,-.31);this.torso.add(this.scarfTail);
    part(this.scarfTail,BODY,PAINT.scarf,0,-.29,0,.23,.65,.12);

    this.head.position.y=2.39;this.group.add(this.head);
    part(this.head,ROUND,PAINT.skin,0,.14,0,.49,.53,.46);
    part(this.head,ROUND,PAINT.hair,0,.51,-.07,.51,.23,.48);
    for(const side of [-1,1]){
      part(this.head,ROUND,PAINT.skin,side*.49,.11,0,.13,.17,.13);
      part(this.head,ROUND,PAINT.hair,side*.43,.36,-.05,.18,.23,.32);
      part(this.head,ROUND,PAINT.white,side*.19,.18,.429,.105,.095,.035);
      part(this.head,ROUND,PAINT.eyes,side*.19,.17,.462,.044,.065,.026);
      part(this.head,BODY,PAINT.hair,side*.19,.35,.425,.18,.039,.04);
    }
    part(this.head,ROUND,PAINT.hair,-.1,.47,.29,.31,.16,.2);
    part(this.head,ROUND,PAINT.skin,0,-.035,.463,.105,.1,.11);
    part(this.head,BODY,PAINT.hair,0,-.17,.43,.14,.026,.035);

    for(const side of [-1,1]){
      const root=new THREE.Group();root.position.set(side*.25,1.1,0);this.group.add(root);
      part(root,BODY,PAINT.trousers,0,-.25,0,.31,.65,.37);
      const knee=new THREE.Group();knee.position.y=-.52;root.add(knee);
      part(knee,BOOT,PAINT.trousers,0,-.22,.015,.29,.53,.34);
      const foot=new THREE.Group();foot.position.set(0,-.46,.095);knee.add(foot);
      part(foot,BOOT,PAINT.boots,0,0,.06,.41,.33,.59);
      part(foot,BODY,PAINT.leather,0,-.09,.2,.39,.08,.5);
      this.legs.push({root,knee,foot});
      const arm=new THREE.Group();arm.position.set(side*.55,2.04,0);this.group.add(arm);
      part(arm,BODY,PAINT.cream,side*.015,-.29,0,.31,.65,.35);
      part(arm,BODY,PAINT.tunic,side*.015,-.08,0,.37,.34,.42);
      part(arm,ROUND,PAINT.skin,side*.025,-.71,.04,.18,.18,.18);
      this.arms.push(arm);
    }
    this.group.scale.setScalar(1.08);
    scene.add(this.group);this.sync();
  }
  private sync(){this.group.position.set(this.position.x,terrainHeight(this.position.x,this.position.z)+.04,this.position.z);}
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
    const beforeX=this.position.x,beforeZ=this.position.z;
    const next=moveWithCollisions(this.position,{x:this.velocity.x*dt,z:this.velocity.z*dt},colliders,.82);
    if(Math.abs(next.x-beforeX)<.0001)this.velocity.x=0;
    if(Math.abs(next.z-beforeZ)<.0001)this.velocity.z=0;
    this.position.x=next.x;this.position.z=next.z;this.sync();
    const traveled=Math.hypot(next.x-beforeX,next.z-beforeZ);
    const actualSpeed=traveled/Math.max(dt,.001);
    this.gait=THREE.MathUtils.damp(this.gait,THREE.MathUtils.clamp(actualSpeed/6.8,0,1),12,dt);
    this.phase+=traveled*1.55;
    let turn=0;
    if(actualSpeed>.4){
      const desired=Math.atan2(this.velocity.x,this.velocity.z);
      turn=Math.atan2(Math.sin(desired-this.group.rotation.y),Math.cos(desired-this.group.rotation.y));
      this.group.rotation.y+=turn*Math.min(1,dt*10);
    }
    const bob=Math.abs(Math.sin(this.phase))*.055*this.gait;
    this.group.position.y+=bob+Math.sin(this.time*1.8)*.018*(1-this.gait);
    for(let i=0;i<2;i++){
      const step=Math.sin(this.phase+i*Math.PI),lift=Math.max(0,step);
      const limb=this.legs[i];
      limb.root.rotation.x=step*.57*this.gait;
      limb.knee.rotation.x=lift*.28*this.gait;
      limb.foot.rotation.x=(-step*.27-lift*.18)*this.gait;
      limb.root.position.y=1.1+lift*.08*this.gait;
      this.arms[i].rotation.x=-step*.48*this.gait;
      this.arms[i].rotation.z=(i===0?-.08:.08)+Math.sin(this.time*1.3+i)*.025;
    }
    this.torso.rotation.x=this.gait*.06;
    this.torso.rotation.z=Math.sin(this.phase)*.035*this.gait-THREE.MathUtils.clamp(turn,-.2,.2)*.22;
    this.head.rotation.z=-this.torso.rotation.z*.5;
    this.head.rotation.y=Math.sin(this.time*.9)*.065*(1-this.gait);
    this.scarfTail.rotation.x=-.13+Math.sin(this.phase+.8)*.13*this.gait;
  }
}
