// Dev-only review page: every non-home building family at its in-game stages.
// Open /art/reviews/models/gallery.html?row=civic|projects in `npm run dev`.
import * as THREE from 'three';
import { civicBuilding } from '../../../src/town/civic';
import { authoredLandmarkBuilding } from '../../../src/town/authored-landmarks';
import { castleBuilding } from '../../../src/town/castle';
import type { PlotState } from '../../../src/town/model';

const params = new URLSearchParams(location.search);
const set = params.get('row') ?? 'civic';
const close = params.get('close');
const W = 1600, H = 1000;
const canvas = document.getElementById('c') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(W, H); renderer.shadowMap.enabled = true; renderer.toneMapping = THREE.ACESFilmicToneMapping;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0xcfe3ea);
scene.add(new THREE.HemisphereLight(0xe6f4ff, 0x9c8a6a, 1.2));
const sun = new THREE.DirectionalLight(0xfff0d8, 3); sun.position.set(-40, 60, 40); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -80, right: 80, top: 60, bottom: -60, far: 200 }); scene.add(sun);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0x8fbf6c }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
const plot = (kind: PlotState['kind'], stage: number, x: number, z: number, extra: Partial<PlotState> = {}): PlotState =>
  ({ id: `${kind}-${stage}`, kind, stage, x, z, start: 0, step: 1, renovation: 0, variant: 0, ...extra } as PlotState);
const rows: [string, (s: number, x: number, z: number) => THREE.Group, number[]][] = set === 'civic' ? [
  ['market', (s, x, z) => civicBuilding(plot('market', s, x, z), false), [3, 4, 5, 6, 7, 8]],
  ['tavern', (s, x, z) => civicBuilding(plot('tavern', s, x, z), false), [3, 4, 5, 6, 7, 8]],
  ['forge', (s, x, z) => civicBuilding(plot('forge', s, x, z), false), [3, 4, 5, 6, 7, 8]],
  ['guild', (s, x, z) => civicBuilding(plot('guild', s, x, z), false), [3, 4, 5, 6, 7, 8]],
  ['post', (s, x, z) => civicBuilding(plot('post', s, x, z, { id: 'district-market-trade-office' }), false), [3, 4, 5, 6, 7, 8]],
  ['mill', (s, x, z) => civicBuilding(plot('mill', s, x, z, { id: 'mill' }), false), [4, 5, 6]],
] : [
  ['outpost', (s, x, z) => authoredLandmarkBuilding(plot('project', s, x, z, { id: 'project-outpost', project: 'outpost' }), false), [3, 4, 6]],
  ['sandship', (s, x, z) => authoredLandmarkBuilding(plot('project', s, x, z, { id: 'project-sandship', project: 'sandship' }), false), [3, 4, 6]],
  ['battle', (s, x, z) => authoredLandmarkBuilding(plot('project', s, x, z, { id: 'project-battle', project: 'battle' }), false), [3, 4, 6]],
  ['wizard', (s, x, z) => authoredLandmarkBuilding(plot('project', s, x, z, { id: 'project-wizard', project: 'wizard' }), false), [3, 4, 6]],
  ['dwarves', (s, x, z) => authoredLandmarkBuilding(plot('project', s, x, z, { id: 'project-dwarves', project: 'dwarves' }), false), [3, 4, 6]],
  ['castle', (s, x, z) => castleBuilding(plot('castle', s, x, z, { id: 'castle' }), false), [1, 2, 3]],
];
const gap = 17;
rows.forEach(([, make, stages], r) => stages.forEach((s, c) => {
  const g = make(s, (c - 2.5) * gap, (r - rows.length / 2 + .5) * gap);
  g.traverse(o => { if (o instanceof THREE.Mesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(g);
}));
const camera = new THREE.PerspectiveCamera(30, W / H, 1, 600);
camera.position.set(60, 120, 150); camera.lookAt(0, 0, 4);
if (close) {
  // Front three-quarter close-up of one row: ?close=<row index>
  const r = Number(close), z = (r - rows.length / 2 + .5) * gap;
  camera.fov = 22; camera.position.set(22, 30, z + 62); camera.lookAt(0, 3, z); camera.updateProjectionMatrix();
}
renderer.render(scene, camera);
document.body.dataset.ready = '1';
