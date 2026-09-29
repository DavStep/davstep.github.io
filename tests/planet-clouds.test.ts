import test from 'node:test';
import assert from 'node:assert/strict';
import { CloudSimulation, PlanetClouds } from '../src/town/planet-clouds';

test('cloud weather is frame-rate independent and does not fast-forward after hidden tabs',()=>{
  const a=new CloudSimulation(6,()=>-3),b=new CloudSimulation(6,()=>-3);
  a.setEnvironment(true,'clear',true);b.setEnvironment(true,'clear',true);
  for(let i=0;i<600;i++)a.advance(1/60);
  for(let i=0;i<300;i++)b.advance(1/30);
  for(let i=0;i<6;i++){
    assert.ok(a.parcels[i].direction.distanceTo(b.parcels[i].direction)<1e-9);
    assert.ok(Math.abs(a.parcels[i].strength-b.parcels[i].strength)<1e-9);
  }
  const before=a.elapsed;a.advance(300);assert.ok(a.elapsed-before<=.251);
});

test('ocean moisture, weather coverage and slow cloud lifecycles affect the same bounded pool',()=>{
  const ocean=new CloudSimulation(8,()=>-3),inland=new CloudSimulation(8,()=>2);
  ocean.setEnvironment(true,'clear',true);inland.setEnvironment(true,'clear',true);
  const initial=ocean.parcels.map(p=>p.direction.clone());
  let previous=ocean.parcels.map(p=>p.strength);
  for(let i=0;i<1200;i++){
    ocean.advance(.1);inland.advance(.1);
    ocean.parcels.forEach((p,j)=>{
      assert.ok(Math.abs(p.strength-previous[j])<.03,'clouds must fade continuously through the lifetime boundary');
      assert.ok(p.strength>=0&&p.strength<=1&&Math.abs(p.direction.length()-1)<1e-9);
    });
    previous=ocean.parcels.map(p=>p.strength);
  }
  assert.equal(ocean.parcels.length,8);
  assert.ok(ocean.parcels.every((p,i)=>p.humidity>inland.parcels[i].humidity));
  assert.ok(ocean.parcels.every((p,i)=>p.direction.distanceTo(initial[i])>.1));
  const clear=ocean.parcels.reduce((sum,p)=>sum+p.strength,0);
  ocean.setEnvironment(true,'cloudy');for(let i=0;i<10;i++)ocean.advance(.1);assert.ok(ocean.parcels.reduce((sum,p)=>sum+p.strength,0)>clear);
  ocean.setEnvironment(false,'clear');assert.ok(ocean.parcels.every(p=>p.strength===0));assert.equal(ocean.elapsed,0);
});

test('reduced motion freezes clouds, reset clears them and disposal releases pooled geometry once',()=>{
  const clouds=new PlanetClouds(true);clouds.update(true,'clear',true);
  clouds.render(1000,false);clouds.render(1100,false);
  const position=clouds.group.children[3].position.clone(),elapsed=clouds.simulation.elapsed;
  clouds.render(5000,true);clouds.render(9000,true);
  assert.ok(clouds.group.children[3].position.equals(position));assert.equal(clouds.simulation.elapsed,elapsed);
  clouds.render(9034,false);assert.ok(clouds.simulation.elapsed-elapsed<.04);
  const geometries=new Set(clouds.group.children.map(mesh=>(mesh as any).geometry));let disposed=0;
  geometries.forEach(g=>g.addEventListener('dispose',()=>disposed++));
  clouds.update(false,'clear',true);assert.equal(clouds.group.visible,false);
  clouds.dispose();assert.equal(disposed,geometries.size);
});
