import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const palette={wood:0xb87c45,dark:0x543a32,gold:0xefbb50,stone:0xb8ad91,light:0xe5d5b1,teal:0x35878d,glass:0x80dce0,ember:0xff833c,cloth:0xc85f42,moss:0x718452,skin:0xe8b17a,beam:0xb4f4eb};
type Paint=keyof typeof palette;
const v=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z);
const q=(x=0,y=0,z=0)=>new THREE.Quaternion().setFromEuler(new THREE.Euler(x,y,z));

/** Owns its material palette, merged geometry and articulated subgroups. No shared runtime resources are disposed. */
function builder(name:string,mobile:boolean){
  const root=new THREE.Group();root.name=`ENV_${name}_A_LOD${mobile?1:0}`;
  root.userData.groundY=0;root.userData.forward='+Z';
  const batches=new Map<THREE.Group,Map<Paint,THREE.BufferGeometry[]>>();
  const geometries=new Set<THREE.BufferGeometry>(),materials=new Map<Paint,THREE.MeshStandardMaterial>();
  const group=(name:string,x=0,y=0,z=0)=>{const g=new THREE.Group();g.name=name;g.position.set(x,y,z);root.add(g);return g;};
  const add=(geo:THREE.BufferGeometry,paint:Paint,x=0,y=0,z=0,rotation=new THREE.Quaternion(),target=root)=>{
    geo.applyMatrix4(new THREE.Matrix4().compose(v(x,y,z),rotation,v(1,1,1)));geo.deleteAttribute('uv');
    const flat=geo.index?geo.toNonIndexed():geo;if(flat!==geo)geo.dispose();
    const batch=batches.get(target)??new Map<Paint,THREE.BufferGeometry[]>();const parts=batch.get(paint)??[];
    parts.push(flat);batch.set(paint,parts);batches.set(target,batch);
  };
  const box=(x:number,y:number,z:number,w:number,h:number,d:number,p:Paint,target=root,rotation=new THREE.Quaternion())=>add(new THREE.BoxGeometry(w,h,d),p,x,y,z,rotation,target);
  const cyl=(x:number,y:number,z:number,r:number,h:number,p:Paint,target=root,rotation=new THREE.Quaternion(),top=r)=>add(new THREE.CylinderGeometry(top,r,h,mobile?8:12),p,x,y,z,rotation,target);
  const ring=(x:number,y:number,z:number,r:number,t:number,p:Paint,target=root,rotation=new THREE.Quaternion())=>add(new THREE.TorusGeometry(r,t,mobile?4:6,mobile?12:20),p,x,y,z,rotation,target);
  const beam=(a:THREE.Vector3,b:THREE.Vector3,r:number,p:Paint,target=root)=>{const delta=b.clone().sub(a);const mid=a.clone().add(b).multiplyScalar(.5);cyl(mid.x,mid.y,mid.z,r,delta.length(),p,target,new THREE.Quaternion().setFromUnitVectors(v(0,1,0),delta.normalize()));};
  const gem=(x:number,y:number,z:number,r:number,p:Paint,target=root,sx=1,sy=1,sz=1)=>{const geo=new THREE.OctahedronGeometry(r);geo.scale(sx,sy,sz);add(geo,p,x,y,z,undefined,target);};
  const finish=()=>{
    for(const [target,batch] of batches)for(const [paint,parts] of batch){
      const geo=mergeGeometries(parts);if(!geo)throw new Error(`Cannot merge ${name}/${paint}`);parts.forEach(p=>p.dispose());geometries.add(geo);geo.computeBoundingSphere();
      let mat=materials.get(paint);if(!mat){mat=new THREE.MeshStandardMaterial({name:`MAT_Event_${paint}`,color:palette[paint],roughness:paint==='glass'?.25:.82,metalness:paint==='gold'?.35:0});
        if(paint==='ember'||paint==='glass'){mat.emissive.set(palette[paint]);mat.emissiveIntensity=.35;}
        if(paint==='beam'){mat.transparent=true;mat.opacity=.2;mat.depthWrite=false;mat.emissive.set(palette.beam);mat.emissiveIntensity=.8;mat.side=THREE.DoubleSide;}
        materials.set(paint,mat);
      }
      const mesh=new THREE.Mesh(geo,mat);mesh.name=`${target.name}_${paint}`;mesh.castShadow=paint!=='beam';mesh.receiveShadow=paint!=='beam';target.add(mesh);
    }
    batches.clear();root.traverse(o=>{o.userData.planetNative=true;});let disposed=false;
    return {root,dispose(){if(disposed)return;disposed=true;geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());root.removeFromParent();}};
  };
  return {root,group,add,box,cyl,ring,beam,gem,finish};
}

/** Rear edge hinge: animate lid.rotation.x negatively to open away from +Z. */
export function createEventChest(mobile:boolean){
  const b=builder('EventChest',mobile),{root,box,cyl,ring}=b;
  const lid=b.group('lid',0,.68,-.45);
  // Hollow plank box remains readable when the lid opens.
  box(0,.12,0,1.6,.24,1,'dark');
  for(const x of [-.74,.74])box(x,.44,0,.12,.52,1,'wood');
  for(const z of [-.45,.45])box(0,.44,z,1.48,.52,.1,'wood');
  for(const z of [-.507,.507])for(const y of [.29,.49])box(0,y,z,1.38,.024,.018,'dark');
  box(0,.035,0,1.66,.07,1.04,'gold');
  box(0,.04,.45,1.62,.08,1.02,'dark',lid);
  // Faceted barrel top, capped at both ends, with matching brass straps.
  const roof=new THREE.CylinderGeometry(.51,.51,1.6,mobile?8:12,1,false,0,Math.PI);roof.rotateZ(Math.PI/2);roof.scale(1,.57,1);
  b.add(roof,'wood',0,.065,.45,undefined,lid);
  for(const x of [-.57,.57]){
    box(x,.39,.509,.105,.6,.035,'gold');box(x,.39,-.509,.105,.6,.035,'gold');
    for(let i=0;i<6;i++){const a=(i+.5)*Math.PI/6;box(x,.06+Math.sin(a)*.3,.45+Math.cos(a)*.51,.12,.055,.28,'gold',lid,q(a-Math.PI/2));}
    cyl(x,.68,-.48,.07,.23,'gold',root,q(0,0,Math.PI/2));
  }
  box(0,.57,.535,.22,.28,.06,'gold');box(0,.56,.573,.055,.1,.025,'dark');
  for(const x of [-.84,.84])ring(x,.42,0,.13,.033,'gold',root,q(0,Math.PI/2));
  for(let i=0;i<(mobile?7:14);i++)cyl(Math.sin(i*2.4)*.5,.265+(i%3)*.035,Math.cos(i*2.4)*.27,.11,.035,'gold');
  return {...b.finish(),lid};
}

/** Ruined mount is intentionally an open ring; only lens contains the removable glass. */
export function createEventShrine(mobile:boolean){
  const b=builder('EventShrine',mobile),{root,box,cyl,ring,gem}=b;
  const lens=b.group('lens',0,2.25,0);
  box(0,.12,0,3.8,.24,2.8,'stone');box(0,.32,-.15,3.2,.16,2.25,'light');
  for(let row=0;row<2;row++)for(let col=0;col<4;col++)box(-1.15+col*.76,.42,-.6+row*.9,.71,.045,.82,'stone');
  box(0,.2,1.35,1.7,.16,.5,'light');
  for(const side of [-1,1]){
    const x=side*1.35;cyl(x,.59,-.5,.4,.34,'stone');cyl(x,1.5,-.5,.23,1.6,'light');
    for(let i=0;i<4;i++)box(x, .82+i*.4,-.5,.51,.09,.52,'stone');
    box(x,2.38,-.5,.7,.22,.7,'stone');
    box(x,2.7,-.5,.55,.44,.5,'light',root,q(0,0,side*.13));
    box(side*1.48,.56,.74,.55,.28,.65,'stone',root,q(0,side*.4,side*.08));
    gem(side*1.55,.54,-1.05,.3,'moss',root,1,.35,1);
  }
  // Broken pediment: asymmetrical shoulders leave a jagged missing central span.
  box(-.88,3.14,-.5,1.52,.3,.67,'stone',root,q(0,0,.35));box(.98,3.08,-.5,1.2,.3,.67,'stone',root,q(0,0,-.35));
  gem(-.34,3.55,-.5,.29,'light',root,.8,1,.9);
  cyl(0,.69,0,.62,.55,'stone');cyl(0,1.13,0,.37,.42,'light');cyl(0,1.43,0,.59,.18,'stone');
  ring(0,2.25,0,.75,.13,'stone');ring(0,2.25,.06,.74,.036,'gold');
  for(const x of [-.7,.7])box(x,2.25,.13,.19,.25,.22,'gold');
  // Thin luminous glass and the compass star move as a single artifact.
  cyl(0,0,0,.59,.12,'glass',lens,q(Math.PI/2));ring(0,0,.08,.59,.035,'gold',lens);
  gem(0,0,.105,.27,'light',lens,.72,1,.25);
  for(const x of [-.95,.92])gem(x,.47,.65,.13,'moss',root,2,.4,1);
  return {...b.finish(),lens};
}

export function createEventCaravan(mobile:boolean){
  const b=builder('EventCaravan',mobile),{root,box,cyl,ring,beam,gem}=b;
  const wheels:THREE.Group[]=[];const cargo=b.group('cargo',0,1.15,-.45);
  box(0,.57,-.65,1.48,.17,1.8,'dark');
  for(let i=0;i<5;i++)box(-.58+i*.29,.68,-.65,.265,.09,1.8,'wood');
  for(const side of [-1,1]){
    for(const y of [.86,1.12])box(side*.74,y,-.65,.09,.18,1.85,'wood');
    for(const z of [-1.42,.1])box(side*.75,.99,z,.12,.76,.13,'dark');
    beam(v(side*.58,.59,.16),v(side*.4,.51,1.48),.045,'wood');
    for(const z of [-1.2,-.08]){
      const wheel=b.group(`wheel_${side<0?'left':'right'}_${z<-.5?'rear':'front'}`,side*.84,.4,z);wheels.push(wheel);
      ring(0,0,0,.34,.06,'dark',wheel,q(0,Math.PI/2));ring(0,0,0,.31,.032,'wood',wheel,q(0,Math.PI/2));
      cyl(0,0,0,.1,.15,'gold',wheel,q(0,0,Math.PI/2));
      for(let i=0;i<(mobile?6:8);i++){const a=i*Math.PI*2/(mobile?6:8);beam(v(0,0,0),v(0,Math.cos(a)*.31,Math.sin(a)*.31),.025,'wood',wheel);}
    }
  }
  for(const z of [-1.2,-.08])beam(v(-.86,.4,z),v(.86,.4,z),.055,'dark');
  box(0,.93,-1.52,1.45,.43,.09,'wood');box(0,.82,.21,1.43,.1,.3,'wood');
  // Folded restoration cloth, padded transport cradle and removable Sky Lens cargo.
  box(-.36,.84,-1.04,.46,.25,.55,'cloth');box(.38,.9,-1.04,.44,.4,.45,'light');
  ring(0,.1,0,.37,.045,'gold',cargo);cyl(0,.1,0,.33,.09,'glass',cargo,q(Math.PI/2));
  for(const x of [-.4,.4])box(x,.94,-.45,.13,.4,.48,'dark');
  // Tiny driver, broad hat and reins; animal faces the +Z travel direction.
  box(0,1.08,.12,.34,.43,.23,'teal');gem(0,1.43,.12,.2,'skin',root,.83,1,.83);
  cyl(0,1.61,.12,.29,.06,'wood');cyl(0,1.68,.12,.16,.12,'cloth');
  for(const side of [-1,1]){beam(v(side*.12,1.1,.2),v(side*.17,.94,.37),.045,'skin');beam(v(side*.16,.96,.37),v(side*.16,1.02,1.7),.012,'dark');}
  box(0,.72,1.24,.47,.46,.78,'wood');box(0,.74,1.19,.5,.18,.46,'cloth');
  beam(v(0,.77,1.49),v(0,1.12,1.64),.17,'wood');box(0,1.12,1.76,.3,.28,.43,'wood');box(0,1.05,1.94,.33,.17,.18,'light');
  for(const side of [-1,1]){
    for(const z of [.96,1.5]){beam(v(side*.17,.56,z),v(side*.19,.13,z+.04),.055,'wood');box(side*.19,.065,z+.07,.14,.13,.2,'dark');}
    gem(side*.1,1.39,1.65,.16,'dark',root,.35,1,.45);gem(side*.157,1.18,1.81,.035,'dark');
  }
  beam(v(0,.87,.85),v(0,.44,.72),.055,'dark');box(0,.88,1.53,.37,.1,.12,'dark');
  return {...b.finish(),wheels,cargo};
}

/** Three independent installations; caller controls visibility and beacon activation. */
export function createEventTowerSockets(mobile:boolean){
  const b=builder('EventTowerSockets',mobile),{root,box,cyl,ring,gem,beam}=b;
  const lens=b.group('lens',-.95,1.18,.2),core=b.group('core',0,1.18,.2),gold=b.group('gold',.95,1.18,.2),beacon=b.group('beam',0,1.78,0);
  box(0,.12,0,3,.24,2.5,'stone');box(0,.31,0,2.74,.14,2.18,'light');
  for(const x of [-.95,0,.95]){
    cyl(x,.59,.2,.37,.44,'stone');box(x,.78,.2,.79,.14,.58,'light');
    // Deep dark backing and raised open frame convey an empty socket even at town zoom.
    cyl(x,1.18,-.04,.34,.1,'dark',root,q(Math.PI/2));ring(x,1.18,.07,.36,.07,'stone');
    box(x,1.65,-.04,.3,.08,.15,x===0?'cloth':x<0?'teal':'wood');
  }
  ring(0,0,0,.29,.045,'gold',lens);cyl(0,0,0,.25,.1,'glass',lens,q(Math.PI/2));
  gem(0,0,0,.31,'ember',core,.78,1.2,.65);ring(0,0,-.05,.29,.025,'gold',core);
  ring(0,0,0,.27,.045,'gold',gold);ring(0,0,.045,.18,.032,'gold',gold);
  for(let i=0;i<6;i++){const a=i*Math.PI/3;gem(Math.cos(a)*.27,Math.sin(a)*.27,.025,.07,'gold',gold);}
  for(const x of [-.95,.95])beam(v(x-.95,-.75,.45),v(-.95,-.75,.8),.025,'gold',gold);
  // Modest summit glow; integrations may scale its Y for a distant finale beacon.
  cyl(0,.11,0,.17,.22,'beam',beacon,undefined,.3);gem(0,0,0,.16,'glass',beacon);
  return {...b.finish(),lens,core,gold,beam:beacon};
}
