import type { Levels } from './game';
export const OUTSKIRT_SITES={
  woodland:{x:-98,z:22,hx:12,hz:13},
  farms:{x:91,z:25,hx:16,hz:20},
  orchard:{x:-24,z:89,hx:12,hz:12},
  caravan:{x:23,z:88,hx:11,hz:11},
  fishery:{x:-94,z:-14,hx:8,hz:8},
} as const;
export type Outskirt=keyof typeof OUTSKIRT_SITES;
export const COUNTRY_ROUTES=[
  [{x:-67,z:0},{x:-112,z:0}], [{x:-110,z:0},{x:-110,z:22},{x:-102,z:22}],
  [{x:-96,z:0},{x:-96,z:-14}],
  [{x:67,z:0},{x:106,z:0},{x:106,z:29},{x:99,z:29}],
  [{x:0,z:67},{x:0,z:105}],
  [{x:0,z:103},{x:-24,z:103},{x:-24,z:96}],
  [{x:0,z:100},{x:23,z:100},{x:23,z:96}],
] as const;
export function isOutskirtSite(x:number,z:number):boolean{
  if(Object.values(OUTSKIRT_SITES).some(s=>Math.abs(x-s.x)<s.hx+2&&Math.abs(z-s.z)<s.hz+2))return true;
  if(Math.abs(x+82)<3&&z>-27&&z<-10)return true;
  return COUNTRY_ROUTES.some(route=>route.slice(1).some((b,i)=>{
    const a=route[i],dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz)));
    return Math.hypot(x-a.x-dx*t,z-a.z-dz*t)<5;
  }));
}
export function outskirtsForLevels(l:Levels):Record<Outskirt,number>{
  return {
    woodland:l.grove===0?0:l.grove<2||!l.workshop?1:l.grove>=3&&l.roads>=2?3:2,
    farms:l.settlers===0?0:l.river<2?1:l.market>=2&&l.roads>=2?3:2,
    orchard:l.grove===0?0:l.grove<2||l.river<2?1:l.grove>=3&&l.market>=2?3:2,
    caravan:l.roads===0?0:l.roads<2||!l.settlers?1:l.market>=2?3:2,
    fishery:l.river===0?0:l.river<2||!l.settlers?1:l.market>=2&&l.roads>=2?3:2,
  };
}
export function outskirtsArrival(before:Levels,after:Levels):string{
  const a=outskirtsForLevels(before),b=outskirtsForLevels(after);
  const messages:Record<Outskirt,string[]>={
    woodland:['Saplings take root in the western woodland.','A forester opens a timber yard beyond the walls.','The western timber yard begins sending out loaded carts.'],
    farms:['Settlers mark out farms in the eastern countryside.','Water brings the outer vegetable fields to life.','Golden fields and farmsteads spread beyond the east gate.'],
    orchard:['An orchard is planted south of the moat.','The outer orchard grows leafy and green.','Fruit and harvest baskets fill the southern orchard.'],
    caravan:['Signposts mark the country roads.','A roadside inn opens beyond the south gate.','Merchants stop at the inn and wagons travel the country roads.'],
    fishery:['Fishers mark a landing beside the western pond.','A fishing pier and shelter appear at the pond.','Boats, drying nets and fish crates fill the pond landing.'],
  };
  return (Object.keys(b) as Outskirt[]).filter(k=>b[k]>a[k]).map(k=>messages[k][b[k]-1]).slice(0,2).join(' ');
}
export function outskirtsOverviewDistance(levels:Levels):number{
  const active=Object.values(outskirtsForLevels(levels)).filter(t=>t>0).length;
  return 154+active*13+Math.max(0,...Object.values(levels).map(l=>l-3))*45;
}
