import * as THREE from 'three';

interface PlotBuild { bounds: THREE.Box3; kind: string }
interface Piece {
  x: number; z: number; y: number;
  fromX: number; fromZ: number; fromY: number;
  delay: number; scale: number; spin: number;
}
interface Dust { x: number; z: number; y: number; angle: number; radius: number; scale: number; phase: number; height: number }

const clamp = THREE.MathUtils.clamp;
const smooth = (value: number) => { const t = clamp(value, 0, 1); return t * t * (3 - 2 * t); };
const hash = (seed: number) => {
  let x = seed | 0; x ^= x >>> 16; x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15; x = Math.imul(x, 0x846ca68b); return ((x ^ (x >>> 16)) >>> 0) / 0xffffffff;
};

/** Temporary, batched fragments converge while a construction front climbs the new model. */
export class ConstructionEffects {
  readonly group = new THREE.Group();
  private readonly pieces: Piece[] = [];
  private readonly dust: Dust[] = [];
  private readonly fragments: THREE.InstancedMesh;
  private readonly clouds: THREE.InstancedMesh;
  private readonly dummy = new THREE.Object3D();

  constructor(scene: THREE.Scene, plots: readonly PlotBuild[], mobile: boolean) {
    const piecesPerPlot = mobile ? 8 : 14;
    const dustPerPlot = mobile ? 24 : 48;
    this.fragments = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .95, metalness: 0 }),
      plots.length * piecesPerPlot,
    );
    this.clouds = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 0),
      new THREE.MeshBasicMaterial({ color: 0xcbb99b, transparent: true, opacity: .58, depthWrite: false }),
      plots.length * dustPerPlot,
    );
    this.fragments.frustumCulled = this.clouds.frustumCulled = false;
    this.fragments.castShadow = !mobile;
    this.clouds.renderOrder = 2;
    this.group.add(this.fragments, this.clouds);
    scene.add(this.group);

    plots.forEach(({ bounds, kind }, plotIndex) => {
      const center = bounds.getCenter(new THREE.Vector3());
      const size = bounds.getSize(new THREE.Vector3());
      const height = Math.max(2, size.y);
      const palette = kind === 'project' ? [0xa99b81, 0x876a55, 0xc3ad87, 0x8094a0]
        : kind === 'home' ? [0xc5ad8a, 0x9c7356, 0xb17a67, 0x857d72]
          : [0xb7aa8e, 0x8e775f, 0xbba48a, 0x819594];
      for (let i = 0; i < piecesPerPlot; i++) {
        const seed = plotIndex * 131 + i * 17;
        const angle = i * Math.PI * 2 / piecesPerPlot + hash(seed + 1) * .42;
        const layer = .12 + hash(seed + 2) * .76;
        const radiusX = Math.max(1.1, size.x * (.32 + hash(seed + 3) * .15));
        const radiusZ = Math.max(1.1, size.z * (.32 + hash(seed + 4) * .15));
        const x = center.x + Math.cos(angle) * radiusX;
        const z = center.z + Math.sin(angle) * radiusZ;
        const y = bounds.min.y + height * layer;
        const outward = 2.6 + hash(seed + 5) * 3.5;
        this.pieces.push({
          x, y, z,
          fromX: x + Math.cos(angle) * outward,
          fromY: y + 1.5 + hash(seed + 6) * 3.5,
          fromZ: z + Math.sin(angle) * outward,
          delay: layer * .33 + hash(seed + 7) * .1,
          scale: .45 + hash(seed + 8) * .6,
          spin: (hash(seed + 9) - .5) * 5,
        });
        this.fragments.setColorAt(plotIndex * piecesPerPlot + i, new THREE.Color(palette[i % palette.length]));
      }
      for (let i = 0; i < dustPerPlot; i++) {
        const seed = plotIndex * 191 + i * 29;
        const angle = i * Math.PI * 2 / dustPerPlot + hash(seed + 1) * .45;
        this.dust.push({
          x: center.x, z: center.z, y: bounds.min.y,
          angle, radius: Math.max(size.x, size.z) * (.22 + hash(seed + 2) * .3),
          scale: .55 + hash(seed + 3) * .95,
          phase: hash(seed + 4), height,
        });
        this.clouds.setColorAt(plotIndex * dustPerPlot + i,
          new THREE.Color(i % 3 === 0 ? 0xe5d7b5 : i % 3 === 1 ? 0xc2ad90 : 0xa69e8d));
      }
    });
    this.update(0);
  }

  update(progress: number): void {
    const t = clamp(progress, 0, 1);
    this.pieces.forEach((piece, index) => {
      const local = smooth((t - piece.delay) / (1 - piece.delay));
      const fade = 1 - smooth((local - .72) / .28);
      this.dummy.position.set(
        THREE.MathUtils.lerp(piece.fromX, piece.x, local),
        THREE.MathUtils.lerp(piece.fromY, piece.y, local) + Math.sin(local * Math.PI) * .5,
        THREE.MathUtils.lerp(piece.fromZ, piece.z, local),
      );
      this.dummy.rotation.set(piece.spin * (1 - local), piece.spin * .6 * (1 - local), piece.spin * .35 * (1 - local));
      this.dummy.scale.set(piece.scale * fade, piece.scale * .42 * fade, piece.scale * .58 * fade);
      this.dummy.updateMatrix(); this.fragments.setMatrixAt(index, this.dummy.matrix);
    });
    this.dust.forEach((particle, index) => {
      const cycle = (t * 3.2 + particle.phase) % 1;
      const sweep = particle.angle + t * .45;
      const drift = particle.radius + cycle * (1.2 + particle.phase * 1.5);
      const pulse = Math.sin(Math.PI * cycle);
      const envelope = smooth(t / .06) * (1 - smooth((t - .86) / .14));
      const size = particle.scale * Math.max(.001, pulse * envelope);
      this.dummy.position.set(
        particle.x + Math.cos(sweep) * drift,
        particle.y + t * particle.height + (particle.phase - .5) * 1.4 + cycle * 1.7,
        particle.z + Math.sin(sweep) * drift,
      );
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.setScalar(size);
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
