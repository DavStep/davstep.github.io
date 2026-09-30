import { EASE, play, reducedMotion } from './ui-motion';

/** Keeps camera-driven reveals reversible, including a return during an exit. */
export class ProjectLabelMotion {
  visible = false;
  private animations: Animation[] = [];
  private offsetX = 0;
  private offsetY = 0;
  private left = '';
  private top = '';

  constructor(readonly button: HTMLButtonElement) {
    button.hidden = true;
    button.inert = true;
  }

  setVisible(visible: boolean, delay = 0): boolean {
    if (visible === this.visible) return false;
    const wasHidden = this.button.hidden;
    const interrupted = this.animations.some(animation => animation.playState !== 'finished');
    const current = !wasHidden && interrupted ? getComputedStyle(this.button) : null;
    const opacity = current?.opacity ?? (visible ? '0' : '1');
    const translate = current?.translate ?? (visible ? '0 16px' : '0 0');
    const scale = current?.scale ?? (visible ? '.84' : '1');
    for (const animation of this.animations) animation.cancel();
    this.animations = [];
    this.visible = visible;
    this.button.inert = !visible;
    this.button.dataset.state = visible ? 'visible' : 'leaving';
    if (visible) this.button.hidden = false;
    // A reversal starts at its current appearance without another stagger.
    if (interrupted && !wasHidden) delay = 0;

    const movement = play(this.button, [
      { translate, scale },
      { translate: visible ? '0 0' : '0 8px', scale: visible ? '1' : '.94' },
    ], {
      duration: visible ? EASE.springSoft.duration : 180,
      easing: visible ? EASE.springSoft.easing : EASE.inQuart,
      delay: visible ? delay : 0,
      fill: 'both',
    });
    const fade = play(this.button, [{ opacity }, { opacity: visible ? 1 : 0 }], {
      duration: visible ? 240 : 180,
      easing: visible ? EASE.outQuart : EASE.inQuart,
      delay: visible ? delay : 0,
      fill: 'both',
    });
    if (movement) this.animations.push(movement);
    if (fade) this.animations.push(fade);
    const last = movement ?? fade;
    if (last) last.onfinish = () => {
      if (visible !== this.visible || !this.animations.includes(last)) return;
      if (!visible) this.button.hidden = true;
      for (const animation of this.animations) animation.cancel();
      this.animations = [];
    };
    else this.button.hidden = !visible;
    return visible;
  }

  /** Follow the building directly; ease only the layout's collision offsets. */
  position(x: number, y: number, offset: { x: number; y: number }, dt: number, fresh: boolean) {
    const blend = fresh || reducedMotion() ? 1 : 1 - Math.exp(-Math.min(dt, .1) * 14);
    this.offsetX += (offset.x - this.offsetX) * blend;
    this.offsetY += (offset.y - this.offsetY) * blend;
    const left = `${(x + this.offsetX).toFixed(1)}px`, top = `${(y + this.offsetY).toFixed(1)}px`;
    // Stable camera frames leave layout clean for the next label's size read.
    if (left !== this.left) this.button.style.left = this.left = left;
    if (top !== this.top) this.button.style.top = this.top = top;
  }
}
