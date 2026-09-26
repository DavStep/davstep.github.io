import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Levels } from './game';
import type { Environment } from './environment';
import { createBankMaterial, naturalTerrainHeight, pushBankColors } from './environment';
import { RiverWorks } from './river-works';
import { MAT } from './materials';
import { MOAT_RADIUS, MOAT_HALF_WIDTH, MOAT_FEED_X, MOAT_FEED_START, MOAT_FEED_END, moatForLevels, moatSurfaceHeight, moatRoutePoint, MOAT_START_ANGLE, MOAT_FEED_SHARE } from './moat-layout';

/** A river-fed moat outside the town walls, with crossings on the four roads. */
export class CastleMoat {
  readonly group=new THREE.Group();
  readonly crossings=new THREE.Group();
  readonly gates=new THREE.Group();
  private readonly channel=new THREE.Group();
  private readonly geometries=new Set<THREE.BufferGeometry>();
  private readonly waterMaterial:THREE.Material;
  private readonly bankMaterial=createBankMaterial();
  private readonly works:RiverWorks;
  private readonly ribbons:{mesh:THREE.Mesh;ring:boolean;bank:boolean;count:number}[]=[];
  constructor(parent:THREE.Group,mobile:boolean,private readonly environment:Pick<Environment,'createRiverMaterial'|'setMoatProgress'>){
    this.group.name='Castle_moat';this.channel.name='River_fed_channel';this.crossings.name='Moat_bridges';this.gates.name='Moat_gatehouses';
    this.group.add(this.channel,this.crossings,this.gates);parent.add(this.group);
    // Ribbon uv: x=-1..1 across the half width, y=1.7 per ring segment.
    this.waterMaterial=environment.createRiverMaterial([MOAT_HALF_WIDTH,Math.PI*2*MOAT_RADIUS/(mobile?128:192)/1.7]);
    this.works=new RiverWorks(this.group,mobile,moatRoutePoint,naturalTerrainHeight,t=>{const p=moatRoutePoint(t);return moatSurfaceHeight(p.x,p.z);},7);
    const mesh=(geometry:THREE.BufferGeometry,material:THREE.Material,group:THREE.Group)=>{
      this.geometries.add(geometry);const object=new THREE.Mesh(geometry,material);object.receiveShadow=true;group.add(object);return object;
    };
    const ribbon=(points:[number,number][],ring:boolean)=>{
      for(const bank of [0,-1,1]){
        const positions:number[]=[],uv:number[]=[],colors:number[]=[];
        const edge=(i:number,side:number,outer=false):[number,number,number]=>{
          const [x,z]=points[i];const length=Math.hypot(x,z);
          const nx=ring?x/length:1,nz=ring?z/length:0;
          const width=MOAT_HALF_WIDTH+(outer?3.3:0),px=x+nx*width*side,pz=z+nz*width*side;
          return [px,outer?naturalTerrainHeight(px,pz)+.025:moatSurfaceHeight(px,pz),pz];
        };
        for(let i=0;i<points.length-1;i++){
          // Open both south-bank joins: the moat feeder and the mill stream.
          // The latter passes across the circular channel, so retaining either
          // raised bank here leaves a sand wall through otherwise connected water.
          const southRing=ring&&points[i][1]<0&&points[i+1][1]<0;
          const crossesX=(center:number,halfWidth:number)=>
            Math.min(points[i][0],points[i+1][0])<center+halfWidth&&
            Math.max(points[i][0],points[i+1][0])>center-halfWidth;
          if(bank&&southRing&&(crossesX(MOAT_FEED_X,6)||crossesX(28.2,6.2)))continue;
          if(bank&&!ring&&points[i][1]>MOAT_FEED_START-5)continue;
          const a=edge(i,bank||-1),b=edge(i,bank||1,!!bank),c=edge(i+1,bank||-1),d=edge(i+1,bank||1,!!bank);
          for(const p of [a,b,c,b,d,c])positions.push(...p);
          if(bank)pushBankColors(colors,i+(bank>0?5000:0)+(ring?0:9000));
          for(const [side,t] of [[-1,i],[1,i],[-1,i+1],[1,i],[1,i+1],[-1,i+1]])uv.push(side,t*1.7);
        }
        const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.computeVertexNormals();
        // Banks follow the slope on both sides; shared stone is double-sided via
        // triangle orientation below, avoiding a second material allocation.
        if(bank){
          geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
          // One side's winding faces down; both windings are drawn, so point every normal up
          // or that bank renders unlit (the dark ring outside the moat).
          const normal=geometry.getAttribute('normal');for(let i=0;i<normal.count;i++)if(normal.getY(i)<0)normal.setXYZ(i,-normal.getX(i),-normal.getY(i),-normal.getZ(i));
          const indices:number[]=[];for(let i=0;i<positions.length/3;i+=3)indices.push(i,i+1,i+2,i+2,i+1,i);geometry.setIndex(indices);
        }
        const object=mesh(geometry,bank?this.bankMaterial:this.waterMaterial,this.channel);
        object.name=bank?'Moat_bank':'Moat_water';
        this.ribbons.push({mesh:object,ring,bank:!!bank,count:geometry.index?.count??positions.length/3});
        if(!bank){
          const bed=mesh(geometry.clone().translate(0,-.8,0),MAT.earth,this.channel);
          this.ribbons.push({mesh:bed,ring,bank:true,count:positions.length/3});
        }
      }
    };
    const steps=mobile?128:192;
    ribbon(Array.from({length:steps+1},(_,i)=>{const a=MOAT_START_ANGLE+i/steps*Math.PI*2;return [Math.cos(a)*MOAT_RADIUS,Math.sin(a)*MOAT_RADIUS];}),true);
    ribbon(Array.from({length:25},(_,i)=>[MOAT_FEED_X,MOAT_FEED_END+(MOAT_FEED_START-MOAT_FEED_END)*i/24]),false);
    const block=(group:THREE.Group,x:number,y:number,z:number,w:number,h:number,d:number,material:THREE.Material)=>{
      const b=mesh(new THREE.BoxGeometry(w,h,d),material,group);b.position.set(x,y,z);b.castShadow=!mobile;return b;
    };
    for(let i=0;i<4;i++){
      const bridge=new THREE.Group(),gate=new THREE.Group();bridge.rotation.y=gate.rotation.y=i*Math.PI/2;this.crossings.add(bridge);this.gates.add(gate);
      block(bridge,0,.56,60,5.3,.32,16,MAT.woodDark);
      for(let z=53;z<=67;z+=.7)block(bridge,0,.76,z,5.2,.12,.59,MAT.woodLight);
      for(const x of [-2.9,2.9]){
        block(bridge,x,1.23,60,.32,.85,16,MAT.stone);
        for(const z of [54,57,63,66])block(bridge,x,.28,z,.7,1.5,.8,MAT.stoneDark);
        block(gate,x,2.6,55.8,1.4,4.3,2,MAT.stone);
        block(gate,x,4.85,55.8,1.7,.35,2.3,MAT.stoneDark);
        for(const dz of [-.8,0,.8])block(gate,x,5.2,55.8+dz,1.65,.5,.35,MAT.stone);
      }
      block(gate,0,4.2,55.8,4.5,.55,1.7,MAT.stoneDark);
      // Raised portcullis keeps the crossing visibly open.
      for(let x=-1.9;x<=1.9;x+=.48)block(gate,x,3.8,55.8,.08,1.1,.1,MAT.iron);
      block(gate,0,3.5,55.8,4,.08,.1,MAT.iron);
    }
    // These parts only switch visibility; batch the masonry and planks by
    // material instead of submitting every block separately each frame.
    for(const group of [this.crossings,this.gates]){
      group.updateMatrixWorld(true);
      const buckets=new Map<THREE.Material,THREE.BufferGeometry[]>();
      group.traverse(object=>{
        if(!(object instanceof THREE.Mesh))return;
        const material=object.material as THREE.Material,parts=buckets.get(material)??[];
        parts.push(object.geometry.clone().applyMatrix4(object.matrixWorld));buckets.set(material,parts);
        this.geometries.delete(object.geometry);object.geometry.dispose();
      });
      group.clear();
      for(const [material,parts] of buckets){
        const geometry=mergeGeometries(parts)!;parts.forEach(p=>p.dispose());
        mesh(geometry,material,group).castShadow=!mobile;
      }
    }
    this.group.visible=false;
  }
  setLevels(levels:Levels,instant=false){
    const state=moatForLevels(levels);
    this.works.setActive(state.filled,instant);
    this.crossings.visible=state.bridges;this.gates.visible=state.gates;
    this.update(0);
  }
  update(dt:number,reduced=false){
    this.works.update(dt,reduced);
    const dig=this.works.digProgress,flow=this.works.flowProgress;
    this.environment.setMoatProgress?.(dig);
    this.group.visible=dig>0||this.works.working;
    for(const ribbon of this.ribbons){
      const progress=ribbon.bank?dig:flow;
      const local=THREE.MathUtils.clamp(ribbon.ring?(progress-MOAT_FEED_SHARE)/(1-MOAT_FEED_SHARE):progress/MOAT_FEED_SHARE,0,1);
      const unit=ribbon.mesh.geometry.index?12:6;
      ribbon.mesh.geometry.setDrawRange(0,Math.floor(ribbon.count/unit*local)*unit);
    }
  }
  dispose(){
    this.works.dispose();this.group.removeFromParent();this.geometries.forEach(g=>g.dispose());this.waterMaterial.dispose();this.bankMaterial.dispose();this.group.clear();
    this.environment.setMoatProgress?.(0);
  }
}
