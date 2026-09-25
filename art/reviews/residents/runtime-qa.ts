import * as THREE from 'three';
import { Residents } from '../../../src/town/residents';

const pose = new URLSearchParams(location.search).get('pose') ?? 'hit';
const phase = Number(new URLSearchParams(location.search).get('phase') ?? 0);
let seconds = 100;
Object.defineProperty(performance, 'now', { configurable: true, value: () => seconds * 1000 });
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xc6d5cf);
scene.add(new THREE.HemisphereLight(0xffffff, 0x8e9b93, 2.4));
const sun = new THREE.DirectionalLight(0xffffff, 3);
sun.position.set(-3, 8, 6);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = sun.shadow.camera.bottom = -5;
sun.shadow.camera.right = sun.shadow.camera.top = 5;
scene.add(sun);

const residents = new Residents(scene);
if (pose === 'carry' || pose === 'raised' || pose === 'hit' || pose === 'build' || pose === 'site') {
  residents.startCue('settlers', { x: 20, z: 20 }, false, 5);
  seconds = pose === 'carry' ? 100.9 : pose === 'raised' ? 101.3 : pose === 'build' ? 100.9 + phase * 1.08 : 101.52;
} else if (pose === 'idle') seconds = 87.5;
const figures = (residents as unknown as { figures: { root: THREE.Group; legs: [THREE.Group, THREE.Group] }[] }).figures;
if (pose === 'walk') {
  let strongest = 0;
  let bestTime = seconds;
  for (let time = 100; time < 110; time += .02) {
    seconds = time;
    residents.update({ residents: 1 } as never);
    const stride = Math.abs(figures[0].legs[0].rotation.x);
    if (stride > strongest) {
      strongest = stride;
      bestTime = time;
    }
  }
  seconds = bestTime;
}
residents.update({ residents: 1 } as never);
for (const figure of figures.slice(1)) figure.root.visible = false;
const actor = figures[0].root;
const center = actor.position.clone();
const site = pose === 'site' ? new THREE.Vector3(20, center.y, 20) : null;

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(2.5, 64),
  new THREE.MeshStandardMaterial({ color: 0x9db89c, roughness: 1 }),
);
ground.rotation.x = -Math.PI / 2;
ground.position.set(center.x, center.y - .03, center.z);
ground.receiveShadow = true;
scene.add(ground);
if (site) {
  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, 2.1, 2.6),
    new THREE.MeshStandardMaterial({ color: 0xb99d77, roughness: 1 }),
  );
  wall.position.set(site.x, site.y + 1.05, site.z);
  wall.castShadow = true;
  wall.receiveShadow = true;
  scene.add(wall);
}

const forward = new THREE.Vector3(Math.sin(actor.rotation.y), 0, Math.cos(actor.rotation.y));
const right = new THREE.Vector3(forward.z, 0, -forward.x);
const camera = site
  ? new THREE.OrthographicCamera(-3.4, 3.4, 4.25, -4.25, .1, 100)
  : new THREE.OrthographicCamera(-1.8, 1.8, 2.25, -2.25, .1, 100);
if (site) {
  const midpoint = center.clone().lerp(site, .5);
  camera.position.copy(midpoint).addScaledVector(forward, -5).addScaledVector(right, 5).add(new THREE.Vector3(0, 3.6, 0));
  camera.lookAt(midpoint.x, midpoint.y + 1.1, midpoint.z);
} else {
  camera.position.copy(center).addScaledVector(forward, 5).addScaledVector(right, 3).add(new THREE.Vector3(0, 3.2, 0));
  camera.lookAt(center.x, center.y + 1.25, center.z);
}

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(720, 900);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);
renderer.render(scene, camera);
(window as typeof window & { __settlerReviewReady?: boolean }).__settlerReviewReady = true;
