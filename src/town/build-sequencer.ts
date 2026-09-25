import * as THREE from 'three';
import { easeInQuad, easeOutBack, smooth, wobble } from './juice';

export type BuildStyle = 'drop' | 'rise';
export interface BuildImpact { x: number; y: number; z: number; radius: number; height: number; kind: string; upgrade: boolean }
export interface BuildItem {
  kind: string;
  /** Previous stage, removed with an anticipation squash before the new one lands. */
  previous?: THREE.Group;
  next?: THREE.Group;
}
interface Track {
  kind: string; style: BuildStyle; start: number;
  previous?: THREE.Group; next?: THREE.Group;
  base: THREE.Vector3; radius: number; height: number;
  impacted: boolean; puffed: boolean; done: boolean;
}

const OLD_SQUASH = .2, OLD_VANISH = .12, DROP_FALL = .34, RISE_TIME = .5, SETTLE = .75;
const DROP_HEIGHT = 11;

/** Homes fall in like toys; civic buildings push up out of the ground. */
export function buildStyle(kind: string): BuildStyle { return kind === 'home' ? 'drop' : 'rise'; }

/**
 * Per-building construction timelines that replace the clipping-plane wipe.
 * Buildings are staggered from the centre of the change outwards, each with
 * anticipation, impact (reported to the caller) and a springy settle.
 */
export class BuildSequencer {
  private readonly tracks: Track[] = [];
  private elapsed = 0;
  readonly duration: number;

  constructor(items: readonly BuildItem[], private readonly onImpact: (impact: BuildImpact) => void, private readonly onPuff?: (x: number, y: number, z: number, size: number) => void) {
    const measured = items.map(item => {
      const box = new THREE.Box3();
      if (item.next) box.expandByObject(item.next);
      if (item.previous) box.expandByObject(item.previous);
      const size = box.isEmpty() ? new THREE.Vector3(4, 4, 4) : box.getSize(new THREE.Vector3());
      const anchor = (item.next ?? item.previous)!.position.clone();
      return { item, size, anchor };
    });
    const centre = measured.reduce((sum, m) => sum.add(m.anchor), new THREE.Vector3()).divideScalar(Math.max(1, measured.length));
    measured.sort((a, b) => a.anchor.distanceToSquared(centre) - b.anchor.distanceToSquared(centre));
    const gap = measured.length > 1 ? Math.min(.16, .9 / (measured.length - 1)) : 0;
    measured.forEach(({ item, size, anchor }, index) => {
      const track: Track = {
        kind: item.kind, style: buildStyle(item.kind), start: index * gap,
        previous: item.previous, next: item.next, base: anchor,
        radius: Math.max(size.x, size.z) * .5, height: size.y,
        impacted: false, puffed: false, done: false,
      };
      if (track.next) track.next.visible = false;
      this.tracks.push(track);
    });
    const last = this.tracks.reduce((max, t) => Math.max(max, t.start), 0);
    this.duration = last + (items.some(i => i.previous) ? OLD_SQUASH + OLD_VANISH : 0) + Math.max(DROP_FALL, RISE_TIME) + SETTLE;
    this.update(0);
  }

  get finished(): boolean { return this.tracks.every(track => track.done); }

  update(dt: number): void {
    this.elapsed += Math.min(dt, .08);
    for (const track of this.tracks) this.step(track, this.elapsed - track.start);
  }

  private step(track: Track, t: number): void {
    if (track.done || t < 0) return;
    const { base } = track;
    let local = t;
    // 1. Anticipation: the previous stage crouches, then pops away in dust.
    if (track.previous) {
      const g = track.previous;
      if (local < OLD_SQUASH) {
        const k = easeInQuad(local / OLD_SQUASH);
        g.scale.set(1 + .14 * k, 1 - .3 * k, 1 + .14 * k);
        return;
      }
      if (local < OLD_SQUASH + OLD_VANISH) {
        if (!track.puffed) { track.puffed = true; this.onPuff?.(base.x, base.y + .5, base.z, Math.max(1.2, track.radius * .45)); }
        const k = (local - OLD_SQUASH) / OLD_VANISH;
        g.scale.set(1.14 * (1 - k), .7 * (1 - k) + .001, 1.14 * (1 - k));
        return;
      }
      g.visible = false;
      local -= OLD_SQUASH + OLD_VANISH;
    }
    const g = track.next;
    if (!g) { track.done = true; return; }
    g.visible = true;
    if (track.style === 'drop') {
      if (local < DROP_FALL) {
        const k = easeInQuad(local / DROP_FALL);
        g.position.set(base.x, base.y + DROP_HEIGHT * (1 - k), base.z);
        g.scale.set(.82, 1.28, .82);
        return;
      }
      this.impact(track);
      const s = local - DROP_FALL;
      const w = wobble(s, 17, 6.5);
      g.position.copy(base);
      g.scale.set(1 + .26 * w, 1 - .38 * w, 1 + .26 * w);
      if (s > SETTLE) this.settle(track);
      return;
    }
    // Rise: pushed out of the ground with a shudder, overshoot and settle.
    if (local < RISE_TIME) {
      const k = local / RISE_TIME;
      const up = easeOutBack(k, 2.1);
      const jitter = (1 - smooth(k)) * .12;
      g.position.set(base.x + Math.sin(local * 70) * jitter, base.y - .6 * (1 - smooth(k)), base.z + Math.cos(local * 63) * jitter);
      g.scale.set(.55 + .45 * up, Math.max(.001, up), .55 + .45 * up);
      if (k > .55) this.impact(track);
      return;
    }
    this.impact(track);
    const s = local - RISE_TIME;
    const w = wobble(s, 14, 6);
    g.position.copy(base);
    g.scale.set(1 - .07 * w, 1 + .1 * w, 1 - .07 * w);
    if (s > SETTLE) this.settle(track);
  }

  private impact(track: Track): void {
    if (track.impacted) return;
    track.impacted = true;
    this.onImpact({ x: track.base.x, y: track.base.y + .1, z: track.base.z, radius: track.radius, height: track.height, kind: track.kind, upgrade: Boolean(track.previous) });
  }

  private settle(track: Track): void {
    if (track.next) { track.next.position.copy(track.base); track.next.scale.set(1, 1, 1); }
    track.done = true;
  }

  /** Jump to the end state (skip, reduced motion or a new wave). */
  finish(): void {
    for (const track of this.tracks) {
      if (track.previous) track.previous.visible = false;
      if (track.next) { track.next.visible = true; }
      this.settle(track);
    }
  }
}
