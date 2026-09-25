/**
 * Interface motion: spring curves, choreography helpers, and small
 * celebratory effects. Everything here animates the individual `translate`,
 * `scale`, `rotate`, `opacity` and `filter` properties so it composes with
 * the existing stylesheet transforms instead of fighting them.
 */
const reducedQuery = matchMedia('(prefers-reduced-motion: reduce)');
export const reducedMotion = () => reducedQuery.matches;

const supportsLinear = typeof CSS !== 'undefined' && CSS.supports('animation-timing-function', 'linear(0, 1)');

/** Samples a damped spring into a CSS `linear()` easing. */
function spring(stiffness: number, damping: number, fallback: string): { easing: string; duration: number } {
  if (!supportsLinear) return { easing: fallback, duration: 600 };
  const dt = 1 / 240;
  let x = 0, v = 0, t = 0, settled = 0;
  const samples: number[] = [];
  while (t < 3) {
    const a = stiffness * (1 - x) - damping * v;
    v += a * dt; x += v * dt; t += dt;
    samples.push(x);
    settled = Math.abs(1 - x) < 0.001 && Math.abs(v) < 0.01 ? settled + 1 : 0;
    if (settled > 24) break;
  }
  const points = 48, step = Math.max(1, Math.floor(samples.length / points));
  const out: string[] = ['0'];
  for (let i = step; i < samples.length - 1; i += step) out.push(samples[i].toFixed(4));
  out.push('1');
  return { easing: `linear(${out.join(', ')})`, duration: Math.round(t * 1000) };
}

export const EASE = {
  outExpo: 'cubic-bezier(.16, 1, .3, 1)',
  outQuart: 'cubic-bezier(.25, 1, .5, 1)',
  inQuart: 'cubic-bezier(.5, 0, .75, 0)',
  inOut: 'cubic-bezier(.65, 0, .35, 1)',
  spring: spring(260, 20, 'cubic-bezier(.34, 1.56, .64, 1)'),
  springSoft: spring(170, 22, 'cubic-bezier(.22, 1.25, .36, 1)'),
  springSnappy: spring(420, 26, 'cubic-bezier(.3, 1.4, .5, 1)'),
};

/** Publishes the spring curves to CSS so stylesheet transitions share them. */
export function installMotionTokens() {
  const root = document.documentElement.style;
  root.setProperty('--ease-spring', EASE.spring.easing);
  root.setProperty('--ease-spring-soft', EASE.springSoft.easing);
  root.setProperty('--ease-spring-snappy', EASE.springSnappy.easing);
  document.documentElement.classList.add('motion-ready');
}

type Frames = Keyframe[] | PropertyIndexedKeyframes;
/** WAAPI wrapper that respects reduced motion by collapsing to a short fade. */
export function play(el: Element | null | undefined, frames: Frames, options: KeyframeAnimationOptions): Animation | null {
  if (!el || typeof (el as HTMLElement).animate !== 'function') return null;
  if (reducedMotion()) {
    if (!Array.isArray(frames) && !('opacity' in frames)) return null;
    if (Array.isArray(frames) && !frames.some(f => 'opacity' in f)) return null;
    const opacity = Array.isArray(frames) ? frames.map(f => f.opacity ?? 1) : (frames.opacity as number[]);
    return (el as HTMLElement).animate({ opacity: opacity as number[] }, { duration: 160, fill: options.fill, delay: 0 });
  }
  return (el as HTMLElement).animate(frames as Keyframe[], options);
}

/** Staggered entrance for a list of elements. */
export function stagger(elements: Iterable<Element>, frames: Frames, options: KeyframeAnimationOptions & { gap?: number }) {
  const { gap = 50, delay = 0, ...rest } = options;
  let i = 0;
  const animations: (Animation | null)[] = [];
  for (const el of elements) animations.push(play(el, frames, { fill: 'backwards', ...rest, delay: (delay as number) + i++ * gap }));
  return animations;
}

export const rise = (distance = 18, blur = 6): Keyframe[] => [
  { opacity: 0, translate: `0 ${distance}px`, filter: `blur(${blur}px)` },
  { opacity: 1, translate: '0 0', filter: 'blur(0px)' },
];

/** Restarts a CSS keyframe animation driven by a class. */
export function retrigger(el: Element, className: string) {
  el.classList.remove(className);
  void (el as HTMLElement).offsetWidth;
  el.classList.add(className);
}

/* ---------- Number tweening ---------- */
const numberPattern = /\d+/g;
const tweenState = new WeakMap<Element, { text: string; raf: number }>();
/**
 * Sets text, counting any changed numbers up or down when the surrounding
 * words stay the same ("3 / 28 collaborations" → "5 / 28 collaborations").
 */
export function tweenText(el: Element, next: string, duration = 700) {
  const state = tweenState.get(el);
  const previous = state?.text ?? el.textContent ?? '';
  if (state) cancelAnimationFrame(state.raf);
  const template = (text: string) => text.replace(numberPattern, '#');
  if (previous === next || reducedMotion() || template(previous) !== template(next)) {
    el.textContent = next;
    tweenState.set(el, { text: next, raf: 0 });
    return false;
  }
  const from = (previous.match(numberPattern) ?? []).map(Number);
  const to = (next.match(numberPattern) ?? []).map(Number);
  const start = performance.now();
  const entry = { text: next, raf: 0 };
  tweenState.set(el, entry);
  const frame = (now: number) => {
    const p = Math.min(1, (now - start) / duration);
    const k = 1 - Math.pow(1 - p, 4);
    let i = 0;
    el.textContent = next.replace(numberPattern, () => { const a = from[i], b = to[i]; i++; return String(Math.round(a + (b - a) * k)); });
    if (p < 1) entry.raf = requestAnimationFrame(frame);
  };
  entry.raf = requestAnimationFrame(frame);
  return true;
}

/* ---------- Pointer light + tilt ---------- */
/**
 * Tracks the pointer across matching elements inside `root`, exposing
 * --mx/--my (percent) and --rx/--ry (degrees) for light and tilt effects.
 */
export function pointerLight(root: HTMLElement, selector: string, tilt = 6) {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  let raf = 0, pending: { el: HTMLElement; x: number; y: number } | null = null;
  const apply = () => {
    raf = 0;
    if (!pending) return;
    const { el, x, y } = pending;
    const r = el.getBoundingClientRect();
    const px = Math.min(1, Math.max(0, (x - r.left) / r.width)), py = Math.min(1, Math.max(0, (y - r.top) / r.height));
    el.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`);
    el.style.setProperty('--my', `${(py * 100).toFixed(1)}%`);
    if (!reducedMotion()) {
      el.style.setProperty('--ry', `${((px - 0.5) * tilt * 2).toFixed(2)}deg`);
      el.style.setProperty('--rx', `${((0.5 - py) * tilt * 2).toFixed(2)}deg`);
    }
  };
  root.addEventListener('pointermove', event => {
    const el = (event.target as HTMLElement).closest<HTMLElement>(selector);
    if (!el || !root.contains(el)) return;
    pending = { el, x: event.clientX, y: event.clientY };
    if (!raf) raf = requestAnimationFrame(apply);
  });
  root.addEventListener('pointerout', event => {
    const el = (event.target as HTMLElement).closest<HTMLElement>(selector);
    if (!el || el.contains(event.relatedTarget as Node)) return;
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
  });
}

/** Buttons drift slightly toward the pointer. */
export function magnetic(root: ParentNode, selector: string, strength = 0.18, max = 7) {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  root.addEventListener('pointermove', (event: Event) => {
    if (reducedMotion()) return;
    const e = event as PointerEvent;
    const el = (e.target as HTMLElement).closest<HTMLElement>(selector);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const dx = Math.max(-max, Math.min(max, (e.clientX - (r.left + r.width / 2)) * strength));
    const dy = Math.max(-max, Math.min(max, (e.clientY - (r.top + r.height / 2)) * strength));
    el.style.translate = `${dx.toFixed(1)}px ${dy.toFixed(1)}px`;
  });
  root.addEventListener('pointerout', (event: Event) => {
    const e = event as PointerEvent;
    const el = (e.target as HTMLElement).closest<HTMLElement>(selector);
    if (el && !el.contains(e.relatedTarget as Node)) el.style.translate = '';
  });
}

/* ---------- Effects ---------- */
/** A colored ring and sparks radiating from an element. */
export function burst(el: HTMLElement, color: string, sparks = 10) {
  if (reducedMotion()) return;
  const layer = document.createElement('span');
  layer.className = 'fx-burst';
  layer.style.setProperty('--fx-color', color);
  const ring = document.createElement('i');
  ring.className = 'fx-ring';
  layer.append(ring);
  el.append(layer);
  const r = el.getBoundingClientRect();
  const radius = Math.max(r.width, r.height) * 0.75;
  ring.animate([{ scale: 0.6, opacity: 0.9, borderWidth: '6px' }, { scale: 1.55, opacity: 0, borderWidth: '1px' }], { duration: 720, easing: EASE.outExpo, fill: 'forwards' });
  for (let i = 0; i < sparks; i++) {
    const s = document.createElement('i');
    s.className = 'fx-spark';
    layer.append(s);
    const angle = (i / sparks) * Math.PI * 2 + Math.random() * 0.4;
    const d = radius * (0.75 + Math.random() * 0.5);
    s.animate([
      { translate: '0 0', scale: 1, opacity: 1 },
      { translate: `${Math.cos(angle) * d}px ${Math.sin(angle) * d}px`, scale: 0.2, opacity: 0 },
    ], { duration: 620 + Math.random() * 260, easing: EASE.outExpo, fill: 'forwards' });
  }
  window.setTimeout(() => layer.remove(), 1000);
}

/** Floating "+N" that rises out of an element. */
export function floatLabel(el: HTMLElement, text: string, color: string) {
  if (reducedMotion()) return;
  const label = document.createElement('span');
  label.className = 'fx-float';
  label.textContent = text;
  label.style.setProperty('--fx-color', color);
  el.append(label);
  label.animate([
    { opacity: 0, translate: '-50% 6px', scale: 0.6 },
    { opacity: 1, translate: '-50% -14px', scale: 1.1, offset: 0.25 },
    { opacity: 1, translate: '-50% -24px', scale: 1, offset: 0.7 },
    { opacity: 0, translate: '-50% -34px', scale: 0.95 },
  ], { duration: 1100, easing: EASE.outQuart, fill: 'forwards' }).finished.then(() => label.remove(), () => label.remove());
}

/** Confetti cannon from a point, in the given palette. */
export function confetti(originX: number, originY: number, colors: string[], count = 90) {
  if (reducedMotion()) return;
  const layer = document.createElement('div');
  layer.className = 'fx-confetti';
  layer.setAttribute('aria-hidden', 'true');
  document.body.append(layer);
  let longest = 0;
  for (let i = 0; i < count; i++) {
    const piece = document.createElement('i');
    const w = 5 + Math.random() * 6, h = w * (0.4 + Math.random() * 0.9);
    piece.style.cssText = `left:${originX}px;top:${originY}px;width:${w}px;height:${h}px;background:${colors[i % colors.length]};border-radius:${Math.random() < 0.3 ? '50%' : '2px'}`;
    layer.append(piece);
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.95;
    const speed = 380 + Math.random() * 520;
    const vx = Math.cos(angle) * speed, vy = Math.sin(angle) * speed;
    const duration = 1800 + Math.random() * 1300;
    longest = Math.max(longest, duration);
    const frames: Keyframe[] = [];
    const steps = 14, spin = (Math.random() - 0.5) * 1440, g = 1100, drift = (Math.random() - 0.5) * 120;
    for (let s = 0; s <= steps; s++) {
      const t = (s / steps) * (duration / 1000);
      const drag = 1 - Math.exp(-t * 1.6);
      const x = (vx / 1.6) * drag + drift * t;
      const y = (vy / 1.6) * drag + 0.5 * g * t * t * 0.55;
      frames.push({ translate: `${x.toFixed(1)}px ${y.toFixed(1)}px`, rotate: `${(spin * s / steps).toFixed(0)}deg`, opacity: s > steps * 0.75 ? 1 - (s - steps * 0.75) / (steps * 0.25) : 1 });
    }
    piece.animate(frames, { duration, easing: 'linear', fill: 'forwards', delay: Math.random() * 120 });
  }
  window.setTimeout(() => layer.remove(), longest + 300);
}
