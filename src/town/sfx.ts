/**
 * Tiny synthesized sound kit. No audio files: every cue is built from
 * oscillators and filtered noise, so it stays light and on-brand.
 */
const MUTE_KEY = 'davstep.sfx.muted';
// Major pentatonic from C5; level-ups climb this ladder.
const PENTATONIC = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760];

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private lastTok = 0;
  muted: boolean;

  constructor() {
    let stored = false;
    try { stored = localStorage.getItem(MUTE_KEY) === '1'; } catch {}
    this.muted = stored;
  }

  setMuted(value: boolean): void {
    this.muted = value;
    try { localStorage.setItem(MUTE_KEY, value ? '1' : '0'); } catch {}
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(value ? 0 : .42, this.ctx.currentTime, .02);
  }

  /** Must be called from a user gesture before the first sound. */
  unlock(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      try { this.ctx = new Ctor(); } catch { return; }
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : .42;
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4;
      this.master.connect(comp).connect(this.ctx.destination);
      const length = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private ready(): AudioContext | null {
    return this.ctx && this.master && !this.muted && this.ctx.state === 'running' ? this.ctx : null;
  }

  private tone(freq: number, start: number, duration: number, type: OscillatorType, volume: number, endFreq?: number, attack = .006): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain).connect(this.master!);
    osc.start(start); osc.stop(start + duration + .05);
  }

  private burst(start: number, duration: number, volume: number, filter: BiquadFilterType, freq: number, endFreq?: number, q = 1): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource(); src.buffer = this.noise;
    const biquad = ctx.createBiquadFilter(); biquad.type = filter; biquad.Q.value = q;
    biquad.frequency.setValueAtTime(freq, start);
    if (endFreq) biquad.frequency.exponentialRampToValueAtTime(endFreq, start + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + .01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    src.connect(biquad).connect(gain).connect(this.master!);
    src.start(start, Math.random() * .5); src.stop(start + duration + .05);
  }

  /** Card press: bubbly pop. */
  click(): void {
    const ctx = this.ready(); if (!ctx) return; const t = ctx.currentTime;
    this.tone(420, t, .12, 'sine', .5, 900);
    this.tone(880, t + .03, .08, 'triangle', .15, 1200);
  }

  /** A worker pops into or out of the world. */
  pop(pitch = 1): void {
    const ctx = this.ready(); if (!ctx) return; const t = ctx.currentTime;
    this.tone(300 * pitch, t, .1, 'sine', .28, 720 * pitch);
  }

  /** Hammer on wood. Rate-limited because crews strike together. */
  tok(): void {
    const ctx = this.ready(); if (!ctx) return; const t = ctx.currentTime;
    if (t - this.lastTok < .07) return; this.lastTok = t;
    const pitch = .85 + Math.random() * .3;
    this.tone(760 * pitch, t, .07, 'square', .06, 380 * pitch, .002);
    this.burst(t, .05, .18, 'bandpass', 1800 * pitch, undefined, 4);
  }

  /** Something travels between sites. */
  whoosh(duration = .6): void {
    const ctx = this.ready(); if (!ctx) return; const t = ctx.currentTime;
    this.burst(t, duration, .22, 'bandpass', 400, 2600, 1.4);
  }

  /** A building lands. Bigger buildings sound heavier. */
  thud(size = 1): void {
    const ctx = this.ready(); if (!ctx) return; const t = ctx.currentTime;
    const s = Math.min(1.6, Math.max(.6, size));
    this.tone(140 / s, t, .32 * s, 'sine', .7, 45 / s, .003);
    this.burst(t, .28 * s, .35, 'lowpass', 900, 160, .7);
    this.tone(1200, t + .02, .05, 'triangle', .05, 700);
  }

  /** Level-up: a sparkly arpeggio that climbs with the level. */
  levelUp(level: number, index = 0): void {
    const ctx = this.ready(); if (!ctx) return; const t = ctx.currentTime + index * .04;
    const base = Math.min(PENTATONIC.length - 3, Math.max(0, level - 1));
    for (let i = 0; i < 3; i++) {
      this.tone(PENTATONIC[base + i], t + i * .075, .42, 'triangle', .18);
      this.tone(PENTATONIC[base + i] * 2, t + i * .075, .25, 'sine', .05);
    }
  }

  /** Collaboration: a warm major chord with a shimmer on top. */
  collab(): void {
    const ctx = this.ready(); if (!ctx) return; const t = ctx.currentTime;
    for (const [i, f] of [392, 493.88, 587.33, 783.99].entries()) this.tone(f, t + i * .03, 1.1, 'triangle', .13, undefined, .03);
    for (let i = 0; i < 6; i++) this.tone(1568 + i * 180, t + .25 + i * .05, .18, 'sine', .05);
  }

  /** Missed collaboration: a small sad slide down. */
  miss(): void {
    const ctx = this.ready(); if (!ctx) return; const t = ctx.currentTime;
    this.tone(392, t, .22, 'triangle', .2, 370);
    this.tone(330, t + .22, .45, 'triangle', .2, 262);
  }

  /** Crew cheer: quick rising chirps. */
  cheer(): void {
    const ctx = this.ready(); if (!ctx) return; const t = ctx.currentTime;
    for (let i = 0; i < 3; i++) this.tone(700 + i * 160 + Math.random() * 60, t + i * .07, .09, 'sine', .08, 1100 + i * 200);
  }

  /** Big finish. */
  fanfare(): void {
    const ctx = this.ready(); if (!ctx) return; const t = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.51];
    notes.forEach((f, i) => this.tone(f, t + i * .12, i === notes.length - 1 ? 1.4 : .3, 'triangle', .2));
  }
}
