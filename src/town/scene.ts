import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PLOTS, WALL_SEGMENTS, type PlotState, type TownSnapshot } from './model';
import type { ProjectKey } from './projects';

const C = {
  grass: 0x71855b, grassDark: 0x556e4f, earth: 0x8d795f, path: 0xb39a74,
  wood: 0x80604b, woodLight: 0x9b7759, woodDark: 0x674d3d,
  stone: 0xa7a195, stoneDark: 0x777b78, plaster: 0xe5c9a1,
  roof: 0xb56c58, roofDark: 0x76576b, roofBlue: 0x668193,
  gold: 0xe9c06c, window: 0x50433d, lamp: 0xffd390,
};
const MOBILE=matchMedia('(max-width: 700px)').matches;
const makeMat = (color: number, roughness = 0.85, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness, flatShading: false });
const MAT = {
  grass: makeMat(C.grass), grassDark: makeMat(C.grassDark), earth: makeMat(C.earth), path: makeMat(C.path),
  wood: makeMat(C.wood, .82), woodLight: makeMat(C.woodLight, .82), woodDark: makeMat(C.woodDark, .86),
  stone: makeMat(C.stone, .94), stoneDark: makeMat(C.stoneDark, .96), plaster: makeMat(C.plaster),
  roof: makeMat(C.roof), roofDark: makeMat(C.roofDark), roofBlue: makeMat(C.roofBlue),
  gold: makeMat(C.gold, .52, .28), window: makeMat(C.window),
  lamp: new THREE.MeshBasicMaterial({ color: C.lamp }),
  white: makeMat(0xeae9dd), leaf: makeMat(0x52775a), leafLight: makeMat(0x709466), leafDark: makeMat(0x456b5a),
  red: makeMat(0xbe7062), purple: makeMat(0x8d729e), blue: makeMat(0x668db0),
} as const;
type Mat = THREE.Material;
const boxGeometry = new RoundedBoxGeometry(1,1,1,2,.08);
const plainBoxGeometry = new THREE.BoxGeometry(1,1,1);
const sphereGeometry = new THREE.IcosahedronGeometry(1,1);
const coneGeometry = new THREE.ConeGeometry(1,1,6);
function box(parent: THREE.Group, x:number,y:number,z:number,w:number,h:number,d:number,material:Mat, rotateY=0, rounded=true): THREE.Mesh {
  const mesh = new THREE.Mesh(rounded&&!MOBILE ? boxGeometry : plainBoxGeometry, material);
  mesh.position.set(x,y,z); mesh.scale.set(w,h,d); mesh.rotation.y=rotateY;
  mesh.castShadow=true; mesh.receiveShadow=true; parent.add(mesh); return mesh;
}
function ball(parent:THREE.Group,x:number,y:number,z:number,sx:number,sy:number,sz:number,material:Mat): THREE.Mesh {
  const mesh = new THREE.Mesh(sphereGeometry,material); mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}

function gableRoof(parent:THREE.Group,x:number,y:number,z:number,w:number,d:number,rise:number,material:Mat){
  const a=w/2,b=d/2;
  const vertices=new Float32Array([
    -a,0,b, 0,rise,b, -a,0,-b, -a,0,-b, 0,rise,b, 0,rise,-b,
    0,rise,b, a,0,b, 0,rise,-b, 0,rise,-b, a,0,b, a,0,-b,
    -a,0,b, a,0,b, 0,rise,b, a,0,-b, -a,0,-b, 0,rise,-b,
  ]);
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(vertices,3));geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function tower(parent:THREE.Group,x:number,z:number,height:number,material:Mat=MAT.stone) {
  box(parent,x,height/2,z,2.1,height,2.1,material);
  const cap=new THREE.Mesh(coneGeometry,MAT.roofDark);cap.position.set(x,height+.55,z);cap.scale.set(1.7,1.1,1.7);cap.rotation.y=Math.PI/4;cap.castShadow=true;parent.add(cap);
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
function ringBox(parent:THREE.Group,x:number,z:number,r:number,w:number,h:number,d:number,mat:Mat) {
  const mesh=box(parent,x,h/2,z,w,h,d,mat);mesh.rotation.y=r;return mesh;
}
function building(plot:PlotState): THREE.Group {
  const g=new THREE.Group(); g.position.set(plot.x,0,plot.z);
  const stage=plot.stage, kind=plot.kind, v=plot.variant??0;
  if(stage<=0)return g;
  const isProject=kind==='project';
  const big=isProject||kind==='castle';
  const w=kind==='castle'?11:isProject?6.4:kind==='home'?3.8:5;
  const d=kind==='castle'?10:isProject?5.9:kind==='home'?3.5:4.5;
  const h=kind==='castle'?3.4+Math.max(0,stage-2)*.95:isProject?2.8+Math.max(0,stage-3)*.35:kind==='home'?2.2+(v===1?.8:0)+(stage>=5?.55:0):2.6+(stage>=5?.45:0);
  const wallMat=kind==='castle'?MAT.stone:kind==='forge'||kind==='guild'?MAT.stone:kind==='project'&&plot.project==='dwarves'?MAT.stone:stage>=6&&v%3===0?MAT.stone:MAT.plaster;
  const roofMat=isProject ? ({outpost:MAT.roof, sandship:MAT.roofBlue, battle:MAT.red, wizard:MAT.purple, shmixel:MAT.blue, dwarves:MAT.roofDark} as Record<ProjectKey,Mat>)[plot.project!] : [MAT.roof,MAT.roofDark,MAT.roofBlue][v%3];
  // Construction always starts with a visible footprint and tools beside it.
  box(g,0,.16,0,w+.35,.32,d+.35,MAT.stoneDark);
  if(stage===1){
    for(const sx of [-1,1])for(const sz of [-1,1])box(g,sx*w*.43,1.05,sz*d*.43,.22,1.8,.22,MAT.wood);
    box(g,w*.48,.25,d*.52,.85,.5,.7,MAT.woodLight);
    return g;
  }
  if(stage===2){
    box(g,0,h*.31,0,w*.95,h*.62,d*.95,wallMat);
    for(const sx of [-1,1])for(const sz of [-1,1])box(g,sx*w*.44,h*.47,sz*d*.44,.16,h*.94,.16,MAT.woodDark);
    return g;
  }
  box(g,0,h*.5,0,w,h,d,wallMat);
  box(g,0,h+.13,0,w+.65,.28,d+.65,MAT.woodDark);
  if(kind==='castle'&&stage>=5)box(g,0,h+.3,0,w+.9,.62,d+.9,MAT.stoneDark);
  else gableRoof(g,0,h+.06,0,w+.85,d+.75,kind==='castle'?2.1:kind==='home'?1.2:1.55,roofMat);
  // All later stages visibly add occupancy and architectural mass.
  if(stage>=3){
    box(g,0,.75,d*.505,1.1,1.5,.08,MAT.woodDark);
    box(g,-w*.28,h*.55,d*.51,.65,.78,.09,MAT.window);
    box(g,w*.28,h*.55,d*.51,.65,.78,.09,MAT.window);
    box(g,-w*.28,h*.55,d*.57,.13,.84,.12,MAT.woodLight);
    if(kind==='home'||kind==='project'){for(const sx of [-1,1])box(g,sx*w*.48,h*.48,d*.51,.17,h*.94,.19,MAT.woodDark);box(g,0,h*.68,d*.51,.14,h*.5,.17,MAT.woodLight);}
    box(g,w*.28,h*.55,d*.57,.13,.84,.12,MAT.woodLight);
    awning(g,0,1.85,d*.55,Math.min(2.3,w*.52),roofMat);
  }
  if(stage>=5){
    box(g,-w*.35,h+1.12,-d*.18,.55,1.3,.55,MAT.stoneDark);
    box(g,w*.53,.75,-d*.17,1.65,1.4,2.1,MAT.woodLight);
    box(g,w*.53,1.5,-d*.17,1.9,.3,2.35,roofMat);
    flag(g,-w*.35,h+1.02,d*.08,roofMat);
  }
  if(stage>=6){
    const wingHeight=h*.75;
    box(g,-w*.66,wingHeight*.5,-d*.32,2.25,wingHeight,2.8,wallMat);
    gableRoof(g,-w*.66,wingHeight+.08,-d*.32,2.65,3.1,.85,roofMat);
    if(kind==='home'){
      box(g,w*.65,.23,d*.16,2.15,.42,2.5,MAT.earth);
      for(let i=0;i<3;i++)ball(g,w*.45+i*.58,.52,d*.16,.23,.4,.23,i%2?MAT.red:MAT.leaf);
    }
  }
  if(kind==='castle'){
    for(const sx of [-1,1])for(const sz of [-1,1])if(stage>=3)tower(g,sx*w*.47,sz*d*.47,h+(stage>=5?2.2:0),MAT.stone);
    if(stage>=4){box(g,0,1.5,d*.55,2.4,3,.25,MAT.woodDark);box(g,0,2.8,d*.69,2.7,.2,.2,MAT.stone);}
    if(stage>=5){
      box(g,0,(h+8)/2,-1.1,4.1,h+8,4.1,MAT.stone);
      box(g,0,h+7.7,-1.1,4.7,.55,4.7,MAT.stoneDark);
      const keepRoof=new THREE.Mesh(coneGeometry,MAT.roofDark);keepRoof.position.set(0,h+9,-1.1);keepRoof.scale.set(3.1,2.2,3.1);keepRoof.rotation.y=Math.PI/4;keepRoof.castShadow=true;g.add(keepRoof);
      flag(g,0,h+11.4,-1.1,MAT.gold);
    }
    if(stage>=6){
      for(let i=-4;i<=4;i++)for(const side of [-1,1])box(g,i*1.3,h+1.04,side*d*.51,.72,.9,.72,MAT.stone);
      for(let i=-3;i<=3;i++)for(const side of [-1,1])box(g,side*w*.52,h+1.04,i*1.3,.72,.9,.72,MAT.stone);
    }
  }
  if(kind==='project'){
    const key=plot.project!;
    if(key==='outpost'){
      for(const sx of [-1,1])box(g,sx*3.7,stage>=5?2.4:1.55,0,.55,stage>=5?4.8:3.1,.55,MAT.woodDark);
      if(stage>=3)for(const z of [-1.4,1.4])box(g,3.7,.65,z,1,1.3,1,MAT.woodLight);
      if(stage>=6)flag(g,0,h+2,0,MAT.gold);
    } else if(key==='sandship'){
      if(stage>=3)for(let i=0;i<3;i++)box(g,3.6,.58,-2+i*1.8,1.5,.65,1.25,i%2?MAT.stoneDark:MAT.woodDark);
      if(stage>=5)ringBox(g,3.5,-1,0,1.8,.15,5,MAT.gold);
      if(stage>=6){ball(g,0,h+2,0,2.7,.8,1.6,MAT.roofBlue);box(g,0,h+1.2,0,.2,2.2,.2,MAT.woodDark);}
    } else if(key==='battle'){
      if(stage>=3)for(const x of [-2.8,2.8])box(g,x,.5,4,.45,1.1,5,MAT.woodDark);
      if(stage>=5)for(const x of [-3,3])flag(g,x,h+.3,2,MAT.red);
      if(stage>=6)ball(g,0,h+1.2,0,1.25,.45,1.25,MAT.gold);
    } else if(key==='wizard'){
      if(stage>=3)tower(g,-1,-1,h+Math.max(0,stage-3)*1.1,MAT.stone);
      if(stage>=5)ball(g,-1,h+4.7,-1,.55,.55,.55,MAT.purple);
      if(stage>=6)for(const x of [-3,3])tower(g,x,2,h+1,MAT.stone);
    } else if(key==='shmixel'){
      if(stage>=3)for(let i=0;i<5;i++)box(g,-2.2+i*1.1,h*.58,d*.52,.8,.8,.1,[MAT.red,MAT.gold,MAT.leaf,MAT.blue,MAT.purple][i]);
      if(stage>=6)for(let i=0;i<4;i++)box(g,3.6,.9,-2+i*1.25,.9,1.8,.9,[MAT.red,MAT.gold,MAT.blue,MAT.purple][i]);
    } else if(key==='dwarves'){
      if(stage>=3){box(g,-3,.85,-2,2.8,1.7,.35,MAT.woodDark);box(g,-3,2,-2,3.2,.38,.75,MAT.stoneDark);}
      if(stage>=5)for(let i=0;i<3;i++){const wheel=ball(g,2.7+i*.3,.35,2.4,.3,.3,.3,MAT.stoneDark);wheel.rotation.z=Math.PI/2;}
      if(stage>=6)tower(g,-2,-2,h+2,MAT.stoneDark);
    }
  }
  if(kind==='mill'&&stage>=4){box(g,0,h+2,0,.35,3,.35,MAT.woodDark);for(let i=0;i<4;i++){const blade=box(g,0,h+2,0,.6,4,.12,MAT.woodLight);blade.rotation.z=i*Math.PI/2;}}
  if(kind==='forge'&&stage>=4)box(g,2,.5,2,1.4,.8,1.4,MAT.stoneDark);
  if(kind==='post'&&stage>=4)flag(g,0,h+.3,d*.4,MAT.gold);
  if(kind==='market'&&stage>=4)for(const x of [-2.5,2.5])awning(g,x,2,d*.8,2.2,x<0?MAT.red:MAT.gold);
  if(plot.renovation>0&&stage>=6){
    for(let i=0;i<plot.renovation;i++)ball(g,-w*.37+i*.62,.45,d*.65,.24,.4,.24,i%2?MAT.red:MAT.leaf);
  }
  return g;
}
function hash(n:number){let x=n|0;x^=x>>>16;x=Math.imul(x,0x7feb352d);x^=x>>>15;return (x^x>>>16)>>>0;}
export class TownScene {
  readonly scene=new THREE.Scene();
  readonly camera=new THREE.PerspectiveCamera(43,1,.1,450);
  readonly renderer:THREE.WebGLRenderer;
  readonly pickBoxes=new Map<ProjectKey,THREE.Box3>();
  private readonly land=new THREE.Group();
  private readonly structures=new THREE.Group();
  private readonly roads=new THREE.Group();
  private readonly walls=new THREE.Group();
  private readonly sun=new THREE.DirectionalLight(0xffecd0,2.25);
  private readonly fill=new THREE.HemisphereLight(0xe4edf7,0x6d7655,1.65);
  private readonly materials=new Set<Mat>();
  private structureSignature='';
  private wallSignature='';
  private roadSignature=-1;
  readonly mobile=MOBILE;
  constructor(canvas:HTMLCanvasElement){
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:!this.mobile,alpha:false,powerPreference:this.mobile?'low-power':'high-performance'});
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure=1.35;
    this.renderer.shadowMap.enabled=!this.mobile;
    this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.scene.background=new THREE.Color(0xbad6dc);
    this.scene.fog=new THREE.Fog(0xbad6dc,110,280);
    this.sun.position.set(-32,63,28);this.sun.castShadow=!this.mobile;
    this.sun.shadow.mapSize.set(this.mobile?512:1024,this.mobile?512:1024);
    this.sun.shadow.camera.left=-76;this.sun.shadow.camera.right=76;this.sun.shadow.camera.top=76;this.sun.shadow.camera.bottom=-76;
    this.sun.shadow.camera.near=1;this.sun.shadow.camera.far=180;
    this.sun.shadow.bias=-.00015;
    this.scene.add(this.sun,this.fill,this.land,this.structures,this.roads,this.walls);
    this.camera.position.set(95,106,108);this.camera.lookAt(0,0,0);
    this.createLand();this.createDecor();this.resize();
  }
  resize(){const w=innerWidth,h=innerHeight;this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h,false);}
  setPixelRatio(r:number){this.renderer.setPixelRatio(r);this.resize();}
  private createLand(){
    const earth=new THREE.Mesh(new THREE.CylinderGeometry(70,73,3.8,72),MAT.earth);earth.position.y=-2;earth.receiveShadow=true;this.land.add(earth);
    const grass=new THREE.Mesh(new THREE.CylinderGeometry(68.8,70,1.15,72),MAT.grass);grass.position.y=-.05;grass.receiveShadow=true;this.land.add(grass);
    const center=new THREE.Mesh(new THREE.CylinderGeometry(7.7,7.7,.09,32),MAT.path);center.position.y=.52;center.receiveShadow=true;this.land.add(center);
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
      if(r>66||Math.abs(r-31.5)<3||Math.abs(r-55)<3.5||PLOTS.some(p=>Math.hypot(p.x-x,p.z-z)<(p.kind==='project'?8:5))||Math.abs(x)<2.2||Math.abs(z)<2.2)continue;
      trees.push({x,z,scale:.75+(hash(i*411)%75)/100,shape:i%3});
    }
    const trunk=new THREE.InstancedMesh(new THREE.CylinderGeometry(.33,.45,1.8,5),MAT.woodDark,trees.length);
    const canopy=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.55,1),MAT.leaf,trees.length);
    trunk.castShadow=canopy.castShadow=!this.mobile;trunk.receiveShadow=canopy.receiveShadow=true;
    const dummy=new THREE.Object3D();
    trees.forEach((t,i)=>{
      dummy.position.set(t.x,1.4*t.scale,t.z);dummy.scale.setScalar(t.scale);dummy.updateMatrix();trunk.setMatrixAt(i,dummy.matrix);
      dummy.position.y=2.8*t.scale;dummy.scale.set(t.scale*(t.shape===1?.85:1.15),t.scale*(t.shape===2?1.6:1.1),t.scale);dummy.rotation.y=i*2.4;dummy.updateMatrix();canopy.setMatrixAt(i,dummy.matrix);
      canopy.setColorAt(i,new THREE.Color([0x567859,0x456d62,0x6a8a5e][t.shape]));
    });
    trunk.instanceMatrix.needsUpdate=true;canopy.instanceMatrix.needsUpdate=true;
    this.land.add(trunk,canopy);
    const lampPositions:number[][]=[];
    for(let a=0;a<24;a++){const angle=a*Math.PI*2/24;lampPositions.push([Math.cos(angle)*30,Math.sin(angle)*30]);}
    const posts=new THREE.InstancedMesh(boxGeometry,MAT.woodDark,lampPositions.length),tops=new THREE.InstancedMesh(boxGeometry,MAT.lamp,lampPositions.length);
    lampPositions.forEach(([x,z],i)=>{dummy.rotation.set(0,0,0);dummy.position.set(x,1.6,z);dummy.scale.set(.15,3.2,.15);dummy.updateMatrix();posts.setMatrixAt(i,dummy.matrix);dummy.position.y=3.25;dummy.scale.set(.52,.5,.52);dummy.updateMatrix();tops.setMatrixAt(i,dummy.matrix);});
    posts.instanceMatrix.needsUpdate=tops.instanceMatrix.needsUpdate=true;this.land.add(posts,tops);
  }
  private clear(group:THREE.Group){const dispose=(object:THREE.Object3D)=>{if(object instanceof THREE.InstancedMesh)object.dispose();if(object instanceof THREE.Mesh&&object.geometry!==boxGeometry&&object.geometry!==plainBoxGeometry&&object.geometry!==sphereGeometry&&object.geometry!==coneGeometry)object.geometry.dispose();for(const child of object.children)dispose(child);};for(const child of [...group.children]){group.remove(child);dispose(child);}}
  private buildStructures(plots:PlotState[]){
    this.clear(this.structures);this.pickBoxes.clear();
    const buckets=new Map<Mat,THREE.BufferGeometry[]>();
    const collect=(g:THREE.Group)=>{
      g.updateMatrixWorld(true);
      g.traverse(o=>{if(!(o instanceof THREE.Mesh))return;
        let geometry=o.geometry.clone();
        if(geometry.index){const plain=geometry.toNonIndexed();geometry.dispose();geometry=plain;}
        for(const name of Object.keys(geometry.attributes))if(name!=='position'&&name!=='normal')geometry.deleteAttribute(name);
        geometry.applyMatrix4(o.matrixWorld);
        const bucket=buckets.get(o.material as Mat)??[];bucket.push(geometry);buckets.set(o.material as Mat,bucket);
      });
    };
    for(const p of plots){
      if(p.stage===0)continue;
      const g=building(p);collect(g);
      if(p.project)this.pickBoxes.set(p.project,new THREE.Box3(new THREE.Vector3(p.x-5,0,p.z-5),new THREE.Vector3(p.x+5,16,p.z+5)));
    }
    const complexes=new Map<string,PlotState[]>();
    for(const p of plots)if(p.complexId){const group=complexes.get(p.complexId)??[];group.push(p);complexes.set(p.complexId,group);}
    for(const [id,pair] of complexes){
      if(pair.length!==2)continue;
      const a=pair[0],b=pair[1],g=new THREE.Group();
      const mx=(a.x+b.x)/2,mz=(a.z+b.z)/2,length=Math.hypot(a.x-b.x,a.z-b.z);
      g.position.set(mx,0,mz);g.rotation.y=-Math.atan2(b.z-a.z,b.x-a.x);
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
      const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=!this.mobile;mesh.receiveShadow=true;this.structures.add(mesh);
    }
  }
  private buildRoads(count:number){
    this.clear(this.roads);
    const g=new THREE.Group();
    // The central spokes are always walkable dirt. Stone spreads outward in segments.
    const spokes=[[0,0,-55,0],[0,0,55,0],[0,0,0,-55],[0,0,0,55]];
    for(const [x1,z1,x2,z2] of spokes){const length=Math.hypot(x2-x1,z2-z1);const road=box(g,(x1+x2)/2,.54,(z1+z2)/2,length,.08,2.8,MAT.path);road.rotation.y=-Math.atan2(z2-z1,x2-x1);}
    for(let i=0;i<40;i++){
      const angle=i*Math.PI*2/40,r=31.5;
      const segment=box(g,Math.cos(angle)*r,.56,Math.sin(angle)*r,5.2,.08,2.35,i<count?MAT.stone:MAT.path);
      segment.rotation.y=-angle-Math.PI/2;
    }
    const buckets=new Map<Mat,THREE.BufferGeometry[]>();g.updateMatrixWorld(true);g.traverse(o=>{if(o instanceof THREE.Mesh){const b=buckets.get(o.material as Mat)??[];b.push(o.geometry.clone().applyMatrix4(o.matrixWorld));buckets.set(o.material as Mat,b);}});
    for(const [material,geos] of buckets){const merged=mergeGeometries(geos);geos.forEach(q=>q.dispose());if(merged){const mesh=new THREE.Mesh(merged,material);mesh.receiveShadow=true;this.roads.add(mesh);}}
  }
  private buildWalls(snapshot:TownSnapshot){
    this.clear(this.walls);
    const lists:{radius:number;wood:number;stone:number}[]=[{radius:34,wood:snapshot.innerWood,stone:snapshot.innerStone},{radius:55,wood:snapshot.outerWood,stone:0}];
    for(const ring of lists){
      for(const material of [MAT.woodDark,MAT.stone]){
        const indices:number[]=[];
        for(let i=0;i<WALL_SEGMENTS;i++)if(i%8!==0&&i<ring.wood&&(material===MAT.stone?i<ring.stone:i>=ring.stone))indices.push(i);
        const wall=new THREE.InstancedMesh(this.mobile?plainBoxGeometry:boxGeometry,material,indices.length);
        const dummy=new THREE.Object3D();
        indices.forEach((i,j)=>{const angle=(i+.5)*Math.PI*2/WALL_SEGMENTS;dummy.position.set(Math.cos(angle)*ring.radius,material===MAT.stone?2.2:1.65,Math.sin(angle)*ring.radius);dummy.rotation.y=-angle-Math.PI/2;dummy.scale.set(ring.radius*Math.PI*2/WALL_SEGMENTS*.94,material===MAT.stone?4.4:3.3,.8);dummy.updateMatrix();wall.setMatrixAt(j,dummy.matrix);});
        wall.instanceMatrix.needsUpdate=true;wall.castShadow=!this.mobile;wall.receiveShadow=true;this.walls.add(wall);
      }
      if(ring.wood>0){
        const gates=new THREE.Group();
        for(let i=0;i<4;i++){const a=i*Math.PI/2,gate=new THREE.Group();gate.position.set(Math.cos(a)*ring.radius,0,Math.sin(a)*ring.radius);gate.rotation.y=-a;box(gate,-2,2,0,.75,4,.9,MAT.stoneDark);box(gate,2,2,0,.75,4,.9,MAT.stoneDark);box(gate,0,4,0,5,.7,1.3,MAT.woodDark);gates.add(gate);}
        gates.updateMatrixWorld(true);this.walls.add(gates);
      }
    }
  }
  update(snapshot:TownSnapshot){
    const structureSignature=snapshot.plots.map(p=>`${p.stage}${p.renovation}${p.complexId?'c':''}`).join('');
    const wallSignature=`${snapshot.innerWood}/${snapshot.innerStone}/${snapshot.outerWood}`;
    if(structureSignature!==this.structureSignature){this.structureSignature=structureSignature;this.buildStructures(snapshot.plots);}
    if(wallSignature!==this.wallSignature){this.wallSignature=wallSignature;this.buildWalls(snapshot);}
    if(snapshot.roads!==this.roadSignature){this.roadSignature=snapshot.roads;this.buildRoads(snapshot.roads);}
    const t=snapshot.dayFraction,night=Math.max(0,Math.sin((t-.55)*Math.PI*2));
    const brightness=1-.38*night;
    this.sun.intensity=2.25*brightness;
    this.fill.intensity=1.65*(1-.28*night);
    this.sun.position.set(Math.cos(t*Math.PI*2)*55,Math.max(14,Math.sin(t*Math.PI*2)*65+25),28);
    const sky=new THREE.Color().setHSL(snapshot.weather==='rain'?.58:.55,snapshot.weather==='rain'?.20:.38,night?.43:.79);
    if(snapshot.season==='winter')sky.lerp(new THREE.Color(0xdbe1e4),.24);
    this.scene.background=sky;this.scene.fog?.color.copy(sky);
    MAT.grass.color.set(snapshot.season==='winter'?0xa7b4aa:snapshot.season==='autumn'?0x89845b:snapshot.season==='spring'?0x7a9a63:C.grass);
    MAT.leaf.color.set(snapshot.season==='autumn'?0xa47a4d:snapshot.season==='winter'?0x758270:0x52775a);
    this.renderer.toneMappingExposure=1.35-.15*night;
  }
  render(){this.renderer.render(this.scene,this.camera);}
  dispose(){this.clear(this.structures);this.clear(this.roads);this.clear(this.walls);this.renderer.dispose();}
}
