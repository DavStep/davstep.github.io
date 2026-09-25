import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PLOTS, WALL_SEGMENTS, type PlotState, type TownSnapshot } from './model';
import { INFRASTRUCTURE, accessPathFor, millAccessDistance } from './town-plan';
import type { ProjectKey } from './projects';
import { C, MAT, type Mat } from './materials';
import { Environment, terrainHeight, naturalTerrainHeight, isWater } from './environment';
import { ContactShadows, type ContactFootprint } from './contact-shadows';
import { TownSky } from './sky';
import { Rain } from './rain';
import { ConstructionEffects } from './construction-effects';
import { ParachuteArrival, isSandshipArrival, SANDSHIP_ARRIVAL_MS } from './parachute-arrival';
import { AUTHORED_LANDMARK_SHARED_GEOMETRIES, authoredLandmarkBuilding } from './authored-landmarks';
import { COTTAGE_SHARED_GEOMETRIES, cottageBuilding, gameCottageBuilding } from './cottages';
import { CASTLE_SHARED_GEOMETRIES, castleBuilding } from './castle';
import { CIVIC_SHARED_GEOMETRIES, civicBuilding } from './civic';
import { NATURE_SHARED_GEOMETRIES } from './nature';
import { PROPS_SHARED_GEOMETRIES } from './props';
import { placeProp, placeLanterns, placeFenceSections } from './prop-placement';
import { addNatureInstances, type NaturePlacement } from './nature-placement';
import { wallIsGate, wallSection, wallSectionFlooded } from './wall-layout';
import { pathRibbon, linePoints, ringPoints } from './paths';
import { TerrainSurface } from './terrain-surface';
import { IDEA_DISTRICTS, districtForPlot, type DistrictIdea } from './idea-districts';
import { isLivingWorldSite } from './living-world-state';
import { moatDistance } from './moat-layout';
import { isMountWorksite } from './landscape-state';
import { MILL_POOL, millStreamDistance } from './game-path';
const MOBILE=matchMedia('(max-width: 700px)').matches;
const boxGeometry = new RoundedBoxGeometry(1,1,1,2,.08);
const plainBoxGeometry = new THREE.BoxGeometry(1,1,1);
const sphereGeometry = new THREE.IcosahedronGeometry(1,1);
const coneGeometry = new THREE.ConeGeometry(1,1,6);
const towerBodyGeometry=new THREE.CylinderGeometry(1.02,1.18,1,10);
const towerRingGeometry=new THREE.CylinderGeometry(1.3,1.22,.23,10);
const daylightSun=new THREE.Color(0xfff2d7),overcastSun=new THREE.Color(0xdce5f0),nightSun=new THREE.Color(0x9bb6e2);
const overcastFill=new THREE.Color(0xd0d7e4),nightFill=new THREE.Color(0x8198c4),nightGround=new THREE.Color(0x59657d);
const overcastFog=new THREE.Color(0xbac5ce),nightFog=new THREE.Color(0x52647c);
function box(parent: THREE.Group, x:number,y:number,z:number,w:number,h:number,d:number,material:Mat, rotateY=0, rounded=true): THREE.Mesh {
  const mesh = new THREE.Mesh(rounded&&!MOBILE ? boxGeometry : plainBoxGeometry, material);
  mesh.position.set(x,y,z); mesh.scale.set(w,h,d); mesh.rotation.y=rotateY;
  mesh.castShadow=true; mesh.receiveShadow=true; parent.add(mesh); return mesh;
}
function ball(parent:THREE.Group,x:number,y:number,z:number,sx:number,sy:number,sz:number,material:Mat): THREE.Mesh {
  const mesh = new THREE.Mesh(sphereGeometry,material); mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function beam(parent:THREE.Group,x1:number,y1:number,z:number,x2:number,y2:number,width:number,depth:number,material:Mat){
  const length=Math.hypot(x2-x1,y2-y1);
  const mesh=box(parent,(x1+x2)*.5,(y1+y2)*.5,z,width,length,depth,material,0,false);
  mesh.rotation.z=-Math.atan2(x2-x1,y2-y1);return mesh;
}
function stoneFooting(parent:THREE.Group,w:number,d:number){
  box(parent,0,.37,d*.5+.025,w+.16,.5,.2,MAT.stoneDark,0,false);
  box(parent,0,.37,-d*.5-.025,w+.16,.5,.2,MAT.stoneDark,0,false);
  for(const side of [-1,1])box(parent,side*(w*.5+.02),.37,0,.2,.5,d+.16,MAT.stoneDark,0,false);
}
function roofEdges(parent:THREE.Group,w:number,d:number,h:number,rise:number){
  for(const z of [-(d*.5+.045),d*.5+.045]){
    beam(parent,-w*.5,h,z,0,h+rise,.14,.17,MAT.woodDark);
    beam(parent,0,h+rise,z,w*.5,h,.14,.17,MAT.woodDark);
  }
  for(const x of [-w*.5,w*.5])box(parent,x,h,0,.14,.15,d+.1,MAT.woodDark,0,false);
}
function cottageWindow(parent:THREE.Group,x:number,y:number,z:number,variant:number){
  box(parent,x,y,z,.69,.81,.12,MAT.woodDark,0,false);
  box(parent,x,y,z+.075,.51,.62,.04,MAT.glass,0,false);
  box(parent,x,y,z+.12,.055,.65,.055,MAT.woodLight,0,false);
  box(parent,x,y,z+.12,.54,.055,.055,MAT.woodLight,0,false);
  box(parent,x,y-.47,z+.12,.84,.12,.22,MAT.stone,0,false);
  if(variant%2===0)for(const side of [-1,1])box(parent,x+side*.43,y,z+.05,.18,.72,.09,MAT.woodLight,0,false);
}
function dormer(parent:THREE.Group,x:number,h:number,z:number,roofMat:Mat){
  box(parent,x,h+.67,z,1.1,1.26,.95,MAT.plasterIvory);
  box(parent,x,h+.73,z+.51,.48,.49,.1,MAT.glass,0,false);
  box(parent,x,h+.73,z+.59,.06,.51,.07,MAT.woodDark,0,false);
  gableRoof(parent,x,h+1.27,z,1.44,1.24,.54,roofMat);
  roofEdges(parent,1.44,1.24,h+1.27,.54);
}

// The tile rows overlap down each plane. Each tile has a slightly raised center
// and a dark, exposed lower edge, so the courses keep their depth from above.
function tiledRoof(parent:THREE.Group,x:number,y:number,z:number,w:number,d:number,rise:number,hip:boolean,seed:number){
  const positions:number[]=[],colors:number[]=[];
  const a=w*.5,b=d*.5,flat=Math.min(w,d)*.18;
  const faces:{span:(t:number)=>number;point:(t:number,u:number)=>THREE.Vector3;normal:THREE.Vector3;step:number}[]=[];
  for(const side of [-1,1]){
    if(hip){
      faces.push({span:t=>flat+(a-flat)*t,point:(t,u)=>new THREE.Vector3(u,rise*(1-t),side*b*t),normal:new THREE.Vector3(0,1,side*rise/b).normalize(),step:.48});
      faces.push({span:t=>b*t,point:(t,u)=>new THREE.Vector3(side*(flat+(a-flat)*t),rise*(1-t),u),normal:new THREE.Vector3(side*rise/(a-flat),1,0).normalize(),step:.48});
    }else faces.push({span:()=>b,point:(t,u)=>new THREE.Vector3(side*a*t,rise*(1-t),u),normal:new THREE.Vector3(side*rise/a,1,0).normalize(),step:.48});
  }
  const palettes=[
    [0xb95b48,0xcb7358,0xa64c3d,0xd18365,0x97483b],
    [0x8f694b,0xa67b57,0x785a45,0xb68b63,0x725743],
    [0x839aa4,0x9dafb6,0x6d8996,0xb4bfc1,0x72858e],
  ];
  const palette=palettes[((seed%3)+3)%3];
  const emit=(p:THREE.Vector3,c:THREE.Color)=>{positions.push(p.x,p.y,p.z);colors.push(c.r,c.g,c.b);};
  const tri=(p:THREE.Vector3,q:THREE.Vector3,r:THREE.Vector3,c:THREE.Color,n:THREE.Vector3)=>{
    if(new THREE.Vector3().subVectors(q,p).cross(new THREE.Vector3().subVectors(r,p)).dot(n)<0)[q,r]=[r,q];
    emit(p,c);emit(q,c);emit(r,c);
  };
  faces.forEach((face,faceIndex)=>{
    const length=Math.hypot(hip&&faceIndex%2===0?b:hip?a-flat:a,rise);
    const rows=Math.max(3,Math.ceil(length/(MOBILE?.57:.42)));
    const cols=Math.ceil((hip?Math.max(a,b):b)*2/(MOBILE?.64:face.step));
    const width=(hip?Math.max(a,b):b)*2/cols;
    for(let row=0;row<rows;row++){
      const t0=row/rows,t1=Math.min(1.025,(row+1.18)/rows);
      const offset=row%2?width*.5:0;
      for(let col=-1;col<=cols;col++){
        const left=-cols*width*.5+col*width+offset,right=left+width-.018;
        const backSpan=face.span(Math.min(1,t0)),frontSpan=face.span(Math.min(1,t1));
        const backL=Math.max(left,-backSpan),backR=Math.min(right,backSpan);
        const frontL=Math.max(left,-frontSpan),frontR=Math.min(right,frontSpan);
        if(backR-backL<.055||frontR-frontL<.055)continue;
        const noise=hash(seed*997+faceIndex*7919+row*191+col*43);
        const color=new THREE.Color(palette[noise%palette.length]);
        color.multiplyScalar(.94+((noise>>>8)%13)/100);
        const lift=face.normal.clone().multiplyScalar(.045+((noise>>>14)%5)*.002);
        const bl=face.point(t0,backL).add(lift),br=face.point(t0,backR).add(lift);
        const fl=face.point(t1,frontL).add(lift),fr=face.point(t1,frontR).add(lift);
        const center=bl.clone().add(br).add(fl).add(fr).multiplyScalar(.25).addScaledVector(face.normal,.018);
        tri(bl,br,center,color,face.normal);tri(br,fr,center,color,face.normal);
        tri(fr,fl,center,color,face.normal);tri(fl,bl,center,color,face.normal);
        const lipColor=color.clone().multiplyScalar(.72),lipNormal=fr.clone().sub(br).normalize();
        tri(fl,fr,fr.clone().add(new THREE.Vector3(0,-.055,0)),lipColor,lipNormal);
        tri(fl,fr.clone().add(new THREE.Vector3(0,-.055,0)),fl.clone().add(new THREE.Vector3(0,-.055,0)),lipColor,lipNormal);
      }
    }
  });
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,MAT.roofTiles);mesh.position.set(x,y,z);
  mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);
}

function gableRoof(parent:THREE.Group,x:number,y:number,z:number,w:number,d:number,rise:number,material:Mat){
  const a=w/2,b=d/2;
  const vertices=new Float32Array([
    -a,0,b, 0,rise,b, -a,0,-b, -a,0,-b, 0,rise,b, 0,rise,-b,
    0,rise,b, a,0,b, 0,rise,-b, 0,rise,-b, a,0,b, a,0,-b,
    -a,0,b, a,0,b, 0,rise,b, a,0,-b, -a,0,-b, 0,rise,-b,
  ]);
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(vertices,3));geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);
  if(material===MAT.roof||material===MAT.roofDark||material===MAT.roofBlue)tiledRoof(parent,x,y,z,w,d,rise,false,material===MAT.roof?0:material===MAT.roofDark?1:2);
  return mesh;
}
function hipRoof(parent:THREE.Group,x:number,y:number,z:number,w:number,d:number,rise:number,material:Mat){
  const a=w/2,b=d/2,flat=Math.min(w,d)*.18;
  const vertices=new Float32Array([
    -a,0,-b, -flat,rise,0, -a,0,b, -a,0,b, -flat,rise,0, flat,rise,0,
    a,0,b, flat,rise,0, a,0,-b, a,0,-b, flat,rise,0, -flat,rise,0,
    -a,0,-b, a,0,-b, -flat,rise,0, a,0,-b, flat,rise,0, -flat,rise,0,
    -a,0,b, flat,rise,0, a,0,b,
  ]);
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(vertices,3));geo.computeVertexNormals();
  const mesh=new THREE.Mesh(geo,material);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);
  if(material===MAT.roof||material===MAT.roofDark||material===MAT.roofBlue)tiledRoof(parent,x,y,z,w,d,rise,true,material===MAT.roof?0:material===MAT.roofDark?1:2);
}
function roofDetail(parent:THREE.Group,w:number,d:number,h:number,rise:number,variant:number,material:Mat){
  const caps=Math.max(3,Math.ceil(d/.5));
  for(let i=0;i<caps;i++)box(parent,0,h+rise+.1,-d*.5+(i+.5)*d/caps,.25,.15,d/caps+.025,material,0,false);
}
function chimney(parent:THREE.Group,x:number,z:number,h:number){
  box(parent,x,h+.7,z,.55,1.4,.55,MAT.stoneDark);
  box(parent,x,h+1.46,z,.78,.21,.78,MAT.stone);
}
function porch(parent:THREE.Group,d:number,roofMat:Mat,variant:number){
  box(parent,0,.28,d*.5+1.08,2.45,.22,1.85,MAT.stoneDark);
  box(parent,0,.12,d*.5+2.08,1.65,.18,.57,MAT.stone);
  for(const side of [-1,1])box(parent,side*1.08,1.31,d*.5+1.54,.15,1.94,.15,MAT.woodDark);
  const roof=box(parent,0,2.3,d*.5+1.45,2.85,.24,2.05,variant%2?roofMat:MAT.woodDark);
  roof.rotation.x=-.13;
}
function tower(parent:THREE.Group,x:number,z:number,height:number,material:Mat=MAT.stone) {
  const body=new THREE.Mesh(towerBodyGeometry,material);body.position.set(x,height*.5,z);body.scale.y=height;body.castShadow=true;body.receiveShadow=true;parent.add(body);
  const ring=new THREE.Mesh(towerRingGeometry,MAT.stoneDark);ring.position.set(x,height+.04,z);ring.castShadow=true;parent.add(ring);
  if(!MOBILE)for(let i=0;i<8;i++){const a=i*Math.PI/4;box(parent,x+Math.cos(a)*1.16,height+.34,z+Math.sin(a)*1.16,.38,.46,.34,MAT.stone,0,false);}
  box(parent,x,height*.63,z+1.075,.21,.7,.07,MAT.window,0,false);
  box(parent,x,height*.63,z+1.13,.35,.09,.09,MAT.stoneDark,0,false);
  const cap=new THREE.Mesh(coneGeometry,MAT.roof);cap.position.set(x,height+.55,z);cap.scale.set(1.7,1.1,1.7);cap.rotation.y=Math.PI/4;cap.castShadow=true;parent.add(cap);
  box(parent,x,height+1.12,z,.18,.31,.18,MAT.gold,0,false);
}
function awning(parent:THREE.Group,x:number,y:number,z:number,width:number,material:Mat) {
  const roof=box(parent,x,y,z,width,.18,2.3,material);roof.rotation.z=.12;
  box(parent,x-width*.43,y-.7,z+1,.14,1.4,.14,MAT.woodDark);
  box(parent,x+width*.43,y-.7,z+1,.14,1.4,.14,MAT.woodDark);
}
function flag(parent:THREE.Group,x:number,y:number,z:number,material:Mat) {
  box(parent,x,y+.75,z,.09,1.5,.09,MAT.woodDark);
  box(parent,x+.42,y+1.25,z,.8,.42,.06,material);
}
function building(plot:PlotState,gameMode=false): THREE.Group {
  if(plot.stage<=0){const empty=new THREE.Group();empty.position.set(plot.x,0,plot.z);return empty;}
  const group=plot.kind==='home'?(gameMode?gameCottageBuilding(plot,MOBILE):cottageBuilding(plot,MOBILE))
    :plot.kind==='castle'?castleBuilding(plot,MOBILE)
    :plot.kind==='project'?authoredLandmarkBuilding(plot,MOBILE):civicBuilding(plot,MOBILE,gameMode);
  group.position.y+=terrainHeight(plot.x,plot.z)-.48;
  return group;
}
function projectPickBox(plot:PlotState):THREE.Box3{
  const y=terrainHeight(plot.x,plot.z);
  return new THREE.Box3(new THREE.Vector3(plot.x-5.3,y-.5,plot.z-5),new THREE.Vector3(plot.x+5.3,y+20,plot.z+5));
}
function hash(n:number){let x=n|0;x^=x>>>16;x=Math.imul(x,0x7feb352d);x^=x>>>15;return (x^x>>>16)>>>0;}
function wallSectorGeometry(radius:number):THREE.BufferGeometry{
  const step=Math.PI*2/WALL_SEGMENTS,inner=radius-.4,outer=radius+.4;
  const point=(r:number,a:number,y:number):[number,number,number]=>[Math.cos(a)*r,y,Math.sin(a)*r];
  const ib0=point(inner,0,-.5),it0=point(inner,0,.5),ob0=point(outer,0,-.5),ot0=point(outer,0,.5);
  const ib1=point(inner,step,-.5),it1=point(inner,step,.5),ob1=point(outer,step,-.5),ot1=point(outer,step,.5);
  const positions:number[]=[];
  const face=(a:number[],b:number[],c:number[],d:number[])=>{for(const p of [a,b,c,b,d,c])positions.push(...p);};
  face(ob0,ot0,ob1,ot1);face(ib0,ib1,it0,it1);
  face(it0,it1,ot0,ot1);face(ib0,ob0,ib1,ob1);
  face(ib0,it0,ob0,ot0);face(ib1,ob1,it1,ot1);
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();
  return geometry;
}
export class TownScene {
  readonly scene=new THREE.Scene();
  readonly camera=new THREE.PerspectiveCamera(43,1,.1,650);
  readonly renderer:THREE.WebGLRenderer;
  readonly pickBoxes=new Map<ProjectKey,THREE.Box3>();
  readonly treeObstacles:{x:number;z:number;r:number}[]=[];
  private readonly land=new THREE.Group();
  readonly environment:Environment;
  private readonly sky:TownSky;
  private readonly rain:Rain;
  private readonly contactShadows:ContactShadows;
  private readonly reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  private currentSeason='summer';
  private currentNight=0;
  private readonly fogColor=new THREE.Color();
  private readonly structures=new THREE.Group();
  private readonly roads=new THREE.Group();
  private readonly walls=new THREE.Group();
  private readonly structureReveal=new THREE.Group();
  private readonly arrivalStructures=new THREE.Group();
  private parachuteArrival:ParachuteArrival|null=null;
  private readonly previousStructures=new THREE.Group();
  private readonly previousRoads=new THREE.Group();
  private readonly previousWalls=new THREE.Group();
  private readonly structurePlane=new THREE.Plane(new THREE.Vector3(0,-1,0),.48);
  private readonly previousStructurePlane=new THREE.Plane(new THREE.Vector3(0,1,0),.48);
  private readonly wallPlane=new THREE.Plane(new THREE.Vector3(0,-1,0),.48);
  private readonly previousWallPlane=new THREE.Plane(new THREE.Vector3(0,1,0),.48);
  private structureMaterials:THREE.Material[]=[];
  private previousStructureMaterials:THREE.Material[]=[];
  private wallMaterials:THREE.Material[]=[];
  private previousWallMaterials:THREE.Material[]=[];
  private structureTransition:{started:number;plots:PlotState[];height:number}|null=null;
  private constructionEffects:ConstructionEffects|null=null;
  private wallEffects:ConstructionEffects|null=null;
  private wallTransition:{started:number;snapshot:TownSnapshot}|null=null;
  private roadTransition:{started:number;firstRoad:boolean;draws:{geometry:THREE.BufferGeometry;count:number}[];instances:{mesh:THREE.InstancedMesh;count:number}[]}|null=null;
  private lastPlots:PlotState[]=[];
  private structureContacts:ContactFootprint[]=[];
  private readonly sun=new THREE.DirectionalLight(0xffdfad,3.05);
  private readonly fill=new THREE.HemisphereLight(0xb8c8eb,0x9d806a,.68);
  private readonly environmentMap:THREE.WebGLRenderTarget;
  private readonly materials=new Set<Mat>();
  private structureSignature='';
  private wallSignature='';
  private roadSignature='';
  private roadLevelSignature='';
  readonly mobile=MOBILE;
  constructor(canvas:HTMLCanvasElement,private readonly gameMode=false){
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:this.mobile?'low-power':'high-performance'});
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure=1.05;
    this.renderer.shadowMap.enabled=true;
    this.renderer.shadowMap.type=THREE.PCFShadowMap;
    this.renderer.localClippingEnabled=true;
    const room=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(this.renderer);
    this.environmentMap=pmrem.fromScene(room,.02);
    this.scene.environment=this.environmentMap.texture;this.scene.environmentIntensity=.09;
    room.dispose();pmrem.dispose();
    this.scene.background=new THREE.Color(0xbad6dc);
    this.scene.fog=new THREE.Fog(0xd4e8d6,170,440);
    this.sun.position.set(-70,65,45);this.sun.castShadow=true;
    this.sun.shadow.mapSize.setScalar(this.mobile?1024:4096);
    this.sun.shadow.camera.left=-88;this.sun.shadow.camera.right=88;this.sun.shadow.camera.top=88;this.sun.shadow.camera.bottom=-88;
    this.sun.shadow.camera.near=1;this.sun.shadow.camera.far=270;
    this.sun.shadow.bias=-.00008;
    this.sun.shadow.normalBias=.035;this.sun.shadow.radius=this.mobile?1.25:2.5;
    this.scene.add(this.sun,this.fill,this.land,this.structures,this.roads,this.walls,this.structureReveal,this.arrivalStructures,this.previousStructures,this.previousRoads,this.previousWalls);
    this.environment=new Environment(this.scene,this.mobile,this.gameMode);
    this.sky=new TownSky(this.scene);
    this.rain=new Rain(this.scene,this.mobile);
    this.contactShadows=new ContactShadows(this.scene,terrainHeight);
    this.camera.position.set(95,106,108);this.camera.lookAt(0,0,0);
    this.createDecor();this.contactShadows.setTrees([...this.environment.trees,...this.treeObstacles]);this.resize();
  }
  resize(){const w=innerWidth,h=innerHeight;this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h,false);}
  setPixelRatio(r:number){this.renderer.setPixelRatio(r);this.resize();}
  private createLand(){
    const earth=new THREE.Mesh(new THREE.CylinderGeometry(70,73,3.8,72),MAT.earth);earth.position.y=-2;earth.receiveShadow=true;this.land.add(earth);
    const grass=new THREE.Mesh(new THREE.CylinderGeometry(68.8,70,1.15,72),MAT.grass);grass.position.y=-.05;grass.receiveShadow=true;this.land.add(grass);
    const center=new THREE.Mesh(new THREE.CylinderGeometry(INFRASTRUCTURE.squareRadius-.1,INFRASTRUCTURE.squareRadius-.1,.09,32),MAT.path);center.position.y=.52;center.receiveShadow=true;this.land.add(center);
    const patches=new Map<Mat,THREE.BufferGeometry[]>();
    for(let i=0;i<50;i++){
      const n=hash(i*71),angle=(n%628)/100,r=5+(hash(n+9)%570)/10;
      const x=Math.cos(angle)*r,z=Math.sin(angle)*r;
      const patch=new THREE.Mesh(new THREE.CircleGeometry(.8+(n%33)/15,7),i%3?MAT.grassDark:MAT.earth);
      patch.rotation.x=-Math.PI/2;patch.position.set(x,.535,z);patch.scale.y=.6;patch.updateMatrix();
      const material=patch.material as Mat,bucket=patches.get(material)??[];
      bucket.push(patch.geometry.clone().applyMatrix4(patch.matrix));patches.set(material,bucket);
    }
    for(const [material,geometries] of patches){const merged=mergeGeometries(geometries);geometries.forEach(g=>g.dispose());if(merged)this.land.add(new THREE.Mesh(merged,material));}
  }
  private createDecor(){
    const trees:{x:number;z:number;scale:number;shape:number}[]=[];
    for(let i=0;i<150;i++){
      const angle=hash(i*397)%6283/1000,r=8+(hash(i*193+8)%580)/10;
      const x=Math.cos(angle)*r,z=Math.sin(angle)*r;
      if(r<16||(this.gameMode&&moatDistance(x,z)<7)||isLivingWorldSite(x,z)||isMountWorksite(x,z)||r>66||millAccessDistance(x,z)<2.3||this.gameMode&&(millStreamDistance(x,z)<8||x>29&&x<45&&z>-43&&z<-23||x>6&&x<17&&z>-43&&z<-24)||Math.abs(r-INFRASTRUCTURE.road.ringRadius)<3||Math.abs(r-INFRASTRUCTURE.road.outerRingRadius)<3||Math.abs(r-INFRASTRUCTURE.wall.outerRadius)<3.5||PLOTS.some(p=>Math.hypot(p.x-x,p.z-z)<(p.kind==='project'?8:5))||Math.abs(x)<2.2||Math.abs(z)<2.2)continue;
      trees.push({x,z,scale:.75+(hash(i*411)%75)/100,shape:i%3});
      this.treeObstacles.push({x,z,r:.8});
    }
    const dummy=new THREE.Object3D();
    const pineFamilies=['Pine_A','Pine_B','Pine_C'] as const;
    addNatureInstances(this.land,trees.map((t,i)=>({family:pineFamilies[t.shape],x:t.x,y:terrainHeight(t.x,t.z)-.03,z:t.z,
      sx:3.45*t.scale,sy:5.1*t.scale,sz:3.45*t.scale,rotation:i*2.4})),this.mobile);
    const stones:{x:number;z:number;s:number}[]=[],shrubs:{x:number;z:number;s:number}[]=[];
    for(let i=0;i<(this.mobile?250:480);i++){
      const angle=(hash(i*293)%6283)/1000,r=8+(hash(i*719+3)%570)/10,x=Math.cos(angle)*r,z=Math.sin(angle)*r;
      if((this.gameMode&&moatDistance(x,z)<7)||isLivingWorldSite(x,z)||isMountWorksite(x,z)||millAccessDistance(x,z)<2.3||this.gameMode&&(millStreamDistance(x,z)<8||x>29&&x<45&&z>-43&&z<-23||x>6&&x<17&&z>-43&&z<-24)||Math.abs(r-INFRASTRUCTURE.wall.innerRadius)<3||Math.abs(r-INFRASTRUCTURE.road.outerRingRadius)<3||Math.abs(r-INFRASTRUCTURE.wall.outerRadius)<3||Math.abs(x)<2.1||Math.abs(z)<2.1||PLOTS.some(p=>Math.hypot(p.x-x,p.z-z)<(p.kind==='project'?8:5.4)))continue;
      const item={x,z,s:.28+(hash(i*133+5)%80)/100};
      if(i%3===0)shrubs.push(item);else stones.push(item);
    }
    const rockFamilies=['Rock_A','Rock_B','Rock_C'] as const;
    const shrubFamilies=['Shrub_A','Shrub_B'] as const;
    const naturalProps:NaturePlacement[]=[
      ...stones.map((p,i)=>({family:rockFamilies[i%3],x:p.x,y:terrainHeight(p.x,p.z)-.025,z:p.z,
        sx:p.s*1.8,sy:p.s*.48,sz:p.s*1.6,rotation:i*2.399})),
      ...shrubs.map((p,i)=>({family:shrubFamilies[i%2],x:p.x,y:terrainHeight(p.x,p.z)-.025,z:p.z,
        sx:p.s*1.8,sy:p.s*.85,sz:p.s*1.7,rotation:i*2.399})),
    ];
    addNatureInstances(this.land,naturalProps,this.mobile);
    const lamps=Array.from({length:INFRASTRUCTURE.lamps.count},(_,i)=>{
      const angle=i*Math.PI*2/INFRASTRUCTURE.lamps.count,x=Math.cos(angle)*INFRASTRUCTURE.lamps.radius,z=Math.sin(angle)*INFRASTRUCTURE.lamps.radius;
      return {x,y:terrainHeight(x,z),z};
    });
    if(!this.gameMode)placeLanterns(this.land,lamps,this.mobile);
  }

  private clear(group:THREE.Group){const dispose=(object:THREE.Object3D)=>{if(object instanceof THREE.InstancedMesh)object.dispose();if(object instanceof THREE.Mesh&&object.geometry!==boxGeometry&&object.geometry!==plainBoxGeometry&&object.geometry!==sphereGeometry&&object.geometry!==coneGeometry&&!COTTAGE_SHARED_GEOMETRIES.has(object.geometry)&&!CASTLE_SHARED_GEOMETRIES.has(object.geometry)&&!CIVIC_SHARED_GEOMETRIES.has(object.geometry)&&!NATURE_SHARED_GEOMETRIES.has(object.geometry)&&!PROPS_SHARED_GEOMETRIES.has(object.geometry)&&!AUTHORED_LANDMARK_SHARED_GEOMETRIES.has(object.geometry))object.geometry.dispose();for(const child of object.children)dispose(child);};for(const child of [...group.children]){group.remove(child);dispose(child);}}
  private buildStructures(plots:PlotState[]){
    this.clear(this.structures);this.pickBoxes.clear();
    const contacts:ContactFootprint[]=[];
    const buckets=new Map<Mat,THREE.BufferGeometry[]>();
    const reusableGeometries=new Set<THREE.BufferGeometry>([boxGeometry,plainBoxGeometry,sphereGeometry,coneGeometry,towerBodyGeometry,towerRingGeometry,...AUTHORED_LANDMARK_SHARED_GEOMETRIES,...COTTAGE_SHARED_GEOMETRIES,...CASTLE_SHARED_GEOMETRIES,...CIVIC_SHARED_GEOMETRIES,...PROPS_SHARED_GEOMETRIES]);
    const collect=(g:THREE.Group)=>{
      g.updateMatrixWorld(true);
      g.traverse(o=>{if(!(o instanceof THREE.Mesh))return;
        let geometry=o.geometry.clone();
        if(geometry.index){const plain=geometry.toNonIndexed();geometry.dispose();geometry=plain;}
        for(const name of Object.keys(geometry.attributes))if(name!=='position'&&name!=='normal'&&!(name==='color'&&o.material===MAT.roofTiles))geometry.deleteAttribute(name);
        geometry.applyMatrix4(o.matrixWorld);
        const bucket=buckets.get(o.material as Mat)??[];bucket.push(geometry);buckets.set(o.material as Mat,bucket);
        if(!reusableGeometries.has(o.geometry))o.geometry.dispose();
      });
    };
    for(const p of plots){
      if(p.stage===0)continue;
      const g=building(p,this.gameMode);
      // Small household clusters use the existing occupied footprint and keep
      // the central entrance clear. They share the same batched material pool.
      if(p.kind==='home'&&p.stage>=4){
        const variant=p.variant??0;
        placeProp(g,variant%2?'Crate_A':'Barrel_A',this.mobile,1.48,0,1.94,.17,.58);
        if(p.stage>=5&&variant%2===0)placeProp(g,'Logpile_A',this.mobile,2.35,0,-1.31,0,.65);
        if(p.stage>=5)placeProp(g,'Fence_A',this.mobile,3.00,0,-.17,Math.PI/2,.88);
      }
      const bounds=new THREE.Box3().setFromObject(g),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
      contacts.push({x:center.x,z:center.z,width:size.x+2,depth:size.z+2});
      collect(g);
      if(p.project)this.pickBoxes.set(p.project,projectPickBox(p));
    }
    const complexes=new Map<string,PlotState[]>();
    for(const p of plots)if(p.complexId){const group=complexes.get(p.complexId)??[];group.push(p);complexes.set(p.complexId,group);}
    for(const [id,pair] of complexes){
      if(pair.length!==2)continue;
      const a=pair[0],b=pair[1],g=new THREE.Group();
      const mx=(a.x+b.x)/2,mz=(a.z+b.z)/2,length=Math.hypot(a.x-b.x,a.z-b.z);
      g.position.set(mx,terrainHeight(mx,mz)-.48,mz);g.rotation.y=-Math.atan2(b.z-a.z,b.x-a.x);
      box(g,0,2.65,0,length+.8,.42,1.3,MAT.woodDark);
      if(id.startsWith('courtyard')){
        for(const side of [-1,1])box(g,0,.8,side*2.25,length+4,.6,.35,MAT.stone);
        box(g,0,.52,0,Math.max(2,length-3),.16,3.3,MAT.path);
        for(const x of [-1.2,0,1.2])ball(g,x,.77,0,.4,.55,.4,x===0?MAT.red:MAT.leaf);
        gableRoof(g,0,2.9,0,3.6,3.4,.8,MAT.roofDark);
      }else if(id==='market-hall'){
        for(const x of [-length/2,0,length/2])box(g,x,1.65,0,.24,3.3,.24,MAT.woodDark);
        gableRoof(g,0,3.2,0,length+5,5.6,1.7,MAT.red);
        for(const x of [-2,2])box(g,x,.9,2.4,2.6,1.2,1.2,MAT.woodLight);
        flag(g,0,4.7,0,MAT.gold);
      }else if(id==='artisan-yard'){
        box(g,0,3.1,0,length+4,.32,4.5,MAT.woodDark);
        box(g,0,3.4,0,length+4,.23,4.6,MAT.roofBlue);
        box(g,0,1.2,2.2,length+3,2.2,.2,MAT.stoneDark);
        for(const x of [-2,0,2])box(g,x,.45,3,1.1,.9,1.1,MAT.woodLight);
      }else if(id==='grand-inn'){
        box(g,0,3.65,0,length+3,2.2,3.3,MAT.plaster);
        gableRoof(g,0,4.8,0,length+3.4,3.7,1.2,MAT.roofDark);
        for(const x of [-1.4,1.4])box(g,x,3.8,1.7,.65,.8,.12,MAT.window);
        flag(g,0,5.2,0,MAT.gold);
      }
      collect(g);
    }
    for(const [material,geos] of buckets){
      const geometry=mergeGeometries(geos,false);geos.forEach(g=>g.dispose());
      if(!geometry)continue;
      const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=true;this.structures.add(mesh);
    }
    this.structureContacts=contacts;
    this.contactShadows.setBuildings(contacts);
  }
  private buildRoads(snapshot:TownSnapshot){
    this.clear(this.roads);
    const roadTier=this.gameMode?snapshot.roads===0?0:snapshot.roads<20?1:snapshot.roads<INFRASTRUCTURE.road.ringSegments?2:3:3;
    if(roadTier===0)return;
    const dirt:THREE.BufferGeometry[]=[];
    const streamOpen=!this.gameMode||(snapshot.riverLevel??0)>=2;
    const roadSurface=new TerrainSurface(this.mobile,streamOpen?terrainHeight:naturalTerrainHeight);
    let ribbonLayer=0;
    // Terrain-aligned ribbons share exactly the same plane at junctions.
    // A millimetre between layers avoids flickering overlapping road faces.
    const ribbon=(points:Parameters<typeof pathRibbon>[0],width:number)=>
      pathRibbon(points,width,this.mobile,roadSurface).translate(0,ribbonLayer++*.001,0);
    const sealed=this.gameMode&&snapshot.innerWood>0&&snapshot.wallGates===0;
    const reach=roadTier===1?INFRASTRUCTURE.road.ringRadius:sealed?INFRASTRUCTURE.wall.innerRadius-1.4:INFRASTRUCTURE.road.spokeLength;
    for(const [x,z] of [[-reach,0],[reach,0],[0,-reach],[0,reach]])
      dirt.push(ribbon(linePoints({x:0,z:0},{x,z}),roadTier===1?1.75:2.8));
    dirt.push(ribbon(ringPoints(INFRASTRUCTURE.road.summitRadius,32),1.8));
    if(roadTier>=2)dirt.push(ribbon(ringPoints(INFRASTRUCTURE.road.ringRadius,INFRASTRUCTURE.road.ringSegments,this.gameMode?snapshot.roads/INFRASTRUCTURE.road.ringSegments:1),2.35));
    if(snapshot.outerRoad>0)dirt.push(ribbon(ringPoints(INFRASTRUCTURE.road.outerRingRadius,INFRASTRUCTURE.road.outerRingSegments,snapshot.outerRoad/INFRASTRUCTURE.road.outerRingSegments),2.15));
    const accessPaths:{x1:number;z1:number;x2:number;z2:number}[]=[];
    if(this.gameMode)for(const key of snapshot.districtConnections??[]){
      const site=IDEA_DISTRICTS[key as DistrictIdea];
      const points=site.route.flatMap((p,i)=>i?linePoints({x:site.route[i-1][0],z:site.route[i-1][1]},{x:p[0],z:p[1]}):[]);
      dirt.push(ribbon(points,roadTier>=3?3.2:2.4));
    }
    for(const plot of roadTier>=2?snapshot.plots:[]){
      if(plot.stage===0)continue;
      if(this.gameMode&&districtForPlot(plot.id))continue;
      const access=accessPathFor(plot);if(!access)continue;
      // The older mill plot sits just beyond the inner wall. Its farm lane
      // approaches the east crossing from outside, where a sealed wall can
      // visibly leave it disconnected from the town road.
      if(this.gameMode&&plot.kind==='mill'&&snapshot.outerRoad===0&&Math.hypot(plot.x,plot.z)<40){
        const radius=INFRASTRUCTURE.wall.innerRadius+2.5,angle=Math.atan2(plot.z,plot.x);
        const farmLane=[{x:plot.x,z:plot.z},...Array.from({length:15},(_,i)=>({x:Math.cos(angle*(1-i/14))*radius,z:Math.sin(angle*(1-i/14))*radius}))];
        if(!sealed)farmLane.push({x:INFRASTRUCTURE.road.spokeLength,z:0});
        dirt.push(ribbon(farmLane,1.2));
      }
      // The playable town has no outer ring road. Give the farm lane an arc
      // to the east gate's existing spoke instead of ending it in the grass.
      if(this.gameMode&&plot.kind==='mill'&&snapshot.outerRoad===0){
        const angle=Math.atan2(access.z2,access.x2),radius=INFRASTRUCTURE.road.outerRingRadius;
        const farmLane=Array.from({length:19},(_,i)=>({x:Math.cos(angle*(1-i/18))*radius,z:Math.sin(angle*(1-i/18))*radius}));
        dirt.push(ribbon(farmLane,1.2));
      }
      accessPaths.push(access);
      dirt.push(ribbon(linePoints({x:access.x1,z:access.z1},{x:access.x2,z:access.z2}),1.2));
    }
    const merged=mergeGeometries(dirt);dirt.forEach(geometry=>geometry.dispose());
    if(merged){const mesh=new THREE.Mesh(merged,MAT.path);mesh.name='Worn_dirt_lanes';mesh.receiveShadow=true;this.roads.add(mesh);}
    const paving:NaturePlacement[]=[];
    const stone=(x:number,z:number,seed:number,width:number)=>{
      const variation=hash(seed),size=width*(.83+(variation%29)/100);
      const ground=roadSurface.sample(x,z);
      paving.push({family:'Rock_Path',groundNormal:{x:-ground.dx,y:1,z:-ground.dz},x,y:ground.height+.075,z,sx:size,sy:.065+(variation%4)*.008,sz:size*(.76+((variation>>>5)%19)/100),rotation:((variation>>>8)%628)/100});
    };
    // Pale irregular slabs collect into loose courses, with visible earth joints.
    for(let axis=0;axis<2;axis++)for(const sign of [-1,1])for(let j=8;j<reach;j+=this.mobile?1.7:1.16){
      for(let lane=-1;lane<=1;lane++){
        if(roadTier===1&&lane!==0)continue;
        if(this.mobile&&lane===0)continue;
        const seed=Math.round(j*71)+axis*301+lane*79+sign*19;
        const along=sign*(j+(lane%2)*.35),across=lane*.66+((hash(seed)%15)-7)/100;
        stone(axis?across:along,axis?along:across,seed,.56);
      }
    }
    for(let segment=0;segment<(roadTier>=2?snapshot.roads:0);segment++)for(let j=0;j<(this.mobile?3:5);j++)for(let lane=-1;lane<=1;lane++){
      const rows=this.mobile?3:5,a=(segment+(j+.5)/rows)*Math.PI*2/INFRASTRUCTURE.road.ringSegments;
      const r=INFRASTRUCTURE.road.ringRadius+lane*.64;
      stone(Math.cos(a)*r,Math.sin(a)*r,segment*197+j*47+lane*23,.56);
    }
    for(const [index,access] of accessPaths.entries()){
      const dx=access.x2-access.x1,dz=access.z2-access.z1,length=Math.hypot(dx,dz);
      for(let distance=.7;distance<length-.2;distance+=this.mobile?1.3:.85){
        const wobble=((hash(index*151+Math.round(distance*17))%31)-15)/100;
        stone(access.x1+dx*distance/length-dz/length*wobble,access.z1+dz*distance/length+dx/length*wobble,index*91+Math.round(distance*31),.58);
      }
    }
    addNatureInstances(this.roads,paving,this.mobile,false);
    if(this.gameMode&&roadTier>=2){
      const lamps=Array.from({length:INFRASTRUCTURE.lamps.count},(_,i)=>{
        const angle=i*Math.PI*2/INFRASTRUCTURE.lamps.count,x=Math.cos(angle)*INFRASTRUCTURE.lamps.radius,z=Math.sin(angle)*INFRASTRUCTURE.lamps.radius;
        return {x,y:terrainHeight(x,z),z};
      });
      placeLanterns(this.roads,lamps,this.mobile);
    }
  }
  private buildWalls(snapshot:TownSnapshot){
    this.clear(this.walls);
    const streamOpen=this.gameMode&&(snapshot.riverLevel??0)>=2;
    const flooded=(x:number,z:number)=>isWater(x,z,1.4)||(streamOpen&&(millStreamDistance(x,z)<4.1||Math.hypot(x-MILL_POOL.x,z-MILL_POOL.z)<MILL_POOL.radius+.6));
    const lists:{radius:number;wood:number;stone:number}[]=[{radius:INFRASTRUCTURE.wall.innerRadius,wood:snapshot.innerWood,stone:snapshot.innerStone},{radius:INFRASTRUCTURE.wall.outerRadius,wood:snapshot.outerWood,stone:0}];
    for(const ring of lists){
      const drySection=(i:number)=>!wallSectionFlooded(ring.radius,i,streamOpen);
      const sectorGeometry=wallSectorGeometry(ring.radius);
      let hasWall=false;
      for(const material of [MAT.woodDark,MAT.stone]){
        const indices:number[]=[];
        for(let i=0;i<WALL_SEGMENTS;i++)if(drySection(i)&&!wallIsGate(i,this.gameMode?snapshot.wallGates:undefined)&&i<ring.wood&&(material===MAT.stone?i<ring.stone:i>=ring.stone))indices.push(i);
        if(!indices.length)continue;
        if(material===MAT.woodDark){
          placeFenceSections(this.walls,indices.map(i=>wallSection(ring.radius,i)),this.mobile,flooded);
          continue;
        }
        hasWall=true;
        const wall=new THREE.InstancedMesh(sectorGeometry,material,indices.length);
        const dummy=new THREE.Object3D();
        indices.forEach((i,j)=>{const a=(i+.5)*Math.PI*2/WALL_SEGMENTS;dummy.position.set(0,terrainHeight(Math.cos(a)*ring.radius,Math.sin(a)*ring.radius)-.48+(material===MAT.stone?2.2:1.65),0);dummy.rotation.y=-i*Math.PI*2/WALL_SEGMENTS;dummy.scale.set(1,material===MAT.stone?4.4:3.3,1);dummy.updateMatrix();wall.setMatrixAt(j,dummy.matrix);});
        wall.instanceMatrix.needsUpdate=true;wall.castShadow=!this.mobile;wall.receiveShadow=true;this.walls.add(wall);
        if(indices.length){
          const stone=material===MAT.stone;
          const details=new THREE.InstancedMesh(plainBoxGeometry,stone?MAT.stoneDark:MAT.wood,indices.length*(stone?3:1));
          let detailIndex=0;
          for(const i of indices){
            const angle=(i+.5)*Math.PI*2/WALL_SEGMENTS;
            const along=new THREE.Vector3(-Math.sin(angle),0,Math.cos(angle));
            const center=new THREE.Vector3(Math.cos(angle)*ring.radius,0,Math.sin(angle)*ring.radius);
            for(const offset of (stone?[-2.05,0,2.05]:[0])){
              if(stone)dummy.position.copy(center).addScaledVector(along,offset);
              else{const joint=wallSection(ring.radius,i);dummy.position.set(joint.start.x,0,joint.start.z);}
              dummy.position.y=terrainHeight(dummy.position.x,dummy.position.z)-.48+(stone?4.72:2);
              dummy.rotation.y=-angle-Math.PI/2;
              dummy.scale.set(stone?1.02:.38,stone?.72:4.1,stone?1.02:1.04);
              dummy.updateMatrix();details.setMatrixAt(detailIndex++,dummy.matrix);
            }
          }
          details.instanceMatrix.needsUpdate=true;
          details.castShadow=!this.mobile;details.receiveShadow=true;this.walls.add(details);
        }
      }
      const facing:NaturePlacement[]=[];
      for(let i=0;i<ring.stone;i++){
        if(wallIsGate(i,this.gameMode?snapshot.wallGates:undefined)||!drySection(i))continue;
        const section=wallSection(ring.radius,i);
        for(let row=0;row<(this.mobile?2:4);row++)for(let col=0;col<4;col++){
          if((i+row+col)%3===0)continue;
          const t=(col+.5+(row%2)*.3)/4;
          const x=section.start.x+(section.end.x-section.start.x)*t,z=section.start.z+(section.end.z-section.start.z)*t;
          const distance=Math.hypot(x,z),angle=Math.atan2(z,x);
          for(const side of [-1,1])facing.push({family:'Rock_Path',x:x+side*x/distance*.4,y:terrainHeight(x,z)+.2+row*(this.mobile?1.65:.91),z:z+side*z/distance*.4,
            sx:section.length/5,sy:.56,sz:.18,rotation:Math.PI/2-angle});
        }
      }
      addNatureInstances(this.walls,facing,this.mobile,false);
      if(!hasWall)sectorGeometry.dispose();
      if(ring.wood>0){
        const gates=new THREE.Group();
        for(let i=0;i<WALL_SEGMENTS;i++){
          if(i+1>=ring.wood||!wallIsGate(i,this.gameMode?snapshot.wallGates:undefined)||!drySection(i))continue;
          if(this.gameMode&&i%INFRASTRUCTURE.wall.gateInterval!==0)continue;
          const section=wallSection(ring.radius,i),gate=new THREE.Group(),stone=i<ring.stone;
          const angle=i*Math.PI*2/WALL_SEGMENTS;
          gate.position.set(this.gameMode?Math.cos(angle)*ring.radius:section.center.x,0,this.gameMode?Math.sin(angle)*ring.radius:section.center.z);
          gate.position.y=terrainHeight(gate.position.x,gate.position.z)-.48;
          gate.rotation.y=this.gameMode?-angle-Math.PI/2:section.rotation;
          const gateWidth=this.gameMode?section.length*2:section.length;
          const post=stone?MAT.stoneDark:MAT.woodDark;
          for(const side of [-1,1])box(gate,side*gateWidth*.5,stone?2.2:1.9,0,.9,stone?4.4:3.8,1.05,post,0,false);
          box(gate,0,stone?4.5:3.9,0,gateWidth+.9,.62,1.1,stone?MAT.stone:MAT.woodDark,0,false);
          gates.add(gate);
        }
        gates.updateMatrixWorld(true);this.walls.add(gates);
      }
    }
  }
  private clipGroup(group:THREE.Group,plane:THREE.Plane):THREE.Material[]{
    const clones=new Map<THREE.Material,THREE.Material>();
    group.traverse(object=>{
      if(!(object instanceof THREE.Mesh))return;
      const clip=(source:THREE.Material)=>{
        let material=clones.get(source);
        if(!material){material=source.clone();material.clippingPlanes=[plane];material.clipShadows=true;clones.set(source,material);}
        return material;
      };
      object.material=Array.isArray(object.material)?object.material.map(clip):clip(object.material);
    });
    return [...clones.values()];
  }
  private finishStructureTransition(){
    if(!this.structureTransition)return;
    const plots=this.structureTransition.plots;
    this.parachuteArrival?.dispose();this.parachuteArrival=null;
    this.clear(this.arrivalStructures);
    this.constructionEffects?.dispose();this.constructionEffects=null;
    this.clear(this.structureReveal);this.structureMaterials.forEach(material=>material.dispose());this.structureMaterials=[];
    this.clear(this.previousStructures);this.previousStructureMaterials.forEach(material=>material.dispose());this.previousStructureMaterials=[];
    this.structureTransition=null;this.buildStructures(plots);
  }
  private finishWallTransition(){
    if(!this.wallTransition)return;
    const snapshot=this.wallTransition.snapshot;
    this.wallEffects?.dispose();this.wallEffects=null;
    this.clear(this.walls);this.wallMaterials.forEach(material=>material.dispose());this.wallMaterials=[];
    this.previousWallMaterials.forEach(material=>material.dispose());this.previousWallMaterials=[];
    this.clear(this.previousWalls);this.wallTransition=null;this.buildWalls(snapshot);
  }
  private finishRoadTransition(){
    if(!this.roadTransition)return;
    for(const {geometry,count} of this.roadTransition.draws)geometry.setDrawRange(0,count);
    for(const {mesh,count} of this.roadTransition.instances)mesh.count=count;
    this.clear(this.previousRoads);this.roadTransition=null;
    this.environment.setRoadCenterProgress(this.roads.children.length?1:0);
  }
  finishTransitions(){this.finishStructureTransition();this.finishWallTransition();this.finishRoadTransition();}
  private updateTransitions(now:number){
    const ease=(t:number)=>1-Math.pow(1-THREE.MathUtils.clamp(t,0,1),2);
    if(this.structureTransition){
      const elapsed=now-this.structureTransition.started;
      const t=THREE.MathUtils.smoothstep(elapsed/1650,0,1);
      this.structurePlane.constant=.48+t*this.structureTransition.height;
      this.previousStructurePlane.constant=.48-t*this.structureTransition.height;
      this.constructionEffects?.update(t);
      this.parachuteArrival?.update(elapsed/SANDSHIP_ARRIVAL_MS);
      if(t>=1&&(!this.parachuteArrival||elapsed>=SANDSHIP_ARRIVAL_MS))this.finishStructureTransition();
    }
    if(this.wallTransition){
      const t=THREE.MathUtils.smoothstep((now-this.wallTransition.started)/1650,0,1);
      this.wallPlane.constant=.48+t*16;
      this.previousWallPlane.constant=.48-t*16;
      this.wallEffects?.update(t);
      if(t>=1)this.finishWallTransition();
    }
    if(this.roadTransition){
      const t=ease((now-this.roadTransition.started)/1450);
      // The dirt route is traced first; its irregular stones follow behind it.
      const dirt=THREE.MathUtils.clamp(t/.83,0,1),paving=THREE.MathUtils.clamp((t-.16)/.84,0,1);
      for(const {geometry,count} of this.roadTransition.draws)geometry.setDrawRange(0,Math.floor(count*dirt/3)*3);
      for(const {mesh,count} of this.roadTransition.instances)mesh.count=Math.floor(count*(mesh.name.startsWith('Street_lantern')?Math.max(0,(t-.74)/.26):paving));
      if(this.roadTransition.firstRoad)this.environment.setRoadCenterProgress(t);
      if(t>=1)this.finishRoadTransition();
    }
  }
  update(snapshot:TownSnapshot,animate=false){
    if(!animate)this.finishTransitions();
    if(!this.roadTransition)this.environment.setRoadCenterProgress(snapshot.roads>0?1:0);
    const structureSignature=snapshot.plots.map(p=>`${p.stage}${p.renovation}${p.complexId?'c':''}`).join('');
    const wallSignature=`${snapshot.innerWood}/${snapshot.innerStone}/${snapshot.outerWood}/${snapshot.wallGates??'auto'}/${(snapshot.riverLevel??0)>=2}`;
    if(structureSignature!==this.structureSignature){
      this.finishStructureTransition();this.structureSignature=structureSignature;
      if(animate&&this.gameMode&&this.lastPlots.length){
        const previous=new Map(this.lastPlots.map(plot=>[plot.id,plot]));
        const changed=snapshot.plots.filter(plot=>{
          const old=previous.get(plot.id);
          return old&&(plot.stage!==old.stage||plot.renovation!==old.renovation);
        });
        if(changed.length){
          const changedIds=new Set(changed.map(plot=>plot.id));
          this.buildStructures(snapshot.plots.filter(plot=>!changedIds.has(plot.id)));
          this.clear(this.structureReveal);this.clear(this.previousStructures);
          const transitionContacts:ContactFootprint[]=[];
          const effectPlots:{bounds:THREE.Box3;kind:string}[]=[];
          for(const plot of changed){
            const old=previous.get(plot.id)!;
            const bounds=new THREE.Box3();
            if(old.stage>0){const oldGroup=building(old,this.gameMode);this.previousStructures.add(oldGroup);bounds.expandByObject(oldGroup);}
            if(plot.stage>0){
              const newGroup=building(plot,this.gameMode);bounds.expandByObject(newGroup);
              if(isSandshipArrival(old,plot)&&!this.reducedMotion.matches){
                this.arrivalStructures.add(newGroup);
                this.parachuteArrival=new ParachuteArrival(newGroup,this.mobile);
              }else{
                this.structureReveal.add(newGroup);
                effectPlots.push({bounds:new THREE.Box3().setFromObject(newGroup),kind:plot.kind});
              }
            }
            if(!bounds.isEmpty()){
              const size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
              transitionContacts.push({x:center.x,z:center.z,width:size.x+2,depth:size.z+2});
            }
            if(plot.project)this.pickBoxes.set(plot.project,projectPickBox(plot));
          }
          this.contactShadows.setBuildings([...this.structureContacts,...transitionContacts]);
          this.structurePlane.constant=.48;this.previousStructurePlane.constant=.48;
          this.structureMaterials=this.clipGroup(this.structureReveal,this.structurePlane);
          this.previousStructureMaterials=this.clipGroup(this.previousStructures,this.previousStructurePlane);
          this.constructionEffects=new ConstructionEffects(this.scene,effectPlots,this.mobile);
          this.structureTransition={started:performance.now(),plots:snapshot.plots,height:Math.max(4,...effectPlots.map(effect=>effect.bounds.max.y+1))};
        }else this.buildStructures(snapshot.plots);
      }else this.buildStructures(snapshot.plots);
      this.lastPlots=snapshot.plots.map(plot=>({...plot}));
    }
    if(wallSignature!==this.wallSignature){
      this.finishWallTransition();this.wallSignature=wallSignature;
      const wallSites=()=>{
        const radius=snapshot.outerWood>0?INFRASTRUCTURE.wall.outerRadius:INFRASTRUCTURE.wall.innerRadius;
        return [0,Math.PI/2,Math.PI,Math.PI*1.5].map(angle=>{
          const x=Math.cos(angle)*radius,z=Math.sin(angle)*radius,y=terrainHeight(x,z);
          return {bounds:new THREE.Box3(new THREE.Vector3(x-3,y,z-3),new THREE.Vector3(x+3,y+6.5,z+3)),kind:'wall'};
        });
      };
      if(animate&&this.gameMode&&this.walls.children.length){
        for(const child of [...this.walls.children])this.previousWalls.add(child);
        this.buildWalls(snapshot);this.wallPlane.constant=.48;this.previousWallPlane.constant=.48;
        this.wallMaterials=this.clipGroup(this.walls,this.wallPlane);
        this.previousWallMaterials=this.clipGroup(this.previousWalls,this.previousWallPlane);
        this.wallEffects=new ConstructionEffects(this.scene,wallSites(),this.mobile);
        this.wallTransition={started:performance.now(),snapshot};
      }else if(animate&&this.gameMode&&snapshot.innerWood>0){
        this.buildWalls(snapshot);this.wallPlane.constant=.48;
        this.wallMaterials=this.clipGroup(this.walls,this.wallPlane);
        this.wallEffects=new ConstructionEffects(this.scene,wallSites(),this.mobile);
        this.wallTransition={started:performance.now(),snapshot};
      }else this.buildWalls(snapshot);
    }
    const roadSignature=`${snapshot.roads}/${snapshot.outerRoad}/${snapshot.plots.map(p=>p.stage>0?'1':'0').join('')}/${(snapshot.riverLevel??0)>=2}/${snapshot.districtConnections?.join(',')}`;
    if(roadSignature!==this.roadSignature){
      const roadLevelSignature=`${snapshot.roads}/${snapshot.outerRoad}`;
      const roadLevelChanged=roadLevelSignature!==this.roadLevelSignature;
      this.finishRoadTransition();this.roadSignature=roadSignature;
      this.roadLevelSignature=roadLevelSignature;
      if(animate&&this.gameMode&&snapshot.roads>0&&roadLevelChanged){
        const firstRoad=this.roads.children.length===0;
        for(const child of [...this.roads.children])this.previousRoads.add(child);
        this.buildRoads(snapshot);
        const draws:{geometry:THREE.BufferGeometry;count:number}[]=[],instances:{mesh:THREE.InstancedMesh;count:number}[]=[];
        this.roads.traverse(object=>{
          if(object instanceof THREE.InstancedMesh){instances.push({mesh:object,count:object.count});object.count=0;}
          else if(object instanceof THREE.Mesh){const count=object.geometry.index?.count??object.geometry.getAttribute('position').count;draws.push({geometry:object.geometry,count});object.geometry.setDrawRange(0,0);}
        });
        this.roadTransition={started:performance.now(),firstRoad,draws,instances};
        this.environment.setRoadCenterProgress(firstRoad?0:1);
      }else this.buildRoads(snapshot);
    }
  }
  private updateAtmosphere(snapshot:TownSnapshot){
    this.currentSeason=snapshot.season;
    const t=snapshot.dayFraction,night=Math.max(0,Math.sin((t-.55)*Math.PI*2));
    this.currentNight=night;
    const rainy=snapshot.weather==='rain',overcast=rainy?1:snapshot.weather==='cloudy'?.5:0;
    this.rain.setWeather(rainy,this.reducedMotion.matches);
    this.scene.environmentIntensity=.14*(1-.2*night);
    const daylight=Math.max(0,Math.sin(t*Math.PI*2));
    this.sun.color.set(0xffedcb).lerp(daylightSun,daylight*.45)
      .lerp(overcastSun,overcast*.85).lerp(nightSun,night);
    this.sun.intensity=(3.15-overcast*1.75)*(1-.82*night);
    this.fill.color.set(0xd4edfa).lerp(overcastFill,overcast*.6).lerp(nightFill,night*.7);
    this.fill.groundColor.set(0xb3a282).lerp(nightGround,night*.8);
    this.fill.intensity=(.88+overcast*.2)*(1-.12*night);
    // Keep a readable, raking sun throughout the cycle. Distance also keeps
    // tall roofs inside the shadow camera at dawn and dusk.
    this.sun.position.set(-70+Math.cos(t*Math.PI*2)*28,46+daylight*28,45);
    this.sun.shadow.intensity=1-overcast*.28;
    this.fogColor.set(0xd4e8d6).lerp(overcastFog,overcast).lerp(nightFog,night*.78);
    this.scene.background=this.fogColor;this.scene.fog?.color.copy(this.fogColor);
    MAT.grass.color.set(snapshot.season==='winter'?0xb9cabe:snapshot.season==='autumn'?0xb3a15e:snapshot.season==='spring'?0x79be66:C.grass);
    MAT.leaf.color.set(snapshot.season==='autumn'?0xc28b4b:snapshot.season==='winter'?0x829985:0x5b995e);
    this.renderer.toneMappingExposure=1.05-.08*night;
    this.sky.update(snapshot,night,this.sun.position,this.camera.position);
  }
  render(snapshot:TownSnapshot,roaming:boolean){const now=performance.now();this.updateTransitions(now);this.updateAtmosphere(snapshot);this.environment.update(now/1000,this.currentSeason,this.currentNight);this.rain.update(this.camera,now,roaming);this.renderer.render(this.scene,this.camera);}
  dispose(){this.finishTransitions();this.clear(this.structures);this.clear(this.roads);this.clear(this.walls);this.rain.dispose();this.contactShadows.dispose();this.environmentMap.dispose();this.sun.shadow.dispose();this.renderer.dispose();}
}
