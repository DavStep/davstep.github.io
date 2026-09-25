import type { Idea } from './game';

export interface Requirement { idea: Idea; level: number; purpose: string }

export interface JointProject {
  id: string;
  name: string;
  ideas: readonly [Idea, Idea];
  result: string;
}

/** A project can be built once, when its second idea arrives. Its two sites grow together. */
export const JOINT_PROJECTS: readonly JointProject[] = [
  { id: 'garden-crew', name: 'Garden crew', ideas: ['settlers', 'grove'], result: 'The settlers tend the grove, and its gardens feed their homes.' },
  { id: 'forge-crew', name: 'Forge crew', ideas: ['settlers', 'workshop'], result: 'New workers staff the forge and build better homes.' },
  { id: 'street-plan', name: 'Street plan', ideas: ['settlers', 'roads'], result: 'Streets connect the homes and give the road builders a town to serve.' },
  { id: 'first-customers', name: 'First customers', ideas: ['settlers', 'market'], result: 'The market gains customers and the homes gain supplies.' },
  { id: 'town-records', name: 'Town records', ideas: ['settlers', 'archive'], result: 'The archive records the town and gives its people a shared plan.' },
  { id: 'channel-crew', name: 'Channel crew', ideas: ['settlers', 'river'], result: 'The settlers dig channels and the water reaches their gardens.' },
  { id: 'living-timber', name: 'Living timber', ideas: ['grove', 'workshop'], result: 'The grove supplies timber and the workshop makes tools to tend it.' },
  { id: 'field-frames', name: 'Field frames', ideas: ['grove', 'windmill'], result: 'Grove timber frames the mill and the harvest expands the grove.' },
  { id: 'grove-irrigation', name: 'Grove irrigation', ideas: ['grove', 'river'], result: 'Channels water the grove and roots steady the riverbank.' },
  { id: 'forged-crossings', name: 'Forged crossings', ideas: ['workshop', 'roads'], result: 'The forge makes bridge fittings and the roads deliver its materials.' },
  { id: 'gate-fittings', name: 'Gate fittings', ideas: ['workshop', 'walls'], result: 'The forge fits stronger gates and the walls protect its workers.' },
  { id: 'mill-gears', name: 'Mill gears', ideas: ['workshop', 'windmill'], result: 'Forged gears turn the mill and the harvest feeds the forge crew.' },
  { id: 'sluice-machinery', name: 'Sluice machinery', ideas: ['workshop', 'river'], result: 'The workshop makes sluices and the water powers its machinery.' },
  { id: 'precision-instruments', name: 'Precision instruments', ideas: ['workshop', 'observatory'], result: 'The forge builds instruments and the observatory improves its measurements.' },
  { id: 'road-gates', name: 'Mapped gates', ideas: ['roads', 'walls'], result: 'Road builders mark the crossings and masons open matching gates.' },
  { id: 'caravan-route', name: 'Caravan route', ideas: ['roads', 'market'], result: 'The crossing brings caravans and their trade funds better roads.' },
  { id: 'messenger-route', name: 'Messenger route', ideas: ['roads', 'archive'], result: 'The roads carry records and the archive maps better routes.' },
  { id: 'canal-access', name: 'Canal access', ideas: ['roads', 'river'], result: 'Paths reach the waterworks and the canal carries road supplies.' },
  { id: 'stone-delivery', name: 'Stone delivery', ideas: ['walls', 'market'], result: 'Merchants deliver stone and the walls protect their stalls.' },
  { id: 'protected-lookout', name: 'Protected lookout', ideas: ['walls', 'observatory'], result: 'The walls secure the tower and its view helps watch the gates.' },
  { id: 'harvest-trade', name: 'Harvest trade', ideas: ['market', 'windmill'], result: 'The mill feeds the market and merchants supply its builders.' },
  { id: 'trade-records', name: 'Trade records', ideas: ['market', 'archive'], result: 'The archive tracks trade and the market funds its records.' },
  { id: 'route-charts', name: 'Route charts', ideas: ['market', 'observatory'], result: 'The observatory charts trade routes and merchants support the tower.' },
  { id: 'mill-race', name: 'Mill race', ideas: ['windmill', 'river'], result: 'River water turns the mill and its grain feeds the channel crew.' },
  { id: 'harvest-calendar', name: 'Harvest calendar', ideas: ['windmill', 'observatory'], result: 'The tower predicts seasons and the mill supplies its observers.' },
  { id: 'canal-charts', name: 'Canal charts', ideas: ['archive', 'river'], result: 'The archive charts the canal and the water connects its districts.' },
  { id: 'star-plans', name: 'Star plans', ideas: ['archive', 'observatory'], result: 'The archive provides star plans and the tower writes new findings.' },
  { id: 'waterway-map', name: 'Waterway map', ideas: ['river', 'observatory'], result: 'The tower maps the waterway and the river opens the valley to study.' },
];

/** Each site has seven growth stages after arrival. Every project grants both partners a share. */
export function projectStages(project: JointProject, idea: Idea): number {
  const partners = JOINT_PROJECTS.filter(candidate => candidate.ideas.includes(idea));
  const index = partners.indexOf(project);
  if (index < 0) return 0;
  return Math.floor(7 / partners.length) + Number(index < 7 % partners.length);
}
