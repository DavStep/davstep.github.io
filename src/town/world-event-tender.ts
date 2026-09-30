import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Small open ship's tender. +Z is the bow; local Y=0 is its waterline, draft is .25. */
export function createEventTender(mobile:boolean){
  const root=new THREE.Group();root.name='ENV_EventTender_A_LOD'+(mobile?1:0);root.userData.waterline=0;root.userData.draft=.25;
  const colors={hull:0xa35c37,wood:0xd7a268,gold:0xe9bb63,dark:0x593d30};
  type Paint=keyof typeof colors;
  const batches=new Map<THREE.Group,Map<Paint,THREE.BufferGeometry[]>>(),geometries=new Set<THREE.BufferGeometry>(),materials=new Map<Paint,THREE.Material>();
  const add=(g:THREE.BufferGeometry,paint:Paint,target=root)=>{g.deleteAttribute('uv');const flat=g.index?g.toNonIndexed():g;if(flat!==g)g.dispose();const batch=batches.get(target)??new Map<Paint,THREE.BufferGeometry[]>();const list=batch.get(paint)??[];list.push(flat);batch.set(paint,list);batches.set(target,batch);};
  const box=(x:number,y:number,z:number,w:number,h:number,d:number,paint:Paint,target=root)=>add(new THREE.BoxGeometry(w,h,d).translate(x,y,z),paint,target);
  const line=(a:THREE.Vector3,b:THREE.Vector3,r:number,paint:Paint,target=root)=>{const delta=b.clone().sub(a),g=new THREE.CylinderGeometry(r,r,delta.length(),mobile?5:6);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()));g.translate((a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2);add(g,paint,target);};
  const v=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z);
  const stations=mobile?[[-1.25,.08],[-.95,.43],[0,.6],[.82,.44],[1.25,0]]:[[-1.25,.08],[-1.05,.34],[-.65,.52],[0,.6],[.6,.52],[1,.3],[1.25,0]];
  // Separate lapstrake bands form a tapered, hollow hull; rim encloses a warm inner lining.
  const bands=[[-.25,.18],[-.08,.62],[.14,.9],[.35,1]];
  for(let j=0;j<bands.length-1;j++){
    const positions:number[]=[];
    for(const side of [-1,1])for(let i=0;i<stations.length-1;i++){
      const point=(s:number,b:number)=>{const [z,width]=stations[s],[y,spread]=bands[b];return [side*width*spread,y+Math.abs(z/1.25)**3*.11,z];};
      const a=point(i,j),b=point(i+1,j),c=point(i+1,j+1),d=point(i,j+1);positions.push(...(side===1?[a,c,b,a,d,c]:[a,b,c,a,c,d]).flat());
    }
    const geo=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.computeVertexNormals();add(geo,j===1?'wood':'hull');
  }
  for(const side of [-1,1])for(let i=0;i<stations.length-1;i++){
    const [z,w]=stations[i],[nz,nw]=stations[i+1];
    for(const [y,spread,paint,r] of [[.35,1,'gold',.035],[.14,.9,'dark',.012]] as const)line(v(side*w*spread,y+Math.abs(z/1.25)**3*.11,z),v(side*nw*spread,y+Math.abs(nz/1.25)**3*.11,nz),r,paint);
  }
  // Narrow floorboards follow the hull's width without closing its open interior.
  for(const x of [-.16,0,.16])box(x,-.13,0,.145,.055,1.64,'wood');
  for(const z of [-.62,.54]){box(0,.45,z,.89,.075,.25,'wood');for(const x of [-.35,.35])box(x,.22,z,.07,.4,.13,'dark');}
  box(0,-.23,0,.1,.04,1.8,'dark');
  // One merged material per oar preserves independent oarlock pivots within seven draws total.
  const oars:THREE.Group[]=[];
  for(const side of [-1,1]){
    const oar=new THREE.Group();oar.name=side<0?'oar_port':'oar_starboard';oar.position.set(side*.58,.38,0);root.add(oar);oars.push(oar);
    line(v(-side*.3,.07,0),v(side*.6,-.16,.03),.025,'wood',oar);box(side*.73,-.19,.03,.3,.045,.16,'wood',oar);
    line(v(side*.58,.32,-.065),v(side*.58,.44,-.065),.023,'gold');line(v(side*.58,.32,.065),v(side*.58,.44,.065),.023,'gold');
  }
  for(const [target,batch] of batches)for(const [paint,parts] of batch){const geo=mergeGeometries(parts)!;parts.forEach(p=>p.dispose());geo.computeBoundingSphere();geometries.add(geo);let mat=materials.get(paint);if(!mat){mat=new THREE.MeshStandardMaterial({color:colors[paint],roughness:.85,side:THREE.DoubleSide});materials.set(paint,mat);}const mesh=new THREE.Mesh(geo,mat);mesh.name=`${target.name}_${paint}`;mesh.castShadow=true;mesh.receiveShadow=true;target.add(mesh);}
  root.traverse(o=>o.userData.planetNative=true);batches.clear();let disposed=false;
  return {root,oars,dispose(){if(disposed)return;disposed=true;geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());root.removeFromParent();}};
}
