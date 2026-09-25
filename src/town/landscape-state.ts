import type { Levels } from './game';
import type { Collider } from './collision';

export const MOUNT_QUARRY = { x: -45, z: -14 };
export const MOUNT_CISTERN = { x: 29, z: -31 };
export function isMountWorksite(x: number, z: number) {
  return [[-35,14],[-30,26],[20,34],[35,14]].some(([px,pz])=>Math.abs(x-px)<2.6&&Math.abs(z-pz)<3.1) || Math.hypot(x-MOUNT_QUARRY.x,z-MOUNT_QUARRY.z)<7 || Math.hypot(x-MOUNT_CISTERN.x,z-MOUNT_CISTERN.z)<3.5;
}

export function landscapeColliders(levels: Levels): Collider[] {
  const result: Collider[] = [];
  if(levels.workshop>0)result.push({kind:'box',...MOUNT_QUARRY,hx:4.8,hz:4.3});
  if(levels.windmill>0)result.push({kind:'circle',...MOUNT_CISTERN,r:2.6});
  return result;
}

/** Presentation of the currently playable ten-choice rules. Kept separate
 * from both the evaluator and the proposed ten-choice design. */
export function landscapeForLevels(levels: Levels) {
  return {
    foundations: levels.settlers > 0,
    terraces: levels.roads >= 2,
    buttresses: levels.walls >= 2,
    quarry: levels.workshop > 0,
    quarryWorking: levels.workshop >= 2 && levels.roads >= 2,
    gardens: levels.grove > 0,
    irrigated: levels.grove >= 3 && levels.river >= 2,
    cistern: levels.windmill > 0,
    storedWater: levels.windmill >= 3,
    survey: levels.archive >= 2,
    beacon: Object.values(levels).every(level => level >= 8),
  };
}
