import assert from 'node:assert/strict';
import test from 'node:test';

test('road ribbon faces upward, follows terrain and closes ring without a seam', async()=>{
  Object.defineProperty(globalThis,'matchMedia',{configurable:true,value:()=>({matches:false})});
  const {pathRibbon,linePoints,ringPoints}=await import('../src/town/paths');
  const {terrainHeight}=await import('../src/town/environment');
  for(const points of [linePoints({x:-30,z:0},{x:30,z:0}),linePoints({x:0,z:-30},{x:0,z:30}),ringPoints(31.5,40)]){
    const geometry=pathRibbon(points,2.35),p=geometry.getAttribute('position'),n=geometry.getAttribute('normal');
    for(let i=0;i<p.count;i++){
      assert.ok(n.getY(i)>.98,'road face points downward');
      assert.ok(Math.abs(p.getY(i)-terrainHeight(p.getX(i),p.getZ(i))-.048)<1e-5);
    }
    if(points.length>100)for(let offset=0;offset<2;offset++)for(let axis=0;axis<3;axis++)
      assert.ok(Math.abs(p.array[offset*3+axis]-p.array[(p.count-2+offset)*3+axis])<1e-5,'ring seam');
    geometry.dispose();
  }
});
