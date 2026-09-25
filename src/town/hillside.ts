import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import data from './generated/castle-mount.json';
import { MAT } from './materials';
import { terrainHeight } from './environment';
import { landscapeForLevels } from './landscape-state';
import type { Levels } from './game';
import { MOUNT_HEIGHT, VALLEY_FLOOR } from './topography';
import { PLOTS } from './town-plan';

type Family = 'retaining' | 'buttress' | 'quarry' | 'cistern';
interface Site { x: number; y: number; z: number; turn?: number; scale?: number }
const kit = new Map<string, { geometry: THREE.BufferGeometry; material: THREE.Material }[]>();
for (const lod of [0, 1]) for (const family of ['retaining', 'buttress', 'quarry', 'cistern']) {
  const buckets = new Map<string, THREE.BufferGeometry[]>();
  for (const part of data.parts.filter(part => part.lod === lod && part.family === family)) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(part.positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(part.normals, 3));
    const bucket = buckets.get(part.material) ?? [];
    bucket.push(geometry); buckets.set(part.material, bucket);
  }
  kit.set(`${family}:${lod}`, [...buckets].map(([name, geometries]) => {
    const geometry = mergeGeometries(geometries)!;
    geometries.forEach(part => part.dispose());
    geometry.computeBoundingSphere();
    return { geometry, material: MAT[name as keyof typeof MAT] };
  }));
}
export const HILLSIDE_SHARED_GEOMETRIES = new Set([...kit.values()].flatMap(parts => parts.map(part => part.geometry)));

function place(parent: THREE.Group, family: Family, sites: Site[], mobile: boolean) {
  if (!sites.length) return;
  const dummy = new THREE.Object3D();
  for (const part of kit.get(`${family}:${mobile ? 1 : 0}`)!) {
    const mesh = new THREE.InstancedMesh(part.geometry, part.material, sites.length);
    mesh.name = `Mount_${family}`;
    sites.forEach((site, i) => {
      dummy.position.set(site.x, site.y, site.z); dummy.rotation.y = site.turn ?? 0;
      dummy.scale.setScalar(site.scale ?? 1); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere();
    mesh.castShadow = !mobile; mesh.receiveShadow = true; parent.add(mesh);
  }
}

/** Permanent geology comes from topography; these are the marks the town
 * leaves on it. All groups are built once and reconcile directly on reset. */
export class Hillside {
  readonly group = new THREE.Group();
  private readonly foundations = new THREE.Group();
  private readonly terraces = new THREE.Group();
  private readonly buttresses = new THREE.Group();
  private readonly quarry = new THREE.Group();
  private readonly cart = new THREE.Group();
  private readonly gardens = new THREE.Group();
  private readonly crops = new THREE.Group();
  private readonly cistern = new THREE.Group();
  private readonly survey = new THREE.Group();
  private readonly beacon = new THREE.Group();
  private readonly water: THREE.Mesh;
  private working = false;
  private readonly ownedGeometries = new Set<THREE.BufferGeometry>();
  private readonly ownedMaterials = new Set<THREE.Material>();

  constructor(parent: THREE.Group, mobile: boolean) {
    this.group.name = 'Reactive_castle_mount';
    for (const name of ['foundations','terraces','buttresses','quarry','cart','gardens','crops','cistern','survey','beacon'] as const) {
      const group = this[name]; group.name = name; group.visible = false; this.group.add(group);
    }
    const summit: Site[] = [], terrace: Site[] = [], buttress: Site[] = [];
    for (const radius of [11.6, 27.2]) {
      const count = radius < 15 ? 16 : 40;
      for (let i = 0; i < count; i++) {
        const a = (i + .5) * Math.PI * 2 / count, x = Math.cos(a) * radius, z = Math.sin(a) * radius;
        // Leave the four graded approaches and every occupied plot open.
        if (Math.min(Math.abs(x), Math.abs(z)) < 3.4) continue;
        if (radius > 15 && PLOTS.some(p => Math.hypot(x - p.x, z - p.z) < (p.kind === 'project' ? 7 : 5))) continue;
        const site = { x, y: radius < 15 ? VALLEY_FLOOR+MOUNT_HEIGHT-2.2 : terrainHeight(x,z)-1.85, z, turn: Math.PI / 2 - a };
        (radius < 15 ? summit : terrace).push(site);
        if (radius < 15 && i % 2 === 0) buttress.push({ ...site, y: site.y - 1.3 });
      }
    }
    place(this.foundations, 'retaining', summit, mobile);
    place(this.terraces, 'retaining', terrace, mobile);
    place(this.buttresses, 'buttress', buttress, mobile);
    place(this.quarry, 'quarry', [{ x: -45, y: terrainHeight(-45, -14) - .2, z: -14, turn: -Math.PI / 2 }], mobile);
    place(this.cistern, 'cistern', [{ x: 29, y: terrainHeight(29, -31) - .08, z: -31 }], mobile);
    this.water = this.mesh(new THREE.CircleGeometry(2.06, mobile ? 16 : 28), new THREE.MeshStandardMaterial({ color: 0x58b7bf, roughness: .25 }), this.cistern);
    this.ownedMaterials.add(this.water.material as THREE.Material);
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.set(29, terrainHeight(29, -31) + 1.08, -31);

    const cartBody = this.mesh(new THREE.BoxGeometry(1.35, .75, 1.55), MAT.woodDark, this.cart);
    cartBody.position.y = .7;
    for (const side of [-1, 1]) {
      const wheel = this.mesh(new THREE.CylinderGeometry(.38, .38, .16, 8), MAT.iron, this.cart);
      wheel.rotation.z = Math.PI / 2; wheel.position.set(side * .76, .35, 0);
    }
    const load = this.mesh(new THREE.BoxGeometry(.95, .5, 1.05), MAT.stone, this.cart); load.position.y = 1.23;

    for (const [x, z] of [[-35, 14], [-30, 26], [20, 34], [35, 14]]) {
      const bed = new THREE.PlaneGeometry(3.8,4.8,4,5); bed.rotateX(-Math.PI/2);
      const vertices = bed.getAttribute('position');
      for(let i=0;i<vertices.count;i++) {
        const px=x+vertices.getX(i),pz=z+vertices.getZ(i);
        vertices.setXYZ(i,px,terrainHeight(px,pz)+.05,pz);
      }
      bed.computeVertexNormals(); this.mesh(bed,MAT.earth,this.gardens);
      // The cultivated shelf gains visible irrigation furrows with a working mill.
      for(const side of [-1,1]) {
        const furrow=new THREE.PlaneGeometry(.14,4.4,1,8); furrow.rotateX(-Math.PI/2);
        const points=furrow.getAttribute('position');
        for(let i=0;i<points.count;i++) {
          const px=x+side*1.7+points.getX(i),pz=z+points.getZ(i);
          points.setXYZ(i,px,terrainHeight(px,pz)+.075,pz);
        }
        furrow.computeVertexNormals(); this.mesh(furrow,this.water.material as THREE.Material,this.crops);
      }
      for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) {
        const plant = this.mesh(new THREE.IcosahedronGeometry(.34, 0), MAT.leaf, this.crops);
        const px = x - 1.2 + row * 1.2, pz = z - 1.8 + col * 1.2;
        plant.position.set(px, terrainHeight(px, pz) + .28, pz);
      }
    }
    for (const p of PLOTS.filter(p => p.kind === 'project')) {
      const x = p.x + 5.65, z = p.z + 4.8;
      const stake = this.mesh(new THREE.BoxGeometry(.13, 1.5, .13), MAT.woodDark, this.survey);
      stake.position.set(x, terrainHeight(x, z) + .75, z);
      const flag = this.mesh(new THREE.BoxGeometry(.72, .4, .06), MAT.gold, this.survey);
      flag.position.set(x + .35, terrainHeight(x, z) + 1.25, z);
    }
    const glowMaterial = new THREE.MeshBasicMaterial({ color: 0xffd780 }); this.ownedMaterials.add(glowMaterial);
    const light = this.mesh(new THREE.IcosahedronGeometry(.85, 1), glowMaterial, this.beacon);
    light.position.set(0, terrainHeight(0, 0) + 19.5, 0);
    const halo = this.mesh(new THREE.TorusGeometry(1.7, .08, 5, 24), glowMaterial, this.beacon);
    halo.position.copy(light.position); halo.rotation.x = Math.PI / 2;
    parent.add(this.group);
  }

  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Group) {
    this.ownedGeometries.add(geometry);
    const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = true; mesh.receiveShadow = true;
    parent.add(mesh); return mesh;
  }

  setLevels(levels: Levels) {
    const state = landscapeForLevels(levels);
    this.foundations.visible = state.foundations; this.terraces.visible = state.terraces;
    this.buttresses.visible = state.buttresses; this.quarry.visible = state.quarry;
    this.working = state.quarryWorking; this.cart.visible = state.quarryWorking;
    this.gardens.visible = state.gardens; this.crops.visible = state.irrigated;
    this.cistern.visible = state.cistern; this.water.visible = state.storedWater;
    this.survey.visible = state.survey; this.beacon.visible = state.beacon;
  }

  update(seconds: number, reduced: boolean) {
    if (this.working) {
      // A local stone handcart on the quarry spur; it never crosses a sealed wall.
      const phase = reduced ? .5 : (seconds * .09) % 2;
      const x = -47 + (phase < 1 ? phase : 2 - phase) * 7, z = -9;
      this.cart.position.set(x, terrainHeight(x, z), z);
      this.cart.rotation.y = phase < 1 ? Math.PI / 2 : -Math.PI / 2;
    }
  }

  dispose() {
    this.group.removeFromParent();
    this.group.traverse(object=>{if(object instanceof THREE.InstancedMesh)object.dispose();});
    this.ownedGeometries.forEach(geometry => geometry.dispose());
    this.ownedMaterials.forEach(material => material.dispose());
    this.group.clear();
  }
}
