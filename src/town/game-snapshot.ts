import { PLOTS, INFRASTRUCTURE } from './town-plan';
import type { Plot, TownSnapshot } from './model';
import type { Idea, Levels } from './game';
import { CARDINAL_GATE_MASK } from './wall-layout';

const HOME_IDS = new Set(Array.from({ length: 8 }, (_, index) => `home-${index}`));
const CIVIC_IDS = new Set(['market', 'tavern', 'forge', 'workshop', 'mill', 'guild', 'post']);
const PROJECT_IDEA: Record<string, Idea> = {
  outpost: 'market', sandship: 'workshop', battle: 'settlers',
  wizard: 'observatory', dwarves: 'roads',
};

function tierFor(plot: Plot, levels: Levels): number | null {
  if (plot.kind === 'project') return levels[PROJECT_IDEA[plot.project!]];
  if (plot.id === 'castle') return levels.observatory === 3 ? 3 : Math.min(2, levels.settlers);
  if (HOME_IDS.has(plot.id)) return levels.settlers;
  if (!CIVIC_IDS.has(plot.id)) return null;
  if (plot.id === 'market' || plot.id === 'tavern') return levels.market;
  if (plot.id === 'forge' || plot.id === 'workshop') return levels.workshop;
  if (plot.id === 'mill') return levels.windmill;
  if (plot.id === 'guild') return levels.roads;
  return levels.archive;
}

export function snapshotForGame(levels: Levels, elapsed = 0, gateMask = levels.walls >= 2 ? CARDINAL_GATE_MASK : 0): TownSnapshot {
  const plots = PLOTS.map(plot => {
    const tier = tierFor(plot, levels);
    // An unchosen idea has no visible construction site. Each later level
    // reveals a distinct authored silhouette.
    const stage = tier === null ? 0 : [0, 2, 4, 6][tier];
    return { ...plot, stage, renovation: 0 };
  });
  const wallSegments = INFRASTRUCTURE.wall.segments;
  return {
    elapsed,
    plots,
    innerWood: levels.walls >= 1 ? wallSegments : 0,
    innerStone: levels.walls >= 2 ? wallSegments : 0,
    outerWood: levels.walls >= 3 ? wallSegments : 0,
    wallGates: levels.walls > 0 ? gateMask : 0,
    roads: levels.roads === 3 ? INFRASTRUCTURE.road.ringSegments : levels.roads === 2 ? 20 : levels.roads === 1 ? 8 : 0,
    outerRoad: 0,
    phase: Math.min(4, Math.floor(Object.values(levels).reduce((sum, level) => sum + level, 0) / 5)),
    season: 'summer',
    dayFraction: .19,
    weather: 'clear',
    residents: levels.settlers === 0 ? 0 : levels.settlers === 1 ? 7 : levels.settlers === 2 ? 13 : 22,
    buildings: plots.filter(plot => plot.stage >= 4).length,
  };
}
