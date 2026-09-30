/** Reproducible procedural model review export; run with npx tsx scripts/export-world-event-review.ts. */
import * as THREE from 'three';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createWorldEventDragon } from '../src/town/world-event-dragon';
import { createEventChest, createEventShrine, createEventCaravan, createEventTowerSockets } from '../src/town/world-event-props';

const flying = createWorldEventDragon(false); flying.pose('flying', 0, true);
const sleeping = createWorldEventDragon(false); sleeping.pose('sleeping', 0, true);
const chest = createEventChest(false); chest.lid.rotation.x = -.55;
const assets = [
  { name: 'Dragon_Flying', asset: flying, x: -5, z: -2 },
  { name: 'Dragon_Sleeping', asset: sleeping, x: 5, z: -2 },
  { name: 'Treasure_Chest', asset: chest, x: -7, z: 6 },
  { name: 'Shrine', asset: createEventShrine(false), x: -2.5, z: 6 },
  { name: 'Caravan', asset: createEventCaravan(false), x: 3, z: 6 },
  { name: 'Tower_Sockets', asset: createEventTowerSockets(false), x: 8, z: 6 },
];
const round = (n: number) => Math.round(n * 1e6) / 1e6;
const meshes: unknown[] = [];
const position = new THREE.Vector3();
for (const { name, asset, x, z } of assets) {
  asset.root.position.set(x, 0, z); asset.root.updateMatrixWorld(true);
  asset.root.traverseVisible(object => {
    if (!(object instanceof THREE.Mesh)) return;
    if (Array.isArray(object.material)) throw new Error(`Multi-material mesh needs an explicit adapter: ${object.name}`);
    const material = object.material as THREE.MeshStandardMaterial;
    const buffer = object.geometry.getAttribute('position');
    const vertices: number[] = [];
    for (let i = 0; i < buffer.count; i++) {
      position.fromBufferAttribute(buffer, i).applyMatrix4(object.matrixWorld);
      // Three Y-up -> Blender Z-up is a proper +90-degree rotation about X.
      vertices.push(round(position.x), round(-position.z), round(position.y));
    }
    const indices = object.geometry.index ? Array.from(object.geometry.index.array) : Array.from({ length: buffer.count }, (_, i) => i);
    const path: string[] = []; let parent: THREE.Object3D | null = object;
    while (parent) { path.unshift(parent.name || parent.type); parent = parent.parent; }
    meshes.push({ asset: name, name: object.name, partPath: path.join('/'), vertices, indices,
      sourceMatrixWorld: object.matrixWorld.toArray().map(round),
      material: { name: material.name || `${name}_${material.color.getHexString()}`, baseColorLinear: material.color.toArray().map(round), roughness: material.roughness, metalness: material.metalness, opacity: material.opacity, doubleSided: material.side === THREE.DoubleSide, emissiveLinear: material.emissive.toArray().map(round), emissiveIntensity: material.emissiveIntensity },
    });
  });
  asset.dispose();
}
const output = resolve('art/blender/world-events-review.json'); mkdirSync(resolve('art/blender'), { recursive: true });
writeFileSync(output, JSON.stringify({ version: 1, authoring: 'Procedural Three.js geometry imported into an editable Blender review scene; not Blender-authored', coordinates: 'Baked world-space Blender Z-up: source (x,y,z) -> (x,-z,y). sourceMatrixWorld is diagnostic only; do not apply it again.', meshes }));
console.log(`Exported ${meshes.length} visible material batches to ${output}`);
