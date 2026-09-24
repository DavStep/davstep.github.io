import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';

test('authored forest and roads reuse source geometry through rebuilds', async()=>{
  Object.defineProperty(globalThis,'matchMedia',{configurable:true,value:()=>({matches:false})});
  const [{Environment},{TownScene},{NATURE_SHARED_GEOMETRIES},{townAt,createSave}]=await Promise.all([
    import('../src/town/environment'),import('../src/town/scene'),import('../src/town/nature'),import('../src/town/model'),
  ]);
  const scene=new THREE.Scene(),environment=new Environment(scene,true);
  assert.ok(environment.trees.length>100);
  const transform=new THREE.Matrix4(),scale=new THREE.Vector3(),position=new THREE.Vector3(),rotation=new THREE.Quaternion();
  let authored=0;
  environment.group.traverse(object=>{
    if(!(object instanceof THREE.InstancedMesh)||!NATURE_SHARED_GEOMETRIES.has(object.geometry))return;
    authored++;
    for(let i=0;i<object.count;i++){
      object.getMatrixAt(i,transform);transform.decompose(position,rotation,scale);
      assert.ok(Math.min(scale.x,scale.y,scale.z)>.01,'invisible placeholder instances');
    }
  });
  assert.ok(authored>=6);
  const town=Object.assign(Object.create(TownScene.prototype),{mobile:true,roads:new THREE.Group()}) as {
    roads:THREE.Group;buildRoads:(snapshot:ReturnType<typeof townAt>)=>void;
  };
  let cachedDisposed=false;
  for(const geometry of NATURE_SHARED_GEOMETRIES)geometry.addEventListener('dispose',()=>{cachedDisposed=true;});
  const save=createSave(0,12345);
  town.buildRoads(townAt(save,30*60000));
  const oldRoad=(town.roads.children.find(o=>o.name==='Worn_dirt_lanes') as THREE.Mesh).geometry;
  let oldDisposed=false;oldRoad.addEventListener('dispose',()=>{oldDisposed=true;});
  town.buildRoads(townAt(save,50*60000));
  assert.ok(oldDisposed);
  assert.equal(cachedDisposed,false);
  assert.ok(town.roads.children.some(o=>o instanceof THREE.InstancedMesh&&NATURE_SHARED_GEOMETRIES.has(o.geometry)));
});

test('building growth rebuilds retain authored buffers and replace merged meshes', async()=>{
  Object.defineProperty(globalThis,'matchMedia',{configurable:true,value:()=>({matches:false})});
  const [{TownScene},{townAt,createSave},...libraries]=await Promise.all([
    import('../src/town/scene'),import('../src/town/model'),
    import('../src/town/cottages'),import('../src/town/civic'),import('../src/town/castle'),
    import('../src/town/props'),import('../src/town/authored-landmarks'),
  ]);
  const sources=new Set<THREE.BufferGeometry>();
  for(const library of libraries)for(const value of Object.values(library))
    if(value instanceof Set)for(const geometry of value)sources.add(geometry);
  let sourceDisposed=false;
  for(const geometry of sources)geometry.addEventListener('dispose',()=>{sourceDisposed=true;});
  const town=Object.assign(Object.create(TownScene.prototype),{
    mobile:false,structures:new THREE.Group(),pickBoxes:new Map(),contactShadows:{setBuildings(){}},
  }) as {structures:THREE.Group;pickBoxes:Map<string,THREE.Box3>;buildStructures:(plots:ReturnType<typeof townAt>['plots'])=>void};
  const save=createSave(0,12345);
  town.buildStructures(townAt(save,20*60000).plots);
  const previous=town.structures.children.map(child=>(child as THREE.Mesh).geometry);
  let disposed=0;for(const geometry of previous)geometry.addEventListener('dispose',()=>{disposed++;});
  town.buildStructures(townAt(save,50*60000).plots);
  assert.equal(disposed,previous.length);
  assert.equal(sourceDisposed,false,'growth disposed a reusable authored buffer');
  assert.equal(town.pickBoxes.size,5);
  for(const child of town.structures.children){
    const geo=(child as THREE.Mesh).geometry;
    assert.ok(geo.getAttribute('position').count>0);
    for(const value of geo.getAttribute('position').array)assert.ok(Number.isFinite(value));
  }
});
