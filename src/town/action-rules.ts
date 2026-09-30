import type { Idea } from './game';
import type { DevelopmentRule } from './world-event-types';

export interface Requirement { idea: Idea; level: number; purpose: string }

/** Stages describe completed functions, never evenly divided partnership rewards. */
export const DEVELOPMENT_RULES: readonly DevelopmentRule[] = [
  { id:'timber-homes', idea:'settlers', level:3, name:'Timber homes', description:'Harvested timber replaces the settlers’ temporary shelters.', requires:['timber'], provides:['homes'] },
  { id:'supplied-neighborhood', idea:'settlers', level:5, name:'Supplied neighborhood', description:'Tools and a reliable food supply support larger homes.', requires:['homes','tools','food'], provides:['neighborhood'] },
  { id:'stone-town', idea:'settlers', level:8, name:'Stone town', description:'The quarry delivers stone along wagon roads to build a lasting town.', requires:['neighborhood','stone','wagons'], provides:['town'] },
  { id:'managed-grove', idea:'grove', level:3, name:'Managed woodland', description:'The settlers tend the grove and harvest timber.', requires:['workers'], provides:['timber'] },
  { id:'irrigated-orchard', idea:'grove', level:5, name:'Irrigated orchard', description:'Freshwater channels irrigate the fruit trees.', requires:['timber','irrigation'], provides:['orchard-planted'] },
  { id:'woodland-sanctuary', idea:'grove', level:8, name:'Woodland sanctuary', description:'Surveyed paths and flowing water support a restored, thriving woodland.', requires:['orchard-food','surveys','tools'], provides:['sanctuary'] },
  { id:'working-forge', idea:'workshop', level:3, name:'Working forge', description:'Workers turn grove timber into handles, charcoal and useful tools.', requires:['workers','timber'], provides:['tools'] },
  { id:'precision-yard', idea:'workshop', level:5, name:'Precision machine yard', description:'Mine ore and cooling water let the smiths make reliable machinery.', requires:['tools','ore','irrigation'], provides:['machinery'] },
  { id:'industrial-foundry', idea:'workshop', level:8, name:'Industrial foundry', description:'Machinery, wagon deliveries and measured plans expand the foundry.', requires:['machinery','wagons','surveys'], provides:['heavy-tools'] },
  { id:'wagon-crossings', idea:'roads', level:3, name:'Wagon crossings', description:'Timber and forged fittings complete bridges strong enough for wagons.', requires:['workers','timber','tools'], provides:['wagons','ore','stone','mine'] },
  { id:'surveyed-mine', idea:'roads', level:5, name:'Surveyed mountain works', description:'Dwarves follow survey plans to reinforce the mine and excavate lava channels.', requires:['mine','surveys','tools'], provides:['diversion-works'] },
  { id:'mountain-network', idea:'roads', level:8, name:'Mountain freight network', description:'Heavy machinery paves the open mountain route for regular freight.', requires:['diversion-works','heavy-tools','pass-open'], provides:['freight'] },
  { id:'road-gates', idea:'walls', level:3, name:'Wagon gates', description:'Road builders fit wide gates where the wagon routes cross the enclosure.', requires:['wagons','tools'], provides:['gates'] },
  { id:'stone-defenses', idea:'walls', level:5, name:'Stone defenses', description:'Dwarf stone and surveyed foundations strengthen the walls.', requires:['gates','stone','surveys'], provides:['defenses'] },
  { id:'beacon-watch', idea:'walls', level:8, name:'Beacon watch', description:'The Wizard’s signals link the watchtowers above the supplied town.', requires:['defenses','signals','food'], provides:['watch'] },
  { id:'caravan-market', idea:'market', level:3, name:'Caravan market', description:'Wagon access brings merchants, imported food and optical glass.', requires:['workers','wagons','pass-open'], provides:['trade','imported-food','glass'] },
  { id:'harvest-exchange', idea:'market', level:5, name:'Harvest exchange', description:'Fresh flour and recorded weights turn local stalls into a trade exchange.', requires:['trade','flour','records'], provides:['exchange'] },
  { id:'night-fair', idea:'market', level:8, name:'Night fair', description:'Wizard signals guide freight caravans to the thriving harvest fair.', requires:['exchange','signals','freight'], provides:['fair'] },
  { id:'working-mill', idea:'windmill', level:3, name:'Working mill', description:'Timber frames and forged gears transfer the sails’ motion to the millstones.', requires:['timber','tools','workers'], provides:['milling'] },
  { id:'irrigated-harvest', idea:'windmill', level:5, name:'Irrigated harvest', description:'River channels grow grain, and the turning mill produces flour.', requires:['milling','irrigation'], provides:['flour'] },
  { id:'seasonal-granaries', idea:'windmill', level:8, name:'Seasonal granaries', description:'A seasonal calendar and wagon deliveries fill the expanded granaries.', requires:['flour','calendar','wagons'], provides:['grain-reserve'] },
  { id:'survey-office', idea:'archive', level:3, name:'Survey office', description:'Residents record the land and use workshop instruments to survey safe works.', requires:['workers','tools'], provides:['surveys','records'] },
  { id:'water-atlas', idea:'archive', level:5, name:'Water atlas', description:'Surveyors chart the working rivers and mountain routes.', requires:['surveys','irrigation','wagons'], provides:['atlas'] },
  { id:'living-chronicle', idea:'archive', level:8, name:'Living chronicle', description:'Star observations and expedition findings complete the town’s great atlas.', requires:['atlas','calendar','expedition-records'], provides:['chronicle'] },
  { id:'working-harbor', idea:'river', level:3, name:'Working harbor', description:'Workers, timber and tools build channels and a seaworthy expedition ship.', requires:['workers','timber','tools'], provides:['irrigation','ship','fish'] },
  { id:'sluice-network', idea:'river', level:5, name:'Sluice network', description:'Machinery and surveyed gradients distribute water through the countryside.', requires:['irrigation','machinery','surveys'], provides:['sluices'] },
  { id:'reservoir-system', idea:'river', level:8, name:'Reservoir system', description:'Stone, sluice machinery and a water atlas complete the reservoir network.', requires:['sluices','stone','atlas'], provides:['reservoir'] },
  { id:'working-telescope', idea:'observatory', level:3, name:'Working telescope', description:'A forged mount and imported glass turn the Wizard’s platform into a telescope.', requires:['tools','glass'], provides:['signals'] },
  { id:'season-calendar', idea:'observatory', level:5, name:'Season calendar', description:'Recorded observations reveal the seasons and guide the farmers.', requires:['signals','records'], provides:['calendar'] },
  { id:'lens-socket', idea:'observatory', level:6, name:'Sky Lens installed', description:'The recovered Sky Lens focuses the tower’s great beam.', requires:['calendar','lens-installed'], provides:['focused-beam'] },
  { id:'core-socket', idea:'observatory', level:7, name:'Ember Core installed', description:'The Ember Core powers the tower mechanism.', requires:['focused-beam','core-installed'], provides:['powered-tower'] },
  { id:'summit-beacon', idea:'observatory', level:8, name:'Summit beacon', description:'Gold rune rings carry the core’s power into the Sky Lens.', requires:['powered-tower','gold-installed','beacon'], provides:['summit-beacon'] },
];

export const CAPABILITY_NAMES: Readonly<Record<string,string>> = {
  workers:'settlers', timber:'managed woodland timber', tools:'working forge tools', food:'fish, fruit, flour or imported food',
  homes:'timber homes', neighborhood:'supplied homes', stone:'dwarf stone', wagons:'wagon bridges', ore:'dwarf ore',
  irrigation:'working river channels', machinery:'precision machinery', surveys:'Archive surveys', mine:'working dwarf mine',
  'orchard-food':'healthy irrigated fruit trees', 'diversion-works':'surveyed dwarf channels', 'heavy-tools':'foundry machinery',
  'pass-open':'an open mountain pass', gates:'wagon gates', defenses:'stone defenses', signals:'Wizard signals', trade:'caravan trade',
  flour:'an irrigated working mill', records:'Archive records', exchange:'harvest exchange', freight:'mountain freight',
  milling:'working mill gears', calendar:'Wizard season calendar', atlas:'water atlas', 'expedition-records':'the island expedition',
  sluices:'surveyed sluices', 'lens-installed':'the Sky Lens', 'core-installed':'the Ember Core', 'gold-installed':'the retained dragon hoard',
  'focused-beam':'a focused Sky Lens', 'powered-tower':'the powered tower', beacon:'all three beacon artifacts',
};
