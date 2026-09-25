import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { IDEAS,evaluate } from '../src/town/game';
import { livingWorldForLevels,livingWorldArrival,isLivingWorldSite,DEER_MEADOW,SHEEP_PASTURE } from '../src/town/living-world-state';
import { LivingWorld,riverVisit,LIVING_WORLD_SHARED_GEOMETRIES,LIVING_WORLD_SHARED_MATERIALS } from '../src/town/living-world';
import { riverCenter,riverHalfWidth,riverSurfaceHeight,terrainHeight,isWater } from '../src/town/environment';
import { MAT } from '../src/town/materials';
import data from '../src/town/generated/living-world.json';

const empty=evaluate([]).levels,full=evaluate(IDEAS).levels;
test('habitat, husbandry and trade have distinct progression requirements',()=>{
  assert.deepEqual(livingWorldForLevels(empty),{birds:0,deer:0,sheep:0,port:0,ships:0});
  assert.equal(livingWorldForLevels(evaluate(['grove']).levels).birds,4);
  assert.equal(livingWorldForLevels(evaluate(['grove']).levels).deer,0);
  assert.equal(livingWorldForLevels(evaluate(['settlers','grove']).levels).deer,2);
  assert.equal(livingWorldForLevels(evaluate(['settlers','grove']).levels).sheep,0);
  assert.equal(livingWorldForLevels(evaluate(IDEAS.slice(0,4)).levels).sheep,3);
  assert.deepEqual(livingWorldForLevels(full),{birds:10,deer:4,sheep:7,port:3,ships:2});
  const sealed=evaluate(['walls','settlers','grove','workshop','roads','market','windmill','archive','observatory']).levels;
  assert.equal(livingWorldForLevels(sealed).ships,0,'sealed or failed supply route cannot produce river trade');
  assert.equal(livingWorldForLevels({...full,market:2}).port,2);
  assert.equal(livingWorldForLevels({...full,river:1}).port,1);
  const mobile=livingWorldForLevels(full,true);assert.equal(mobile.deer,2);assert.equal(mobile.sheep,4);assert.equal(mobile.port,3);
  assert.match(livingWorldArrival(empty,full),/crane/);
  assert.equal(livingWorldArrival(full,full),'');
});

test('merchant hulls stay in the main river, clear the bed, and berth at the port',()=>{
  const vertices=data.parts.filter(p=>p.family==='boat'&&p.lod===0).flatMap(p=>p.positions);
  const matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),euler=new THREE.Euler(),point=new THREE.Vector3();
  for(let i=0;i<=200;i++){
    const visit=riverVisit(i/200);
    assert.equal(visit.z,riverCenter(visit.x));assert.equal(visit.y,riverSurfaceHeight(visit.x));
    q.setFromEuler(euler.set(0,visit.yaw,visit.pitch,'YXZ'));matrix.compose(new THREE.Vector3(visit.x,visit.y,visit.z),q,new THREE.Vector3(1,1,1));
    for(let j=0;j<vertices.length;j+=3){
      point.fromArray(vertices,j).applyMatrix4(matrix);
      assert.ok(Math.abs(point.z-riverCenter(point.x))<riverHalfWidth(point.x)-.5,'clear of both riverbanks');
      assert.ok(point.y>terrainHeight(point.x,point.z)+.08,'shallow hull clears the riverbed');
    }
  }
  assert.equal(riverVisit(.5).x,0);assert.equal(riverVisit(.5).berthed,true);
  assert.equal(riverVisit(.2).berthed,false);
  assert.ok(Math.abs(riverVisit(.42-1e-6).x)<.001);
  assert.ok(Math.abs(riverVisit(.58+1e-6).x)<.001);
});

test('animals remain in dry reserved habitat; motion, reduced motion and reset reconcile',()=>{
  for(const mobile of [false,true]){
    const parent=new THREE.Group(),world=new LivingWorld(parent,mobile);
    world.setLevels(full);
    const counts=livingWorldForLevels(full,mobile);
    for(const [family,count] of [['bird',counts.birds],['deer',counts.deer],['sheep',counts.sheep],['boat',counts.ships]] as const)
      assert.equal(world.group.children.filter(o=>o.name.startsWith(family+'_')&&o.visible).length,count);
    let traveled=false;const first=world.group.getObjectByName('sheep_0')!.position.clone();
    for(let seconds=0;seconds<160;seconds+=4){
      world.update(seconds,false);
      for(const [family,site] of [['deer',DEER_MEADOW],['sheep',SHEEP_PASTURE]] as const){
        for(const object of world.group.children.filter(o=>o.name.startsWith(family+'_')&&o.visible)){
          const p=object.position;assert.ok(Math.hypot(p.x-site.x,p.z-site.z)<5);
          assert.ok(isLivingWorldSite(p.x,p.z));assert.equal(isWater(p.x,p.z,1),false);
          assert.equal(p.y,terrainHeight(p.x,p.z));
        }
      }
      traveled ||= first.distanceTo(world.group.getObjectByName('sheep_0')!.position)>1;
    }
    assert.ok(traveled);
    const transforms=()=>{const values:number[][]=[];world.group.traverse(o=>values.push([...o.position.toArray(),o.rotation.x,o.rotation.y,o.rotation.z]));return values;};
    world.update(1,true);const still=transforms();world.update(90,true);assert.deepEqual(transforms(),still);
    world.setLevels(empty);assert.ok(world.group.children.every(o=>!o.visible));
    let sharedDisposals=0,ownedDisposals=0;const onShared=()=>sharedDisposals++;
    const shared=[...LIVING_WORLD_SHARED_GEOMETRIES,...LIVING_WORLD_SHARED_MATERIALS,...Object.values(MAT)];shared.forEach(o=>o.addEventListener('dispose',onShared));
    world.group.traverse(o=>{if(o instanceof THREE.Mesh&&!LIVING_WORLD_SHARED_GEOMETRIES.has(o.geometry))o.geometry.addEventListener('dispose',()=>ownedDisposals++);});
    world.dispose();assert.equal(parent.children.length,0);assert.equal(sharedDisposals,0);assert.ok(ownedDisposals>0);
    shared.forEach(o=>o.removeEventListener('dispose',onShared));
  }
});

test('authored wildlife and boats retain complete valid low-poly LODs',()=>{
  for(const family of ['bird','sheep','deer','boat'])for(const lod of [0,1]){
    const parts=data.parts.filter(p=>p.family===family&&p.lod===lod);
    assert.ok(parts.length>0);assert.ok(parts.reduce((n,p)=>n+p.positions.length/9,0)<=500);
    for(const part of parts){
      assert.ok(part.positions.every(Number.isFinite));assert.equal(part.positions.length,part.normals.length);
      for(let i=0;i<part.positions.length;i+=9){
        const a=new THREE.Vector3().fromArray(part.positions,i),b=new THREE.Vector3().fromArray(part.positions,i+3),c=new THREE.Vector3().fromArray(part.positions,i+6);
        assert.ok(b.sub(a).cross(c.sub(a)).lengthSq()>1e-12);
      }
    }
  }
});

test('the rendered terrain mesh leaves a navigable channel in both detail tiers',async()=>{
  const {Environment}=await import('../src/town/environment');
  const previous=globalThis.matchMedia;
  globalThis.matchMedia=(()=>({matches:false})) as typeof matchMedia;
  try{for(const mobile of [false,true]){
    const scene=new THREE.Scene(),env=new Environment(scene,mobile,false);
    const terrain=env.group.children.find(o=>o instanceof THREE.Mesh&&o.geometry instanceof THREE.PlaneGeometry) as THREE.Mesh<THREE.PlaneGeometry>;
    const geometry=terrain.geometry,p=geometry.getAttribute('position'),n=geometry.parameters.widthSegments,side=n+1;
    // Match PlaneGeometry's actual triangle split, not just the analytic height function.
    const height=(x:number,z:number)=>{
      let col=0,row=0;while(col<n-1&&p.getX(col+1)<x)col++;while(row<n-1&&p.getZ((row+1)*side)<z)row++;
      const a=row*side+col,b=a+side,d=a+1,c=b+1;
      const u=(x-p.getX(a))/(p.getX(d)-p.getX(a)),v=(z-p.getZ(a))/(p.getZ(b)-p.getZ(a));
      return u+v<=1?p.getY(a)+(p.getY(d)-p.getY(a))*u+(p.getY(b)-p.getY(a))*v:p.getY(c)+(p.getY(b)-p.getY(c))*(1-u)+(p.getY(d)-p.getY(c))*(1-v);
    };
    for(let x=-145;x<=145;x+=1.5)for(const offset of [-1.15,0,1.15])
      assert.ok(riverSurfaceHeight(x)-height(x,riverCenter(x)+offset)>.53,`rendered channel clearance at ${x},${offset} (${mobile?'mobile':'desktop'})`);
    const disposed=new Set<THREE.BufferGeometry>();scene.traverse(o=>{if(o instanceof THREE.Mesh&&!disposed.has(o.geometry)){disposed.add(o.geometry);o.geometry.dispose();}});
  }}finally{globalThis.matchMedia=previous;}
});
