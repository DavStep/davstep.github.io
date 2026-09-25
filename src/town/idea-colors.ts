import type { Idea } from './game';

/** The card, its visiting worker, and the reaction cue share one color. */
export const IDEA_COLORS: Record<Idea, number> = {
  settlers: 0xe99a6f,
  walls: 0x7897c7,
  grove: 0x6fc578,
  workshop: 0xeb7866,
  roads: 0xe9c15b,
  market: 0xdd80aa,
  river: 0x55c6d6,
  windmill: 0xd9a857,
  archive: 0xae8cda,
  observatory: 0x8da9ee,
};
