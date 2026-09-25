import * as THREE from 'three';
import { ACTIONS } from './action-story';
import { districtFocus } from './idea-districts';
import { MILESTONES } from './milestones';
import { terrainHeight } from './environment';
import type { TownEvent } from './game';

export function eventFocus(event: Pick<TownEvent, 'idea' | 'level'>): { x: number; z: number } {
  // Far-world expansions deserve their own camera shot, not the original site.
  return event.level >= 4 ? MILESTONES[event.idea][event.level - 1]
    : districtFocus(event.idea) ?? MILESTONES[event.idea][event.level - 1];
}
const PALETTE = { settle: 0xe9bb7b, fortify: 0xc4b79b, grow: 0x9dd783, forge: 0xffab63, connect: 0xffe2a2, trade: 0xeac06e, water: 0x75dfe8, harvest: 0xffd16e, knowledge: 0xc9b5f3, stars: 0xe8dcff };
/** A transient world-space explanation of supply -> site, then an action-specific payoff. */
export class ReactionEffects {
  readonly group = new THREE.Group();
  private elapsed = 0;
  private event: TownEvent | null = null;
  private revealed = false;
  private readonly trails = new THREE.Group();
  private readonly payoff = new THREE.Group();
  constructor(scene: THREE.Scene) { this.group.name = 'causal-reaction'; this.group.add(this.trails, this.payoff); scene.add(this.group); }
  begin(event: TownEvent): void {
    this.clear(); this.event = event; this.elapsed = 0; this.revealed = false;
    const dest = eventFocus(event), color = PALETTE[ACTIONS[event.idea].style];
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .85, depthWrite: false });
    const bead = new THREE.SphereGeometry(.42, 5, 4);
    for (const source of event.sources.slice(0, 3)) {
      const from = eventFocus(source), points: THREE.Vector3[] = [];
      for (let i = 0; i <= 36; i++) {
        const t = i / 36, x = THREE.MathUtils.lerp(from.x, dest.x, t), z = THREE.MathUtils.lerp(from.z, dest.z, t);
        points.push(new THREE.Vector3(x, terrainHeight(x, z) + 2 + Math.sin(t * Math.PI) * 9, z));
      }
      const curve = new THREE.CatmullRomCurve3(points);
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineDashedMaterial({ color, transparent: true, opacity: .45, dashSize: 2, gapSize: 2, depthWrite: false }));
      line.computeLineDistances(); this.trails.add(line);
      for (let i = 0; i < 5; i++) { const pulse = new THREE.Mesh(bead, material); pulse.userData.curve = curve; pulse.userData.offset = i / 5; this.trails.add(pulse); }
    }
    // No sources on arrival: dispose the unused shared resources here.
    if (!event.sources.length) { bead.dispose(); material.dispose(); }
    this.group.visible = true;
  }
  reveal(): void {
    if (!this.event) return;
    this.revealed = true; this.elapsed = 0; this.trails.visible = false;
    const event = this.event, style = ACTIONS[event.idea].style, site = eventFocus(event);
    const mat = new THREE.MeshBasicMaterial({ color: PALETTE[style], transparent: true, opacity: .95, side: THREE.DoubleSide, depthWrite: false });
    const geometry = style === 'knowledge' ? new THREE.PlaneGeometry(1.1, 1.5)
      : style === 'grow' || style === 'harvest' ? new THREE.SphereGeometry(.6, 4, 3)
      : style === 'trade' || style === 'settle' || style === 'fortify' ? new THREE.BoxGeometry(.9, .7, .9)
      : style === 'connect' ? new THREE.BoxGeometry(1.7, .18, 1.1)
      : new THREE.OctahedronGeometry(style === 'stars' ? .65 : .35);
    for (let i = 0; i < 24; i++) {
      const piece = new THREE.Mesh(geometry, mat); piece.userData.index = i;
      this.payoff.add(piece);
    }
    this.payoff.position.set(site.x, terrainHeight(site.x, site.z) + .5, site.z);
    if (style === 'stars') {
      const points = Array.from({ length: 9 }, (_, i) => new THREE.Vector3(Math.cos(i * 2.4) * (6 + i * .7), 12 + Math.sin(i * 1.8) * 4, Math.sin(i * 2.4) * 10));
      this.payoff.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: 0xe6d5ff, transparent: true, opacity: .8 })));
    }
  }
  update(dt: number): void {
    if (!this.event) return;
    this.elapsed += Math.min(dt, .08);
    if (!this.revealed) {
      for (const node of this.trails.children) if (node instanceof THREE.Mesh) node.position.copy((node.userData.curve as THREE.CatmullRomCurve3).getPoint((this.elapsed * .8 + node.userData.offset) % 1));
      return;
    }
    const t = Math.min(1, this.elapsed / 2.8), style = ACTIONS[this.event.idea].style;
    for (const node of this.payoff.children) {
      if (!(node instanceof THREE.Mesh)) continue;
      const i = node.userData.index as number, angle = i * Math.PI * 2 / 24;
      const radius = 2 + t * 12;
      if (style === 'water') node.position.set(Math.cos(angle) * radius, Math.sin(t * Math.PI) * (2 + i % 4), Math.sin(angle) * radius);
      else if (style === 'grow' || style === 'harvest') { node.position.set(Math.cos(angle) * (4 + i % 4), t * 5 + Math.sin(t * 6 + i), Math.sin(angle) * (4 + i % 4)); node.scale.set(.6, 1.8, .6); }
      else if (style === 'forge') node.position.set(Math.cos(angle) * t * 10, Math.max(0, t * 18 - t * t * 22), Math.sin(angle) * t * 10);
      else if (style === 'connect') node.position.set((i - 12) * 1.1, Math.sin(Math.max(0, t - i * .02) * Math.PI) * .8, Math.sin(i * .3) * 2);
      else if (style === 'fortify') { node.position.set(Math.cos(angle) * 9, Math.min(3, t * 8) + (i % 2) * .6, Math.sin(angle) * 9); node.scale.set(1.2, 2.5, 1.2); }
      else if (style === 'trade') node.position.set((i % 8 - 4) * 2 + t * 9, 1 + Math.sin(t * 12 + i) * .15, Math.floor(i / 8) * 2 - 3);
      else if (style === 'knowledge') { node.position.set(Math.cos(angle + t * 4) * (3 + t * 5), 2 + t * 10, Math.sin(angle + t * 4) * (3 + t * 5)); node.rotation.set(t * 2, angle + t * 5, .3); }
      else if (style === 'stars') node.position.set(Math.cos(angle) * 10, 12 + Math.sin(i * 1.8) * 4, Math.sin(angle) * 10);
      else node.position.set(Math.cos(angle) * (8 - t * 5), 1 + Math.sin(t * Math.PI) * 4, Math.sin(angle) * (8 - t * 5));
      (node.material as THREE.MeshBasicMaterial).opacity = (1 - THREE.MathUtils.smoothstep(t, .6, 1)) * .9;
    }
    if (t === 1) this.payoff.visible = false;
  }
  clear(): void {
    const geometry = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
    this.group.traverse(node => { if (node instanceof THREE.Mesh || node instanceof THREE.Line) { geometry.add(node.geometry); const m = node.material; (Array.isArray(m) ? m : [m]).forEach(item => materials.add(item)); } });
    geometry.forEach(item => item.dispose()); materials.forEach(item => item.dispose());
    this.trails.clear(); this.payoff.clear(); this.trails.visible = this.payoff.visible = true; this.group.visible = false; this.event = null;
  }
  dispose(): void { this.clear(); this.group.removeFromParent(); }
}
