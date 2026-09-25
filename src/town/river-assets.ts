import * as THREE from 'three';
import authored from './generated/river-crossings.json';

const colors:Record<string,number>={deck:0xa9764c,beam:0x603f2d,rail:0xbf925e,
  stone:0x8a8776,stoneLight:0xb0a68b,reed:0x79965b};

export function riverAsset(family:'bridge'|'pool',waterMaterial?:THREE.Material):THREE.Group{
  const group=new THREE.Group();
  group.name=family==='bridge'?'Authored_timber_bridge':'Authored_stream_pool';
  const materials=new Map<string,THREE.Material>();
  for(const part of authored.parts.filter(part=>part.family===family)){
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(part.positions,3));
    geometry.setAttribute('normal',new THREE.Float32BufferAttribute(part.normals,3));
    if('uv' in part&&part.uv)geometry.setAttribute('uv',new THREE.Float32BufferAttribute(part.uv,2));
    let material=part.material==='water'?waterMaterial:materials.get(part.material);
    if(!material){
      material=new THREE.MeshStandardMaterial({color:colors[part.material],roughness:.88,side:THREE.DoubleSide});
      materials.set(part.material,material);
    }
    const mesh=new THREE.Mesh(geometry,material);
    mesh.name=part.name;mesh.castShadow=part.material!=='water';mesh.receiveShadow=true;
    group.add(mesh);
  }
  return group;
}
