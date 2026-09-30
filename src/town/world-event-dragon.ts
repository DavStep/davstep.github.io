import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export type DragonPose = 'flying' | 'calmed' | 'sleeping';
export interface WorldEventDragon {
  root: THREE.Group;
  /** Time is in seconds. Placement and heading remain owned by the caller. */
  pose(mode: DragonPose, time: number, reducedMotion?: boolean): void;
  dispose(): void;
}

type Paint = 'skin' | 'belly' | 'membrane' | 'horn' | 'dark' | 'eye';
const COLORS: Record<Paint, number> = { skin: 0xc9553b, belly: 0xefb95e, membrane: 0x8f3043, horn: 0xffe2ab, dark: 0x392a32, eye: 0xffd25b };

/** Procedural Three.js sculpture, not a Blender asset. Local +Z is forward, Y=0 is ground. */
export function createWorldEventDragon(mobile: boolean): WorldEventDragon {
  const root = new THREE.Group(); root.name = 'ENV_WorldEvent_Dragon_LOD0';
  root.userData.authoring = 'procedural-threejs';
  const body = new THREE.Group(); body.name = 'breathing_body'; root.add(body);
  const head = new THREE.Group(); head.name = 'head'; body.add(head);
  const eyes = new THREE.Group(); eyes.name = 'open_eyes'; head.add(eyes);
  const lids = new THREE.Group(); lids.name = 'sleeping_eyelids'; head.add(lids);
  const wings: THREE.Group[] = [], tails: THREE.Group[] = [], feet: THREE.Group[] = [];
  const batches = new Map<THREE.Group, Map<Paint, THREE.BufferGeometry[]>>();
  const resources = new Set<THREE.BufferGeometry>();
  const paints = new Map<Paint, THREE.MeshStandardMaterial>();
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const up = v(0, 1, 0);
  const add = (g: THREE.BufferGeometry, paint: Paint, group: THREE.Group, p = v(0, 0, 0), scale = v(1, 1, 1), q = new THREE.Quaternion()) => {
    g.applyMatrix4(new THREE.Matrix4().compose(p, q, scale)); g.deleteAttribute('uv');
    const flat = g.index ? g.toNonIndexed() : g; if (flat !== g) g.dispose();
    const bucket = batches.get(group) ?? new Map<Paint, THREE.BufferGeometry[]>();
    const parts = bucket.get(paint) ?? []; parts.push(flat); bucket.set(paint, parts); batches.set(group, bucket);
  };
  const ball = (group: THREE.Group, paint: Paint, x: number, y: number, z: number, sx: number, sy: number, sz: number) =>
    add(new THREE.SphereGeometry(1, mobile ? 10 : 14, mobile ? 7 : 9), paint, group, v(x, y, z), v(sx, sy, sz));
  const rod = (group: THREE.Group, paint: Paint, a: THREE.Vector3, b: THREE.Vector3, r: number, tip = r) => {
    const direction = b.clone().sub(a);
    add(new THREE.CylinderGeometry(tip, r, direction.length(), mobile ? 5 : 7), paint, group, a.clone().add(b).multiplyScalar(.5), undefined, new THREE.Quaternion().setFromUnitVectors(up, direction.normalize()));
  };
  const line = (group: THREE.Group, paint: Paint, points: THREE.Vector3[], radius: number) =>
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), mobile ? 8 : 14, radius, 5, false), paint, group);

  // Pear-shaped shoulders and haunches; broad warm belly plates stay readable from above.
  ball(body, 'skin', 0, 1.23, -.28, .87, .88, 1.38);
  ball(body, 'belly', 0, 1.16, .61, .65, .65, .65);
  for (let i = 0; i < 5; i++) ball(body, 'belly', 0, 1.02 + i * .15, .96 - i * .03, .57 - i * .04, .10, .17);
  for (let i = 0; i < 6; i++) {
    const z = -.99 + i * .35;
    rod(body, 'horn', v(0, 1.96 + .12 * Math.sin(i), z), v(0, 2.34 + .12 * Math.sin(i), z - .13), .17, 0);
  }

  // A generous muzzle, heavy brows and swept horns give the silhouette a face.
  ball(head, 'skin', 0, .28, .40, .65, .61, .72);
  ball(head, 'skin', 0, .08, 1.02, .61, .34, .59);
  ball(head, 'belly', 0, -.12, 1.06, .54, .16, .52);
  for (const side of [-1, 1]) {
    ball(head, 'dark', side * .31, .29, 1.46, .085, .055, .035);
    line(head, 'dark', [v(side * .56, .015, 1.3), v(side * .59, -.035, .96), v(side * .56, .04, .75)], .018);
    ball(eyes, 'horn', side * .56, .40, .70, .15, .20, .22);
    ball(eyes, 'eye', side * .665, .41, .77, .045, .14, .14);
    ball(eyes, 'dark', side * .699, .42, .81, .02, .10, .046);
    ball(eyes, 'horn', side * .713, .48, .84, .018, .029, .025);
    line(lids, 'dark', [v(side * .65, .40, .88), v(side * .69, .36, .72), v(side * .61, .40, .56)], .029);
    line(head, 'skin', [v(side * .46, .59, .90), v(side * .59, .64, .70), v(side * .57, .62, .45)], .09);
    rod(head, 'horn', v(side * .43, .69, .19), v(side * .61, 1.07, -.13), .16, .09);
    rod(head, 'horn', v(side * .61, 1.07, -.13), v(side * .67, 1.18, -.46), .09, 0);
    rod(head, 'skin', v(side * .52, .42, .13), v(side * .92, .57, -.25), .22, .01);
  }

  // Wings are hinged at the shoulders; curved scalloped panels are intentionally open surfaces.
  for (const side of [-1, 1]) {
    const wing = new THREE.Group(); wing.name = side < 0 ? 'wing_left' : 'wing_right'; body.add(wing); wings.push(wing);
    wing.position.set(side * .58, 1.84, .20);
    const wrist = v(side * 1.35, .55, .12);
    rod(wing, 'skin', v(0, 0, 0), wrist, .16, .10);
    const tips = [v(side * 3.4, .31, .65), v(side * 2.94, .03, -.55), v(side * 2.29, -.11, -1.47), v(side * 1.35, -.22, -1.75), v(side * .16, -.28, -1.05)];
    for (const tip of tips.slice(0, -1)) {
      rod(wing, 'skin', wrist, tip, .07, .025);
      rod(wing, 'horn', tip, tip.clone().add(v(side * .11, .06, .02)), .04, 0);
    }
    for (let i = 0; i < tips.length - 1; i++) {
      const a = tips[i], b = tips[i + 1], positions: number[] = [];
      // Pull the trailing edge toward the wrist to create bat-wing scallops.
      const edge: THREE.Vector3[] = [];
      for (let j = 0; j <= 6; j++) {
        const t = j / 6;
        const p = a.clone().lerp(b, t).lerp(wrist, .22 * Math.sin(Math.PI * t)); edge.push(p);
        if (j > 0) positions.push(...wrist.toArray(), ...edge[j - 1].toArray(), ...p.toArray());
      }
      const membrane = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); membrane.computeVertexNormals(); add(membrane, 'membrane', wing);
      line(wing, 'skin', edge, .027);
    }
    rod(wing, 'horn', wrist, wrist.clone().add(v(side * .1, .28, .10)), .095, 0);
  }

  for (const side of [-1, 1]) for (const front of [false, true]) {
    const foot = new THREE.Group(); foot.name = `${front ? 'fore' : 'hind'}leg_${side}`; body.add(foot); feet.push(foot);
    foot.position.set(side * .66, .65, front ? .68 : -.94);
    ball(foot, 'skin', side * .08, 0, -.03, front ? .25 : .38, .44, .37);
    rod(foot, 'skin', v(side * .08, -.03, 0), v(side * .19, -.39, .12), .18, .14);
    ball(foot, 'skin', side * .19, -.48, .25, .29, .17, .43);
    for (let toe = -1; toe <= 1; toe++) rod(foot, 'horn', v(side * .19 + toe * .15, -.50, .51), v(side * .19 + toe * .16, -.53, .72), .062, 0);
  }

  // Nested tapered segments let the tail wrap around the sleeping body without scaling it.
  let parent = body;
  for (let i = 0; i < 6; i++) {
    const tail = new THREE.Group(); tail.name = `tail_${i}`; parent.add(tail); tails.push(tail);
    tail.position.set(0, i === 0 ? 1.02 : 0, i === 0 ? -1.2 : -.39);
    const radius = .33 * (1 - i / 6) + .025;
    rod(tail, 'skin', v(0, 0, .08), v(0, -.045, -.45), radius, radius * .72);
    rod(tail, 'horn', v(0, radius * .8, -.14), v(0, radius + .20, -.28), radius * .42, 0);
    parent = tail;
  }
  rod(parent, 'skin', v(0, 0, -.32), v(.12, .04, -.69), .10, 0);

  for (const [group, bucket] of batches) for (const [paint, parts] of bucket) {
    const geometry = mergeGeometries(parts)!; parts.forEach(part => part.dispose()); geometry.computeBoundingSphere(); resources.add(geometry);
    let material = paints.get(paint);
    if (!material) { material = new THREE.MeshStandardMaterial({ name: `MAT_Dragon_${paint}`, color: COLORS[paint], roughness: .83, side: paint === 'membrane' ? THREE.DoubleSide : THREE.FrontSide }); paints.set(paint, material); }
    const mesh = new THREE.Mesh(geometry, material); mesh.name = `${group.name}_${paint}`; mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh);
  }
  root.traverse(object => { object.userData.planetNative = true; });
  let disposed = false;
  const pose = (mode: DragonPose, time: number, reducedMotion = false) => {
    const t = reducedMotion || !Number.isFinite(time) ? 0 : time;
    const sleeping = mode === 'sleeping', flying = mode === 'flying';
    const breath = reducedMotion ? 0 : Math.sin(t * (sleeping ? 1.35 : 2.1));
    body.position.y = sleeping ? -.18 : flying ? .13 + breath * .05 : 0;
    body.scale.y = 1 + breath * (sleeping ? .013 : .006);
    head.position.set(sleeping ? .22 : 0, sleeping ? .70 : 1.75, sleeping ? .83 : .94);
    head.rotation.set(sleeping ? -.10 : flying ? -.12 : .04 + breath * .015, sleeping ? -.30 : 0, sleeping ? -.14 : 0);
    eyes.visible = !sleeping; lids.visible = sleeping;
    for (let i = 0; i < wings.length; i++) {
      const side = i === 0 ? -1 : 1, wing = wings[i];
      wing.rotation.set(0, side * (sleeping ? .92 : flying ? .08 : .64), side * (sleeping ? -.12 : flying ? Math.sin(t * 4) * .34 : .46));
      wing.scale.set(sleeping ? .58 : flying ? 1 : .72, 1, sleeping ? .76 : 1);
    }
    for (let i = 0; i < tails.length; i++) tails[i].rotation.set(sleeping ? -.04 : .10, sleeping ? -.62 : .13 + Math.sin(t * 1.6 - i * .4) * (reducedMotion ? 0 : .045), 0);
    for (const foot of feet) { foot.rotation.x = flying ? -.48 : sleeping ? -.15 : 0; foot.position.y = sleeping ? .90 : .65; }
  };
  pose('calmed', 0);
  return { root, pose, dispose() { if (disposed) return; disposed = true; resources.forEach(g => g.dispose()); paints.forEach(m => m.dispose()); root.removeFromParent(); } };
}
