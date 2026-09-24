import * as THREE from 'three';
import type { Levels } from './game';
import type { Idea } from './game';
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

interface WheatPlant { x: number; y: number; z: number; scale: number; turn: number; delay: number }
const seedlingColor = new THREE.Color(0x82b66e);
const harvestColor = new THREE.Color(0xe7bd5b);

export class GameScenery {
  readonly group = new THREE.Group();
  private readonly water: THREE.Mesh;
  private readonly wheat: THREE.InstancedMesh;
  private readonly plants: WheatPlant[] = [];
  private readonly rotor = new THREE.Group();
  private readonly bridge = new THREE.Group();
  private readonly grove = new THREE.Group();
  private readonly birds = new THREE.Group();
  private readonly celebration = new THREE.Group();
  private readonly blossoms = new THREE.Group();
  private readonly archivePages = new THREE.Group();
  private readonly beacon = new THREE.Group();
  private readonly dummy = new THREE.Object3D();
  private readonly plantColor = new THREE.Color();
  private waterFill = 0;
  private waterTarget = 0;
  private wheatGrowth = 0;
  private wheatTarget = 0;
  private secret = false;
  private levels: Levels | null = null;
  private groveGrowth = 0;
  private rotorGrowth = 0;
  private bridgeGrowth = 0;
  private beat: { started: number; failed: boolean } | null = null;
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
      this.plants.push({ x, y, z, scale: .73 + random(index * 67 + 17) * .58, turn: random(index * 23 + 19) * Math.PI * 2, delay: Math.min(.38, millStreamDistance(x, z) * .012) });
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

    const blossomMaterial = new THREE.MeshStandardMaterial({ color: 0xefc2c0, roughness: .92 });
    for (const tree of this.grove.children) {
      for (let i = 0; i < 5; i++) {
        const a = i * 2.4;
        const flower = new THREE.Mesh(new THREE.IcosahedronGeometry(.31, 0), blossomMaterial);
        flower.position.set(tree.position.x + Math.cos(a) * 1.15, tree.position.y + 3.2 + Math.sin(i * 2) * .65, tree.position.z + Math.sin(a) * 1.15);
        this.blossoms.add(flower);
      }
    }
    this.blossoms.visible = false; this.group.add(this.blossoms);

    const paperMaterial = new THREE.MeshStandardMaterial({ color: 0xf7e5b5, roughness: 1, side: THREE.DoubleSide });
    for (let i = 0; i < 9; i++) {
      const page = new THREE.Mesh(new THREE.PlaneGeometry(.58, .7), paperMaterial);
      page.position.set(10 + Math.sin(i * 1.7) * 1.2, 3 + (i % 3) * .28, -8 + i * 4);
      this.archivePages.add(page);
    }
    this.archivePages.visible = false; this.group.add(this.archivePages);

    const beaconMaterial = new THREE.MeshBasicMaterial({ color: 0xffe4a5, transparent: true, opacity: .78 });
    const light = new THREE.Mesh(new THREE.IcosahedronGeometry(.55, 1), beaconMaterial);
    light.position.set(-8, 15, 23); this.beacon.add(light);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(1.35, .07, 5, 24), beaconMaterial);
    halo.position.copy(light.position); halo.rotation.x = Math.PI / 2; this.beacon.add(halo);
    this.beacon.visible = false; this.group.add(this.beacon);

    const birdGeometry = new THREE.ConeGeometry(.35, .7, 3);
    const birdMaterial = new THREE.MeshBasicMaterial({ color: 0xffecb3, side: THREE.DoubleSide });
    for (let i = 0; i < 12; i++) this.birds.add(new THREE.Mesh(birdGeometry, birdMaterial));
    this.birds.visible = false; this.group.add(this.birds);
    scene.add(this.group);
  }

  setLevels(levels: Levels, secret = false, instant = false): void {
    this.levels = levels;
    this.waterTarget = levels.windmill >= 2 ? 1 : 0;
    this.wheatTarget = levels.windmill === 3 ? 1 : levels.windmill >= 2 ? .18 : 0;
    this.rotor.visible = levels.windmill >= 2;
    this.bridge.visible = levels.windmill >= 2 && levels.roads >= 2;
    this.grove.visible = levels.grove > 0;
    this.blossoms.visible = levels.grove === 3;
    this.archivePages.visible = levels.archive >= 2;
    this.beacon.visible = levels.observatory === 3;
    this.secret = secret;
    this.birds.visible = secret;
    if (instant || this.reduced.matches) {
      this.waterFill = this.waterTarget;
      this.wheatGrowth = this.wheatTarget;
      this.groveGrowth = levels.grove === 1 ? .6 : levels.grove === 2 ? .85 : levels.grove === 3 ? 1 : 0;
      this.rotorGrowth = levels.windmill >= 2 ? 1 : 0;
      this.bridgeGrowth = this.bridge.visible ? 1 : 0;
    }
    this.update(0, 0);
  }

  beginBeat(idea: Idea, position: { x: number; z: number }, failed: boolean): void {
    const oldMaterials = new Set<THREE.Material>();
    this.celebration.traverse(object => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); if (Array.isArray(object.material)) object.material.forEach(material => oldMaterials.add(material)); else oldMaterials.add(object.material); } });
    oldMaterials.forEach(material => material.dispose());
    this.celebration.clear();
    const color = failed ? 0xbca993 : ({ settlers: 0xa9d184, grove: 0x84c58c, workshop: 0xe5aa67, roads: 0xc4b791, market: 0xe5c070, windmill: 0x78c6c4, archive: 0xb2a2d4, observatory: 0xffdc91 } satisfies Record<Idea, number>)[idea];
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .85, side: THREE.DoubleSide, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.7, 32), material);
    ring.rotation.x = -Math.PI / 2; ring.position.set(position.x, terrainHeight(position.x, position.z) + .14, position.z);
    this.celebration.add(ring);
    for (let i = 0; i < 12; i++) {
      const mote = new THREE.Mesh(new THREE.IcosahedronGeometry(.16, 0), material);
      const angle = i * Math.PI * 2 / 12;
      mote.userData.angle = angle;
      mote.position.set(position.x + Math.cos(angle) * 1.4, terrainHeight(position.x, position.z) + .6, position.z + Math.sin(angle) * 1.4);
      this.celebration.add(mote);
    }
    this.group.add(this.celebration);
    this.beat = { started: performance.now() / 1000, failed };
  }

  endBeat(): void { this.beat = null; this.celebration.visible = false; }

  update(seconds: number, dt: number): void {
    const immediate = this.reduced.matches;
    const approach = (value: number, target: number, rate: number) => immediate ? target : value < target ? Math.min(target, value + dt * rate) : Math.max(target, value - dt * rate);
    this.waterFill = approach(this.waterFill, this.waterTarget, .52);
    const wheatReady = this.waterTarget === 0 || this.waterFill > .72;
    if (wheatReady) this.wheatGrowth = approach(this.wheatGrowth, this.wheatTarget, .34);
    const groveTarget = this.levels?.grove === 1 ? .6 : this.levels?.grove === 2 ? .85 : this.levels?.grove === 3 ? 1 : 0;
    this.groveGrowth = approach(this.groveGrowth, groveTarget, .48);
    this.grove.children.forEach((tree, i) => tree.scale.setScalar(Math.max(.01, THREE.MathUtils.clamp(this.groveGrowth * 1.3 - i * .035, 0, 1))));
    this.blossoms.children.forEach((flower, i) => flower.scale.setScalar(Math.max(.01, THREE.MathUtils.clamp((this.groveGrowth - .75) * 5 - i % 5 * .09, 0, 1))));
    this.rotorGrowth = approach(this.rotorGrowth, this.rotor.visible ? 1 : 0, .9);
    this.rotor.scale.setScalar(Math.max(.001, this.rotorGrowth));
    this.bridgeGrowth = approach(this.bridgeGrowth, this.bridge.visible ? 1 : 0, .6);
    this.bridge.children.forEach((plank, i) => { plank.position.y = -1.2 * (1 - THREE.MathUtils.clamp(this.bridgeGrowth * 1.6 - i * .075, 0, 1)); });
    const waterTriangles = Math.floor(this.waterFill * 72);
    this.water.geometry.setDrawRange(0, waterTriangles * 6);
    this.wheat.visible = this.wheatGrowth > .01;
    if (this.wheat.visible) {
      for (let i = 0; i < this.plants.length; i++) {
        const plant = this.plants[i];
        const wave = THREE.MathUtils.clamp((this.wheatGrowth - plant.delay) * 1.7, 0, 1);
        this.dummy.position.set(plant.x, plant.y + .025, plant.z);
        this.dummy.rotation.set(0, plant.turn, Math.sin(seconds * 1.7 + i * .73) * .035);
        this.dummy.scale.set(plant.scale, Math.max(.01, plant.scale * wave), plant.scale);
        this.dummy.updateMatrix(); this.wheat.setMatrixAt(i, this.dummy.matrix);
        const gold = THREE.MathUtils.clamp((wave - .55) * 2.25, 0, 1);
        this.wheat.setColorAt(i, this.plantColor.copy(seedlingColor).lerp(harvestColor, gold));
      }
      this.wheat.instanceMatrix.needsUpdate = true;
      if (this.wheat.instanceColor) this.wheat.instanceColor.needsUpdate = true;
    }
    if (this.rotor.visible && !immediate && this.rotorGrowth > .9 && this.waterFill > .6) this.rotor.rotation.z -= dt * .58;
    if (this.archivePages.visible && !immediate) this.archivePages.children.forEach((page, i) => { page.position.y = 3 + i % 3 * .28 + Math.sin(seconds * 2 + i) * .17; page.position.z = -8 + ((seconds * 1.5 + i * 4) % 36); page.rotation.set(Math.sin(seconds + i) * .14, seconds * .4 + i, .1); });
    if (this.beacon.visible && !immediate) { this.beacon.children[1].rotation.z += dt * .38; this.beacon.children[0].scale.setScalar(1 + Math.sin(seconds * 2) * .07); }
    if (this.beat) {
      const progress = (performance.now() / 1000 - this.beat.started) / 1.25;
      this.celebration.visible = progress >= 0 && progress < 1;
      if (this.celebration.visible) {
        const ring = this.celebration.children[0] as THREE.Mesh;
        ring.scale.setScalar(1 + progress * 4);
        (ring.material as THREE.MeshBasicMaterial).opacity = (1 - progress) * .8;
        for (let i = 1; i < this.celebration.children.length; i++) {
          const mote = this.celebration.children[i];
          const a = mote.userData.angle as number;
          mote.position.x += Math.cos(a) * dt * (this.beat.failed ? .7 : 2.5);
          mote.position.z += Math.sin(a) * dt * (this.beat.failed ? .7 : 2.5);
          mote.position.y += dt * (this.beat.failed ? -.35 : 1.1);
          mote.scale.setScalar(1 - progress);
        }
      }
    }
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
