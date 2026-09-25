import assert from 'node:assert/strict';
import test from 'node:test';
import authored from '../src/town/generated/river-crossings.json';
import { MILL_POOL, STREAM_BRIDGES, millStreamDistance, millStreamPoint } from '../src/town/game-path';
import { wheatSiteClear } from '../src/town/wheat-layout';
import { wallSection, wallSectionFlooded } from '../src/town/wall-layout';
import { INFRASTRUCTURE } from '../src/town/town-plan';

test('Blender river assets provide a complete reusable bridge and open pool rim',()=>{
  const bridges=authored.parts.filter(part=>part.family==='bridge');
  const pool=authored.parts.filter(part=>part.family==='pool');
  assert.ok(bridges.filter(part=>part.name.includes('plank')).length>=20);
  assert.ok(bridges.some(part=>part.name.includes('toprail')));
  assert.ok(bridges.some(part=>part.name.includes('abutment')));
  assert.ok(pool.some(part=>part.material==='water'));
  assert.ok(pool.filter(part=>part.name.includes('bank_stone')).length>=15);
  for(const part of authored.parts){
    assert.equal(part.positions.length,part.normals.length,part.name);
    assert.equal(part.positions.length%9,0,part.name);
    assert.ok(part.positions.every(Number.isFinite),part.name);
  }
  assert.deepEqual([...STREAM_BRIDGES],[.46]);
  assert.deepEqual(millStreamPoint(1),{x:MILL_POOL.x,z:MILL_POOL.z});
});

test('the stream opens the outer wall, while farm tiles stay clear of both fences',()=>{
  const flooded=Array.from({length:INFRASTRUCTURE.wall.segments},(_,i)=>i)
    .filter(i=>wallSectionFlooded(INFRASTRUCTURE.wall.outerRadius,i,true));
  assert.ok(flooded.length>0);
  for(const i of flooded){
    const section=wallSection(INFRASTRUCTURE.wall.outerRadius,i);
    assert.ok([0,.25,.5,.75,1].some(t=>millStreamDistance(
      section.start.x+(section.end.x-section.start.x)*t,
      section.start.z+(section.end.z-section.start.z)*t)<4.1));
  }
  assert.ok(Array.from({length:INFRASTRUCTURE.wall.segments},(_,i)=>i)
    .every(i=>!wallSectionFlooded(INFRASTRUCTURE.wall.outerRadius,i,false)));
  for(const radius of [INFRASTRUCTURE.wall.innerRadius,INFRASTRUCTURE.wall.outerRadius,60]){
    for(let i=0;i<32;i++){
      const angle=(i+.5)*Math.PI*2/32;
      assert.equal(wheatSiteClear(Math.cos(angle)*radius,Math.sin(angle)*radius),false);
    }
  }
  assert.equal(wheatSiteClear(29,-31),false,'the mill cistern stays free of wheat');
  assert.equal(wheatSiteClear(MILL_POOL.x,MILL_POOL.z),false,'the stream pool stays free of wheat');
});
