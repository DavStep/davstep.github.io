import * as THREE from 'three';
import type { TownSnapshot } from './model';
import { PLANET_RADIUS,planetElevation,surfaceNormal } from './planet-geography';
import { planetBuildingAccess,type RoadPoint } from './planet-building-access';
import { planetRiverPoint } from './planet-rivers';
import { wallFootprintSafe } from './planet-settlements';
import { wallIsGate } from './wall-layout';
import { INFRASTRUCTURE } from './town-plan';
import { planetTransportState,harborHut } from './planet-transport-layout';
import { GROVE_SEEDS } from './planet-grove-sites';

type Point=RoadPoint;
export type RoadSegment={a:Point;b:Point};
const STEP=2,HALF=80,SIZE=HALF*2+1;
const river=Array.from({length:65},(_,i)=>planetRiverPoint(i/64));
export const roadHeight=(x:number,z:number)=>planetElevation(surfaceNormal(x,z));
/** Test the whole road's footprint, not just its centre, to keep shorelines clear. */
export function roadGroundSafe(x:number,z:number,hasRiver=false){
  const h=roadHeight(x,z);
  if(h<.65||h>5)return false;
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const edge=roadHeight(x+dx,z+dz);
    if(edge<.55||edge>5||Math.abs(edge-h)>.5)return false;
  }
  return !hasRiver||river.every(p=>Math.hypot(x-p.x,z-p.z)>3.3);
}
export function stoneReach(level:number){return level<2?0:Math.min(43,12+(level-2)*5);}

/** Connected lanes on each landmass, with explicit facade-normal doorstep spurs. */
export function routePlanetRoads(snapshot:TownSnapshot):RoadSegment[]{
  if(!snapshot.roads)return [];
  const plots=snapshot.plots.filter(p=>p.stage>0).sort((a,b)=>Number(b.kind==='castle')-Number(a.kind==='castle'));
  const transport=planetTransportState(snapshot);
  const huts=(snapshot.riverLevel??0)>=2?transport.harbors.map(h=>harborHut(h).center):[];
  const entrances=plots.map(planetBuildingAccess),hasRiver=(snapshot.riverLevel??0)>0;
  const blockedByWall=(p:Point)=>{
    if(!snapshot.innerWood||!wallFootprintSafe(p.x,p.z))return false;
    const angle=(Math.atan2(p.z,p.x)+Math.PI*2)%(Math.PI*2),sector=Math.floor(angle/(Math.PI*2)*32);
    return [INFRASTRUCTURE.wall.innerRadius,...(snapshot.outerWood?[INFRASTRUCTURE.wall.outerRadius]:[])]
      .some(radius=>Math.abs(Math.hypot(p.x,p.z)-radius)<2&&!wallIsGate(sector,snapshot.wallGates));
  };
  const clear=(p:Point,owner=-1)=>roadGroundSafe(p.x,p.z,hasRiver)&&!blockedByWall(p)
    &&!entrances.some((entrance,i)=>i!==owner&&entrance.contains(p))
    &&!huts.some(h=>Math.hypot(h.x-p.x,h.z-p.z)<3.3)
    &&!GROVE_SEEDS.some(tree=>Math.hypot(tree.x-p.x,tree.z-p.z)<3.1);
  const lineClear=(a:Point,b:Point,owner=-1)=>{
    const count=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.35));
    for(let j=0;j<=count;j++){const t=j/count;if(!clear({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t},owner))return false;}
    return true;
  };
  const points=Array.from({length:SIZE*SIZE},(_,i)=>({x:(i%SIZE-HALF)*STEP,z:(Math.floor(i/SIZE)-HALF)*STEP}));
  const safe=points.map(p=>clear(p)),heights=points.map(p=>roadHeight(p.x,p.z));
  const portalEdges=new Map<number,number[]>();
  const terminals=entrances.map((entry,owner)=>{
    if(!lineClear(entry.door,entry.approach,owner))return -1;
    const candidates=points.slice(0,SIZE*SIZE).map((p,id)=>({id,d:Math.hypot(p.x-entry.approach.x,p.z-entry.approach.z)}))
      .filter(c=>safe[c.id]&&c.d<6&&lineClear(entry.approach,points[c.id])).map(c=>c.id);
    if(!candidates.length)return -1;
    const id=points.length;points.push(entry.approach);safe.push(true);heights.push(roadHeight(entry.approach.x,entry.approach.z));
    portalEdges.set(id,candidates);
    for(const candidate of candidates)portalEdges.set(candidate,[...(portalEdges.get(candidate)??[]),id]);
    return id;
  });
  const bridgeLinks=new Set<string>();
  const portal=(p:Point)=>{
    if(!clear(p))return -1;
    const candidates=points.slice(0,SIZE*SIZE).flatMap((q,id)=>safe[id]&&Math.hypot(q.x-p.x,q.z-p.z)<7&&lineClear(p,q)?[id]:[]);
    if(!candidates.length)return -1;
    const id=points.length;points.push(p);safe.push(true);heights.push(roadHeight(p.x,p.z));portalEdges.set(id,candidates);
    for(const candidate of candidates)portalEdges.set(candidate,[...(portalEdges.get(candidate)??[]),id]);
    terminals.push(id);return id;
  };
  for(const harbor of transport.harbors)portal(harbor.land);
  for(const bridge of transport.bridges){
    const a=portal(bridge.a),b=portal(bridge.b);if(a<0||b<0)continue;
    bridgeLinks.add(`${Math.min(a,b)}/${Math.max(a,b)}`);
    portalEdges.get(a)!.push(b);portalEdges.get(b)!.push(a);
  }
  const edges=new Map<string,[number,number]>(),edgeSafety=new Map<string,boolean>();
  const edgeKey=(a:number,b:number)=>`${Math.min(a,b)}/${Math.max(a,b)}`;
  // Grow toward the nearest unconnected entrance from the entire existing street.
  // This shares lanes instead of making parallel routes back to a distant root.
  // Disconnected islands start their own local network; no invented sea crossings.
  const remaining=new Set(terminals.filter(id=>id>=0));
  while(remaining.size){
    const root=remaining.values().next().value!;remaining.delete(root);
    const network=new Set([root]);
    while(remaining.size){
    const costs=new Float64Array(points.length).fill(Infinity),previous=new Int32Array(points.length).fill(-1);
    const heap:{id:number;cost:number}[]=[];
    const push=(id:number,cost:number)=>{let i=heap.length;heap.push({id,cost});while(i){const p=(i-1)>>1;if(heap[p].cost<=cost)break;heap[i]=heap[p];i=p;}heap[i]={id,cost};};
    const pop=()=>{const first=heap[0],last=heap.pop()!;if(heap.length){let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&heap[c+1].cost<heap[c].cost)c++;if(heap[c].cost>=last.cost)break;heap[i]=heap[c];i=c;}heap[i]=last;}return first;};
    for(const id of network){costs[id]=0;push(id,0);}
    let reached=-1;
    while(heap.length){
      const current=pop();if(current.cost!==costs[current.id])continue;
      if(remaining.has(current.id)){reached=current.id;break;}
      const x=current.id%SIZE,z=Math.floor(current.id/SIZE);
      const adjacent=[...(portalEdges.get(current.id)??[])];
      if(current.id<SIZE*SIZE)for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
        const nx=x+dx,nz=z+dz;if(nx<0||nz<0||nx>=SIZE||nz>=SIZE)continue;
        const next=nz*SIZE+nx;if(!safe[next])continue;
        if(dx&&dz&&(!safe[z*SIZE+nx]||!safe[nz*SIZE+x]))continue;
        adjacent.push(next);
      }
      for(const next of adjacent){
        const key=edgeKey(current.id,next);
        let valid=edgeSafety.get(key);if(valid===undefined){valid=bridgeLinks.has(key)||lineClear(points[current.id],points[next]);edgeSafety.set(key,valid);}if(!valid)continue;
        const slope=Math.abs(heights[next]-heights[current.id])/STEP;
        const cost=current.cost+Math.hypot(points[next].x-points[current.id].x,points[next].z-points[current.id].z)/STEP*(1+slope*8+Math.max(0,heights[next]-3)*.5);
        if(cost<costs[next]){costs[next]=cost;previous[next]=current.id;push(next,cost);}
      }
    }
    if(reached<0)break;
    remaining.delete(reached);
    let id=reached;network.add(id);
    while(previous[id]>=0){const parent=previous[id];edges.set(edgeKey(id,parent),[id,parent]);network.add(parent);id=parent;}
    }
  }
  const segments:RoadSegment[]=[];
  // Small triangles follow the curved terrain even along long, straight streets.
  const append=(a:Point,b:Point)=>{
    const length=Math.hypot(b.x-a.x,b.z-a.z);if(length<.001)return;
    const count=Math.ceil(length/1.5);
    let last=a;for(let j=1;j<=count;j++){const next=j===count?b:{x:a.x+(b.x-a.x)*j/count,z:a.z+(b.z-a.z)*j/count};segments.push({a:last,b:next});last=next;}
  };
  // Water links are rendered as elevated bridge decks, never as dirt over the sea.
  for(const key of bridgeLinks)edges.delete(key);
  const neighbors=new Map<number,number[]>();
  for(const [a,b] of edges.values()){neighbors.set(a,[...(neighbors.get(a)??[]),b]);neighbors.set(b,[...(neighbors.get(b)??[]),a]);}
  const stops=new Set(terminals.filter(id=>id>=0));
  for(const [id,adjacent] of neighbors)if(adjacent.length!==2)stops.add(id);
  const walked=new Set<string>();
  for(const start of stops)for(const neighbor of neighbors.get(start)??[]){
    if(walked.has(edgeKey(start,neighbor)))continue;
    const chain=[start];let prior=start,next=neighbor;
    while(true){walked.add(edgeKey(prior,next));chain.push(next);if(stops.has(next))break;
      const following=neighbors.get(next)!.find(id=>id!==prior)!;prior=next;next=following;}
    // Remove grid stair-steps only where the entire shortcut has clearance.
    const chainEdges=new Set(chain.slice(1).map((id,i)=>edgeKey(chain[i],id)));
    const shortcut=(a:Point,b:Point)=>lineClear(a,b)&&![...edges.entries()].some(([key,[u,v]])=>{
      if(chainEdges.has(key))return false;
      const c=points[u],d=points[v],rx=b.x-a.x,rz=b.z-a.z,sx=d.x-c.x,sz=d.z-c.z,den=rx*sz-rz*sx;
      if(Math.abs(den)<1e-8)return false;
      const t=((c.x-a.x)*sz-(c.z-a.z)*sx)/den,q=((c.x-a.x)*rz-(c.z-a.z)*rx)/den;
      return t>.001&&t<.999&&q>.001&&q<.999;
    });
    const lane=[points[chain[0]]];
    let at=0;while(at<chain.length-1){let end=chain.length-1;while(end>at+1&&!shortcut(points[chain[at]],points[chain[end]]))end--;
      lane.push(points[chain[end]]);at=end;}
    let last=lane[0];
    for(let i=1;i<lane.length-1;i++){
      const a=lane[i-1],corner=lane[i],b=lane[i+1],la=Math.hypot(a.x-corner.x,a.z-corner.z),lb=Math.hypot(b.x-corner.x,b.z-corner.z),r=Math.min(1.4,la*.3,lb*.3);
      const before={x:corner.x+(a.x-corner.x)*r/la,z:corner.z+(a.z-corner.z)*r/la},after={x:corner.x+(b.x-corner.x)*r/lb,z:corner.z+(b.z-corner.z)*r/lb};
      const curve=Array.from({length:7},(_,j)=>{const t=j/6,u=1-t;return {x:u*u*before.x+2*u*t*corner.x+t*t*after.x,z:u*u*before.z+2*u*t*corner.z+t*t*after.z};});
      if(curve.slice(1).every((p,j)=>shortcut(curve[j],p))){append(last,before);for(let j=1;j<curve.length;j++)append(curve[j-1],curve[j]);last=after;}
      else {append(last,corner);last=corner;}
    }
    append(last,lane[lane.length-1]);
  }
  terminals.slice(0,entrances.length).forEach((id,i)=>{if(id>=0){append(entrances[i].door,entrances[i].approach);append(entrances[i].approach,points[id]);}});
  return segments;
}
const surface=(p:Point,lift:number)=>surfaceNormal(p.x,p.z).multiplyScalar(PLANET_RADIUS+roadHeight(p.x,p.z)+lift);
export class PlanetRoads{
  readonly group=new THREE.Group();
  private signature='';
  revision=0;
  segments:RoadSegment[]=[];
  private geometry:THREE.BufferGeometry[]=[];
  private materials:THREE.Material[]=[];
  constructor(parent:THREE.Group,private mobile:boolean){this.group.name='Fantasy dirt lanes and town paving';parent.add(this.group);}
  update(snapshot:TownSnapshot){
    const level=snapshot.roadLevel??(snapshot.roads<20?1:snapshot.roads<40?2:3);
    const signature=`${snapshot.roads}/${level}/${snapshot.riverLevel??0}/${snapshot.innerWood}/${snapshot.outerWood}/${snapshot.wallGates}/${snapshot.plots.filter(p=>p.stage>0).map(p=>`${p.id}:${p.stage}:${p.x}:${p.z}:${p.variant}`).join(',')}`;
    if(signature===this.signature)return;this.signature=signature;this.revision++;this.clear();
    const segments=this.segments=routePlanetRoads(snapshot);if(!segments.length)return;
    const positions:number[]=[],colors:number[]=[],earth=new THREE.Color();
    for(const {a,b} of segments){
      const dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz),nx=dz/length,nz=-dx/length;
      const width=.72;
      const corners=[{x:a.x+nx*width,z:a.z+nz*width},{x:a.x-nx*width,z:a.z-nz*width},{x:b.x+nx*width,z:b.z+nz*width},{x:b.x-nx*width,z:b.z-nz*width}];
      for(const i of [0,1,2,2,1,3]){const p=corners[i];positions.push(...surface(p,.13).toArray());earth.set(0xb19a70).multiplyScalar(.95+.05*Math.sin(p.x*.6+p.z*.8));colors.push(earth.r,earth.g,earth.b);}
    }
    // Round the shared junctions so diagonal turns read as worn footpaths.
    const junctions=new Map(segments.flatMap(({a,b})=>[a,b]).map(p=>[`${p.x}/${p.z}`,p]));
    for(const center of junctions.values())for(let i=0;i<10;i++){
      const corners=[center,...[i,i+1].map(j=>({x:center.x+Math.cos(j/10*Math.PI*2)*.72,z:center.z+Math.sin(j/10*Math.PI*2)*.72}))];
      for(const p of corners){positions.push(...surface(p,.13).toArray());earth.set(0xb19a70).multiplyScalar(.95+.05*Math.sin(p.x*.6+p.z*.8));colors.push(earth.r,earth.g,earth.b);}
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.computeVertexNormals();this.geometry.push(geo);
    const dirt=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,side:THREE.DoubleSide});this.materials.push(dirt);
    const mesh=new THREE.Mesh(geo,dirt);mesh.name='Worn earth paths';mesh.receiveShadow=true;this.group.add(mesh);
    const stones:Point[]=[];const reach=stoneReach(level);
    for(const {a,b} of segments){const length=Math.hypot(b.x-a.x,b.z-a.z),count=Math.ceil(length/.8);for(let i=0;i<count;i++){const t=(i+.5)/count,x=THREE.MathUtils.lerp(a.x,b.x,t),z=THREE.MathUtils.lerp(a.z,b.z,t);if(Math.hypot(x,z)>reach)continue;const dx=(b.z-a.z)/length,dz=-(b.x-a.x)/length;for(const side of [-1,1])stones.push({x:x+dx*side*.29,z:z+dz*side*.29});}}
    if(stones.length){
      const stoneGeo=new THREE.CylinderGeometry(.36,.4,.12,this.mobile?5:7);this.geometry.push(stoneGeo);
      const stoneMat=new THREE.MeshStandardMaterial({color:0xffffff,roughness:1});this.materials.push(stoneMat);
      const cobbles=new THREE.InstancedMesh(stoneGeo,stoneMat,stones.length),dummy=new THREE.Object3D(),color=new THREE.Color();
      stones.forEach((p,i)=>{dummy.position.copy(surface(p,.23));dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),surfaceNormal(p.x,p.z));dummy.rotateY(i*2.39);dummy.scale.set(.85+.15*Math.sin(i*17),1,.78);dummy.updateMatrix();cobbles.setMatrixAt(i,dummy.matrix);color.set(0xb7b09b).multiplyScalar(.88+(Math.sin(i*13)+1)*.1);cobbles.setColorAt(i,color);});
      cobbles.name='Irregular town cobblestones';cobbles.receiveShadow=true;this.group.add(cobbles);
    }
    this.group.traverse(o=>o.userData.planetNative=true);
  }
  private clear(){this.group.traverse(o=>{if(o instanceof THREE.InstancedMesh)o.dispose();});this.geometry.forEach(g=>g.dispose());this.materials.forEach(m=>m.dispose());this.geometry=[];this.materials=[];this.group.clear();}
  dispose(){this.clear();this.group.removeFromParent();}
}
