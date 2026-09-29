import * as THREE from 'three';
import { planetSourceGroundHeight } from './planet-layout';
import { planetCropContains,planetCropDry } from './planet-rivers';
import wheatTile from './generated/wheat-tile.json';

type Point={x:number;z:number};
type Clearance=(point:Point,radius:number)=>boolean;
/** A single raised canopy with a continuous top and solid cut edges. */
export class PlanetWheatField {
  readonly mesh=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshStandardMaterial({color:0xffdc32,roughness:1,side:THREE.DoubleSide}));
  readonly stalks:THREE.InstancedMesh;
  private plants:{x:number;z:number;ground:number;lift:number;turn:number;scale:number}[]=[];
  private readonly dummy=new THREE.Object3D();
  private clearance?:Clearance;
  private ground:number[]=[];
  private lifts:number[]=[];
  private growth=-1;
  constructor(parent:THREE.Group){
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(wheatTile.positions,3));
    geometry.setAttribute('normal',new THREE.Float32BufferAttribute(wheatTile.normals,3));
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(wheatTile.colors,3));
    this.stalks=new THREE.InstancedMesh(geometry,new THREE.MeshStandardMaterial({color:0xffe34a,vertexColors:true,roughness:1}),2400);
    this.stalks.name='Wheat ears above golden canopy';this.stalks.frustumCulled=false;
    parent.add(this.stalks);
    this.mesh.name='Continuous golden wheat field';this.mesh.frustumCulled=false;
    this.mesh.receiveShadow=true;parent.add(this.mesh);this.rebuild();this.setGrowth(0);
  }
  setClearance(clearance:Clearance){if(this.clearance===clearance)return;this.clearance=clearance;this.rebuild();}
  private rebuild(){
    const positions:number[]=[],ground:number[]=[],lifts:number[]=[];
    const inside=(p:Point)=>planetCropContains(p.x,p.z)&&planetCropDry(p.x,p.z)&&!this.clearance?.(p,.45);
    const canopyLift=(p:Point)=>.4+.035*Math.sin(p.x*1.6+p.z*.35);
    const vertex=(p:Point,top:boolean)=>{
      const base=planetSourceGroundHeight(p.x,p.z)+.04;
      const lift=top?canopyLift(p):0;
      positions.push(p.x,base+lift,p.z);ground.push(base);lifts.push(lift);
    };
    const crossing=(a:Point,b:Point)=>{
      let lo=a,hi=b;const state=inside(a);
      for(let i=0;i<8;i++){const mid={x:(lo.x+hi.x)/2,z:(lo.z+hi.z)/2};if(inside(mid)===state)lo=mid;else hi=mid;}
      return {x:(lo.x+hi.x)/2,z:(lo.z+hi.z)/2};
    };
    const triangle=(points:Point[])=>{
      const polygon:Point[]=[],edge:Point[]=[];
      for(let i=0;i<3;i++){
        const a=points[i],b=points[(i+1)%3],aIn=inside(a),bIn=inside(b);
        if(aIn)polygon.push(a);
        if(aIn!==bIn){const p=crossing(a,b);polygon.push(p);edge.push(p);}
      }
      for(let i=1;i<polygon.length-1;i++)for(const p of [polygon[0],polygon[i],polygon[i+1]])vertex(p,true);
      if(edge.length===2){const [a,b]=edge;for(const [p,top] of [[a,true],[a,false],[b,true],[b,true],[a,false],[b,false]] as [Point,boolean][])vertex(p,top);}
    };
    const step=.4;
    for(let x=26;x<58;x+=step)for(let z=-36;z<-6;z+=step){
      const a={x,z},b={x,z:z+step},c={x:x+step,z},d={x:x+step,z:z+step};
      triangle([a,b,c]);triangle([b,d,c]);
    }
    this.plants=[];
    for(let row=0;row<39;row++)for(let column=0;column<41;column++){
      const p={x:26.4+column*.78+(row%2)*.22,z:-35.6+row*.76};
      // Keep the entire clump inside the canopy and away from roads and water.
      if(!inside(p)||this.clearance?.(p,.85)||![[.35,0],[-.35,0],[0,.35],[0,-.35]].every(([dx,dz])=>inside({x:p.x+dx,z:p.z+dz})))continue;
      const variation=(Math.sin(row*37+column*17)*43758.5453)%1;
      this.plants.push({...p,ground:planetSourceGroundHeight(p.x,p.z)+.04,lift:canopyLift(p),turn:variation*Math.PI*2,scale:.64+Math.abs(variation)*.13});
    }
    this.stalks.count=this.plants.length;
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();
    this.mesh.geometry.dispose();this.mesh.geometry=geometry;this.ground=ground;this.lifts=lifts;
    const growth=Math.max(0,this.growth);this.growth=-1;this.setGrowth(growth);
  }
  setGrowth(growth:number){
    this.mesh.visible=this.stalks.visible=growth>.01;if(Math.abs(this.growth-growth)<.001)return;this.growth=growth;
    const positions=this.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    for(let i=0;i<this.ground.length;i++)positions.setY(i,this.ground[i]+this.lifts[i]*Math.min(1,growth*1.8));
    positions.needsUpdate=true;
    const height=Math.min(1,growth*1.8);
    this.plants.forEach((p,i)=>{
      this.dummy.position.set(p.x,p.ground+(p.lift-.12)*height,p.z);
      this.dummy.rotation.set(0,p.turn,0);this.dummy.scale.set(p.scale,p.scale*height,p.scale);
      this.dummy.updateMatrix();this.stalks.setMatrixAt(i,this.dummy.matrix);
    });
    this.stalks.instanceMatrix.needsUpdate=true;
  }
}
