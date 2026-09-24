import * as THREE from 'three';
import type { Levels } from './game';
import { millStreamDistance, millStreamPoint } from './game-path';
import { riverSurfaceHeight, terrainHeight } from './environment';

const hash = (n: number) => {
  let x = n | 0; x ^= x >>> 16; x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15; x = Math.imul(x, 0x846ca68b); return (x ^ (x >>> 16)) >>> 0;
};
const random = (n: number) => hash(n) / 0xffffffff;
export const streamSurfaceHeight = (t: number): number => riverSurfaceHeight(30) * (1 - t) - .22 * t;

function ribbon(width: number, water: boolean): THREE.BufferGeometry {
  const positions: number[] = [];
  const steps = 72;
  const edge = (t: number, side: number): [number, number, number] => {
    const p = millStreamPoint(t), a = millStreamPoint(Math.max(0, t - .002)), b = millStreamPoint(Math.min(1, t + .002));
    const dx = b.x - a.x, dz = b.z - a.z, length = Math.hypot(dx, dz) || 1;
    const x = p.x + side * dz / length * width / 2, z = p.z - side * dx / length * width / 2;
    return [x, water ? streamSurfaceHeight(t) : terrainHeight(x, z) + .035, z];
  };
  for (let index = 0; index < steps; index++) {
    const t0 = index / steps, t1 = (index + 1) / steps;
    const a = edge(t0, -1), b = edge(t0, 1), c = edge(t1, -1), d = edge(t1, 1);
    for (const point of [a, b, c, b, d, c]) positions.push(...point);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

interface WheatPlant { x: number; y: number; z: number; scale: number; turn: number }

export class GameScenery {
  readonly group = new THREE.Group();
  private readonly water: THREE.Mesh;
  private readonly wheat: THREE.InstancedMesh;
  private readonly plants: WheatPlant[] = [];
  private readonly rotor = new THREE.Group();
  private readonly bridge = new THREE.Group();
  private readonly grove = new THREE.Group();
  private readonly birds = new THREE.Group();
  private readonly dummy = new THREE.Object3D();
  private waterFill = 0;
  private waterTarget = 0;
  private wheatGrowth = 0;
  private wheatTarget = 0;
  private secret = false;
  private reduced = matchMedia('(prefers-reduced-motion: reduce)');

  constructor(scene: THREE.Scene, mobile: boolean) {
    const bed = new THREE.Mesh(ribbon(6.5, false), new THREE.MeshStandardMaterial({ color: 0x756a53, roughness: 1, side: THREE.DoubleSide }));
    bed.receiveShadow = true;
    this.water = new THREE.Mesh(ribbon(4.2, true), new THREE.MeshStandardMaterial({
      color: 0x54a9a5, emissive: 0x07343a, roughness: .28, metalness: .08,
      transparent: true, opacity: .88, side: THREE.DoubleSide,
    }));
    this.water.geometry.setDrawRange(0, 0);
    this.group.add(bed, this.water);

    const plantGeometry = new THREE.Group();
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(.025, .045, .9, 4), new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: false, roughness: 1 }));
    stalk.position.y = .45;
    plantGeometry.add(stalk);
    const head = new THREE.Mesh(new THREE.ConeGeometry(.12, .48, 5), stalk.material);
    head.position.y = 1.07; plantGeometry.add(head);
    const combined = new THREE.BufferGeometry();
    const positions: number[] = [], normals: number[] = [];
    plantGeometry.updateMatrixWorld(true);
    plantGeometry.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const geometry = object.geometry.toNonIndexed().clone();
      geometry.applyMatrix4(object.matrixWorld);
      const p = geometry.getAttribute('position'), n = geometry.getAttribute('normal');
      for (let i = 0; i < p.count; i++) {
        positions.push(p.getX(i), p.getY(i), p.getZ(i));
        normals.push(n.getX(i), n.getY(i), n.getZ(i));
      }
      geometry.dispose();
    });
    combined.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    combined.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    stalk.geometry.dispose(); head.geometry.dispose();
    this.wheat = new THREE.InstancedMesh(combined, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .9 }), mobile ? 270 : 680);
    this.wheat.frustumCulled = false;
    this.wheat.castShadow = !mobile;
    let attempt = 0;
    while (this.plants.length < this.wheat.count) {
      const index = this.plants.length;
      const x = attempt % 2 ? 30 + random(attempt * 41 + 7) * 14 : 7 + random(attempt * 41 + 7) * 9;
      const z = -42 + random(attempt * 31 + 13) * 17;
      attempt++;
      if (millStreamDistance(x, z) < 7.4 || Math.hypot(x - 17, z + 30) < 6 || Math.hypot(x - 8, z + 23) < 8) continue;
      const y = terrainHeight(x, z);
      this.plants.push({ x, y, z, scale: .73 + random(index * 67 + 17) * .58, turn: random(index * 23 + 19) * Math.PI * 2 });
      this.wheat.setColorAt(index, new THREE.Color(0xb6bf6b));
    }
    this.wheat.visible = false;
    this.group.add(this.wheat);

    const wood = new THREE.MeshStandardMaterial({ color: 0x6c4932, roughness: .9 });
    const canvas = new THREE.MeshStandardMaterial({ color: 0xf1e4bf, roughness: .9, side: THREE.DoubleSide });
    this.rotor.position.set(17, 3.9, -27.32);
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(.23, .23, .55, 8), wood);
    axle.rotation.x = Math.PI / 2; this.rotor.add(axle);
    for (let arm = 0; arm < 4; arm++) {
      const blade = new THREE.Group(); blade.rotation.z = arm * Math.PI / 2;
      const beam = new THREE.Mesh(new THREE.BoxGeometry(.13, 3.6, .12), wood);
      beam.position.y = 1.75; blade.add(beam);
      const sail = new THREE.Mesh(new THREE.BoxGeometry(.72, 2.25, .055), canvas);
      sail.position.set(.3, 2.15, .05); blade.add(sail);
      this.rotor.add(blade);
    }
    this.rotor.visible = false; this.group.add(this.rotor);

    this.bridge.position.set(23.1, .6, -38.0);
    this.bridge.rotation.y = -.52;
    for (let i = -4; i <= 4; i++) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(.48, .18, 3.7), wood);
      plank.position.x = i * .48; plank.receiveShadow = true; this.bridge.add(plank);
    }
    this.bridge.visible = false; this.group.add(this.bridge);

    const treeTrunk = new THREE.CylinderGeometry(.24, .38, 2.2, 6);
    const treeCrown = new THREE.IcosahedronGeometry(1, 1);
    const leaf = new THREE.MeshStandardMaterial({ color: 0x547c55, roughness: 1 });
    for (const [x, z] of [[-42, 0], [-38, 24], [-20, 40], [2, 43], [28, 36], [43, 18], [43, -6], [-40, -22]]) {
      const tree = new THREE.Group(); tree.position.set(x, terrainHeight(x, z), z);
      const trunk = new THREE.Mesh(treeTrunk, wood); trunk.position.y = 1.1; tree.add(trunk);
      const crown = new THREE.Mesh(treeCrown, leaf); crown.position.y = 3.3; crown.scale.set(1.75, 2.1, 1.75); tree.add(crown);
      this.grove.add(tree);
    }
    this.grove.visible = false; this.group.add(this.grove);

    const birdGeometry = new THREE.ConeGeometry(.35, .7, 3);
    const birdMaterial = new THREE.MeshBasicMaterial({ color: 0xffecb3, side: THREE.DoubleSide });
    for (let i = 0; i < 12; i++) this.birds.add(new THREE.Mesh(birdGeometry, birdMaterial));
    this.birds.visible = false; this.group.add(this.birds);
    scene.add(this.group);
  }

  setLevels(levels: Levels, secret = false, instant = false): void {
    this.waterTarget = levels.windmill >= 2 ? 1 : 0;
    this.wheatTarget = levels.windmill === 3 ? 1 : levels.windmill >= 2 ? .18 : 0;
    this.rotor.visible = levels.windmill >= 2;
    this.bridge.visible = levels.windmill >= 2 && levels.roads >= 2;
    this.grove.visible = levels.grove > 0;
    this.grove.scale.setScalar(levels.grove === 1 ? .6 : levels.grove === 2 ? .85 : 1);
    this.secret = secret;
    this.birds.visible = secret;
    if (instant || this.reduced.matches) {
      this.waterFill = this.waterTarget;
      this.wheatGrowth = this.wheatTarget;
    }
    const color = new THREE.Color(levels.windmill === 3 ? 0xe7bd5b : 0x91af61);
    for (let i = 0; i < this.wheat.count; i++) this.wheat.setColorAt(i, color);
    if (this.wheat.instanceColor) this.wheat.instanceColor.needsUpdate = true;
    this.update(0, 0);
  }

  update(seconds: number, dt: number): void {
    const step = this.reduced.matches ? 1 : Math.min(1, dt * .48);
    this.waterFill += (this.waterTarget - this.waterFill) * step;
    this.wheatGrowth += (this.wheatTarget - this.wheatGrowth) * step;
    const waterTriangles = Math.floor(this.waterFill * 72);
    this.water.geometry.setDrawRange(0, waterTriangles * 6);
    this.wheat.visible = this.wheatGrowth > .01;
    if (this.wheat.visible) {
      for (let i = 0; i < this.plants.length; i++) {
        const plant = this.plants[i];
        this.dummy.position.set(plant.x, plant.y + .025, plant.z);
        this.dummy.rotation.set(0, plant.turn, Math.sin(seconds * 1.7 + i * .73) * .035);
        this.dummy.scale.set(plant.scale, Math.max(.01, plant.scale * this.wheatGrowth), plant.scale);
        this.dummy.updateMatrix(); this.wheat.setMatrixAt(i, this.dummy.matrix);
      }
      this.wheat.instanceMatrix.needsUpdate = true;
    }
    if (this.rotor.visible && !this.reduced.matches) this.rotor.rotation.z -= dt * .5;
    if (this.secret) for (let i = 0; i < this.birds.children.length; i++) {
      const bird = this.birds.children[i], angle = seconds * .42 + i * Math.PI * 2 / this.birds.children.length;
      bird.position.set(Math.cos(angle) * (10 + i % 3), 13 + Math.sin(seconds * 1.5 + i) * 1.8, Math.sin(angle) * (10 + i % 3));
      bird.rotation.set(Math.PI / 2, 0, -angle);
    }
  }

  dispose(): void {
    this.group.removeFromParent();
    this.group.traverse(object => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        if (Array.isArray(object.material)) object.material.forEach(material => material.dispose());
        else object.material.dispose();
      }
    });
  }
}
