import type { TownEvent } from './game';
import type { TownSnapshot } from './model';
import { districtForPlot } from './idea-districts';
import { eventFocus } from './reaction-effects';

/** Aim late district upgrades at the new building, rather than the district's original landmark. */
export function upgradeFocus(event: TownEvent, before: TownSnapshot, after: TownSnapshot): { x: number; z: number } {
  const fallback = eventFocus(event);
  if (event.level < 4) return fallback;
  const oldStages = new Map(before.plots.map(plot => [plot.id, plot.stage]));
  const fresh = after.plots.find(plot => districtForPlot(plot.id) === event.idea && plot.stage > 0 && (oldStages.get(plot.id) ?? 0) === 0);
  return fresh ? { x: fresh.x, z: fresh.z } : fallback;
}
