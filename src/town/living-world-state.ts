import type { Levels } from './game';

export const DEER_MEADOW = { x: -76, z: 14 };
export const SHEEP_PASTURE = { x: 64, z: 22 };
export const PORT_X = 0;

/** Keep animal paths and the north-gate port approach free of random scenery. */
export function isLivingWorldSite(x: number,z: number): boolean {
  return Math.hypot(x-DEER_MEADOW.x,z-DEER_MEADOW.z)<12
    || Math.hypot(x-SHEEP_PASTURE.x,z-SHEEP_PASTURE.z)<9
    || Math.abs(x-PORT_X)<9&&z<-55&&z>-92;
}

export function livingWorldForLevels(levels: Levels,mobile=false) {
  const birds=levels.grove>0?2+levels.grove*2+(levels.river>=2?2:0):0;
  const deer=levels.grove>=2?(levels.grove>=3?4:2):0;
  const sheep=levels.settlers>=2&&levels.grove>0?3+(levels.river>=2?2:0)+(levels.settlers>=3?2:0):0;
  let port=0;
  if(levels.roads>=2&&levels.river>0)port=1;
  if(port&&levels.river>=2&&levels.market>=2)port=2;
  if(port===2&&levels.river>=3&&levels.market>=3&&levels.workshop>=3)port=3;
  return {birds:Math.min(birds,mobile?6:10),deer:Math.min(deer,mobile?2:4),sheep:Math.min(sheep,mobile?4:7),port,ships:port>=2?(port>=3?2:1):0};
}

export function livingWorldArrival(before:Levels,after:Levels):string {
  const a=livingWorldForLevels(before),b=livingWorldForLevels(after);
  const events:string[]=[];
  if(b.port>a.port)events.push(b.port>=3?'A crane rises over the port; more merchants join the river route.':b.port===2?'The river route opens. A merchant boat calls at the quay.':'A wooden landing reaches the river from the north road.');
  if(b.deer>a.deer)events.push('Deer gather in the woodland clearing.');
  if(b.sheep>a.sheep)events.push('More sheep graze in the pasture beyond the east wall.');
  if(b.birds>a.birds)events.push('More birds circle the growing groves.');
  return events.join(' ');
}
