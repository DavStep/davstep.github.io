import * as THREE from 'three';
import { TerrainSurface, clipToGroundTriangle } from './terrain-surface';

export type PathPoint = { x: number; z: number };

// A ground-hugging dirt surface; road centerlines and gameplay routes stay fixed.
// Rounded variation is limited to the verge, leaving the full walking lane clear.
export function pathRibbon(points: PathPoint[], width: number, mobile=false, surface=new TerrainSurface(mobile)): THREE.BufferGeometry {
  const positions: number[] = [], indices: number[] = [];
  const edges:PathPoint[][]=[];
  const closed = points.length > 2 && Math.hypot(points[0].x-points.at(-1)!.x,points[0].z-points.at(-1)!.z)<1e-5;
  for(let i=0;i<points.length;i++){
    const p=points[i],previous=points[i>0?i-1:closed?points.length-2:0],next=points[i<points.length-1?i+1:closed?1:i];
    const dx=next.x-previous.x,dz=next.z-previous.z,length=Math.hypot(dx,dz)||1;
    const verge=Math.sin(p.x*1.7+p.z*.61)*.055+Math.sin(p.x*.57-p.z*1.31)*.045;
    const edge:PathPoint[]=[];
    for(const side of [-1,1]){
      const half=width*.5+verge*side;
      const x=p.x-dz/length*half*side,z=p.z+dx/length*half*side;
      edge.push({x,z});
    }
    edges.push(edge);
    if(i===0)continue;
    const previousEdge=edges[i-1];
    for(const triangle of [[previousEdge[0],previousEdge[1],edge[0]],[edge[0],previousEdge[1],edge[1]]]){
      const minX=surface.cell(Math.min(...triangle.map(p=>p.x))),maxX=surface.cell(Math.max(...triangle.map(p=>p.x)));
      const minZ=surface.cell(Math.min(...triangle.map(p=>p.z))),maxZ=surface.cell(Math.max(...triangle.map(p=>p.z)));
      for(let ix=minX;ix<=maxX;ix++)for(let iz=minZ;iz<=maxZ;iz++)for(const ground of surface.triangles(ix,iz)){
        const polygon=clipToGroundTriangle(triangle,ground);
        for(let j=1;j<polygon.length-1;j++){
          const tri=[polygon[0],polygon[j],polygon[j+1]];
          const [a,b,c]=tri;
          const area=(b.z-a.z)*(c.x-a.x)-(b.x-a.x)*(c.z-a.z);
          if(area<1e-9)continue;
          for(const point of tri){indices.push(positions.length/3);positions.push(point.x,surface.sample(point.x,point.z).height+.048,point.z);}
        }
      }
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}

export function linePoints(from: PathPoint,to: PathPoint,spacing=1.3): PathPoint[]{
  const count=Math.max(1,Math.ceil(Math.hypot(to.x-from.x,to.z-from.z)/spacing));
  return Array.from({length:count+1},(_,i)=>({x:from.x+(to.x-from.x)*i/count,z:from.z+(to.z-from.z)*i/count}));
}

export function ringPoints(radius:number,segments:number,endFraction=1):PathPoint[]{
  const count=Math.max(1,Math.ceil(segments*4*endFraction));
  return Array.from({length:count+1},(_,i)=>{
    const a=i/count*Math.PI*2*endFraction;return {x:Math.cos(a)*radius,z:Math.sin(a)*radius};
  });
}
