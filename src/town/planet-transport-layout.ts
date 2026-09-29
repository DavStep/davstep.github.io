import { PLANET_RADIUS,planetElevation,surfaceNormal } from './planet-geography';
import { SHIP_CLEARANCE,SHIP_DRAFT } from './planet-ship';
import type { RoadPoint as Point } from './planet-building-access';
import type { TownSnapshot } from './model';
import { wallIsGate,CARDINAL_GATE_MASK } from './wall-layout';
import { INFRASTRUCTURE } from './town-plan';
export interface Crossing {id:string;a:Point;b:Point;level:number}
/** Each crossing spends two Roads levels as timber before masons rebuild it. */
export function bridgeMaterial(bridge:Crossing,roadLevel:number):'timber'|'stone'{return roadLevel>=bridge.level+2?'stone':'timber';}
export interface Harbor {id:string;land:Point;sea:Point}
const height=(p:Point)=>planetElevation(surfaceNormal(p.x,p.z));
export const mixPoint=(a:Point,b:Point,t:number):Point=>({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});
function shoreSafe(p:Point){const h=height(p),r=Math.hypot(p.x,p.z),sector=Math.floor(((Math.atan2(p.z,p.x)+Math.PI*2)%(Math.PI*2))/(Math.PI*2)*32);
  if([INFRASTRUCTURE.wall.innerRadius,INFRASTRUCTURE.wall.outerRadius].some(w=>Math.abs(w-r)<3)&&!wallIsGate(sector,CARDINAL_GATE_MASK))return false;
  return h>.9&&h<3.5&&[[1.5,0],[-1.5,0],[0,1.5],[0,-1.5]].every(([x,z])=>Math.abs(height({x:p.x+x,z:p.z+z})-h)<.5);}
let cached:{bridges:Crossing[];harbors:Harbor[]}|undefined;
/** Survey actual coastlines once; every landing is grounded in the shared height field. */
export function planetTransportLayout(){
  if(cached)return cached;
  const bridges:Crossing[]=[];
  for(const [id,cx,cz,level] of [['western-island',-60,22,2],['southern-island',-64,91,4],['eastern-island',44,25,6]] as const){
    let best:Crossing|undefined,score=Infinity;
    for(let x=cx-18;x<=cx+18;x+=2)for(let z=cz-18;z<=cz+18;z+=2){
      const a={x,z};if(!shoreSafe(a))continue;
      for(let direction=0;direction<16;direction++){
        const angle=direction*Math.PI/8,dx=Math.cos(angle),dz=Math.sin(angle);let water=0,deep=0;
        for(let d=2;d<=44;d+=2){
          const b={x:x+dx*d,z:z+dz*d},h=height(b);
          if(h<0)water++;if(h<-.6)deep++;
          if(d<8||water<2||deep<1||!shoreSafe(b))continue;
          // A bridge follows a single channel, never tunnels through another hill.
          const points=Array.from({length:33},(_,i)=>mixPoint(a,b,i/32));
          if(points.some((p,i)=>height(p)>height(a)+(height(b)-height(a))*i/32+Math.sin(i/32*Math.PI)*1.5+.25))break;
          const value=Math.hypot((a.x+b.x)/2-cx,(a.z+b.z)/2-cz)+d*.45;
          if(value<score){score=value;best={id,a,b,level};}break;
        }
      }
    }
    if(best)bridges.push(best);
  }
  const harbors:Harbor[]=[];
  for(const [id,cx,cz] of [['castle-harbor',-5,42],['island-harbor',-42,89]] as const){
    let best:Harbor|undefined,score=Infinity;
    for(let x=cx-24;x<=cx+24;x+=2)for(let z=cz-22;z<=cz+22;z+=2){
      const land={x,z};if(!shoreSafe(land))continue;
      for(let angle=0;angle<Math.PI*2;angle+=Math.PI/8){
        const sea={x:x+Math.cos(angle)*12,z:z+Math.sin(angle)*12};
        if(height(sea)>-1||[[2,0],[-2,0],[0,2],[0,-2]].some(([dx,dz])=>height({x:sea.x+dx,z:sea.z+dz})>-.35))continue;
        const line=Array.from({length:13},(_,i)=>mixPoint(land,sea,i/12));
        if(line.some(p=>height(p)>height(land)+.1)||line.slice(7).some(p=>height(p)>.1))continue;
        const value=Math.hypot(x-cx,z-cz)+height(land)*2;
        if(value<score){score=value;best={id,land,sea};}
      }
    }
    if(best)harbors.push(best);
  }
  return cached={bridges,harbors};
}
export function harborBerth(harbor:Harbor){
  const dx=harbor.sea.x-harbor.land.x,dz=harbor.sea.z-harbor.land.z,d=Math.hypot(dx,dz);
  const scale=1+(harbor.sea.x**2+harbor.sea.z**2)/(4*PLANET_RADIUS**2);
  for(let reach=(SHIP_CLEARANCE+4)*scale;reach<=60;reach+=2){
    for(const turn of [0,Math.PI/8,-Math.PI/8,Math.PI/4,-Math.PI/4,3*Math.PI/8,-3*Math.PI/8,Math.PI/2,-Math.PI/2,5*Math.PI/8,-5*Math.PI/8,3*Math.PI/4,-3*Math.PI/4]){
      const x=dx/d*Math.cos(turn)-dz/d*Math.sin(turn),z=dx/d*Math.sin(turn)+dz/d*Math.cos(turn);
      const p={x:harbor.sea.x+x*reach,z:harbor.sea.z+z*reach};
      if(shipWaterSafe(p,true))return p;
    }
  }
  throw new Error(`No clear shipping berth at ${harbor.id}`);
}
export function harborHut(harbor:Harbor){
  const dx=harbor.sea.x-harbor.land.x,dz=harbor.sea.z-harbor.land.z,length=Math.hypot(dx,dz);
  const center={x:harbor.land.x-dx/length*4+dz/length*3,z:harbor.land.z-dz/length*4-dx/length*3};
  const vx=harbor.land.x-center.x,vz=harbor.land.z-center.z,d=Math.hypot(vx,vz),scale=1/(1+(center.x*center.x+center.z*center.z)/(4*85*85));
  return {center,door:{x:center.x+vx/d*1.35/scale,z:center.z+vz/d*1.35/scale}};
}
export function planetTransportState(snapshot:TownSnapshot){
  const river=snapshot.riverLevel??0,settlers=snapshot.plots.some(p=>p.kind==='home'&&p.stage>0);
  return {dock:river>0,fishing:river>0&&settlers,boats:settlers&&river>=2?river>=3?2:1:0,
    harbors:river>0?planetTransportLayout().harbors.slice(0,river>=3?2:1):[],
    bridges:planetTransportLayout().bridges.filter(b=>(snapshot.roadLevel??0)>=b.level)};
}

/** Full vessel footprint, including turning room and mast clearance from bridges. */
export function shipWaterSafe(p:Point,turningRoom=false){
  const scale=1+(p.x*p.x+p.z*p.z)/(4*PLANET_RADIUS*PLANET_RADIUS),radius=(turningRoom?SHIP_CLEARANCE:2.4)*scale;
  if(height(p)>-SHIP_DRAFT-.1)return false;
  for(let i=0;i<16;i++){
    const angle=i*Math.PI/8;
    if(height({x:p.x+Math.cos(angle)*radius,z:p.z+Math.sin(angle)*radius})>-.05)return false;
  }
  return planetTransportLayout().bridges.every(({a,b})=>{
    const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz)));
    return Math.hypot(p.x-a.x-dx*t,p.z-a.z-dz*t)>(SHIP_CLEARANCE+2)*scale;
  });
}
/** A water-only navigation grid, with room for the complete ship to turn. */
export function seaRoute(start:Point,end:Point):Point[]{
  const step=2,min=-170,size=171,points=Array.from({length:size*size},(_,i)=>({x:min+i%size*step,z:min+Math.floor(i/size)*step}));
  const safe=(p:Point)=>shipWaterSafe(p);
  const line=(a:Point,b:Point)=>{
    const distance=Math.hypot(b.x-a.x,b.z-a.z),count=Math.max(1,Math.ceil(distance)),dx=(b.x-a.x)/(distance||1),dz=(b.z-a.z)/(distance||1);
    for(let i=0;i<=count;i++){
      const p=mixPoint(a,b,i/count);if(!safe(p))return false;
      const scale=1+(p.x*p.x+p.z*p.z)/(4*PLANET_RADIUS*PLANET_RADIUS);
      for(const [along,width] of [[-4.8,.25],[-3,2],[0,2.2],[3,1.7],[4.8,.25],[6.7,.9]])for(const side of [-1,0,1]){
        const floor=side===0&&Math.abs(along)<=3?-SHIP_DRAFT-.1:-.05;
        if(height({x:p.x+(dx*along-dz*side*width)*scale,z:p.z+(dz*along+dx*side*width)*scale})>floor)return false;
      }
    }
    return true;
  };
  const wet=points.map(safe);
  const nearest=(p:Point)=>{let best=-1,d=Infinity;points.forEach((q,i)=>{const distance=Math.hypot(q.x-p.x,q.z-p.z);if(wet[i]&&distance<d&&distance<6&&line(p,q)){best=i;d=distance;}});return best;};
  const root=nearest(start),goal=nearest(end);if(root<0||goal<0)return [];
  const previous=new Int32Array(points.length).fill(-1),queue=[root];previous[root]=root;
  for(let at=0;at<queue.length&&previous[goal]<0;at++){
    const id=queue[at],x=id%size,z=Math.floor(id/size);
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
      const nx=x+dx,nz=z+dz;if(nx<0||nz<0||nx>=size||nz>=size)continue;
      const next=nz*size+nx;if(!wet[next]||previous[next]>=0||!line(points[id],points[next]))continue;
      previous[next]=id;queue.push(next);
    }
  }
  if(previous[goal]<0)return [];
  const path=[end];let id=goal;while(id!==root){path.push(points[id]);id=previous[id];}path.push(points[root],start);path.reverse();
  const simplified=[start];let at=0;while(at<path.length-1){let next=path.length-1;while(next>at+1&&!line(path[at],path[next]))next--;simplified.push(path[next]);at=next;}
  return simplified;
}
