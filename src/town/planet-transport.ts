import * as THREE from 'three';
import type { TownSnapshot } from './model';
import { PLANET_RADIUS as R,planetElevation,surfaceNormal } from './planet-geography';
import { planetTransportLayout,planetTransportState,seaRoute,mixPoint,harborHut,harborBerth,bridgeMaterial,type Crossing,type Harbor } from './planet-transport-layout';
import type { RoadPoint as Point } from './planet-building-access';
import { createPlanetShip,SHIP_FLOAT_HEIGHT,type PlanetShip } from './planet-ship';
import { cottageBuilding } from './cottages';
import { bodyGeometry,bodyDetailGeometry,limbGeometries,limbDetailGeometries } from './residents';
import residentData from './generated/residents.json';
const UP=new THREE.Vector3(0,1,0);
const height=(p:Point)=>planetElevation(surfaceNormal(p.x,p.z));
const surface=(p:Point,h=height(p))=>surfaceNormal(p.x,p.z).multiplyScalar(R+h);
export function bridgeDeck(bridge:Crossing,t:number){return height(bridge.a)*(1-t)+height(bridge.b)*t+.13+Math.sin(Math.PI*t)*1.5;}

/** Bridges and piers use world-space frames on the sphere, not flat-valley coordinates. */
export class PlanetTransport{
  readonly group=new THREE.Group();
  private structures=new THREE.Group();
  private box=new THREE.BoxGeometry(1,1,1);
  private geometries=new Set<THREE.BufferGeometry>([this.box]);
  private materials=new Set<THREE.Material>();
  private transientGeometries=new Set<THREE.BufferGeometry>();
  private transientMaterials=new Set<THREE.Material>();
  private paints:Record<string,THREE.MeshStandardMaterial>={};
  private signature='';
  private expeditionActive=false;
  setExpeditionActive(active:boolean){this.expeditionActive=active;for(const boat of this.boats)if(!boat.float)boat.model.root.visible=!active;}
  private growth=1;
  private lastTime:number|null=null;
  private time=0;
  private batches:{mesh:THREE.InstancedMesh;count:number}[]=[];
  private fishers:{root:THREE.Group;arm:THREE.Group;line:THREE.Line;float:THREE.Mesh;base:THREE.Vector3;up:THREE.Vector3}[]=[];
  private boats:{model:PlanetShip;route:Point[];lengths:number[];length:number;speed:number;phase:number;scale:number;float?:THREE.Mesh;line?:THREE.Line}[]=[];
  private navigation:Point[];
  private fishingNavigation:Point[]=[];
  constructor(parent:THREE.Group,private mobile:boolean){
    this.group.name='Harbors, fishing boats and island bridges';parent.add(this.group);this.group.add(this.structures);
    for(const [key,color] of Object.entries({wood:0xa47a49,dark:0x705239,stone:0xb3a78c,masonry:0x9eaaa8,masonryLight:0xc2c7b8,masonryDark:0x82918d,roof:0xb55535,rope:0xd7c393,cloth:0xe5d1a4,blue:0x487c96,skin:0xd7a77b})){
      const material=new THREE.MeshStandardMaterial({color,roughness:.94});this.paints[key]=material;this.materials.add(material);
    }
    const ports=planetTransportLayout().harbors;this.navigation=ports.length>1?seaRoute(harborBerth(ports[0]),harborBerth(ports[1])):[];
    if(this.navigation.length>1){
      const [a,b]=this.navigation,dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz),reach=8*(1+(a.x*a.x+a.z*a.z)/(4*R*R));
      // Fishing takes place alongside the shipping lane, not in the flagship's path.
      for(const side of [1,-1]){
        const offset=(p:Point)=>({x:p.x+dz/length*reach*side,z:p.z-dx/length*reach*side});
        this.fishingNavigation=seaRoute(offset(a),offset(mixPoint(a,b,.35)));
        if(this.fishingNavigation.length>1)break;
      }
    }
  }
  private block(group:THREE.Group,position:THREE.Vector3,size:THREE.Vector3,rotation:THREE.Quaternion,paint:string){
    const mesh=new THREE.Mesh(this.box,this.paints[paint]);mesh.position.copy(position);mesh.scale.copy(size);mesh.quaternion.copy(rotation);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;
  }
  private timber(group:THREE.Group,a:THREE.Vector3,b:THREE.Vector3,width:number,depth:number,paint='wood'){
    const direction=b.clone().sub(a),q=new THREE.Quaternion().setFromUnitVectors(UP,direction.clone().normalize());
    return this.block(group,a.clone().add(b).multiplyScalar(.5),new THREE.Vector3(width,direction.length(),depth),q,paint);
  }
  private walkway(group:THREE.Group,a:Point,b:Point,width:number,deck:(t:number)=>number,rails:boolean){
    const length=surface(a).distanceTo(surface(b)),count=Math.ceil(length/.5);
    for(let i=0;i<=count;i++){
      const t=i/count,p=mixPoint(a,b,t),up=surfaceNormal(p.x,p.z),pos=surface(p,deck(t));
      const before=surface(mixPoint(a,b,Math.max(0,t-.001)),deck(Math.max(0,t-.001))),after=surface(mixPoint(a,b,Math.min(1,t+.001)),deck(Math.min(1,t+.001)));
      const forward=after.sub(before).normalize(),right=new THREE.Vector3().crossVectors(up,forward).normalize();
      const normal=new THREE.Vector3().crossVectors(forward,right).normalize(),q=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,normal,forward));
      this.block(group,pos,new THREE.Vector3(width,.16,length/count+.025),q,i%5===0?'dark':'wood');
      if(i%5===0||i===count)for(const side of [-1,1]){
        const foot=pos.clone().addScaledVector(right,side*(width/2-.12));
        const bottom=surfaceNormal(p.x,p.z).multiplyScalar(R+height(p)-.2).addScaledVector(right,side*(width/2-.12));
        this.timber(group,bottom,foot.clone().addScaledVector(up,rails?1.1:.65),.17,.17,'dark');
      }
      if(rails&&i>0)for(const side of [-1,1]){
        const previousT=(i-1)/count,previous=mixPoint(a,b,previousT),previousUp=surfaceNormal(previous.x,previous.z);
        const start=surface(previous,deck(previousT)).addScaledVector(right,side*(width/2-.12)).addScaledVector(previousUp,.9);
        this.timber(group,start,pos.clone().addScaledVector(right,side*(width/2-.12)).addScaledVector(up,.9),.09,.09,'rope');
      }
    }
  }
  private stoneBridge(group:THREE.Group,bridge:Crossing){
    const length=surface(bridge.a).distanceTo(surface(bridge.b)),rows=Math.ceil(length/.65);
    const frame=(t:number,h=bridgeDeck(bridge,t))=>{
      const p=mixPoint(bridge.a,bridge.b,t),up=surfaceNormal(p.x,p.z);
      const forward=surface(mixPoint(bridge.a,bridge.b,Math.min(1,t+.001))).sub(surface(mixPoint(bridge.a,bridge.b,Math.max(0,t-.001))));
      forward.addScaledVector(up,-forward.dot(up)).normalize();
      const right=new THREE.Vector3().crossVectors(up,forward).normalize();
      return {p,up,forward,right,position:surface(p,h),rotation:new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,up,forward))};
    };
    // Three paving courses and capped parapets retain the original landing heights.
    for(let i=0;i<rows;i++){
      const t=(i+.5)/rows,f=frame(t),depth=length/rows+.015;
      for(let j=-1;j<=1;j++)this.block(group,f.position.clone().addScaledVector(f.right,j*.76).addScaledVector(f.up,-.075),new THREE.Vector3(.74,.23,depth),f.rotation,(i+j)%3===0?'masonryLight':'masonry');
      for(const side of [-1,1]){
        const pos=f.position.clone().addScaledVector(f.right,side*1.14);
        this.block(group,pos.clone().addScaledVector(f.up,.32),new THREE.Vector3(.34,.64,depth-.025),f.rotation,i%3===0?'masonryDark':'masonry');
        this.block(group,pos.clone().addScaledVector(f.up,.7),new THREE.Vector3(.43,.14,depth+.02),f.rotation,'masonryLight');
      }
    }
    // Real arch barrels and seabed-founded piers, rather than recolored timber piles.
    const spans=Math.max(1,Math.ceil(length/9)),drop=Math.min(3.4,length/spans*.3);
    for(let span=0;span<spans;span++){
      const steps=14;
      for(let j=0;j<steps;j++){
        const u=j/steps,v=(j+1)/steps,aT=(span+u)/spans,bT=(span+v)/spans;
        const a=frame(aT,bridgeDeck(bridge,aT)-.5-drop*(1-Math.sin(Math.PI*u)));
        const b=frame(bT,bridgeDeck(bridge,bT)-.5-drop*(1-Math.sin(Math.PI*v)));
        const forward=b.position.clone().sub(a.position),distance=forward.length();forward.normalize();
        const right=new THREE.Vector3().crossVectors(a.up,forward).normalize(),up=new THREE.Vector3().crossVectors(forward,right).normalize();
        const q=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,up,forward));
        this.block(group,a.position.clone().add(b.position).multiplyScalar(.5),new THREE.Vector3(2.45,.48,distance+.025),q,j===6||j===7?'masonryLight':j%3===0?'masonryDark':'masonry');
        // Fill above the arch so the paving has solid masonry support.
        const t=(aT+bT)/2,f=frame(t),arch=bridgeDeck(bridge,t)-.5-drop*(1-Math.sin(Math.PI*(u+v)/2)),fill=bridgeDeck(bridge,t)-.18-arch;
        this.block(group,surface(f.p,arch+fill/2),new THREE.Vector3(2.24,fill,Math.max(.1,length/spans/steps+.02)),f.rotation,'masonry');
      }
    }
    for(let i=0;i<=spans;i++){
      const t=i/spans,f=frame(t),bottom=height(f.p)-.4,top=bridgeDeck(bridge,t)-.17;
      this.block(group,surface(f.p,(bottom+top)/2),new THREE.Vector3(2.55,top-bottom,1.05),f.rotation,'masonryDark');
      for(const side of [-1,1]){
        this.block(group,f.position.clone().addScaledVector(f.right,side*1.14).addScaledVector(f.up,.42),new THREE.Vector3(.55,.84,.6),f.rotation,'masonry');
        this.block(group,f.position.clone().addScaledVector(f.right,side*1.14).addScaledVector(f.up,.91),new THREE.Vector3(.66,.15,.71),f.rotation,'masonryLight');
      }
    }
  }
  private fisher(harbor:Harbor){
    const p=mixPoint(harbor.land,harbor.sea,.8),up=surfaceNormal(p.x,p.z),root=new THREE.Group();root.name='Fisherman at the dock';
    root.position.copy(surface(p,1.4));
    const forward=surface(harbor.sea).sub(surface(harbor.land));forward.addScaledVector(up,-forward.dot(up)).normalize();
    const right=new THREE.Vector3().crossVectors(up,forward).normalize();root.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,up,forward));root.scale.setScalar(.8);
    const body=new THREE.Mesh(bodyGeometry,this.paints.blue);root.add(body);
    const detail=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1});this.transientMaterials.add(detail);
    if(bodyDetailGeometry)root.add(new THREE.Mesh(bodyDetailGeometry,detail));
    let arm=new THREE.Group();
    for(const name of ['arm_left','arm_right','leg_left','leg_right'] as const){
      const pivot=new THREE.Group();pivot.position.fromArray(residentData.parts[name].pivot);
      pivot.add(new THREE.Mesh(limbGeometries[name],this.paints.blue));if(limbDetailGeometries?.[name])pivot.add(new THREE.Mesh(limbDetailGeometries[name],detail));
      if(name==='arm_right'){arm=pivot;pivot.rotation.x=-.8;}
      root.add(pivot);
    }
    const rod=new THREE.Group();rod.position.set(.42,1.3,.3);root.add(rod);
    this.timber(rod,new THREE.Vector3(),new THREE.Vector3(0,1.6,2.5),.055,.055,'dark');
    const lineGeometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,1.6,2.5),new THREE.Vector3(0,-3.0,3.4)]);this.transientGeometries.add(lineGeometry);
    const lineMaterial=new THREE.LineBasicMaterial({color:0xd8dbba});this.transientMaterials.add(lineMaterial);const line=new THREE.Line(lineGeometry,lineMaterial);rod.add(line);
    const floatGeo=new THREE.SphereGeometry(.1,6,4);this.transientGeometries.add(floatGeo);const float=new THREE.Mesh(floatGeo,this.paints.roof);float.position.set(0,-3.0,3.4);rod.add(float);
    this.fishers.push({root,arm,line,float,base:float.position.clone(),up});this.group.add(root);
  }
  private dock(harbor:Harbor,river:number,fishing:boolean){
    const group=new THREE.Group();group.name=harbor.id;this.structures.add(group);
    const deck=(t:number)=>height(harbor.land)*(1-t)+1.35*t+.13;
    this.walkway(group,harbor.land,harbor.sea,2.5,deck,false);
    const dx=harbor.sea.x-harbor.land.x,dz=harbor.sea.z-harbor.land.z,len=Math.hypot(dx,dz);
    if(river>=2){
      const tip=mixPoint(harbor.land,harbor.sea,.85),left={x:tip.x-dz/len*4,z:tip.z+dx/len*4},pierRight={x:tip.x+dz/len*4,z:tip.z-dx/len*4};
      this.walkway(group,left,pierRight,2,()=>1.48,false);
      const {center:hut,door}=harborHut(harbor),n=surfaceNormal(hut.x,hut.z),forward=surface(harbor.land).sub(surface(hut));forward.addScaledVector(n,-forward.dot(n)).normalize();
      const hutRight=new THREE.Vector3().crossVectors(n,forward).normalize(),q=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(hutRight,n,forward));
      // A terraced stone foundation supports the full cottage on sloping shores.
      const ground=surface(hut),foundation=[];
      for(let x=-1.5;x<=1.5;x+=.5)for(let z=-1.5;z<=1.5;z+=.5){
        const position=ground.clone().addScaledVector(hutRight,x).addScaledVector(forward,z),normal=position.clone().normalize();
        const floor=normal.multiplyScalar(R+planetElevation(normal));
        foundation.push({x,z,elevation:floor.sub(ground).dot(n)});
      }
      const floor=Math.max(...foundation.map(p=>p.elevation))+.12;
      const base=ground.clone().addScaledVector(n,floor-.48*.68);
      for(const p of foundation){const depth=floor-p.elevation+.16;this.block(group,ground.clone().addScaledVector(hutRight,p.x).addScaledVector(forward,p.z).addScaledVector(n,floor-depth/2),new THREE.Vector3(.51,depth,.51),q,'stone');}
      const steps=Math.ceil(Math.hypot(door.x-harbor.land.x,door.z-harbor.land.z)/.5);
      for(let i=0;i<steps;i++){const a=mixPoint(door,harbor.land,i/steps),b=mixPoint(door,harbor.land,(i+1)/steps),p=mixPoint(a,b,.5),up=surfaceNormal(p.x,p.z),direction=surface(b).sub(surface(a)).normalize(),side=new THREE.Vector3().crossVectors(up,direction).normalize(),lift=Math.max(0,1-(i+.5)/steps*2)*Math.max(0,height(hut)+floor-height(door));this.block(group,surface(p,height(p)+.11+lift),new THREE.Vector3(1.2,.1,surface(a).distanceTo(surface(b))+.02),new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(side,up,direction)),'stone');}
      const hutModel=cottageBuilding({id:'fisher-hut',kind:'home',x:0,z:0,start:0,step:1,stage:3,renovation:0,variant:0},this.mobile);
      hutModel.position.copy(base);hutModel.quaternion.copy(q);hutModel.scale.setScalar(.68);
      const paints=new Map<THREE.Material,THREE.Material>();
      hutModel.traverse(o=>{if(o instanceof THREE.Mesh){const source=o.material as THREE.Material;let paint=paints.get(source);if(!paint){paint=source.clone();paints.set(source,paint);this.transientMaterials.add(paint);}o.material=paint;}});
      group.add(hutModel);
      // Fish crates, net racks and a clear working platform make the pier readable.
      for(let i=0;i<3;i++){const p=mixPoint(harbor.land,harbor.sea,.35+i*.1),u=surfaceNormal(p.x,p.z);const side=new THREE.Vector3().crossVectors(u,surface(harbor.sea).sub(surface(harbor.land))).normalize();this.block(group,surface(p,deck(.35+i*.1)+.4).addScaledVector(side,.85),new THREE.Vector3(.65,.7,.65),new THREE.Quaternion().setFromUnitVectors(UP,u),'dark');}
    }
    if(fishing)this.fisher(harbor);
  }
  private addBoat(route:Point[],index:number){
    if(route.length<2)return;
    const model=createPlanetShip(this.mobile,Boolean(index));
    model.root.name=index?'Island trading ship':'Fishing boat';model.root.visible=true;
    const lengths=[0];for(let i=1;i<route.length;i++)lengths.push(lengths[i-1]+surface(route[i],0).distanceTo(surface(route[i-1],0)));
    let float:THREE.Mesh|undefined,line:THREE.Line|undefined;
    if(!index){
      const geometry=new THREE.SphereGeometry(.14,6,4);this.transientGeometries.add(geometry);
      float=new THREE.Mesh(geometry,this.paints.roof);float.name='Fishing bobber';float.position.set(.8,.04,-2.8);model.root.add(float);
      const lineGeometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(.8,1.7,-1),float.position]);this.transientGeometries.add(lineGeometry);
      const paint=new THREE.LineBasicMaterial({color:0xe9dbaf});this.transientMaterials.add(paint);line=new THREE.Line(lineGeometry,paint);model.root.add(line);
    }
    this.boats.push({model,route,lengths,length:lengths[lengths.length-1],speed:index?1.3:.65,phase:index?.6:.1,scale:index?1:.85,float,line});this.group.add(model.root);
  }
  update(snapshot:TownSnapshot,animate:boolean){
    const state=planetTransportState(snapshot),river=snapshot.riverLevel??0;
    const signature=`${river}/${state.fishing}/${state.boats}/${state.bridges.map(b=>`${b.id}:${bridgeMaterial(b,snapshot.roadLevel??0)}`)}`;
    if(signature===this.signature)return;this.signature=signature;
    this.transientGeometries.forEach(g=>g.dispose());this.transientGeometries.clear();this.transientMaterials.forEach(m=>m.dispose());this.transientMaterials.clear();
    this.batches.forEach(b=>b.mesh.dispose());this.batches=[];this.structures.clear();
    this.fishers.forEach(f=>f.root.removeFromParent());this.fishers=[];this.boats.forEach(b=>b.model.dispose());this.boats=[];
    this.growth=animate?0:1;
    for(const bridge of state.bridges){
      const g=new THREE.Group();g.name=`Bridge to ${bridge.id}`;g.userData.bridgeMaterial=bridgeMaterial(bridge,snapshot.roadLevel??0);this.structures.add(g);
      if(g.userData.bridgeMaterial==='stone')this.stoneBridge(g,bridge);
      else this.walkway(g,bridge.a,bridge.b,2.6,t=>bridgeDeck(bridge,t),true);
    }
    for(const harbor of state.harbors)this.dock(harbor,river,state.fishing);
    if(state.boats&&this.navigation.length>1){
      this.addBoat(this.fishingNavigation,0);
      if(state.boats>1)this.addBoat(this.navigation,1);
    }
    // Keep construction draw calls bounded even with hundreds of bridge planks.
    const buckets=new Map<THREE.BufferGeometry,Map<THREE.Material,THREE.Matrix4[]>>();this.structures.updateMatrixWorld(true);
    this.structures.traverse(o=>{if(o instanceof THREE.Mesh){
      const materials=buckets.get(o.geometry)??new Map<THREE.Material,THREE.Matrix4[]>(),material=o.material as THREE.Material,list=materials.get(material)??[];
      list.push(o.matrixWorld.clone());materials.set(material,list);buckets.set(o.geometry,materials);
    }});
    for(const child of this.structures.children)child.clear();
    for(const [geometry,materials] of buckets)for(const [material,matrices] of materials){
      const mesh=new THREE.InstancedMesh(geometry,material,matrices.length);matrices.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix));mesh.count=animate?0:matrices.length;mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;mesh.name='Harbor and bridge structures';this.structures.add(mesh);this.batches.push({mesh,count:matrices.length});
    }
    this.group.traverse(o=>o.userData.planetNative=true);
  }
  render(now:number,reduced:boolean){
    const dt=this.lastTime===null?0:Math.min(.1,Math.max(0,(now-this.lastTime)/1000));this.lastTime=now;if(!reduced)this.time+=dt;
    this.growth=reduced?1:Math.min(1,this.growth+dt/1.8);for(const b of this.batches)b.mesh.count=Math.floor(b.count*this.growth);
    for(const fisher of this.fishers){fisher.root.visible=this.growth>.9;fisher.arm.rotation.x=-.8+(reduced?0:Math.sin(this.time*.8)*.08);fisher.float.position.copy(fisher.base);fisher.float.position.y+=reduced?0:Math.sin(this.time*2)*.06;}
    for(const boat of this.boats){
      boat.model.root.visible=this.growth>.9&&(!this.expeditionActive||!!boat.float);
      // The cutter spends most of its day anchored over a fishing shoal.
      const fishing=!!boat.float,day=this.time%48,anchored=fishing&&day<36;
      const travel=fishing?(Math.floor(this.time/48)*12+Math.max(0,day-36)):this.time;
      const cycle=((travel*boat.speed/boat.length+boat.phase)%2+2)%2,t=cycle<=1?cycle:2-cycle,distance=t*boat.length;
      boat.model.root.userData.activity=fishing?(anchored?'fishing':'relocating'):'trading';
      if(boat.float&&boat.line){
        boat.float.visible=boat.line.visible=anchored;
        boat.float.position.y=.04+(reduced?0:Math.sin(this.time*2.1)*.05);
        const points=boat.line.geometry.getAttribute('position') as THREE.BufferAttribute;points.setXYZ(1,boat.float.position.x,boat.float.position.y,boat.float.position.z);points.needsUpdate=true;
      }
      boat.model.sails.visible=!anchored;
      let i=1;while(i<boat.lengths.length-1&&boat.lengths[i]<distance)i++;
      const part=(distance-boat.lengths[i-1])/(boat.lengths[i]-boat.lengths[i-1]),p=mixPoint(boat.route[i-1],boat.route[i],part),n=surfaceNormal(p.x,p.z);
      const forward=surface(boat.route[i],0).sub(surface(boat.route[i-1],0)).multiplyScalar(cycle<=1?1:-1);forward.addScaledVector(n,-forward.dot(n)).normalize();
      const side=new THREE.Vector3().crossVectors(forward,n).normalize();boat.model.root.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(forward,n,side));
      // Waterline is authored at Y=0, independent of the seabed and model scale.
      boat.model.root.position.copy(n).multiplyScalar(R+SHIP_FLOAT_HEIGHT+(reduced?0:Math.sin(this.time*1.8+boat.phase)*.035));boat.model.root.scale.setScalar(boat.scale);
      boat.model.sails.rotation.y=reduced?0:Math.sin(this.time*1.3+boat.phase)*.018;
      boat.model.flag.rotation.y=reduced?0:Math.sin(this.time*2.2+boat.phase)*.14;
    }
  }
  dispose(){this.boats.forEach(b=>b.model.dispose());this.transientGeometries.forEach(g=>g.dispose());this.transientMaterials.forEach(m=>m.dispose());this.batches.forEach(b=>b.mesh.dispose());this.geometries.forEach(g=>g.dispose());this.materials.forEach(m=>m.dispose());this.group.removeFromParent();}
}
