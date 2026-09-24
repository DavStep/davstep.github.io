import * as THREE from 'three';

export interface ContactFootprint { x:number; z:number; width:number; depth:number }

/** Small baked-style ground shadows, batched separately from moving sun shadows. */
export class ContactShadows {
  private readonly texture:THREE.DataTexture;
  private readonly material:THREE.MeshBasicMaterial;
  private readonly buildings:THREE.Mesh;
  private readonly trees:THREE.Mesh;

  constructor(scene:THREE.Scene,private readonly groundHeight:(x:number,z:number)=>number){
    const size=64,pixels=new Uint8Array(size*size*4);
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const u=(x+.5)/size*2-1,v=(y+.5)/size*2-1;
      const radius=Math.pow(Math.pow(Math.abs(u),4)+Math.pow(Math.abs(v),4),.25);
      const alpha=1-THREE.MathUtils.smoothstep(radius,.22,1);
      const offset=(y*size+x)*4;
      pixels.set([255,255,255,Math.round(alpha*255)],offset);
    }
    this.texture=new THREE.DataTexture(pixels,size,size);
    this.texture.magFilter=this.texture.minFilter=THREE.LinearFilter;
    this.texture.needsUpdate=true;
    this.material=new THREE.MeshBasicMaterial({
      color:0x30283d,map:this.texture,transparent:true,opacity:.28,
      depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1,
    });
    this.buildings=new THREE.Mesh(new THREE.BufferGeometry(),this.material);
    this.trees=new THREE.Mesh(new THREE.BufferGeometry(),this.material);
    // Draw before the transparent rain and water details.
    this.buildings.renderOrder=this.trees.renderOrder=-1;
    scene.add(this.buildings,this.trees);
  }

  private setFootprints(mesh:THREE.Mesh,footprints:ContactFootprint[]){
    const vertices:number[]=[],uvs:number[]=[];
    // Subdivide the footprints so they follow the surrounding hillside.
    const divisions=4;
    for(const footprint of footprints){
      const vertex=(u:number,v:number)=>{
        const x=footprint.x+(u-.5)*footprint.width,z=footprint.z+(v-.5)*footprint.depth;
        vertices.push(x,this.groundHeight(x,z)+.025,z);uvs.push(u,v);
      };
      for(let y=0;y<divisions;y++)for(let x=0;x<divisions;x++){
        const u=x/divisions,v=y/divisions,du=(x+1)/divisions,dv=(y+1)/divisions;
        vertex(u,v);vertex(u,dv);vertex(du,v);
        vertex(du,v);vertex(u,dv);vertex(du,dv);
      }
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
    geometry.computeBoundingSphere();
    mesh.geometry.dispose();mesh.geometry=geometry;
    mesh.visible=footprints.length>0;
  }

  setBuildings(footprints:ContactFootprint[]){this.setFootprints(this.buildings,footprints);}
  setTrees(trees:{x:number;z:number;r:number}[]){
    this.setFootprints(this.trees,trees.map(tree=>({x:tree.x,z:tree.z,width:tree.r*4,depth:tree.r*4})));
  }
  dispose(){
    this.buildings.removeFromParent();this.trees.removeFromParent();
    this.buildings.geometry.dispose();this.trees.geometry.dispose();
    this.material.dispose();this.texture.dispose();
  }
}
