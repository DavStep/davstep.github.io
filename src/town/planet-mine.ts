import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PLANET_RADIUS,planetElevation } from './planet-geography';

/** The two sides of the loop share a loading mouth and an unloading platform. */
export function minecartTrip(time:number,offset=0){
  const t=((time+offset)%34+34)%34;
  const angle=t<2?0:t<16?(t-2)/14*Math.PI:t<19?Math.PI:Math.PI+(t-19)/15*Math.PI;
  return {angle,loaded:t<17.5,moving:t>=2&&t<16||t>=19,unloading:t>=16&&t<19};
}
export function mineRailPoint(angle:number){return new THREE.Vector3(1.9*Math.sin(angle),.24,5.4-6*Math.cos(angle));}

/** Owned by the mine camp: rails, carts and miners share its spherical placement. */
export class PlanetMine{
  readonly group=new THREE.Group();
  private geometry=new Set<THREE.BufferGeometry>();
  private box=this.own(new THREE.BoxGeometry(1,1,1));
  private rock=this.own(new THREE.IcosahedronGeometry(1,0));
  private wheel=this.own(new THREE.CylinderGeometry(.24,.24,.13,10));
  private paints={wood:new THREE.MeshStandardMaterial({color:0x8f643d,roughness:.95}),iron:new THREE.MeshStandardMaterial({color:0x49575e,metalness:.45,roughness:.55}),
    ore:new THREE.MeshStandardMaterial({color:0x77c8d2,metalness:.25,roughness:.5}),skin:new THREE.MeshStandardMaterial({color:0xe4ac78,roughness:1}),
    beard:new THREE.MeshStandardMaterial({color:0xe0c89a,roughness:1}),coat:new THREE.MeshStandardMaterial({color:0x417d86,roughness:1}),
    helmet:new THREE.MeshStandardMaterial({color:0xe8ae3f,roughness:.65}),stone:new THREE.MeshStandardMaterial({color:0x7d8992,roughness:1})};
  private carts:{root:THREE.Group;load:THREE.Group;wheels:THREE.Group[];offset:number}[]=[];
  private miners:{root:THREE.Group;arm:THREE.Group;chips:THREE.Group;offset:number}[]=[];
  private last:number|null=null;
  private time=0;
  constructor(camp:THREE.Group,level:number){
    this.group.name='Working dwarven railway';camp.add(this.group);camp.updateMatrixWorld(true);
    const track=new THREE.Group();track.name='Mountain rail loop';this.group.add(track);
    for(const side of [-1,1]){
      const points=Array.from({length:129},(_,i)=>{const a=i/128*Math.PI*2,p=mineRailPoint(a),tangent=new THREE.Vector3(1.9*Math.cos(a),0,6*Math.sin(a)).normalize();return p.add(new THREE.Vector3(tangent.z,0,-tangent.x).multiplyScalar(side*.43));});
      const mesh=new THREE.Mesh(this.own(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.slice(0,-1),true),160,.055,5,true)),this.paints.iron);mesh.castShadow=true;track.add(mesh);
    }
    for(let i=0;i<64;i++){
      const a=i/64*Math.PI*2,p=mineRailPoint(a),yaw=Math.atan2(1.9*Math.cos(a),6*Math.sin(a));
      const tie=this.block(track,p.x,.12,p.z,1.25,.15,.19,'wood');tie.rotation.y=yaw;
      if(i%4===0){
        const world=camp.localToWorld(new THREE.Vector3(p.x,0,p.z)),normal=world.clone().normalize();
        const ground=camp.worldToLocal(normal.multiplyScalar(PLANET_RADIUS+planetElevation(normal))).y;
        const depth=Math.max(.15,.08-ground);this.block(track,p.x,.08-depth/2,p.z,1,.15+depth,.35,'stone');
      }
    }
    this.block(track,2.7,.12,10,1.3,.25,2.8,'wood');
    for(let i=0;i<5;i++){const chunk=new THREE.Mesh(this.rock,this.paints.ore);chunk.position.set(2.7+(i%2)*.35,.45+Math.floor(i/2)*.16,9.3+(i%3)*.45);chunk.scale.set(.38,.3,.4);track.add(chunk);}
    this.bake(track);
    if(level>=3)for(let i=0;i<(level>=8?2:1);i++)this.makeCart(i*17);
    for(let i=0;i<(level>=8?3:level>=5?2:1);i++)this.makeMiner(i);
    this.group.traverse(o=>o.userData.planetNative=true);
    this.render(0,true);this.last=null;
  }
  private own<T extends THREE.BufferGeometry>(g:T){this.geometry.add(g);return g;}
  private block(parent:THREE.Group,x:number,y:number,z:number,w:number,h:number,d:number,paint:keyof PlanetMine['paints']){
    const mesh=new THREE.Mesh(this.box,this.paints[paint]);mesh.position.set(x,y,z);mesh.scale.set(w,h,d);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  }
  /** Bake static pieces by material, leaving articulated limbs and wheels independent. */
  private bake(root:THREE.Group){
    const batches=new Map<THREE.Material,THREE.BufferGeometry[]>();
    for(const child of [...root.children])if(child instanceof THREE.Mesh){child.updateMatrix();const g=child.geometry.clone().applyMatrix4(child.matrix);g.deleteAttribute('uv');const flat=g.index?g.toNonIndexed():g;if(flat!==g)g.dispose();const paint=child.material as THREE.Material;const list=batches.get(paint)??[];list.push(flat);batches.set(paint,list);root.remove(child);}
    for(const [paint,parts] of batches){const g=mergeGeometries(parts)!;parts.forEach(p=>p.dispose());const mesh=new THREE.Mesh(this.own(g),paint);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);}
  }
  private makeCart(offset:number){
    const root=new THREE.Group(),load=new THREE.Group(),wheels:THREE.Group[]=[];root.name='Ore minecart';load.name='Cart ore load';root.add(load);this.group.add(root);
    this.block(root,0,.47,0,.88,.16,1.12,'iron');
    for(const x of [-.46,.46])this.block(root,x,.78,0,.1,.56,1.18,'wood');
    for(const z of [-.56,.56])this.block(root,0,.78,z,1,.56,.1,'wood');
    for(const x of [-.48,.48])for(const z of [-.5,.5])this.block(root,x,.79,z,.12,.67,.12,'iron');
    for(const x of [-.46,.46])for(const z of [-.37,.37]){
      const pivot=new THREE.Group();pivot.position.set(x,.29,z);const wheel=new THREE.Mesh(this.wheel,this.paints.iron);wheel.rotation.z=Math.PI/2;pivot.add(wheel);
      this.block(pivot,Math.sign(x)*.085,0,0,.03,.07,.4,'helmet');root.add(pivot);wheels.push(pivot);
    }
    for(let i=0;i<6;i++){const ore=new THREE.Mesh(this.rock,this.paints.ore);ore.position.set((i%2-.5)*.38,.87+Math.sin(i*4)*.12,(Math.floor(i/2)-1)*.3);ore.scale.set(.3,.27,.3);load.add(ore);}
    this.bake(root);this.bake(load);this.carts.push({root,load,wheels,offset});
  }
  private makeMiner(index:number){
    const root=new THREE.Group();root.name='Dwarf miner';root.position.set(3.5,0,4.2+index*1.7);root.rotation.y=Math.PI/2;this.group.add(root);
    const camp=this.group.parent!,world=camp.localToWorld(root.position.clone()),normal=world.clone().normalize();
    root.position.y=camp.worldToLocal(normal.multiplyScalar(PLANET_RADIUS+planetElevation(normal))).y+.04;
    for(const x of [-.2,.2])this.block(root,x,.18,.06,.29,.35,.42,'iron');
    this.block(root,0,.64,0,.75,.62,.45,'coat');this.block(root,0,1.12,0,.51,.46,.43,'skin');
    this.block(root,0,1.37,0,.64,.18,.57,'helmet');this.block(root,0,1.2,.27,.17,.14,.09,'helmet');
    this.block(root,0,.93,.27,.45,.39,.18,'beard');this.block(root,0,.72,.29,.22,.19,.14,'beard');
    for(const x of [-.14,.14])this.block(root,x,1.14,.226,.06,.06,.03,'iron');
    const arm=new THREE.Group();arm.position.set(.4,.92,0);root.add(arm);this.block(arm,0,-.2,.08,.24,.45,.25,'coat');this.block(arm,0,-.4,.15,.23,.18,.23,'skin');
    this.block(arm,0,-.26,.49,.08,.09,1,'wood');this.block(arm,0,-.26,.96,.72,.1,.14,'iron');this.bake(arm);this.bake(root);
    const seam=new THREE.Mesh(this.rock,this.paints.stone);seam.position.set(root.position.x+1.05,root.position.y+.6,root.position.z);seam.scale.set(.65,.85,.75);this.group.add(seam);
    const chips=new THREE.Group();chips.name='Pickaxe ore chips';chips.position.copy(seam.position);this.group.add(chips);
    for(let i=0;i<5;i++){const chip=new THREE.Mesh(this.rock,this.paints.ore);chip.scale.setScalar(.07);chips.add(chip);}
    this.miners.push({root,arm,chips,offset:index*.9});
  }
  render(now:number,reduced:boolean){
    const dt=this.last===null?0:Math.min(.1,Math.max(0,(now-this.last)/1000));this.last=now;if(!reduced)this.time+=dt;
    for(const cart of this.carts){
      const trip=minecartTrip(this.time,cart.offset);cart.root.position.copy(mineRailPoint(trip.angle));cart.root.rotation.y=Math.atan2(1.9*Math.cos(trip.angle),6*Math.sin(trip.angle));
      cart.root.visible=cart.root.position.z>-.2;cart.load.visible=trip.loaded;cart.root.userData.activity=trip.unloading?'unloading':trip.loaded?'hauling ore':'returning empty';
      if(!reduced&&trip.moving)cart.wheels.forEach(w=>w.rotation.x+=dt*3.5);
    }
    for(const miner of this.miners){
      const phase=((this.time+miner.offset)%2.4)/2.4;
      miner.arm.rotation.x=reduced?-.45:phase<.65?-1.7*phase/.65:-1.7+Math.min(1,(phase-.65)/.15)*2;
      miner.root.rotation.z=reduced?0:Math.sin(phase*Math.PI*2)*.06;
      const age=(phase-.8)*2.4;miner.chips.visible=!reduced&&age>=0&&age<.4;
      if(miner.chips.visible)miner.chips.children.forEach((chip,i)=>chip.position.set(Math.cos(i*2.4)*age*1.3,age*2-age*age*5,Math.sin(i*2.4)*age*1.3));
    }
  }
  dispose(){this.geometry.forEach(g=>g.dispose());Object.values(this.paints).forEach(m=>m.dispose());this.group.removeFromParent();}
}
