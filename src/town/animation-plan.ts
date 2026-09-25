import { MAX_LEVEL, IDEAS, type Idea, type Levels } from './game';

export interface ChoiceBeat {
  idea: Idea;
  level: number;
  kind: 'arrival' | 'upgrade' | 'max';
}

/** Snapshot compatibility helper. The simulation's event trace has the exact project order. */
export function choiceBeats(before: Levels, after: Levels, chosen: Idea): ChoiceBeat[] {
  const levels = { ...before }, beats: ChoiceBeat[] = [];
  if (levels[chosen] === 0 && after[chosen] > 0) {
    levels[chosen] = 1;
    beats.push({ idea: chosen, level: 1, kind: 'arrival' });
  }
  while (IDEAS.some(idea => levels[idea] < after[idea])) {
    for (const idea of IDEAS) {
      if (levels[idea] >= after[idea]) continue;
      const level = ++levels[idea];
      beats.push({ idea, level, kind: level === MAX_LEVEL ? 'max' : 'upgrade' });
    }
  }
  return beats;
}
