import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Authored around a waterline at local Y=0; +X points toward the figurehead. */
export const SHIP_DRAFT=.72;
export const SHIP_CLEARANCE=7.4;
export const SHIP_FLOAT_HEIGHT=.08;
export const SHIP_DECK_HEIGHT=1.45;
type Paint='hull'|'wood'|'dark'|'gold'|'cream'|'red'|'glass'|'green'|'orange'|'black'|'teal'|'silver'|'net';
const colors:Record<Paint,number>={hull:0x9b3927,wood:0xc99152,dark:0x583929,gold:0xf3be4f,cream:0xfff0cc,red:0xc84131,glass:0x388694,green:0x70a644,orange:0xed832c,black:0x332c30,teal:0x267e88,silver:0xaed4ce,net:0x8c784d};
const UP=new THREE.Vector3(0,1,0);
export interface PlanetShip {root:THREE.Group;sails:THREE.Group;flag:THREE.Group;dispose:()=>void}

/** Baked material batches keep the detailed silhouette inexpensive on the globe. */
export function createPlanetShip(mobile:boolean,flagship=true):PlanetShip{
  const root=new THREE.Group(),sails=new THREE.Group(),flag=new THREE.Group();
  root.name=flagship?'Island trading ship':'Fishing boat';sails.name='Billowing canvas';flag.name='Stern pennant';root.add(sails,flag);
  const buckets=new Map<THREE.Group,Map<Paint,THREE.BufferGeometry[]>>();
  const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
  const add=(geometry:THREE.BufferGeometry,paint:Paint,position:THREE.Vector3=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3(1,1,1),group=root)=>{
    geometry.applyMatrix4(new THREE.Matrix4().compose(position,rotation,scale));
    geometry.deleteAttribute('uv');const flat=geometry.index?geometry.toNonIndexed():geometry;if(flat!==geometry)geometry.dispose();
    const map=buckets.get(group)??new Map<Paint,THREE.BufferGeometry[]>(),list=map.get(paint)??[];list.push(flat);map.set(paint,list);buckets.set(group,map);
  };
  const v=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z);
  const box=(x:number,y:number,z:number,w:number,h:number,d:number,paint:Paint)=>add(new THREE.BoxGeometry(w,h,d),paint,v(x,y,z));
  const beam=(a:THREE.Vector3,b:THREE.Vector3,r:number,paint:Paint,group=root)=>{const delta=b.clone().sub(a);add(new THREE.CylinderGeometry(r,r,delta.length(),mobile?6:8),paint,a.clone().add(b).multiplyScalar(.5),new THREE.Quaternion().setFromUnitVectors(UP,delta.normalize()),undefined,group);};
  const ball=(x:number,y:number,z:number,r:number,paint:Paint,sx=1,sy=1,sz=1)=>add(new THREE.SphereGeometry(r,mobile?10:16,mobile?7:10),paint,v(x,y,z),undefined,v(sx,sy,sz));
  const curve=(points:THREE.Vector3[],r:number,paint:Paint,group=root)=>add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),mobile?16:28,r,5,false),paint,undefined,undefined,undefined,group);
  const ring=(x:number,y:number,z:number,r:number,t:number,paint:Paint,axis:'x'|'z'='z')=>add(new THREE.TorusGeometry(r,t,6,mobile?16:24),paint,v(x,y,z),axis==='x'?new THREE.Quaternion().setFromAxisAngle(UP,Math.PI/2):undefined);
  const finish=():PlanetShip=>{
  // Bake static pieces by material; hull trim and tiny fittings add no per-piece draws.
  for(const [group,map] of buckets)for(const [paint,parts] of map){const geometry=mergeGeometries(parts)!;parts.forEach(g=>g.dispose());geometry.computeBoundingSphere();geometries.add(geometry);const material=new THREE.MeshStandardMaterial({color:colors[paint],roughness:paint==='gold'?.53:.88,metalness:paint==='gold'?.12:0,side:THREE.DoubleSide});materials.add(material);const mesh=new THREE.Mesh(geometry,material);mesh.name=`Ship ${paint}`;mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);}
  root.userData.waterline=0;root.userData.draft=SHIP_DRAFT;root.userData.deckHeight=SHIP_DECK_HEIGHT;
  root.traverse(o=>o.userData.planetNative=true);
  return {root,sails,flag,dispose(){geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());root.removeFromParent();}};
  };
  root.userData.shipType=flagship?'flagship':'fishing';
  if(!flagship){
    // A working coastal cutter: short teal hull, one fore-and-aft sail and open gear deck.
    const sections=[[-3.4,.55,.12],[-2.8,1.23,-.28],[-1.2,1.4,-.48],[1.1,1.28,-.48],[2.6,.85,-.12],[3.5,.04,.4]];
    for(const side of [-1,1]){
      const positions:number[]=[];
      for(let i=0;i<sections.length-1;i++){
        const [x,w,y]=sections[i],[nx,nw,ny]=sections[i+1];
        const a=[x,y,side*w*.5],b=[nx,ny,side*nw*.5],c=[nx,1.45,side*nw],d=[x,1.45,side*w];
        positions.push(...(side>0?[a,b,c,a,c,d]:[a,c,b,a,d,c]).flat());
      }
      const hull=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(positions,3));hull.computeVertexNormals();add(hull,'teal');
      curve(sections.map(([x,w])=>v(x,1.5,side*w)),.095,'cream');
      curve(sections.map(([x,w,y])=>v(x,y*.3+.75,side*w*.83)),.05,'wood');
    }
    const outline=new THREE.Shape();outline.moveTo(sections[0][0],sections[0][1]);
    for(const [x,w] of sections.slice(1))outline.lineTo(x,w);
    for(const [x,w] of [...sections].reverse())outline.lineTo(x,-w);outline.closePath();
    const deck=new THREE.ShapeGeometry(outline);deck.rotateX(Math.PI/2);add(deck,'wood',v(0,1.45,0));
    for(let x=-2.7;x<2.6;x+=.4)box(x,1.46,0,.025,.018,x>1.4?1.65:2.4,'dark');
    // Low wheelhouse with a red pitched roof, rather than the flagship's garden terrace.
    box(-2,2.05,0,1.4,1.2,1.72,'cream');
    for(const side of [-1,1]){box(-1.92,2.19,side*.88,.78,.53,.035,'glass');box(-1.92,2.19,side*.91,.045,.6,.035,'wood');}
    box(-1.28,2.18,0,.035,.52,.92,'glass');box(-1.25,2.18,0,.04,.59,.045,'wood');
    for(const side of [-1,1])add(new THREE.BoxGeometry(1.72,.14,1.05),'red',v(-2,2.78,side*.47),new THREE.Quaternion().setFromAxisAngle(v(1,0,0),side*.27));
    beam(v(-2.2,2.72,-.44),v(-2.2,3.25,-.44),.085,'dark');
    ring(-1.04,2.06,0,.24,.045,'wood','x');beam(v(-1.04,1.45,0),v(-1.04,2.06,0),.05,'dark');
    // Single ochre triangular sail gives the fishing boat a different silhouette.
    beam(v(-.28,1.45,0),v(-.28,5.6,0),.08,'wood');beam(v(-.28,2.4,0),v(2.8,2.55,0),.055,'wood');
    const segments=mobile?8:12,positions:number[]=[],indices:number[]=[],rows:number[][]=[];
    for(let j=0;j<=segments;j++){
      const row:number[]=[];
      for(let i=0;i<=segments-j;i++){const u=i/segments,t=j/segments;row.push(positions.length/3);positions.push(-.25+3*u,2.43+3.05*t+.12*u,.1+.44*Math.sin(Math.PI*u)*Math.sin(Math.PI*t));}
      rows.push(row);
    }
    for(let j=0;j<segments;j++)for(let i=0;i<segments-j;i++){indices.push(rows[j][i],rows[j][i+1],rows[j+1][i]);if(i<segments-j-1)indices.push(rows[j][i+1],rows[j+1][i+1],rows[j+1][i]);}
    const sail=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(positions,3)).setIndex(indices);sail.computeVertexNormals();add(sail,'gold',undefined,undefined,undefined,sails);
    for(const [a,b] of [[v(-.28,5.6,0),v(3.2,1.5,0)],[v(-.28,5.6,0),v(-3.15,1.5,0)]])beam(a,b,.025,'net');
    flag.position.set(-.28,5.5,0);const pennant=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,-.8,.15,0,0,.36,0],3));pennant.computeVertexNormals();add(pennant,'teal',undefined,undefined,undefined,flag);
    // Starboard net boom and a sagging diamond net with visible floats.
    beam(v(.55,1.5,1.1),v(.55,2.7,1.1),.06,'wood');beam(v(.55,2.7,1.1),v(.55,2.6,2.25),.05,'wood');
    const netPoint=(u:number,t:number)=>v(-.55+2.2*u,2.25-1.35*t-.2*Math.sin(Math.PI*u),1.52+.62*Math.sin(Math.PI*t));
    for(let i=0;i<8;i++)for(let j=0;j<5;j++){
      beam(netPoint(i/8,j/5),netPoint((i+1)/8,(j+1)/5),.015,'net');
      beam(netPoint((i+1)/8,j/5),netPoint(i/8,(j+1)/5),.015,'net');
    }
    for(let i=0;i<=6;i++){const p=netPoint(i/6,0);ball(p.x,p.y,p.z,.1,i%2?'cream':'orange');}
    // Catch crates, silver fish, a wicker trap, rope coils and stern life ring.
    box(2.05,1.52,0,.88,.1,1.05,'dark');
    for(const side of [-1,1]){box(2.05,1.68,side*.5,.95,.33,.08,'wood');box(2.05+side*.44,1.68,0,.08,.33,1,'wood');}
    for(let i=0;i<4;i++){ball(1.8+i*.16,1.75,(i%2-.5)*.3,.19,'silver',1.1,.3,.5);ball(1.96+i*.16,1.75,(i%2-.5)*.3,.08,'silver',.45,.3,1);}
    for(const z of [-1,-.45])for(const y of [1.53,1.9])beam(v(.55,y,z),v(1.35,y,z),.035,'net');
    for(let x=.55;x<=1.36;x+=.2){beam(v(x,1.53,-1),v(x,1.9,-1),.025,'net');beam(v(x,1.9,-1),v(x,1.9,-.45),.025,'net');beam(v(x,1.9,-.45),v(x,1.53,-.45),.025,'net');}
    for(const r of [.16,.23,.3])add(new THREE.TorusGeometry(r,.026,5,16),'net',v(-.65,1.51,-.77),new THREE.Quaternion().setFromAxisAngle(v(1,0,0),Math.PI/2));
    ring(-2,1.85,1.25,.3,.085,'cream');for(const y of [1.55,2.15])box(-2,y,1.25,.16,.13,.17,'red');
    return finish();
  }
  // Cross-sections form a round, tapered carvel hull instead of a box or wedge.
  const stations=[[-4.8,.12,.3],[-4.35,1.2,-.15],[-3.3,1.92,-.55],[-1.4,2.12,-SHIP_DRAFT],[1,2.1,-SHIP_DRAFT],[2.8,1.7,-.4],[4.1,.95,.15],[4.8,.08,.7]];
  const bands=[0,.22,.48,.72,1],widths=[.24,.63,.88,1,1];
  for(let band=0;band<bands.length-1;band++){
    const positions:number[]=[];
    for(const side of [-1,1])for(let i=0;i<stations.length-1;i++){
      const point=(s:number,b:number)=>{const [x,w,keel]=stations[s];return [x,keel+(SHIP_DECK_HEIGHT-keel)*bands[b],side*w*widths[b]];};
      const a=point(i,band),b=point(i+1,band),c=point(i+1,band+1),d=point(i,band+1);
      const quad=side>0?[a,b,c,a,c,d]:[a,c,b,a,d,c];positions.push(...quad.flat());
    }
    const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();add(geometry,band===0?'dark':band===2?'gold':'hull');
  }
  // Deck follows the hull outline, with visible plank seams.
  const deck=new THREE.Shape();deck.moveTo(stations[0][0],stations[0][1]);
  for(const [x,w] of stations.slice(1))deck.lineTo(x,w);
  for(const [x,w] of [...stations].reverse())deck.lineTo(x,-w);deck.closePath();
  const deckGeo=new THREE.ShapeGeometry(deck);deckGeo.rotateX(Math.PI/2);add(deckGeo,'wood',v(0,SHIP_DECK_HEIGHT,0));
  const widthAt=(x:number)=>{let i=1;while(i<stations.length-1&&stations[i][0]<x)i++;const a=stations[i-1],b=stations[i],t=(x-a[0])/(b[0]-a[0]);return a[1]+(b[1]-a[1])*t;};
  for(let x=-4.2;x<4.5;x+=.42)box(x,SHIP_DECK_HEIGHT+.015,0,.022,.018,widthAt(x)*1.94,'dark');
  for(const side of [-1,1]){
    for(const y of [.35,.98,1.5])curve(stations.map(([x,w,keel])=>v(x,keel+(SHIP_DECK_HEIGHT-keel)*(y+SHIP_DRAFT)/(SHIP_DECK_HEIGHT+SHIP_DRAFT),side*(w+.025))),y===1.5?.09:.055,y===.98?'gold':'dark');
    const rail=stations.slice(1,-1).map(([x,w])=>v(x,2.16,side*w));curve(rail,.075,'cream');
    for(let x=-4.1;x<=4.2;x+=.62)beam(v(x,1.48,side*widthAt(x)),v(x,2.16,side*widthAt(x)),.055,'cream');
    for(const x of [-3,-1.5,0,1.5,3]){const z=side*(widthAt(x)+.035);ball(x,.7,z,.19,'glass',1,1,.2);ring(x,.7,z,.21,.045,'gold');}
  }
  // Raised stern cabin, wraparound windows, green roof terrace and helm.
  box(-2.9,2.14,0,2.15,1.38,2.9,'cream');box(-2.9,1.52,0,2.35,.16,3.1,'gold');
  for(const side of [-1,1])for(let x=-3.55;x<=-2.1;x+=.65){box(x,2.2,side*1.46,.46,.62,.06,'glass');box(x,2.2,side*1.5,.045,.68,.055,'gold');}
  box(-1.81,1.98,0,.06,.98,.58,'dark');ring(-1.77,2.13,0,.12,.03,'gold','x');
  box(-2.95,2.89,0,2.65,.22,3.28,'red');box(-2.95,3.035,0,2.42,.08,3.05,'green');
  for(const side of [-1,1]){beam(v(-4.1,3.53,side*1.5),v(-1.78,3.53,side*1.5),.06,'cream');for(let x=-4.1;x<-1.7;x+=.58)beam(v(x,3.05,side*1.5),v(x,3.53,side*1.5),.04,'gold');}
  for(let i=0;i<5;i++)box(-1.45+i*.22,2.72-i*.23,1.03,.3,.13,.68,'wood');
  beam(v(-2.05,3.08,0),v(-2.05,3.72,0),.065,'dark');ring(-2.05,3.78,0,.33,.06,'wood','x');
  for(let i=0;i<8;i++){const a=i*Math.PI/4;beam(v(-2.05,3.78,0),v(-2.05,3.78+Math.cos(a)*.45,Math.sin(a)*.45),.035,'gold');}
  // A tiny orange tree and barrels make the upper deck feel inhabited.
  beam(v(-3.65,3.05,.65),v(-3.65,4.12,.65),.07,'wood');ball(-3.65,4.22,.65,.53,'green',1,1,.85);
  for(const [dx,dy,dz] of [[-.3,0,.34],[.28,.1,.25],[0,-.24,-.32]])ball(-3.65+dx,4.22+dy,.65+dz,.12,'orange');
  for(const [x,z] of [[-1.3,-1.1],[2.1,-.9],[2.6,-.65]]){add(new THREE.CylinderGeometry(.29,.26,.57,10),'wood',v(x,1.75,z));for(const y of [1.57,1.91])add(new THREE.TorusGeometry(.285,.027,5,12),'dark',v(x,y,z),new THREE.Quaternion().setFromAxisAngle(v(1,0,0),Math.PI/2));}
  box(2.6,1.52,.35,1.2,.07,1.1,'green');
  // Friendly sun-lion figurehead with orange rays, ears, muzzle and whiskers.
  if(flagship){
    beam(v(3.8,1.25,0),v(6.05,2.22,0),.19,'gold');
    for(let i=0;i<12;i++){const a=i*Math.PI/6;ball(5.85,2.72+Math.cos(a)*.91,Math.sin(a)*.91,.3,i%2?'orange':'gold',.7,1,1);}
    ball(5.91,2.72,0,.83,'gold',.65,1,1);ball(6.34,2.47,0,.43,'cream',.46,.65,1);
    for(const side of [-1,1]){ball(6.36,2.88,side*.32,.13,'black',.3,1,1);ball(6.4,2.92,side*.3,.034,'cream');ball(5.95,3.39,side*.59,.23,'orange');}
    ball(6.55,2.6,0,.14,'dark',.65,.8,1);
    for(const side of [-1,1])for(const dy of [-.12,.06])beam(v(6.46,2.44+dy,side*.2),v(6.43,2.46+dy,side*.5),.022,'dark');
  }else{beam(v(4.3,1.5,0),v(5.75,2.05,0),.11,'wood');}
  // Masts, crows' nest, yards and slack rigging frame the curved canvas.
  const sail=(mast:number,bottom:number,top:number,halfWidth:number,striped=false)=>{
    const rows=mobile?8:14,cols=mobile?10:18,position:number[]=[],color:number[]=[],indices:number[]=[];
    const cream=new THREE.Color(colors.cream),red=new THREE.Color(colors.red);
    for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
      const u=i/cols,t=j/rows,z=(u*2-1)*halfWidth*(.86+.14*t),y=bottom+(top-bottom)*t-.24*Math.sin(Math.PI*u)*(1-t);
      const x=mast+.13+.76*Math.sin(Math.PI*u)*Math.sin(Math.PI*t);
      position.push(x,y,z);const c=striped&&Math.floor(u*7)%2===0?red:cream;color.push(c.r,c.g,c.b);
    }
    for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const a=j*(cols+1)+i,b=a+1,c=a+cols+1,d=c+1;indices.push(a,b,d,a,d,c);}
    const g=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(position,3)).setAttribute('color',new THREE.Float32BufferAttribute(color,3)).setIndex(indices);g.computeVertexNormals();
    const mat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.9,side:THREE.DoubleSide});materials.add(mat);geometries.add(g);const mesh=new THREE.Mesh(g,mat);mesh.name='Curved woven sail';mesh.castShadow=true;mesh.receiveShadow=true;sails.add(mesh);
    beam(v(mast,top,-halfWidth-.2),v(mast,top,halfWidth+.2),.065,'wood');
    for(const side of [-1,1])curve([v(mast+.13,top,side*halfWidth),v(mast+.2,(top+bottom)/2,side*halfWidth*.93),v(mast+.13,bottom,side*halfWidth*.86)],.025,'gold',sails);
    // Gold sun medallion lies on the inflated front of the main sail.
    if(!striped){const y=(bottom+top)/2+.08;ring(mast+.925,y,0,.42,.055,'gold','x');for(let i=0;i<8;i++){const a=i*Math.PI/4;beam(v(mast+.93,y+Math.sin(a)*.56,Math.cos(a)*.56),v(mast+.9,y+Math.sin(a)*.76,Math.cos(a)*.76),.036,'gold');}}
  };
  beam(v(.25,1.45,0),v(.25,8.6,0),.115,'dark');beam(v(.25,1.5,0),v(.25,8.45,0),.082,'wood');
  sail(.25,3.05,6.75,2.45);sail(.25,7.05,8.13,1.5,true);
  add(new THREE.CylinderGeometry(.43,.35,.23,12),'wood',v(.25,6.96,0));add(new THREE.TorusGeometry(.45,.045,6,16),'gold',v(.25,7.18,0),new THREE.Quaternion().setFromAxisAngle(v(1,0,0),Math.PI/2));
  if(flagship){beam(v(-3.15,3.04,0),v(-3.15,6.1,0),.07,'wood');sail(-3.15,3.7,5.8,1.47,true);}
  for(const side of [-1,1]){
    curve([v(.25,8.4,0),v(2.7,5,side*.55),v(4.5,1.9,side*.28)],.027,'dark');
    curve([v(.25,6.8,0),v(-1.4,4.7,side*1.1),v(-4.15,2.2,side*1.1)],.027,'dark');
    for(const x of [-.45,.75])beam(v(.25,6.8,0),v(x,1.55,side*1.92),.022,'dark');
  }
  flag.position.set(.25,8.35,0);const pennant=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,-1.45,.1,.15,-1.08,.39,.08,-1.5,.76,.13,0,.72,0],3)).setIndex([0,1,2,0,2,4,2,3,4]);pennant.computeVertexNormals();add(pennant,'red',undefined,undefined,undefined,flag);
  return finish();
}
