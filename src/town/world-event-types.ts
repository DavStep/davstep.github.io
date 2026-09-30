import type { Idea, Levels } from './game';

export type WorldEventKind = 'expedition' | 'dragon-warning' | 'dragon-tamed' | 'dragon-raid'
  | 'volcano-warning' | 'mine-prepared' | 'eruption-safe' | 'eruption-damage'
  | 'pass-repaired' | 'core-recovered' | 'lens-delivery' | 'caravan-waiting'
  | 'orchard-restored' | 'artifact-installed' | 'beacon-lit';
export type ArtifactId = 'lens' | 'gold' | 'core';
export type ArtifactLocation = 'shrine' | 'island' | 'mountain' | 'town' | 'friendly-dragon' | 'departed-dragon' | 'installed';

/** Persistent facts, reconstructed by replay; never inferred from an animation. */
export interface WorldEventState {
  turn: number;
  capabilities: string[];
  artifacts: Record<ArtifactId, ArtifactLocation>;
  installed: ArtifactId[];
  expedition: 'unavailable' | 'returned';
  dragon: 'unaware' | 'approaching' | 'tamed' | 'departed';
  dragonDueTurn: number | null;
  volcano: 'quiet' | 'warning' | 'contained' | 'overflowed';
  minePrepared: boolean;
  mountainPass: 'open' | 'blocked' | 'bypass';
  caravan: 'unavailable' | 'waiting' | 'delivered';
  orchard: 'healthy' | 'burned' | 'restored';
  eruptionTurn: number | null;
  burnedTurn: number | null;
  beacon: boolean;
}

export interface WorldEvent {
  id: string;
  kind: WorldEventKind;
  turn: number;
  title: string;
  description: string;
  artifact?: ArtifactId;
  before: WorldEventState;
  after: WorldEventState;
}

export interface DevelopmentRule {
  id: string;
  idea: Idea;
  level: number;
  name: string;
  description: string;
  requires: readonly string[];
  provides: readonly string[];
}

/** Frame-independent input to visual snapshots and chronological playback. */
export interface WorldEventVisualState {
  world: WorldEventState;
  levels: Levels;
}

export function initialWorldEventState(): WorldEventState {
  return {
    turn: 0, capabilities: [], artifacts: { lens: 'shrine', gold: 'island', core: 'mountain' }, installed: [],
    expedition: 'unavailable', dragon: 'unaware', dragonDueTurn: null, volcano: 'quiet', minePrepared: false,
    mountainPass: 'open', caravan: 'unavailable', orchard: 'healthy', eruptionTurn: null, burnedTurn: null, beacon: false,
  };
}

export function copyWorldEventState(world: WorldEventState): WorldEventState {
  return { ...world, capabilities: [...world.capabilities], artifacts: { ...world.artifacts }, installed: [...world.installed] };
}
