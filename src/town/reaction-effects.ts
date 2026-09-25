import * as THREE from 'three';
import { IDEA_COLORS } from './idea-colors';
import { districtFocus } from './idea-districts';
import { MILESTONES } from './milestones';
import { terrainHeight } from './environment';
import type { Idea, TownEvent } from './game';
import type { Juice } from './juice';

export function eventFocus(event: Pick<TownEvent, 'idea' | 'level'>): { x: number; z: number } {
  return event.idea==='river'&&event.level>=4 ? MILESTONES.river[event.level - 1]
    : districtFocus(event.idea) ?? MILESTONES[event.idea][Math.min(event.level,3)-1];
}

const smooth = (t: number) => { const x = THREE.MathUtils.clamp(t, 0, 1); return x * x * (3 - 2 * x); };
const ORB_TRAVEL = .85;
const ORBS_PER_SOURCE = 7;

/**
 * Collaboration cue: partner sites send glowing supply orbs along an arc to
 * the destination; on reveal a bold shockwave, light pillar and stars burst
 * from the site in the clicked idea's color.
 */
export class ReactionEffects {
  readonly group = new THREE.Group();
  private elapsed = 0;
  private event: TownEvent | null = null;
  private color=0xffffff;
  private revealed = false;
  private readonly trails = new THREE.Group();
  private readonly payoff = new THREE.Group();
  private rings: THREE.Mesh[] = [];
  private motes: THREE.InstancedMesh | null = null;
  private orbs: THREE.InstancedMesh | null = null;
  private curves: THREE.QuadraticBezierCurve3[] = [];
  private readonly dummy = new THREE.Object3D();
  private arrived = 0;
  /** Fired once per source when its orbs reach the destination. */
  onArrive: ((x: number, y: number, z: number) => void) | null = null;

  constructor(scene: THREE.Scene, private readonly juice: Juice | null = null) {
    this.group.name = 'causal-reaction';
    this.group.add(this.trails, this.payoff);
    scene.add(this.group);
  }

  /** Seconds until partner supplies arrive (0 when the event has no sources). */
  get travelTime(): number { return this.curves.length ? ORB_TRAVEL + .15 : 0; }

  begin(event: TownEvent,clickedIdea:Idea=event.idea): void {
    this.clear();
    this.event = event;
    this.elapsed = 0;
    this.revealed = false;
    this.arrived = 0;
    const dest = eventFocus(event);
    const color = this.color = IDEA_COLORS[clickedIdea];
    for (const source of event.sources.slice(0, 3)) {
      const from = eventFocus(source);
      const start = new THREE.Vector3(from.x, terrainHeight(from.x, from.z) + 2.5, from.z);
      const end = new THREE.Vector3(dest.x, terrainHeight(dest.x, dest.z) + 2.5, dest.z);
      const span = start.distanceTo(end);
      const mid = start.clone().lerp(end, .5); mid.y += Math.max(8, span * .35);
      const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
      this.curves.push(curve);
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(curve.getPoints(40)),
        new THREE.LineDashedMaterial({ color: IDEA_COLORS[source.idea as Idea] ?? color, transparent: true, opacity: 0, dashSize: 1.6, gapSize: .9, depthWrite: false, toneMapped: false }),
      );
      line.computeLineDistances();
      this.trails.add(line);
    }
    if (this.curves.length) {
      this.orbs = new THREE.InstancedMesh(
        new THREE.IcosahedronGeometry(1.15, 1),
        new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
        this.curves.length * ORBS_PER_SOURCE,
      );
      this.orbs.frustumCulled = false;
      this.orbs.renderOrder = 4;
      event.sources.slice(0, 3).forEach((source, s) => {
        const c = new THREE.Color(IDEA_COLORS[source.idea as Idea] ?? color);
        for (let i = 0; i < ORBS_PER_SOURCE; i++) this.orbs!.setColorAt(s * ORBS_PER_SOURCE + i, i === 0 ? new THREE.Color(0xffffff) : c);
      });
      this.trails.add(this.orbs);
      for (const curve of this.curves) this.juice?.sparkles(curve.v0.x, curve.v0.y - 2, curve.v0.z, color, 8, 1.5, .6);
    }
    this.group.visible = true;
    this.update(0);
  }

  reveal(): void {
    if (!this.event) return;
    this.revealed = true;
    this.elapsed = 0;
    this.trails.visible = false;
    const site = eventFocus(this.event);
    const color = this.color;
    const y = terrainHeight(site.x, site.z);
    this.payoff.position.set(site.x, y + .28, site.z);
    const collab = Boolean(this.event.project);
    for (let i = 0; i < (collab ? 3 : 2); i++) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(1, 1.16, 64),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.renderOrder = 3;
      this.payoff.add(ring);
      this.rings.push(ring);
    }
    this.motes = new THREE.InstancedMesh(
      new THREE.OctahedronGeometry(.28, 0),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .9, depthWrite: false, toneMapped: false }),
      collab ? 18 : 12,
    );
    this.motes.frustumCulled = false;
    this.motes.renderOrder = 3;
    this.payoff.add(this.motes);
    if (this.juice) {
      this.juice.pillar(site.x, y, site.z, color, collab ? 3.4 : 2.4, collab ? 1.3 : 1);
      this.juice.shockwave(site.x, y, site.z, color, collab ? 16 : 10);
      this.juice.sparkles(site.x, y + 1, site.z, color, collab ? 36 : 20, collab ? 4 : 3, collab ? 1.3 : 1);
    }
    this.update(0);
  }

  update(dt: number): void {
    if (!this.event) return;
    this.elapsed += Math.min(dt, .08);
    if (!this.revealed) {
      const opacity = .75 * smooth(this.elapsed / .25);
      for (const line of this.trails.children) {
        if (line instanceof THREE.Line) (line.material as THREE.LineDashedMaterial).opacity = opacity;
      }
      if (this.orbs) {
        let arrivedNow = 0;
        this.curves.forEach((curve, s) => {
          for (let i = 0; i < ORBS_PER_SOURCE; i++) {
            const t = (this.elapsed - i * .045) / ORB_TRAVEL;
            const k = smooth(t);
            const p = curve.getPoint(THREE.MathUtils.clamp(k, 0, 1));
            const visible = t > 0 && t < 1 ? 1 : 0;
            const size = visible * (i === 0 ? 1.3 : 1 - i * .11) * (1 + Math.sin(this.elapsed * 30 + i) * .12);
            this.dummy.position.copy(p);
            this.dummy.rotation.set(this.elapsed * 4, this.elapsed * 5, 0);
            this.dummy.scale.setScalar(Math.max(.0001, size));
            this.dummy.updateMatrix();
            this.orbs!.setMatrixAt(s * ORBS_PER_SOURCE + i, this.dummy.matrix);
          }
          if (this.elapsed >= ORB_TRAVEL) arrivedNow++;
        });
        this.orbs.instanceMatrix.needsUpdate = true;
        if (arrivedNow > this.arrived) {
          for (let s = this.arrived; s < arrivedNow; s++) {
            const end = this.curves[s].v2;
            this.juice?.sparkles(end.x, end.y - 1.5, end.z, this.color, 10, 1.2, .8);
            this.onArrive?.(end.x, end.y, end.z);
          }
          this.arrived = arrivedNow;
        }
      }
      return;
    }
    const time = this.elapsed;
    for (let i = 0; i < this.rings.length; i++) {
      const age = (time - i * .16) / 1.1;
      const scale = 1.5 + smooth(age) * (9 + i * 2.5);
      this.rings[i].scale.setScalar(scale);
      (this.rings[i].material as THREE.MeshBasicMaterial).opacity =
        .85 * smooth(age * 8) * (1 - smooth((age - .3) / .7));
    }
    if (this.motes) {
      const visibility = smooth(time * 6) * (1 - smooth((time - .9) / .9));
      (this.motes.material as THREE.MeshBasicMaterial).opacity = .95 * visibility;
      for (let i = 0; i < this.motes.count; i++) {
        const angle = i * Math.PI * 2 / this.motes.count + time * 2.2;
        const radius = 2.2 + (i % 3) * .7 + time * .8;
        this.dummy.position.set(Math.cos(angle) * radius, .4 + time * (3 + i % 3 * 1.1), Math.sin(angle) * radius);
        this.dummy.rotation.set(time * 3, time * 4 + i, 0);
        this.dummy.scale.setScalar(1 + (i % 3) * .25);
        this.dummy.updateMatrix();
        this.motes.setMatrixAt(i, this.dummy.matrix);
      }
      this.motes.instanceMatrix.needsUpdate = true;
    }
    if (time >= 2) this.payoff.visible = false;
  }

  clear(): void {
    const geometry = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
    this.group.traverse(node => {
      if (node instanceof THREE.Mesh || node instanceof THREE.Line) {
        geometry.add(node.geometry);
        const material = node.material;
        (Array.isArray(material) ? material : [material]).forEach(item => materials.add(item));
        if (node instanceof THREE.InstancedMesh) node.dispose();
      }
    });
    geometry.forEach(item => item.dispose());
    materials.forEach(item => item.dispose());
    this.trails.clear();
    this.payoff.clear();
    this.payoff.position.set(0, 0, 0);
    this.trails.visible = this.payoff.visible = true;
    this.rings = [];
    this.motes = null;
    this.orbs = null;
    this.curves = [];
    this.group.visible = false;
    this.event = null;
  }

  dispose(): void { this.clear(); this.group.removeFromParent(); }
}
