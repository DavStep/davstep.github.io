import type { Plot } from './model';

export const REGULAR_BUILDING_STAGES = 8;
export function isRegularBuilding(plot: Pick<Plot, 'id' | 'kind'>): boolean {
  return plot.kind === 'home' || (['market', 'tavern', 'forge', 'guild', 'post'].includes(plot.kind)
    && plot.id !== 'post' && plot.id !== 'district-archive-great-library');
}

// Homes show the whole construction process. Shops open with their basic shell,
// then gain fittings, extensions, an upper wing and a final roof feature.
export function regularBuildingStage(plot: Pick<Plot, 'kind'>, level: number): number {
  if (level <= 0) return 0;
  return Math.min(REGULAR_BUILDING_STAGES, Math.floor(level) + (plot.kind === 'home' ? 0 : 2));
}
