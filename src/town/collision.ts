import { WALL_SEGMENTS, type TownSnapshot } from './model';
import { isWater } from './environment';

export type Collider =
  | {kind:'box';x:number;z:number;hx:number;hz:number}
  | {kind:'circle';x:number;z:number;r:number}
  | {kind:'segment';ax:number;az:number;bx:number;bz:number;r:number};
export interface Point {x:number;z:number}

export function buildColliders(snapshot:TownSnapshot,trees:readonly {x:number;z:number;r:number}[]=[]):Collider[]{
  const result:Collider[]=[];
  for(const plot of snapshot.plots){
    if(plot.stage<2)continue;
    const hx=plot.kind==='castle'?5.9:plot.kind==='project'?4.85:plot.kind==='home'?2.3:3;
    const hz=plot.kind==='castle'?5.5:plot.kind==='project'?4.35:plot.kind==='home'?2.15:2.75;
    result.push({kind:'box',x:plot.x,z:plot.z,hx,hz});
    if(plot.kind==='home'&&plot.stage>=3&&(plot.variant??0)%4===2)result.push({kind:'box',x:plot.x,z:plot.z+hz+1.05,hx:1.45,hz:1.05});
    if(plot.kind!=='project'&&plot.stage>=5)result.push({kind:'box',x:plot.x+hx*.9,z:plot.z-.17,hx:1.1,hz:1.25});
    if(plot.kind!=='project'&&plot.stage>=6)result.push({kind:'box',x:plot.x-hx*1.17,z:plot.z-.8,hx:1.45,hz:1.65});
  }
  for(const [radius,count] of [[34,snapshot.innerWood],[55,snapshot.outerWood]]){
    for(let i=0;i<count;i++){
      if(i%8===0)continue; // Four open gates on each ring.
      const angle=(i+.5)*Math.PI*2/WALL_SEGMENTS;
      const length=radius*Math.PI*2/WALL_SEGMENTS*.94;
      const x=Math.cos(angle)*radius,z=Math.sin(angle)*radius;
      const tx=-Math.sin(angle)*length*.5,tz=Math.cos(angle)*length*.5;
      result.push({kind:'segment',ax:x-tx,az:z-tz,bx:x+tx,bz:z+tz,r:.58});
    }
  }
  for(const tree of trees)result.push({kind:'circle',x:tree.x,z:tree.z,r:tree.r*.65});
  return result;
}

const closest=(x:number,z:number,c:Extract<Collider,{kind:'segment'}>)=>{
  const dx=c.bx-c.ax,dz=c.bz-c.az,l=dx*dx+dz*dz;
  const t=l?Math.max(0,Math.min(1,((x-c.ax)*dx+(z-c.az)*dz)/l)):0;
  return {x:c.ax+t*dx,z:c.az+t*dz};
};
export function isBlocked(x:number,z:number,colliders:readonly Collider[],radius=.75):boolean{
  if(Math.hypot(x,z)>148-radius||isWater(x,z,radius))return true;
  for(const c of colliders){
    if(c.kind==='box'){
      const dx=Math.max(Math.abs(x-c.x)-c.hx,0),dz=Math.max(Math.abs(z-c.z)-c.hz,0);
      if(dx*dx+dz*dz<radius*radius)return true;
    }else if(c.kind==='circle'){
      const dx=x-c.x,dz=z-c.z;if(dx*dx+dz*dz<(radius+c.r)**2)return true;
    }else{
      const p=closest(x,z,c),dx=x-p.x,dz=z-p.z;
      if(dx*dx+dz*dz<(radius+c.r)**2)return true;
    }
  }
  return false;
}
export function moveWithCollisions(start:Point,delta:Point,colliders:readonly Collider[],radius=.75):Point{
  const steps=Math.max(1,Math.ceil(Math.hypot(delta.x,delta.z)/.38));
  let x=start.x,z=start.z;
  for(let i=0;i<steps;i++){
    const nx=x+delta.x/steps,nz=z+delta.z/steps;
    if(!isBlocked(nx,z,colliders,radius))x=nx;
    if(!isBlocked(x,nz,colliders,radius))z=nz;
  }
  return {x,z};
}
