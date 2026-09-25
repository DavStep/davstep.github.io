import { MILL_POOL, millStreamDistance } from './game-path';
import { INFRASTRUCTURE, millAccessDistance } from './town-plan';
import { MILL_SITE } from './windmill-layout';
import { MOAT_HALF_WIDTH, MOAT_RADIUS } from './moat-layout';

/** A whole wheat tile, including its swaying heads, must fit between fences. */
export function wheatSiteClear(x:number,z:number):boolean{
  const radius=Math.hypot(x,z);
  return Math.abs(radius-INFRASTRUCTURE.wall.innerRadius)>3.8
    &&Math.abs(radius-INFRASTRUCTURE.wall.outerRadius)>3.8
    &&Math.abs(radius-MOAT_RADIUS)>MOAT_HALF_WIDTH+3
    &&millStreamDistance(x,z)>4.8
    &&Math.hypot(x-MILL_POOL.x,z-MILL_POOL.z)>MILL_POOL.radius+1.4
    &&Math.hypot(x-29,z+31)>3.6
    &&millAccessDistance(x,z)>2.1
    &&Math.hypot(x-MILL_SITE.x,z-MILL_SITE.z)>6.8
    &&Math.hypot(x-8,z+23)>8.8;
}
