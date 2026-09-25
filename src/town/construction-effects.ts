import * as THREE from 'three';

interface PlotBuild { bounds: THREE.Box3; kind: string }
interface Chip { x: number; y: number; z: number; delay: number; size: number; angle: number }
interface Dust { x: number; y: number; z: number; delay: number; size: number; driftX: number; driftZ: number }

const clamp = THREE.MathUtils.clamp;
const smooth = (value: number) => { const t = clamp(value, 0, 1); return t * t * (3 - 2 * t); };
const hash = (seed: number) => {
  let x = seed | 0; x ^= x >>> 16; x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15; x = Math.imul(x, 0x846ca68b); return ((x ^ (x >>> 16)) >>> 0) / 0xffffffff;
};

/** Small pieces settle at the active build height; dust stays close to the masonry. */
export class ConstructionEffects {
  readonly group = new THREE.Group();
  private readonly chips: Chip[] = [];
  private readonly dust: Dust[] = [];
  private readonly fragments: THREE.InstancedMesh;
  private readonly clouds: THREE.InstancedMesh;
  private readonly dummy = new THREE.Object3D();

  constructor(scene: THREE.Scene, plots: readonly PlotBuild[], mobile: boolean, front?: { base: number; height: number }) {
    const chipsPerPlot = mobile ? 6 : 10;
    const dustPerPlot = mobile ? 8 : 16;
    this.fragments = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 }),
      plots.length * chipsPerPlot,
    );
    this.clouds = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 0),
      new THREE.MeshBasicMaterial({ color: 0xd2c3a9, transparent: true, opacity: .25, depthWrite: false }),
      plots.length * dustPerPlot,
    );
    this.fragments.frustumCulled = this.clouds.frustumCulled = false;
    this.clouds.renderOrder = 2;
    this.group.add(this.fragments, this.clouds);
    scene.add(this.group);

    plots.forEach(({ bounds, kind }, plotIndex) => {
      const center = bounds.getCenter(new THREE.Vector3());
      const size = bounds.getSize(new THREE.Vector3());
      const height = Math.max(1, size.y);
      const palette = kind === 'home' ? [0xbda888, 0x98775d, 0x897d6e]
        : kind === 'wall' ? [0xb4aa96, 0x8f8779, 0xa49b89]
          : [0xb7a78d, 0x938271, 0xa69b88];
      for (let i = 0; i < chipsPerPlot; i++) {
        const seed = plotIndex * 131 + i * 17;
        const angle = i * Math.PI * 2 / chipsPerPlot + (hash(seed + 1) - .5) * .3;
        const layer = .13 + hash(seed + 2) * .73;
        const y = bounds.min.y + height * layer;
        this.chips.push({
          x: center.x + Math.cos(angle) * size.x * .42,
          z: center.z + Math.sin(angle) * size.z * .42,
          y,
          delay: front ? clamp((y - front.base) / front.height, 0, .88) * .84 : layer * .84,
          size: .16 + hash(seed + 3) * .24, angle,
        });
        this.fragments.setColorAt(plotIndex * chipsPerPlot + i, new THREE.Color(palette[i % palette.length]));
      }
      for (let i = 0; i < dustPerPlot; i++) {
        const seed = plotIndex * 191 + i * 29;
        const angle = i * Math.PI * 2 / dustPerPlot + hash(seed + 1) * .3;
        const layer = .08 + hash(seed + 2) * .78;
        const y = bounds.min.y + height * layer;
        this.dust.push({
          x: center.x + Math.cos(angle) * size.x * .43,
          z: center.z + Math.sin(angle) * size.z * .43,
          y,
          delay: front ? clamp((y - front.base) / front.height, 0, .88) * .84 : layer * .84,
          size: .24 + hash(seed + 3) * .32,
          driftX: Math.cos(angle) * (.25 + hash(seed + 4) * .35),
          driftZ: Math.sin(angle) * (.25 + hash(seed + 5) * .35),
        });
        this.clouds.setColorAt(plotIndex * dustPerPlot + i,
          new THREE.Color(i % 2 ? 0xd2c4aa : 0xb9ae9d));
      }
    });
    this.update(0);
  }

  update(progress: number): void {
    const t = clamp(progress, 0, 1);
    this.chips.forEach((chip, index) => {
      const age = (t - chip.delay) / .16;
      const settle = smooth(age);
      const visibility = smooth(age * 4) * (1 - smooth((age - .46) / .54));
      this.dummy.position.set(
        chip.x + Math.cos(chip.angle) * .28 * (1 - settle),
        chip.y + .65 * (1 - settle),
        chip.z + Math.sin(chip.angle) * .28 * (1 - settle),
      );
      this.dummy.rotation.set(0, chip.angle, 0);
      this.dummy.scale.set(chip.size * visibility, chip.size * .5 * visibility, chip.size * .65 * visibility);
      this.dummy.updateMatrix(); this.fragments.setMatrixAt(index, this.dummy.matrix);
    });
    this.dust.forEach((particle, index) => {
      const age = (t - particle.delay) / .19;
      const visibility = smooth(age * 4) * (1 - smooth((age - .15) / .85));
      const drift = clamp(age, 0, 1);
      const size = particle.size * visibility;
      this.dummy.position.set(
        particle.x + particle.driftX * drift,
        particle.y + .12 + drift * .55,
        particle.z + particle.driftZ * drift,
      );
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.set(size, size * .5, size);
      this.dummy.updateMatrix(); this.clouds.setMatrixAt(index, this.dummy.matrix);
    });
    this.fragments.instanceMatrix.needsUpdate = true;
    this.clouds.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.group.removeFromParent();
    this.fragments.dispose(); this.clouds.dispose();
    this.fragments.geometry.dispose(); this.clouds.geometry.dispose();
    (this.fragments.material as THREE.Material).dispose();
    (this.clouds.material as THREE.Material).dispose();
  }
}
