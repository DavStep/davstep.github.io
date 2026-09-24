import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PLOTS, WALL_SEGMENTS, type PlotState, type TownSnapshot } from './model';
import { INFRASTRUCTURE, accessPathFor } from './town-plan';
import type { ProjectKey } from './projects';
import { C, MAT, type Mat } from './materials';
import { Environment, terrainHeight } from './environment';
import { ContactShadows, type ContactFootprint } from './contact-shadows';
import { TownSky } from './sky';
import { Rain } from './rain';
import { LANDMARK_SHARED_GEOMETRIES, landmarkBuilding } from './landmarks';
import { wallIsGate, wallSection } from './wall-layout';
const MOBILE=matchMedia('(max-width: 700px)').matches;
const boxGeometry = new RoundedBoxGeometry(1,1,1,2,.08);
const plainBoxGeometry = new THREE.BoxGeometry(1,1,1);
const sphereGeometry = new THREE.IcosahedronGeometry(1,1);
const coneGeometry = new THREE.ConeGeometry(1,1,6);
const towerBodyGeometry=new THREE.CylinderGeometry(1.02,1.18,1,10);
const towerRingGeometry=new THREE.CylinderGeometry(1.3,1.22,.23,10);
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
function building(plot:PlotState): THREE.Group {
  const g=new THREE.Group(); g.position.set(plot.x,0,plot.z);
  const stage=plot.stage, kind=plot.kind, v=plot.variant??0;
  if(stage<=0)return g;
  if(kind==='project')return landmarkBuilding(plot);
  const w=kind==='castle'?11:kind==='home'?3.8:5;
  const d=kind==='castle'?10:kind==='home'?3.5:4.5;
  const h=kind==='castle'?3.4+Math.max(0,stage-2)*.95:kind==='home'?2.2+(v===1?.8:0)+(stage>=5?.55:0):2.6+(stage>=5?.45:0);
  const homeWalls=[MAT.plaster,MAT.plasterIvory,MAT.plasterRose,MAT.plasterSage];
  const wallMat=kind==='castle'?MAT.stone:kind==='forge'||kind==='guild'?MAT.stone:stage>=6&&v%3===0?MAT.stone:kind==='home'?homeWalls[v%homeWalls.length]:MAT.plaster;
  const roofMat=[MAT.roof,MAT.roofDark,MAT.roofBlue][v%3];
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
  stoneFooting(g,w,d);
  box(g,0,h+.13,0,w+.65,.28,d+.65,MAT.woodDark,0,false);
  const roofRise=kind==='castle'?2.1:kind==='home'?(v%3===1?1.65:1.2):1.55;
  if(kind==='castle'&&stage>=5)box(g,0,h+.3,0,w+.9,.62,d+.9,MAT.stoneDark);
  else if(kind==='home'&&v%3===2)hipRoof(g,0,h+.06,0,w+.9,d+.83,roofRise,roofMat);
  else {gableRoof(g,0,h+.06,0,w+.85,d+.75,roofRise,roofMat);if(kind==='home'){roofDetail(g,w+.85,d+.75,h+.06,roofRise,v,roofMat);roofEdges(g,w+.85,d+.75,h+.06,roofRise);}}
  // All later stages visibly add occupancy and architectural mass.
  if(stage>=3){
    box(g,0,.85,d*.505,1.16,1.7,.11,MAT.woodDark,0,false);
    box(g,0,.9,d*.57,.82,1.39,.08,MAT.wood,0,false);
    ball(g,.27,.95,d*.67,.065,.065,.065,MAT.gold);
    cottageWindow(g,-w*.28,h*.55,d*.51,v);
    cottageWindow(g,w*.28,h*.55,d*.51,v);
    box(g,-.69,.88,d*.59,.19,1.77,.22,MAT.stone,0,false);
    box(g,.69,.88,d*.59,.19,1.77,.22,MAT.stone,0,false);
    box(g,0,1.78,d*.59,1.56,.2,.22,MAT.stone,0,false);
    if(kind==='home'){for(const sx of [-1,1])box(g,sx*w*.48,h*.48,d*.51,.17,h*.94,.19,MAT.woodDark);box(g,0,h*.68,d*.51,.14,h*.5,.17,MAT.woodLight);}
    awning(g,0,1.85,d*.55,Math.min(2.3,w*.52),roofMat);
    if(kind==='home'){
      // Four facade families remain legible as individual cottages from the walk camera.
      const accent=v%4===0?MAT.woodLight:v%4===1?MAT.woodDark:v%4===2?MAT.stoneDark:MAT.roof;
      for(const side of [-1,1]){
        box(g,side*(w*.5-.13),h*.48,d*.48,.16,h*.91,.18,accent);
        box(g,side*w*.28,h*.55,d*.65,.15,.9,.16,accent);
        box(g,side*w*.28,h*.96,d*.57,.87,.12,.17,accent);
        if(v%2===0)box(g,side*w*.28,.51,d*.7,.8,.17,.32,MAT.stone);
      }
      box(g,0,h*.88,d*.53,w*.91,.12,.18,accent);
      if(v%4!==2){
        beam(g,-w*.46,.57,d*.58,-w*.08,h*.93,.11,.13,accent);
        beam(g,w*.46,.57,d*.58,w*.08,h*.93,.11,.13,accent);
      }
      for(const side of [-1,1]){
        const sideX=side*(w*.5+.065);
        for(const zz of [-d*.39,d*.39])box(g,sideX,h*.5,zz,.16,h*.94,.16,accent,0,false);
        for(const yy of [h*.34,h*.83])box(g,sideX,yy,0,.17,.13,d*.82,accent,0,false);
        box(g,sideX+side*.09,h*.58,0,.09,.66,.74,MAT.woodDark,0,false);
        box(g,sideX+side*.15,h*.58,0,.05,.49,.55,MAT.glass,0,false);
        box(g,sideX+side*.19,h*.58,0,.05,.5,.055,accent,0,false);
      }
      if(stage>=5&&v%4!==2)dormer(g,0,h+.65,d*.12,roofMat);
      if(v%4===1){box(g,0,h*.63,-d*.5,.17,h*.65,.18,accent);box(g,0,h*.78,-d*.51,w*.9,.12,.18,accent);}
      if(v%4===2)porch(g,d,roofMat,v);
      if(v%4===3){
        box(g,0,h*.72,d*.6,1.25,.48,.2,MAT.woodDark);
        for(const side of [-1,1])box(g,side*.64,h*.49,d*.67,.13,.8,.15,MAT.woodDark);
      }
    }
  }
  if(stage>=5){
    chimney(g,-w*.35,-d*.18,h);
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
  if(kind==='home'&&stage>=4){
    const side=v%2?-1:1;
    box(g,side*(w*.5+.59),.23,-d*.12,1.25,.28,1.7,MAT.earth);
    for(let i=0;i<3;i++)ball(g,side*(w*.5+.38+i*.21),.48,-d*.39+i*.45,.2,.25,.2,i%2?MAT.red:MAT.leaf);
    for(let i=0;i<3;i++)box(g,0,.19,d*.5+.75+i*.61,.86,.16,.42,i%2?MAT.stone:MAT.stoneDark,0,false);
    if(stage>=5){
      for(const zz of [-.75,.75])box(g,side*(w*.5+1.27),.72,zz,.13,1.18,.13,MAT.woodDark,0,false);
      for(const yy of [.52,.92])box(g,side*(w*.5+1.27),yy,0,.12,.1,2.12,MAT.woodLight,0,false);
    }
    if(v%4===0&&stage>=5){
      box(g,side*(w*.5+.38),h*.59,-d*.24,1.35,1.45,1.45,wallMat);
      hipRoof(g,side*(w*.5+.38),h*1.12,-d*.24,1.7,1.75,.8,roofMat);
    }
  }
  if(kind==='castle'){
    for(const sx of [-1,1])for(const sz of [-1,1])if(stage>=3)tower(g,sx*w*.47,sz*d*.47,h+(stage>=5?2.2:0),MAT.stone);
    if(stage>=4){
      const arch=new THREE.Shape();arch.moveTo(-1.27,0);arch.lineTo(1.27,0);arch.lineTo(1.27,1.95);arch.quadraticCurveTo(1.2,2.95,0,3.17);arch.quadraticCurveTo(-1.2,2.95,-1.27,1.95);arch.closePath();
      const recess=new THREE.Mesh(new THREE.ExtrudeGeometry(arch,{depth:.15,bevelEnabled:false,curveSegments:8}),MAT.window);recess.position.set(0,.28,d*.505);g.add(recess);
      for(const sx of [-1,1])box(g,sx*1.39,1.38,d*.57,.24,2.65,.28,MAT.stoneDark,0,false);
      beam(g,-1.39,2.72,d*.57,0,3.5,.23,.29,MAT.stoneDark);
      beam(g,0,3.5,d*.57,1.39,2.72,.23,.29,MAT.stoneDark);
      for(let i=-2;i<=2;i++)box(g,i*.42,1.21,d*.63,.065,1.85,.07,MAT.woodDark,0,false);
      box(g,0,.68,d*.65,2.6,.12,.12,MAT.woodDark,0,false);
    }
    if(stage>=5){
      box(g,0,(h+8)/2,-1.1,4.1,h+8,4.1,MAT.stone);
      box(g,0,h+7.7,-1.1,4.7,.55,4.7,MAT.stoneDark);
      for(const y of [h+2.5,h+4.8,h+6.5]){
        box(g,0,y,1,.38,.9,.08,MAT.window,0,false);
        box(g,0,y+.52,1.09,.62,.12,.1,MAT.stoneDark,0,false);
      }
      for(const x of [-1.7,1.7])box(g,x,h+7.45,1.12,.44,.68,.21,MAT.stone,0,false);
      const keepRoof=new THREE.Mesh(coneGeometry,MAT.roof);keepRoof.position.set(0,h+9,-1.1);keepRoof.scale.set(3.1,2.2,3.1);keepRoof.rotation.y=Math.PI/4;keepRoof.castShadow=true;g.add(keepRoof);
      flag(g,0,h+11.4,-1.1,MAT.gold);
    }
    if(stage>=6){
      for(let i=-4;i<=4;i++)for(const side of [-1,1])box(g,i*1.3,h+1.04,side*d*.51,.72,.9,.72,MAT.stone);
      for(let i=-3;i<=3;i++)for(const side of [-1,1])box(g,side*w*.52,h+1.04,i*1.3,.72,.9,.72,MAT.stone);
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
  private readonly structures=new THREE.Group();
  private readonly roads=new THREE.Group();
  private readonly walls=new THREE.Group();
  private readonly sun=new THREE.DirectionalLight(0xffdfad,3.05);
  private readonly fill=new THREE.HemisphereLight(0xb8c8eb,0x9d806a,.68);
  private readonly environmentMap:THREE.WebGLRenderTarget;
  private readonly materials=new Set<Mat>();
  private structureSignature='';
  private wallSignature='';
  private roadSignature='';
  readonly mobile=MOBILE;
  constructor(canvas:HTMLCanvasElement){
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:!this.mobile,alpha:false,powerPreference:this.mobile?'low-power':'high-performance'});
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure=1;
    this.renderer.shadowMap.enabled=true;
    this.renderer.shadowMap.type=THREE.PCFShadowMap;
    const room=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(this.renderer);
    this.environmentMap=pmrem.fromScene(room,.02);
    this.scene.environment=this.environmentMap.texture;this.scene.environmentIntensity=.09;
    room.dispose();pmrem.dispose();
    this.scene.background=new THREE.Color(0xbad6dc);
    this.scene.fog=new THREE.Fog(0xe5ddcd,155,430);
    this.sun.position.set(-70,65,45);this.sun.castShadow=true;
    this.sun.shadow.mapSize.setScalar(this.mobile?1024:4096);
    this.sun.shadow.camera.left=-88;this.sun.shadow.camera.right=88;this.sun.shadow.camera.top=88;this.sun.shadow.camera.bottom=-88;
    this.sun.shadow.camera.near=1;this.sun.shadow.camera.far=270;
    this.sun.shadow.bias=-.00008;
    this.sun.shadow.normalBias=.035;this.sun.shadow.radius=this.mobile?1.25:2.5;
    this.scene.add(this.sun,this.fill,this.land,this.structures,this.roads,this.walls);
    this.environment=new Environment(this.scene,this.mobile);
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
      if(r>66||Math.abs(r-INFRASTRUCTURE.road.ringRadius)<3||Math.abs(r-INFRASTRUCTURE.road.outerRingRadius)<3||Math.abs(r-INFRASTRUCTURE.wall.outerRadius)<3.5||PLOTS.some(p=>Math.hypot(p.x-x,p.z-z)<(p.kind==='project'?8:5))||Math.abs(x)<2.2||Math.abs(z)<2.2)continue;
      trees.push({x,z,scale:.75+(hash(i*411)%75)/100,shape:i%3});
      this.treeObstacles.push({x,z,r:.8});
    }
    const trunk=new THREE.InstancedMesh(new THREE.CylinderGeometry(.33,.45,1.8,5),MAT.woodDark,trees.length);
    const canopy=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.55,1),MAT.foliage,trees.length);
    const pineTiers=[0,1,2].map(()=>new THREE.InstancedMesh(coneGeometry,MAT.pine,trees.length));
    trunk.castShadow=canopy.castShadow=!this.mobile;trunk.receiveShadow=canopy.receiveShadow=true;
    const dummy=new THREE.Object3D();
    trees.forEach((t,i)=>{
      dummy.position.set(t.x,1.4*t.scale,t.z);dummy.rotation.set(0,i*2.4,0);dummy.scale.setScalar(t.scale);dummy.updateMatrix();trunk.setMatrixAt(i,dummy.matrix);
      dummy.position.y=2.8*t.scale;dummy.scale.setScalar(t.shape===0?1.15*t.scale:.0001);dummy.updateMatrix();canopy.setMatrixAt(i,dummy.matrix);
      canopy.setColorAt(i,new THREE.Color([0x567859,0x456d62,0x6a8a5e][t.shape]));
      for(let tier=0;tier<3;tier++){
        dummy.position.y=(2.05+tier*.94)*t.scale;
        dummy.scale.set(t.shape===0?.0001:(1.63-tier*.28)*t.scale,t.shape===0?.0001:(2.05-tier*.18)*t.scale,t.shape===0?.0001:(1.63-tier*.28)*t.scale);
        dummy.updateMatrix();pineTiers[tier].setMatrixAt(i,dummy.matrix);
        pineTiers[tier].setColorAt(i,new THREE.Color([0x5f744e,0x536e52,0x79865a][(i+tier)%3]));
      }
    });
    for(const mesh of [trunk,canopy,...pineTiers]){mesh.instanceMatrix.needsUpdate=true;mesh.castShadow=!this.mobile;mesh.receiveShadow=true;this.land.add(mesh);if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;}
    const stones:{x:number;z:number;s:number}[]=[],shrubs:{x:number;z:number;s:number}[]=[];
    for(let i=0;i<(this.mobile?250:480);i++){
      const angle=(hash(i*293)%6283)/1000,r=8+(hash(i*719+3)%570)/10,x=Math.cos(angle)*r,z=Math.sin(angle)*r;
      if(Math.abs(r-INFRASTRUCTURE.wall.innerRadius)<3||Math.abs(r-INFRASTRUCTURE.road.outerRingRadius)<3||Math.abs(r-INFRASTRUCTURE.wall.outerRadius)<3||Math.abs(x)<2.1||Math.abs(z)<2.1||PLOTS.some(p=>Math.hypot(p.x-x,p.z-z)<(p.kind==='project'?8:5.4)))continue;
      const item={x,z,s:.28+(hash(i*133+5)%80)/100};
      if(i%3===0)shrubs.push(item);else stones.push(item);
    }
    const props:[typeof stones,THREE.BufferGeometry,Mat,number[]][]=[
      [stones,new THREE.IcosahedronGeometry(1,0),MAT.stone,[0xd2c8b6,0xb3b4aa,0xe2d9c8]],
      [shrubs,new THREE.IcosahedronGeometry(1,1),MAT.foliage,[0x667e52,0x73885d,0x536f56]],
    ];
    for(const [positions,geometry,material,palette] of props){
      const mesh=new THREE.InstancedMesh(geometry,material,positions.length);
      positions.forEach((p,i)=>{dummy.position.set(p.x,.53+p.s*.27,p.z);dummy.rotation.set(0,i*2.399,0);dummy.scale.set(p.s,p.s*.55,p.s*.88);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);mesh.setColorAt(i,new THREE.Color(palette[i%palette.length]));});
      mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.castShadow=!this.mobile;mesh.receiveShadow=true;this.land.add(mesh);
    }
    const lampPositions:number[][]=[];
    for(let a=0;a<INFRASTRUCTURE.lamps.count;a++){const angle=a*Math.PI*2/INFRASTRUCTURE.lamps.count;lampPositions.push([Math.cos(angle)*INFRASTRUCTURE.lamps.radius,Math.sin(angle)*INFRASTRUCTURE.lamps.radius]);}
    const posts=new THREE.InstancedMesh(boxGeometry,MAT.woodDark,lampPositions.length),tops=new THREE.InstancedMesh(boxGeometry,MAT.lamp,lampPositions.length);
    lampPositions.forEach(([x,z],i)=>{dummy.rotation.set(0,0,0);dummy.position.set(x,1.6,z);dummy.scale.set(.15,3.2,.15);dummy.updateMatrix();posts.setMatrixAt(i,dummy.matrix);dummy.position.y=3.25;dummy.scale.set(.52,.5,.52);dummy.updateMatrix();tops.setMatrixAt(i,dummy.matrix);});
    posts.instanceMatrix.needsUpdate=tops.instanceMatrix.needsUpdate=true;this.land.add(posts,tops);
  }
  private clear(group:THREE.Group){const dispose=(object:THREE.Object3D)=>{if(object instanceof THREE.InstancedMesh)object.dispose();if(object instanceof THREE.Mesh&&object.geometry!==boxGeometry&&object.geometry!==plainBoxGeometry&&object.geometry!==sphereGeometry&&object.geometry!==coneGeometry)object.geometry.dispose();for(const child of object.children)dispose(child);};for(const child of [...group.children]){group.remove(child);dispose(child);}}
  private buildStructures(plots:PlotState[]){
    this.clear(this.structures);this.pickBoxes.clear();
    const contacts:ContactFootprint[]=[];
    const buckets=new Map<Mat,THREE.BufferGeometry[]>();
    const reusableGeometries=new Set<THREE.BufferGeometry>([boxGeometry,plainBoxGeometry,sphereGeometry,coneGeometry,towerBodyGeometry,towerRingGeometry,...LANDMARK_SHARED_GEOMETRIES]);
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
      const g=building(p);
      const bounds=new THREE.Box3().setFromObject(g),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
      contacts.push({x:center.x,z:center.z,width:size.x+2,depth:size.z+2});
      collect(g);
      if(p.project)this.pickBoxes.set(p.project,new THREE.Box3(new THREE.Vector3(p.x-5.3,0,p.z-5),new THREE.Vector3(p.x+5.3,20,p.z+5)));
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
      const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=true;this.structures.add(mesh);
    }
    this.contactShadows.setBuildings(contacts);
  }
  private buildRoads(snapshot:TownSnapshot){
    const count=snapshot.roads;
    this.clear(this.roads);
    const g=new THREE.Group();
    // The central spokes are always walkable dirt. Stone spreads outward in segments.
    const reach=INFRASTRUCTURE.road.spokeLength;
    const spokes=[[0,0,-reach,0],[0,0,reach,0],[0,0,0,-reach],[0,0,0,reach]];
    for(const [x1,z1,x2,z2] of spokes){const length=Math.hypot(x2-x1,z2-z1);const road=box(g,(x1+x2)/2,.54,(z1+z2)/2,length,.08,2.8,MAT.path);road.rotation.y=-Math.atan2(z2-z1,x2-x1);}
    for(let i=0;i<INFRASTRUCTURE.road.ringSegments;i++){
      const angle=i*Math.PI*2/INFRASTRUCTURE.road.ringSegments,r=INFRASTRUCTURE.road.ringRadius;
      const segment=box(g,Math.cos(angle)*r,.56,Math.sin(angle)*r,5.2,.08,2.35,i<count?MAT.stone:MAT.path);
      segment.rotation.y=-angle-Math.PI/2;
    }
    // The planned outer lane grows around the later neighborhoods.
    for(let i=0;i<snapshot.outerRoad;i++){
      const angle=i*Math.PI*2/INFRASTRUCTURE.road.outerRingSegments,r=INFRASTRUCTURE.road.outerRingRadius;
      const segment=box(g,Math.cos(angle)*r,.55,Math.sin(angle)*r,2*r*Math.sin(Math.PI/INFRASTRUCTURE.road.outerRingSegments)+.1,.08,2.15,MAT.path);
      segment.rotation.y=-angle-Math.PI/2;
    }
    for(const plot of snapshot.plots){
      if(plot.stage===0)continue;
      const access=accessPathFor(plot);
      if(!access)continue;
      const length=Math.hypot(access.x2-access.x1,access.z2-access.z1);
      const path=box(g,(access.x1+access.x2)/2,.545,(access.z1+access.z2)/2,length,.05,1.2,MAT.path);
      path.rotation.y=-Math.atan2(access.z2-access.z1,access.x2-access.x1);
    }
    const buckets=new Map<Mat,THREE.BufferGeometry[]>();g.updateMatrixWorld(true);g.traverse(o=>{if(o instanceof THREE.Mesh){const b=buckets.get(o.material as Mat)??[];b.push(o.geometry.clone().applyMatrix4(o.matrixWorld));buckets.set(o.material as Mat,b);}});
    for(const [material,geos] of buckets){const merged=mergeGeometries(geos);geos.forEach(q=>q.dispose());if(merged){const mesh=new THREE.Mesh(merged,material);mesh.receiveShadow=true;this.roads.add(mesh);}}
    const pebbles:{x:number;z:number;s:number}[]=[];
    for(let axis=0;axis<2;axis++)for(const sign of [-1,1])for(let j=3;j<54;j+=this.mobile?2.6:1.75)for(const side of [-1,1]){
      const along=sign*j,across=side*(.62+(hash(j*31+axis*9)%35)/100);
      pebbles.push({x:axis?across:along,z:axis?along:across,s:.28+(hash(j*53+axis*17+side*3)%40)/100});
    }
    for(let i=0;i<count;i++)for(let j=-2;j<=2;j+=this.mobile?2:1)for(const side of [-1,1]){
      const a=(i+.5)*Math.PI*2/INFRASTRUCTURE.road.ringSegments,r=INFRASTRUCTURE.road.ringRadius+side*.57,t=j*.81;
      pebbles.push({x:Math.cos(a)*r-Math.sin(a)*t,z:Math.sin(a)*r+Math.cos(a)*t,s:.27+(hash(i*73+j*29+side*7)%33)/100});
    }
    const stones=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),MAT.stone,pebbles.length),d=new THREE.Object3D();
    pebbles.forEach((p,i)=>{d.position.set(p.x,.66,p.z);d.rotation.set(0,i*2.399,0);d.scale.set(p.s,.095,p.s*.74);d.updateMatrix();stones.setMatrixAt(i,d.matrix);stones.setColorAt(i,new THREE.Color([0xd8cbb0,0xb9b8ad,0xe5d9c4,0xa9aea8][i%4]));});
    stones.instanceMatrix.needsUpdate=true;if(stones.instanceColor)stones.instanceColor.needsUpdate=true;stones.receiveShadow=true;this.roads.add(stones);
  }
  private buildWalls(snapshot:TownSnapshot){
    this.clear(this.walls);
    const lists:{radius:number;wood:number;stone:number}[]=[{radius:INFRASTRUCTURE.wall.innerRadius,wood:snapshot.innerWood,stone:snapshot.innerStone},{radius:INFRASTRUCTURE.wall.outerRadius,wood:snapshot.outerWood,stone:0}];
    for(const ring of lists){
      const sectorGeometry=wallSectorGeometry(ring.radius);
      let hasWall=false;
      for(const material of [MAT.woodDark,MAT.stone]){
        const indices:number[]=[];
        for(let i=0;i<WALL_SEGMENTS;i++)if(!wallIsGate(i)&&i<ring.wood&&(material===MAT.stone?i<ring.stone:i>=ring.stone))indices.push(i);
        if(!indices.length)continue;
        hasWall=true;
        const wall=new THREE.InstancedMesh(sectorGeometry,material,indices.length);
        const dummy=new THREE.Object3D();
        indices.forEach((i,j)=>{dummy.position.set(0,material===MAT.stone?2.2:1.65,0);dummy.rotation.y=-i*Math.PI*2/WALL_SEGMENTS;dummy.scale.set(1,material===MAT.stone?4.4:3.3,1);dummy.updateMatrix();wall.setMatrixAt(j,dummy.matrix);});
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
              dummy.position.y=stone?4.72:2;
              dummy.rotation.y=-angle-Math.PI/2;
              dummy.scale.set(stone?1.02:.38,stone?.72:4.1,stone?1.02:1.04);
              dummy.updateMatrix();details.setMatrixAt(detailIndex++,dummy.matrix);
            }
          }
          details.instanceMatrix.needsUpdate=true;
          details.castShadow=!this.mobile;details.receiveShadow=true;this.walls.add(details);
        }
      }
      if(!hasWall)sectorGeometry.dispose();
      if(ring.wood>0){
        const gates=new THREE.Group();
        for(let i=0;i<WALL_SEGMENTS;i+=INFRASTRUCTURE.wall.gateInterval){
          if(i+1>=ring.wood)continue;
          const section=wallSection(ring.radius,i),gate=new THREE.Group(),stone=i<ring.stone;
          gate.position.set(section.center.x,0,section.center.z);gate.rotation.y=section.rotation;
          const post=stone?MAT.stoneDark:MAT.woodDark;
          for(const side of [-1,1])box(gate,side*section.length*.5,stone?2.2:1.9,0,.9,stone?4.4:3.8,1.05,post,0,false);
          box(gate,0,stone?4.5:3.9,0,section.length+.9,.62,1.1,stone?MAT.stone:MAT.woodDark,0,false);
          gates.add(gate);
        }
        gates.updateMatrixWorld(true);this.walls.add(gates);
      }
    }
  }
  update(snapshot:TownSnapshot){
    this.currentSeason=snapshot.season;
    const structureSignature=snapshot.plots.map(p=>`${p.stage}${p.renovation}${p.complexId?'c':''}`).join('');
    const wallSignature=`${snapshot.innerWood}/${snapshot.innerStone}/${snapshot.outerWood}`;
    if(structureSignature!==this.structureSignature){this.structureSignature=structureSignature;this.buildStructures(snapshot.plots);}
    if(wallSignature!==this.wallSignature){this.wallSignature=wallSignature;this.buildWalls(snapshot);}
    const roadSignature=`${snapshot.roads}/${snapshot.outerRoad}/${snapshot.plots.map(p=>p.stage>0?'1':'0').join('')}`;
    if(roadSignature!==this.roadSignature){this.roadSignature=roadSignature;this.buildRoads(snapshot);}
    const t=snapshot.dayFraction,night=Math.max(0,Math.sin((t-.55)*Math.PI*2));
    this.currentNight=night;
    const rainy=snapshot.weather==='rain',overcast=rainy?1:snapshot.weather==='cloudy'?.5:0;
    this.rain.setWeather(rainy,this.reducedMotion.matches);
    this.scene.environmentIntensity=.09*(1-.2*night);
    const daylight=Math.max(0,Math.sin(t*Math.PI*2));
    this.sun.color.set(0xffdfad).lerp(new THREE.Color(0xffedcf),daylight*.45)
      .lerp(new THREE.Color(0xdce5f0),overcast*.85).lerp(new THREE.Color(0x9bb6e2),night);
    this.sun.intensity=(3.05-overcast*1.8)*(1-.82*night);
    this.fill.color.set(0xb8c8eb).lerp(new THREE.Color(0xd0d7e4),overcast*.6).lerp(new THREE.Color(0x8198c4),night*.7);
    this.fill.groundColor.set(0x9d806a).lerp(new THREE.Color(0x59657d),night*.8);
    this.fill.intensity=(.68+overcast*.2)*(1-.12*night);
    // Keep a readable, raking sun throughout the cycle. Distance also keeps
    // tall roofs inside the shadow camera at dawn and dusk.
    this.sun.position.set(-70+Math.cos(t*Math.PI*2)*28,46+daylight*28,45);
    this.sun.shadow.intensity=1-overcast*.28;
    const fogColor=new THREE.Color(0xe5ddcd).lerp(new THREE.Color(0xbac5ce),overcast).lerp(new THREE.Color(0x52647c),night*.78);
    this.scene.background=fogColor;this.scene.fog?.color.copy(fogColor);
    MAT.grass.color.set(snapshot.season==='winter'?0xa7b4aa:snapshot.season==='autumn'?0x89845b:snapshot.season==='spring'?0x7a9a63:C.grass);
    MAT.leaf.color.set(snapshot.season==='autumn'?0xa47a4d:snapshot.season==='winter'?0x758270:0x52775a);
    this.renderer.toneMappingExposure=1-.04*night;
    this.sky.update(snapshot,night,this.sun.position,this.camera.position);
  }
  render(){const now=performance.now();this.environment.update(now/1000,this.currentSeason,this.currentNight);this.sky.updatePosition(this.camera.position);this.rain.update(this.camera,now);this.renderer.render(this.scene,this.camera);}
  dispose(){this.clear(this.structures);this.clear(this.roads);this.clear(this.walls);this.rain.dispose();this.contactShadows.dispose();this.environmentMap.dispose();this.sun.shadow.dispose();this.renderer.dispose();}
}
