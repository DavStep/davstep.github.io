import { landHeight } from './topography';
export const riverCenter=(x:number)=>-86+7*Math.sin(x*.027)+3*Math.sin(x*.071+1.3);
export const riverHalfWidth=(x:number)=>4.35+.42*Math.sin(x*.037)+.18*Math.sin(x*.11+1);
export const riverSurfaceHeight=(x:number)=>landHeight(x,riverCenter(x))-.78;
