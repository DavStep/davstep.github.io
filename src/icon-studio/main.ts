import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { IDEAS, MAX_LEVEL, type Idea } from '../town/game';
import { buildIdeaScene, groundTile } from './icon-scenes';

const SIZE = 512, OUT = 256;
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setSize(SIZE, SIZE, false);
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), .02).texture;
scene.environmentIntensity = .14;
// Town daylight at the game's time of day (see TownScene.updateAtmosphere).
const sun = new THREE.DirectionalLight(new THREE.Color(0xffedcb).lerp(new THREE.Color(0xfff2d7), .418), 3.15);
sun.position.set(-59.7, 72, 45).normalize().multiplyScalar(40);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = sun.shadow.camera.bottom = -16;
sun.shadow.camera.right = sun.shadow.camera.top = 16;
sun.shadow.camera.near = 1; sun.shadow.camera.far = 90;
sun.shadow.bias = -.0002; sun.shadow.normalBias = .03; sun.shadow.radius = 3;
scene.add(sun, sun.target);
scene.add(new THREE.HemisphereLight(0xd4edfa, 0xb3a282, .88));

const camera = new THREE.PerspectiveCamera(24, 1, .5, 400);
// Seen from the sunlit side, a little above the town camera's pitch.
const VIEW = new THREE.Vector3(-.62, .78, 1).normalize();

const framing = new Map<Idea, { target: THREE.Vector3; distance: number }>();
const UP = new THREE.Vector3(0, 1, 0);
const FORWARD = VIEW.clone().negate();
const RIGHT = new THREE.Vector3().crossVectors(FORWARD, UP).normalize();
const CAM_UP = new THREE.Vector3().crossVectors(RIGHT, FORWARD).normalize();

/** Silhouette sample points: every mesh's world box plus the tile rim. */
function samplePoints(group: THREE.Group, tileRadius: number): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  group.updateMatrixWorld(true);
  group.traverse(object => {
    if (!(object as THREE.Mesh).isMesh) return;
    const box = new THREE.Box3().setFromObject(object);
    if (box.isEmpty()) return;
    for (let i = 0; i < 8; i++) points.push(new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z));
  });
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(a) * tileRadius, .48, Math.sin(a) * tileRadius));
    points.push(new THREE.Vector3(Math.cos(a) * tileRadius * .78, -1.8, Math.sin(a) * tileRadius * .78));
  }
  return points;
}

/** Fits the MAX-level diorama tightly; every level of an idea reuses it. */
function frameFor(idea: Idea) {
  let frame = framing.get(idea);
  if (frame) return frame;
  const { group, tileRadius } = buildIdeaScene(idea, MAX_LEVEL);
  const points = samplePoints(group, tileRadius);
  const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / 1.05;
  const target = new THREE.Box3().setFromPoints(points).getCenter(new THREE.Vector3());
  let distance = 60;
  for (let pass = 0; pass < 4; pass++) {
    const eye = target.clone().addScaledVector(VIEW, distance);
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of points) {
      const v = p.clone().sub(eye), depth = v.dot(FORWARD);
      const x = v.dot(RIGHT) / depth, y = v.dot(CAM_UP) / depth;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    // Re-centre on the projected silhouette, then scale the distance to fit.
    target.addScaledVector(RIGHT, ((minX + maxX) / 2) * distance).addScaledVector(CAM_UP, ((minY + maxY) / 2) * distance);
    distance *= Math.max(maxX - minX, maxY - minY) / 2 / t;
  }
  frame = { target, distance };
  framing.set(idea, frame);
  return frame;
}

const out = document.createElement('canvas');
out.width = out.height = OUT;
const ctx = out.getContext('2d')!;
ctx.imageSmoothingQuality = 'high';

export function renderIcon(idea: Idea, level: number, type = 'image/webp', quality = .92): string {
  const { group, tileRadius } = buildIdeaScene(idea, level);
  const tile = groundTile(tileRadius);
  const root = new THREE.Group();
  root.add(tile, group);
  scene.add(root);
  const { target: center, distance } = frameFor(idea);
  camera.position.copy(center).addScaledVector(VIEW, distance);
  camera.lookAt(center);
  camera.near = Math.max(.5, distance - 40); camera.far = distance + 40;
  camera.updateProjectionMatrix();
  sun.target.position.copy(center);
  sun.position.copy(center).add(new THREE.Vector3(-59.7, 72, 45).normalize().multiplyScalar(45));
  renderer.render(scene, camera);
  ctx.clearRect(0, 0, OUT, OUT);
  ctx.drawImage(renderer.domElement, 0, 0, OUT, OUT);
  scene.remove(root);
  root.traverse(object => {
    const mesh = object as THREE.Mesh;
    // Builders share authored geometry; only dispose what this diorama made.
    if (mesh.isMesh && mesh.geometry.type.endsWith('Geometry') && mesh.geometry.type !== 'BufferGeometry') mesh.geometry.dispose();
  });
  return out.toDataURL(type, quality);
}

Object.assign(window, { iconStudio: { ideas: IDEAS, maxLevel: MAX_LEVEL, render: renderIcon } });

const grid = document.getElementById('grid');
if (grid && !new URLSearchParams(location.search).has('headless')) {
  for (const idea of IDEAS) {
    const label = document.createElement('b');
    label.textContent = idea;
    grid.append(label);
    for (let level = 1; level <= MAX_LEVEL; level++) {
      const img = new Image();
      img.alt = `${idea} level ${level}`;
      img.src = renderIcon(idea, level, 'image/png');
      grid.append(img);
    }
  }
}
