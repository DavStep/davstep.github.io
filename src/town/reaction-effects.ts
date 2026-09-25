import * as THREE from 'three';
import { IDEA_COLORS } from './idea-colors';
import { districtFocus } from './idea-districts';
import { MILESTONES } from './milestones';
import { terrainHeight } from './environment';
import type { Idea, TownEvent } from './game';

export function eventFocus(event: Pick<TownEvent, 'idea' | 'level'>): { x: number; z: number } {
  return event.idea==='river'&&event.level>=4 ? MILESTONES.river[event.level - 1]
    : districtFocus(event.idea) ?? MILESTONES[event.idea][Math.min(event.level,3)-1];
}

const smooth = (t: number) => { const x = THREE.MathUtils.clamp(t, 0, 1); return x * x * (3 - 2 * x); };

/** Restrained site cue and ground-following links for a completed collaboration. */
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
  private readonly dummy = new THREE.Object3D();

  constructor(scene: THREE.Scene) {
    this.group.name = 'causal-reaction';
    this.group.add(this.trails, this.payoff);
    scene.add(this.group);
  }

  begin(event: TownEvent,clickedIdea:Idea=event.idea): void {
    this.clear();
    this.event = event;
    this.elapsed = 0;
    this.revealed = false;
    const dest = eventFocus(event);
    const color = this.color = IDEA_COLORS[clickedIdea];
    for (const source of event.sources.slice(0, 3)) {
      const from = eventFocus(source);
      const points: THREE.Vector3[] = [];
      for (let i = 0; i <= 32; i++) {
        const t = i / 32;
        const x = THREE.MathUtils.lerp(from.x, dest.x, t);
        const z = THREE.MathUtils.lerp(from.z, dest.z, t);
        points.push(new THREE.Vector3(x, terrainHeight(x, z) + .75, z));
      }
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineDashedMaterial({ color, transparent: true, opacity: .24, dashSize: 1.3, gapSize: 1.1, depthWrite: false }),
      );
      line.computeLineDistances();
      this.trails.add(line);
    }
    this.group.visible = true;
  }

  reveal(): void {
    if (!this.event) return;
    this.revealed = true;
    this.elapsed = 0;
    this.trails.visible = false;
    const site = eventFocus(this.event);
    const color = this.color;
    this.payoff.position.set(site.x, terrainHeight(site.x, site.z) + .28, site.z);
    for (let i = 0; i < 2; i++) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(1, 1.045, 48),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.renderOrder = 3;
      this.payoff.add(ring);
      this.rings.push(ring);
    }
    this.motes = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(.12, 0),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .55, depthWrite: false }),
      8,
    );
    this.motes.frustumCulled = false;
    this.motes.renderOrder = 3;
    this.payoff.add(this.motes);
    this.update(0);
  }

  update(dt: number): void {
    if (!this.event) return;
    this.elapsed += Math.min(dt, .08);
    if (!this.revealed) {
      const opacity = .24 * smooth(this.elapsed / .4) * (1 - smooth((this.elapsed - 1.2) / .8));
      for (const line of this.trails.children) {
        if (line instanceof THREE.Line) (line.material as THREE.LineDashedMaterial).opacity = opacity;
      }
      return;
    }
    const time = this.elapsed;
    for (let i = 0; i < this.rings.length; i++) {
      const age = (time - i * .22) / 1.35;
      const scale = 2.4 + smooth(age) * 6.4;
      this.rings[i].scale.setScalar(scale);
      (this.rings[i].material as THREE.MeshBasicMaterial).opacity =
        .35 * smooth(age * 6) * (1 - smooth((age - .42) / .58));
    }
    if (this.motes) {
      const visibility = smooth(time * 5) * (1 - smooth((time - .45) / .95));
      (this.motes.material as THREE.MeshBasicMaterial).opacity = .5 * visibility;
      for (let i = 0; i < this.motes.count; i++) {
        const angle = i * Math.PI * 2 / this.motes.count;
        const radius = 1.7 + (i % 3) * .43;
        this.dummy.position.set(Math.cos(angle) * radius, .2 + Math.min(1, time) * (1 + i % 3 * .25), Math.sin(angle) * radius);
        this.dummy.rotation.set(0, 0, 0);
        this.dummy.scale.setScalar(.8 + i % 3 * .15);
        this.dummy.updateMatrix();
        this.motes.setMatrixAt(i, this.dummy.matrix);
      }
      this.motes.instanceMatrix.needsUpdate = true;
    }
    if (time >= 1.8) this.payoff.visible = false;
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
    this.group.visible = false;
    this.event = null;
  }

  dispose(): void { this.clear(); this.group.removeFromParent(); }
}
