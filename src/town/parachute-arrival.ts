import * as THREE from 'three';
import type { PlotState } from './model';

export const SANDSHIP_ARRIVAL_MS = 7200;
export const SANDSHIP_TOUCHDOWN = .82;

export function isSandshipArrival(before: PlotState, after: PlotState): boolean {
  return after.project === 'sandship' && before.stage === 0 && after.stage > 0;
}

/** Owns the temporary rig, but borrows the landmark and its shared materials. */
export class ParachuteArrival {
  readonly rig = new THREE.Group();
  private readonly payload: THREE.Object3D;
  private readonly rest: THREE.Vector3;
  private readonly rotation: THREE.Euler;
  private readonly geometries = new Set<THREE.BufferGeometry>();
  private readonly materials: THREE.MeshStandardMaterial[];
  private disposed = false;

  constructor(building: THREE.Group, mobile: boolean) {
    const payload = building.getObjectByName('sandship-payload');
    if (!payload) throw new Error('Sandship arrival requires its articulated hull');
    this.payload = payload;
    this.rest = payload.position.clone();
    this.rotation = payload.rotation.clone();
    this.rig.name = 'sandship-parachute';
    this.materials = [0xf5e5be, 0xbc6335, 0x5b4834].map(color => new THREE.MeshStandardMaterial({
      color, roughness: 1, side: THREE.DoubleSide, transparent: true, depthWrite: false,
    }));
    const add = (geometry: THREE.BufferGeometry, material: THREE.MeshStandardMaterial) => {
      this.geometries.add(geometry);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      this.rig.add(mesh);
      return mesh;
    };
    // Sewn alternating gores with an open underside, rather than a solid balloon.
    const rim = 11.5, radius = 7.2, panels = 12;
    for (let i = 0; i < panels; i++) {
      const canopy = add(new THREE.SphereGeometry(radius, mobile ? 2 : 4, mobile ? 3 : 5,
        i * Math.PI * 2 / panels, Math.PI * 2 / panels, 0, Math.PI / 2), this.materials[i % 2]);
      canopy.position.y = rim;
      canopy.scale.y = .48;
    }
    const rope = new THREE.CylinderGeometry(.035, .035, 1, mobile ? 3 : 5);
    for (let i = 0; i < 8; i++) {
      const angle = (i + .5) * Math.PI / 4;
      const from = new THREE.Vector3(Math.cos(angle) * 3.1, 3.6, Math.sin(angle) * 2.5);
      const to = new THREE.Vector3(Math.cos(angle) * radius, rim, Math.sin(angle) * radius);
      const direction = to.clone().sub(from);
      const line = add(rope, this.materials[2]);
      line.position.copy(from).add(to).multiplyScalar(.5);
      line.scale.y = direction.length();
      line.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    }
    payload.add(this.rig);
    this.update(0);
  }

  update(progress: number): void {
    if (this.disposed) return;
    const p = THREE.MathUtils.clamp(progress, 0, 1);
    const descent = Math.min(1, p / SANDSHIP_TOUCHDOWN);
    const remaining = 1 - descent;
    // Slow continuous fall, easing to zero velocity at touchdown.
    const height = 25 * Math.pow(remaining, 1.35);
    const sway = Math.sin(descent * Math.PI * 3) * remaining;
    this.payload.position.set(this.rest.x + 2.4 * sway, this.rest.y + height,
      this.rest.z + 1.1 * Math.sin(descent * Math.PI * 2) * remaining);
    this.payload.rotation.copy(this.rotation);
    this.payload.rotation.z += .055 * sway;
    this.payload.rotation.x += .025 * Math.sin(descent * Math.PI * 2) * remaining;
    const release = Math.max(0, (p - SANDSHIP_TOUCHDOWN) / (1 - SANDSHIP_TOUCHDOWN));
    this.rig.position.set(release * 3, release * 2, 0);
    this.rig.scale.y = 1 - release * .16;
    this.rig.rotation.z = -.12 * release;
    for (const material of this.materials) material.opacity = 1 - release;
    this.rig.visible = p < 1;
  }

  dispose(): void {
    if (this.disposed) return;
    this.update(1);
    this.disposed = true;
    this.rig.removeFromParent();
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
  }
}
