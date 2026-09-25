import { terrainGridCoordinate, terrainGridDivisions } from './topography';
import { terrainHeight } from './environment';

export type GroundPoint={x:number;z:number};
export interface GroundTriangle {a:GroundPoint;b:GroundPoint;c:GroundPoint}

/** Matches PlaneGeometry's grid, Float32 positions and b–d cell diagonal. */
export class TerrainSurface {
  readonly coordinates:number[];
  private readonly heights=new Map<number,number>();
  constructor(mobile:boolean,private readonly heightAt=(x:number,z:number)=>terrainHeight(x,z)){
    const divisions=terrainGridDivisions(mobile);
    this.coordinates=Array.from({length:divisions+1},(_,i)=>Math.fround(terrainGridCoordinate(Math.fround(-350+i*700/divisions)/350)));
  }
  cell(value:number):number {
    let low=0,high=this.coordinates.length-1;
    while(high-low>1){const mid=(low+high)>>1;if(this.coordinates[mid]<=value)low=mid;else high=mid;}
    return Math.min(low,this.coordinates.length-2);
  }
  private vertex(ix:number,iz:number):number {
    const key=iz*this.coordinates.length+ix;
    let height=this.heights.get(key);
    if(height===undefined){height=Math.fround(this.heightAt(this.coordinates[ix],this.coordinates[iz]));this.heights.set(key,height);}
    return height;
  }
  sample(x:number,z:number):{height:number;dx:number;dz:number}{
    const ix=this.cell(x),iz=this.cell(z),x0=this.coordinates[ix],x1=this.coordinates[ix+1],z0=this.coordinates[iz],z1=this.coordinates[iz+1];
    const u=(x-x0)/(x1-x0),v=(z-z0)/(z1-z0);
    const a=this.vertex(ix,iz),b=this.vertex(ix,iz+1),c=this.vertex(ix+1,iz+1),d=this.vertex(ix+1,iz);
    if(u+v<=1)return {height:a+(d-a)*u+(b-a)*v,dx:(d-a)/(x1-x0),dz:(b-a)/(z1-z0)};
    return {height:c+(b-c)*(1-u)+(d-c)*(1-v),dx:(c-b)/(x1-x0),dz:(c-d)/(z1-z0)};
  }
  triangles(ix:number,iz:number):GroundTriangle[]{
    const x0=this.coordinates[ix],x1=this.coordinates[ix+1],z0=this.coordinates[iz],z1=this.coordinates[iz+1];
    const a={x:x0,z:z0},b={x:x0,z:z1},c={x:x1,z:z1},d={x:x1,z:z0};
    return [{a,b,c:d},{a:b,b:c,c:d}];
  }
}

/** Intersect a road footprint with one ground triangle in the X/Z plane. */
export function clipToGroundTriangle(polygon:GroundPoint[],triangle:GroundTriangle):GroundPoint[]{
  let output=polygon;
  for(const [a,b] of [[triangle.a,triangle.b],[triangle.b,triangle.c],[triangle.c,triangle.a]]){
    const input=output;output=[];
    const distance=(p:GroundPoint)=>(b.z-a.z)*(p.x-a.x)-(b.x-a.x)*(p.z-a.z);
    for(let i=0;i<input.length;i++){
      const start=input[i],end=input[(i+1)%input.length],ds=distance(start),de=distance(end);
      if(ds>=-1e-9)output.push(start);
      if((ds>=0)!==(de>=0)){
        const t=ds/(ds-de);output.push({x:start.x+(end.x-start.x)*t,z:start.z+(end.z-start.z)*t});
      }
    }
  }
  return output;
}
