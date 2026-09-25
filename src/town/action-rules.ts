import type { Idea, Levels } from './game';
import { ADVANCED_PARTNERS } from './milestones';

export interface Requirement { idea: Idea; level: number; purpose: string }
const expansionSupply: Record<Idea, string> = { settlers: 'workers to staff the new district', grove: 'timber for the next construction phase', workshop: 'machinery for larger building sites', roads: 'routes for heavy supply deliveries', walls: 'protection for outlying settlements', market: 'stored goods for the new district', windmill: 'food for a larger workforce', archive: 'shared plans for the next construction phase', river: 'water for outlying settlements', observatory: 'surveys of the surrounding hills' };
const need = (idea: Idea, level: number, purpose: string): Requirement => ({ idea, level, purpose });
/** The simulation, previews and event explanations all read this same rulebook. */
export function requirements(idea: Idea, target: number): Requirement[] {
  if (target <= 1) return [];
  if (target >= 4) {
    const infrastructure: Record<number, Requirement[]> = {
      4: [need('river', 2, 'water for new districts'), need('market', 2, 'construction supplies')],
      5: [need('windmill', 3, 'a harvest to feed new workers'), need('walls', 2, 'protected supply routes')],
      6: [need('archive', 3, 'surveyed expansion plans')],
      7: [need('observatory', 2, 'precise surveys of the hills')],
      8: [need('observatory', 3, 'a complete map of the valley')],
    };
    return [...infrastructure[target], ...ADVANCED_PARTNERS[idea].map(partner => need(partner, target - 2, expansionSupply[partner]))];
  }
  const rules: Record<Idea, [Requirement[], Requirement[]]> = {
    settlers: [[need('roads', 2, 'streets connecting the homes')], [need('market', 2, 'food and household supplies'), need('walls', 2, 'protection for the neighborhood')]],
    grove: [[need('settlers', 1, 'gardeners to tend the saplings')], [need('river', 2, 'irrigation for the roots')]],
    workshop: [[need('grove', 2, 'timber for tools and machinery')], [need('roads', 2, 'a route for heavy equipment'), need('windmill', 2, 'grain to feed the machine-yard crew')]],
    roads: [[need('workshop', 2, 'forged tools for the crossings')], [need('market', 2, 'caravans to supply paving stone')]],
    walls: [[need('roads', 2, 'surveyed gate positions')], [need('market', 2, 'stone deliveries'), need('windmill', 2, 'food for the masons')]],
    market: [[need('roads', 2, 'a crossing for merchant caravans')], [need('archive', 2, 'trade records and delivery plans')]],
    windmill: [[need('market', 2, 'millwright supplies'), need('river', 2, 'irrigation for the grain fields')], [need('workshop', 2, 'harvesting tools'), need('grove', 2, 'timber for field fences')]],
    archive: [[need('roads', 2, 'a route for messengers'), need('settlers', 1, 'scribes to collect the plans')], [need('settlers', 2, 'a settled community to map'), need('market', 2, 'trade records from the outpost')]],
    river: [[need('settlers', 1, 'a crew to dig the channel'), need('workshop', 2, 'picks and sluice tools')], [need('roads', 2, 'access along the riverbank'), need('market', 2, 'stone for the castle waterway')]],
    observatory: [[need('archive', 2, 'survey notes for aligning the lens')], [need('settlers', 3, 'a settled town to chart'), need('grove', 3, 'mapped irrigated gardens'), need('workshop', 3, 'precision instruments'), need('roads', 3, 'survey routes'), need('walls', 3, 'protected observation posts'), need('market', 3, 'trade-route records'), need('windmill', 3, 'harvest calendars'), need('archive', 3, 'the town atlas'), need('river', 3, 'waterway charts')]],
  };
  return rules[idea][target - 2];
}
export function missingRequirements(idea: Idea, target: number, levels: Levels): Requirement[] {
  return requirements(idea, target).filter(req => levels[req.idea] < req.level);
}
