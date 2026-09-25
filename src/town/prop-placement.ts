import * as THREE from 'three';
import { getPropAsset, type PropFamily } from './props';
import { terrainHeight } from './environment';

export function placeProp(parent:THREE.Group,family:PropFamily,mobile:boolean,x:number,y:number,z:number,rotation=0,scale=1):void{
  for(const part of getPropAsset(family,mobile)){
    const mesh=new THREE.Mesh(part.geometry,part.material);
    mesh.name=`${family}_${part.role}`;mesh.position.set(x,y,z);mesh.rotation.y=rotation;mesh.scale.setScalar(scale);
    mesh.castShadow=part.role!=='warm_glass';mesh.receiveShadow=true;parent.add(mesh);
  }
}

export function placeLanterns(parent:THREE.Group,sites:{x:number;y:number;z:number}[],mobile:boolean):void{
  const transform=new THREE.Object3D();
  for(const part of getPropAsset('Lantern_A',mobile)){
    const mesh=new THREE.InstancedMesh(part.geometry,part.material,sites.length);
    mesh.name=`Street_lantern_${part.role}`;
    sites.forEach((site,index)=>{transform.position.set(site.x,site.y,site.z);transform.rotation.set(0,index*2.4,0);transform.updateMatrix();mesh.setMatrixAt(index,transform.matrix);});
    mesh.instanceMatrix.needsUpdate=true;mesh.castShadow=!mobile&&part.role!=='warm_glass';mesh.receiveShadow=true;
    mesh.computeBoundingSphere();parent.add(mesh);
  }
}

export function placeFenceSections(parent:THREE.Group,sections:{start:{x:number;z:number};end:{x:number;z:number};rotation:number;length:number}[],mobile:boolean,blocked?:(x:number,z:number)=>boolean):void{
  const sites:{x:number;z:number;rotation:number;width:number}[]=[];
  for(const section of sections){
    const count=Math.max(1,Math.ceil(section.length/2.4));
    for(let i=0;i<count;i++){
      const t=(i+.5)/count;
      const x=section.start.x+(section.end.x-section.start.x)*t,z=section.start.z+(section.end.z-section.start.z)*t;
      if(blocked?.(x,z)||blocked?.(section.start.x+(section.end.x-section.start.x)*i/count,section.start.z+(section.end.z-section.start.z)*i/count)||blocked?.(section.start.x+(section.end.x-section.start.x)*(i+1)/count,section.start.z+(section.end.z-section.start.z)*(i+1)/count))continue;
      sites.push({x,z,rotation:section.rotation,width:section.length/count});
    }
  }
  const transform=new THREE.Object3D();
  for(const part of getPropAsset('Fence_A',mobile)){
    const mesh=new THREE.InstancedMesh(part.geometry,part.material,sites.length);
    mesh.name='Timber_boundary_fence';
    sites.forEach((site,i)=>{transform.position.set(site.x,terrainHeight(site.x,site.z),site.z);transform.rotation.set(0,site.rotation,0);transform.scale.set(site.width/2.4,2.7,2);transform.updateMatrix();mesh.setMatrixAt(i,transform.matrix);});
    mesh.instanceMatrix.needsUpdate=true;mesh.castShadow=!mobile;mesh.receiveShadow=true;mesh.computeBoundingSphere();parent.add(mesh);
  }
}
