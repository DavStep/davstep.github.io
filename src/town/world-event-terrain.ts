import * as THREE from 'three';
import { MINING_SITE, PLANET_RADIUS, planetElevation, surfaceNormal } from './planet-geography';
import { planetTransportLayout } from './planet-transport-layout';
import type { RoadPoint } from './planet-building-access';

/** Coordinates are in the same stereographic source plane as roads and buildings. */
export const CARAVAN_BRIDGE=planetTransportLayout().bridges.find(bridge=>bridge.id==='western-island')!;
export const WORLD_EVENT_SITES={
  // Surveyed summit of the existing range immediately above MINING_SITE (-94,56).
  volcano:{x:-88,z:45},pass:{x:-87,z:54},shrine:{x:-103,z:66},
  orchard:{x:-13,z:30},islandChest:{x:-37,z:104},townDisplay:{x:-35,z:6},
  wizard:{x:-45,z:120},
} satisfies Record<string,RoadPoint>;
export const EMBER_SEAM:RoadPoint={x:-88,z:51};
export const CARAVAN_PATH:RoadPoint[]=[WORLD_EVENT_SITES.townDisplay,CARAVAN_BRIDGE.a,CARAVAN_BRIDGE.b,{x:-76,z:54},WORLD_EVENT_SITES.pass,{x:-98,z:59},WORLD_EVENT_SITES.shrine];
export const SAFE_LAVA_PATH:RoadPoint[]=[WORLD_EVENT_SITES.volcano,{x:-94,z:46},{x:-101,z:48},{x:-106,z:50},{x:-110,z:51}];
export const DAMAGING_LAVA_PATH:RoadPoint[]=[WORLD_EVENT_SITES.volcano,{x:-86,z:49},WORLD_EVENT_SITES.pass,{x:-89,z:59}];
/** Rejoins the original lane on each side; original black lava is never removed. */
export const BYPASS_PATH:RoadPoint[]=[{x:-76,z:54},{x:-78,z:61},{x:-87,z:64},{x:-96,z:64},{x:-98,z:59}];
export interface EventTerrainState {
  volcano:'quiet'|'warning'|'contained'|'blocked'|'bypassed';
  prepared:boolean;
  orchard:'healthy'|'scorched'|'restored';
  corePresent:boolean;
  orchardActive?:boolean;
  routeOpen?:boolean;
}
const INITIAL:EventTerrainState={volcano:'quiet',prepared:false,orchard:'healthy',corePresent:true,orchardActive:false};
const up=new THREE.Vector3(0,1,0);
const position=(p:RoadPoint,lift=0)=>{const n=surfaceNormal(p.x,p.z);return n.multiplyScalar(PLANET_RADIUS+planetElevation(n)+lift);};

export interface LavaGradeSample {point:RoadPoint;height:number;distance:number}
/** A surveyed raised channel bed clears its full footprint and always drains downhill.
 * Backward grading fills low saddles instead of making lava climb the next ridge. */
function gradeLava(path:RoadPoint[],width:number):LavaGradeSample[]{
  const result:LavaGradeSample[]=[];let distance=0;
  for(let i=1;i<path.length;i++){
    const a=path[i-1],b=path[i],dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz),steps=Math.ceil(length/.3);
    for(let j=i===1?0:1;j<=steps;j++){
      const point={x:a.x+dx*j/steps,z:a.z+dz*j/steps};
      const height=Math.max(...[-1,0,1].map(side=>planetElevation(surfaceNormal(point.x-dz/length*width*side,point.z+dx/length*width*side))))+.16;
      result.push({point,height,distance:distance+length*j/steps});
    }
    distance+=length;
  }
  for(let i=result.length-2;i>=0;i--)result[i].height=Math.max(result[i].height,result[i+1].height+(result[i+1].distance-result[i].distance)*.008);
  return result;
}
export const SAFE_LAVA_GRADE=gradeLava(SAFE_LAVA_PATH,1.35);
export const DAMAGING_LAVA_GRADE=gradeLava(DAMAGING_LAVA_PATH,1.35);
export function gradeHeight(profile:LavaGradeSample[],p:RoadPoint){
  let closest=Infinity,height=profile[0].height;
  for(let i=1;i<profile.length;i++){
    const a=profile[i-1],b=profile[i],dx=b.point.x-a.point.x,dz=b.point.z-a.point.z;
    const t=THREE.MathUtils.clamp(((p.x-a.point.x)*dx+(p.z-a.point.z)*dz)/(dx*dx+dz*dz),0,1);
    const distance=(p.x-a.point.x-dx*t)**2+(p.z-a.point.z-dz*t)**2;
    if(distance<closest){closest=distance;height=a.height+(b.height-a.height)*t;}
  }
  return height;
}

/** Authored, finite geometry. Updates project saved state; animation cannot mutate history. */
export function createWorldEventTerrain(parent:THREE.Group,mobile:boolean){
  const group=new THREE.Group();group.name='Persistent world event terrain';parent.add(group);
  const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
  const geo=<T extends THREE.BufferGeometry>(g:T)=>{geometries.add(g);return g;};
  const mat=(color:number,emissive=0)=>{const m=new THREE.MeshStandardMaterial({color,emissive,emissiveIntensity:emissive?1:0,roughness:.92});materials.add(m);return m;};
  const basalt=mat(0x625349),cooled=mat(0x342b28),stone=mat(0x998878),earth=mat(0x9f8967),charcoal=mat(0x322724),wood=mat(0x795638);
  const lava=mat(0xb83b17,0x952207),seamMaterial=mat(0xffb34c,0xff690d),leaf=mat(0x608847),fruit=mat(0xe7a03c),newLeaf=mat(0x7da950);
  const variedRock=mat(0xffffff);variedRock.vertexColors=true;
  const smokeMaterial=new THREE.MeshStandardMaterial({color:0x777078,transparent:true,opacity:.4,depthWrite:false,roughness:1});materials.add(smokeMaterial);
  const sections=(name:string)=>{const g=new THREE.Group();g.name=name;group.add(g);return g;};
  const permanent=sections('Crater and exposed mountain seam');
  const wagonRoad=sections('Mountain wagon route');
  const furnace=sections('Working geothermal mine furnace');
  const works=sections('Engineered diversion masonry gate and basin');
  const contained=sections('Contained lava and cooled safe channel');
  const damage=sections('Permanent black lava field and ruined original pass');
  const barricade=sections('Closed mountain freight barricade');
  const bypass=sections('Excavated mountain bypass');
  const healthy=sections('Healthy harbor orchard');
  const burned=sections('Scorched harbor orchard ground and stumps');
  const restored=sections('Restored orchard with charcoal history');
  const core=sections('Ember core in exposed seam');
  const emptySeam=sections('Empty crystal seam after harvest');
  const smoke=sections('Volcanic smoke');
  function meshAt(target:THREE.Group,g:THREE.BufferGeometry,m:THREE.Material,p:RoadPoint,lift:number,scale?:[number,number,number]){
    const mesh=new THREE.Mesh(g,m);mesh.position.copy(position(p,lift));mesh.quaternion.setFromUnitVectors(up,surfaceNormal(p.x,p.z));
    if(scale)mesh.scale.set(...scale);mesh.castShadow=!mobile;mesh.receiveShadow=true;target.add(mesh);return mesh;
  }
  function ribbon(target:THREE.Group,path:RoadPoint[],width:number,lift:number,m:THREE.Material,name:string,grade?:LavaGradeSample[]){
    const vertices:number[]=[],colors:number[]=[],solid=Boolean(grade&&m===cooled),glow=Boolean(grade&&m===lava);
    const tone=new THREE.Color();
    const elevated=(p:RoadPoint)=>grade?surfaceNormal(p.x,p.z).multiplyScalar(PLANET_RADIUS+gradeHeight(grade,p)+lift):position(p,lift);
    const face=(a:THREE.Vector3,b:THREE.Vector3,c:THREE.Vector3,shade:number)=>{
      tone.setHex(0x57463b).multiplyScalar(shade);
      for(const v of [a,b,c]){vertices.push(v.x,v.y,v.z);colors.push(tone.r,tone.g,tone.b);}
    };
    let walked=0;
    for(let i=1;i<path.length;i++){
      const a=path[i-1],b=path[i],dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz),count=Math.max(1,Math.ceil(length/.45));
      for(let j=0;j<count;j++){
        const distance=walked+length*j/count;
        // Irregular disconnected embers read as cracks through crust, not painted stripes.
        if(glow&&Math.floor(distance*2)%13>8)continue;
        const corners=[j/count,(j+1)/count].flatMap(t=>[-1,1].map(side=>{
          const d=walked+length*t;
          const spread=grade?(glow?.36+.22*Math.sin(d*2.3):.8+.13*Math.sin(d*2.1+side)+.06*Math.sin(d*5.3-side)):1;
          const shift=glow?width*.4*Math.sin(d*1.9):0;
          return {x:a.x+dx*t-dz/length*(width*spread*side+shift),z:a.z+dz*t+dx/length*(width*spread*side+shift)};
        }));
        const top=corners.map(elevated),shade=.86+.14*Math.sin(distance*3.7);
        face(top[0],top[1],top[2],shade);face(top[2],top[1],top[3],shade+.09);
        if(solid)for(const side of [0,1]){
          const floorA=position(corners[side],.025),floorB=position(corners[side+2],.025);
          face(top[side],floorA,top[side+2],shade*.8);face(top[side+2],floorA,floorB,shade*.8);
        }
      }
      walked+=length;
    }
    // Round joins and ends; irregular crust lobes end in grounded side faces.
    if(m===earth||solid)for(let n=0;n<path.length;n++){
      const center=path[n],top=elevated(center),count=solid?13:12;
      for(let j=0;j<count;j++){
        const points=[j,j+1].map(k=>{const angle=k/count*Math.PI*2,r=width*(solid?.82+.15*Math.sin(k*2.7+n):1.025);return{x:center.x+Math.cos(angle)*r,z:center.z+Math.sin(angle)*r};});
        const a=elevated(points[0]),b=elevated(points[1]);face(top,a,b,.85+.13*Math.sin(j*2.3));
        if(solid){const ga=position(points[0],.025),gb=position(points[1],.025);face(a,ga,b,.72);face(b,ga,gb,.72);}
      }
    }
    const g=geo(new THREE.BufferGeometry());g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    if(solid)g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();
    const mesh=new THREE.Mesh(g,solid?variedRock:m);mesh.name=name;mesh.material.side=THREE.DoubleSide;mesh.receiveShadow=true;target.add(mesh);return mesh;
  }
  const box=geo(new THREE.BoxGeometry(1,1,1)),rock=geo(new THREE.DodecahedronGeometry(1,0)),trunk=geo(new THREE.CylinderGeometry(.17,.26,1.5,5));
  type Piece={p:RoadPoint;lift:number;scale:[number,number,number];turn?:number;lean?:number};
  function instances(target:THREE.Group,g:THREE.BufferGeometry,m:THREE.Material,pieces:Piece[],name:string){
    const mesh=new THREE.InstancedMesh(g,m,pieces.length),dummy=new THREE.Object3D();mesh.name=name;
    pieces.forEach((piece,i)=>{dummy.position.copy(position(piece.p,piece.lift));dummy.quaternion.setFromUnitVectors(up,surfaceNormal(piece.p.x,piece.p.z));dummy.rotateY(piece.turn??0);dummy.rotateZ(piece.lean??0);dummy.scale.set(...piece.scale);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});
    mesh.castShadow=!mobile;mesh.receiveShadow=true;target.add(mesh);return mesh;
  }
  const pedestal=instances(permanent,box,stone,[
    {p:WORLD_EVENT_SITES.islandChest,lift:.12,scale:[2.4,.24,1.8]},
    {p:WORLD_EVENT_SITES.islandChest,lift:.33,scale:[2,.18,1.4]},
  ],'Permanent island chest pedestal');
  pedestal.userData.topLift=.42;
  meshAt(permanent,box,cooled,WORLD_EVENT_SITES.islandChest,.425,[1.55,.01,.95]).name='Empty chest footprint on island pedestal';
  // Faceted flank rings merge into the real mountain instead of a smooth cone shell.
  const summitHeight=planetElevation(surfaceNormal(WORLD_EVENT_SITES.volcano.x,WORLD_EVENT_SITES.volcano.z));
  const flankVertices:number[]=[],flankColors:number[]=[],flankTone=new THREE.Color();
  const flankCount=mobile?20:28;
  const flankRings=Array.from({length:3},(_,ring)=>Array.from({length:flankCount},(_,i)=>{
    const angle=i/flankCount*Math.PI*2,radius=ring===0?2.3:ring===1?3.9+.5*Math.sin(i*2.1):5.7+.65*Math.sin(i*2.7)+.3*Math.cos(i*4.1);
    const p={x:WORLD_EVENT_SITES.volcano.x+Math.cos(angle)*radius,z:WORLD_EVENT_SITES.volcano.z+Math.sin(angle)*radius};
    const normal=surfaceNormal(p.x,p.z),ground=planetElevation(normal);
    let height=ring===0?summitHeight+.32:ring===1?Math.max(ground+.09,ground*.5+(summitHeight+.18)*.5):ground+.035;
    // Leave the two authored outflow mouths exposed instead of burying their grade.
    for(const profile of [SAFE_LAVA_GRADE,DAMAGING_LAVA_GRADE])if(profile.some(sample=>Math.hypot(sample.point.x-p.x,sample.point.z-p.z)<1.4))height=Math.min(height,gradeHeight(profile,p)+.1);
    return normal.multiplyScalar(PLANET_RADIUS+height);
  }));
  for(let ring=0;ring<2;ring++)for(let i=0;i<flankCount;i++){
    const next=(i+1)%flankCount;
    for(const triangle of [[flankRings[ring][i],flankRings[ring+1][i],flankRings[ring][next]],[flankRings[ring][next],flankRings[ring+1][i],flankRings[ring+1][next]]]){
      flankTone.setHex(0x66574b).multiplyScalar(.86+.13*Math.sin(i*2.4+ring));
      for(const v of triangle){flankVertices.push(v.x,v.y,v.z);flankColors.push(flankTone.r,flankTone.g,flankTone.b);}
    }
  }
  const flankGeometry=geo(new THREE.BufferGeometry());flankGeometry.setAttribute('position',new THREE.Float32BufferAttribute(flankVertices,3));flankGeometry.setAttribute('color',new THREE.Float32BufferAttribute(flankColors,3));flankGeometry.computeVertexNormals();
  const flank=new THREE.Mesh(flankGeometry,variedRock);flank.name='Grounded irregular faceted basalt crater flanks';flank.receiveShadow=true;permanent.add(flank);
  const rim:Piece[]=[];
  for(let i=0;i<20;i++){
    const angle=i*Math.PI/10,p={x:WORLD_EVENT_SITES.volcano.x+Math.cos(angle)*2.4,z:WORLD_EVENT_SITES.volcano.z+Math.sin(angle)*2.4};
    // One continuous radial lip, rather than rocks dropping down individual slopes.
    rim.push({p,lift:summitHeight+.37-planetElevation(surfaceNormal(p.x,p.z)),scale:[.46,.32,.42],turn:angle});
  }
  instances(permanent,rock,basalt,rim,'Always visible jagged volcanic crater');
  const innerLip=geo(new THREE.TorusGeometry(1.52,.2,5,mobile?16:24));innerLip.rotateX(Math.PI/2);
  meshAt(permanent,innerLip,basalt,WORLD_EVENT_SITES.volcano,.38).name='Continuous hollow crater lip';
  meshAt(permanent,geo(new THREE.CylinderGeometry(1.5,1.6,.12,20)),cooled,WORLD_EVENT_SITES.volcano,.28).name='Dark crater mouth';
  ribbon(permanent,[WORLD_EVENT_SITES.volcano,{x:-89,z:47},{x:-91,z:48.5}],.14,.2,lava,'Permanent exposed volcanic fissure');
  ribbon(permanent,[{x:-85,z:50},{x:-88,z:51},{x:-91,z:53}],.34,.22,basalt,'Exposed seam stone socket');
  meshAt(core,geo(new THREE.OctahedronGeometry(.72)),seamMaterial,EMBER_SEAM,.6,[.65,1.5,.65]).name='Glowing mountain Ember Core';
  ribbon(emptySeam,[{x:-85,z:50},{x:-88,z:51},{x:-91,z:53}],.12,.25,cooled,'Dark empty seam scar');
  // The existing surveyed bridge owns the water deck; this road never paints water.
  for(let i=1;i<CARAVAN_PATH.length;i++)if(i!==2)ribbon(wagonRoad,[CARAVAN_PATH[i-1],CARAVAN_PATH[i]],.85,.16,earth,'Authored mountain wagon road');
  ribbon(bypass,BYPASS_PATH,.92,.2,earth,'Open recovery wagon bypass');
  const masonry:Piece[]=[];
  for(let i=1;i<SAFE_LAVA_PATH.length;i++){
    const a=SAFE_LAVA_PATH[i-1],b=SAFE_LAVA_PATH[i],dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz),count=Math.ceil(length/1.3);
    for(let j=0;j<=count;j++)for(const side of [-1,1])masonry.push({p:{x:a.x+dx*j/count-dz/length*1.1*side,z:a.z+dz*j/count+dx/length*1.1*side},lift:.35,scale:[.75,.65,.7],turn:Math.atan2(dx,dz)});
  }
  const basin=SAFE_LAVA_PATH[SAFE_LAVA_PATH.length-1];
  for(let i=0;i<24;i++){const a=i*Math.PI/12;masonry.push({p:{x:basin.x+Math.cos(a)*3,z:basin.z+Math.sin(a)*3},lift:.35,scale:[.7,.8,.7]});}
  for(const piece of masonry){
    const bed=gradeHeight(SAFE_LAVA_GRADE,piece.p),floor=planetElevation(surfaceNormal(piece.p.x,piece.p.z));
    const top=Math.max(.8,bed-floor+.8);piece.lift=top/2;piece.scale[1]=top;
  }
  instances(works,box,stone,masonry,'Reinforced channel walls and collection basin');
  meshAt(works,box,stone,{x:-94,z:46},1.1,[.45,1.9,2.2]).name='Raised diversion control gate';
  meshAt(works,box,wood,MINING_SITE,.5,[1.4,.8,1.2]).name='Dwarf excavation tool bench';
  ribbon(contained,SAFE_LAVA_PATH,.86,.2,cooled,'Cooled rock retained inside safe diversion',SAFE_LAVA_GRADE);
  ribbon(contained,SAFE_LAVA_PATH,.35,.25,lava,'Glowing engineered lava channel',SAFE_LAVA_GRADE);
  meshAt(contained,geo(new THREE.CylinderGeometry(1.65,1.7,.15,20)),lava,basin,.3).name='Safe molten collection basin';
  ribbon(damage,DAMAGING_LAVA_PATH,1.3,.25,cooled,'Black cooled lava across original wagon pass',DAMAGING_LAVA_GRADE);
  ribbon(damage,DAMAGING_LAVA_PATH,.22,.3,lava,'Residual glow in damaged lava field',DAMAGING_LAVA_GRADE);
  for(const [target,profile,width] of [[contained,SAFE_LAVA_GRADE,.82],[damage,DAMAGING_LAVA_GRADE,1.18]] as const){
    const chunks:Piece[]=[];
    for(let i=3;i<profile.length;i+=mobile?7:5)for(const side of [-1,1]){
      const a=profile[i-1].point,b=profile[i].point,dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz),p={x:b.x-dz/d*width*side,z:b.z+dx/d*width*side};
      chunks.push({p,lift:gradeHeight(profile,p)-planetElevation(surfaceNormal(p.x,p.z))+.25,scale:[.22+.08*Math.sin(i),.19+.06*Math.cos(i),.29],turn:i*1.8});
    }
    instances(target,rock,basalt,chunks,'Broken basalt clasts along cooled lava margins');
  }
  // Compact furnace: one instanced masonry arch, chimney, firebox and heat pipes.
  const furnaceSite={x:MINING_SITE.x-5,z:MINING_SITE.z+2};
  const furnaceBlocks:Piece[]=[];
  for(const side of [-1,1])for(let y=0;y<3;y++)furnaceBlocks.push({p:{x:furnaceSite.x+side*1.05,z:furnaceSite.z},lift:.4+y*.65,scale:[.7,.65,1.5]});
  for(let x=-1;x<=1;x++)furnaceBlocks.push({p:{x:furnaceSite.x+x*.8,z:furnaceSite.z},lift:2.15-Math.abs(x)*.13,scale:[.8,.65,1.5],turn:x*.15});
  instances(furnace,box,stone,furnaceBlocks,'Stone arch around open geothermal firebox');
  meshAt(furnace,box,cooled,furnaceSite,.9,[1.4,1.4,1]).name='Deep open furnace mouth';
  meshAt(furnace,box,lava,{x:furnaceSite.x,z:furnaceSite.z+.8},.8,[1.1,.9,.16]).name='Orange fire visible inside open furnace';
  meshAt(furnace,geo(new THREE.CylinderGeometry(.48,.7,3.6,8)),stone,{x:furnaceSite.x,z:furnaceSite.z-.5},3.2).name='Tall geothermal furnace chimney';
  meshAt(furnace,geo(new THREE.CylinderGeometry(.42,.42,.08,8)),cooled,{x:furnaceSite.x,z:furnaceSite.z-.5},5.02).name='Black open chimney top';
  const pipePieces:Piece[]=[];
  // Short box sections share the existing geometry and material; no TubeGeometry budget.
  const pipeLength=Math.hypot(furnaceSite.x-basin.x,furnaceSite.z-basin.z),pipeSteps=Math.ceil(pipeLength/.7);
  for(let i=0;i<=pipeSteps;i++)for(const side of [-1,1])pipePieces.push({p:{x:basin.x+(furnaceSite.x-basin.x)*i/pipeSteps+side*.28,z:basin.z+(furnaceSite.z-basin.z)*i/pipeSteps},lift:.35,scale:[.22,.22,.8],turn:Math.atan2(furnaceSite.x-basin.x,furnaceSite.z-basin.z)});
  instances(furnace,box,basalt,pipePieces,'Twin geothermal heat pipes from collection basin to mine');
  const barriers:Piece[]=[-1,1].map(side=>({p:{x:-87+side*2.8,z:54},lift:.65,scale:[.3,1.2,2.5]}));
  instances(barricade,box,wood,barriers,'Freight halted on both sides of pass');
  const orchardPoints=Array.from({length:6},(_,i)=>({x:WORLD_EVENT_SITES.orchard.x+(i%3-1)*2.8,z:WORLD_EVENT_SITES.orchard.z+(Math.floor(i/3)-.5)*3}));
  const trunks=orchardPoints.map(p=>({p,lift:.75,scale:[1,1,1] as [number,number,number]}));
  const crowns=orchardPoints.map((p,i)=>({p,lift:2,scale:[1.1,1.2+(i%2)*.2,1.1] as [number,number,number]}));
  instances(healthy,trunk,wood,trunks,'Fruit tree trunks');instances(healthy,rock,leaf,crowns,'Fruit bearing green orchard');
  instances(healthy,rock,fruit,orchardPoints.map(p=>({p:{x:p.x+.5,z:p.z+.45},lift:2,scale:[.22,.22,.22]})),'Golden orchard fruit');
  // Broad organic scorch with a muted soil edge, following the actual orchard ground.
  const ashVertices:number[]=[],ashColors:number[]=[],ashTone=new THREE.Color(),ashCenter=WORLD_EVENT_SITES.orchard;
  const ashRings=Array.from({length:3},(_,ring)=>Array.from({length:20},(_,i)=>{
    const angle=i/20*Math.PI*2,shape=1+.075*Math.sin(i*2.1)+.04*Math.cos(i*3.7),radius=ring===0?0:ring===1?.74:1;
    return {x:ashCenter.x+Math.cos(angle)*5.3*radius*shape,z:ashCenter.z+Math.sin(angle)*3.7*radius*shape};
  }));
  for(let ring=0;ring<2;ring++)for(let i=0;i<20;i++)for(const indices of [[0,1,2],[2,1,3]]){
    const next=(i+1)%20,points=[ashRings[ring][i],ashRings[ring+1][i],ashRings[ring][next],ashRings[ring+1][next]];
    for(const index of indices){const p=points[index],v=position(p,.1);ashVertices.push(v.x,v.y,v.z);ashTone.setHex(ring===1&&index%2===1?0x806b4f:0x443b30).multiplyScalar(.95+.05*Math.sin(i*2.1));ashColors.push(ashTone.r,ashTone.g,ashTone.b);}
  }
  const ashGeometry=geo(new THREE.BufferGeometry());ashGeometry.setAttribute('position',new THREE.Float32BufferAttribute(ashVertices,3));ashGeometry.setAttribute('color',new THREE.Float32BufferAttribute(ashColors,3));ashGeometry.computeVertexNormals();
  const ash=new THREE.Mesh(ashGeometry,variedRock);ash.name='Irregular scorched orchard soil and feathered ash edge';ash.receiveShadow=true;burned.add(ash);
  instances(burned,trunk,charcoal,trunks.map((p,i)=>({...p,lift:1.02,scale:[1.15,1.35+(i%2)*.25,1.15]})),'Blackened orchard stumps');
  const deadBranches:Piece[]=[];
  for(let i=0;i<orchardPoints.length;i++)for(const side of [-1,1])deadBranches.push({p:{x:orchardPoints[i].x+side*.4,z:orchardPoints[i].z},lift:1.45+(i%2)*.25,scale:[.14,1,.15],lean:side*.8,turn:i*.7});
  instances(burned,box,charcoal,deadBranches,'Broken branches on standing charcoal snags');
  instances(burned,box,charcoal,orchardPoints.filter((_,i)=>i%2===0).map((p,i)=>({p:{x:p.x+.75,z:p.z+.5},lift:.19,scale:[1.2,.15,.17],turn:i*1.9})),'Fallen scorched orchard limbs');
  instances(burned,rock,basalt,orchardPoints.map((p,i)=>({p:{x:p.x-.7,z:p.z+.65},lift:.18,scale:[.3,.2,.23],turn:i})),'Orchard ash and fire cracked stones');
  instances(restored,trunk,wood,trunks.slice(1),'Replanted orchard trunks');instances(restored,rock,newLeaf,crowns.slice(1),'Restored productive green orchard');
  instances(restored,rock,fruit,orchardPoints.slice(1).map(p=>({p:{x:p.x+.5,z:p.z+.45},lift:2,scale:[.22,.22,.22]})),'Fruit after orchard restoration');
  meshAt(restored,trunk,charcoal,orchardPoints[0],1.02,[1.2,1.35,1.2]).name='Preserved charcoal stump after restoration';
  instances(restored,box,charcoal,deadBranches.slice(0,2),'Preserved branches on restored orchard charcoal snag');
  const puffs:THREE.Mesh[]=[];
  for(let i=0;i<(mobile?3:5);i++){const puff=meshAt(smoke,rock,smokeMaterial,WORLD_EVENT_SITES.volcano,2+i*1.4,[.65+i*.2,.55+i*.15,.65+i*.2]);puffs.push(puff);}
  const smokeNormal=surfaceNormal(WORLD_EVENT_SITES.volcano.x,WORLD_EVENT_SITES.volcano.z),smokeRadius=PLANET_RADIUS+planetElevation(smokeNormal);
  let current:EventTerrainState=INITIAL;
  function update(state:EventTerrainState){
    current={...state};works.visible=state.prepared||state.volcano==='bypassed';contained.visible=state.volcano==='contained';
    wagonRoad.visible=state.routeOpen!==false;furnace.visible=state.volcano==='contained'||state.volcano==='bypassed';
    damage.visible=state.volcano==='blocked'||state.volcano==='bypassed';barricade.visible=damage.visible;bypass.visible=state.volcano==='bypassed';
    healthy.visible=state.orchard==='healthy'&&state.orchardActive!==false;burned.visible=state.orchard==='scorched';restored.visible=state.orchard==='restored';
    core.visible=state.corePresent;emptySeam.visible=!state.corePresent;
    // After a reload render() is optional: the warning is already visually stronger.
    smokeMaterial.opacity=state.volcano==='warning'?.65:.35;
  }
  function render(timeSeconds:number,reduced:boolean){
    const t=reduced||!Number.isFinite(timeSeconds)?0:timeSeconds;
    const strength=current.volcano==='warning'?1.5:1;
    for(let i=0;i<puffs.length;i++){
      const phase=reduced?i*1.4:(t*.38+i*1.4)%7;
      puffs[i].position.copy(smokeNormal).multiplyScalar(smokeRadius+2+phase);
      const size=(.6+phase*.15)*strength;puffs[i].scale.set(size,size*.8,size);
    }
    lava.emissiveIntensity=reduced?.6:.6+Math.sin(t*1.4)*.08;
    seamMaterial.emissiveIntensity=reduced?1:1+Math.sin(t*1.7)*.18;
  }
  group.traverse(object=>{object.userData.planetNative=true;});update(INITIAL);render(0,true);
  function dispose(){group.traverse(o=>{if(o instanceof THREE.InstancedMesh)o.dispose();});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());group.clear();group.removeFromParent();}
  return {group,update,render,dispose};
}
