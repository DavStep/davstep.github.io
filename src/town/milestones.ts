import { DISTRICT_IDEAS, DISTRICT_MILESTONES } from './idea-districts';
import type { Idea } from './game';
export const MAX_LEVEL=8;
export interface Milestone { name:string; description:string; x:number; z:number; frontierName?:string }
const steps=(rows:readonly (readonly [string,string,number,number])[]):Milestone[]=>rows.map(([name,description,x,z])=>({name,description,x,z}));
/** Every level has an authored world event and its own camera destination. */
export const MILESTONES:Record<Idea,Milestone[]>={
  settlers:steps([
    ['First homes','Builders mark out their first homes.',0,0],['Town streets','Homes rise around the new roads.',0,0],['Castle community','The castle neighborhood fills with homes and banners.',0,0],
    ['Western hamlet','A new hamlet settles the western fields.',-128,49],['Eastern village','A village grows beside the eastern trade route.',128,8],['Southern township','A new township spreads across the southern plain.',-46,141],['Foothill settlement','Settlers build a village on the western foothills.',-128,110],['Highland citadel','A fortified highland settlement rises above the valley.',100,145],
  ]),
  grove:steps([
    ['Saplings','Gardeners plant the first saplings.',-18,20],['Town gardens','Gardens spread and provide timber for the workshop.',-18,20],['Irrigated grove','River water brings the gardens into bloom.',-18,20],
    ['Western forest','A broad new forest takes root west of town.',-145,10],['Eastern woodland','Pine groves spread across the eastern plain.',143,-24],['Southern orchards','Fruit trees cover the southern countryside.',5,145],['Foothill reforestation','Tree planting turns the western foothills green.',-157,65],['Mountain forest','A new forest climbs the eastern mountain slopes.',157,110],
  ]),
  workshop:steps([
    ['First forge','A forge opens and Sandship descends into its dock.',-20,-12],['Bridge gears','Smiths supply the road builders with forged gears.',-20,-12],['Machine yard','The forge and Machine Yard begin working together.',-20,-12],
    ['Timber works','A sawmill and timber yard open in the western woods.',-133,30],['Stone quarry','Terraced quarry workings open on the western mountain.',-150,100],['Mountain mine','A timber mine entrance and ore tracks reach the eastern ridge.',160,-12],['Valley foundry','Furnaces, chimneys and ore stores form an industrial district.',146,8],['Highland machinery','A great lifting engine and workshops rise in the highlands.',-168,-22],
  ]),
  roads:steps([
    ['Surveyed paths','Surveyors lay out the first town paths.',0,20],['Connected crossings','Bridges and roads connect the town.',0,30],['Stone streets','Paving and tracks complete the town streets.',0,35],
    ['Western highway','The western highway reaches the new hamlet and timber works.',-124,22],['Eastern highway','The eastern highway connects farms and new villages.',120,15],['Southern highway','A long southern route connects the outlying townships.',5,125],['Eastern mountain pass','A winding road climbs to the mine and mountain fort.',155,-5],['Western mountain pass','A second mountain route reaches the quarry and highland villages.',-143,95],
  ]),
  walls:steps([
    ['Timber enclosure','A timber wall encloses the town; existing roads reserve its gates.',34,0],['Stone defenses','Stone walls secure the town gates.',34,0],['Outer defenses','An outer wall protects the growing town.',53,0],
    ['Western outpost','A fortified outpost guards the western highway.',-114,71],['Eastern fort','Stone towers defend the eastern countryside.',137,37],['Southern watchline','A line of watchtowers secures the southern plain.',75,125],['Mountain fortress','A fortress guards the eastern mountain pass.',173,18],['Ridge defenses','Beacon towers link the far mountain defenses.',-150,132],
  ]),
  market:steps([
    ['Market stalls','The first stalls open in the town square.',15,10],['Caravan supplies','Caravans bring tools and supplies across the road.',15,10],['Trading hall','The Trading Hall fills with goods and visitors.',15,10],
    ['Western market','A new market square opens beside the western hamlet.',-132,73],['Eastern bazaar','A covered bazaar serves the eastern village.',136,23],['Caravan fair','A large fairground and caravan yard fill the southern plain.',43,145],['Mountain exchange','Merchants open a trading post near the mountain mine.',156,-44],['Grand harvest fair','Pavilions and packed stalls celebrate the valley harvest.',-80,142],
  ]),
  windmill:steps([
    ['Mill foundations','A mill rises beside the dry fields.',37,-25],['Working mill','The sails turn beside the flowing channel.',37,-25],['Golden harvest','Golden wheat spreads beside the mill.',37,-25],
    ['Eastern wind farm','New windmills and fields expand the eastern harvest.',95,66],['Western wind farm','A second wind farm supplies the western countryside.',-135,-22],['Granary district','Tall grain stores and threshing yards fill the southern plain.',72,148],['Terraced agriculture','Stone farming terraces step up the western foothills.',-149,48],['Highland wind farm','Windmills crown the eastern mountain slopes.',178,66],
  ]),
  archive:steps([
    ['Town post','The post begins collecting the town’s stories.',-10,-20],['Shared plans','Plans travel between the guild and the post.',-10,-20],['Town archive','The Archive maps the whole town.',-10,-20],
    ['Village school','A school and reading garden open in the western hamlet.',-113,48],['Water survey office','Surveyors establish a canal planning office in the east.',103,47],['Valley academy','An academy courtyard brings learning to the southern plain.',-19,145],['Mountain survey camp','Surveyors map a route through the western mountain.',-172,2],['Highland library','A landmark library and its courts rise on the high slopes.',122,146],
  ]),
  river:steps([
    ['Water survey','Stakes mark the route for a new river channel.',29,-51],['Flowing channel','Workers dig the channel, then release water toward the mill.',29,-51],['Castle waterway','Workers extend the river around the castle.',-24,-55],
    ['Eastern river','A new river branch brings water into the eastern countryside.',113,-10],['Western river','Workers carve a second river through the western countryside.',-119,-10],['Southern waterway','A long canal carries river water across the southern plain.',40,117],['Valley reservoir','A broad reservoir fills at the foot of the eastern mountain.',122,62],['Mountain cascade','A new mountain watercourse descends in cascades toward the reservoir.',160,51],
  ]),
  observatory:steps([
    ['Star platform','A star platform rises above the town.',-15,15],['New lens','The wizard aligns the first telescope lens.',-15,15],['Town constellations','The town landmarks shine as constellations.',-15,15],
    ['Northern lookout','An observing tower rises beyond the northern river.',-62,-119],['Stone calendar','A monumental stone calendar marks the western sky.',-104,-110],['Eastern observatory','A large telescope watches the sky above the east ridge.',152,-66],['Western observatory','A second mountain observatory completes the valley survey.',-124,143],['Summit beacons','Great beacons light the surrounding mountain summits.',0,205],
  ]),
};
export const ADVANCED_PARTNERS:Record<Idea,Idea[]>={
  settlers:['roads','market'],grove:['river','settlers'],workshop:['roads','archive'],roads:['workshop','archive'],walls:['workshop','roads'],market:['settlers','roads'],windmill:['river','grove'],archive:['settlers','market'],river:['workshop','roads'],observatory:['archive','workshop'],
};
export function isFrontierSite(x:number,z:number):boolean{
  return Object.entries(MILESTONES).some(([key,stages])=>key!=='river'&&key!=='roads'&&stages.slice(3).some(p=>Math.hypot(x-p.x,z-p.z)<(key==='grove'?17:12)));
}

// Local growth stays tied to the original choice; far-world projects remain additional effects.
for(const idea of DISTRICT_IDEAS)MILESTONES[idea]=MILESTONES[idea].map((old,index)=>({
  ...old,frontierName:index>=3?old.name:undefined,name:DISTRICT_MILESTONES[idea][index][0],description:DISTRICT_MILESTONES[idea][index][1]+(index>=3?` ${old.description}`:''),
}));
