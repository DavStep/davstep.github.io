import * as THREE from 'three';

/** Shared easing curves for construction, crews and payoffs. */
export const clamp01 = (t: number) => THREE.MathUtils.clamp(t, 0, 1);
export const easeOutBack = (t: number, s = 1.70158) => { const x = clamp01(t) - 1; return 1 + x * x * ((s + 1) * x + s); };
export const easeInQuad = (t: number) => { const x = clamp01(t); return x * x; };
export const easeOutCubic = (t: number) => { const x = 1 - clamp01(t); return 1 - x * x * x; };
export const smooth = (t: number) => { const x = clamp01(t); return x * x * (3 - 2 * x); };
/** Damped oscillation that starts at 1 and settles at 0. */
export const wobble = (t: number, frequency = 16, damping = 6.5) => t < 0 ? 0 : Math.exp(-damping * t) * Math.cos(frequency * t);

type Kind = 'dust' | 'debris' | 'spark';
interface Particle {
  kind: Kind; slot: number;
  x: number; y: number; z: number; vx: number; vy: number; vz: number;
  ground: number; age: number; life: number; size: number; spin: number; drag: number; gravity: number;
}
interface Flash { mesh: THREE.Mesh; age: number; life: number; kind: 'ring' | 'pillar'; radius: number; opacity: number }

const DUST_COLORS = [0xfbf6ec, 0xf1e8d6, 0xe6dac2];
const tmpColor = new THREE.Color();

/**
 * Pooled, allocation-free particle bursts. Every effect is short-lived and
 * self-cleaning, so waves can overlap without leaking GPU resources.
 */
export class Juice {
  readonly group = new THREE.Group();
  private readonly meshes: Record<Kind, THREE.InstancedMesh>;
  private readonly free: Record<Kind, number[]>;
  private readonly live: Particle[] = [];
  private readonly flashes: Flash[] = [];
  private readonly flashPool: Flash[] = [];
  private readonly dummy = new THREE.Object3D();
  private shakeAmount = 0;
  private readonly ringGeometry = new THREE.RingGeometry(.82, 1, 64);
  private readonly pillarGeometry = new THREE.CylinderGeometry(1, 1.25, 1, 24, 1, true).translate(0, .5, 0);

  constructor(scene: THREE.Scene, mobile = false) {
    this.group.name = 'Juice_effects';
    const make = (kind: Kind, geometry: THREE.BufferGeometry, material: THREE.Material, count: number) => {
      const mesh = new THREE.InstancedMesh(geometry, material, count);
      mesh.name = `Juice_${kind}`;
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.dummy.scale.setScalar(0); this.dummy.updateMatrix();
      for (let i = 0; i < count; i++) { mesh.setMatrixAt(i, this.dummy.matrix); mesh.setColorAt(i, tmpColor.set(0xffffff)); }
      this.group.add(mesh);
      return mesh;
    };
    const scale = mobile ? .5 : 1;
    this.meshes = {
      dust: make('dust', new THREE.IcosahedronGeometry(1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), Math.round(260 * scale)),
      debris: make('debris', new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .9 }), Math.round(160 * scale)),
      spark: make('spark', new THREE.OctahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), Math.round(220 * scale)),
    };
    this.meshes.dust.castShadow = false;
    this.meshes.debris.castShadow = true;
    this.free = {
      dust: Array.from({ length: this.meshes.dust.count }, (_, i) => i),
      debris: Array.from({ length: this.meshes.debris.count }, (_, i) => i),
      spark: Array.from({ length: this.meshes.spark.count }, (_, i) => i),
    };
    scene.add(this.group);
  }

  /** Current camera shake amplitude in world units; decays every frame. */
  get shake(): number { return this.shakeAmount; }
  addShake(amount: number): void { this.shakeAmount = Math.min(1.6, this.shakeAmount + amount); }

  private spawn(kind: Kind, color: number, init: Omit<Particle, 'kind' | 'slot' | 'age'>): void {
    const slot = this.free[kind].pop();
    if (slot === undefined) return;
    this.meshes[kind].setColorAt(slot, tmpColor.set(color));
    this.meshes[kind].instanceColor!.needsUpdate = true;
    this.live.push({ ...init, kind, slot, age: 0 });
  }

  /** A ring of billowing dust hugging the ground. */
  dustRing(x: number, y: number, z: number, radius: number, count = 18, strength = 1): void {
    for (let i = 0; i < count; i++) {
      const a = i / count * Math.PI * 2 + Math.random() * .4;
      const speed = (3.5 + Math.random() * 3.5) * strength;
      this.spawn('dust', DUST_COLORS[i % DUST_COLORS.length], {
        x: x + Math.cos(a) * radius * .55, y: y + .2 + Math.random() * .4, z: z + Math.sin(a) * radius * .55,
        vx: Math.cos(a) * speed, vy: .6 + Math.random() * 1.6, vz: Math.sin(a) * speed,
        ground: y, life: .75 + Math.random() * .45, size: (.55 + Math.random() * .6) * Math.max(.8, radius * .22) * strength,
        spin: (Math.random() - .5) * 4, drag: 3.2, gravity: -.6,
      });
    }
  }

  /** A soft upward puff, used when a character or an old building disappears. */
  puff(x: number, y: number, z: number, size = 1, count = 9): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * .6 * size;
      this.spawn('dust', DUST_COLORS[i % DUST_COLORS.length], {
        x: x + Math.cos(a) * r, y: y + Math.random() * size, z: z + Math.sin(a) * r,
        vx: Math.cos(a) * 1.4 * size, vy: 1.2 + Math.random() * 1.8, vz: Math.sin(a) * 1.4 * size,
        ground: y - 10, life: .45 + Math.random() * .35, size: (.35 + Math.random() * .35) * size,
        spin: (Math.random() - .5) * 5, drag: 3, gravity: .4,
      });
    }
  }

  /** Chunky building pieces thrown out ballistically; they bounce once and shrink. */
  debris(x: number, y: number, z: number, radius: number, palette: readonly number[], count = 14): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, speed = 3 + Math.random() * 5;
      this.spawn('debris', palette[i % palette.length], {
        x: x + Math.cos(a) * radius * .4, y: y + .5 + Math.random(), z: z + Math.sin(a) * radius * .4,
        vx: Math.cos(a) * speed, vy: 5 + Math.random() * 6, vz: Math.sin(a) * speed,
        ground: y, life: 1 + Math.random() * .5, size: .22 + Math.random() * .3,
        spin: (Math.random() - .5) * 14, drag: .4, gravity: -22,
      });
    }
  }

  /** Bright rising star-like sparks in the idea color. */
  sparkles(x: number, y: number, z: number, color: number, count = 16, spread = 3, lift = 1): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * spread;
      const c = i % 4 === 0 ? 0xffffff : color;
      this.spawn('spark', c, {
        x: x + Math.cos(a) * r, y: y + Math.random() * 1.5, z: z + Math.sin(a) * r,
        vx: Math.cos(a) * (1 + Math.random() * 2), vy: (4 + Math.random() * 6) * lift, vz: Math.sin(a) * (1 + Math.random() * 2),
        ground: y - 50, life: .8 + Math.random() * .7, size: .16 + Math.random() * .2,
        spin: (Math.random() - .5) * 12, drag: 1.6, gravity: -3,
      });
    }
  }

  /** Small hot sparks from a hammer strike. */
  strike(x: number, y: number, z: number, color = 0xffd27a): void {
    for (let i = 0; i < 5; i++) {
      const a = Math.random() * Math.PI * 2;
      this.spawn('spark', i % 2 ? 0xffffff : color, {
        x, y, z, vx: Math.cos(a) * (2 + Math.random() * 2.5), vy: 2.5 + Math.random() * 3, vz: Math.sin(a) * (2 + Math.random() * 2.5),
        ground: y - 1.5, life: .28 + Math.random() * .2, size: .07 + Math.random() * .07,
        spin: 10, drag: 2, gravity: -14,
      });
    }
  }

  private flash(kind: 'ring' | 'pillar', color: number, x: number, y: number, z: number, radius: number, life: number, opacity: number): void {
    let flash = this.flashPool.pop();
    if (!flash) {
      const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, blending: THREE.AdditiveBlending });
      const mesh = new THREE.Mesh(kind === 'ring' ? this.ringGeometry : this.pillarGeometry, material);
      mesh.frustumCulled = false; mesh.renderOrder = 4;
      flash = { mesh, age: 0, life, kind, radius, opacity };
    }
    if (flash.kind !== kind) { flash.mesh.geometry = kind === 'ring' ? this.ringGeometry : this.pillarGeometry; }
    Object.assign(flash, { age: 0, life, kind, radius, opacity });
    (flash.mesh.material as THREE.MeshBasicMaterial).color.set(color);
    flash.mesh.position.set(x, y, z);
    flash.mesh.rotation.set(kind === 'ring' ? -Math.PI / 2 : 0, 0, 0);
    this.group.add(flash.mesh);
    this.flashes.push(flash);
  }

  /** Ground shockwave that races outward. */
  shockwave(x: number, y: number, z: number, color: number, radius = 9, life = .7): void {
    this.flash('ring', color, x, y + .25, z, radius, life, .9);
  }

  /** Vertical beam of light marking a level-up. */
  pillar(x: number, y: number, z: number, color: number, radius = 2.6, life = 1.1): void {
    this.flash('pillar', color, x, y, z, radius * .7, life, .38);
  }

  update(dt: number): void {
    const step = Math.min(dt, .05);
    this.shakeAmount *= Math.exp(-step * 7);
    if (this.shakeAmount < .002) this.shakeAmount = 0;
    const touched: Record<Kind, boolean> = { dust: false, debris: false, spark: false };
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i];
      p.age += step;
      const mesh = this.meshes[p.kind];
      touched[p.kind] = true;
      if (p.age >= p.life) {
        this.dummy.scale.setScalar(0); this.dummy.updateMatrix(); mesh.setMatrixAt(p.slot, this.dummy.matrix);
        this.free[p.kind].push(p.slot); this.live.splice(i, 1); continue;
      }
      const damp = Math.exp(-p.drag * step);
      p.vx *= damp; p.vz *= damp; p.vy = p.vy * damp + p.gravity * step;
      p.x += p.vx * step; p.y += p.vy * step; p.z += p.vz * step;
      if (p.y < p.ground + p.size * .5) {
        p.y = p.ground + p.size * .5;
        if (p.kind === 'debris' && p.vy < -1.5) { p.vy *= -.35; p.vx *= .6; p.vz *= .6; p.spin *= .5; }
        else { p.vy = 0; p.vx *= .9; p.vz *= .9; }
      }
      const t = p.age / p.life;
      let s: number;
      if (p.kind === 'dust') s = p.size * (0.4 + easeOutCubic(t * 2.2) * .9) * (1 - smooth((t - .45) / .55));
      else if (p.kind === 'debris') s = p.size * (1 - smooth((t - .7) / .3));
      else s = p.size * (t < .15 ? t / .15 : 1 - smooth((t - .35) / .65));
      this.dummy.position.set(p.x, p.y, p.z);
      this.dummy.rotation.set(p.spin * p.age * .7, p.spin * p.age, 0);
      if (p.kind === 'dust') this.dummy.scale.set(s, s * .8, s);
      else if (p.kind === 'debris') this.dummy.scale.set(s * 1.4, s * .7, s);
      else this.dummy.scale.set(s * .6, s * 1.5, s * .6);
      this.dummy.updateMatrix();
      mesh.setMatrixAt(p.slot, this.dummy.matrix);
    }
    for (const kind of Object.keys(touched) as Kind[]) if (touched[kind]) this.meshes[kind].instanceMatrix.needsUpdate = true;
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.age += step;
      const t = f.age / f.life;
      const material = f.mesh.material as THREE.MeshBasicMaterial;
      if (t >= 1) { f.mesh.removeFromParent(); material.opacity = 0; this.flashes.splice(i, 1); this.flashPool.push(f); continue; }
      if (f.kind === 'ring') {
        const r = .6 + easeOutCubic(t) * f.radius;
        f.mesh.scale.set(r, r, r);
        material.opacity = f.opacity * (1 - smooth(t));
      } else {
        const grow = easeOutBack(t * 2.4, 2.2);
        f.mesh.scale.set(f.radius * (1 - t * .6), 26 * grow, f.radius * (1 - t * .6));
        material.opacity = f.opacity * (t < .12 ? t / .12 : 1 - smooth((t - .2) / .8));
      }
    }
  }

  /** Worldspace offset for the camera from the current shake amount. */
  shakeOffset(now: number, target: THREE.Vector3): THREE.Vector3 {
    const a = this.shakeAmount;
    return target.set(
      Math.sin(now * 47.3) * a + Math.sin(now * 91.1) * a * .4,
      Math.sin(now * 53.7 + 1.3) * a * .7,
      Math.cos(now * 43.9) * a + Math.cos(now * 83.5) * a * .4,
    );
  }

  clear(): void {
    for (const p of this.live) {
      this.dummy.scale.setScalar(0); this.dummy.updateMatrix();
      this.meshes[p.kind].setMatrixAt(p.slot, this.dummy.matrix); this.free[p.kind].push(p.slot);
    }
    this.live.length = 0;
    for (const mesh of Object.values(this.meshes)) mesh.instanceMatrix.needsUpdate = true;
    for (const f of this.flashes) { f.mesh.removeFromParent(); this.flashPool.push(f); }
    this.flashes.length = 0;
    this.shakeAmount = 0;
  }

  dispose(): void {
    this.clear();
    this.group.removeFromParent();
    for (const mesh of Object.values(this.meshes)) { mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); mesh.dispose(); }
    for (const f of this.flashPool) (f.mesh.material as THREE.Material).dispose();
    this.ringGeometry.dispose(); this.pillarGeometry.dispose();
  }
}
