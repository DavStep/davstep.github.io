import { isRegularBuilding } from './building-development';
import type { Idea, Levels } from './game';
import type { Plot, PlotState } from './model';

/** A choice owns a persistent place. Its later buildings gather around that place. */
export const IDEA_DISTRICTS = {
  market: { x:-88,z:-54,hero:'project-outpost',name:'Idle Outpost market',route:[[-55,0],[-67,0],[-69,-43],[-88,-43]] },
  workshop: { x:87,z:-56,hero:'project-sandship',name:'Sandship works',route:[[55,0],[67,0],[64,-44],[87,-44]] },
  roads: { x:-88,z:66,hero:'project-dwarves',name:'Dwarven roadworks',route:[[-55,0],[-67,0],[-68,49],[-88,54]] },
  archive: { x:57,z:91,hero:'post',name:'Archive campus',route:[[0,55],[0,67],[48,68],[57,79]] },
  observatory: { x:-57,z:94,hero:'project-wizard',name:'Wizard observatory',route:[[0,55],[0,67],[-47,69],[-57,82]] },
} as const;
export type DistrictIdea=keyof typeof IDEA_DISTRICTS;
export const DISTRICT_IDEAS=Object.keys(IDEA_DISTRICTS) as DistrictIdea[];
const moved:Record<string,{idea:DistrictIdea;dx:number;dz:number}>={
  'project-outpost':{idea:'market',dx:0,dz:0},market:{idea:'market',dx:-11,dz:8},tavern:{idea:'market',dx:11,dz:8},
  'project-sandship':{idea:'workshop',dx:0,dz:0},forge:{idea:'workshop',dx:-11,dz:8},workshop:{idea:'workshop',dx:11,dz:8},
  'project-dwarves':{idea:'roads',dx:0,dz:0},guild:{idea:'roads',dx:11,dz:-8},
  post:{idea:'archive',dx:0,dz:0},'project-wizard':{idea:'observatory',dx:0,dz:0},
};
export function relocateGamePlot<T extends Plot>(plot:T):T{
  const site=moved[plot.id];if(!site)return plot;
  const center=IDEA_DISTRICTS[site.idea];return {...plot,x:center.x+site.dx,z:center.z+site.dz};
}
export function districtForPlot(id:string):DistrictIdea|undefined{
  return moved[id]?.idea??DISTRICT_IDEAS.find(key=>id.startsWith(`district-${key}-`));
}
const EXPANSIONS:Record<DistrictIdea,readonly [Plot['kind'],number,number,string][]>={
  market:[['market',-11,-8,'covered-stalls'],['tavern',-19,1,'merchant-warehouse'],['market',11,-8,'artisan-bazaar'],['post',19,1,'trade-office'],['guild',0,-13,'grand-trading-hall']],
  workshop:[['forge',-11,-8,'machine-shop'],['forge',-19,1,'smelting-house'],['guild',11,-8,'engineering-hall'],['post',17,1,'design-office'],['forge',0,-13,'master-foundry']],
  roads:[['forge',-11,7,'tool-yard'],['tavern',11,7,'traveler-lodge'],['guild',-11,-7,'mason-guild'],['post',17,0,'route-office'],['guild',0,13,'transport-hall']],
  archive:[['post',-11,7,'reading-room'],['guild',11,7,'school'],['post',-11,-7,'map-library'],['guild',11,-7,'academy'],['guild',0,14,'great-library']],
  observatory:[['post',-11,7,'lens-workshop'],['guild',11,7,'astronomy-school'],['post',-11,-7,'star-library'],['guild',11,-7,'research-hall'],['guild',0,14,'celestial-academy']],
};
export function districtExpansionPlots(levels:Levels):PlotState[]{
  return DISTRICT_IDEAS.flatMap(idea=>EXPANSIONS[idea].map(([kind,dx,dz,name],i)=>({
    id:`district-${idea}-${name}`,kind,x:IDEA_DISTRICTS[idea].x+dx,z:IDEA_DISTRICTS[idea].z+dz,
    start:0,step:1,variant:i%3,stage:levels[idea]<i+4?0:isRegularBuilding({id:`district-${idea}-${name}`,kind})?Math.min(8,3+(levels[idea]-i-4)*2):6,renovation:0,
  })));
}
export function districtConnections(levels:Levels,gateMask:number):DistrictIdea[]{
  if(levels.roads<2||levels.walls>0&&!gateMask)return [];
  return DISTRICT_IDEAS.filter(idea=>levels[idea]>=(idea==='roads'?2:3));
}
export function districtArrival(before:Levels,after:Levels,gateMask:number):string{
  const old=districtConnections(before,gateMask);
  const fresh=districtConnections(after,gateMask).filter(idea=>!old.includes(idea));
  return fresh.map(idea=>`A road now connects the ${IDEA_DISTRICTS[idea].name} to the castle gate.`).join(' ');
}
export function isDistrictSite(x:number,z:number):boolean{
  return DISTRICT_IDEAS.some(idea=>{
    const site=IDEA_DISTRICTS[idea];if(Math.abs(x-site.x)<24&&Math.abs(z-site.z)<20)return true;
    return site.route.slice(1).some((b,i)=>{
      const a=site.route[i],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));
      return Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t)<4;
    });
  });
}
export function districtFocus(idea:Idea){return IDEA_DISTRICTS[idea as DistrictIdea];}

export const DISTRICT_MILESTONES:Record<DistrictIdea,readonly [string,string][]>={
  market:[['Idle Outpost opens','A trading outpost and its first stalls open outside the castle.'],['Merchant outpost','Banners and a larger trading post welcome arriving merchants.'],['Castle trade route','Idle Outpost becomes a trading hall, with a road connecting it to the castle.'],['Covered market','Covered stalls expand the original marketplace.'],['Merchant warehouses','A warehouse joins the outpost to store the growing trade.'],['Artisan bazaar','A second row of specialist stalls enlarges the same market.'],['Trade office','A permanent trade office serves the busy outpost.'],['Grand marketplace','A grand trading hall and entrance complete the Idle Outpost district.']],
  workshop:[['Sandship lands','Sandship descends beside the first forge in an independent workshop yard.'],['Working yard','Better machinery and workshop supplies develop around Sandship.'],['Castle supply route','The machine yard grows and a supply road links it to the castle.'],['Machine shop','A machine shop expands the original Sandship yard.'],['Smelting house','A smelting house joins the workshop district.'],['Engineering hall','Engineers build a permanent hall beside Sandship.'],['Design office','A design office supports the growing machine yard.'],['Master foundry','A master foundry and formal entrance complete the workshop district.']],
  roads:[['Dwarven roadworks','A dwarven mining camp opens outside town while surveyors mark the castle roads.'],['Connected roadworks','Developed roads link the dwarven works to the castle gate.'],['Paved supply route','Stone paving strengthens the connection to the dwarven works.'],['Tool yard','A tool yard expands the original roadworks camp.'],['Traveler lodge','A lodge welcomes travelers beside the roadworks.'],['Masons’ guild','The masons build a permanent guild at their original camp.'],['Route office','A route office coordinates the growing road network.'],['Transport hall','A transport hall and formal entrance complete the dwarven district.']],
  archive:[['Archive opens','A small archive opens on its own site south of the castle.'],['Shared knowledge','Scribes share plans as messengers travel over the developed roads.'],['Castle correspondence','The archive expands and a road carries correspondence to the castle.'],['Reading room','A reading room joins the original archive.'],['Archive school','A school opens beside the archive.'],['Map library','A map library expands the same learning district.'],['Valley academy','An academy rises beside the original archive.'],['Great library','A great library and formal entrance complete the archive campus.']],
  observatory:[['Wizard observatory','A small wizard observatory is built outside the castle.'],['Improved telescope','A better lens improves the original observatory.'],['Castle observatory route','The observatory develops and a road connects it to the castle.'],['Lens workshop','A lens workshop joins the original observatory.'],['Astronomy school','An astronomy school opens beside the wizard tower.'],['Star library','A star library expands the observatory district.'],['Research hall','A research hall grows around the original tower.'],['Celestial academy','A celestial academy and formal entrance complete the observatory district.']],
};
