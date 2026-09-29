import * as THREE from 'three';
import type { TownSnapshot } from './model';
import { PLANET_RADIUS,planetElevation,surfaceNormal,MINING_SITE } from './planet-geography';
import { wallIsGate } from './wall-layout';
import { INFRASTRUCTURE } from './town-plan';

const height=(x:number,z:number)=>planetElevation(surfaceNormal(x,z));
export function wallFootprintSafe(x:number,z:number){
  const center=height(x,z);
  return center>.9&&center<5&&[[2,0],[-2,0],[0,2],[0,-2]].every(([dx,dz])=>{const edge=height(x+dx,z+dz);return edge>.8&&edge<5&&Math.abs(edge-center)<.65;});
}
export { MINING_SITE } from './planet-geography';
/** Native walls follow the same height field as their foundations and shorelines. */
export class PlanetSettlements{
  readonly group=new THREE.Group();
  private signature='';
  private geometry=new THREE.BoxGeometry(1,1,1);
  private paints={stone:new THREE.MeshStandardMaterial({color:0xb6ac93,roughness:1}),wood:new THREE.MeshStandardMaterial({color:0x876744,roughness:1}),dark:new THREE.MeshStandardMaterial({color:0x28272a,roughness:1}),ore:new THREE.MeshStandardMaterial({color:0x92b5ba,roughness:.7})};
  constructor(parent:THREE.Group){this.group.name='Terrain-safe defenses and mountain mine';parent.add(this.group);}
  private block(parent:THREE.Group,x:number,y:number,z:number,w:number,h:number,d:number,paint:keyof typeof this.paints){const mesh=new THREE.Mesh(this.geometry,this.paints[paint]);mesh.position.set(x,y,z);mesh.scale.set(w,h,d);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
  private place(x:number,z:number,name:string){const g=new THREE.Group(),normal=surfaceNormal(x,z);g.name=name;g.position.copy(normal).multiplyScalar(PLANET_RADIUS+height(x,z)+.06);g.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),normal);this.group.add(g);return g;}
  update(snapshot:TownSnapshot){
    const mine=snapshot.roadLevel??0;
    const signature=`${snapshot.innerWood}/${snapshot.innerStone}/${snapshot.outerWood}/${snapshot.wallGates}/${mine}`;
    if(signature===this.signature)return;this.signature=signature;
    this.group.traverse(o=>{if(o instanceof THREE.InstancedMesh)o.dispose();});this.group.clear();
    for(const [radius,wood,stone] of [[INFRASTRUCTURE.wall.innerRadius,snapshot.innerWood,snapshot.innerStone],[INFRASTRUCTURE.wall.outerRadius,snapshot.outerWood,0]]){
      const count=Math.ceil(radius*Math.PI*2/2);
      for(let i=0;i<count;i++){
        const angle=(i+.5)/count*Math.PI*2,sector=Math.floor(angle/(Math.PI*2)*32),x=Math.cos(angle)*radius,z=Math.sin(angle)*radius;
        if(sector>=wood||wallIsGate(sector,snapshot.wallGates)||!wallFootprintSafe(x,z))continue;
        const group=this.place(x,z,'Dry wall section');
        const a=surfaceNormal(Math.cos(angle-.001)*radius,Math.sin(angle-.001)*radius),b=surfaceNormal(Math.cos(angle+.001)*radius,Math.sin(angle+.001)*radius);
        const up=surfaceNormal(x,z),tangent=b.sub(a).normalize(),across=new THREE.Vector3().crossVectors(tangent,up).normalize();
        group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(tangent,up,across));
        const localScale=1/(1+radius*radius/(4*PLANET_RADIUS*PLANET_RADIUS));
        const isStone=sector<stone,h=isStone?4:2.8,length=radius*Math.PI*2/count*localScale+.12;
        this.block(group,0,h/2,0,length,h,.85,isStone?'stone':'wood');
        this.block(group,0,h+.28,0,isStone?.9:.22,.56,isStone?1:.9,isStone?'stone':'wood');
      }
      // Adjacent gate sectors form one opening, including the pair across sector 31/0.
      const sectors=INFRASTRUCTURE.wall.segments;
      for(let start=0;start<sectors;start++){
        const previous=(start+sectors-1)%sectors;
        if(start>=wood||previous>=wood||!wallIsGate(start,snapshot.wallGates)||wallIsGate(previous,snapshot.wallGates))continue;
        let span=1;
        while(span<sectors&&wallIsGate((start+span)%sectors,snapshot.wallGates))span++;
        const next=(start+span)%sectors;
        if(next>=wood||Array.from({length:span},(_,i)=>(start+i)%sectors).some(i=>i>=wood))continue;
        const angles=[start,start+span].map(i=>i/sectors*Math.PI*2);
        const feet=angles.map(angle=>({x:Math.cos(angle)*radius,z:Math.sin(angle)*radius}));
        if(!feet.every(p=>wallFootprintSafe(p.x,p.z)))continue;
        const angle=(start+span/2)/sectors*Math.PI*2;
        const gate=this.place(Math.cos(angle)*radius,Math.sin(angle)*radius,'Town gate');
        const up=surfaceNormal(Math.cos(angle)*radius,Math.sin(angle)*radius);
        const tangent=surfaceNormal(feet[1].x,feet[1].z).sub(surfaceNormal(feet[0].x,feet[0].z)).normalize();
        gate.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(tangent,up,new THREE.Vector3().crossVectors(tangent,up).normalize()));
        const inverse=gate.quaternion.clone().invert();
        const bases=feet.map(p=>surfaceNormal(p.x,p.z).multiplyScalar(PLANET_RADIUS+height(p.x,p.z)).sub(gate.position).applyQuaternion(inverse));
        const isStone=previous<stone&&next<stone,paint=isStone?'stone':'wood',postWidth=isStone?1.6:1.1;
        const top=Math.max(...bases.map(p=>p.y))+(isStone?5:4);
        for(const p of bases){
          this.block(gate,p.x,(p.y+top)/2,p.z,postWidth,top-p.y,1.5,paint);
          if(isStone)this.block(gate,p.x,top+.65,p.z,postWidth+.35,.5,1.75,paint);
        }
        this.block(gate,(bases[0].x+bases[1].x)/2,top,(bases[0].z+bases[1].z)/2,bases[1].x-bases[0].x+postWidth,.7,1.5,paint);
      }
    }
    const wallBatches=new Map<THREE.Material,THREE.Matrix4[]>();
    for(const wall of this.group.children){
      wall.updateMatrixWorld(true);
      wall.traverse(o=>{if(o instanceof THREE.Mesh){const material=o.material as THREE.Material;const batch=wallBatches.get(material)??[];batch.push(o.matrixWorld.clone());wallBatches.set(material,batch);}});
      wall.clear();
    }
    for(const [material,matrices] of wallBatches){
      const walls=new THREE.InstancedMesh(this.geometry,material,matrices.length);
      matrices.forEach((matrix,i)=>walls.setMatrixAt(i,matrix));walls.castShadow=true;walls.receiveShadow=true;walls.frustumCulled=false;walls.name='Terrain-following wall masonry';this.group.add(walls);
    }
    if(mine>=2&&height(MINING_SITE.x,MINING_SITE.z)>1){
      const camp=this.place(MINING_SITE.x,MINING_SITE.z,'Dwarven mountain mine');camp.rotateY(-.25);camp.scale.setScalar(.7);
      this.block(camp,0,1.9,0,3.2,3.8,.5,'dark');
      for(const x of [-1.8,1.8])this.block(camp,x,2,.35,.5,4,.7,'wood');
      this.block(camp,0,4,.35,4.2,.65,.8,'wood');
      for(const x of [-.65,.65])this.block(camp,x,.15,3,.12,.14,5,'dark');
      for(let i=0;i<7;i++)this.block(camp,0,.09,1+i*.65,1.8,.12,.2,'wood');
      if(mine>=3){this.block(camp,0,.7,2.8,1.5,1.1,1.8,'wood');for(const x of [-.6,.6])for(const z of [2.2,3.4])this.block(camp,x,.22,z,.3,.4,.4,'dark');this.block(camp,0,1.3,2.8,1.2,.5,1.3,'ore');}
      if(mine>=5)for(let i=0;i<3;i++)this.block(camp,3+i*.65,.4+i*.12,2.5,1,.8,1,'ore');
      if(mine>=7){for(const x of [4,6])this.block(camp,x,3,-1,.45,6,.45,'wood');this.block(camp,5,6,-1,3,.45,.65,'wood');this.block(camp,5,3,-1,.09,5,.09,'dark');this.block(camp,5,.8,-1,1.2,1,1.2,'wood');}
    }
    this.group.traverse(o=>o.userData.planetNative=true);
  }
  dispose(){this.group.traverse(o=>{if(o instanceof THREE.InstancedMesh)o.dispose();});this.geometry.dispose();Object.values(this.paints).forEach(p=>p.dispose());this.group.removeFromParent();}
}
