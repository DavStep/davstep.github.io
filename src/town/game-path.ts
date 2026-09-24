export interface GroundPoint { x: number; z: number }

// Starts inside the existing river and bends around the town to the mill.
const controls: readonly GroundPoint[] = [
  { x: 30, z: -79 }, { x: 32, z: -72 }, { x: 29, z: -43 }, { x: 20, z: -33 },
];

export function millStreamPoint(t: number): GroundPoint {
  const s = 1 - t;
  const a = s * s * s, b = 3 * s * s * t, c = 3 * s * t * t, d = t * t * t;
  return {
    x: controls[0].x * a + controls[1].x * b + controls[2].x * c + controls[3].x * d,
    z: controls[0].z * a + controls[1].z * b + controls[2].z * c + controls[3].z * d,
  };
}

const samples = Array.from({ length: 33 }, (_, index) => millStreamPoint(index / 32));

export function millStreamDistance(x: number, z: number): number {
  let best = Infinity;
  for (let index = 1; index < samples.length; index++) {
    const a = samples[index - 1], b = samples[index];
    const dx = b.x - a.x, dz = b.z - a.z;
    const lengthSq = dx * dx + dz * dz;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / lengthSq));
    best = Math.min(best, Math.hypot(x - a.x - dx * t, z - a.z - dz * t));
  }
  return best;
}

export function streamCollisionSegments(): { kind: 'segment'; ax: number; az: number; bx: number; bz: number; r: number }[] {
  const result: { kind: 'segment'; ax: number; az: number; bx: number; bz: number; r: number }[] = [];
  for (let index = 6; index < 31; index++) {
    const t = index / 32;
    if (t > .81 && t < .96) continue; // the planked crossing
    const a = samples[index], b = samples[index + 1];
    result.push({ kind: 'segment', ax: a.x, az: a.z, bx: b.x, bz: b.z, r: 2.05 });
  }
  return result;
}
