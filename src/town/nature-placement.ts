import * as THREE from 'three';
import { getNatureAsset } from './nature';

type NatureFamily = Parameters<typeof getNatureAsset>[0];
export interface NaturePlacement {
  family: NatureFamily;
  x: number; y: number; z: number;
  sx: number; sy: number; sz: number;
  rotation: number;
}

// Keep authored parts shared and group all placements by family and material.
// There are no zero-scale stand-ins for tree families a site does not use.
export function addNatureInstances(parent: THREE.Group, placements: NaturePlacement[], mobile: boolean, shadows = !mobile): void {
  const families = new Map<NatureFamily, NaturePlacement[]>();
  for (const placement of placements) {
    const group = families.get(placement.family) ?? [];
    group.push(placement); families.set(placement.family, group);
  }
  const transform = new THREE.Object3D();
  for (const [family, sites] of families) {
    for (const part of getNatureAsset(family, mobile)) {
      const mesh = new THREE.InstancedMesh(part.geometry, part.material, sites.length);
      mesh.name = `${family}_${part.role}_instances`;
      sites.forEach((site, index) => {
        transform.position.set(site.x, site.y, site.z);
        transform.rotation.set(0, site.rotation, 0);
        transform.scale.set(site.sx, site.sy, site.sz);
        transform.updateMatrix(); mesh.setMatrixAt(index, transform.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = shadows; mesh.receiveShadow = true;
      mesh.computeBoundingSphere(); parent.add(mesh);
    }
  }
}
