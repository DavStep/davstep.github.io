// Run with: node --import tsx scripts/export-town-review.mjs [--mobile]
// Export actual runtime geometry for neutral Blender composition review.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import * as THREE from 'three';

const mobile = process.argv.includes('--mobile');
globalThis.matchMedia = query => ({ matches: query.includes('max-width') && mobile, addEventListener() {}, removeEventListener() {} });
const root = new URL('../', import.meta.url);
const inputs = ['scene', 'landmarks', 'environment', 'materials', 'residents', 'town-plan', 'model', 'wall-layout', 'contact-shadows', 'sky', 'rain'];
const sourceFiles = new Map(await Promise.all(inputs.map(async name => [name, await readFile(new URL(`src/town/${name}.ts`, root), 'utf8')])));
const sceneUrl = new URL('src/town/scene.ts', root);
const source = sourceFiles.get('scene');
// Export the private factory only in an in-memory audit copy. Resolve imports
// before loading the data URL so runtime code and geometry stay authoritative.
const compiled = ts.transpileModule(source + '\nexport { building };', {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText.replace(/from (['"])([^'"]+)\1/g, (_, quote, name) => {
  const resolved = name.startsWith('.') ? new URL(name + '.ts', sceneUrl).href : import.meta.resolve(name);
  return `from ${quote}${resolved}${quote}`;
});
const { building, TownScene } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const { PLOTS, townAt, createSave } = await import(new URL('src/town/model.ts', root));
const { Environment, terrainHeight } = await import(new URL('src/town/environment.ts', root));
const { ContactShadows } = await import(new URL('src/town/contact-shadows.ts', root));
const { Residents } = await import(new URL('src/town/residents.ts', root));
const { TownSky } = await import(new URL('src/town/sky.ts', root));
const { Rain } = await import(new URL('src/town/rain.ts', root));
const { MAT } = await import(new URL('src/town/materials.ts', root));
const materialNames = new Map(Object.entries(MAT).map(([key, value]) => [value, key]));


const snapshot=townAt(createSave(0,12345),30*60000);
const scene=new THREE.Scene();
const env=new Environment(scene,mobile);
const town=Object.assign(Object.create(TownScene.prototype),{
 mobile,land:new THREE.Group(),structures:new THREE.Group(),roads:new THREE.Group(),walls:new THREE.Group(),
 treeObstacles:[],pickBoxes:new Map(),contactShadows:{setBuildings(){}}
});
town.createDecor();town.buildStructures(snapshot.plots);town.buildRoads(snapshot);town.buildWalls(snapshot);
scene.add(town.land,town.structures,town.roads,town.walls);
const residents=new Residents(scene);residents.update(snapshot);
scene.updateMatrixWorld(true);
const geometries=[],materials=[],objects=[],geometryIds=new Map(),materialIds=new Map();
const materialId=material=>{
 if(materialIds.has(material))return materialIds.get(material);
 const id=materials.length;materialIds.set(material,id);
 materials.push({name:materialNames.get(material)||material.name||'surface_'+id,color:material.color?.toArray()||[1,1,1],
  roughness:material.roughness??.95,emissive:material.emissive?.toArray()||[0,0,0],emissiveIntensity:material.emissiveIntensity??0,
  vertexColors:!!material.vertexColors});return id;
};
scene.traverse(o=>{
 if(!o.isMesh||Array.isArray(o.material)||!o.visible)return;
 if(!geometryIds.has(o.geometry)){
  const geo=o.geometry,id=geometries.length;geometryIds.set(geo,id);
  geometries.push({positions:Array.from(geo.attributes.position.array),indices:geo.index?Array.from(geo.index.array):null,
   colors:geo.attributes.color?Array.from(geo.attributes.color.array):null});
 }
 const geometry=geometryIds.get(o.geometry),material=materialId(o.material),matrix=new THREE.Matrix4(),color=new THREE.Color();
 if(o.isInstancedMesh){
  for(let i=0;i<o.count;i++){
   o.getMatrixAt(i,matrix);matrix.premultiply(o.matrixWorld);
   if(o.instanceColor)o.getColorAt(i,color);else color.set(0xffffff);
   const p=new THREE.Vector3().setFromMatrixPosition(matrix);
   if(Math.hypot(p.x,p.z)>78)continue;
   objects.push({name:o.name||'instance',geometry,material,matrix:matrix.toArray(),color:color.toArray()});
  }
 }else objects.push({name:o.name||'mesh',geometry,material,matrix:o.matrixWorld.toArray(),color:[1,1,1]});
});
const path=new URL('art/reviews/world/runtime-geometry.json',root);
await mkdir(new URL('art/reviews/world/',root),{recursive:true});
await writeFile(path,JSON.stringify({mobile,ageMinutes:30,geometries,materials,objects}));
console.log(JSON.stringify({geometries:geometries.length,materials:materials.length,objects:objects.length,output:fileURLToPath(path)}));
