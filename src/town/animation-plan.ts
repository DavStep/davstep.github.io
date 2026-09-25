import { MAX_LEVEL, IDEAS, type Idea, type Levels } from './game';
import { missingRequirements } from './action-rules';

export interface ChoiceBeat {
  idea: Idea;
  level: number;
  kind: 'arrival' | 'upgrade' | 'max';
}

/** Compatibility helper for callers with level snapshots; preserve causal order. */
export function choiceBeats(before: Levels, after: Levels, chosen: Idea): ChoiceBeat[] {
  const levels = { ...before }, beats: ChoiceBeat[] = [];
  if (levels[chosen] === 0 && after[chosen] > 0) {
    levels[chosen] = 1;
    beats.push({ idea: chosen, level: 1, kind: 'arrival' });
  }
  for (;;) {
    const ready = IDEAS.filter(idea => levels[idea] > 0 && levels[idea] < after[idea]
      && missingRequirements(idea, levels[idea] + 1, levels).length === 0);
    if (!ready.length) break;
    for (const idea of ready) {
      const level = ++levels[idea];
      beats.push({ idea, level, kind: level === MAX_LEVEL ? 'max' : 'upgrade' });
    }
  }
  return beats;
}
