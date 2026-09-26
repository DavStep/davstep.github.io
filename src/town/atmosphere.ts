import * as THREE from 'three';

/**
 * Per-frame atmosphere values shared between the scene lighting (writer:
 * TownScene.updateAtmosphere) and custom shaders such as water (readers).
 * Uniform objects are shared by reference, so shaders see updates without
 * recompiling.
 */
export const ATMOSPHERE = {
  /** Normalised world-space direction pointing from the ground towards the sun. */
  sunDirection: { value: new THREE.Vector3(-.6, .7, .4).normalize() },
  /** Linear sun colour multiplied by its intensity scale (0..~1.2). */
  sunColor: { value: new THREE.Color(0xffe0ad) },
  /** Sky colour at the horizon (matches fog). */
  skyHorizon: { value: new THREE.Color(0xc9ecf2) },
  /** Sky colour overhead. */
  skyZenith: { value: new THREE.Color(0x5db6e8) },
  /** 0 = day, 1 = full night. */
  night: { value: 0 },
};
